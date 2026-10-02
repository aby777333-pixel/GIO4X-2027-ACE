-- =============================================================================
-- GIO4X · tests for 0020_blog_revisions · run after applying supabase/migrations/0020_blog_revisions.sql
-- =============================================================================
-- Run as the role that applies migrations (on Supabase: postgres). Everything
-- happens inside one transaction that is rolled back: no post, revision,
-- constraint or audit entry made here survives.
--
-- How it works: the script becomes the API roles the way PostgREST does
-- (`role` and `request.jwt.claims`, both transaction-local), tries something,
-- returns to the role it started as, and writes one row per check into a
-- temporary table. The last statement before the rollback lists the results:
-- every row should say PASS.
--
-- Identities used:
--   publisher   an existing active admin from public.staff (holds blog.read,
--               blog.write and blog.publish)
--   outsider    a signed-in user with no staff row (an id that does not exist)
--   visitor     the anon role
--
-- One check makes the revision insert fail on purpose (a temporary constraint
-- on blog_revisions, added and dropped inside this transaction) to prove that
-- a post is still saved. It prints one WARNING from the trigger: expected.
-- =============================================================================

begin;

create temp table blog_revisions_test_results (
  n    serial primary key,
  test text not null,
  -- null (a comparison with a row that is not there) is listed as FAIL
  pass boolean,
  note text not null default ''
) on commit drop;

do $test$
declare
  me        text := current_user;
  admin_id  uuid;
  staff_jwt text;
  other_jwt text := json_build_object('sub', '00000000-0000-4000-8000-000000000020', 'role', 'authenticated')::text;
  anon_jwt  text := json_build_object('role', 'anon')::text;
  p_id uuid;  -- a post written as a draft
  q_id uuid;  -- a post created already published
  n integer;
  seen integer;
  i integer;
  outcome text;
  rev record;
  stored text;
begin
  select s.user_id into admin_id from public.staff s where s.role = 'admin' and s.active order by s.created_at limit 1;
  insert into blog_revisions_test_results (test, pass, note) values ('an active admin exists to act as', admin_id is not null, coalesce(left(admin_id::text, 8), 'none'));
  if admin_id is null then
    return;
  end if;
  staff_jwt := json_build_object('sub', admin_id, 'role', 'authenticated')::text;

  -- ---- structure ------------------------------------------------------------
  select count(*) into n from pg_catalog.pg_class c
    where c.oid = 'public.blog_revisions'::regclass and c.relrowsecurity and c.relforcerowsecurity;
  insert into blog_revisions_test_results (test, pass) values ('row-level security is enabled and forced', n = 1);

  insert into blog_revisions_test_results (test, pass) values (
    'anon holds no privilege on the table',
    not has_table_privilege('anon', 'public.blog_revisions', 'select')
    and not has_any_column_privilege('anon', 'public.blog_revisions', 'select')
    and not has_table_privilege('anon', 'public.blog_revisions', 'insert')
    and not has_any_column_privilege('anon', 'public.blog_revisions', 'insert')
    and not has_table_privilege('anon', 'public.blog_revisions', 'update')
    and not has_any_column_privilege('anon', 'public.blog_revisions', 'update')
    and not has_table_privilege('anon', 'public.blog_revisions', 'delete')
  );
  insert into blog_revisions_test_results (test, pass) values (
    'authenticated may select and nothing else',
    has_table_privilege('authenticated', 'public.blog_revisions', 'select')
    and not has_table_privilege('authenticated', 'public.blog_revisions', 'insert')
    and not has_any_column_privilege('authenticated', 'public.blog_revisions', 'insert')
    and not has_table_privilege('authenticated', 'public.blog_revisions', 'update')
    and not has_any_column_privilege('authenticated', 'public.blog_revisions', 'update')
    and not has_table_privilege('authenticated', 'public.blog_revisions', 'delete')
    and not has_table_privilege('authenticated', 'public.blog_revisions', 'truncate')
  );
  insert into blog_revisions_test_results (test, pass) values (
    'the API roles cannot call the trigger function',
    not has_function_privilege('anon', 'public.blog_posts_keep_revision()', 'execute')
    and not has_function_privilege('authenticated', 'public.blog_posts_keep_revision()', 'execute')
  );

  select count(*) into n from public.blog_posts p where not exists (select 1 from public.blog_revisions r where r.post_id = p.id);
  insert into blog_revisions_test_results (test, pass, note) values ('every post that existed before has a revision', n = 0, n || ' without');

  -- ---- a new post: revision 1 ---------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    insert into public.blog_posts (slug, title, excerpt, body)
    values ('zz-0020-test-draft', 'A post written by the 0020 test', 'First excerpt.', 'First body.')
    returning id into p_id;
    outcome := 'made';
  exception when others then
    outcome := 'refused ' || sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into blog_revisions_test_results (test, pass, note) values ('a publisher can create a draft', outcome = 'made', outcome);
  if outcome <> 'made' then
    return;
  end if;

  select count(*) into n from public.blog_revisions r where r.post_id = p_id;
  select r.* into rev from public.blog_revisions r where r.post_id = p_id and r.revision = 1;
  insert into blog_revisions_test_results (test, pass, note) values (
    'a new post writes revision 1, with its words, who saved them and where it stood',
    n = 1 and rev.title = 'A post written by the 0020 test' and rev.excerpt = 'First excerpt.' and rev.body = 'First body.'
      and rev.saved_by = admin_id and rev.status = 'draft' and rev.changed = '{}' and not rev.at_publication,
    n || ' row(s)');

  -- ---- a change to the words: a new revision holding the NEW values -----------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  update public.blog_posts set body = 'Second body.' where id = p_id;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into n from public.blog_revisions r where r.post_id = p_id;
  select r.* into rev from public.blog_revisions r where r.post_id = p_id and r.revision = 2;
  insert into blog_revisions_test_results (test, pass, note) values (
    'a change to the body writes revision 2 with the new body, and says "body" changed',
    n = 2 and rev.body = 'Second body.' and rev.title = 'A post written by the 0020 test' and rev.changed = array['body'],
    n || ' row(s), changed: ' || coalesce(array_to_string(rev.changed, ','), 'none'));

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  update public.blog_posts set title = 'A post retitled by the 0020 test', excerpt = 'Second excerpt.', seo_title = 'SEO title', seo_description = 'Meta description.' where id = p_id;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into n from public.blog_revisions r where r.post_id = p_id;
  select r.* into rev from public.blog_revisions r where r.post_id = p_id and r.revision = 3;
  insert into blog_revisions_test_results (test, pass, note) values (
    'a change to title, excerpt and the SEO fields writes one revision naming all four',
    n = 3 and rev.title = 'A post retitled by the 0020 test' and rev.excerpt = 'Second excerpt.' and rev.seo_title = 'SEO title'
      and rev.seo_description = 'Meta description.' and rev.body = 'Second body.'
      and rev.changed = array['title', 'excerpt', 'seo_title', 'seo_description'],
    n || ' row(s), changed: ' || coalesce(array_to_string(rev.changed, ','), 'none'));

  -- ---- changes that are not to the words: no revision -------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  update public.blog_posts set status = 'review' where id = p_id;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into n from public.blog_revisions r where r.post_id = p_id;
  insert into blog_revisions_test_results (test, pass, note) values ('a status-only change (draft to review) writes no revision', n = 3, n || ' row(s)');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  update public.blog_posts set category = 'education', tags = array['test'], byline = 'GIO4X Test Desk', noindex = true where id = p_id;
  update public.blog_posts set body = 'Second body.' where id = p_id; -- the same words again
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into n from public.blog_revisions r where r.post_id = p_id;
  insert into blog_revisions_test_results (test, pass, note) values ('a change to category, tags, byline or noindex, or a save of the same words, writes no revision', n = 3, n || ' row(s)');

  -- ---- publication: the current revision is marked, no row is added -----------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  update public.blog_posts set status = 'published', published_at = now() + interval '3 days' where id = p_id;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into n from public.blog_revisions r where r.post_id = p_id;
  select count(*) into seen from public.blog_revisions r where r.post_id = p_id and r.at_publication;
  select r.* into rev from public.blog_revisions r where r.post_id = p_id and r.revision = 3;
  insert into blog_revisions_test_results (test, pass, note) values (
    'publishing (here: scheduling) as it stands adds no row and marks the current revision as kept',
    n = 3 and seen = 1 and rev.at_publication,
    n || ' row(s), ' || seen || ' marked');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  update public.blog_posts set published_at = now() + interval '5 days' where id = p_id;  -- moved on the calendar
  update public.blog_posts set status = 'draft', published_at = null where id = p_id;     -- unscheduled
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into n from public.blog_revisions r where r.post_id = p_id;
  insert into blog_revisions_test_results (test, pass, note) values ('moving a scheduled post and unscheduling it write no revision', n = 3, n || ' row(s)');

  -- ---- the cap: the latest 50, and the kept revision beyond them ----------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  for i in 1..60 loop
    update public.blog_posts set body = 'Body number ' || i || '.' where id = p_id;
  end loop;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  -- revisions 1..3 existed, 60 more were written: 4..63. The latest 50 are 14..63; of the older ones only 3 (kept) remains.
  select count(*) into n from public.blog_revisions r where r.post_id = p_id and r.revision between 14 and 63;
  select count(*) into seen from public.blog_revisions r where r.post_id = p_id;
  insert into blog_revisions_test_results (test, pass, note) values ('after 63 revisions the latest 50 are there', n = 50, n || ' of 50');
  select count(*) into n from public.blog_revisions r where r.post_id = p_id and r.revision < 14 and not r.at_publication;
  insert into blog_revisions_test_results (test, pass, note) values ('older revisions were deleted by the trigger', n = 0 and seen = 51, n || ' old unkept row(s), ' || seen || ' in all');
  select count(*) into n from public.blog_revisions r where r.post_id = p_id and r.revision = 3 and r.at_publication and r.body = 'Second body.';
  insert into blog_revisions_test_results (test, pass, note) values ('the revision that was current at the publication is kept beyond the cap', n = 1, n || ' row');
  select r.body into stored from public.blog_revisions r where r.post_id = p_id and r.revision = 63;
  insert into blog_revisions_test_results (test, pass, note) values ('the newest revision holds the newest words', stored = 'Body number 60.', coalesce(stored, 'none'));

  -- ---- publication together with a change of words: the new revision is the kept one ---
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  update public.blog_posts set status = 'published', published_at = now() - interval '1 minute', body = 'The body as published.' where id = p_id;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select r.* into rev from public.blog_revisions r where r.post_id = p_id and r.revision = 64;
  insert into blog_revisions_test_results (test, pass, note) values (
    'a save that publishes and changes the words writes one revision, marked as kept, with status published',
    rev.body = 'The body as published.' and rev.at_publication and rev.status = 'published' and rev.changed = array['body'],
    coalesce(rev.status, 'no row'));

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  update public.blog_posts set body = 'The body, corrected while published.' where id = p_id;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select r.* into rev from public.blog_revisions r where r.post_id = p_id and r.revision = 65;
  insert into blog_revisions_test_results (test, pass, note) values (
    'an edit while published is a revision like any other (not a publication, so not marked)',
    rev.body = 'The body, corrected while published.' and not rev.at_publication and rev.status = 'published',
    coalesce(rev.status, 'no row'));

  -- ---- a post created already published -----------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    insert into public.blog_posts (slug, title, body, status, published_at)
    values ('zz-0020-test-published', 'A post published at once by the 0020 test', 'Published body.', 'published', now())
    returning id into q_id;
    outcome := 'made';
  exception when others then
    outcome := 'refused ' || sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into n from public.blog_revisions r where r.post_id = q_id and r.revision = 1 and r.at_publication and r.status = 'published';
  insert into blog_revisions_test_results (test, pass, note) values ('a post created published has revision 1 marked as kept', outcome = 'made' and n = 1, outcome || ', ' || n || ' row');

  -- ---- who can read ---------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  select count(*) into n from public.blog_revisions r where r.post_id = p_id;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  -- revision 3 (kept) and the latest 50, which are 16..65
  insert into blog_revisions_test_results (test, pass, note) values ('staff holding blog.read can read the revisions', n = 51, n || ' of 51 row(s)');

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', anon_jwt, true);
  begin
    select count(*) into n from public.blog_revisions r where r.post_id in (p_id, q_id);
    outcome := 'allowed:' || n;
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into blog_revisions_test_results (test, pass, note) values ('anon cannot read revisions (not even of a published post)', outcome = 'refused', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', other_jwt, true);
  begin
    select count(*) into n from public.blog_revisions r;
    outcome := 'sees:' || n;
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into blog_revisions_test_results (test, pass, note) values ('a signed-in non-member sees no revision at all', outcome in ('sees:0', 'refused'), outcome);

  -- staff without blog.read: the capability is taken from the admin role inside this transaction only
  delete from public.role_capabilities where role = 'admin' and capability = 'blog.read';
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  select count(*) into n from public.blog_revisions r;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into public.role_capabilities (role, capability) values ('admin', 'blog.read') on conflict do nothing;
  insert into blog_revisions_test_results (test, pass, note) values ('staff without blog.read see no revision', n = 0, n || ' seen');

  -- ---- nobody writes through the API ---------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    insert into public.blog_revisions (post_id, revision, title, excerpt, body, seo_title, seo_description, status)
    values (p_id, 999, 'Forged', '', 'Forged body.', '', '', 'draft');
    outcome := 'allowed';
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into blog_revisions_test_results (test, pass, note) values ('an admin cannot insert a revision through the API', outcome = 'refused', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    update public.blog_revisions set body = 'Rewritten history.' where post_id = p_id;
    get diagnostics n = row_count;
    outcome := 'allowed:' || n;
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into blog_revisions_test_results (test, pass, note) values ('an admin cannot change a revision through the API', outcome = 'refused', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    delete from public.blog_revisions where post_id = p_id;
    get diagnostics n = row_count;
    outcome := 'allowed:' || n;
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into blog_revisions_test_results (test, pass, note) values ('an admin cannot delete a revision through the API', outcome = 'refused', outcome);

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', anon_jwt, true);
  begin
    insert into public.blog_revisions (post_id, revision, title, excerpt, body, seo_title, seo_description, status)
    values (q_id, 998, 'Forged', '', 'Forged body.', '', '', 'draft');
    outcome := 'allowed';
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into blog_revisions_test_results (test, pass, note) values ('anon cannot insert a revision', outcome = 'refused', outcome);

  -- ---- a failing revision insert cannot block saving a post ---------------------------
  -- A constraint that refuses one particular body, for the length of this check. NOT VALID: the rows already there are not examined.
  alter table public.blog_revisions add constraint zz_0020_test_block check (body <> 'A body the revisions table refuses.') not valid;

  select count(*) into seen from public.blog_revisions r where r.post_id = p_id;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    update public.blog_posts set body = 'A body the revisions table refuses.' where id = p_id;
    get diagnostics n = row_count;
    outcome := 'saved:' || n;
  exception when others then
    outcome := 'blocked ' || sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select p.body into stored from public.blog_posts p where p.id = p_id;
  select count(*) into n from public.blog_revisions r where r.post_id = p_id;
  insert into blog_revisions_test_results (test, pass, note) values (
    'when the revision cannot be written, the post is saved all the same',
    outcome = 'saved:1' and stored = 'A body the revisions table refuses.',
    outcome);
  insert into blog_revisions_test_results (test, pass, note) values ('and the failed revision left nothing behind', n = seen, n || ' row(s), ' || seen || ' before');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    insert into public.blog_posts (slug, title, body) values ('zz-0020-test-blocked', 'A new post while revisions fail', 'A body the revisions table refuses.');
    outcome := 'saved';
  exception when others then
    outcome := 'blocked ' || sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into blog_revisions_test_results (test, pass, note) values ('a new post is created even when its first revision cannot be written', outcome = 'saved', outcome);

  alter table public.blog_revisions drop constraint zz_0020_test_block;

  -- and once the table accepts rows again, the next save records a revision as usual
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  update public.blog_posts set body = 'A body written after the failure.' where id = p_id;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into n from public.blog_revisions r where r.post_id = p_id and r.body = 'A body written after the failure.' and r.revision = 66;
  insert into blog_revisions_test_results (test, pass, note) values ('after a failure the next revision takes the next number', n = 1, n || ' row');

  -- ---- the 0011 rules still hold ---------------------------------------------------------
  select count(*) into n from public.audit_log l where l.entity = 'blog_post' and l.entity_id = p_id::text and l.action = 'blog.create';
  select count(*) into seen from public.audit_log l where l.entity = 'blog_post' and l.entity_id = p_id::text and l.action = 'blog.publish';
  insert into blog_revisions_test_results (test, pass, note) values ('the audit trigger of 0011 still records creation and both publications', n = 1 and seen = 2, n || ' create, ' || seen || ' publish');
end
$test$;

select n, test, case when pass then 'PASS' else 'FAIL' end as result, note from blog_revisions_test_results order by n;

rollback;

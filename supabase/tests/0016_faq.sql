-- =============================================================================
-- GIO4X · tests for 0016_faq · run after applying supabase/migrations/0016_faq.sql
-- =============================================================================
-- Run as the role that applies migrations (on Supabase: postgres). Everything
-- happens inside one transaction that is rolled back: no row, capability or
-- audit entry made here survives.
--
-- How it works: the script becomes the API roles the way PostgREST does
-- (`role` and `request.jwt.claims`, both transaction-local), tries something,
-- returns to the role it started as, and writes one row per check into a
-- temporary table. The last statement before the rollback lists the results:
-- every row should say PASS.
--
-- Identities used:
--   publisher   an existing active admin from public.staff
--   writer      the same person while the admin role is, inside this
--               transaction only, without content.publish (the rollback puts
--               it back). The real mapping (agent: write, not publish) is
--               checked separately from the role_capabilities rows.
--   outsider    a signed-in user with no staff row (an id that does not exist)
--   visitor     the anon role
-- =============================================================================

begin;

create temp table faq_test_results (
  n    serial primary key,
  test text not null,
  pass boolean not null,
  note text not null default ''
) on commit drop;

do $test$
declare
  me        text := current_user;
  admin_id  uuid;
  staff_jwt text;
  other_jwt text := json_build_object('sub', '00000000-0000-4000-8000-000000000016', 'role', 'authenticated')::text;
  anon_jwt  text := json_build_object('role', 'anon')::text;
  d_id uuid;  -- a draft addition
  p_id uuid;  -- a published addition
  h_id uuid;  -- a hidden question from the code
  r_id uuid;  -- a published replacement
  w_id uuid;  -- the writer's draft
  n integer;
  seen integer;
  outcome text;
  who uuid;
  q constant text := 'Is this a question written by the 0016 test?';
  a constant text := 'It is. The transaction that wrote it is rolled back.';
begin
  select s.user_id into admin_id from public.staff s where s.role = 'admin' and s.active order by s.created_at limit 1;
  insert into faq_test_results (test, pass, note) values ('an active admin exists to act as', admin_id is not null, coalesce(left(admin_id::text, 8), 'none'));
  if admin_id is null then
    return;
  end if;
  staff_jwt := json_build_object('sub', admin_id, 'role', 'authenticated')::text;

  -- ---- structure ------------------------------------------------------------
  select count(*) into n from pg_catalog.pg_class c
    where c.oid = 'public.faq_entries'::regclass and c.relrowsecurity and c.relforcerowsecurity;
  insert into faq_test_results (test, pass) values ('row-level security is enabled and forced', n = 1);

  insert into faq_test_results (test, pass) values (
    'anon may read exactly the public columns',
    has_column_privilege('anon', 'public.faq_entries', 'id', 'select')
    and has_column_privilege('anon', 'public.faq_entries', 'base_id', 'select')
    and has_column_privilege('anon', 'public.faq_entries', 'category', 'select')
    and has_column_privilege('anon', 'public.faq_entries', 'question', 'select')
    and has_column_privilege('anon', 'public.faq_entries', 'answer', 'select')
    and has_column_privilege('anon', 'public.faq_entries', 'position', 'select')
    and has_column_privilege('anon', 'public.faq_entries', 'status', 'select')
    and not has_column_privilege('anon', 'public.faq_entries', 'created_by', 'select')
    and not has_column_privilege('anon', 'public.faq_entries', 'updated_by', 'select')
    and not has_column_privilege('anon', 'public.faq_entries', 'created_at', 'select')
    and not has_column_privilege('anon', 'public.faq_entries', 'updated_at', 'select')
  );
  insert into faq_test_results (test, pass) values (
    'anon may not insert, update or delete; staff may not delete',
    not has_table_privilege('anon', 'public.faq_entries', 'insert')
    and not has_any_column_privilege('anon', 'public.faq_entries', 'insert')
    and not has_any_column_privilege('anon', 'public.faq_entries', 'update')
    and not has_table_privilege('anon', 'public.faq_entries', 'delete')
    and not has_table_privilege('authenticated', 'public.faq_entries', 'delete')
    and not has_column_privilege('authenticated', 'public.faq_entries', 'base_id', 'update')
    and not has_column_privilege('authenticated', 'public.faq_entries', 'updated_by', 'update')
  );

  select count(*) into n from public.role_capabilities rc
    where (rc.role, rc.capability) in (
      ('admin', 'content.read'), ('compliance', 'content.read'), ('agent', 'content.read'), ('sales', 'content.read'), ('support', 'content.read'),
      ('admin', 'content.write'), ('agent', 'content.write'), ('admin', 'content.publish'));
  select count(*) into seen from public.role_capabilities rc where rc.capability like 'content.%';
  insert into faq_test_results (test, pass, note) values ('the capabilities are held by the intended roles and no others', n = 8 and seen = 8, n || ' of 8 expected, ' || seen || ' in all');

  -- ---- the publisher makes one of each ----------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    insert into public.faq_entries (category, question, answer) values ('accounts', q, a) returning id into d_id;
    insert into public.faq_entries (category, question, answer, position, status) values ('accounts', q, a, 15, 'published') returning id into p_id;
    insert into public.faq_entries (base_id, category, question, answer, status) values ('zz-0016-test-hidden', 'orders', q, a, 'hidden') returning id into h_id;
    insert into public.faq_entries (base_id, category, question, answer, status) values ('zz-0016-test-replaced', 'orders', q, a, 'published') returning id into r_id;
    outcome := 'made';
  exception when others then
    outcome := 'refused ' || sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('a publisher can create a draft, a published question, a hidden one and a replacement', outcome = 'made', outcome);
  if outcome <> 'made' then
    return;
  end if;

  select count(*) into n from public.faq_entries f where f.id in (d_id, p_id, h_id, r_id) and f.created_by = admin_id and f.updated_by = admin_id;
  insert into faq_test_results (test, pass, note) values ('the trigger records who created and last changed each row', n = 4, n || ' of 4');

  select count(*) into n from public.audit_log l where l.entity = 'faq_entry' and l.actor = admin_id and (
       (l.entity_id = d_id::text and l.action = 'faq.create')
    or (l.entity_id = p_id::text and l.action = 'faq.publish')
    or (l.entity_id = h_id::text and l.action = 'faq.hide')
    or (l.entity_id = r_id::text and l.action = 'faq.publish'));
  insert into faq_test_results (test, pass, note) values ('audit rows written: create, publish, hide, publish', n = 4, n || ' of 4');

  -- ---- the visitor ------------------------------------------------------------
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', anon_jwt, true);
  select count(*) into n from public.faq_entries f where f.id in (p_id, h_id, r_id);
  select count(*) into seen from public.faq_entries f where f.id = d_id;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('anon sees the published and the hidden rows', n = 3, n || ' of 3');
  insert into faq_test_results (test, pass, note) values ('a draft is invisible to anon', seen = 0, seen || ' seen');

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', anon_jwt, true);
  begin
    select f.updated_by into who from public.faq_entries f where f.id = p_id;
    outcome := 'allowed';
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('anon cannot read who edited a row', outcome = 'refused', outcome);

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', anon_jwt, true);
  begin
    insert into public.faq_entries (category, question, answer) values ('accounts', q, a);
    outcome := 'allowed';
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('anon cannot insert', outcome = 'refused', outcome);

  -- ---- a signed-in user who is not staff ---------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', other_jwt, true);
  select count(*) into n from public.faq_entries f where f.id in (d_id, p_id, h_id, r_id);
  begin
    insert into public.faq_entries (category, question, answer) values ('accounts', q, a);
    outcome := 'allowed';
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('a signed-in non-member sees only what the public sees', n = 3, n || ' of 4 rows');
  insert into faq_test_results (test, pass, note) values ('a signed-in non-member cannot insert', outcome = 'refused', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', other_jwt, true);
  begin
    update public.faq_entries set answer = a || ' Changed by a stranger.' where id = p_id;
    get diagnostics n = row_count;
    outcome := 'allowed:' || n;
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('a signed-in non-member cannot change a row', outcome in ('refused', 'allowed:0'), outcome);

  -- ---- the writer: content.write without content.publish ------------------------
  delete from public.role_capabilities where role = 'admin' and capability = 'content.publish';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    insert into public.faq_entries (category, question, answer) values ('funding', q, a) returning id into w_id;
    update public.faq_entries set answer = a || ' Edited as a draft.' where id = w_id;
    get diagnostics n = row_count;
    outcome := 'allowed:' || n;
  exception when others then
    outcome := 'refused ' || sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('a writer can create a draft and edit it', outcome = 'allowed:1', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    update public.faq_entries set status = 'published' where id = w_id;
    outcome := 'allowed';
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('a writer cannot publish a draft', outcome = 'refused', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    insert into public.faq_entries (category, question, answer, status) values ('funding', q, a, 'published');
    outcome := 'allowed';
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('a writer cannot create a published row', outcome = 'refused', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    insert into public.faq_entries (base_id, category, question, answer, status) values ('zz-0016-test-writer-hide', 'funding', q, a, 'hidden');
    outcome := 'allowed';
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('a writer cannot hide a question', outcome = 'refused', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    update public.faq_entries set answer = a || ' Changed by a writer.' where id = p_id;
    outcome := 'allowed';
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('a writer cannot edit a published row', outcome = 'refused', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    update public.faq_entries set status = 'draft' where id = h_id;
    outcome := 'allowed';
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('a writer cannot bring a hidden question back', outcome = 'refused', outcome);

  insert into public.role_capabilities (role, capability) values ('admin', 'content.publish') on conflict do nothing;

  -- ---- the publisher again ------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    update public.faq_entries set status = 'published' where id = w_id;
    get diagnostics n = row_count;
    outcome := 'allowed:' || n;
  exception when others then
    outcome := 'refused ' || sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into seen from public.audit_log l where l.entity = 'faq_entry' and l.entity_id = w_id::text and l.action = 'faq.publish' and l.actor = admin_id;
  insert into faq_test_results (test, pass, note) values ('a publisher can publish the writer''s draft, and it is audited', outcome = 'allowed:1' and seen = 1, outcome || ', audit rows: ' || seen);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    update public.faq_entries set answer = a || ' Corrected after publication.' where id = p_id;
    get diagnostics n = row_count;
    outcome := 'allowed:' || n;
  exception when others then
    outcome := 'refused ' || sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into seen from public.audit_log l where l.entity = 'faq_entry' and l.entity_id = p_id::text and l.action = 'faq.edit_published';
  insert into faq_test_results (test, pass, note) values ('a publisher can edit a published row, and it is audited', outcome = 'allowed:1' and seen = 1, outcome || ', audit rows: ' || seen);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    update public.faq_entries set status = 'draft' where id = h_id;
    get diagnostics n = row_count;
    outcome := 'allowed:' || n;
  exception when others then
    outcome := 'refused ' || sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into seen from public.audit_log l where l.entity = 'faq_entry' and l.entity_id = h_id::text and l.action = 'faq.unpublish';
  insert into faq_test_results (test, pass, note) values ('a publisher can restore a hidden question (row back to draft), and it is audited', outcome = 'allowed:1' and seen = 1, outcome || ', audit rows: ' || seen);

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', anon_jwt, true);
  select count(*) into n from public.faq_entries f where f.id = h_id;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('once restored, the row is invisible to anon', n = 0, n || ' seen');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  update public.faq_entries set answer = a || ' More drafting.' where id = d_id;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into n from public.audit_log l where l.entity = 'faq_entry' and l.entity_id = d_id::text;
  insert into faq_test_results (test, pass, note) values ('ordinary drafting is not audited', n = 1, n || ' audit row(s) for the draft');

  -- ---- what the table refuses whoever asks ---------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    insert into public.faq_entries (base_id, category, question, answer) values ('zz-0016-test-replaced', 'orders', q, a);
    outcome := 'allowed';
  exception when unique_violation then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('a question in the code cannot have two rows', outcome = 'refused', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    insert into public.faq_entries (category, question, answer) values ('not-a-category', q, a);
    outcome := 'allowed';
  exception when check_violation then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('an unknown category is refused', outcome = 'refused', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    insert into public.faq_entries (category, question, answer) values ('accounts', 'Too short', a);
    outcome := 'allowed';
  exception when check_violation then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('a question under 10 characters is refused', outcome = 'refused', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    insert into public.faq_entries (category, question, answer) values ('accounts', q, repeat('x', 4001));
    outcome := 'allowed';
  exception when check_violation then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('an answer over 4000 characters is refused', outcome = 'refused', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    update public.faq_entries set status = 'hidden' where id = p_id;
    outcome := 'allowed';
  exception when check_violation then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('a new question cannot be "hidden" (only a question from the code can)', outcome = 'refused', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    delete from public.faq_entries where id = d_id;
    outcome := 'allowed';
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('nobody can delete a row through the API', outcome = 'refused', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    update public.faq_entries set base_id = 'zz-0016-test-moved' where id = r_id;
    outcome := 'allowed';
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into faq_test_results (test, pass, note) values ('what a row replaces cannot be changed after it is made', outcome = 'refused', outcome);
end
$test$;

select n, test, case when pass then 'PASS' else 'FAIL' end as result, note from faq_test_results order by n;

rollback;

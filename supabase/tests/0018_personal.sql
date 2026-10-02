-- =============================================================================
-- GIO4X · tests for 0018_personal · saved views and the notifications centre
-- -----------------------------------------------------------------------------
-- Run as the migration role (on Supabase: postgres) AFTER applying
-- supabase/migrations/0018_personal.sql. Everything happens inside one
-- transaction that is rolled back: no view, notification, ticket, enquiry,
-- post, member of staff or audit entry made here survives. The SELECT before
-- the rollback is the result: every row should say "pass" (a "skip" explains
-- itself in its note).
--
-- How it acts as other people: pg_temp.run_as() switches the database role
-- with set_config('role', …, true) (anon / authenticated) and supplies the
-- identity that auth.uid() and auth.role() read with
-- set_config('request.jwt.claims', …, true), runs ONE statement, and switches
-- back. It returns the statement's single text value, or the SQLSTATE of the
-- refusal. Every check and every result row is written as the migration role.
--
-- Identities
--   A         an existing active admin from public.staff
--   B         a temporary member of staff with the role `support` (a sign-in
--             row in auth.users and a row in public.staff, both rolled back)
--   C         a temporary second admin, so that a staff change has somebody
--             who could approve it, and a blog post somebody else to send it
--   outsider  a signed-in user with no staff row (an id that does not exist)
--   visitor   the anon role
-- If the temporary people cannot be created here, the checks that need them
-- are reported as skipped and the rest still run.
--
-- While it runs (a second or two) the script holds locks that the rollback
-- releases: on the rows it touches, and, for the "a broken notification cannot
-- block the action" check, a brief exclusive lock on staff_notifications (it
-- adds a constraint that refuses every row, and removes it again).
-- =============================================================================

begin;

create temp table t_results (n serial primary key, test text not null, pass boolean, note text not null default '') on commit drop;

create function pg_temp.t(p_test text, p_pass boolean, p_note text default '') returns void
language sql as $f$ insert into t_results (test, pass, note) values (p_test, coalesce(p_pass, false), coalesce(p_note, '')); $f$;

create function pg_temp.skip(p_test text, p_note text) returns void
language sql as $f$ insert into t_results (test, pass, note) values (p_test, null, p_note); $f$;

-- One statement as the anonymous visitor (p_uid null) or as a signed-in user.
-- The statement must return one value (use RETURNING inside a CTE and select
-- from it). A refusal comes back as its SQLSTATE; the role and the claims set
-- inside the block are undone with it.
create function pg_temp.run_as(p_uid uuid, p_sql text) returns text
language plpgsql as $f$
declare
  got text;
begin
  begin
    if p_uid is null then
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('request.jwt.claim.role', 'anon', true);
      perform set_config('request.jwt.claim.sub', '', true);
      perform set_config('role', 'anon', true);
    else
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.role', 'authenticated', true);
      perform set_config('request.jwt.claim.sub', p_uid::text, true);
      perform set_config('role', 'authenticated', true);
    end if;
    execute p_sql into got;
    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.role', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
  exception when others then
    return sqlstate;
  end;
  return coalesce(got, 'null');
end $f$;

-- how many notifications a person has of one kind about one thing (read or not), and how many of those are unread
create function pg_temp.lines(p_who uuid, p_kind text, p_entity_id uuid) returns integer
language sql as $f$ select count(*)::integer from public.staff_notifications n where n.recipient = p_who and n.kind = p_kind and n.entity_id = p_entity_id::text; $f$;

create function pg_temp.unread(p_who uuid, p_kind text, p_entity_id uuid) returns integer
language sql as $f$ select count(*)::integer from public.staff_notifications n where n.recipient = p_who and n.kind = p_kind and n.entity_id = p_entity_id::text and n.read_at is null; $f$;

-- everything a person has been told about one thing, whatever the kind
create function pg_temp.about(p_who uuid, p_entity_id uuid) returns integer
language sql as $f$ select count(*)::integer from public.staff_notifications n where n.recipient = p_who and n.entity_id = p_entity_id::text; $f$;

create temp table t_ctx (
  a uuid, b uuid, c uuid, outsider uuid, has_temp boolean,
  l1 uuid, l2 uuid, k1 uuid, k2 uuid, k3 uuid, k4 uuid, k5 uuid, k6 uuid,
  email text
) on commit drop;

-- ---------------------------------------------------------------------------
-- Set-up
-- ---------------------------------------------------------------------------
do $$
declare
  a        uuid;
  b        uuid := gen_random_uuid();
  c        uuid := gen_random_uuid();
  has_temp boolean := true;
  mail     constant text := 'test-personal-0018@example.invalid';
  l1 uuid := gen_random_uuid();
  l2 uuid := gen_random_uuid();
  k1 uuid := gen_random_uuid();
  k2 uuid := gen_random_uuid();
  k3 uuid := gen_random_uuid();
  k4 uuid := gen_random_uuid();
  k5 uuid := gen_random_uuid();
  k6 uuid := gen_random_uuid();
begin
  select s.user_id into a from public.staff s where s.active and s.role = 'admin' order by s.created_at limit 1;
  if a is null then
    raise exception '0018 tests need one active admin in public.staff. None found.';
  end if;

  begin
    insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
    values (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-personal-0018-b@example.invalid', now(), now()),
           (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-personal-0018-c@example.invalid', now(), now());
    insert into public.staff (user_id, role, display_name)
    values (b, 'support', 'Test Support (0018, rolled back)'),
           (c, 'admin', 'Test Admin (0018, rolled back)');
  exception when others then
    has_temp := false;
  end;

  -- rows a visitor would have created (no API role is set, so the throttles and clocks of the public path do not apply)
  insert into public.leads (id, reference, name, email, topic, message, privacy_accepted_at, privacy_version)
  values (l1, 'GX-ZZZZ3333', 'Test Visitor', mail, 'General', '[TEST] 0018', now(), 'test'),
         (l2, 'GX-ZZZZ4444', 'Test Visitor', mail, 'General', '[TEST] 0018', now(), 'test');

  insert into public.tickets (id, reference, name, email, category, subject, message, privacy_accepted_at, privacy_version)
  values (k1, 'TK-ZZZZ3333', 'Test Visitor', mail, 'other', '[TEST] 0018', '[TEST] 0018', now(), 'test'),
         (k2, 'TK-ZZZZ4444', 'Test Visitor', mail, 'other', '[TEST] 0018', '[TEST] 0018', now(), 'test'),
         (k3, 'TK-ZZZZ5555', 'Test Visitor', mail, 'other', '[TEST] 0018', '[TEST] 0018', now(), 'test'),
         (k4, 'TK-ZZZZ6666', 'Test Visitor', mail, 'other', '[TEST] 0018', '[TEST] 0018', now(), 'test'),
         (k5, 'TK-ZZZZ7777', 'Test Visitor', mail, 'other', '[TEST] 0018', '[TEST] 0018', now(), 'test'),
         (k6, 'TK-ZZZZ2223', 'Test Visitor', mail, 'other', '[TEST] 0018', '[TEST] 0018', now(), 'test');

  insert into t_ctx values (a, b, c, gen_random_uuid(), has_temp, l1, l2, k1, k2, k3, k4, k5, k6, mail);

  if has_temp then
    perform pg_temp.t('set-up: a temporary support member (B) and a temporary second admin (C) were created', true);
  else
    perform pg_temp.skip('set-up: a temporary support member (B) and a temporary second admin (C) were created',
      'auth.users could not be written here: every check that needs a second person is skipped');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Structure and privileges
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  select count(*) into n from pg_catalog.pg_class c
  where c.oid in ('public.staff_views'::regclass, 'public.staff_notifications'::regclass) and c.relrowsecurity and c.relforcerowsecurity;
  perform pg_temp.t('structure: row-level security is enabled and forced on both tables', n = 2, n || ' of 2');

  perform pg_temp.t('structure: anon holds nothing on either table',
    not has_table_privilege('anon', 'public.staff_views', 'select')
    and not has_any_column_privilege('anon', 'public.staff_views', 'insert')
    and not has_any_column_privilege('anon', 'public.staff_views', 'update')
    and not has_table_privilege('anon', 'public.staff_views', 'delete')
    and not has_table_privilege('anon', 'public.staff_notifications', 'select')
    and not has_any_column_privilege('anon', 'public.staff_notifications', 'insert')
    and not has_any_column_privilege('anon', 'public.staff_notifications', 'update')
    and not has_table_privilege('anon', 'public.staff_notifications', 'delete'));

  perform pg_temp.t('structure: a signed-in user may read notifications and nothing else',
    has_table_privilege('authenticated', 'public.staff_notifications', 'select')
    and not has_any_column_privilege('authenticated', 'public.staff_notifications', 'insert')
    and not has_any_column_privilege('authenticated', 'public.staff_notifications', 'update')
    and not has_table_privilege('authenticated', 'public.staff_notifications', 'delete')
    and not has_table_privilege('authenticated', 'public.staff_notifications', 'truncate'));

  perform pg_temp.t('structure: on a view, the owner, the screen and the filters are not writable columns',
    not has_column_privilege('authenticated', 'public.staff_views', 'owner', 'insert')
    and not has_column_privilege('authenticated', 'public.staff_views', 'owner', 'update')
    and not has_column_privilege('authenticated', 'public.staff_views', 'screen', 'update')
    and not has_column_privilege('authenticated', 'public.staff_views', 'params', 'update')
    and has_column_privilege('authenticated', 'public.staff_views', 'name', 'update')
    and has_column_privilege('authenticated', 'public.staff_views', 'pinned', 'update'));

  perform pg_temp.t('structure: the internal functions are not callable through the API',
    not has_function_privilege('authenticated', 'public.notify_staff(uuid, text, text, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.notify_staff(uuid, text, text, text, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.notifications_prune()', 'execute')
    and not has_function_privilege('anon', 'public.notifications_prune()', 'execute')
    and not has_function_privilege('anon', 'public.notifications_mark_read(bigint[])', 'execute')
    and has_function_privilege('authenticated', 'public.notifications_mark_read(bigint[])', 'execute'));

  select count(*) into n from pg_catalog.pg_trigger g
  where not g.tgisinternal and g.tgname like 'zz\_notify\_%'
    and g.tgrelid in ('public.tickets'::regclass, 'public.ticket_messages'::regclass, 'public.leads'::regclass,
                      'public.lead_tasks'::regclass, 'public.staff_changes'::regclass, 'public.blog_posts'::regclass,
                      'public.chat_conversations'::regclass);
  perform pg_temp.t('structure: the seven notification triggers exist, one on each table', n = 7, n || ' of 7');

  -- AFTER ROW triggers fire in name order: ours must come after every other trigger on the same table
  select count(*) into n
  from pg_catalog.pg_trigger mine
  join pg_catalog.pg_trigger other on other.tgrelid = mine.tgrelid and not other.tgisinternal and other.tgname not like 'zz\_notify\_%'
  where not mine.tgisinternal and mine.tgname like 'zz\_notify\_%' and other.tgname > mine.tgname;
  perform pg_temp.t('structure: every notification trigger sorts after the other triggers on its table', n = 0, n || ' sort later');
end $$;

-- ---------------------------------------------------------------------------
-- 2. Saved views: only your own, validated, at most 30
-- ---------------------------------------------------------------------------
do $$
declare
  x    t_ctx%rowtype;
  res  text;
  v1   uuid;
  v2   uuid;
  held integer;
  i    integer;
  p1   integer;
  p2   integer;
  ok   boolean := true;
begin
  select * into x from t_ctx;

  res := pg_temp.run_as(x.a, $q$ with w as (insert into public.staff_views (screen, name, params) values ('tickets', '[TEST] 0018 mine', '{"who":"mine","status":"open"}') returning id) select id::text from w $q$);
  begin
    v1 := res::uuid;
  exception when others then
    v1 := null;
  end;
  perform pg_temp.t('views: a member of staff saves a view', v1 is not null, res);
  if v1 is null then
    return;
  end if;
  perform pg_temp.t('views: it belongs to the person who saved it', (select v.owner = x.a from public.staff_views v where v.id = v1));

  res := pg_temp.run_as(x.a, format($q$ with w as (insert into public.staff_views (owner, screen, name) values (%L, 'tickets', '[TEST] 0018 for somebody else') returning id) select id::text from w $q$, x.outsider));
  perform pg_temp.t('views: nobody can save a view as somebody else', res = '42501', res);

  res := pg_temp.run_as(x.a, $q$ with w as (insert into public.staff_views (screen, name, params, pinned) values ('leads', '[TEST] 0018 second', '{"topic":"Platform: 777 Raptor","sort":"score"}', true) returning id) select id::text from w $q$);
  begin
    v2 := res::uuid;
  exception when others then
    v2 := null;
  end;
  select v.position into p1 from public.staff_views v where v.id = v1;
  select v.position into p2 from public.staff_views v where v.id = v2;
  perform pg_temp.t('views: a second view (a topic with a space and a colon) is accepted and placed after the first', v2 is not null and p2 > p1, res || ' positions ' || coalesce(p1::text, '?') || ', ' || coalesce(p2::text, '?'));

  -- ---- what a view may hold ---------------------------------------------------
  res := pg_temp.run_as(x.a, $q$ with w as (insert into public.staff_views (screen, name, params) values ('tickets', '[TEST] 0018 search', '{"q":"someone"}') returning id) select id::text from w $q$);
  perform pg_temp.t('views: search text has no place in a view (key q is refused)', res = '23514', res);

  res := pg_temp.run_as(x.a, $q$ with w as (insert into public.staff_views (screen, name, params) values ('tickets', '[TEST] 0018 address', '{"who":"someone@example.invalid"}') returning id) select id::text from w $q$);
  perform pg_temp.t('views: a value that looks like an address is refused', res = '23514', res);

  res := pg_temp.run_as(x.a, $q$ with w as (insert into public.staff_views (screen, name, params) values ('tickets', '[TEST] 0018 number', '{"overdue":1}') returning id) select id::text from w $q$);
  perform pg_temp.t('views: a value that is not text is refused', res = '23514', res);

  res := pg_temp.run_as(x.a, $q$ with w as (insert into public.staff_views (screen, name, params) values ('tickets', '[TEST] 0018 list', '["who","mine"]') returning id) select id::text from w $q$);
  perform pg_temp.t('views: filters that are not an object are refused', res = '23514', res);

  res := pg_temp.run_as(x.a, $q$ with w as (insert into public.staff_views (screen, name, params) values ('tasks', '[TEST] 0018 wrong key', '{"priority":"high"}') returning id) select id::text from w $q$);
  perform pg_temp.t('views: a filter that belongs to another screen is refused', res = '23514', res);

  res := pg_temp.run_as(x.a, $q$ with w as (insert into public.staff_views (screen, name) values ('customers', '[TEST] 0018 screen') returning id) select id::text from w $q$);
  perform pg_temp.t('views: an unknown screen is refused', res = '23514', res);

  res := pg_temp.run_as(x.a, format($q$ with w as (insert into public.staff_views (screen, name) values ('tasks', %L) returning id) select id::text from w $q$, repeat('x', 61)));
  perform pg_temp.t('views: a name over 60 characters is refused', res = '23514', res);

  res := pg_temp.run_as(x.a, $q$ with w as (insert into public.staff_views (screen, name) values ('tasks', 'someone@example.invalid') returning id) select id::text from w $q$);
  perform pg_temp.t('views: a name holding an address is refused', res = '23514', res);

  -- ---- the owner changes their own --------------------------------------------
  res := pg_temp.run_as(x.a, format($q$ with w as (update public.staff_views set name = '[TEST] 0018 renamed', pinned = true where id = %L returning 1) select count(*)::text from w $q$, v1));
  perform pg_temp.t('views: the owner renames and pins their own view',
    res = '1' and (select v.name = '[TEST] 0018 renamed' and v.pinned from public.staff_views v where v.id = v1), res);

  res := pg_temp.run_as(x.a, format($q$ with w as (update public.staff_views set params = '{"who":"unassigned"}' where id = %L returning 1) select count(*)::text from w $q$, v1));
  perform pg_temp.t('views: the filters of a saved view cannot be changed through the API', res = '42501', res);

  res := pg_temp.run_as(x.a, format($q$ with w as (update public.staff_views set owner = %L where id = %L returning 1) select count(*)::text from w $q$, x.outsider, v1));
  perform pg_temp.t('views: a view cannot be given to somebody else', res = '42501', res);

  -- ---- other people ------------------------------------------------------------
  res := pg_temp.run_as(x.outsider, $q$ select count(*)::text from public.staff_views $q$);
  perform pg_temp.t('views: a signed-in person who is not staff sees no view', res = '0', res);
  res := pg_temp.run_as(x.outsider, $q$ with w as (insert into public.staff_views (screen, name) values ('tasks', '[TEST] 0018 outsider') returning id) select id::text from w $q$);
  perform pg_temp.t('views: a signed-in person who is not staff cannot save one', res = '42501', res);
  res := pg_temp.run_as(null, $q$ select count(*)::text from public.staff_views $q$);
  perform pg_temp.t('views: the anonymous role cannot read the table', res = '42501', res);

  if x.has_temp then
    res := pg_temp.run_as(x.b, format($q$ select count(*)::text from public.staff_views where owner = %L $q$, x.a));
    perform pg_temp.t('views: a colleague cannot read another person''s views', res = '0', res);
    res := pg_temp.run_as(x.c, format($q$ select count(*)::text from public.staff_views where owner = %L $q$, x.a));
    perform pg_temp.t('views: not even an admin can read another person''s views', res = '0', res);

    res := pg_temp.run_as(x.b, format($q$ with w as (update public.staff_views set name = '[TEST] 0018 taken over', pinned = false where id = %L returning 1) select count(*)::text from w $q$, v1));
    perform pg_temp.t('views: a colleague cannot change another person''s view',
      res = '0' and (select v.name = '[TEST] 0018 renamed' and v.pinned from public.staff_views v where v.id = v1), res);

    res := pg_temp.run_as(x.c, format($q$ with w as (delete from public.staff_views where id = %L returning 1) select count(*)::text from w $q$, v1));
    perform pg_temp.t('views: a colleague cannot delete another person''s view',
      res = '0' and exists (select 1 from public.staff_views v where v.id = v1), res);
  else
    perform pg_temp.skip('views: a colleague cannot read, change or delete another person''s view', 'needs a second member of staff');
  end if;

  -- ---- the cap -------------------------------------------------------------------
  select count(*) into held from public.staff_views v where v.owner = x.a;
  for i in held + 1 .. 30 loop
    res := pg_temp.run_as(x.a, format($q$ with w as (insert into public.staff_views (screen, name) values ('tasks', %L) returning id) select id::text from w $q$, '[TEST] 0018 cap ' || i));
    ok := ok and res ~ '^[0-9a-f-]{36}$';
  end loop;
  select count(*) into held from public.staff_views v where v.owner = x.a;
  perform pg_temp.t('views: a person can hold 30 views', ok and held = 30, held || ' held');

  res := pg_temp.run_as(x.a, $q$ with w as (insert into public.staff_views (screen, name) values ('tasks', '[TEST] 0018 one too many') returning id) select id::text from w $q$);
  perform pg_temp.t('views: the 31st is refused', res = '54000' and (select count(*) = 30 from public.staff_views v where v.owner = x.a), res);

  if x.has_temp then
    res := pg_temp.run_as(x.b, $q$ with w as (insert into public.staff_views (screen, name) values ('tasks', '[TEST] 0018 colleague') returning id) select id::text from w $q$);
    perform pg_temp.t('views: one person''s full list does not stop a colleague saving', res ~ '^[0-9a-f-]{36}$', res);
  end if;

  res := pg_temp.run_as(x.a, format($q$ with w as (delete from public.staff_views where id = %L returning 1) select count(*)::text from w $q$, v2));
  perform pg_temp.t('views: the owner deletes their own view', res = '1' and not exists (select 1 from public.staff_views v where v.id = v2), res);

  res := pg_temp.run_as(x.a, $q$ with w as (insert into public.staff_views (screen, name) values ('tasks', '[TEST] 0018 room again') returning id) select id::text from w $q$);
  perform pg_temp.t('views: after deleting one there is room for another', res ~ '^[0-9a-f-]{36}$', res);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Notifications: the right line, for the right person, never for the actor
-- ---------------------------------------------------------------------------
do $$
declare
  x      t_ctx%rowtype;
  res    text;
  n      integer;
  ttl    text;
  cid    uuid;
  post1  uuid;
  post2  uuid;
  chat   uuid;
begin
  select * into x from t_ctx;
  if not x.has_temp then
    perform pg_temp.skip('notifications: each trigger tells the right person and never the actor', 'needs a second member of staff');
    return;
  end if;

  -- ---- a ticket assigned to you -------------------------------------------------
  res := pg_temp.run_as(x.a, format($q$ with w as (update public.tickets set assigned_to = %L where id = %L returning 1) select count(*)::text from w $q$, x.b, x.k1));
  select n1.title into ttl from public.staff_notifications n1 where n1.recipient = x.b and n1.kind = 'ticket.assigned' and n1.entity_id = x.k1::text;
  perform pg_temp.t('ticket assigned: the assignee is told, once', res = '1' and pg_temp.unread(x.b, 'ticket.assigned', x.k1) = 1, res);
  perform pg_temp.t('ticket assigned: the person who assigned it is told nothing', pg_temp.about(x.a, x.k1) = 0);
  perform pg_temp.t('ticket assigned: the title carries the reference and nothing about the customer',
    ttl = 'A ticket was assigned to you: TK-ZZZZ3333' and ttl not ilike '%Test Visitor%' and ttl not ilike '%example.invalid%', coalesce(ttl, 'no title'));
  select count(*) into n from public.audit_log l where l.action = 'ticket.assign' and l.entity_id = x.k1::text and l.actor = x.a;
  perform pg_temp.t('ticket assigned: the existing audit entry is still written', n = 1, n || ' audit row(s)');

  res := pg_temp.run_as(x.a, format($q$ with w as (update public.tickets set priority = 'high' where id = %L returning 1) select count(*)::text from w $q$, x.k1));
  perform pg_temp.t('ticket assigned: a change that is not an assignment says nothing more', res = '1' and pg_temp.lines(x.b, 'ticket.assigned', x.k1) = 1, res);

  res := pg_temp.run_as(x.b, format($q$ with w as (update public.tickets set assigned_to = %L where id = %L returning 1) select count(*)::text from w $q$, x.b, x.k2));
  perform pg_temp.t('ticket assigned: taking a ticket yourself tells nobody', res = '1' and pg_temp.about(x.b, x.k2) = 0, res);

  -- ---- the customer replied on your ticket ---------------------------------------
  res := pg_temp.run_as(null, format($q$ select public.ticket_reply('TK-ZZZZ3333', %L, '[TEST] 0018 a reply from the customer') $q$, x.email));
  select n1.title into ttl from public.staff_notifications n1 where n1.recipient = x.b and n1.kind = 'ticket.customer_reply' and n1.entity_id = x.k1::text;
  perform pg_temp.t('customer reply: the person holding the ticket is told', res = 'ok' and pg_temp.unread(x.b, 'ticket.customer_reply', x.k1) = 1, res);
  perform pg_temp.t('customer reply: the title carries the reference and nothing the customer wrote',
    ttl = 'The customer replied on your ticket TK-ZZZZ3333' and ttl not ilike '%reply from%', coalesce(ttl, 'no title'));

  res := pg_temp.run_as(null, format($q$ select public.ticket_reply('TK-ZZZZ3333', %L, '[TEST] 0018 a second reply') $q$, x.email));
  perform pg_temp.t('customer reply: a second reply while the first line is unread adds no second line', res = 'ok' and pg_temp.lines(x.b, 'ticket.customer_reply', x.k1) = 1, res);

  res := pg_temp.run_as(null, format($q$ select public.ticket_reply('TK-ZZZZ5555', %L, '[TEST] 0018 a reply on a ticket nobody holds') $q$, x.email));
  select count(*) into n from public.staff_notifications n1 where n1.entity_id = x.k3::text;
  perform pg_temp.t('customer reply: a reply on a ticket nobody holds tells nobody', res = 'ok' and n = 0, res || ', ' || n || ' line(s)');

  -- ---- an enquiry assigned to you -------------------------------------------------
  res := pg_temp.run_as(x.a, format($q$ with w as (update public.leads set assigned_to = %L where id = %L returning 1) select count(*)::text from w $q$, x.b, x.l1));
  select n1.title into ttl from public.staff_notifications n1 where n1.recipient = x.b and n1.kind = 'lead.assigned' and n1.entity_id = x.l1::text;
  perform pg_temp.t('enquiry assigned: the assignee is told and the assigner is not',
    res = '1' and pg_temp.unread(x.b, 'lead.assigned', x.l1) = 1 and pg_temp.about(x.a, x.l1) = 0
    and ttl = 'An enquiry was assigned to you: GX-ZZZZ3333', res || ' ' || coalesce(ttl, 'no title'));

  res := pg_temp.run_as(x.b, format($q$ with w as (update public.leads set assigned_to = %L where id = %L returning 1) select count(*)::text from w $q$, x.b, x.l2));
  perform pg_temp.t('enquiry assigned: taking an enquiry yourself tells nobody', res = '1' and pg_temp.about(x.b, x.l2) = 0, res);

  -- ---- a follow-up assigned to you -------------------------------------------------
  res := pg_temp.run_as(x.a, format($q$ with w as (insert into public.lead_tasks (lead_id, title, due_at, assigned_to) values (%L, '[TEST] 0018 call Test Visitor back', now() + interval '1 day', %L) returning 1) select count(*)::text from w $q$, x.l1, x.b));
  select n1.title into ttl from public.staff_notifications n1 where n1.recipient = x.b and n1.kind = 'task.assigned' and n1.entity_id = x.l1::text;
  perform pg_temp.t('follow-up assigned: the person it is for is told and the person who wrote it is not',
    res = '1' and pg_temp.unread(x.b, 'task.assigned', x.l1) = 1 and pg_temp.about(x.a, x.l1) = 0, res);
  perform pg_temp.t('follow-up assigned: the title names the enquiry by reference and does not repeat the follow-up''s own line',
    ttl = 'A follow-up was assigned to you on enquiry GX-ZZZZ3333' and ttl not ilike '%Test Visitor%', coalesce(ttl, 'no title'));

  res := pg_temp.run_as(x.b, format($q$ with w as (insert into public.lead_tasks (lead_id, title, due_at) values (%L, '[TEST] 0018 my own follow-up', now() + interval '1 day') returning 1) select count(*)::text from w $q$, x.l2));
  perform pg_temp.t('follow-up assigned: a follow-up you add for yourself tells nobody', res = '1' and pg_temp.about(x.b, x.l2) = 0, res);

  -- ---- a staff change waiting for approval -----------------------------------------
  res := pg_temp.run_as(x.a, format($q$ select public.staff_propose_change(%L, 'agent', 'Test Support (0018, rolled back)', true)::text $q$, x.b));
  begin
    cid := res::uuid;
  exception when others then
    cid := null;
  end;
  perform pg_temp.t('staff change: the request is made and waits (a second admin exists)',
    cid is not null and (select sc.status = 'pending' from public.staff_changes sc where sc.id = cid), res);
  if cid is not null then
    perform pg_temp.t('staff change: the other manager is told', pg_temp.unread(x.c, 'staff.approval', cid) = 1);
    perform pg_temp.t('staff change: the requester and the person it is about are told nothing', pg_temp.about(x.a, cid) = 0 and pg_temp.about(x.b, cid) = 0);
    select count(*) into n
    from public.staff_notifications n1
    join public.staff s on s.user_id = n1.recipient
    left join public.role_capabilities rc on rc.role = s.role and rc.capability = 'staff.manage'
    where n1.entity_id = cid::text and rc.capability is null;
    perform pg_temp.t('staff change: nobody without staff.manage is told', n = 0, n || ' line(s)');
  end if;

  -- ---- a blog post sent for review -------------------------------------------------
  res := pg_temp.run_as(x.c, $q$ with w as (insert into public.blog_posts (slug, title, status) values ('test-personal-0018-a', '[TEST] 0018 a', 'review') returning id) select id::text from w $q$);
  begin
    post1 := res::uuid;
  exception when others then
    post1 := null;
  end;
  perform pg_temp.t('blog review: a post created in review tells the people who may publish, not its writer',
    post1 is not null and pg_temp.unread(x.a, 'blog.review', post1) = 1 and pg_temp.about(x.c, post1) = 0 and pg_temp.about(x.b, post1) = 0, res);

  res := pg_temp.run_as(x.c, $q$ with w as (insert into public.blog_posts (slug, title) values ('test-personal-0018-b', '[TEST] 0018 b') returning id) select id::text from w $q$);
  begin
    post2 := res::uuid;
  exception when others then
    post2 := null;
  end;
  perform pg_temp.t('blog review: a draft tells nobody', post2 is not null and (select count(*) = 0 from public.staff_notifications n1 where n1.entity_id = post2::text), res);
  if post2 is not null then
    res := pg_temp.run_as(x.c, format($q$ with w as (update public.blog_posts set status = 'review' where id = %L returning 1) select count(*)::text from w $q$, post2));
    perform pg_temp.t('blog review: moving the draft to review tells the people who may publish', res = '1' and pg_temp.unread(x.a, 'blog.review', post2) = 1 and pg_temp.about(x.c, post2) = 0, res);
    update public.staff_notifications set read_at = now() where recipient = x.a and entity_id = post2::text;
    res := pg_temp.run_as(x.c, format($q$ with w as (update public.blog_posts set title = '[TEST] 0018 b, edited' where id = %L returning 1) select count(*)::text from w $q$, post2));
    perform pg_temp.t('blog review: saving a post that is already in review says nothing more', res = '1' and pg_temp.lines(x.a, 'blog.review', post2) = 1, res);
  end if;

  -- ---- a visitor waiting in live chat ------------------------------------------------
  delete from public.staff_presence;
  insert into public.staff_presence (user_id, chat_until) values (x.b, now() + interval '2 minutes'), (x.c, now() - interval '1 minute');
  insert into public.chat_conversations (token_hash, visitor_name, page)
  values (encode(sha256(convert_to('test-personal-0018', 'UTF8')), 'hex'), 'Test Visitor', '/')
  returning id into chat;
  select n1.title into ttl from public.staff_notifications n1 where n1.recipient = x.b and n1.kind = 'chat.waiting' and n1.entity_id = chat::text;
  perform pg_temp.t('chat waiting: staff present for chat are told, without the visitor''s name',
    pg_temp.unread(x.b, 'chat.waiting', chat) = 1 and ttl = 'A visitor is waiting in live chat', coalesce(ttl, 'no title'));
  perform pg_temp.t('chat waiting: staff who are not present (or whose presence has expired) are told nothing', pg_temp.about(x.a, chat) = 0 and pg_temp.about(x.c, chat) = 0);
end $$;

-- ---------------------------------------------------------------------------
-- 4. A notification that cannot be written never blocks the action
-- ---------------------------------------------------------------------------
do $$
declare
  x    t_ctx%rowtype;
  res  text;
  res2 text;
  chat uuid;
  n    integer;
begin
  select * into x from t_ctx;
  if not x.has_temp then
    perform pg_temp.skip('broken notifications: the action still succeeds', 'needs a second member of staff');
    return;
  end if;

  -- from here every insert into staff_notifications fails
  alter table public.staff_notifications add constraint zz_test_0018_break check (false) not valid;

  res := pg_temp.run_as(x.a, format($q$ with w as (update public.tickets set assigned_to = %L where id = %L returning 1) select count(*)::text from w $q$, x.b, x.k4));
  perform pg_temp.t('broken notifications: assigning a ticket still succeeds',
    res = '1' and (select t.assigned_to = x.b from public.tickets t where t.id = x.k4), res);
  select count(*) into n from public.audit_log l where l.action = 'ticket.assign' and l.entity_id = x.k4::text;
  perform pg_temp.t('broken notifications: and is still audited, with no notification written', n = 1 and pg_temp.about(x.b, x.k4) = 0, n || ' audit row(s)');

  res := pg_temp.run_as(x.a, format($q$ with w as (insert into public.lead_tasks (lead_id, title, due_at, assigned_to) values (%L, '[TEST] 0018 while broken', now() + interval '1 day', %L) returning 1) select count(*)::text from w $q$, x.l2, x.b));
  perform pg_temp.t('broken notifications: adding a follow-up for a colleague still succeeds', res = '1', res);

  res := pg_temp.run_as(x.a, format($q$ with w as (update public.leads set assigned_to = %L where id = %L returning 1) select count(*)::text from w $q$, x.c, x.l2));
  perform pg_temp.t('broken notifications: assigning an enquiry still succeeds', res = '1' and pg_temp.about(x.c, x.l2) = 0, res);

  res := pg_temp.run_as(x.a, format($q$ with w as (update public.tickets set assigned_to = %L where id = %L returning 1) select count(*)::text from w $q$, x.c, x.k6));
  res2 := pg_temp.run_as(null, format($q$ select public.ticket_reply('TK-ZZZZ2223', %L, '[TEST] 0018 a reply while broken') $q$, x.email));
  perform pg_temp.t('broken notifications: a customer can still reply on a ticket somebody holds', res = '1' and res2 = 'ok' and pg_temp.about(x.c, x.k6) = 0, res || ', ' || res2);

  res := pg_temp.run_as(x.c, $q$ with w as (insert into public.blog_posts (slug, title, status) values ('test-personal-0018-c', '[TEST] 0018 c', 'review') returning id) select id::text from w $q$);
  perform pg_temp.t('broken notifications: a post can still be sent for review', res ~ '^[0-9a-f-]{36}$', res);

  begin
    insert into public.chat_conversations (token_hash, visitor_name, page)
    values (encode(sha256(convert_to('test-personal-0018-broken', 'UTF8')), 'hex'), 'Test Visitor', '/')
    returning id into chat;
  exception when others then
    chat := null;
  end;
  perform pg_temp.t('broken notifications: a visitor can still start a chat', chat is not null);

  alter table public.staff_notifications drop constraint zz_test_0018_break;

  -- and with the table whole again the same path writes its line
  res := pg_temp.run_as(x.a, format($q$ with w as (update public.tickets set assigned_to = %L where id = %L returning 1) select count(*)::text from w $q$, x.b, x.k3));
  perform pg_temp.t('broken notifications: once repaired, the next assignment is notified again', res = '1' and pg_temp.unread(x.b, 'ticket.assigned', x.k3) = 1, res);
end $$;

-- ---------------------------------------------------------------------------
-- 5. Reading, marking read, and what the API may not do
-- ---------------------------------------------------------------------------
do $$
declare
  x     t_ctx%rowtype;
  res   text;
  mine  integer;
  one   bigint;
  n     integer;
begin
  select * into x from t_ctx;
  if not x.has_temp then
    perform pg_temp.skip('notifications: only your own can be read or marked read', 'needs a second member of staff');
    return;
  end if;

  select count(*) into mine from public.staff_notifications n1 where n1.recipient = x.b;
  select min(n1.id) into one from public.staff_notifications n1 where n1.recipient = x.b and n1.kind = 'ticket.assigned' and n1.entity_id = x.k1::text;

  res := pg_temp.run_as(x.b, $q$ select count(*)::text from public.staff_notifications $q$);
  perform pg_temp.t('reading: a person sees exactly their own notifications', res = mine::text and mine > 0, res || ' of ' || mine);
  res := pg_temp.run_as(x.a, format($q$ select count(*)::text from public.staff_notifications where recipient = %L $q$, x.b));
  perform pg_temp.t('reading: an admin cannot read a colleague''s notifications', res = '0', res);
  res := pg_temp.run_as(x.outsider, $q$ select count(*)::text from public.staff_notifications $q$);
  perform pg_temp.t('reading: a signed-in person who is not staff sees none', res = '0', res);
  res := pg_temp.run_as(null, $q$ select count(*)::text from public.staff_notifications $q$);
  perform pg_temp.t('reading: the anonymous role cannot read the table', res = '42501', res);

  -- ---- nobody writes through the API ----------------------------------------------
  res := pg_temp.run_as(x.a, format($q$ with w as (insert into public.staff_notifications (recipient, kind, title, entity, entity_id) values (%L, 'ticket.assigned', 'Forged', 'ticket', %L) returning 1) select count(*)::text from w $q$, x.b, x.k1));
  perform pg_temp.t('api: an admin cannot insert a notification', res = '42501', res);
  res := pg_temp.run_as(x.b, format($q$ with w as (insert into public.staff_notifications (recipient, kind, title, entity, entity_id) values (%L, 'ticket.assigned', 'Forged', 'ticket', %L) returning 1) select count(*)::text from w $q$, x.b, x.k1));
  perform pg_temp.t('api: nobody can insert a notification for themselves either', res = '42501', res);
  res := pg_temp.run_as(null, format($q$ with w as (insert into public.staff_notifications (recipient, kind, title, entity, entity_id) values (%L, 'ticket.assigned', 'Forged', 'ticket', %L) returning 1) select count(*)::text from w $q$, x.b, x.k1));
  perform pg_temp.t('api: the anonymous role cannot insert a notification', res = '42501', res);
  res := pg_temp.run_as(x.b, format($q$ with w as (update public.staff_notifications set title = 'Changed' where id = %s returning 1) select count(*)::text from w $q$, one));
  perform pg_temp.t('api: a notification cannot be edited, even by its recipient', res = '42501', res);
  res := pg_temp.run_as(x.b, format($q$ with w as (update public.staff_notifications set read_at = now() where id = %s returning 1) select count(*)::text from w $q$, one));
  perform pg_temp.t('api: read_at cannot be written directly (marking read goes through the function)', res = '42501', res);
  res := pg_temp.run_as(x.b, format($q$ with w as (delete from public.staff_notifications where id = %s returning 1) select count(*)::text from w $q$, one));
  perform pg_temp.t('api: a notification cannot be deleted through the API', res = '42501', res);
  res := pg_temp.run_as(x.a, format($q$ select public.notify_staff(%L, 'ticket.assigned', 'Forged', 'ticket', %L)::text $q$, x.b, x.k1));
  perform pg_temp.t('api: the internal notify function cannot be called', res = '42501', res);
  res := pg_temp.run_as(x.a, $q$ select public.notifications_prune()::text $q$);
  perform pg_temp.t('api: the retention function cannot be called', res = '42501', res);

  -- ---- marking read -----------------------------------------------------------------
  res := pg_temp.run_as(x.a, format($q$ select public.notifications_mark_read(array[%s]::bigint[])::text $q$, one));
  perform pg_temp.t('mark read: naming a colleague''s notification changes nothing',
    res = '0' and (select n1.read_at is null from public.staff_notifications n1 where n1.id = one), res);
  res := pg_temp.run_as(x.a, $q$ select public.notifications_mark_read()::text $q$);
  select count(*) into n from public.staff_notifications n1 where n1.recipient = x.b and n1.read_at is not null;
  perform pg_temp.t('mark read: "mark all read" by one person leaves a colleague''s unread', n = 0, n || ' of the colleague''s were marked');

  res := pg_temp.run_as(x.b, format($q$ select public.notifications_mark_read(array[%s]::bigint[])::text $q$, one));
  select count(*) into n from public.staff_notifications n1 where n1.recipient = x.b and n1.read_at is not null;
  perform pg_temp.t('mark read: a person marks one of their own', res = '1' and n = 1, res || ', ' || n || ' read');
  res := pg_temp.run_as(x.b, $q$ select public.notifications_mark_read()::text $q$);
  select count(*) into n from public.staff_notifications n1 where n1.recipient = x.b and n1.read_at is null;
  perform pg_temp.t('mark read: and then all the rest', res = (mine - 1)::text and n = 0, res || ' marked, ' || n || ' left unread');

  res := pg_temp.run_as(x.outsider, $q$ select public.notifications_mark_read()::text $q$);
  perform pg_temp.t('mark read: refused for a signed-in person who is not staff', res = '42501', res);
  res := pg_temp.run_as(null, $q$ select public.notifications_mark_read()::text $q$);
  perform pg_temp.t('mark read: refused for the anonymous role', res = '42501', res);

  -- once a line is read, the next event about the same thing is a new line
  res := pg_temp.run_as(x.a, format($q$ with w as (update public.tickets set assigned_to = null where id = %L returning 1) select count(*)::text from w $q$, x.k1));
  res := pg_temp.run_as(x.a, format($q$ with w as (update public.tickets set assigned_to = %L where id = %L returning 1) select count(*)::text from w $q$, x.b, x.k1));
  perform pg_temp.t('mark read: after reading, the same ticket assigned again is a new notification',
    res = '1' and pg_temp.lines(x.b, 'ticket.assigned', x.k1) = 2 and pg_temp.unread(x.b, 'ticket.assigned', x.k1) = 1, res);

  -- ---- somebody switched off ----------------------------------------------------------
  update public.staff set active = false where user_id = x.b;
  res := pg_temp.run_as(x.a, format($q$ with w as (update public.tickets set assigned_to = %L where id = %L returning 1) select count(*)::text from w $q$, x.b, x.k5));
  perform pg_temp.t('inactive: somebody switched off is told nothing', pg_temp.about(x.b, x.k5) = 0, res);
  res := pg_temp.run_as(x.b, $q$ select count(*)::text from public.staff_notifications $q$);
  perform pg_temp.t('inactive: and reads nothing, not even their old notifications', res = '0', res);
  res := pg_temp.run_as(x.b, $q$ select count(*)::text from public.staff_views $q$);
  perform pg_temp.t('inactive: nor their saved views', res = '0', res);
  update public.staff set active = true where user_id = x.b;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Retention
-- ---------------------------------------------------------------------------
do $$
declare
  x        t_ctx%rowtype;
  who      uuid;
  res      text;
  old_read bigint;
  old_new  bigint;
  ancient  bigint;
  recent   bigint;
  edge     bigint;
begin
  select * into x from t_ctx;
  who := case when x.has_temp then x.b else x.a end;

  -- now() does not move inside a transaction, so the ages are exact
  insert into public.staff_notifications (recipient, kind, title, entity, entity_id, created_at, read_at)
  values (who, 'ticket.assigned', '[TEST] 0018 read, 31 days old', 'ticket', x.k1::text, now() - interval '31 days', now() - interval '30 days')
  returning id into old_read;
  insert into public.staff_notifications (recipient, kind, title, entity, entity_id, created_at)
  values (who, 'lead.assigned', '[TEST] 0018 unread, 31 days old', 'lead', x.l1::text, now() - interval '31 days')
  returning id into old_new;
  insert into public.staff_notifications (recipient, kind, title, entity, entity_id, created_at)
  values (who, 'chat.waiting', '[TEST] 0018 unread, 91 days old', 'chat', x.k2::text, now() - interval '91 days')
  returning id into ancient;
  insert into public.staff_notifications (recipient, kind, title, entity, entity_id, created_at, read_at)
  values (who, 'blog.review', '[TEST] 0018 read, 5 days old', 'blog_post', x.k3::text, now() - interval '5 days', now() - interval '4 days')
  returning id into recent;
  insert into public.staff_notifications (recipient, kind, title, entity, entity_id, created_at, read_at)
  values (who, 'staff.approval', '[TEST] 0018 read, 29 days old', 'staff_change', x.k4::text, now() - interval '29 days', now() - interval '28 days')
  returning id into edge;

  -- marking an id that does not exist changes nothing, and still runs retention
  res := pg_temp.run_as(who, $q$ select public.notifications_mark_read(array[-1]::bigint[])::text $q$);
  perform pg_temp.t('retention: runs when somebody marks something read', res = '0', res);
  perform pg_temp.t('retention: a read notification older than 30 days is deleted', not exists (select 1 from public.staff_notifications n1 where n1.id = old_read));
  perform pg_temp.t('retention: an unread one of the same age is kept', exists (select 1 from public.staff_notifications n1 where n1.id = old_new and n1.read_at is null));
  perform pg_temp.t('retention: anything older than 90 days is deleted, read or not', not exists (select 1 from public.staff_notifications n1 where n1.id = ancient));
  perform pg_temp.t('retention: recent notifications are kept, read or not',
    exists (select 1 from public.staff_notifications n1 where n1.id = recent) and exists (select 1 from public.staff_notifications n1 where n1.id = edge));
end $$;

select n, test, case when pass is null then 'skip' when pass then 'pass' else 'FAIL' end as result, note from t_results order by n;

rollback;

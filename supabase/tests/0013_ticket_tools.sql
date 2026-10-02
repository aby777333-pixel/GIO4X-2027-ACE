-- =============================================================================
-- GIO4X · tests for 0013_ticket_tools
-- -----------------------------------------------------------------------------
-- Run as the migration role (on Supabase: postgres) AFTER applying
-- supabase/migrations/0013_ticket_tools.sql. Everything happens inside one
-- transaction that is rolled back: no ticket, rule, macro, staff change or
-- audit entry made here survives. The two SELECTs before the rollback are the
-- result: every row should say "pass" (a "skip" explains itself in its note).
--
-- How it acts as other people: pg_temp.run_as() switches the database role
-- with set_config('role', …, true) (anon / authenticated) and supplies the
-- identity that auth.uid() and auth.role() read with
-- set_config('request.jwt.claims', …, true), runs ONE statement, and switches
-- back. It returns the statement's single text value, or the SQLSTATE of the
-- refusal. Every check and every result row is written as the migration role.
--
-- The staff identity is an existing active admin from public.staff. To act as
-- an inactive member, a viewer, a support agent or someone from finance, that
-- same row is changed for the length of a test and put back (and rolled back
-- at the end anyway). While the script runs it holds a row lock on that staff
-- row and on any rules and macros it switches off; it takes a second or two.
--
-- now() does not move inside a transaction, so "30 hours ago" is exact.
-- =============================================================================

begin;

create temp table t_results (n serial primary key, test text not null, pass boolean, note text not null default '') on commit drop;

create function pg_temp.t(p_test text, p_pass boolean, p_note text default '') returns void
language sql as $f$ insert into t_results (test, pass, note) values (p_test, coalesce(p_pass, false), coalesce(p_note, '')); $f$;

create function pg_temp.skip(p_test text, p_note text) returns void
language sql as $f$ insert into t_results (test, pass, note) values (p_test, null, p_note); $f$;

-- One statement as the anonymous visitor (p_uid null) or as a signed-in user.
-- The statement must return one value (use RETURNING, or wrap a write in a
-- CTE and select from it). A refusal comes back as its SQLSTATE; the role and
-- the claims set inside the block are undone with it.
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

-- A visitor opens a ticket exactly as /api/support does: the ten granted
-- columns, nothing returned. 'ok', or the SQLSTATE of the refusal.
create function pg_temp.open_ticket(p_ref text, p_email text, p_category text) returns text
language sql as $f$
  select pg_temp.run_as(null, format($q$
    with x as (
      insert into public.tickets (id, reference, name, email, category, subject, message, page, privacy_accepted_at, privacy_version)
      values (gen_random_uuid(), %L, 'Test Visitor', %L, %L, '[TEST] 0013', 'A test message written by the 0013 test script.', '/support', now(), 'unversioned')
    )
    select 'ok'
  $q$, p_ref, p_email, p_category));
$f$;

-- the admin every staff test acts as, and their role as it really is
create temp table t_ctx on commit drop as
  select s.user_id as admin_id, s.role as admin_role
  from public.staff s
  join public.role_capabilities rc on rc.role = s.role and rc.capability = 'tickets.manage'
  where s.active
  order by s.created_at
  limit 1;

do $$
begin
  if (select count(*) from t_ctx) <> 1 then
    raise exception '0013 tests need one active member of staff holding tickets.manage (an admin). None found.';
  end if;
  -- rules and macros already in the database must not decide these tests
  update public.ticket_rules set active = false where active;
  update public.ticket_macros set active = false where active;
end $$;

-- ---------------------------------------------------------------------------
-- 1. The public path, with no active rule
-- ---------------------------------------------------------------------------
do $$
declare
  a   uuid := (select admin_id from t_ctx);
  res text;
begin
  res := pg_temp.open_ticket('TK-TESTAAAA', 'test-a@example.invalid', 'account');
  perform pg_temp.t('public: a visitor opens a ticket when there are no active rules', res = 'ok', res);
  perform pg_temp.t('public: that ticket is open, normal, unassigned, not escalated',
    (select t.status = 'open' and t.priority = 'normal' and t.assigned_to is null and t.escalated_at is null
       from public.tickets t where t.reference = 'TK-TESTAAAA'));

  res := pg_temp.open_ticket('TK-TESTAAAB', 'test-b@example.invalid', 'complaint');
  perform pg_temp.t('public: a complaint still starts high (0007 behaviour kept)',
    res = 'ok' and (select t.priority = 'high' from public.tickets t where t.reference = 'TK-TESTAAAB'), res);

  -- the columns a visitor may not send are still refused
  res := pg_temp.run_as(null, format($q$
    with x as (
      insert into public.tickets (id, reference, name, email, category, subject, message, page, privacy_accepted_at, privacy_version, assigned_to)
      values (gen_random_uuid(), 'TK-TESTAAAC', 'Test Visitor', 'test-c@example.invalid', 'account', '[TEST] 0013', 'x', '/support', now(), 'unversioned', %L)
    ) select 'ok' $q$, a));
  perform pg_temp.t('public: a visitor cannot supply assigned_to', res = '42501', res);

  res := pg_temp.run_as(null, $q$
    with x as (
      insert into public.tickets (id, reference, name, email, category, subject, message, page, privacy_accepted_at, privacy_version, escalated_at)
      values (gen_random_uuid(), 'TK-TESTAAAD', 'Test Visitor', 'test-c@example.invalid', 'account', '[TEST] 0013', 'x', '/support', now(), 'unversioned', now())
    ) select 'ok' $q$);
  perform pg_temp.t('public: a visitor cannot supply escalated_at', res = '42501', res);

  res := pg_temp.run_as(null, $q$ select count(*)::text from public.ticket_rules $q$);
  perform pg_temp.t('anon: cannot read ticket_rules', res = '42501', res);
  res := pg_temp.run_as(null, $q$ select count(*)::text from public.ticket_macros $q$);
  perform pg_temp.t('anon: cannot read ticket_macros', res = '42501', res);
  res := pg_temp.run_as(null, $q$ select count(*)::text from public.tickets_overdue() $q$);
  perform pg_temp.t('anon: cannot call tickets_overdue()', res = '42501', res);
  res := pg_temp.run_as(null, $q$ select public.ticket_escalate(gen_random_uuid()) $q$);
  perform pg_temp.t('anon: cannot call ticket_escalate()', res = '42501', res);
  res := pg_temp.run_as(null, $q$ select count(*)::text from public.ticket_assignees() $q$);
  perform pg_temp.t('anon: cannot call ticket_assignees()', res = '42501', res);
  res := pg_temp.run_as(null, $q$ select public.ticket_rule_move(gen_random_uuid(), true)::text $q$);
  perform pg_temp.t('anon: cannot call ticket_rule_move()', res = '42501', res);
end $$;

-- ---------------------------------------------------------------------------
-- 2. Rules: who may write them, and what the database insists on
-- ---------------------------------------------------------------------------
do $$
declare
  a    uuid := (select admin_id from t_ctx);
  b    uuid := (select s.user_id from public.staff s where s.user_id <> (select admin_id from t_ctx) order by s.created_at limit 1);
  b_active boolean;
  res  text;
  rid  uuid;
begin
  res := pg_temp.run_as(a, format($q$
    insert into public.ticket_rules (name, when_category, assign_to) values ('[TEST] platform to admin', 'platform', %L) returning id::text $q$, a));
  perform pg_temp.t('rules: a holder of tickets.manage creates a rule', res ~ '^[0-9a-f-]{36}$', res);
  rid := (select id from public.ticket_rules where name = '[TEST] platform to admin');
  perform pg_temp.t('rules: the new rule is stamped with its author and placed at the end',
    (select r.created_by = a and r.updated_by = a and r.position = (select max(position) from public.ticket_rules) from public.ticket_rules r where r.id = rid));
  perform pg_temp.t('rules: creating a rule is audited',
    exists (select 1 from public.audit_log l where l.action = 'ticket_rule.create' and l.entity_id = rid::text and l.actor = a));

  res := pg_temp.run_as(a, $q$ insert into public.ticket_rules (name, when_category) values ('[TEST] does nothing', 'other') returning id::text $q$);
  perform pg_temp.t('rules: a rule that neither assigns nor sets a priority is refused', res = '22023', res);

  res := pg_temp.run_as(a, $q$ insert into public.ticket_rules (name, when_category, set_priority, position) values ('[TEST] position', 'other', 'low', 1) returning id::text $q$);
  perform pg_temp.t('rules: the order cannot be written directly', res = '42501', res);

  res := pg_temp.run_as(a, format($q$ with x as (delete from public.ticket_rules where id = %L returning 1) select count(*)::text from x $q$, rid));
  perform pg_temp.t('rules: nobody can delete a rule', res = '42501', res);

  -- a rule cannot name someone who cannot be given tickets (needs a second member of staff to try with)
  if b is null then
    perform pg_temp.skip('rules: a rule cannot name someone who cannot be given tickets', 'only one member of staff exists, so there is nobody else to name; ticket_assignee_ok() is checked below instead');
  else
    select s.active into b_active from public.staff s where s.user_id = b;
    update public.staff set active = false where user_id = b;
    res := pg_temp.run_as(a, format($q$
      insert into public.ticket_rules (name, when_category, assign_to) values ('[TEST] to an inactive member', 'other', %L) returning id::text $q$, b));
    perform pg_temp.t('rules: a rule cannot name someone who cannot be given tickets', res = '22023', res);
    update public.staff set active = b_active where user_id = b;
  end if;

  -- the same person as a support agent: holds tickets.write, not tickets.manage
  update public.staff set role = 'support' where user_id = a;
  res := pg_temp.run_as(a, $q$ select count(*)::text from public.ticket_rules $q$);
  perform pg_temp.t('rules: a member without tickets.manage reads no rules', res = '0', res);
  res := pg_temp.run_as(a, $q$ insert into public.ticket_rules (name, when_category, set_priority) values ('[TEST] by support', 'other', 'low') returning id::text $q$);
  perform pg_temp.t('rules: a member without tickets.manage cannot create one', res = '42501', res);
  res := pg_temp.run_as(a, format($q$ with x as (update public.ticket_rules set active = false where id = %L returning 1) select count(*)::text from x $q$, rid));
  perform pg_temp.t('rules: a member without tickets.manage cannot switch one off (0 rows)', res = '0', res);
  res := pg_temp.run_as(a, format($q$ select public.ticket_rule_move(%L, true)::text $q$, rid));
  perform pg_temp.t('rules: a member without tickets.manage cannot reorder', res = '42501', res);
  res := pg_temp.run_as(a, $q$ select count(*)::text from public.ticket_assignees() $q$);
  perform pg_temp.t('rules: ticket_assignees() is empty without tickets.manage', res = '0', res);
  update public.staff set role = (select admin_role from t_ctx) where user_id = a;

  res := pg_temp.run_as(a, format($q$ select count(*)::text from public.ticket_assignees() x where x.user_id = %L $q$, a));
  perform pg_temp.t('rules: ticket_assignees() lists an active holder of tickets.write', res = '1', res);
end $$;

-- ---------------------------------------------------------------------------
-- 3. A rule assigns; an unusable assignee is skipped; the next rule is tried
-- ---------------------------------------------------------------------------
do $$
declare
  a    uuid := (select admin_id from t_ctx);
  rid  uuid := (select id from public.ticket_rules where name = '[TEST] platform to admin');
  rid2 uuid;
  res  text;
begin
  res := pg_temp.open_ticket('TK-TESTBBBA', 'test-d@example.invalid', 'platform');
  perform pg_temp.t('rule: a visitor opens a ticket that an assigning rule matches', res = 'ok', res);
  perform pg_temp.t('rule: the ticket is assigned to the person the rule names',
    (select t.assigned_to = a and t.status = 'open' and t.priority = 'normal' from public.tickets t where t.reference = 'TK-TESTBBBA'));
  perform pg_temp.t('rule: the audit log says which rule did it',
    exists (
      select 1 from public.audit_log l
      join public.tickets t on t.id::text = l.entity_id
      where t.reference = 'TK-TESTBBBA' and l.action = 'ticket.rule' and l.actor is null
        and l.detail ->> 'rule_id' = rid::text and l.detail ->> 'assigned_to' = a::text));
  perform pg_temp.t('rule: the assignment itself is also audited by the existing 0007 trigger',
    exists (
      select 1 from public.audit_log l
      join public.tickets t on t.id::text = l.entity_id
      where t.reference = 'TK-TESTBBBA' and l.action = 'ticket.assign' and l.detail ->> 'to' = a::text));

  res := pg_temp.open_ticket('TK-TESTBBBB', 'test-e@example.invalid', 'funding');
  perform pg_temp.t('rule: a ticket no rule matches arrives unassigned',
    res = 'ok' and (select t.assigned_to is null from public.tickets t where t.reference = 'TK-TESTBBBB'), res);

  -- a second rule for the same category, lower in the list: it only sets the priority
  res := pg_temp.run_as(a, $q$ insert into public.ticket_rules (name, when_category, set_priority) values ('[TEST] platform is high', 'platform', 'high') returning id::text $q$);
  rid2 := (select id from public.ticket_rules where name = '[TEST] platform is high');
  perform pg_temp.t('rules: a second rule is created below the first',
    rid2 is not null and (select r2.position > r1.position from public.ticket_rules r1, public.ticket_rules r2 where r1.id = rid and r2.id = rid2), res);

  res := pg_temp.open_ticket('TK-TESTBBBC', 'test-f@example.invalid', 'platform');
  perform pg_temp.t('rule: the first matching rule wins (assigned, priority left alone)',
    res = 'ok' and (select t.assigned_to = a and t.priority = 'normal' from public.tickets t where t.reference = 'TK-TESTBBBC'), res);

  -- the person the first rule names is switched off
  update public.staff set active = false where user_id = a;
  perform pg_temp.t('rules: ticket_assignee_ok() is false for an inactive member', not public.ticket_assignee_ok(a));
  res := pg_temp.open_ticket('TK-TESTBBBD', 'test-g@example.invalid', 'platform');
  perform pg_temp.t('rule: with the assignee inactive the ticket is still accepted', res = 'ok', res);
  perform pg_temp.t('rule: the rule naming an inactive member is skipped and the next one applies',
    (select t.assigned_to is null and t.priority = 'high' from public.tickets t where t.reference = 'TK-TESTBBBD'));
  perform pg_temp.t('rule: the audit log names the rule that did apply',
    exists (
      select 1 from public.audit_log l
      join public.tickets t on t.id::text = l.entity_id
      where t.reference = 'TK-TESTBBBD' and l.action = 'ticket.rule' and l.detail ->> 'rule_id' = rid2::text));
  update public.staff set active = true where user_id = a;
  perform pg_temp.t('rules: ticket_assignee_ok() is true for an active holder of tickets.write', public.ticket_assignee_ok(a));

  -- the person is active, but their role no longer holds tickets.write
  update public.staff set role = 'viewer' where user_id = a;
  res := pg_temp.open_ticket('TK-TESTBBBE', 'test-h@example.invalid', 'platform');
  perform pg_temp.t('rule: a rule naming someone without tickets.write is skipped',
    res = 'ok' and (select t.assigned_to is null and t.priority = 'high' from public.tickets t where t.reference = 'TK-TESTBBBE'), res);
  update public.staff set role = (select admin_role from t_ctx) where user_id = a;

  -- reorder: the priority rule moves above the assigning rule
  res := pg_temp.run_as(a, format($q$ select public.ticket_rule_move(%L, true)::text $q$, rid2));
  perform pg_temp.t('rules: ticket_rule_move() moves a rule up one place',
    res = 'true' and (select r2.position < r1.position from public.ticket_rules r1, public.ticket_rules r2 where r1.id = rid and r2.id = rid2), res);
  perform pg_temp.t('rules: the move is audited',
    exists (select 1 from public.audit_log l where l.action = 'ticket_rule.move' and l.entity_id = rid2::text and l.actor = a));
  res := pg_temp.open_ticket('TK-TESTBBBF', 'test-i@example.invalid', 'platform');
  perform pg_temp.t('rules: after the move the other rule wins',
    res = 'ok' and (select t.assigned_to is null and t.priority = 'high' from public.tickets t where t.reference = 'TK-TESTBBBF'), res);

  -- switched off: it no longer applies
  res := pg_temp.run_as(a, format($q$ with x as (update public.ticket_rules set active = false where id = %L returning 1) select count(*)::text from x $q$, rid2));
  perform pg_temp.t('rules: a holder of tickets.manage switches a rule off, and it is audited',
    res = '1' and exists (select 1 from public.audit_log l where l.action = 'ticket_rule.off' and l.entity_id = rid2::text and l.actor = a), res);
  res := pg_temp.open_ticket('TK-TESTBBBG', 'test-j@example.invalid', 'platform');
  perform pg_temp.t('rules: a rule that is switched off does not apply',
    res = 'ok' and (select t.assigned_to = a and t.priority = 'normal' from public.tickets t where t.reference = 'TK-TESTBBBG'), res);
end $$;

-- ---------------------------------------------------------------------------
-- 4. A broken rule can never block a customer's ticket
-- ---------------------------------------------------------------------------
do $$
declare
  res text;
  bad uuid;
begin
  -- Break a rule in a way the screens cannot: remove the check for the length
  -- of this transaction and store a priority the tickets table will refuse.
  alter table public.ticket_rules drop constraint ticket_rules_set_priority_valid;
  insert into public.ticket_rules (name, when_category, set_priority)
  values ('[TEST] broken', 'technical', 'bogus') returning id into bad;
  update public.ticket_rules set position = -1 where id = bad; -- first in the list

  res := pg_temp.open_ticket('TK-TESTCCCA', 'test-k@example.invalid', 'technical');
  perform pg_temp.t('broken rule: the visitor''s ticket is still accepted', res = 'ok', res);
  perform pg_temp.t('broken rule: the ticket is stored untouched (open, normal, unassigned)',
    (select t.status = 'open' and t.priority = 'normal' and t.assigned_to is null from public.tickets t where t.reference = 'TK-TESTCCCA'));
  perform pg_temp.t('broken rule: the failure is recorded with the rule and the error code',
    exists (
      select 1 from public.audit_log l
      join public.tickets t on t.id::text = l.entity_id
      where t.reference = 'TK-TESTCCCA' and l.action = 'ticket.rule_failed'
        and l.detail ->> 'rule_id' = bad::text and l.detail ->> 'code' = '23514'));
  perform pg_temp.t('broken rule: no "rule applied" entry was left behind',
    not exists (
      select 1 from public.audit_log l
      join public.tickets t on t.id::text = l.entity_id
      where t.reference = 'TK-TESTCCCA' and l.action = 'ticket.rule'));

  update public.ticket_rules set active = false where id = bad;
end $$;

-- ---------------------------------------------------------------------------
-- 5. The throttle from 0007 still bites with rules present
-- ---------------------------------------------------------------------------
do $$
declare
  res text;
  i   integer;
begin
  for i in 1..5 loop
    res := pg_temp.open_ticket('TK-TESTDDD' || chr(64 + i), 'test-throttle@example.invalid', 'platform');
    exit when res <> 'ok';
  end loop;
  perform pg_temp.t('throttle: five tickets from one address in an hour are accepted', res = 'ok',
    res || ' (PT429 here means the shared 30-a-minute limit was near its ceiling when the script started: run it again in a minute)');
  res := pg_temp.open_ticket('TK-TESTDDDF', 'test-throttle@example.invalid', 'platform');
  perform pg_temp.t('throttle: the sixth is refused with PT429, as before', res = 'PT429', res);
end $$;

-- ---------------------------------------------------------------------------
-- 6. Canned replies: who sees what
-- ---------------------------------------------------------------------------
do $$
declare
  a    uuid := (select admin_id from t_ctx);
  m1   uuid;
  m2   uuid;
  res  text;
begin
  res := pg_temp.run_as(a, $q$ insert into public.ticket_macros (title, body, set_status) values ('[TEST] active', 'Hello {{name}}, about {{reference}}.', 'solved') returning id::text $q$);
  perform pg_temp.t('macros: a holder of tickets.manage creates a macro', res ~ '^[0-9a-f-]{36}$', res);
  res := pg_temp.run_as(a, $q$ insert into public.ticket_macros (title, body, active) values ('[TEST] retired', 'Old text.', false) returning id::text $q$);
  perform pg_temp.t('macros: and one that starts retired', res ~ '^[0-9a-f-]{36}$', res);
  m1 := (select id from public.ticket_macros where title = '[TEST] active');
  m2 := (select id from public.ticket_macros where title = '[TEST] retired');

  res := pg_temp.run_as(a, $q$ select count(*)::text from public.ticket_macros where title like '[TEST]%' $q$);
  perform pg_temp.t('macros: a holder of tickets.manage sees active and retired ones', res = '2', res);
  perform pg_temp.t('macros: the author is the caller', (select created_by = a and updated_by = a from public.ticket_macros where id = m1));
  perform pg_temp.t('macros: creation is audited by title, never with the text',
    exists (select 1 from public.audit_log l where l.action = 'ticket_macro.create' and l.entity_id = m1::text and l.actor = a and l.detail ->> 'title' = '[TEST] active')
    and not exists (select 1 from public.audit_log l where l.entity = 'ticket_macro' and l.detail::text like '%Hello%'));

  res := pg_temp.run_as(a, $q$ insert into public.ticket_macros (title, body, set_status) values ('[TEST] bad', 'x', 'nonsense') returning id::text $q$);
  perform pg_temp.t('macros: an action outside the allowed values is refused', res = '23514', res);
  res := pg_temp.run_as(a, $q$ insert into public.ticket_macros (title, body) values ('[TEST] long', repeat('x', 5001)) returning id::text $q$);
  perform pg_temp.t('macros: a text over the ticket message limit (5000) is refused', res = '23514', res);
  res := pg_temp.run_as(a, $q$ insert into public.ticket_macros (title, body) values ('[TEST] full', repeat('x', 5000)) returning 'ok' $q$);
  perform pg_temp.t('macros: a text of exactly 5000 characters is accepted', res = 'ok', res);
  res := pg_temp.run_as(a, format($q$ with x as (delete from public.ticket_macros where id = %L returning 1) select count(*)::text from x $q$, m2));
  perform pg_temp.t('macros: nobody can delete a macro', res = '42501', res);
  res := pg_temp.run_as(a, format($q$ with x as (update public.ticket_macros set created_by = null where id = %L returning 1) select count(*)::text from x $q$, m1));
  perform pg_temp.t('macros: the author cannot be rewritten', res = '42501', res);

  -- support: tickets.write without tickets.manage
  update public.staff set role = 'support' where user_id = a;
  res := pg_temp.run_as(a, $q$ select count(*)::text from public.ticket_macros where title in ('[TEST] active', '[TEST] retired') $q$);
  perform pg_temp.t('macros: a holder of tickets.write sees the active macro only', res = '1', res);
  res := pg_temp.run_as(a, $q$ insert into public.ticket_macros (title, body) values ('[TEST] by support', 'x') returning id::text $q$);
  perform pg_temp.t('macros: a holder of tickets.write cannot create one', res = '42501', res);
  res := pg_temp.run_as(a, format($q$ with x as (update public.ticket_macros set title = '[TEST] changed by support' where id = %L returning 1) select count(*)::text from x $q$, m1));
  perform pg_temp.t('macros: a holder of tickets.write cannot edit one (0 rows)', res = '0', res);

  -- viewer: tickets.read only
  update public.staff set role = 'viewer' where user_id = a;
  res := pg_temp.run_as(a, $q$ select count(*)::text from public.ticket_macros $q$);
  perform pg_temp.t('macros: a member with tickets.read only sees none', res = '0', res);

  -- inactive: nothing at all
  update public.staff set role = (select admin_role from t_ctx), active = false where user_id = a;
  res := pg_temp.run_as(a, $q$ select count(*)::text from public.ticket_macros $q$);
  perform pg_temp.t('macros: an inactive member sees none', res = '0', res);
  update public.staff set active = true where user_id = a;

  -- edit, retire, restore
  res := pg_temp.run_as(a, format($q$ with x as (update public.ticket_macros set body = 'Changed text.' where id = %L returning 1) select count(*)::text from x $q$, m1));
  perform pg_temp.t('macros: an edit is audited as "text changed", without the text',
    res = '1' and exists (select 1 from public.audit_log l where l.action = 'ticket_macro.update' and l.entity_id = m1::text and l.actor = a and l.detail ->> 'text_changed' = 'true')
    and not exists (select 1 from public.audit_log l where l.entity = 'ticket_macro' and l.detail::text like '%Changed text%'), res);
  res := pg_temp.run_as(a, format($q$ with x as (update public.ticket_macros set active = false where id = %L returning 1) select count(*)::text from x $q$, m1));
  perform pg_temp.t('macros: retiring is audited',
    res = '1' and exists (select 1 from public.audit_log l where l.action = 'ticket_macro.retire' and l.entity_id = m1::text and l.actor = a), res);
  res := pg_temp.run_as(a, format($q$ with x as (update public.ticket_macros set active = true where id = %L returning 1) select count(*)::text from x $q$, m2));
  perform pg_temp.t('macros: restoring is audited',
    res = '1' and exists (select 1 from public.audit_log l where l.action = 'ticket_macro.restore' and l.entity_id = m2::text and l.actor = a), res);
end $$;

-- ---------------------------------------------------------------------------
-- 7. Overdue and escalation
-- ---------------------------------------------------------------------------
do $$
declare
  a      uuid := (select admin_id from t_ctx);
  late   uuid := gen_random_uuid();
  fresh  uuid := gen_random_uuid();
  urgent uuid := gen_random_uuid();
  low    uuid := gen_random_uuid();
  res    text;
begin
  -- Written as the migration role (no API role), so the clock can be set in
  -- the past: a normal ticket opened 30 hours ago (target 24), a fresh one, an
  -- urgent one opened 3 hours ago (target 2), and a low one answered long ago.
  insert into public.tickets (id, reference, created_at, name, email, category, subject, message, page, privacy_accepted_at, privacy_version, priority)
  values
    (late,   'TK-TESTEEEA', now() - interval '30 hours', 'Test Visitor', 'test-l@example.invalid', 'platform', '[TEST] late',   'x', '/support', now() - interval '30 hours', 'unversioned', 'normal'),
    (fresh,  'TK-TESTEEEB', now() - interval '1 hour',   'Test Visitor', 'test-m@example.invalid', 'platform', '[TEST] fresh',  'x', '/support', now() - interval '1 hour',   'unversioned', 'normal'),
    (urgent, 'TK-TESTEEEC', now() - interval '3 hours',  'Test Visitor', 'test-n@example.invalid', 'platform', '[TEST] urgent', 'x', '/support', now() - interval '3 hours',  'unversioned', 'urgent'),
    (low,    'TK-TESTEEED', now() - interval '90 hours', 'Test Visitor', 'test-o@example.invalid', 'platform', '[TEST] low',    'x', '/support', now() - interval '90 hours', 'unversioned', 'low');
  update public.tickets set first_response_at = now() - interval '80 hours', status = 'pending' where id = low;

  perform pg_temp.t('rules: a ticket written in SQL by the migration role is not routed (a matching rule is active)',
    (select t.assigned_to is null from public.tickets t where t.id = late)
    and exists (select 1 from public.ticket_rules r where r.active and r.when_category = 'platform'));

  res := pg_temp.run_as(a, format($q$ select count(*)::text from public.tickets_overdue() o where o.id in (%L, %L, %L, %L) $q$, late, fresh, urgent, low));
  perform pg_temp.t('overdue: lists the late and the late-urgent ticket, not the fresh or the answered one', res = '2', res);
  res := pg_temp.run_as(a, format($q$ select o.hours_overdue::text || ' / ' || o.target_hours::text from public.tickets_overdue() o where o.id = %L $q$, late));
  perform pg_temp.t('overdue: hours are counted from the target (30h old, 24h target = 6.0 over)', res = '6.0 / 24', res);
  res := pg_temp.run_as(a, $q$ select ((public.command_summary() -> 'tickets' ->> 'late')::integer = (select count(*) from public.tickets_overdue()))::text $q$);
  perform pg_temp.t('overdue: the count equals the Command Centre''s "late" figure', res = 'true', res);

  -- a member without tickets.read gets nothing; without tickets.write is refused
  update public.staff set role = 'finance' where user_id = a;
  res := pg_temp.run_as(a, $q$ select count(*)::text from public.tickets_overdue() $q$);
  perform pg_temp.t('overdue: empty for a member without tickets.read', res = '0', res);

  update public.staff set role = 'viewer' where user_id = a;
  res := pg_temp.run_as(a, format($q$ select public.ticket_escalate(%L) $q$, late));
  perform pg_temp.t('escalate: a member without tickets.write is refused', res = '42501', res);
  perform pg_temp.t('escalate: and nothing changed',
    (select t.priority = 'normal' and t.escalated_at is null from public.tickets t where t.id = late));

  update public.staff set role = (select admin_role from t_ctx), active = false where user_id = a;
  res := pg_temp.run_as(a, format($q$ select public.ticket_escalate(%L) $q$, late));
  perform pg_temp.t('escalate: an inactive member is refused', res = '42501', res);
  update public.staff set active = true where user_id = a;

  res := pg_temp.run_as(a, format($q$ with x as (update public.tickets set escalated_at = now() where id = %L returning 1) select count(*)::text from x $q$, late));
  perform pg_temp.t('escalate: escalated_at cannot be set through the API, even by a writer', res = '42501', res);

  res := pg_temp.run_as(a, format($q$ select public.ticket_escalate(%L) $q$, fresh));
  perform pg_temp.t('escalate: a ticket still within its target is left alone', res = 'not_late', res);
  res := pg_temp.run_as(a, format($q$ select public.ticket_escalate(%L) $q$, low));
  perform pg_temp.t('escalate: an answered ticket is left alone', res = 'not_late', res);
  res := pg_temp.run_as(a, $q$ select public.ticket_escalate(gen_random_uuid()) $q$);
  perform pg_temp.t('escalate: an unknown ticket answers "not_found"', res = 'not_found', res);

  res := pg_temp.run_as(a, format($q$ select public.ticket_escalate(%L) $q$, late));
  perform pg_temp.t('escalate: a late ticket is escalated', res = 'escalated', res);
  perform pg_temp.t('escalate: its priority went up exactly one step and the time is stamped; nothing else moved',
    (select t.priority = 'high' and t.escalated_at is not null and t.status = 'open' and t.assigned_to is null and t.first_response_at is null
       from public.tickets t where t.id = late));
  perform pg_temp.t('escalate: it is audited with who did it, from and to',
    exists (select 1 from public.audit_log l where l.action = 'ticket.escalate' and l.entity_id = late::text and l.actor = a
              and l.detail ->> 'from' = 'normal' and l.detail ->> 'to' = 'high' and l.detail ->> 'hours_overdue' = '6.0'));
  perform pg_temp.t('escalate: the priority change is also in the audit log (existing 0007 trigger)',
    exists (select 1 from public.audit_log l where l.action = 'ticket.priority' and l.entity_id = late::text and l.actor = a));

  res := pg_temp.run_as(a, format($q$ select public.ticket_escalate(%L) $q$, late));
  perform pg_temp.t('escalate: a second attempt answers "already"', res = 'already', res);
  perform pg_temp.t('escalate: and neither the priority nor the audit log moved again',
    (select t.priority = 'high' from public.tickets t where t.id = late)
    and (select count(*) = 1 from public.audit_log l where l.action = 'ticket.escalate' and l.entity_id = late::text));

  res := pg_temp.run_as(a, format($q$ select count(*)::text from public.tickets_overdue() o where o.id = %L and o.escalated_at is not null and o.priority = 'high' $q$, late));
  perform pg_temp.t('overdue: an escalated ticket stays on the list, marked as escalated', res = '1', res);

  res := pg_temp.run_as(a, format($q$ select public.ticket_escalate(%L) $q$, urgent));
  perform pg_temp.t('escalate: an urgent ticket is flagged, its priority unchanged',
    res = 'flagged' and (select t.priority = 'urgent' and t.escalated_at is not null from public.tickets t where t.id = urgent), res);
end $$;

-- ---------------------------------------------------------------------------
-- 8. What was already there still works for staff
-- ---------------------------------------------------------------------------
do $$
declare
  a   uuid := (select admin_id from t_ctx);
  tid uuid := (select id from public.tickets where reference = 'TK-TESTAAAA');
  res text;
begin
  res := pg_temp.run_as(a, format($q$ with x as (update public.tickets set status = 'solved', priority = 'low', category = 'other' where id = %L returning 1) select count(*)::text from x $q$, tid));
  perform pg_temp.t('existing: a writer still changes status, priority and category', res = '1', res);
  res := pg_temp.run_as(a, format($q$ insert into public.ticket_messages (ticket_id, body) values (%L, 'A test reply written by the 0013 test script.') returning 'ok' $q$, tid));
  perform pg_temp.t('existing: a writer still replies', res = 'ok', res);
  perform pg_temp.t('existing: the first reply is still stamped and takes the ticket (0007 trigger)',
    (select t.first_response_at is not null and t.assigned_to = a from public.tickets t where t.id = tid));
  res := pg_temp.run_as(a, format($q$ select (public.ticket_view('TK-TESTAAAA', 'test-a@example.invalid') ->> 'status') $q$));
  perform pg_temp.t('existing: the customer''s view of the ticket still works and shows no internal field',
    res = 'solved'
    and not (public.ticket_view('TK-TESTAAAA', 'test-a@example.invalid') ? 'escalated_at')
    and not (public.ticket_view('TK-TESTAAAA', 'test-a@example.invalid') ? 'priority'), res);
end $$;

select n, case when pass is null then 'skip' when pass then 'pass' else 'FAIL' end as result, test, note from t_results order by n;
select count(*) filter (where pass) as passed, count(*) filter (where pass = false) as failed, count(*) filter (where pass is null) as skipped from t_results;

rollback;

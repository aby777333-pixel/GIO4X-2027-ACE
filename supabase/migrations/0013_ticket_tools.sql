-- =============================================================================
-- GIO4X · 0013_ticket_tools · canned replies, assignment rules, escalation
-- -----------------------------------------------------------------------------
-- Apply after 0012. Re-runnable. Purely additive: no existing column, policy,
-- function or trigger is changed. The one thing added to an existing table is
-- the column tickets.escalated_at and one AFTER INSERT trigger.
--
-- 1. ticket_macros   canned replies. A title, a starting text for a reply and,
--                    optionally, what to set with it (status, priority,
--                    category). Staff holding tickets.write read the active
--                    ones; tickets.manage creates, edits and retires them.
--                    Nothing is ever deleted. A macro is only a starting text:
--                    the console puts it in the reply box, a person reads it
--                    and sends it as an ordinary reply through the ordinary
--                    path (0007). The database never sends one by itself.
--
-- 2. ticket_rules    an ordered list: when the category is X and/or the
--                    priority is Y, give the ticket to Z and/or set its
--                    priority. Applied once, when a ticket arrives from the
--                    website; the first active rule that matches wins. A rule
--                    whose assignee is not, AT THAT MOMENT, an active member of
--                    staff holding tickets.write is skipped and the next one is
--                    tried.
--
--    WHY THE RULES RUN IN AN *AFTER* INSERT TRIGGER, NOT A BEFORE ONE
--    The public's insert policy (tickets_public_insert, 0007) requires
--    `assigned_to is null`, and Postgres evaluates a WITH CHECK policy AFTER the
--    BEFORE ROW triggers have run, against the row as they left it. A BEFORE
--    trigger that filled assigned_to would therefore make every routed ticket
--    fail the policy: the customer would be refused. So the row is inserted
--    exactly as before (throttle, clock, complaint = high, policy check), and
--    only then does tickets_rules_after_insert update it. It therefore runs
--    after ALL the existing before-insert logic by construction; among AFTER
--    ROW triggers (fired in name order) "tickets_rules_…" also sorts after any
--    "tickets_after_…" / "tickets_before_…" name. There is no other AFTER
--    INSERT trigger on tickets today.
--
--    The trigger cannot refuse a ticket: all of its work sits inside one
--    exception block, so any error in a rule (or in this code) is rolled back
--    to the start of the block and the insert carries on untouched. A failure
--    is recorded as 'ticket.rule_failed' when that is possible. (The one thing
--    no handler can catch is the statement being cancelled, which would end
--    the insert whether or not this trigger existed.)
--
--    Applies only to rows arriving through the API roles (anon, authenticated),
--    like the throttle: rows written in SQL by the owner are left alone.
--    Because the assignment is an UPDATE, the existing update triggers run and
--    write their own 'ticket.assign' / 'ticket.priority' rows (actor empty);
--    this trigger adds 'ticket.rule', which names the rule.
--    Known edge: a ticket inserted with a signed-in STAFF token that lacks
--    leads.assign is refused the assignment by tickets_before_update (0007);
--    that is caught, the ticket is stored unassigned, and it is recorded as
--    'ticket.rule_failed'. The website never inserts with a staff token.
--
-- 3. Escalation      tickets.escalated_at, tickets_overdue() and
--                    ticket_escalate(). "Overdue" is exactly what the Command
--                    Centre calls late (command_summary, 0009): open, no first
--                    reply yet, and past the internal target for its priority
--                    counted from when it was opened. The targets are for
--                    staff and are never shown to the public. Nothing here is
--                    timed: there is no scheduler. A person presses a button.
--                    A ticket breaches its first-reply target at most once
--                    (the target runs from opening to the first reply), so a
--                    ticket can be escalated once.
--
-- New capability: tickets.manage (admin only).
-- =============================================================================

do $guard$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles r
    where r.rolname = current_user and (r.rolbypassrls or r.rolsuper)
  ) then
    raise exception
      'GIO4X migrations must be applied by a role with BYPASSRLS (on Supabase: postgres). Current role: %', current_user;
  end if;
end
$guard$;

insert into public.role_capabilities (role, capability) values
  ('admin', 'tickets.manage')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- ticket_macros
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_macros (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_by   uuid,
  title        text not null,
  body         text not null,
  -- applied with the reply only if the person sending it leaves them ticked
  set_status   text,
  set_priority text,
  set_category text,
  active       boolean not null default true,
  constraint ticket_macros_title_valid check (
    char_length(title) between 1 and 80 and char_length(btrim(title)) >= 1 and title !~ '[\u0001-\u001F\u007F]'
  ),
  -- the same bounds as a ticket message (ticket_messages_body_valid, 0007)
  constraint ticket_macros_body_valid check (
    char_length(body) between 1 and 5000
    and char_length(btrim(body)) >= 1
    and body !~ '[\u0001-\u0008\u000B-\u001F\u007F]'
  ),
  constraint ticket_macros_set_status_valid check (set_status is null or set_status in ('open', 'pending', 'solved', 'closed')),
  constraint ticket_macros_set_priority_valid check (set_priority is null or set_priority in ('low', 'normal', 'high', 'urgent')),
  constraint ticket_macros_set_category_valid check (set_category is null or set_category in (
    'account', 'platform', 'funding', 'technical', 'complaint', 'privacy', 'security', 'other'
  ))
);
comment on table public.ticket_macros is 'Canned replies for tickets: a starting text a person edits and sends. Retired, never deleted.';

alter table public.ticket_macros enable row level security;
alter table public.ticket_macros force row level security;
revoke all on table public.ticket_macros from public, anon, authenticated;

create index if not exists ticket_macros_active_title_idx on public.ticket_macros (active, title);

grant select on public.ticket_macros to authenticated;
grant insert (title, body, set_status, set_priority, set_category, active) on public.ticket_macros to authenticated;
grant update (title, body, set_status, set_priority, set_category, active) on public.ticket_macros to authenticated;
-- no DELETE for anyone: a macro is retired (active = false)

drop policy if exists ticket_macros_staff_select on public.ticket_macros;
create policy ticket_macros_staff_select on public.ticket_macros
  for select
  to authenticated
  using (
    (select public.staff_can('tickets.manage'))
    or (active and (select public.staff_can('tickets.write')))
  );

drop policy if exists ticket_macros_manage_insert on public.ticket_macros;
create policy ticket_macros_manage_insert on public.ticket_macros
  for insert
  to authenticated
  with check ((select public.staff_can('tickets.manage')));

drop policy if exists ticket_macros_manage_update on public.ticket_macros;
create policy ticket_macros_manage_update on public.ticket_macros
  for update
  to authenticated
  using ((select public.staff_can('tickets.manage')))
  with check ((select public.staff_can('tickets.manage')));

-- who and when are set here, never by the caller
create or replace function public.ticket_macros_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  api boolean := coalesce((select auth.role()), '') in ('anon', 'authenticated');
begin
  if tg_op = 'INSERT' then
    if api then
      new.created_at := now();
      new.created_by := (select auth.uid());
    end if;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  if api then
    new.updated_by := (select auth.uid());
  end if;
  return new;
end;
$$;

-- the audit entry names the macro by its title; its text is never recorded
create or replace function public.ticket_macros_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), 'ticket_macro.create', 'ticket_macro', new.id::text,
            jsonb_build_object('title', new.title, 'active', new.active));
    return null;
  end if;

  if new.active is distinct from old.active then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), case when new.active then 'ticket_macro.restore' else 'ticket_macro.retire' end,
            'ticket_macro', new.id::text, jsonb_build_object('title', new.title));
  end if;
  if new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.set_status is distinct from old.set_status
     or new.set_priority is distinct from old.set_priority
     or new.set_category is distinct from old.set_category
  then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), 'ticket_macro.update', 'ticket_macro', new.id::text,
            jsonb_build_object('title', new.title, 'text_changed', new.body is distinct from old.body));
  end if;
  return null;
end;
$$;

drop trigger if exists ticket_macros_before_write on public.ticket_macros;
create trigger ticket_macros_before_write
  before insert or update on public.ticket_macros
  for each row execute function public.ticket_macros_before_write();

drop trigger if exists ticket_macros_after_write on public.ticket_macros;
create trigger ticket_macros_after_write
  after insert or update on public.ticket_macros
  for each row execute function public.ticket_macros_after_write();

revoke all on function public.ticket_macros_before_write() from public, anon, authenticated;
revoke all on function public.ticket_macros_after_write() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- ticket_rules
-- `position` is the order (lowest first; ties by age). It is set here on
-- insert and changed only by ticket_rule_move(): no API role may write it.
-- `assign_to` falls back to empty if the staff row is ever deleted in SQL; a
-- rule left with nothing to do is skipped.
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_rules (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  updated_by    uuid,
  position      integer not null default 0,
  name          text not null,
  -- empty means "any"
  when_category text,
  when_priority text,
  assign_to     uuid references public.staff (user_id) on delete set null,
  set_priority  text,
  active        boolean not null default true,
  constraint ticket_rules_name_valid check (
    char_length(name) between 1 and 80 and char_length(btrim(name)) >= 1 and name !~ '[\u0001-\u001F\u007F]'
  ),
  constraint ticket_rules_when_category_valid check (when_category is null or when_category in (
    'account', 'platform', 'funding', 'technical', 'complaint', 'privacy', 'security', 'other'
  )),
  constraint ticket_rules_when_priority_valid check (when_priority is null or when_priority in ('low', 'normal', 'high', 'urgent')),
  constraint ticket_rules_set_priority_valid check (set_priority is null or set_priority in ('low', 'normal', 'high', 'urgent'))
);
comment on table public.ticket_rules is 'Ordered rules that assign or prioritise a ticket as it arrives from the website. First active match wins.';

alter table public.ticket_rules enable row level security;
alter table public.ticket_rules force row level security;
revoke all on table public.ticket_rules from public, anon, authenticated;

create index if not exists ticket_rules_order_idx on public.ticket_rules (position, created_at, id);

grant select on public.ticket_rules to authenticated;
grant insert (name, when_category, when_priority, assign_to, set_priority, active) on public.ticket_rules to authenticated;
grant update (name, when_category, when_priority, assign_to, set_priority, active) on public.ticket_rules to authenticated;
-- no DELETE for anyone: a rule is switched off (active = false)

drop policy if exists ticket_rules_manage_select on public.ticket_rules;
create policy ticket_rules_manage_select on public.ticket_rules
  for select
  to authenticated
  using ((select public.staff_can('tickets.manage')));

drop policy if exists ticket_rules_manage_insert on public.ticket_rules;
create policy ticket_rules_manage_insert on public.ticket_rules
  for insert
  to authenticated
  with check ((select public.staff_can('tickets.manage')));

drop policy if exists ticket_rules_manage_update on public.ticket_rules;
create policy ticket_rules_manage_update on public.ticket_rules
  for update
  to authenticated
  using ((select public.staff_can('tickets.manage')))
  with check ((select public.staff_can('tickets.manage')));

-- Internal: may this person be given tickets right now?
create or replace function public.ticket_assignee_ok(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff s
    join public.role_capabilities rc on rc.role = s.role and rc.capability = 'tickets.write'
    where s.user_id = p_user and s.active
  );
$$;

-- The people a rule may name, for the rules screen.
create or replace function public.ticket_assignees()
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, s.display_name
  from public.staff s
  where (select public.staff_can('tickets.manage'))
    and s.active
    and exists (select 1 from public.role_capabilities rc where rc.role = s.role and rc.capability = 'tickets.write')
  order by s.display_name;
$$;

create or replace function public.ticket_rules_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  api boolean := coalesce((select auth.role()), '') in ('anon', 'authenticated');
begin
  if tg_op = 'INSERT' then
    if api then
      new.created_at := now();
      new.created_by := (select auth.uid());
    end if;
    -- a new rule goes to the end of the list
    if api or new.position <= 0 then
      new.position := coalesce((select max(r.position) from public.ticket_rules r), 0) + 1;
    end if;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  if api then
    new.updated_by := (select auth.uid());
  end if;

  -- What a rule does is checked when a person sets it, not when the order
  -- changes or when a staff row disappears underneath it.
  if api and (
       tg_op = 'INSERT'
       or new.assign_to is distinct from old.assign_to
       or new.set_priority is distinct from old.set_priority
       or (new.active and not old.active)
     )
  then
    if new.assign_to is null and new.set_priority is null then
      raise exception 'a rule must assign the ticket or set its priority' using errcode = '22023';
    end if;
    if new.assign_to is not null and not public.ticket_assignee_ok(new.assign_to) then
      raise exception 'that person cannot be given tickets' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.ticket_rules_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), 'ticket_rule.create', 'ticket_rule', new.id::text,
            jsonb_strip_nulls(jsonb_build_object(
              'name', new.name, 'when_category', new.when_category, 'when_priority', new.when_priority,
              'assign_to', new.assign_to, 'set_priority', new.set_priority, 'active', new.active)));
    return null;
  end if;

  if new.active is distinct from old.active then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), case when new.active then 'ticket_rule.on' else 'ticket_rule.off' end,
            'ticket_rule', new.id::text, jsonb_build_object('name', new.name));
  end if;
  if new.name is distinct from old.name
     or new.when_category is distinct from old.when_category
     or new.when_priority is distinct from old.when_priority
     or new.assign_to is distinct from old.assign_to
     or new.set_priority is distinct from old.set_priority
  then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), 'ticket_rule.update', 'ticket_rule', new.id::text,
            jsonb_strip_nulls(jsonb_build_object(
              'name', new.name, 'when_category', new.when_category, 'when_priority', new.when_priority,
              'assign_to', new.assign_to, 'set_priority', new.set_priority)));
  end if;
  -- a change of position alone is recorded by ticket_rule_move()
  return null;
end;
$$;

drop trigger if exists ticket_rules_before_write on public.ticket_rules;
create trigger ticket_rules_before_write
  before insert or update on public.ticket_rules
  for each row execute function public.ticket_rules_before_write();

drop trigger if exists ticket_rules_after_write on public.ticket_rules;
create trigger ticket_rules_after_write
  after insert or update on public.ticket_rules
  for each row execute function public.ticket_rules_after_write();

-- Move a rule one place up or down. Returns false when it is already at that
-- end of the list. The list is renumbered 1..n first, so positions never tie.
create or replace function public.ticket_rule_move(p_id uuid, p_up boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cur   integer;
  dest  integer;
  other uuid;
begin
  if not (select public.staff_can('tickets.manage')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  -- one move at a time: two people reordering must not interleave
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('gio4x.ticket_rules.order'));

  update public.ticket_rules r
  set position = o.rn
  from (
    select x.id, (row_number() over (order by x.position, x.created_at, x.id))::integer as rn
    from public.ticket_rules x
  ) o
  where o.id = r.id and r.position is distinct from o.rn;

  select r.position into cur from public.ticket_rules r where r.id = p_id;
  if cur is null then
    raise exception 'rule not found' using errcode = 'P0002';
  end if;
  dest := cur + case when coalesce(p_up, true) then -1 else 1 end;

  select r.id into other from public.ticket_rules r where r.position = dest;
  if other is null then
    return false;
  end if;

  update public.ticket_rules set position = dest where id = p_id;
  update public.ticket_rules set position = cur where id = other;

  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values ((select auth.uid()), 'ticket_rule.move', 'ticket_rule', p_id::text,
          jsonb_build_object('from', cur, 'to', dest));
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Applying the rules to a ticket that has just arrived. See the header for why
-- this is an AFTER trigger and why it can never refuse the insert.
-- ---------------------------------------------------------------------------
create or replace function public.tickets_rules_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r        record;
  trying   uuid;
begin
  begin
    -- only what the website sends: an API role, open, and nobody holding it
    if coalesce((select auth.role()), '') not in ('anon', 'authenticated')
       or new.assigned_to is not null
       or new.status <> 'open'
    then
      return null;
    end if;

    for r in
      select tr.id, tr.name, tr.assign_to, tr.set_priority
      from public.ticket_rules tr
      where tr.active
        and (tr.when_category is null or tr.when_category = new.category)
        and (tr.when_priority is null or tr.when_priority = new.priority)
      order by tr.position, tr.created_at, tr.id
    loop
      trying := r.id;
      -- nothing to do, or the person named cannot be given tickets right now: try the next rule
      continue when r.assign_to is null and r.set_priority is null;
      continue when r.assign_to is not null and not public.ticket_assignee_ok(r.assign_to);

      update public.tickets t
      set assigned_to = coalesce(r.assign_to, t.assigned_to),
          priority = coalesce(r.set_priority, t.priority)
      where t.id = new.id;

      insert into public.audit_log (actor, action, entity, entity_id, detail)
      values (null, 'ticket.rule', 'ticket', new.id::text,
              jsonb_strip_nulls(jsonb_build_object(
                'reference', new.reference, 'rule_id', r.id, 'rule', r.name,
                'assigned_to', r.assign_to, 'priority', r.set_priority)));
      exit; -- first match wins
    end loop;
  exception when others then
    -- Everything the block did is undone; the ticket itself is untouched.
    -- Say that it happened, if even that is possible.
    begin
      insert into public.audit_log (actor, action, entity, entity_id, detail)
      values (null, 'ticket.rule_failed', 'ticket', new.id::text,
              jsonb_strip_nulls(jsonb_build_object('reference', new.reference, 'rule_id', trying, 'code', sqlstate)));
    exception when others then
      null;
    end;
  end;
  return null;
end;
$$;

drop trigger if exists tickets_rules_after_insert on public.tickets;
create trigger tickets_rules_after_insert
  after insert on public.tickets
  for each row execute function public.tickets_rules_after_insert();

-- ---------------------------------------------------------------------------
-- Reply-time targets and escalation
-- ---------------------------------------------------------------------------
alter table public.tickets add column if not exists escalated_at timestamptz;
comment on column public.tickets.escalated_at is 'When a member of staff escalated the ticket for being past its first-reply target. Set only by ticket_escalate().';

-- Internal targets in hours. Must equal TICKET_TARGET_HOURS in
-- src/lib/server/constants.ts and the hours in command_summary() (0009).
create or replace function public.ticket_target_hours(p_priority text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_priority when 'urgent' then 2 when 'high' then 8 when 'normal' then 24 else 72 end;
$$;

-- Open tickets with no first reply that are past their target, the latest
-- first. The same definition as "late" in command_summary(). Empty for a
-- caller without tickets.read.
create or replace function public.tickets_overdue()
returns table (
  id uuid, reference text, created_at timestamptz, name text, email text, category text, subject text,
  status text, priority text, assigned_to uuid, first_response_at timestamptz, last_customer_at timestamptz,
  escalated_at timestamptz, target_hours integer, due_at timestamptz, hours_overdue numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id, t.reference, t.created_at, t.name, t.email, t.category, t.subject,
    t.status, t.priority, t.assigned_to, t.first_response_at, t.last_customer_at,
    t.escalated_at,
    public.ticket_target_hours(t.priority),
    t.created_at + make_interval(hours => public.ticket_target_hours(t.priority)),
    round((extract(epoch from (now() - (t.created_at + make_interval(hours => public.ticket_target_hours(t.priority))))) / 3600.0)::numeric, 1)
  from public.tickets t
  where (select public.staff_can('tickets.read'))
    and t.status = 'open'
    and t.first_response_at is null
    and now() > t.created_at + make_interval(hours => public.ticket_target_hours(t.priority))
  order by (t.created_at + make_interval(hours => public.ticket_target_hours(t.priority))), t.created_at;
$$;

-- Escalate one late ticket: priority up one step (low, normal, high, urgent),
-- the time stamped, the act recorded. Once per ticket.
--   'escalated'  the priority was raised
--   'flagged'    it was already urgent: stamped and recorded, priority unchanged
--   'already'    it has been escalated before; nothing changed
--   'not_late'   it is not past its target (answered, not open, or still in time); nothing changed
--   'not_found'  no such ticket
create or replace function public.ticket_escalate(p_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor  uuid := (select auth.uid());
  t      public.tickets%rowtype;
  due    timestamptz;
  raised text;
begin
  if actor is null or not (select public.staff_can('tickets.write')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select * into t from public.tickets where id = p_id for update;
  if not found then
    return 'not_found';
  end if;
  if t.escalated_at is not null then
    return 'already';
  end if;

  due := t.created_at + make_interval(hours => public.ticket_target_hours(t.priority));
  if t.status <> 'open' or t.first_response_at is not null or now() <= due then
    return 'not_late';
  end if;

  raised := case t.priority when 'low' then 'normal' when 'normal' then 'high' else 'urgent' end;

  -- the priority change itself is recorded by tickets_after_update (0007)
  update public.tickets set priority = raised, escalated_at = now() where id = p_id;

  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (actor, 'ticket.escalate', 'ticket', p_id::text,
          jsonb_build_object(
            'reference', t.reference, 'from', t.priority, 'to', raised,
            'hours_overdue', round((extract(epoch from (now() - due)) / 3600.0)::numeric, 1)));

  return case when raised = t.priority then 'flagged' else 'escalated' end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
-- triggers and internal helpers: not callable through the API
revoke all on function public.ticket_rules_before_write() from public, anon, authenticated;
revoke all on function public.ticket_rules_after_write() from public, anon, authenticated;
revoke all on function public.tickets_rules_after_insert() from public, anon, authenticated;
revoke all on function public.ticket_assignee_ok(uuid) from public, anon, authenticated;
revoke all on function public.ticket_target_hours(text) from public, anon, authenticated;

revoke all on function public.ticket_assignees() from public, anon;
revoke all on function public.ticket_rule_move(uuid, boolean) from public, anon;
revoke all on function public.tickets_overdue() from public, anon;
revoke all on function public.ticket_escalate(uuid) from public, anon;
grant execute on function public.ticket_assignees() to authenticated;
grant execute on function public.ticket_rule_move(uuid, boolean) to authenticated;
grant execute on function public.tickets_overdue() to authenticated;
grant execute on function public.ticket_escalate(uuid) to authenticated;

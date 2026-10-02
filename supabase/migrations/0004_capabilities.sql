-- =============================================================================
-- GIO4X · 0004_capabilities · roles by capability, staff management, four eyes
-- -----------------------------------------------------------------------------
-- Apply after 0003. Re-runnable.
--
-- What changes
--   1. Roles. `staff.role` gains the roles a brokerage back office needs. What
--      a role may DO is no longer written into each policy as a list of role
--      names: it is a row in `role_capabilities`, and policies ask
--      `staff_can('leads.write')`. A later module adds its capabilities with an
--      INSERT, not by rewriting policies.
--   2. Deactivation. A member of staff can be switched off (`active = false`)
--      without deleting the row, so their name stays on the notes and audit
--      entries they wrote. An inactive row grants nothing.
--   3. Staff management through the console, without a privileged key. Changes
--      to staff are REQUESTS (`staff_changes`). A request is applied when a
--      second person holding `staff.manage` approves it. Nobody can approve
--      their own request or a request about themselves.
--
-- The one exception to four eyes, stated plainly: when no other active manager
-- exists apart from the requester and the person the request is about, there is
-- nobody who could approve, so the request is applied at once and marked
-- `unreviewed`. That is how the first colleague is added, and how one of two
-- admins can still remove the other. Every such case is visible in the audit
-- log and on the Staff page.
--
-- Behaviour kept exactly as before for the three existing roles:
--   admin   everything
--   agent   read enquiries, subscribers and the audit log; change status, take
--           or release an enquiry, add notes
--   viewer  read only
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

-- ---------------------------------------------------------------------------
-- staff: more roles, and an on/off switch.
-- ---------------------------------------------------------------------------
alter table public.staff drop constraint if exists staff_role_valid;
alter table public.staff add constraint staff_role_valid check (
  role in ('admin', 'compliance', 'finance', 'dealing', 'support', 'sales', 'agent', 'viewer')
);
alter table public.staff add column if not exists active boolean not null default true;
alter table public.staff add column if not exists updated_at timestamptz not null default now();
comment on table public.staff is 'GIO4X Control staff and roles. Changed only through the staff_* functions (four eyes) or in SQL by the owner; never writable through the API.';

-- ---------------------------------------------------------------------------
-- role_capabilities: what each role may do. No API role can read or write this
-- table; it is consulted only by the SECURITY DEFINER helpers below.
-- ---------------------------------------------------------------------------
create table if not exists public.role_capabilities (
  role       text not null,
  capability text not null,
  primary key (role, capability),
  constraint role_capabilities_role_valid check (
    role in ('admin', 'compliance', 'finance', 'dealing', 'support', 'sales', 'agent', 'viewer')
  ),
  constraint role_capabilities_capability_valid check (capability ~ '^[a-z_]{1,30}\.[a-z_]{1,30}$')
);
comment on table public.role_capabilities is 'Which role holds which capability. Changed by migrations only.';

alter table public.role_capabilities enable row level security;
alter table public.role_capabilities force row level security;
revoke all on table public.role_capabilities from public, anon, authenticated;

insert into public.role_capabilities (role, capability) values
  -- admin: everything
  ('admin', 'leads.read'), ('admin', 'leads.write'), ('admin', 'leads.assign'), ('admin', 'tasks.write'),
  ('admin', 'subscribers.read'), ('admin', 'subscribers.export'),
  ('admin', 'audit.read'), ('admin', 'staff.read'), ('admin', 'staff.manage'),
  -- agent (the original generalist): unchanged
  ('agent', 'leads.read'), ('agent', 'leads.write'), ('agent', 'tasks.write'),
  ('agent', 'subscribers.read'), ('agent', 'audit.read'),
  -- sales and support work enquiries
  ('sales', 'leads.read'), ('sales', 'leads.write'), ('sales', 'tasks.write'),
  ('sales', 'subscribers.read'), ('sales', 'audit.read'),
  ('support', 'leads.read'), ('support', 'leads.write'), ('support', 'tasks.write'), ('support', 'audit.read'),
  -- compliance reads everything, including who is on staff, and changes nothing
  ('compliance', 'leads.read'), ('compliance', 'subscribers.read'), ('compliance', 'audit.read'), ('compliance', 'staff.read'),
  -- finance and dealing: their own modules arrive with later migrations
  ('finance', 'audit.read'),
  ('dealing', 'audit.read'),
  -- viewer: unchanged
  ('viewer', 'leads.read'), ('viewer', 'subscribers.read'), ('viewer', 'audit.read')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Helpers. An inactive staff row counts as no staff row.
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s where s.user_id = (select auth.uid()) and s.active
  );
$$;

create or replace function public.staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.role from public.staff s where s.user_id = (select auth.uid()) and s.active;
$$;

-- true when the caller is active staff and their role holds the capability
create or replace function public.staff_can(cap text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff s
    join public.role_capabilities rc on rc.role = s.role
    where s.user_id = (select auth.uid()) and s.active and rc.capability = cap
  );
$$;

-- everything the caller may do, for the console to decide what to show
create or replace function public.my_capabilities()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(rc.capability order by rc.capability), '{}'::text[])
  from public.staff s
  join public.role_capabilities rc on rc.role = s.role
  where s.user_id = (select auth.uid()) and s.active;
$$;

-- Names for display (who is assigned, who wrote a note). Includes people who
-- have since been switched off, because their names are still on old records.
create or replace function public.staff_directory()
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, s.display_name
  from public.staff s
  where exists (select 1 from public.staff me where me.user_id = (select auth.uid()) and me.active)
  order by s.display_name;
$$;

-- The staff list with sign-in addresses, for people who may see it.
create or replace function public.staff_list()
returns table (
  user_id uuid, email text, role text, display_name text, active boolean,
  created_at timestamptz, last_sign_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, u.email::text, s.role, s.display_name, s.active, s.created_at, u.last_sign_in_at
  from public.staff s
  join auth.users u on u.id = s.user_id
  where (select public.staff_can('staff.read'))
  order by s.active desc, s.display_name;
$$;

create or replace function public.record_subscriber_export(row_count integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not (select public.staff_can('subscribers.export')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (
    (select auth.uid()),
    'subscribers.export',
    'newsletter_subscribers',
    null,
    jsonb_build_object('rows', greatest(coalesce(row_count, 0), 0))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- staff_changes: requests to add or change a member of staff.
-- `target` is an Auth user id. `target_email` is a snapshot taken when the
-- request was made, so the request is readable before the person is on staff.
-- No API role can write this table; rows come from the functions below.
-- ---------------------------------------------------------------------------
create table if not exists public.staff_changes (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  kind         text not null,
  target       uuid not null references auth.users (id) on delete cascade,
  target_email text not null,
  role         text not null,
  display_name text not null,
  active       boolean not null,
  requested_by uuid not null,
  status       text not null default 'pending',
  decided_by   uuid,
  decided_at   timestamptz,
  unreviewed   boolean not null default false,
  constraint staff_changes_kind_valid check (kind in ('grant', 'change')),
  constraint staff_changes_role_valid check (
    role in ('admin', 'compliance', 'finance', 'dealing', 'support', 'sales', 'agent', 'viewer')
  ),
  constraint staff_changes_display_name_valid check (
    char_length(display_name) between 1 and 80 and display_name !~ '[\u0001-\u001F\u007F]'
  ),
  constraint staff_changes_email_valid check (char_length(target_email) between 3 and 254),
  constraint staff_changes_status_valid check (status in ('pending', 'applied', 'rejected', 'cancelled')),
  constraint staff_changes_decided check ((status = 'pending') = (decided_at is null)),
  -- nobody decides a request about themselves, or requests one
  constraint staff_changes_not_self check (target <> requested_by and (decided_by is null or status = 'cancelled' or decided_by <> target or unreviewed)),
  -- four eyes: an applied or rejected request was decided by somebody else,
  -- unless it is marked as applied with no second manager available
  constraint staff_changes_four_eyes check (
    status in ('pending', 'cancelled') or unreviewed or decided_by is distinct from requested_by
  )
);
comment on table public.staff_changes is 'Requests to grant or change staff access, and who decided them. Written only by the staff_* functions.';

alter table public.staff_changes enable row level security;
alter table public.staff_changes force row level security;
revoke all on table public.staff_changes from public, anon, authenticated;

-- one open request per person at a time
create unique index if not exists staff_changes_one_pending on public.staff_changes (target) where status = 'pending';
create index if not exists staff_changes_created_at_idx on public.staff_changes (created_at desc);

-- ---------------------------------------------------------------------------
-- Internal: apply a pending request. Not callable through the API.
-- ---------------------------------------------------------------------------
create or replace function public.staff_change_apply(p_change uuid, p_decider uuid, p_unreviewed boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.staff_changes%rowtype;
begin
  select * into c from public.staff_changes where id = p_change and status = 'pending' for update;
  if not found then
    raise exception 'request not found or already decided' using errcode = 'P0002';
  end if;

  if c.kind = 'grant' then
    insert into public.staff (user_id, role, display_name, active)
    values (c.target, c.role, c.display_name, c.active);
  else
    update public.staff
    set role = c.role, display_name = c.display_name, active = c.active, updated_at = now()
    where user_id = c.target;
    if not found then
      raise exception 'that person is no longer on staff' using errcode = 'P0002';
    end if;
  end if;

  -- the console must never be left without somebody who can manage staff
  if not exists (
    select 1 from public.staff s
    join public.role_capabilities rc on rc.role = s.role and rc.capability = 'staff.manage'
    where s.active
  ) then
    raise exception 'this would leave nobody able to manage staff' using errcode = '23514';
  end if;

  update public.staff_changes
  set status = 'applied', decided_by = p_decider, decided_at = now(), unreviewed = p_unreviewed
  where id = p_change;

  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (p_decider, 'staff.apply', 'staff_change', p_change::text,
          jsonb_build_object('target', c.target, 'kind', c.kind, 'role', c.role, 'active', c.active, 'unreviewed', p_unreviewed));
end;
$$;

-- ---------------------------------------------------------------------------
-- Internal: record a request, and apply it at once only when nobody else could
-- approve it. Not callable through the API.
-- ---------------------------------------------------------------------------
create or replace function public.staff_change_submit(
  p_kind text, p_target uuid, p_email text, p_role text, p_display_name text, p_active boolean
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor  uuid := (select auth.uid());
  cid    uuid;
  others integer;
begin
  if actor is null or not (select public.staff_can('staff.manage')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_target = actor then
    raise exception 'you cannot change your own access' using errcode = '42501';
  end if;

  -- serialise staff changes: the "is anybody else able to approve" count below
  -- must not race with another request being applied
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('gio4x.staff.changes'));

  insert into public.staff_changes (kind, target, target_email, role, display_name, active, requested_by)
  values (p_kind, p_target, p_email, p_role, btrim(p_display_name), p_active, actor)
  returning id into cid;

  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (actor, 'staff.request', 'staff_change', cid::text,
          jsonb_build_object('target', p_target, 'kind', p_kind, 'role', p_role, 'active', p_active));

  select count(*) into others
  from public.staff s
  join public.role_capabilities rc on rc.role = s.role and rc.capability = 'staff.manage'
  where s.active and s.user_id not in (actor, p_target);

  if others = 0 then
    perform public.staff_change_apply(cid, actor, true);
  end if;

  return cid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Callable by staff holding staff.manage.
-- ---------------------------------------------------------------------------

-- Give an existing Auth user access to the console. The account itself is
-- created in Supabase Authentication first: this application holds no key that
-- could create one.
create or replace function public.staff_propose_grant(p_email text, p_role text, p_display_name text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target uuid;
  found_email text;
begin
  if not (select public.staff_can('staff.manage')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select u.id, u.email::text into target, found_email
  from auth.users u
  where lower(u.email::text) = lower(btrim(p_email))
  limit 1;
  if target is null then
    raise exception 'no account with that address' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.staff s where s.user_id = target) then
    raise exception 'that person is already on staff' using errcode = '23505';
  end if;

  return public.staff_change_submit('grant', target, found_email, p_role, p_display_name, true);
end;
$$;

create or replace function public.staff_propose_change(p_user uuid, p_role text, p_display_name text, p_active boolean)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.staff%rowtype;
  found_email text;
begin
  if not (select public.staff_can('staff.manage')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select * into s from public.staff where user_id = p_user;
  if not found then
    raise exception 'that person is not on staff' using errcode = 'P0002';
  end if;
  if s.role = p_role and s.display_name = btrim(p_display_name) and s.active = p_active then
    raise exception 'nothing to change' using errcode = '22023';
  end if;

  select u.email::text into found_email from auth.users u where u.id = p_user;

  return public.staff_change_submit('change', p_user, coalesce(found_email, 'unknown'), p_role, p_display_name, p_active);
end;
$$;

create or replace function public.staff_decide(p_change uuid, p_approve boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  c     public.staff_changes%rowtype;
begin
  if actor is null or not (select public.staff_can('staff.manage')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('gio4x.staff.changes'));

  select * into c from public.staff_changes where id = p_change and status = 'pending' for update;
  if not found then
    raise exception 'request not found or already decided' using errcode = 'P0002';
  end if;
  if c.requested_by = actor or c.target = actor then
    raise exception 'a request is decided by somebody other than the requester and the person it is about'
      using errcode = '42501';
  end if;

  if p_approve then
    perform public.staff_change_apply(p_change, actor, false);
  else
    update public.staff_changes
    set status = 'rejected', decided_by = actor, decided_at = now()
    where id = p_change;
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (actor, 'staff.reject', 'staff_change', p_change::text, jsonb_build_object('target', c.target, 'kind', c.kind));
  end if;
end;
$$;

-- The requester withdraws their own pending request.
create or replace function public.staff_cancel(p_change uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  c     public.staff_changes%rowtype;
begin
  if actor is null or not (select public.staff_can('staff.manage')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select * into c from public.staff_changes where id = p_change and status = 'pending' for update;
  if not found then
    raise exception 'request not found or already decided' using errcode = 'P0002';
  end if;
  if c.requested_by <> actor then
    raise exception 'only the requester can withdraw a request' using errcode = '42501';
  end if;

  update public.staff_changes
  set status = 'cancelled', decided_by = actor, decided_at = now()
  where id = p_change;
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (actor, 'staff.cancel', 'staff_change', p_change::text, jsonb_build_object('target', c.target, 'kind', c.kind));
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers that name roles: move them to capabilities.
-- ---------------------------------------------------------------------------
create or replace function public.leads_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  new.updated_at := now();

  if actor is not null
     and new.assigned_to is distinct from old.assigned_to
     and new.assigned_to is not null
     and new.assigned_to <> actor
     and not (select public.staff_can('leads.assign'))
  then
    raise exception 'Only an admin may assign a lead to another member of staff'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.staff_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), 'staff.grant', 'staff', new.user_id::text,
            jsonb_build_object('role', new.role, 'display_name', new.display_name));
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role
       or new.display_name is distinct from old.display_name
       or new.active is distinct from old.active
    then
      insert into public.audit_log (actor, action, entity, entity_id, detail)
      values ((select auth.uid()), 'staff.change', 'staff', new.user_id::text,
              jsonb_build_object('role_from', old.role, 'role_to', new.role,
                                 'display_name_from', old.display_name, 'display_name_to', new.display_name,
                                 'active_from', old.active, 'active_to', new.active));
    end if;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), 'staff.revoke', 'staff', old.user_id::text,
            jsonb_build_object('role', old.role, 'display_name', old.display_name));
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges.
-- ---------------------------------------------------------------------------
revoke all on function public.staff_can(text) from public, anon;
revoke all on function public.my_capabilities() from public, anon;
revoke all on function public.staff_list() from public, anon;
revoke all on function public.staff_propose_grant(text, text, text) from public, anon;
revoke all on function public.staff_propose_change(uuid, text, text, boolean) from public, anon;
revoke all on function public.staff_decide(uuid, boolean) from public, anon;
revoke all on function public.staff_cancel(uuid) from public, anon;
grant execute on function public.staff_can(text) to authenticated;
grant execute on function public.my_capabilities() to authenticated;
grant execute on function public.staff_list() to authenticated;
grant execute on function public.staff_propose_grant(text, text, text) to authenticated;
grant execute on function public.staff_propose_change(uuid, text, text, boolean) to authenticated;
grant execute on function public.staff_decide(uuid, boolean) to authenticated;
grant execute on function public.staff_cancel(uuid) to authenticated;

-- internal: reachable only from the functions above
revoke all on function public.staff_change_apply(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.staff_change_submit(text, uuid, text, text, text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and policies.
-- ---------------------------------------------------------------------------
grant select on public.staff_changes to authenticated;

drop policy if exists staff_changes_select on public.staff_changes;
create policy staff_changes_select on public.staff_changes
  for select
  to authenticated
  using ((select public.staff_can('staff.read')));

drop policy if exists leads_staff_select on public.leads;
create policy leads_staff_select on public.leads
  for select
  to authenticated
  using ((select public.staff_can('leads.read')));

drop policy if exists leads_staff_update on public.leads;
create policy leads_staff_update on public.leads
  for update
  to authenticated
  using ((select public.staff_can('leads.write')))
  with check ((select public.staff_can('leads.write')));

drop policy if exists lead_notes_staff_select on public.lead_notes;
create policy lead_notes_staff_select on public.lead_notes
  for select
  to authenticated
  using ((select public.staff_can('leads.read')));

drop policy if exists lead_notes_staff_insert on public.lead_notes;
create policy lead_notes_staff_insert on public.lead_notes
  for insert
  to authenticated
  with check (
    author = (select auth.uid())
    and (select public.staff_can('leads.write'))
  );

drop policy if exists newsletter_staff_select on public.newsletter_subscribers;
create policy newsletter_staff_select on public.newsletter_subscribers
  for select
  to authenticated
  using ((select public.staff_can('subscribers.read')));

-- Any signed-in user may still read their OWN staff row (the console needs it
-- to learn whether the caller is staff, and whether they are active).
drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.staff_can('staff.read'))
  );

drop policy if exists audit_log_staff_select on public.audit_log;
create policy audit_log_staff_select on public.audit_log
  for select
  to authenticated
  using ((select public.staff_can('audit.read')));

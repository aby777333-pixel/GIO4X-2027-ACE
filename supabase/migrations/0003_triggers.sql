-- =============================================================================
-- GIO4X · 0003_triggers · throttles, timestamps, audit trail, append-only guard
-- -----------------------------------------------------------------------------
-- All trigger functions are SECURITY DEFINER with an empty search_path, owned
-- by the migration role (see the guard in 0002). EXECUTE is revoked from every
-- API role: they are reachable only as triggers, never as RPC.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Database-side throttle for the public insert paths.
--
-- Why it exists: the API has a per-IP limiter, but it lives in the memory of a
-- serverless instance (short-lived, one per instance), and the publishable key
-- is public by design, so anyone can call PostgREST directly and skip the API
-- altogether. This trigger is the limit that cannot be skipped.
--
-- What it does
--   · global circuit breaker: at most 30 rows per minute per table
--   · leads only: at most 3 rows per e-mail address per hour
--
-- Trade-offs, stated plainly
--   · The global breaker is shared by everyone. A flood from one source makes
--     the form unavailable to all visitors for up to a minute (they are asked
--     to try again shortly or to write to info@gio4x.com). That is the intended
--     failure mode: a short, visible outage of one form instead of an unbounded
--     table. It is not a substitute for per-client limiting at the edge or a
--     challenge (Turnstile); see docs/SECURITY.md for the next steps.
--   · The database cannot see the caller's IP address in a trustworthy way, so
--     there is no per-IP rule here.
--   · A transaction-level advisory lock serialises the count-then-insert so two
--     concurrent requests cannot both pass on the last free slot. Inserts are a
--     few milliseconds, and the ceiling is 30 a minute, so the queue is short.
--   · The error uses SQLSTATE PT429, which PostgREST turns into HTTP 429.
--
-- Scope: applies to requests arriving through the API roles (anon,
-- authenticated). Statements run directly in SQL by the owner (imports,
-- corrections) carry no API role claim and are not throttled.
--
-- The same triggers stamp created_at / updated_at with the database clock, so a
-- caller can never back-date a row to slip under the window.
-- ---------------------------------------------------------------------------
create or replace function public.leads_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_all  integer;
  recent_same integer;
begin
  if coalesce((select auth.role()), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  new.created_at := now();
  new.updated_at := now();

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('gio4x.throttle.leads'));

  select count(*) into recent_all
  from public.leads l
  where l.created_at > now() - interval '1 minute';
  if recent_all >= 30 then
    raise exception 'Too many requests' using errcode = 'PT429';
  end if;

  select count(*) into recent_same
  from public.leads l
  where l.email = lower(new.email)
    and l.created_at > now() - interval '1 hour';
  if recent_same >= 3 then
    raise exception 'Too many requests' using errcode = 'PT429';
  end if;

  return new;
end;
$$;

create or replace function public.newsletter_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_all integer;
begin
  if coalesce((select auth.role()), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  new.created_at := now();

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('gio4x.throttle.newsletter'));

  select count(*) into recent_all
  from public.newsletter_subscribers n
  where n.created_at > now() - interval '1 minute';
  if recent_all >= 30 then
    raise exception 'Too many requests' using errcode = 'PT429';
  end if;

  return new;
end;
$$;

drop trigger if exists leads_before_insert on public.leads;
create trigger leads_before_insert
  before insert on public.leads
  for each row execute function public.leads_before_insert();

drop trigger if exists newsletter_before_insert on public.newsletter_subscribers;
create trigger newsletter_before_insert
  before insert on public.newsletter_subscribers
  for each row execute function public.newsletter_before_insert();

-- ---------------------------------------------------------------------------
-- leads: updated_at, the assignment rule, and the audit trail.
--
-- Column privileges already limit staff to status and assigned_to. The rule
-- added here needs the old and the new row, so it cannot be a policy:
--   an agent may take a lead (assign to themselves) or release it (unassign);
--   only an admin may assign a lead to somebody else.
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
     and (select public.staff_role()) is distinct from 'admin'
  then
    raise exception 'Only an admin may assign a lead to another member of staff'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.leads_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (
      (select auth.uid()), 'lead.status', 'lead', new.id::text,
      jsonb_build_object('reference', new.reference, 'from', old.status, 'to', new.status)
    );
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (
      (select auth.uid()), 'lead.assign', 'lead', new.id::text,
      jsonb_build_object('reference', new.reference, 'from', old.assigned_to, 'to', new.assigned_to)
    );
  end if;

  return null;
end;
$$;

drop trigger if exists leads_before_update on public.leads;
create trigger leads_before_update
  before update on public.leads
  for each row execute function public.leads_before_update();

drop trigger if exists leads_after_update on public.leads;
create trigger leads_after_update
  after update on public.leads
  for each row execute function public.leads_after_update();

-- ---------------------------------------------------------------------------
-- lead_notes: record that a note was added (never its text).
-- ---------------------------------------------------------------------------
create or replace function public.lead_notes_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (
    coalesce((select auth.uid()), new.author), 'lead.note', 'lead', new.lead_id::text,
    jsonb_build_object('note_id', new.id)
  );
  return null;
end;
$$;

drop trigger if exists lead_notes_after_insert on public.lead_notes;
create trigger lead_notes_after_insert
  after insert on public.lead_notes
  for each row execute function public.lead_notes_after_insert();

-- ---------------------------------------------------------------------------
-- staff: every grant, role change and removal of access is recorded. These
-- happen in SQL (there is no API path), so the actor is usually null, which
-- the console shows as "Database (SQL)".
-- ---------------------------------------------------------------------------
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
    if new.role is distinct from old.role or new.display_name is distinct from old.display_name then
      insert into public.audit_log (actor, action, entity, entity_id, detail)
      values ((select auth.uid()), 'staff.change', 'staff', new.user_id::text,
              jsonb_build_object('role_from', old.role, 'role_to', new.role,
                                 'display_name_from', old.display_name, 'display_name_to', new.display_name));
    end if;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), 'staff.revoke', 'staff', old.user_id::text,
            jsonb_build_object('role', old.role, 'display_name', old.display_name));
  end if;
  return null;
end;
$$;

drop trigger if exists staff_audit on public.staff;
create trigger staff_audit
  after insert or update or delete on public.staff
  for each row execute function public.staff_audit();

-- ---------------------------------------------------------------------------
-- audit_log is append-only for EVERY role, the table owner included. Removing
-- history (for example under a retention policy) therefore requires someone to
-- disable these triggers deliberately in SQL, which is itself a visible act.
-- ---------------------------------------------------------------------------
create or replace function public.audit_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$$;

drop trigger if exists audit_log_no_change on public.audit_log;
create trigger audit_log_no_change
  before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

drop trigger if exists audit_log_no_truncate on public.audit_log;
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_immutable();

-- ---------------------------------------------------------------------------
-- Trigger functions are not callable by API roles.
-- ---------------------------------------------------------------------------
revoke all on function public.leads_before_insert() from public, anon, authenticated;
revoke all on function public.newsletter_before_insert() from public, anon, authenticated;
revoke all on function public.leads_before_update() from public, anon, authenticated;
revoke all on function public.leads_after_update() from public, anon, authenticated;
revoke all on function public.lead_notes_after_insert() from public, anon, authenticated;
revoke all on function public.staff_audit() from public, anon, authenticated;
revoke all on function public.audit_log_immutable() from public, anon, authenticated;

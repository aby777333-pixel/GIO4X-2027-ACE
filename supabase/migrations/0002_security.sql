-- =============================================================================
-- GIO4X · 0002_security · helper functions, grants, row-level security policies
-- -----------------------------------------------------------------------------
-- Model
--   anon           a visitor (the publishable key with no session)
--   authenticated  a signed-in Supabase Auth user. Being signed in grants
--                  NOTHING by itself: staff access requires a row in
--                  public.staff. A signed-in non-staff user has exactly the
--                  rights of a visitor.
--   staff roles    admin · agent · viewer (public.staff.role)
--
-- Two layers, both required by PostgREST:
--   1. table/column privileges (GRANT)  → which statements a role may attempt
--   2. row-level security policies       → which rows those statements may touch
--
-- SECURITY DEFINER functions here are owned by the migration role. On Supabase
-- that is `postgres`, which has BYPASSRLS, so the helpers can read public.staff
-- and the triggers in 0003 can write public.audit_log even though RLS is FORCED
-- on those tables. The guard below makes that assumption explicit and fails the
-- migration loudly if it does not hold, rather than leaving helpers that
-- silently return "not staff".
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
-- Helper functions. search_path is empty and every name is schema-qualified,
-- so a caller cannot redirect them with a crafted search_path.
-- ---------------------------------------------------------------------------

-- true when the caller has a staff row (any role)
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s where s.user_id = (select auth.uid())
  );
$$;

-- the caller's staff role, or null when the caller is not staff
create or replace function public.staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.role from public.staff s where s.user_id = (select auth.uid());
$$;

-- Names for display in the console (who is assigned, who wrote a note).
-- Returns id + display name only, never roles, and only to staff. The full
-- staff table (including roles) remains readable by admins only.
create or replace function public.staff_directory()
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, s.display_name
  from public.staff s
  where exists (select 1 from public.staff me where me.user_id = (select auth.uid()))
  order by s.display_name;
$$;

-- Records that an admin exported the subscriber list. The console calls this
-- BEFORE it sends the file: no audit entry, no export. The actor is always the
-- caller; nothing but the row count is caller-supplied.
create or replace function public.record_subscriber_export(row_count integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select public.staff_role()) is distinct from 'admin' then
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

-- Functions are executable by PUBLIC by default, and Supabase also grants
-- EXECUTE to anon. Remove both, then grant to signed-in users only.
revoke all on function public.is_staff() from public, anon;
revoke all on function public.staff_role() from public, anon;
revoke all on function public.staff_directory() from public, anon;
revoke all on function public.record_subscriber_export(integer) from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.staff_role() to authenticated;
grant execute on function public.staff_directory() to authenticated;
grant execute on function public.record_subscriber_export(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges. Everything was revoked in 0001; grant exactly what is needed.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

-- (repeat the revokes so this file is correct on its own if re-run)
revoke all on table public.leads, public.lead_notes, public.newsletter_subscribers, public.staff, public.audit_log
  from public, anon, authenticated;

-- leads
--   public: INSERT, and only the columns a visitor legitimately supplies.
--           status / assigned_to / created_at / updated_at are not grantable
--           to a visitor at all, so they always take their defaults.
--   staff:  SELECT (rows limited by policy); UPDATE of status and assigned_to
--           only. No column of the enquiry itself can be edited, and nothing
--           can be deleted, through the API.
grant insert (
  id, reference, name, email, phone, country, topic, message, account_interest,
  page, utm, privacy_accepted_at, privacy_version, marketing_consent, marketing_consent_at
) on public.leads to anon, authenticated;
grant select on public.leads to authenticated;
grant update (status, assigned_to) on public.leads to authenticated;

-- lead_notes: staff read; admin/agent add. `author` is not grantable, so it is
-- always the column default auth.uid(); the policy checks it again.
grant select on public.lead_notes to authenticated;
grant insert (lead_id, body) on public.lead_notes to authenticated;

-- newsletter_subscribers: public INSERT of the consent record; staff read.
-- unsubscribed_at and created_at cannot be supplied by a caller.
grant insert (id, email, source, consent_at, consent_version) on public.newsletter_subscribers to anon, authenticated;
grant select on public.newsletter_subscribers to authenticated;

-- staff, audit_log: read-only through the API (rows limited by policy).
grant select on public.staff to authenticated;
grant select on public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- Policies. No policy = no access (RLS is enabled and forced on every table).
-- auth.uid() and the helpers are wrapped in (select …) so they are evaluated
-- once per statement rather than once per row.
-- ---------------------------------------------------------------------------

-- leads ----------------------------------------------------------------------
drop policy if exists leads_public_insert on public.leads;
create policy leads_public_insert on public.leads
  for insert
  to anon, authenticated
  with check (
    -- server-controlled columns are pinned to their defaults
    status = 'new'
    and assigned_to is null
    -- consent timestamps must be "now", within clock tolerance: a caller cannot
    -- back-date or post-date the evidence
    and privacy_accepted_at between now() - interval '15 minutes' and now() + interval '2 minutes'
    and (marketing_consent_at is null
         or marketing_consent_at between now() - interval '15 minutes' and now() + interval '2 minutes')
  );

drop policy if exists leads_staff_select on public.leads;
create policy leads_staff_select on public.leads
  for select
  to authenticated
  using ((select public.is_staff()));

drop policy if exists leads_staff_update on public.leads;
create policy leads_staff_update on public.leads
  for update
  to authenticated
  using ((select public.staff_role()) in ('admin', 'agent'))
  with check ((select public.staff_role()) in ('admin', 'agent'));

-- lead_notes -----------------------------------------------------------------
drop policy if exists lead_notes_staff_select on public.lead_notes;
create policy lead_notes_staff_select on public.lead_notes
  for select
  to authenticated
  using ((select public.is_staff()));

drop policy if exists lead_notes_staff_insert on public.lead_notes;
create policy lead_notes_staff_insert on public.lead_notes
  for insert
  to authenticated
  with check (
    author = (select auth.uid())
    and (select public.staff_role()) in ('admin', 'agent')
  );

-- newsletter_subscribers -----------------------------------------------------
drop policy if exists newsletter_public_insert on public.newsletter_subscribers;
create policy newsletter_public_insert on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check (
    unsubscribed_at is null
    and consent_at between now() - interval '15 minutes' and now() + interval '2 minutes'
  );

drop policy if exists newsletter_staff_select on public.newsletter_subscribers;
create policy newsletter_staff_select on public.newsletter_subscribers
  for select
  to authenticated
  using ((select public.is_staff()));

-- staff ----------------------------------------------------------------------
-- An admin reads the whole table. Any signed-in user may read their OWN row
-- (the console needs it to learn the caller's role); that reveals nothing the
-- caller is not entitled to know. Nobody reads another person's role unless
-- they are an admin.
drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.staff_role()) = 'admin'
  );

-- audit_log ------------------------------------------------------------------
-- Read by staff. There is deliberately no INSERT, UPDATE or DELETE policy and
-- no such privilege: rows arrive only through SECURITY DEFINER triggers.
drop policy if exists audit_log_staff_select on public.audit_log;
create policy audit_log_staff_select on public.audit_log
  for select
  to authenticated
  using ((select public.is_staff()));

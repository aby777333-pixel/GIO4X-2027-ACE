-- =============================================================================
-- GIO4X · 0006_site · settings the website reads, and incident notices
-- -----------------------------------------------------------------------------
-- Apply after 0005. Re-runnable.
--
-- Two things staff publish to the public website from GIO4X Control:
--
--   site_settings   three small values: an announcement line, whether live chat
--                   may be offered, and the support hours text. The website
--                   reads them through site_public(); staff change them through
--                   site_setting_set(), which validates the shape and writes
--                   the audit entry. No API role can write the table directly.
--
--   incidents       notices for the public Status page, each with a trail of
--                   updates. These are written by people. They are NOT
--                   monitoring: nothing here measures uptime, and the Status
--                   page keeps saying so.
--
-- New capabilities: config.manage (admin), incidents.read (all staff).
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
  ('admin', 'config.manage')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- site_settings
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint site_settings_key_valid check (key in ('announcement', 'chat', 'support')),
  constraint site_settings_value_valid check (jsonb_typeof(value) = 'object' and octet_length(value::text) <= 2048)
);
comment on table public.site_settings is 'Three values the public website reads. Written only by site_setting_set().';

alter table public.site_settings enable row level security;
alter table public.site_settings force row level security;
revoke all on table public.site_settings from public, anon, authenticated;

insert into public.site_settings (key, value) values
  ('announcement', '{"enabled": false, "text": "", "href": "", "tone": "info"}'::jsonb),
  ('chat', '{"enabled": false}'::jsonb),
  ('support', '{"hours": ""}'::jsonb)
on conflict do nothing;

grant select on public.site_settings to authenticated;

drop policy if exists site_settings_staff_select on public.site_settings;
create policy site_settings_staff_select on public.site_settings
  for select
  to authenticated
  using ((select public.is_staff()));

-- What the website may know. Callable by anyone; returns only the three values.
create or replace function public.site_public()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb) from public.site_settings s;
$$;

-- Change one setting. The shape of each value is fixed here, so the website
-- can trust what it reads: unknown keys are dropped, text is bounded, a link
-- must be a same-site path.
create or replace function public.site_setting_set(p_key text, p_value jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  clean jsonb;
  txt   text;
  href  text;
  tone  text;
begin
  if not (select public.staff_can('config.manage')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_value is null or jsonb_typeof(p_value) <> 'object' then
    raise exception 'invalid value' using errcode = '22023';
  end if;

  if p_key = 'announcement' then
    txt := btrim(coalesce(p_value ->> 'text', ''));
    href := btrim(coalesce(p_value ->> 'href', ''));
    tone := coalesce(p_value ->> 'tone', 'info');
    if char_length(txt) > 200 or txt ~ '[\u0001-\u001F\u007F]' then
      raise exception 'invalid text' using errcode = '22023';
    end if;
    if href <> '' and (char_length(href) > 200 or href !~ '^/([^/\\[:space:]][^\\[:space:]]*)?$') then
      raise exception 'invalid link' using errcode = '22023';
    end if;
    if tone not in ('info', 'notice') then
      raise exception 'invalid tone' using errcode = '22023';
    end if;
    clean := jsonb_build_object(
      -- an announcement with no text is never shown
      'enabled', coalesce((p_value ->> 'enabled')::boolean, false) and txt <> '',
      'text', txt, 'href', href, 'tone', tone);
  elsif p_key = 'chat' then
    clean := jsonb_build_object('enabled', coalesce((p_value ->> 'enabled')::boolean, false));
  elsif p_key = 'support' then
    txt := btrim(coalesce(p_value ->> 'hours', ''));
    if char_length(txt) > 120 or txt ~ '[\u0001-\u001F\u007F]' then
      raise exception 'invalid text' using errcode = '22023';
    end if;
    clean := jsonb_build_object('hours', txt);
  else
    raise exception 'unknown setting' using errcode = '22023';
  end if;

  insert into public.site_settings (key, value, updated_at, updated_by)
  values (p_key, clean, now(), (select auth.uid()))
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  -- the audit entry records that it changed and whether it is on, never the text
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values ((select auth.uid()), 'config.set', 'site_setting', p_key,
          case when clean ? 'enabled' then jsonb_build_object('enabled', clean -> 'enabled') else '{}'::jsonb end);
end;
$$;

revoke all on function public.site_public() from public;
grant execute on function public.site_public() to anon, authenticated;
revoke all on function public.site_setting_set(text, jsonb) from public, anon;
grant execute on function public.site_setting_set(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- incidents and their updates
-- A visitor reads published incidents only. Staff holding config.manage write.
-- ---------------------------------------------------------------------------
create table if not exists public.incidents (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  title       text not null,
  component   text not null,
  severity    text not null,
  status      text not null default 'investigating',
  started_at  timestamptz not null default now(),
  resolved_at timestamptz,
  published   boolean not null default false,
  constraint incidents_title_valid check (
    char_length(title) between 1 and 140 and char_length(btrim(title)) >= 1 and title !~ '[\u0001-\u001F\u007F]'
  ),
  -- must equal INCIDENT_COMPONENTS in src/lib/server/constants.ts and the services on /status
  constraint incidents_component_valid check (component in (
    'website', 'client-portal', 'trader-portal', 'ib-portal', 'raptor', 'metatrader-5', 'market-data', 'support'
  )),
  constraint incidents_severity_valid check (severity in ('notice', 'degraded', 'outage', 'maintenance')),
  constraint incidents_status_valid check (status in ('scheduled', 'investigating', 'identified', 'monitoring', 'resolved')),
  constraint incidents_resolved_evidence check ((status = 'resolved') = (resolved_at is not null))
);
comment on table public.incidents is 'Notices for the public Status page, written by staff. Not monitoring.';

create table if not exists public.incident_updates (
  id          bigint generated always as identity primary key,
  incident_id uuid not null references public.incidents (id) on delete cascade,
  created_at  timestamptz not null default now(),
  author      uuid default auth.uid(),
  status      text not null,
  body        text not null,
  constraint incident_updates_status_valid check (status in ('scheduled', 'investigating', 'identified', 'monitoring', 'resolved')),
  constraint incident_updates_body_valid check (
    char_length(body) between 1 and 2000 and char_length(btrim(body)) >= 1 and body !~ '[\u0001-\u0008\u000B-\u001F\u007F]'
  )
);
comment on table public.incident_updates is 'What was said about an incident, and when. Append-only through the API.';

alter table public.incidents enable row level security;
alter table public.incidents force row level security;
alter table public.incident_updates enable row level security;
alter table public.incident_updates force row level security;
revoke all on table public.incidents, public.incident_updates from public, anon, authenticated;

create index if not exists incidents_started_at_idx on public.incidents (started_at desc);
create index if not exists incident_updates_incident_idx on public.incident_updates (incident_id, created_at);

-- the public reads; staff read and (with config.manage) write
grant select on public.incidents, public.incident_updates to anon, authenticated;
grant insert (title, component, severity, status, started_at, published) on public.incidents to authenticated;
grant update (title, component, severity, published) on public.incidents to authenticated;
grant insert (incident_id, status, body) on public.incident_updates to authenticated;

-- A visitor's policy must not call is_staff(): the anonymous role may not
-- execute it, and a policy that calls it would refuse every public read.
drop policy if exists incidents_public_select on public.incidents;
create policy incidents_public_select on public.incidents
  for select
  to anon
  using (published);

drop policy if exists incidents_signed_in_select on public.incidents;
create policy incidents_signed_in_select on public.incidents
  for select
  to authenticated
  using (published or (select public.is_staff()));

drop policy if exists incidents_staff_insert on public.incidents;
create policy incidents_staff_insert on public.incidents
  for insert
  to authenticated
  with check ((select public.staff_can('config.manage')) and created_by = (select auth.uid()) and status <> 'resolved');

drop policy if exists incidents_staff_update on public.incidents;
create policy incidents_staff_update on public.incidents
  for update
  to authenticated
  using ((select public.staff_can('config.manage')))
  with check ((select public.staff_can('config.manage')));

drop policy if exists incident_updates_public_select on public.incident_updates;
create policy incident_updates_public_select on public.incident_updates
  for select
  to anon
  using (exists (select 1 from public.incidents i where i.id = incident_id and i.published));

drop policy if exists incident_updates_signed_in_select on public.incident_updates;
create policy incident_updates_signed_in_select on public.incident_updates
  for select
  to authenticated
  using (
    (select public.is_staff())
    or exists (select 1 from public.incidents i where i.id = incident_id and i.published)
  );

drop policy if exists incident_updates_staff_insert on public.incident_updates;
create policy incident_updates_staff_insert on public.incident_updates
  for insert
  to authenticated
  with check ((select public.staff_can('config.manage')) and author = (select auth.uid()));

-- An incident's status is whatever its latest update says. The update is the
-- only way to move it, so the public trail and the headline can never disagree.
create or replace function public.incidents_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce((select auth.role()), '') in ('anon', 'authenticated') then
      new.created_at := now();
      new.created_by := (select auth.uid());
    end if;
    new.updated_at := now();
    new.resolved_at := null;
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.incidents_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), 'incident.open', 'incident', new.id::text,
            jsonb_build_object('component', new.component, 'severity', new.severity, 'published', new.published));
  elsif new.published is distinct from old.published then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), case when new.published then 'incident.publish' else 'incident.unpublish' end,
            'incident', new.id::text, '{}'::jsonb);
  end if;
  return null;
end;
$$;

create or replace function public.incident_updates_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.incidents
  set status = new.status,
      resolved_at = case when new.status = 'resolved' then now() else null end
  where id = new.incident_id;

  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (coalesce((select auth.uid()), new.author), 'incident.update', 'incident', new.incident_id::text,
          jsonb_build_object('status', new.status));
  return null;
end;
$$;

drop trigger if exists incidents_before_write on public.incidents;
create trigger incidents_before_write
  before insert or update on public.incidents
  for each row execute function public.incidents_before_write();

drop trigger if exists incidents_after_write on public.incidents;
create trigger incidents_after_write
  after insert or update on public.incidents
  for each row execute function public.incidents_after_write();

drop trigger if exists incident_updates_after_insert on public.incident_updates;
create trigger incident_updates_after_insert
  after insert on public.incident_updates
  for each row execute function public.incident_updates_after_insert();

revoke all on function public.incidents_before_write() from public, anon, authenticated;
revoke all on function public.incidents_after_write() from public, anon, authenticated;
revoke all on function public.incident_updates_after_insert() from public, anon, authenticated;

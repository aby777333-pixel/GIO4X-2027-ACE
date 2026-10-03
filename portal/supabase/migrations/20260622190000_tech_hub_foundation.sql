-- Technology Hub (Super Admin console) foundation. Fully ADDITIVE — no existing
-- table/function is altered. Super-admin flag + per-module grants on profiles, a
-- modular module registry (enable/disable), platform settings + kill switches, and
-- an append-only audit log, all gated to super admins via RLS.
alter table public.profiles add column if not exists is_super_admin boolean not null default false;
alter table public.profiles add column if not exists tech_permissions text[];

create or replace function public.tech_is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and coalesce(is_super_admin, false));
$$;

create table if not exists public.tech_modules (
  key text primary key, category text not null, name text not null, description text,
  features jsonb not null default '[]'::jsonb, status text not null default 'available',
  enabled boolean not null default true, icon text, sort integer not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.tech_settings (
  key text primary key, value jsonb not null default '{}'::jsonb, category text not null default 'general',
  updated_by uuid, updated_at timestamptz not null default now()
);
create table if not exists public.tech_audit_log (
  id uuid primary key default gen_random_uuid(), actor_id uuid, actor_email text,
  action text not null, module text, detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists tech_audit_created_idx on public.tech_audit_log (created_at desc);

alter table public.tech_modules   enable row level security;
alter table public.tech_settings  enable row level security;
alter table public.tech_audit_log enable row level security;
drop policy if exists tech_modules_sa  on public.tech_modules;
create policy tech_modules_sa  on public.tech_modules  for all using (public.tech_is_super_admin()) with check (public.tech_is_super_admin());
drop policy if exists tech_settings_sa on public.tech_settings;
create policy tech_settings_sa on public.tech_settings for all using (public.tech_is_super_admin()) with check (public.tech_is_super_admin());
drop policy if exists tech_audit_sa   on public.tech_audit_log;
create policy tech_audit_sa   on public.tech_audit_log for select using (public.tech_is_super_admin());
grant select, insert, update, delete on public.tech_modules   to authenticated;
grant select, insert, update         on public.tech_settings  to authenticated;
grant select                          on public.tech_audit_log to authenticated;

insert into public.tech_settings (key, value, category) values
  ('environment','"production"'::jsonb,'platform'),
  ('maintenance_mode','false'::jsonb,'platform'),
  ('kill_switch_trading','false'::jsonb,'safety'),
  ('kill_switch_api','false'::jsonb,'safety'),
  ('kill_switch_bridges','false'::jsonb,'safety')
on conflict (key) do nothing;

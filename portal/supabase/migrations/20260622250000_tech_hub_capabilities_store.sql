-- Every module capability becomes an editable, persisted, audited record.
create table if not exists public.tech_capabilities (
  id uuid primary key default gen_random_uuid(),
  module_key text not null,
  capability text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid, updated_at timestamptz not null default now(),
  unique (module_key, capability)
);
alter table public.tech_capabilities enable row level security;
drop policy if exists tech_capabilities_sa on public.tech_capabilities;
create policy tech_capabilities_sa on public.tech_capabilities for all using (public.tech_is_super_admin()) with check (public.tech_is_super_admin());
grant select, insert, update, delete on public.tech_capabilities to authenticated;

insert into public.tech_capabilities (module_key, capability)
select key, feature from public.tech_modules, lateral jsonb_array_elements_text(features) as feature
on conflict (module_key, capability) do nothing;

create or replace function public.tech_capabilities_list(p_module text)
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not public.tech_is_super_admin() then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('capability', capability, 'enabled', enabled, 'config', config) order by capability), '[]'::jsonb)
          from public.tech_capabilities where module_key = p_module);
end; $$;

create or replace function public.tech_capability_toggle(p_module text, p_capability text, p_enabled boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v_before boolean;
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  select enabled into v_before from public.tech_capabilities where module_key = p_module and capability = p_capability;
  insert into public.tech_capabilities (module_key, capability, enabled, updated_by, updated_at)
  values (p_module, p_capability, p_enabled, auth.uid(), now())
  on conflict (module_key, capability) do update set enabled = excluded.enabled, updated_by = auth.uid(), updated_at = now();
  perform public.tech_audit_write(case when p_enabled then 'capability.enabled' else 'capability.disabled' end, p_module, jsonb_build_object('capability', p_capability, 'before', v_before, 'after', p_enabled));
  return 'ok';
end; $$;

create or replace function public.tech_capability_config(p_module text, p_capability text, p_config jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare v_before jsonb;
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  select config into v_before from public.tech_capabilities where module_key = p_module and capability = p_capability;
  insert into public.tech_capabilities (module_key, capability, config, updated_by, updated_at)
  values (p_module, p_capability, coalesce(p_config, '{}'::jsonb), auth.uid(), now())
  on conflict (module_key, capability) do update set config = excluded.config, updated_by = auth.uid(), updated_at = now();
  perform public.tech_audit_write('capability.config', p_module, jsonb_build_object('capability', p_capability, 'before', v_before, 'after', p_config));
  return 'ok';
end; $$;

revoke all on function public.tech_capabilities_list(text) from public, anon;
revoke all on function public.tech_capability_toggle(text, text, boolean) from public, anon;
revoke all on function public.tech_capability_config(text, text, jsonb) from public, anon;
grant execute on function public.tech_capabilities_list(text) to authenticated;
grant execute on function public.tech_capability_toggle(text, text, boolean) to authenticated;
grant execute on function public.tech_capability_config(text, text, jsonb) to authenticated;

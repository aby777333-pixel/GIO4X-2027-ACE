-- Audit hardening: IP capture, before/after values, searchable audit. Additive.
alter table public.tech_audit_log add column if not exists ip text;

create or replace function public.tech_audit_write(p_action text, p_module text, p_detail jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_email text; v_ip text;
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  select email into v_email from public.profiles where id = auth.uid();
  begin
    v_ip := nullif(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1), '');
  exception when others then v_ip := null; end;
  insert into public.tech_audit_log (actor_id, actor_email, action, module, detail, ip)
  values (auth.uid(), v_email, p_action, p_module, coalesce(p_detail, '{}'::jsonb), v_ip);
end; $function$;

create or replace function public.tech_module_toggle(p_key text, p_enabled boolean)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare v_before boolean;
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  select enabled into v_before from public.tech_modules where key = p_key;
  update public.tech_modules set enabled = p_enabled, updated_at = now() where key = p_key;
  if not found then raise exception 'unknown module %', p_key; end if;
  perform public.tech_audit_write(case when p_enabled then 'module.enabled' else 'module.disabled' end, p_key, jsonb_build_object('before', v_before, 'after', p_enabled));
  return 'ok';
end; $function$;

create or replace function public.tech_setting_set(p_key text, p_value jsonb)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare v_before jsonb;
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  select value into v_before from public.tech_settings where key = p_key;
  insert into public.tech_settings (key, value, updated_by, updated_at) values (p_key, p_value, auth.uid(), now())
  on conflict (key) do update set value = excluded.value, updated_by = auth.uid(), updated_at = now();
  perform public.tech_audit_write('setting.changed', 'platform', jsonb_build_object('key', p_key, 'before', v_before, 'after', p_value));
  return 'ok';
end; $function$;

create or replace function public.tech_set_super_admin(p_user_id uuid, p_on boolean)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare v_before boolean;
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  if p_user_id = auth.uid() and not p_on then raise exception 'cannot remove your own super-admin access'; end if;
  select is_super_admin into v_before from public.profiles where id = p_user_id;
  update public.profiles set is_super_admin = p_on, updated_at = now() where id = p_user_id;
  perform public.tech_audit_write(case when p_on then 'superadmin.granted' else 'superadmin.revoked' end, 'access', jsonb_build_object('user_id', p_user_id, 'before', coalesce(v_before, false), 'after', p_on));
  return 'ok';
end; $function$;

create or replace function public.tech_flag_set(p_key text, p_enabled boolean)
returns text language plpgsql security definer set search_path = public as $function$
declare v_before boolean;
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  select enabled into v_before from public.feature_flags where key = p_key;
  insert into public.feature_flags (key, enabled) values (p_key, p_enabled) on conflict (key) do update set enabled = excluded.enabled;
  perform public.tech_audit_write('flag.set', 'platform', jsonb_build_object('key', p_key, 'before', v_before, 'after', p_enabled));
  return 'ok';
end; $function$;

create or replace function public.tech_audit_recent(p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not public.tech_is_super_admin() then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(t order by t.created_at desc), '[]'::jsonb)
          from (select actor_email, action, module, detail, ip, created_at
                from public.tech_audit_log order by created_at desc limit least(greatest(p_limit,1), 200)) t);
end; $function$;

create or replace function public.tech_audit_search(p_q text default null, p_limit integer default 150)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not public.tech_is_super_admin() then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(t order by t.created_at desc), '[]'::jsonb)
          from (select id, actor_email, action, module, detail, ip, created_at
                from public.tech_audit_log
                where p_q is null or p_q = ''
                   or action ilike '%'||p_q||'%' or coalesce(module,'') ilike '%'||p_q||'%'
                   or coalesce(actor_email,'') ilike '%'||p_q||'%' or coalesce(ip,'') ilike '%'||p_q||'%'
                   or detail::text ilike '%'||p_q||'%'
                order by created_at desc limit least(greatest(p_limit,1), 500)) t);
end; $function$;
grant execute on function public.tech_audit_search(text, integer) to authenticated;

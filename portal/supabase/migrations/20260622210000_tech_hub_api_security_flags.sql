-- Technology Hub: API keys, security rules, and feature-flag control. Additive;
-- all super-admin gated + audited. (Authoritative bodies live in the DB.)
create table if not exists public.tech_api_keys (
  id uuid primary key default gen_random_uuid(), name text not null, key_prefix text not null,
  key_hash text not null, scopes text[] not null default '{}', rate_limit integer not null default 1000,
  status text not null default 'active', last_used timestamptz, created_by uuid, created_at timestamptz not null default now()
);
alter table public.tech_api_keys enable row level security;
drop policy if exists tech_api_keys_sa on public.tech_api_keys;
create policy tech_api_keys_sa on public.tech_api_keys for all using (public.tech_is_super_admin()) with check (public.tech_is_super_admin());
grant select, insert, update, delete on public.tech_api_keys to authenticated;

create table if not exists public.tech_security_rules (
  id uuid primary key default gen_random_uuid(), kind text not null, value text not null,
  enabled boolean not null default true, note text, created_by uuid, created_at timestamptz not null default now()
);
alter table public.tech_security_rules enable row level security;
drop policy if exists tech_security_sa on public.tech_security_rules;
create policy tech_security_sa on public.tech_security_rules for all using (public.tech_is_super_admin()) with check (public.tech_is_super_admin());
grant select, insert, update, delete on public.tech_security_rules to authenticated;

create or replace function public.tech_api_keys_list() returns jsonb language plpgsql security definer set search_path = public stable as $$
begin if not public.tech_is_super_admin() then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'key_prefix',key_prefix,'scopes',scopes,'rate_limit',rate_limit,'status',status,'last_used',last_used,'created_at',created_at) order by created_at desc),'[]'::jsonb) from public.tech_api_keys);
end; $$;
create or replace function public.tech_api_key_create(p_name text, p_scopes text[], p_rate_limit integer) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_full text; v_prefix text; v_id uuid;
begin if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  if coalesce(p_name,'')='' then raise exception 'name required'; end if;
  v_full := 'gio4x_live_' || encode(gen_random_bytes(24),'hex'); v_prefix := left(v_full,18)||'…';
  insert into public.tech_api_keys (name,key_prefix,key_hash,scopes,rate_limit,created_by)
  values (p_name,v_prefix,encode(digest(v_full,'sha256'),'hex'),coalesce(p_scopes,'{}'),coalesce(p_rate_limit,1000),auth.uid()) returning id into v_id;
  perform public.tech_audit_write('apikey.created','api',jsonb_build_object('id',v_id,'name',p_name));
  return jsonb_build_object('id',v_id,'full_key',v_full,'prefix',v_prefix);
end; $$;
create or replace function public.tech_api_key_set_status(p_id uuid, p_status text) returns text language plpgsql security definer set search_path = public as $$
begin if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  if p_status not in ('active','suspended','revoked') then raise exception 'invalid status'; end if;
  update public.tech_api_keys set status=p_status where id=p_id; if not found then raise exception 'unknown key'; end if;
  perform public.tech_audit_write('apikey.'||p_status,'api',jsonb_build_object('id',p_id)); return 'ok';
end; $$;
create or replace function public.tech_api_key_delete(p_id uuid) returns text language plpgsql security definer set search_path = public as $$
begin if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  delete from public.tech_api_keys where id=p_id; perform public.tech_audit_write('apikey.deleted','api',jsonb_build_object('id',p_id)); return 'ok';
end; $$;

create or replace function public.tech_security_list() returns jsonb language plpgsql security definer set search_path = public stable as $$
begin if not public.tech_is_super_admin() then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'value',value,'enabled',enabled,'note',note,'created_at',created_at) order by kind,created_at),'[]'::jsonb) from public.tech_security_rules);
end; $$;
create or replace function public.tech_security_upsert(p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id','')::uuid;
begin if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  if coalesce(p->>'value','')='' then raise exception 'value required'; end if;
  if v_id is null then insert into public.tech_security_rules (kind,value,note,created_by) values (coalesce(p->>'kind','ip_allow'),p->>'value',nullif(p->>'note',''),auth.uid()) returning id into v_id;
    perform public.tech_audit_write('security.rule_added','security',jsonb_build_object('id',v_id,'kind',p->>'kind','value',p->>'value'));
  else update public.tech_security_rules set kind=coalesce(p->>'kind',kind),value=p->>'value',note=nullif(p->>'note','') where id=v_id;
    perform public.tech_audit_write('security.rule_updated','security',jsonb_build_object('id',v_id)); end if; return v_id;
end; $$;
create or replace function public.tech_security_toggle(p_id uuid, p_enabled boolean) returns text language plpgsql security definer set search_path = public as $$
begin if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  update public.tech_security_rules set enabled=p_enabled where id=p_id;
  perform public.tech_audit_write('security.rule_toggled','security',jsonb_build_object('id',p_id,'enabled',p_enabled)); return 'ok';
end; $$;
create or replace function public.tech_security_delete(p_id uuid) returns text language plpgsql security definer set search_path = public as $$
begin if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  delete from public.tech_security_rules where id=p_id; perform public.tech_audit_write('security.rule_deleted','security',jsonb_build_object('id',p_id)); return 'ok';
end; $$;

create or replace function public.tech_flags_list() returns jsonb language plpgsql security definer set search_path = public stable as $$
begin if not public.tech_is_super_admin() then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('key',key,'enabled',enabled) order by key),'[]'::jsonb) from public.feature_flags);
end; $$;
create or replace function public.tech_flag_set(p_key text, p_enabled boolean) returns text language plpgsql security definer set search_path = public as $$
begin if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  insert into public.feature_flags (key,enabled) values (p_key,p_enabled) on conflict (key) do update set enabled=excluded.enabled;
  perform public.tech_audit_write('flag.set','platform',jsonb_build_object('key',p_key,'enabled',p_enabled)); return 'ok';
end; $$;

grant execute on function public.tech_api_keys_list() to authenticated;
grant execute on function public.tech_api_key_create(text,text[],integer) to authenticated;
grant execute on function public.tech_api_key_set_status(uuid,text) to authenticated;
grant execute on function public.tech_api_key_delete(uuid) to authenticated;
grant execute on function public.tech_security_list() to authenticated;
grant execute on function public.tech_security_upsert(jsonb) to authenticated;
grant execute on function public.tech_security_toggle(uuid,boolean) to authenticated;
grant execute on function public.tech_security_delete(uuid) to authenticated;
grant execute on function public.tech_flags_list() to authenticated;
grant execute on function public.tech_flag_set(text,boolean) to authenticated;

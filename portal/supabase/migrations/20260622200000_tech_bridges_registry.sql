-- Dynamic bridge/connector registry for the Technology Hub. Super admins can
-- create ANY bridge (MT4/MT5, proprietary/our-own, LP, payment, banking, CRM, KYC,
-- webhook, custom) as and when required. System bridges (the real running ones)
-- are flagged is_system and cannot be deleted. Additive — nothing existing changed.
create table if not exists public.tech_bridges (
  id uuid primary key default gen_random_uuid(),
  name text not null, kind text not null default 'custom', category text not null default 'trading',
  direction text not null default 'bidirectional', endpoint text, status text not null default 'configured',
  config jsonb not null default '{}'::jsonb, health jsonb not null default '{}'::jsonb,
  is_system boolean not null default false, last_sync timestamptz, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists tech_bridges_cat_idx on public.tech_bridges (category, status);
alter table public.tech_bridges enable row level security;
drop policy if exists tech_bridges_sa on public.tech_bridges;
create policy tech_bridges_sa on public.tech_bridges for all
  using (public.tech_is_super_admin()) with check (public.tech_is_super_admin());
grant select, insert, update, delete on public.tech_bridges to authenticated;

insert into public.tech_bridges (name, kind, category, direction, endpoint, status, config, is_system) values
  ('Raptor Trade Bridge','proprietary','trading','inbound','functions/v1/raptor-trade-bridge','active','{"description":"Mirrors closed terminal positions into portal public.trades","schedule":"* * * * *"}'::jsonb, true),
  ('Account Sync Bridge','proprietary','data','outbound','rpc/sync_account_from_portal','active','{"description":"Mirrors portal trading accounts into the terminal"}'::jsonb, true),
  ('LP Price Bridge','lp','liquidity','inbound','cron/lp-publish-quotes','active','{"description":"Publishes the 5-LP aggregated NBBO book","schedule":"* * * * *"}'::jsonb, true),
  ('LP Heartbeat Bridge','lp','liquidity','inbound','cron/lp-heartbeat','active','{"description":"Refreshes LP liveness for redundancy monitoring","schedule":"* * * * *"}'::jsonb, true)
on conflict do nothing;

create or replace function public.tech_bridges_list()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not public.tech_is_super_admin() then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind,'category',category,
            'direction',direction,'endpoint',endpoint,'status',status,'config',config,'is_system',is_system,
            'last_sync',last_sync,'created_at',created_at) order by is_system desc, category, name),'[]'::jsonb)
          from public.tech_bridges);
end; $$;

create or replace function public.tech_bridge_upsert(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id','')::uuid;
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  if coalesce(p->>'name','') = '' then raise exception 'name is required'; end if;
  if v_id is null then
    insert into public.tech_bridges (name, kind, category, direction, endpoint, status, config, created_by)
    values (p->>'name', coalesce(p->>'kind','custom'), coalesce(p->>'category','trading'),
            coalesce(p->>'direction','bidirectional'), nullif(p->>'endpoint',''),
            coalesce(p->>'status','configured'), coalesce(p->'config','{}'::jsonb), auth.uid())
    returning id into v_id;
    perform public.tech_audit_write('bridge.created','bridges', jsonb_build_object('id',v_id,'name',p->>'name','kind',p->>'kind'));
  else
    update public.tech_bridges set name=p->>'name', kind=coalesce(p->>'kind',kind), category=coalesce(p->>'category',category),
      direction=coalesce(p->>'direction',direction), endpoint=nullif(p->>'endpoint',''),
      config=coalesce(p->'config',config), updated_at=now() where id=v_id;
    if not found then raise exception 'unknown bridge'; end if;
    perform public.tech_audit_write('bridge.updated','bridges', jsonb_build_object('id',v_id,'name',p->>'name'));
  end if;
  return v_id;
end; $$;

create or replace function public.tech_bridge_set_status(p_id uuid, p_status text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  if p_status not in ('active','configured','disabled','error') then raise exception 'invalid status'; end if;
  update public.tech_bridges set status=p_status, updated_at=now() where id=p_id;
  if not found then raise exception 'unknown bridge'; end if;
  perform public.tech_audit_write('bridge.status','bridges', jsonb_build_object('id',p_id,'status',p_status));
  return 'ok';
end; $$;

create or replace function public.tech_bridge_delete(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_sys boolean;
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  select is_system into v_sys from public.tech_bridges where id=p_id;
  if v_sys is null then raise exception 'unknown bridge'; end if;
  if v_sys then raise exception 'system bridges cannot be deleted (disable instead)'; end if;
  delete from public.tech_bridges where id=p_id;
  perform public.tech_audit_write('bridge.deleted','bridges', jsonb_build_object('id',p_id));
  return 'ok';
end; $$;

revoke all on function public.tech_bridges_list()               from public, anon;
revoke all on function public.tech_bridge_upsert(jsonb)         from public, anon;
revoke all on function public.tech_bridge_set_status(uuid,text) from public, anon;
revoke all on function public.tech_bridge_delete(uuid)          from public, anon;
grant execute on function public.tech_bridges_list()               to authenticated;
grant execute on function public.tech_bridge_upsert(jsonb)         to authenticated;
grant execute on function public.tech_bridge_set_status(uuid,text) to authenticated;
grant execute on function public.tech_bridge_delete(uuid)          to authenticated;

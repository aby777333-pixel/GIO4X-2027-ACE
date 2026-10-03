-- Public RPC wrappers for the Pricing Terminal (pricing schema not API-exposed).
-- Reads gated by pricing.can_read(); writes by pricing.can_write().
create or replace function public.pricing_engine_config()
returns jsonb language plpgsql security definer set search_path = public, pricing stable as $$
begin
  if not pricing.can_read() then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'engine', (select to_jsonb(e) from pricing.engine_settings e where id = 1),
    'spread_config', (select coalesce(jsonb_agg(to_jsonb(s) order by s.priority), '[]') from pricing.spread_config s),
    'dynamic_spread_rules', (select coalesce(jsonb_agg(to_jsonb(s) order by s.priority), '[]') from pricing.dynamic_spread_rules s),
    'widening_rules', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from pricing.spread_widening_rules s),
    'compression_rules', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from pricing.spread_compression_rules s),
    'markup_layers', (select coalesce(jsonb_agg(to_jsonb(s) order by s.stack_order), '[]') from pricing.markup_layers s),
    'lp_markup', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from pricing.lp_markup s),
    'segment_pricing', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from pricing.segment_pricing s));
end; $$;

create or replace function public.pricing_overview()
returns jsonb language plpgsql security definer set search_path = public, pricing stable as $$
begin
  if not pricing.can_read() then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'engine', (select to_jsonb(e) from pricing.engine_settings e where id = 1),
    'counts', jsonb_build_object('spread',(select count(*) from pricing.spread_config),'markup',(select count(*) from pricing.markup_layers where enabled),
      'dynamic',(select count(*) from pricing.dynamic_spread_rules where enabled),'widening',(select count(*) from pricing.spread_widening_rules where enabled),
      'compression',(select count(*) from pricing.spread_compression_rules where enabled),'smart',(select count(*) from pricing.smart_rules where enabled),
      'commission',(select count(*) from pricing.commission_config where enabled),'swap',(select count(*) from pricing.swap_config where enabled)),
    'audit_24h', (select count(*) from pricing.config_audit where changed_at >= now() - interval '24 hours'));
end; $$;

create or replace function public.pricing_audit(p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = public, pricing stable as $$
begin
  if not pricing.can_read() then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('table',table_name,'action',action,'previous',previous_value,'new',new_value,'ip',ip_address,'at',changed_at) order by changed_at desc),'[]'::jsonb)
          from (select * from pricing.config_audit order by changed_at desc limit least(greatest(p_limit,1),200)) t);
end; $$;

create or replace function public.pricing_spread_upsert(p jsonb)
returns uuid language plpgsql security definer set search_path = public, pricing as $$
declare v_id uuid := nullif(p->>'id','')::uuid;
begin
  if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  if v_id is null then
    insert into pricing.spread_config (scope_type, scope_ref, mode, base_value, unit, min_spread, max_spread, priority, enabled, updated_by)
    values ((p->>'scope_type')::dealer.scope_type, nullif(p->>'scope_ref',''), coalesce(p->>'mode','fixed')::pricing.spread_mode, (p->>'base_value')::numeric,
            coalesce(p->>'unit','pips')::pricing.markup_unit, nullif(p->>'min_spread','')::numeric, nullif(p->>'max_spread','')::numeric,
            coalesce((p->>'priority')::int,100), coalesce((p->>'enabled')::boolean,true), auth.uid()) returning id into v_id;
  else
    update pricing.spread_config set mode=coalesce(p->>'mode',mode::text)::pricing.spread_mode, base_value=(p->>'base_value')::numeric,
      unit=coalesce(p->>'unit',unit::text)::pricing.markup_unit, min_spread=nullif(p->>'min_spread','')::numeric, max_spread=nullif(p->>'max_spread','')::numeric,
      updated_by=auth.uid(), updated_at=now() where id=v_id;
  end if;
  return v_id;
end; $$;
create or replace function public.pricing_spread_toggle(p_id uuid, p_enabled boolean)
returns text language plpgsql security definer set search_path = public, pricing as $$
begin if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  update pricing.spread_config set enabled=p_enabled, updated_by=auth.uid(), updated_at=now() where id=p_id; return 'ok'; end; $$;

create or replace function public.pricing_markup_upsert(p jsonb)
returns uuid language plpgsql security definer set search_path = public, pricing as $$
declare v_id uuid := nullif(p->>'id','')::uuid;
begin
  if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  if v_id is null then
    insert into pricing.markup_layers (layer, scope_ref, side, value, unit, pct_of_volume, stack_order, enabled, updated_by)
    values ((p->>'layer')::dealer.scope_type, nullif(p->>'scope_ref',''), coalesce(p->>'side','dual')::pricing.markup_side, (p->>'value')::numeric,
            coalesce(p->>'unit','pips')::pricing.markup_unit, nullif(p->>'pct_of_volume','')::numeric, coalesce((p->>'stack_order')::int,100),
            coalesce((p->>'enabled')::boolean,true), auth.uid()) returning id into v_id;
  else
    update pricing.markup_layers set side=coalesce(p->>'side',side::text)::pricing.markup_side, value=(p->>'value')::numeric,
      unit=coalesce(p->>'unit',unit::text)::pricing.markup_unit, pct_of_volume=nullif(p->>'pct_of_volume','')::numeric,
      stack_order=coalesce((p->>'stack_order')::int, stack_order), updated_by=auth.uid(), updated_at=now() where id=v_id;
  end if;
  return v_id;
end; $$;
create or replace function public.pricing_markup_toggle(p_id uuid, p_enabled boolean)
returns text language plpgsql security definer set search_path = public, pricing as $$
begin if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  update pricing.markup_layers set enabled=p_enabled, updated_by=auth.uid(), updated_at=now() where id=p_id; return 'ok'; end; $$;
create or replace function public.pricing_markup_delete(p_id uuid)
returns text language plpgsql security definer set search_path = public, pricing as $$
begin if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  delete from pricing.markup_layers where id=p_id; return 'ok'; end; $$;

revoke all on function public.pricing_engine_config() from public, anon;
revoke all on function public.pricing_overview() from public, anon;
revoke all on function public.pricing_audit(int) from public, anon;
revoke all on function public.pricing_spread_upsert(jsonb) from public, anon;
revoke all on function public.pricing_spread_toggle(uuid, boolean) from public, anon;
revoke all on function public.pricing_markup_upsert(jsonb) from public, anon;
revoke all on function public.pricing_markup_toggle(uuid, boolean) from public, anon;
revoke all on function public.pricing_markup_delete(uuid) from public, anon;
grant execute on function public.pricing_engine_config() to authenticated;
grant execute on function public.pricing_overview() to authenticated;
grant execute on function public.pricing_audit(int) to authenticated;
grant execute on function public.pricing_spread_upsert(jsonb) to authenticated;
grant execute on function public.pricing_spread_toggle(uuid, boolean) to authenticated;
grant execute on function public.pricing_markup_upsert(jsonb) to authenticated;
grant execute on function public.pricing_markup_toggle(uuid, boolean) to authenticated;
grant execute on function public.pricing_markup_delete(uuid) to authenticated;

insert into pricing.spread_config (scope_type, scope_ref, mode, base_value, unit, priority)
  values ('global', null, 'fixed', 2, 'pips', 100) on conflict do nothing;
insert into pricing.markup_layers (layer, scope_ref, side, value, unit, stack_order)
  values ('global', null, 'dual', 0.5, 'pips', 10), ('symbol', 'EURUSD', 'dual', 0.3, 'pips', 20) on conflict do nothing;

-- LP markup + quote-routing CRUD for the Pricing Terminal. LPs are the SHARED
-- dealer.liquidity_providers (pricing routes the QUOTE; dealer routes the ORDER).
create or replace function public.pricing_lp()
returns jsonb language plpgsql security definer set search_path = public, pricing, dealer stable as $$
begin
  if not pricing.can_read() then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'lps', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'status',status,'is_primary',is_primary,'priority',priority,'reject_rate',reject_rate,'avg_fill_ms',avg_fill_ms) order by priority), '[]') from dealer.liquidity_providers),
    'lp_markup', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from pricing.lp_markup s),
    'routing', (select coalesce(jsonb_agg(to_jsonb(s) order by s.scope_ref), '[]') from pricing.lp_price_routing_config s));
end; $$;

create or replace function public.pricing_lp_markup_upsert(p jsonb)
returns uuid language plpgsql security definer set search_path = public, pricing as $$
declare v_id uuid := nullif(p->>'id','')::uuid; v_syms text[] := array(select jsonb_array_elements_text(coalesce(p->'symbols','[]'::jsonb)));
begin
  if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  if v_id is null then
    insert into pricing.lp_markup (lp_id, symbols, side, value, unit, enabled)
    values ((p->>'lp_id')::uuid, v_syms, coalesce(p->>'side','dual')::pricing.markup_side, (p->>'value')::numeric, coalesce(p->>'unit','pips')::pricing.markup_unit, coalesce((p->>'enabled')::boolean,true)) returning id into v_id;
  else
    update pricing.lp_markup set lp_id=(p->>'lp_id')::uuid, symbols=v_syms, side=coalesce(p->>'side',side::text)::pricing.markup_side, value=(p->>'value')::numeric, unit=coalesce(p->>'unit',unit::text)::pricing.markup_unit where id=v_id;
  end if;
  return v_id;
end; $$;
create or replace function public.pricing_lp_markup_toggle(p_id uuid, p_enabled boolean)
returns text language plpgsql security definer set search_path = public, pricing as $$
begin if not pricing.can_write() then raise exception 'pricing admin only'; end if; update pricing.lp_markup set enabled=p_enabled where id=p_id; return 'ok'; end; $$;
create or replace function public.pricing_lp_markup_delete(p_id uuid)
returns text language plpgsql security definer set search_path = public, pricing as $$
begin if not pricing.can_write() then raise exception 'pricing admin only'; end if; delete from pricing.lp_markup where id=p_id; return 'ok'; end; $$;

create or replace function public.pricing_lp_routing_upsert(p jsonb)
returns uuid language plpgsql security definer set search_path = public, pricing as $$
declare v_id uuid := nullif(p->>'id','')::uuid;
begin
  if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  if v_id is null then
    insert into pricing.lp_price_routing_config (scope_type, scope_ref, mode, enabled)
    values (coalesce(p->>'scope_type','symbol')::dealer.scope_type, nullif(p->>'scope_ref',''), (p->>'mode')::pricing.lp_price_routing, coalesce((p->>'enabled')::boolean,true)) returning id into v_id;
  else
    update pricing.lp_price_routing_config set mode=(p->>'mode')::pricing.lp_price_routing, scope_ref=nullif(p->>'scope_ref','') where id=v_id;
  end if;
  return v_id;
end; $$;
create or replace function public.pricing_lp_routing_toggle(p_id uuid, p_enabled boolean)
returns text language plpgsql security definer set search_path = public, pricing as $$
begin if not pricing.can_write() then raise exception 'pricing admin only'; end if; update pricing.lp_price_routing_config set enabled=p_enabled where id=p_id; return 'ok'; end; $$;
create or replace function public.pricing_lp_routing_delete(p_id uuid)
returns text language plpgsql security definer set search_path = public, pricing as $$
begin if not pricing.can_write() then raise exception 'pricing admin only'; end if; delete from pricing.lp_price_routing_config where id=p_id; return 'ok'; end; $$;

revoke all on function public.pricing_lp() from public, anon;
revoke all on function public.pricing_lp_markup_upsert(jsonb) from public, anon;
revoke all on function public.pricing_lp_markup_toggle(uuid,boolean) from public, anon;
revoke all on function public.pricing_lp_markup_delete(uuid) from public, anon;
revoke all on function public.pricing_lp_routing_upsert(jsonb) from public, anon;
revoke all on function public.pricing_lp_routing_toggle(uuid,boolean) from public, anon;
revoke all on function public.pricing_lp_routing_delete(uuid) from public, anon;
grant execute on function public.pricing_lp() to authenticated;
grant execute on function public.pricing_lp_markup_upsert(jsonb) to authenticated;
grant execute on function public.pricing_lp_markup_toggle(uuid,boolean) to authenticated;
grant execute on function public.pricing_lp_markup_delete(uuid) to authenticated;
grant execute on function public.pricing_lp_routing_upsert(jsonb) to authenticated;
grant execute on function public.pricing_lp_routing_toggle(uuid,boolean) to authenticated;
grant execute on function public.pricing_lp_routing_delete(uuid) to authenticated;

insert into pricing.lp_price_routing_config (scope_type, scope_ref, mode)
values ('global', null, 'best_price') on conflict do nothing;
insert into pricing.lp_markup (lp_id, symbols, side, value, unit)
select id, '{}', 'dual', 0.2, 'pips' from dealer.liquidity_providers where is_primary limit 1 on conflict do nothing;

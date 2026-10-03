-- Commission + swap CRUD for the Pricing Terminal (gated, audited).
create or replace function public.pricing_commission_swap()
returns jsonb language plpgsql security definer set search_path = public, pricing stable as $$
begin
  if not pricing.can_read() then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'commission', (select coalesce(jsonb_agg(to_jsonb(s) order by s.priority), '[]') from pricing.commission_config s),
    'swap', (select coalesce(jsonb_agg(to_jsonb(s) order by s.scope_ref), '[]') from pricing.swap_config s));
end; $$;

create or replace function public.pricing_commission_upsert(p jsonb)
returns uuid language plpgsql security definer set search_path = public, pricing as $$
declare v_id uuid := nullif(p->>'id','')::uuid;
begin
  if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  if v_id is null then
    insert into pricing.commission_config (scope_type, scope_ref, model, value, per_side, currency, priority, enabled)
    values ((p->>'scope_type')::dealer.scope_type, nullif(p->>'scope_ref',''), (p->>'model')::pricing.commission_model, (p->>'value')::numeric,
            coalesce((p->>'per_side')::boolean,true), coalesce(p->>'currency','USD'), coalesce((p->>'priority')::int,100), coalesce((p->>'enabled')::boolean,true)) returning id into v_id;
  else
    update pricing.commission_config set model=coalesce(p->>'model',model::text)::pricing.commission_model, value=(p->>'value')::numeric,
      per_side=coalesce((p->>'per_side')::boolean,per_side), currency=coalesce(p->>'currency',currency), scope_ref=nullif(p->>'scope_ref','') where id=v_id;
  end if;
  return v_id;
end; $$;
create or replace function public.pricing_commission_toggle(p_id uuid, p_enabled boolean)
returns text language plpgsql security definer set search_path = public, pricing as $$
begin if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  update pricing.commission_config set enabled=p_enabled where id=p_id; return 'ok'; end; $$;
create or replace function public.pricing_commission_delete(p_id uuid)
returns text language plpgsql security definer set search_path = public, pricing as $$
begin if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  delete from pricing.commission_config where id=p_id; return 'ok'; end; $$;

create or replace function public.pricing_swap_upsert(p jsonb)
returns uuid language plpgsql security definer set search_path = public, pricing as $$
declare v_id uuid := nullif(p->>'id','')::uuid;
begin
  if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  if v_id is null then
    insert into pricing.swap_config (scope_type, scope_ref, long_rate, short_rate, triple_day, dynamic, unit, enabled)
    values (coalesce(p->>'scope_type','symbol')::dealer.scope_type, nullif(p->>'scope_ref',''), (p->>'long_rate')::numeric, (p->>'short_rate')::numeric,
            coalesce((p->>'triple_day')::int,3), coalesce((p->>'dynamic')::boolean,false), coalesce(p->>'unit','points')::pricing.markup_unit, coalesce((p->>'enabled')::boolean,true)) returning id into v_id;
  else
    update pricing.swap_config set long_rate=(p->>'long_rate')::numeric, short_rate=(p->>'short_rate')::numeric,
      triple_day=coalesce((p->>'triple_day')::int,triple_day), unit=coalesce(p->>'unit',unit::text)::pricing.markup_unit, scope_ref=nullif(p->>'scope_ref','') where id=v_id;
  end if;
  return v_id;
end; $$;
create or replace function public.pricing_swap_toggle(p_id uuid, p_enabled boolean)
returns text language plpgsql security definer set search_path = public, pricing as $$
begin if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  update pricing.swap_config set enabled=p_enabled where id=p_id; return 'ok'; end; $$;
create or replace function public.pricing_swap_delete(p_id uuid)
returns text language plpgsql security definer set search_path = public, pricing as $$
begin if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  delete from pricing.swap_config where id=p_id; return 'ok'; end; $$;

revoke all on function public.pricing_commission_swap() from public, anon;
revoke all on function public.pricing_commission_upsert(jsonb) from public, anon;
revoke all on function public.pricing_commission_toggle(uuid,boolean) from public, anon;
revoke all on function public.pricing_commission_delete(uuid) from public, anon;
revoke all on function public.pricing_swap_upsert(jsonb) from public, anon;
revoke all on function public.pricing_swap_toggle(uuid,boolean) from public, anon;
revoke all on function public.pricing_swap_delete(uuid) from public, anon;
grant execute on function public.pricing_commission_swap() to authenticated;
grant execute on function public.pricing_commission_upsert(jsonb) to authenticated;
grant execute on function public.pricing_commission_toggle(uuid,boolean) to authenticated;
grant execute on function public.pricing_commission_delete(uuid) to authenticated;
grant execute on function public.pricing_swap_upsert(jsonb) to authenticated;
grant execute on function public.pricing_swap_toggle(uuid,boolean) to authenticated;
grant execute on function public.pricing_swap_delete(uuid) to authenticated;

insert into pricing.commission_config (scope_type, scope_ref, model, value, per_side, currency, priority)
values ('global', null, 'per_lot', 7, true, 'USD', 100) on conflict do nothing;
insert into pricing.swap_config (scope_type, scope_ref, long_rate, short_rate, triple_day, unit)
values ('symbol', 'EURUSD', -2.1, 0.4, 3, 'points') on conflict do nothing;

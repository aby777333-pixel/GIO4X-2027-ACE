-- Smart + dynamic spread rule CRUD for the Pricing Terminal (gated, audited).
create or replace function public.pricing_rules()
returns jsonb language plpgsql security definer set search_path = public, pricing stable as $$
begin
  if not pricing.can_read() then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'smart', (select coalesce(jsonb_agg(to_jsonb(s) order by s.priority), '[]') from pricing.smart_rules s),
    'dynamic', (select coalesce(jsonb_agg(to_jsonb(s) order by s.priority), '[]') from pricing.dynamic_spread_rules s));
end; $$;

create or replace function public.pricing_smart_upsert(p jsonb)
returns uuid language plpgsql security definer set search_path = public, pricing as $$
declare v_id uuid := nullif(p->>'id','')::uuid;
begin
  if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  if v_id is null then
    insert into pricing.smart_rules (name, priority, condition, action, scope_type, scope_ref, enabled, updated_by)
    values (p->>'name', coalesce((p->>'priority')::int,100), p->'condition', p->'action',
            coalesce(p->>'scope_type','global')::dealer.scope_type, nullif(p->>'scope_ref',''), coalesce((p->>'enabled')::boolean,true), auth.uid()) returning id into v_id;
  else
    update pricing.smart_rules set name=p->>'name', priority=coalesce((p->>'priority')::int,priority), condition=p->'condition',
      action=p->'action', scope_ref=nullif(p->>'scope_ref',''), updated_by=auth.uid() where id=v_id;
  end if;
  return v_id;
end; $$;
create or replace function public.pricing_smart_toggle(p_id uuid, p_enabled boolean)
returns text language plpgsql security definer set search_path = public, pricing as $$
begin if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  update pricing.smart_rules set enabled=p_enabled, updated_by=auth.uid() where id=p_id; return 'ok'; end; $$;
create or replace function public.pricing_smart_delete(p_id uuid)
returns text language plpgsql security definer set search_path = public, pricing as $$
begin if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  delete from pricing.smart_rules where id=p_id; return 'ok'; end; $$;

create or replace function public.pricing_dynamic_upsert(p jsonb)
returns uuid language plpgsql security definer set search_path = public, pricing as $$
declare v_id uuid := nullif(p->>'id','')::uuid;
begin
  if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  if v_id is null then
    insert into pricing.dynamic_spread_rules (name, scope_type, scope_ref, priority, condition, delta_value, unit, enabled, updated_by)
    values (p->>'name', coalesce(p->>'scope_type','global')::dealer.scope_type, nullif(p->>'scope_ref',''), coalesce((p->>'priority')::int,100),
            p->'condition', (p->>'delta_value')::numeric, coalesce(p->>'unit','pips')::pricing.markup_unit, coalesce((p->>'enabled')::boolean,true), auth.uid()) returning id into v_id;
  else
    update pricing.dynamic_spread_rules set name=p->>'name', priority=coalesce((p->>'priority')::int,priority), condition=p->'condition',
      delta_value=(p->>'delta_value')::numeric, unit=coalesce(p->>'unit',unit::text)::pricing.markup_unit, scope_ref=nullif(p->>'scope_ref',''), updated_by=auth.uid() where id=v_id;
  end if;
  return v_id;
end; $$;
create or replace function public.pricing_dynamic_toggle(p_id uuid, p_enabled boolean)
returns text language plpgsql security definer set search_path = public, pricing as $$
begin if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  update pricing.dynamic_spread_rules set enabled=p_enabled, updated_by=auth.uid() where id=p_id; return 'ok'; end; $$;
create or replace function public.pricing_dynamic_delete(p_id uuid)
returns text language plpgsql security definer set search_path = public, pricing as $$
begin if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  delete from pricing.dynamic_spread_rules where id=p_id; return 'ok'; end; $$;

revoke all on function public.pricing_rules() from public, anon;
revoke all on function public.pricing_smart_upsert(jsonb) from public, anon;
revoke all on function public.pricing_smart_toggle(uuid,boolean) from public, anon;
revoke all on function public.pricing_smart_delete(uuid) from public, anon;
revoke all on function public.pricing_dynamic_upsert(jsonb) from public, anon;
revoke all on function public.pricing_dynamic_toggle(uuid,boolean) from public, anon;
revoke all on function public.pricing_dynamic_delete(uuid) from public, anon;
grant execute on function public.pricing_rules() to authenticated;
grant execute on function public.pricing_smart_upsert(jsonb) to authenticated;
grant execute on function public.pricing_smart_toggle(uuid,boolean) to authenticated;
grant execute on function public.pricing_smart_delete(uuid) to authenticated;
grant execute on function public.pricing_dynamic_upsert(jsonb) to authenticated;
grant execute on function public.pricing_dynamic_toggle(uuid,boolean) to authenticated;
grant execute on function public.pricing_dynamic_delete(uuid) to authenticated;

insert into pricing.smart_rules (name, priority, condition, action, scope_type, scope_ref)
values ('VIP compression', 10, '{"all":[{"field":"segment","op":"==","value":"vip"}]}'::jsonb, '{"type":"compress","by":0.3}'::jsonb, 'global', null),
       ('High-vol widen', 20, '{"all":[{"field":"volatility","op":">","value":2}]}'::jsonb, '{"type":"widen","by":1.5}'::jsonb, 'global', null)
on conflict do nothing;
insert into pricing.dynamic_spread_rules (name, scope_type, scope_ref, priority, condition, delta_value, unit)
values ('Thin liquidity widen', 'global', null, 10, '{"all":[{"field":"liquidity","op":"<","value":30}]}'::jsonb, 1.0, 'pips')
on conflict do nothing;

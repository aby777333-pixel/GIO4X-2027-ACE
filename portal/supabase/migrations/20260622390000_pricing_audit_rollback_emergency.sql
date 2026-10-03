-- Audit timeline returns row id (for rollback) + device.
create or replace function public.pricing_audit(p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = public, pricing stable as $$
begin
  if not pricing.can_read() then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'table',table_name,'action',action,'previous',previous_value,
            'new',new_value,'ip',ip_address,'device',device,'at',changed_at) order by changed_at desc), '[]'::jsonb)
          from (select * from pricing.config_audit order by changed_at desc limit least(greatest(p_limit,1),200)) t);
end; $$;

-- One-click rollback: restore a config row to the state captured in the audit entry.
create or replace function public.pricing_rollback(p_audit_id uuid)
returns text language plpgsql security definer set search_path = public, pricing as $$
declare a record;
begin
  if not pricing.can_write() then raise exception 'pricing admin only'; end if;
  select * into a from pricing.config_audit where id = p_audit_id;
  if not found then raise exception 'audit row not found'; end if;
  if a.action = 'insert' then
    execute format('delete from pricing.%I where id::text = $1', a.table_name) using a.row_id;
  else
    if a.previous_value is null then raise exception 'nothing to restore'; end if;
    execute format('delete from pricing.%I where id::text = $1', a.table_name) using a.row_id;
    execute format('insert into pricing.%I select * from jsonb_populate_record(null::pricing.%I, $1::jsonb)', a.table_name, a.table_name) using a.previous_value;
  end if;
  return 'ok';
end; $$;
revoke all on function public.pricing_rollback(uuid) from public, anon;
grant execute on function public.pricing_rollback(uuid) to authenticated;

-- Emergency control log (freeze/expand/etc.) → also raises a dealer.alerts row.
create table if not exists pricing.emergency_log (
  id uuid primary key default gen_random_uuid(), symbol text, action text not null, detail jsonb, reason text,
  actor uuid, created_at timestamptz default now()
);
alter table pricing.emergency_log enable row level security;
grant select, insert on pricing.emergency_log to authenticated;
drop policy if exists em_read on pricing.emergency_log;
create policy em_read on pricing.emergency_log for select using (pricing.can_read());

create or replace function public.pricing_emergency_log(p jsonb)
returns text language plpgsql security definer set search_path = public, pricing, dealer as $$
begin
  if not pricing.can_override() then raise exception 'override role required'; end if;
  insert into pricing.emergency_log (symbol, action, detail, reason, actor)
  values (nullif(p->>'symbol',''), p->>'action', p->'detail', p->>'reason', auth.uid());
  insert into dealer.alerts (severity, category, title, body, context)
  values ('critical', 'pricing', 'EMERGENCY: ' || (p->>'action') || ' ' || coalesce(p->>'symbol',''), p->>'reason', p);
  return 'ok';
end; $$;
create or replace function public.pricing_emergency_recent()
returns jsonb language plpgsql security definer set search_path = public, pricing stable as $$
begin
  if not pricing.can_read() then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('symbol',symbol,'action',action,'reason',reason,'at',created_at) order by created_at desc), '[]'::jsonb)
          from (select * from pricing.emergency_log order by created_at desc limit 20) t);
end; $$;
revoke all on function public.pricing_emergency_log(jsonb) from public, anon;
revoke all on function public.pricing_emergency_recent() from public, anon;
grant execute on function public.pricing_emergency_log(jsonb) to authenticated;
grant execute on function public.pricing_emergency_recent() to authenticated;

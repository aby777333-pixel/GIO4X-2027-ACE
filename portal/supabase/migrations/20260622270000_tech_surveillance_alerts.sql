-- Trade-surveillance alerts (findings from the terminal fn_tech_surveillance scan).
-- The detection RPC fn_tech_surveillance lives in the terminal project (leumpgkfillgeyyfptef).
create table if not exists public.tech_surveillance_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null, severity text not null, subject text, detail text, metric numeric,
  signature text not null, status text not null default 'open',
  created_at timestamptz not null default now(), resolved_at timestamptz, resolved_by uuid
);
create index if not exists tech_surv_status_idx on public.tech_surveillance_alerts (status, created_at desc);
alter table public.tech_surveillance_alerts enable row level security;
drop policy if exists tech_surv_sa on public.tech_surveillance_alerts;
create policy tech_surv_sa on public.tech_surveillance_alerts for all using (public.tech_is_super_admin()) with check (public.tech_is_super_admin());
grant select, insert, update, delete on public.tech_surveillance_alerts to authenticated;

create or replace function public.tech_surveillance_ingest(p_findings jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare f jsonb; n integer := 0;
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  for f in select * from jsonb_array_elements(coalesce(p_findings, '[]'::jsonb)) loop
    if not exists (select 1 from public.tech_surveillance_alerts where signature = f->>'signature' and status='open') then
      insert into public.tech_surveillance_alerts (kind, severity, subject, detail, metric, signature)
      values (f->>'kind', f->>'severity', f->>'subject', f->>'detail', nullif(f->>'metric','')::numeric, f->>'signature');
      n := n + 1;
    end if;
  end loop;
  perform public.tech_audit_write('surveillance.scan', 'automation', jsonb_build_object('new_alerts', n));
  return n;
end; $$;

create or replace function public.tech_surveillance_list()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not public.tech_is_super_admin() then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'open', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'severity',severity,'subject',subject,'detail',detail,'created_at',created_at)
              order by case severity when 'high' then 0 when 'medium' then 1 else 2 end, created_at desc), '[]'::jsonb)
            from public.tech_surveillance_alerts where status='open'),
    'counts', jsonb_build_object(
      'open', (select count(*) from public.tech_surveillance_alerts where status='open'),
      'high', (select count(*) from public.tech_surveillance_alerts where status='open' and severity='high'),
      'resolved_24h', (select count(*) from public.tech_surveillance_alerts where status='resolved' and resolved_at >= now()-interval '24 hours'))
  );
end; $$;

create or replace function public.tech_surveillance_resolve(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  update public.tech_surveillance_alerts set status='resolved', resolved_at=now(), resolved_by=auth.uid() where id=p_id;
  perform public.tech_audit_write('surveillance.resolved', 'automation', jsonb_build_object('id', p_id));
  return 'ok';
end; $$;

revoke all on function public.tech_surveillance_ingest(jsonb) from public, anon;
revoke all on function public.tech_surveillance_list() from public, anon;
revoke all on function public.tech_surveillance_resolve(uuid) from public, anon;
grant execute on function public.tech_surveillance_ingest(jsonb) to authenticated;
grant execute on function public.tech_surveillance_list() to authenticated;
grant execute on function public.tech_surveillance_resolve(uuid) to authenticated;

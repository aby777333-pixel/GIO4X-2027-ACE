-- Generic registry powering the remaining Tech Hub modules (infra nodes, brokers,
-- env vars, marketplace items, spread profiles) + live readers for Signals and
-- Automation. Additive; all super-admin gated + audited.
create table if not exists public.tech_registry (
  id uuid primary key default gen_random_uuid(),
  kind text not null, name text not null, label text, status text not null default 'active',
  config jsonb not null default '{}'::jsonb, enabled boolean not null default true,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists tech_registry_kind_idx on public.tech_registry (kind, name);
alter table public.tech_registry enable row level security;
drop policy if exists tech_registry_sa on public.tech_registry;
create policy tech_registry_sa on public.tech_registry for all using (public.tech_is_super_admin()) with check (public.tech_is_super_admin());
grant select, insert, update, delete on public.tech_registry to authenticated;

create or replace function public.tech_registry_list(p_kind text) returns jsonb language plpgsql security definer set search_path = public stable as $$
begin if not public.tech_is_super_admin() then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'name',name,'label',label,'status',status,'config',config,'enabled',enabled,'created_at',created_at) order by name), '[]'::jsonb) from public.tech_registry where kind = p_kind);
end; $$;
create or replace function public.tech_registry_upsert(p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id','')::uuid;
begin if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  if coalesce(p->>'name','')='' then raise exception 'name required'; end if;
  if v_id is null then
    insert into public.tech_registry (kind,name,label,status,config,created_by) values (coalesce(p->>'kind','extension'),p->>'name',nullif(p->>'label',''),coalesce(p->>'status','active'),coalesce(p->'config','{}'::jsonb),auth.uid()) returning id into v_id;
    perform public.tech_audit_write('registry.created', p->>'kind', jsonb_build_object('id',v_id,'name',p->>'name'));
  else
    update public.tech_registry set name=p->>'name', label=nullif(p->>'label',''), config=coalesce(p->'config',config), updated_at=now() where id=v_id;
    perform public.tech_audit_write('registry.updated', (select kind from public.tech_registry where id=v_id), jsonb_build_object('id',v_id));
  end if; return v_id;
end; $$;
create or replace function public.tech_registry_toggle(p_id uuid, p_enabled boolean) returns text language plpgsql security definer set search_path = public as $$
begin if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  update public.tech_registry set enabled=p_enabled, status=case when p_enabled then 'active' else 'disabled' end, updated_at=now() where id=p_id;
  perform public.tech_audit_write('registry.toggled', (select kind from public.tech_registry where id=p_id), jsonb_build_object('id',p_id,'enabled',p_enabled)); return 'ok';
end; $$;
create or replace function public.tech_registry_delete(p_id uuid) returns text language plpgsql security definer set search_path = public as $$
begin if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  delete from public.tech_registry where id=p_id; perform public.tech_audit_write('registry.deleted','registry', jsonb_build_object('id',p_id)); return 'ok';
end; $$;

insert into public.tech_registry (kind, name, label, status, config) values
 ('infra','Portal Droplet','app.gio4x.com / gio4x.com','active','{"type":"server","host":"168.144.152.135","provider":"DigitalOcean","runtime":"PM2 + Next.js"}'),
 ('infra','Terminal Site','dashing-hamster (GIO Raptor)','active','{"type":"netlify","provider":"Netlify"}'),
 ('infra','Portal Database','Supabase tdifcayznqnaduchzfqz','active','{"type":"database","provider":"Supabase"}'),
 ('infra','Terminal Database','Supabase leumpgkfillgeyyfptef','active','{"type":"database","provider":"Supabase"}'),
 ('broker','GIO4X','Primary brand · gio4x.com','active','{"brand":"GIO4X","domain":"gio4x.com","regions":["IN","global"]}'),
 ('env','NEXT_PUBLIC_SITE_URL','https://app.gio4x.com','active','{"scope":"portal","secret":false}'),
 ('extension','Document Builder','Staff doc builder (jspdf/docx)','active','{"installed":true}'),
 ('extension','Bulk Emailer','Resend bulk email','active','{"installed":true}')
on conflict do nothing;

create or replace function public.tech_signals() returns jsonb language plpgsql security definer set search_path = public stable as $$
begin if not public.tech_is_super_admin() then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'providers', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',coalesce(display_name,'Provider'),'status',status,'subscribers',(select count(*) from public.copy_subscriptions s where s.provider_id=p.id and s.status='active')) order by created_at desc), '[]'::jsonb) from public.signal_providers p),
    'funds', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'status',status,'aum',aum,'nav',nav_per_unit) order by created_at desc), '[]'::jsonb) from public.pamm_funds),
    'stats', jsonb_build_object('providers',(select count(*) from public.signal_providers),'funds',(select count(*) from public.pamm_funds),'subscriptions',(select count(*) from public.copy_subscriptions)));
end; $$;

create or replace function public.tech_jobs() returns jsonb language plpgsql security definer set search_path = public stable as $$
begin if not public.tech_is_super_admin() then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'jobs', (select coalesce(jsonb_agg(jsonb_build_object('jobid',j.jobid,'name',j.jobname,'schedule',j.schedule,'active',j.active,
               'last_run',(select max(start_time) from cron.job_run_details d where d.jobid=j.jobid),
               'last_status',(select status from cron.job_run_details d where d.jobid=j.jobid order by start_time desc limit 1)) order by j.jobname), '[]'::jsonb) from cron.job j),
    'outbox', jsonb_build_object('pending',(select count(*) from public.events_outbox where processed_at is null),'total',(select count(*) from public.events_outbox)));
end; $$;
create or replace function public.tech_job_toggle(p_jobid bigint, p_active boolean) returns text language plpgsql security definer set search_path = public, cron as $$
begin if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  perform cron.alter_job(job_id := p_jobid, active := p_active);
  perform public.tech_audit_write(case when p_active then 'job.resumed' else 'job.paused' end,'automation', jsonb_build_object('jobid',p_jobid)); return 'ok';
end; $$;
create or replace function public.tech_outbox_process() returns text language plpgsql security definer set search_path = public as $$
begin if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  perform public.dispatch_outbox_events(); perform public.tech_audit_write('outbox.processed','automation','{}'::jsonb); return 'ok';
end; $$;

grant execute on function public.tech_registry_list(text) to authenticated;
grant execute on function public.tech_registry_upsert(jsonb) to authenticated;
grant execute on function public.tech_registry_toggle(uuid,boolean) to authenticated;
grant execute on function public.tech_registry_delete(uuid) to authenticated;
grant execute on function public.tech_signals() to authenticated;
grant execute on function public.tech_jobs() to authenticated;
grant execute on function public.tech_job_toggle(bigint,boolean) to authenticated;
grant execute on function public.tech_outbox_process() to authenticated;

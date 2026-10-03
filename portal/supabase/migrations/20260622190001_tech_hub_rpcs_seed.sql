-- Technology Hub: super-admin RPCs, module registry seed, and storage bucket.

create or replace function public.tech_audit_write(p_action text, p_module text, p_detail jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  select email into v_email from public.profiles where id = auth.uid();
  insert into public.tech_audit_log (actor_id, actor_email, action, module, detail)
  values (auth.uid(), v_email, p_action, p_module, coalesce(p_detail, '{}'::jsonb));
end; $$;

create or replace function public.tech_overview()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v jsonb;
begin
  if not public.tech_is_super_admin() then return '{}'::jsonb; end if;
  select jsonb_build_object(
    'db', jsonb_build_object('size_pretty', pg_size_pretty(pg_database_size(current_database())),
      'size_bytes', pg_database_size(current_database()),
      'tables', (select count(*) from information_schema.tables where table_schema='public'),
      'profiles', (select count(*) from public.profiles), 'trades', (select count(*) from public.trades)),
    'modules', jsonb_build_object('total',(select count(*) from public.tech_modules),
      'enabled',(select count(*) from public.tech_modules where enabled),
      'available',(select count(*) from public.tech_modules where status='available'),
      'beta',(select count(*) from public.tech_modules where status='beta'),
      'roadmap',(select count(*) from public.tech_modules where status='roadmap')),
    'super_admins',(select count(*) from public.profiles where is_super_admin),
    'audit_24h',(select count(*) from public.tech_audit_log where created_at > now() - interval '24 hours'),
    'settings',(select coalesce(jsonb_object_agg(key, value),'{}'::jsonb) from public.tech_settings)
  ) into v; return v;
end; $$;

create or replace function public.tech_module_toggle(p_key text, p_enabled boolean)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  update public.tech_modules set enabled = p_enabled, updated_at = now() where key = p_key;
  if not found then raise exception 'unknown module %', p_key; end if;
  perform public.tech_audit_write(case when p_enabled then 'module.enabled' else 'module.disabled' end, p_key, jsonb_build_object('enabled', p_enabled));
  return 'ok';
end; $$;

create or replace function public.tech_setting_set(p_key text, p_value jsonb)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  insert into public.tech_settings (key, value, updated_by, updated_at) values (p_key, p_value, auth.uid(), now())
  on conflict (key) do update set value = excluded.value, updated_by = auth.uid(), updated_at = now();
  perform public.tech_audit_write('setting.changed','platform', jsonb_build_object('key', p_key, 'value', p_value));
  return 'ok';
end; $$;

create or replace function public.tech_admins_list()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not public.tech_is_super_admin() then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'full_name',full_name,'role',role::text,
            'is_super_admin',is_super_admin,'tech_permissions',tech_permissions,'created_at',created_at)
            order by is_super_admin desc, created_at),'[]'::jsonb)
          from public.profiles where is_super_admin or role in ('admin','staff'));
end; $$;

create or replace function public.tech_set_super_admin(p_user_id uuid, p_on boolean)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  if p_user_id = auth.uid() and not p_on then raise exception 'cannot remove your own super-admin access'; end if;
  update public.profiles set is_super_admin = p_on, updated_at = now() where id = p_user_id;
  perform public.tech_audit_write(case when p_on then 'superadmin.granted' else 'superadmin.revoked' end, 'access', jsonb_build_object('user_id', p_user_id));
  return 'ok';
end; $$;

create or replace function public.tech_audit_recent(p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not public.tech_is_super_admin() then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(t order by t.created_at desc),'[]'::jsonb)
          from (select actor_email, action, module, detail, created_at from public.tech_audit_log
                order by created_at desc limit least(greatest(p_limit,1),200)) t);
end; $$;

revoke all on function public.tech_audit_write(text,text,jsonb)  from public, anon;
revoke all on function public.tech_overview()                    from public, anon;
revoke all on function public.tech_module_toggle(text,boolean)   from public, anon;
revoke all on function public.tech_setting_set(text,jsonb)       from public, anon;
revoke all on function public.tech_admins_list()                 from public, anon;
revoke all on function public.tech_set_super_admin(uuid,boolean) from public, anon;
revoke all on function public.tech_audit_recent(integer)         from public, anon;
grant execute on function public.tech_audit_write(text,text,jsonb)  to authenticated;
grant execute on function public.tech_overview()                    to authenticated;
grant execute on function public.tech_module_toggle(text,boolean)   to authenticated;
grant execute on function public.tech_setting_set(text,jsonb)       to authenticated;
grant execute on function public.tech_admins_list()                 to authenticated;
grant execute on function public.tech_set_super_admin(uuid,boolean) to authenticated;
grant execute on function public.tech_audit_recent(integer)         to authenticated;

-- Module registry seed (16 modules). See live DB for the authoritative features[].
insert into public.tech_modules (key, category, name, description, features, status, enabled, icon, sort) values
('platform','Platform & Apps','Platform Management','Features, modules, components, versions and environments.','["Feature create/edit/enable/disable/delete","Modules & microservices","Component install/update/rollback/remove","Feature toggles & deployment","Version & release management","Environment management (Dev/Staging/Prod)"]','beta',true,'LayoutGrid',10),
('api','Platform & Apps','API Management','REST, FIX and WebSocket APIs, keys, limits and analytics.','["API key create/regenerate/suspend/revoke","REST API","FIX API","WebSocket API","Rate limiting & throttling","Usage analytics","API documentation","Third-party developer access"]','available',true,'KeyRound',20),
('marketplace','Platform & Apps','Plugin & Feature Marketplace','Upload, install, enable and deploy platform extensions.','["Upload/download modules","Install extensions","Custom plugins","Premium add-ons","Internal app marketplace","Per-broker enable/disable","One-click deployment"]','roadmap',true,'Boxes',30),
('devtools','Platform & Apps','Developer Tools','Deployments, CI/CD, builds, env vars and sandboxes.','["Code deployment","CI/CD pipelines","Repository integration","Build management","Environment variables","SDK management","API sandbox","Testing & QA"]','roadmap',true,'TerminalSquare',40),
('bridges','Connectivity','Bridge & Connector Management','MT4/MT5 bridges, LP, payment, banking, CRM and KYC connectors.','["MT4 & MT5 bridges","Proprietary platform bridge","Liquidity provider connectors","Payment gateway connectors","Banking connectors","CRM connectors","KYC provider connectors","TradingView integration","External app integrations"]','available',true,'Cable',50),
('liquidity','Connectivity','Liquidity & Market Infrastructure','LP config, aggregation, smart routing, markup and book.','["LP configuration","LP onboarding/removal","Aggregation","Smart order routing","Symbol mapping","Markup & spread","Execution routing","A-Book/B-Book/Hybrid","Risk routing profiles"]','available',true,'Waves',60),
('trading','Trading','Trading Infrastructure','Servers, engine, symbols, sessions and instruments.','["Trading server & engine","Symbol & contract specs","Market sessions & hours","Corporate actions","Instrument create/delete","Asset categories"]','available',true,'CandlestickChart',70),
('signals','Trading','Signal & Strategy Management','Signals, copy trading, PAMM/MAM and strategy marketplace.','["Signal providers","Signal distribution","Strategy deployment","Copy trading","PAMM/MAM strategies","Strategy marketplace","Approval workflows","Performance analytics"]','beta',true,'Radio',80),
('access','Operations','User & Permission Management','Super admins, roles, permissions, sessions and devices.','["Super admin management","Technical admin management","Roles & permissions","Access audit trails","Session monitoring","Login history","Device management"]','available',true,'UserCog',90),
('broker_ops','Operations','Broker Operations','White-label provisioning, multi-brand/region/tenant.','["White-label provisioning","Broker onboarding wizard","Config templates","Multi-brand","Multi-company","Multi-region","Multi-tenant","Migration tools"]','roadmap',true,'Building2',100),
('reporting','Operations','Reporting & Analytics','System, API, liquidity, security and compliance reports.','["System performance","API usage","Liquidity","Infrastructure","Error","Security","Compliance","Export PDF/Excel/CSV/JSON"]','available',true,'FileBarChart',110),
('infra','Infrastructure','Infrastructure Management','Servers, cloud, Kubernetes, Docker, CDN and backups.','["Servers & cloud","Kubernetes & Docker","Load balancers","CDN","Storage","Backups","Disaster recovery"]','roadmap',true,'Server',120),
('monitoring','Infrastructure','Monitoring & Diagnostics','Health, performance, latency, errors and alerts.','["System health","API performance","Database monitoring","Trading server monitoring","Latency","Error & event logging","Audit logs","Alerts","Performance analytics"]','available',true,'Activity',130),
('database','Infrastructure','Database Management','Administration, import/export, backups and retention.','["DB administration","Import/export","Backup create/restore","Optimization","Archiving","Retention policies","Health monitoring"]','available',true,'Database',140),
('automation','Infrastructure','Automation & AI','Pipelines, AI anomaly/risk, incident response and jobs.','["Deployment pipelines","Automated maintenance","AI anomaly detection","AI risk monitoring","AI diagnostics","Incident response","Workflow automation","Scheduled jobs"]','roadmap',true,'Bot',150),
('security','Security','Security Center','MFA, IP/geo rules, certs, keys and compliance.','["MFA controls","IP whitelisting","Geo restrictions","Security event monitoring","Penetration test reports","Vulnerability management","SSL certificates","Encryption keys","Compliance monitoring"]','available',true,'ShieldCheck',160)
on conflict (key) do update set category=excluded.category, name=excluded.name, description=excluded.description,
  features=excluded.features, status=excluded.status, icon=excluded.icon, sort=excluded.sort, updated_at=now();

-- Storage provision for plugin/component/backup uploads.
insert into storage.buckets (id, name, public, file_size_limit)
values ('tech-artifacts','tech-artifacts', false, 524288000) on conflict (id) do nothing;
drop policy if exists tech_artifacts_super on storage.objects;
create policy tech_artifacts_super on storage.objects for all
  using (bucket_id = 'tech-artifacts' and public.tech_is_super_admin())
  with check (bucket_id = 'tech-artifacts' and public.tech_is_super_admin());

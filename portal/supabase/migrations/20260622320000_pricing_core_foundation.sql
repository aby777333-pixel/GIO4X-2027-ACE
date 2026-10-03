-- PRICING-CORE foundation. Internal-only price-formation + revenue config. The
-- pricing schema is NOT API-exposed and RLS-gated to desk/pricing roles — the Black
-- Glass at the DB layer. Revenue writes to the shared dealer.revenue_ledger.
create schema if not exists pricing;
grant usage on schema pricing to authenticated, service_role;

alter table dealer.desk_members drop constraint if exists desk_members_role_check;
alter table dealer.desk_members add constraint desk_members_role_check
  check (role in ('dealer','risk_manager','head_of_dealing','admin','pricing_admin'));

do $$ begin
  create type pricing.spread_mode      as enum ('fixed','dynamic');
  create type pricing.markup_side      as enum ('buy','sell','dual');
  create type pricing.markup_unit      as enum ('pips','points','percent','absolute');
  create type pricing.commission_model as enum ('fixed','per_lot','percentage','volume_based');
  create type pricing.swap_side        as enum ('long','short');
  create type pricing.lp_price_routing as enum ('best_price','weighted','revenue_optimized','risk_optimized','latency_optimized');
  create type pricing.client_segment   as enum ('retail','professional','institutional','vip','high_value');
  create type pricing.behaviour_tag    as enum ('scalper','swing','position','news','arbitrage','ea','manual');
exception when duplicate_object then null; end $$;

create or replace function pricing.can_read()  returns boolean language sql stable as $$ select dealer.desk_role() in ('dealer','pricing_admin','head_of_dealing','admin') $$;
create or replace function pricing.can_write()  returns boolean language sql stable as $$ select dealer.desk_role() in ('pricing_admin','head_of_dealing','admin') $$;
create or replace function pricing.can_override() returns boolean language sql stable as $$ select dealer.desk_role() in ('dealer','head_of_dealing','admin') $$;

create table if not exists pricing.spread_config (
  id uuid primary key default gen_random_uuid(), scope_type dealer.scope_type not null, scope_ref text,
  mode pricing.spread_mode not null default 'fixed', base_value numeric not null, unit pricing.markup_unit not null default 'pips',
  min_spread numeric, max_spread numeric, priority int not null default 100, enabled boolean default true,
  updated_by uuid references public.profiles(id), updated_at timestamptz default now(), created_at timestamptz default now(),
  unique (scope_type, scope_ref, priority));
create table if not exists pricing.dynamic_spread_rules (
  id uuid primary key default gen_random_uuid(), name text not null, scope_type dealer.scope_type not null default 'global', scope_ref text,
  priority int not null, condition jsonb not null, delta_value numeric not null, unit pricing.markup_unit not null default 'pips',
  enabled boolean default true, updated_by uuid references public.profiles(id), created_at timestamptz default now());
create table if not exists pricing.spread_widening_rules (
  id uuid primary key default gen_random_uuid(), name text not null, trigger text not null, symbols text[] default '{}',
  widen_by numeric not null, unit pricing.markup_unit not null default 'pips', starts_before_secs int default 0, ends_after_secs int default 0,
  enabled boolean default true, created_at timestamptz default now());
create table if not exists pricing.spread_compression_rules (
  id uuid primary key default gen_random_uuid(), name text not null, segment pricing.client_segment, trading_group text,
  compress_by numeric not null, unit pricing.markup_unit not null default 'pips', floor_spread numeric, enabled boolean default true, created_at timestamptz default now());
create table if not exists pricing.markup_layers (
  id uuid primary key default gen_random_uuid(), layer dealer.scope_type not null, scope_ref text,
  side pricing.markup_side not null default 'dual', value numeric not null, unit pricing.markup_unit not null default 'pips',
  pct_of_volume numeric, pct_of_clients numeric, applies_regions text[] default '{}', stack_order int not null default 100,
  enabled boolean default true, updated_by uuid references public.profiles(id), updated_at timestamptz default now(), created_at timestamptz default now());
create table if not exists pricing.engine_settings (
  id int primary key default 1 check (id = 1), max_total_markup_pips numeric not null default 5, max_total_spread_pips numeric not null default 50,
  stale_feed_action text not null default 'widen', stale_feed_ms int not null default 1500,
  updated_by uuid references public.profiles(id), updated_at timestamptz default now());
insert into pricing.engine_settings (id) values (1) on conflict (id) do nothing;
create table if not exists pricing.commission_config (
  id uuid primary key default gen_random_uuid(), scope_type dealer.scope_type not null, scope_ref text,
  model pricing.commission_model not null, value numeric not null, per_side boolean default true, currency text default 'USD',
  enabled boolean default true, priority int default 100, created_at timestamptz default now());
create table if not exists pricing.swap_config (
  id uuid primary key default gen_random_uuid(), scope_type dealer.scope_type not null default 'symbol', scope_ref text,
  long_rate numeric not null default 0, short_rate numeric not null default 0, triple_day int default 3, dynamic boolean default false,
  unit pricing.markup_unit not null default 'points', enabled boolean default true, created_at timestamptz default now());
create table if not exists pricing.extraction_models (
  id uuid primary key default gen_random_uuid(), name text not null, scope_type dealer.scope_type not null default 'global', scope_ref text,
  per_lot_usd numeric, notional_bps numeric, enabled boolean default true, created_at timestamptz default now());
create table if not exists pricing.lp_markup (
  id uuid primary key default gen_random_uuid(), lp_id uuid not null references dealer.liquidity_providers(id), symbols text[] default '{}',
  side pricing.markup_side not null default 'dual', value numeric not null, unit pricing.markup_unit not null default 'pips',
  enabled boolean default true, created_at timestamptz default now());
create table if not exists pricing.lp_price_routing_config (
  id uuid primary key default gen_random_uuid(), scope_type dealer.scope_type not null default 'symbol', scope_ref text,
  mode pricing.lp_price_routing not null default 'best_price', enabled boolean default true, created_at timestamptz default now());
create table if not exists pricing.segment_pricing (
  id uuid primary key default gen_random_uuid(), segment pricing.client_segment, behaviour pricing.behaviour_tag,
  spread_delta numeric default 0, markup_delta numeric default 0, unit pricing.markup_unit not null default 'pips', enabled boolean default true, created_at timestamptz default now());
create table if not exists pricing.smart_rules (
  id uuid primary key default gen_random_uuid(), name text not null, priority int not null, condition jsonb not null, action jsonb not null,
  scope_type dealer.scope_type default 'global', scope_ref text, enabled boolean default true, updated_by uuid references public.profiles(id), created_at timestamptz default now());
create table if not exists pricing.config_audit (
  id uuid primary key default gen_random_uuid(), table_name text not null, row_id text not null, action text not null, field text,
  previous_value jsonb, new_value jsonb, changed_by uuid references public.profiles(id), approval_status text default 'applied',
  approved_by uuid references public.profiles(id), ip_address inet, device text, changed_at timestamptz default now());
create index if not exists pricing_config_audit_idx on pricing.config_audit (table_name, changed_at desc);
create table if not exists pricing.price_audit (
  id uuid primary key default gen_random_uuid(), symbol text not null, lp_id uuid references dealer.liquidity_providers(id),
  raw_bid numeric not null, raw_ask numeric not null, broker_bid numeric not null, broker_ask numeric not null,
  final_bid numeric not null, final_ask numeric not null, config_snapshot jsonb not null, captured_at timestamptz default now());
create index if not exists pricing_price_audit_idx on pricing.price_audit (symbol, captured_at desc);

create or replace function pricing.tg_config_audit() returns trigger language plpgsql security definer set search_path = pricing, public as $$
declare v_hdr json; v_ip inet; v_dev text;
begin
  begin v_hdr := current_setting('request.headers', true)::json; exception when others then v_hdr := null; end;
  begin v_ip := nullif(split_part(coalesce(v_hdr->>'x-forwarded-for',''),',',1),'')::inet; exception when others then v_ip := null; end;
  v_dev := v_hdr->>'user-agent';
  insert into pricing.config_audit (table_name, row_id, action, previous_value, new_value, changed_by, ip_address, device)
  values (TG_TABLE_NAME, coalesce((new).id, (old).id)::text, lower(TG_OP),
          case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) end, auth.uid(), v_ip, v_dev);
  return coalesce(new, old);
end; $$;

do $$ declare t text; cfg text[] := array['spread_config','dynamic_spread_rules','spread_widening_rules','spread_compression_rules',
  'markup_layers','engine_settings','commission_config','swap_config','extraction_models','lp_markup','lp_price_routing_config',
  'segment_pricing','smart_rules']; aud text[] := array['config_audit','price_audit'];
begin
  foreach t in array (cfg || aud) loop
    execute format('alter table pricing.%I enable row level security', t);
    execute format('grant select, insert, update, delete on pricing.%I to authenticated', t);
    execute format('create policy p_read on pricing.%I for select using (pricing.can_read())', t);
  end loop;
  foreach t in array cfg loop
    execute format('create policy p_write on pricing.%I for all using (pricing.can_write()) with check (pricing.can_write())', t);
    execute format('drop trigger if exists audit_cfg on pricing.%I', t);
    execute format('create trigger audit_cfg after insert or update or delete on pricing.%I for each row execute function pricing.tg_config_audit()', t);
  end loop;
end $$;

grant execute on function pricing.can_read() to authenticated;
grant execute on function pricing.can_write() to authenticated;
grant execute on function pricing.can_override() to authenticated;

-- DEALER-CORE foundation (Phase 1). OS brain in the portal DB; trade server = GIO
-- Raptor (terminal). Fully additive — own `dealer` schema, RLS on every table,
-- generic audit trail on config tables. Roles adapted to profiles/is_super_admin.
create schema if not exists dealer;
grant usage on schema dealer to authenticated, service_role;

do $$ begin
  create type dealer.book_type        as enum ('a_book','b_book','hybrid');
  create type dealer.dealing_mode     as enum ('semi_auto','full_dealer','full_stp','ecn','dma');
  create type dealer.execution_model  as enum ('market','instant','stp','ecn','dma','dealer');
  create type dealer.scope_type       as enum ('global','asset_class','symbol','trading_group','client_group','white_label','country','account_type','account');
  create type dealer.intervention_action as enum ('accept','reject','delay','requote','approve','force_route');
  create type dealer.surveillance_type as enum ('arbitrage','latency_abuse','bonus_abuse','scalping_abuse','news_trading_abuse','copy_trading_abuse','wash_trading','self_trading');
  create type dealer.hedge_type       as enum ('full','partial','dynamic','emergency');
  create type dealer.hedge_method     as enum ('lp','internal','cross_symbol','portfolio');
  create type dealer.flag_status      as enum ('open','reviewing','actioned','dismissed');
  create type dealer.lp_status        as enum ('active','degraded','offline','disabled');
exception when duplicate_object then null; end $$;

create table if not exists dealer.desk_members (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('dealer','risk_manager','head_of_dealing','admin')),
  created_at timestamptz default now()
);

create or replace function dealer.desk_role() returns text language sql stable security definer set search_path = dealer, public as $$
  select case
    when public.tech_is_super_admin() then 'admin'
    when exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then 'admin'
    else (select role from dealer.desk_members where profile_id = auth.uid())
  end;
$$;
create or replace function dealer.can_read() returns boolean language sql stable as $$ select dealer.desk_role() is not null $$;
create or replace function dealer.can_write_config() returns boolean language sql stable as $$ select dealer.desk_role() in ('head_of_dealing','admin') $$;
create or replace function dealer.can_act() returns boolean language sql stable as $$ select dealer.desk_role() in ('dealer','risk_manager','head_of_dealing','admin') $$;

create table if not exists dealer.liquidity_providers (
  id uuid primary key default gen_random_uuid(), name text not null, status dealer.lp_status not null default 'active',
  is_primary boolean default false, priority int not null default 100, routing_pct numeric default 100,
  symbols text[] default '{}', endpoint_ref text, last_heartbeat timestamptz, avg_fill_ms int, reject_rate numeric default 0,
  created_at timestamptz default now()
);
create table if not exists dealer.book_config (
  id uuid primary key default gen_random_uuid(), scope_type dealer.scope_type not null, scope_ref text,
  book dealer.book_type not null default 'b_book', dealing_mode dealer.dealing_mode not null default 'full_stp',
  execution_model dealer.execution_model not null default 'market', volume_threshold_lots numeric, profit_threshold_usd numeric,
  max_slippage_points int default 30, max_deviation_points int default 50, order_timeout_ms int default 3000,
  requires_dealer boolean default false, enabled boolean default true, priority int not null default 100,
  updated_by uuid references public.profiles(id), updated_at timestamptz default now(), created_at timestamptz default now(),
  unique (scope_type, scope_ref, priority)
);
create table if not exists dealer.routing_rules (
  id uuid primary key default gen_random_uuid(), name text not null, scope_type dealer.scope_type not null default 'global',
  scope_ref text, priority int not null, condition jsonb not null, target_book dealer.book_type not null,
  target_lp_id uuid references dealer.liquidity_providers(id), enabled boolean default true,
  updated_by uuid references public.profiles(id), updated_at timestamptz default now(), created_at timestamptz default now()
);
create table if not exists dealer.positions (
  id uuid primary key default gen_random_uuid(), ticket bigint not null, account_id text not null, symbol text not null,
  side text not null check (side in ('buy','sell')), volume_lots numeric not null, open_price numeric not null,
  current_price numeric, book dealer.book_type not null, lp_id uuid references dealer.liquidity_providers(id),
  floating_pnl numeric, opened_at timestamptz, synced_at timestamptz default now(), unique (ticket)
);
create index if not exists positions_symbol_book_idx on dealer.positions (symbol, book);
create index if not exists positions_account_idx on dealer.positions (account_id);
create table if not exists dealer.exposure_snapshots (
  id uuid primary key default gen_random_uuid(), dimension text not null, ref text not null,
  long_lots numeric not null default 0, short_lots numeric not null default 0, net_lots numeric not null default 0,
  gross_lots numeric not null default 0, net_usd numeric, captured_at timestamptz default now()
);
create index if not exists exposure_dim_ref_idx on dealer.exposure_snapshots (dimension, ref, captured_at desc);
create table if not exists dealer.client_risk_scores (
  account_id text primary key, win_rate numeric, profit_factor numeric, max_drawdown numeric, avg_hold_secs int,
  strategy_tag text, lifetime_pnl numeric, risk_score int not null default 50,
  toxic boolean generated always as (risk_score >= 70) stored, computed_at timestamptz default now()
);
create table if not exists dealer.book_switch_log (
  id uuid primary key default gen_random_uuid(), account_id text not null, from_book dealer.book_type,
  to_book dealer.book_type not null, reason text not null, triggered_by text not null, rule_snapshot jsonb,
  approved_by uuid references public.profiles(id), created_at timestamptz default now()
);
create table if not exists dealer.intervention_queue (
  id uuid primary key default gen_random_uuid(), order_ref text not null, account_id text not null, symbol text not null,
  volume_lots numeric not null, requested_at timestamptz default now(), expires_at timestamptz, status text not null default 'pending',
  decided_by uuid references public.profiles(id), decision dealer.intervention_action, decided_at timestamptz
);
create table if not exists dealer.actions_log (
  id uuid primary key default gen_random_uuid(), dealer_id uuid references public.profiles(id),
  action dealer.intervention_action not null, target_type text not null, target_ref text not null, detail jsonb,
  created_at timestamptz default now()
);
create table if not exists dealer.hedge_orders (
  id uuid primary key default gen_random_uuid(), hedge_type dealer.hedge_type not null, method dealer.hedge_method not null,
  symbol text not null, volume_lots numeric not null, lp_id uuid references dealer.liquidity_providers(id),
  trigger_reason text not null, trigger_value numeric, status text not null default 'pending', bridge_ref text,
  created_at timestamptz default now(), filled_at timestamptz
);
create table if not exists dealer.surveillance_flags (
  id uuid primary key default gen_random_uuid(), type dealer.surveillance_type not null, account_id text not null,
  severity int not null default 1, evidence jsonb not null, status dealer.flag_status not null default 'open',
  auto_action text, reviewed_by uuid references public.profiles(id), created_at timestamptz default now()
);
create table if not exists dealer.revenue_ledger (
  id uuid primary key default gen_random_uuid(), account_id text not null, symbol text, source text not null,
  amount_usd numeric not null, book dealer.book_type, lp_id uuid references dealer.liquidity_providers(id), ref text,
  occurred_at timestamptz default now()
);
create index if not exists revenue_account_idx on dealer.revenue_ledger (account_id, occurred_at desc);
create index if not exists revenue_source_idx on dealer.revenue_ledger (source, occurred_at desc);
create table if not exists dealer.alerts (
  id uuid primary key default gen_random_uuid(), severity text not null, category text not null, title text not null,
  body text, context jsonb, acknowledged boolean default false, ack_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
create table if not exists dealer.audit_trail (
  id uuid primary key default gen_random_uuid(), table_name text not null, op text not null, row_id text,
  actor_id uuid, old_data jsonb, new_data jsonb, created_at timestamptz default now()
);
create or replace function dealer.tg_audit() returns trigger language plpgsql security definer set search_path = dealer, public as $$
begin
  insert into dealer.audit_trail (table_name, op, row_id, actor_id, old_data, new_data)
  values (TG_TABLE_NAME, TG_OP, coalesce((new).id, (old).id)::text, auth.uid(),
          case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end; $$;
drop trigger if exists audit_book_config on dealer.book_config;
create trigger audit_book_config after insert or update or delete on dealer.book_config for each row execute function dealer.tg_audit();
drop trigger if exists audit_routing_rules on dealer.routing_rules;
create trigger audit_routing_rules after insert or update or delete on dealer.routing_rules for each row execute function dealer.tg_audit();
drop trigger if exists audit_lps on dealer.liquidity_providers;
create trigger audit_lps after insert or update or delete on dealer.liquidity_providers for each row execute function dealer.tg_audit();

do $$ declare t text; begin
  foreach t in array array['desk_members','liquidity_providers','book_config','routing_rules','positions',
    'exposure_snapshots','client_risk_scores','book_switch_log','intervention_queue','actions_log',
    'hedge_orders','surveillance_flags','revenue_ledger','alerts','audit_trail'] loop
    execute format('alter table dealer.%I enable row level security', t);
    execute format('grant select, insert, update, delete on dealer.%I to authenticated', t);
  end loop;
end $$;

create policy r_read  on dealer.book_config         for select using (dealer.can_read());
create policy r_write on dealer.book_config         for all    using (dealer.can_write_config()) with check (dealer.can_write_config());
create policy r_read  on dealer.routing_rules       for select using (dealer.can_read());
create policy r_write on dealer.routing_rules       for all    using (dealer.can_write_config()) with check (dealer.can_write_config());
create policy r_read  on dealer.liquidity_providers for select using (dealer.can_read());
create policy r_write on dealer.liquidity_providers for all    using (dealer.can_write_config()) with check (dealer.can_write_config());
create policy r_read  on dealer.desk_members        for select using (dealer.can_read());
create policy r_write on dealer.desk_members        for all    using (dealer.can_write_config()) with check (dealer.can_write_config());
create policy r_read  on dealer.intervention_queue  for select using (dealer.can_read());
create policy r_write on dealer.intervention_queue  for all    using (dealer.can_act()) with check (dealer.can_act());
create policy r_read  on dealer.actions_log         for select using (dealer.can_read());
create policy r_write on dealer.actions_log         for all    using (dealer.can_act()) with check (dealer.can_act());
create policy r_read  on dealer.positions           for select using (dealer.can_read());
create policy r_write on dealer.positions           for all    using (dealer.can_write_config()) with check (dealer.can_write_config());
create policy r_read  on dealer.exposure_snapshots  for select using (dealer.can_read());
create policy r_write on dealer.exposure_snapshots  for all    using (dealer.can_write_config()) with check (dealer.can_write_config());
create policy r_read  on dealer.client_risk_scores  for select using (dealer.can_read());
create policy r_write on dealer.client_risk_scores  for all    using (dealer.can_write_config()) with check (dealer.can_write_config());
create policy r_read  on dealer.book_switch_log     for select using (dealer.can_read());
create policy r_write on dealer.book_switch_log     for all    using (dealer.can_act()) with check (dealer.can_act());
create policy r_read  on dealer.hedge_orders        for select using (dealer.can_read());
create policy r_write on dealer.hedge_orders        for all    using (dealer.can_act()) with check (dealer.can_act());
create policy r_read  on dealer.surveillance_flags  for select using (dealer.can_read());
create policy r_write on dealer.surveillance_flags  for all    using (dealer.can_act()) with check (dealer.can_act());
create policy r_read  on dealer.revenue_ledger      for select using (dealer.can_read());
create policy r_write on dealer.revenue_ledger      for all    using (dealer.can_write_config()) with check (dealer.can_write_config());
create policy r_read  on dealer.alerts              for select using (dealer.can_read());
create policy r_write on dealer.alerts              for all    using (dealer.can_act()) with check (dealer.can_act());
create policy r_read  on dealer.audit_trail         for select using (dealer.can_read());

grant execute on function dealer.desk_role() to authenticated;
grant execute on function dealer.can_read() to authenticated;
grant execute on function dealer.can_write_config() to authenticated;
grant execute on function dealer.can_act() to authenticated;

-- Public RPC wrappers so the Dealer Cockpit (thin shell) can read the `dealer`
-- schema (not API-exposed). Gated by dealer.can_read(). + minimal seed.
create or replace function public.dealer_overview()
returns jsonb language plpgsql security definer set search_path = public, dealer stable as $$
begin
  if not dealer.can_read() then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'book_configs', (select count(*) from dealer.book_config),
    'routing_rules', (select count(*) from dealer.routing_rules where enabled),
    'lps', (select coalesce(jsonb_agg(jsonb_build_object('name',name,'status',status,'is_primary',is_primary,'priority',priority,'reject_rate',reject_rate,'avg_fill_ms',avg_fill_ms) order by priority), '[]'::jsonb) from dealer.liquidity_providers),
    'lp_active', (select count(*) from dealer.liquidity_providers where status='active'),
    'lp_total', (select count(*) from dealer.liquidity_providers),
    'open_interventions', (select count(*) from dealer.intervention_queue where status='pending'),
    'open_flags', (select count(*) from dealer.surveillance_flags where status='open'),
    'toxic_clients', (select count(*) from dealer.client_risk_scores where toxic),
    'recent_switches', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select account_id, from_book, to_book, reason, triggered_by, created_at from dealer.book_switch_log order by created_at desc limit 10) t),
    'recent_alerts', (select coalesce(jsonb_agg(a), '[]'::jsonb) from (select severity, category, title, created_at from dealer.alerts where not acknowledged order by created_at desc limit 10) a),
    'exposure', (select coalesce(jsonb_agg(e), '[]'::jsonb) from (select ref, net_lots, gross_lots from dealer.exposure_snapshots where dimension='symbol' and captured_at >= now()-interval '15 minutes' order by abs(net_lots) desc limit 12) e),
    'revenue_today', (select coalesce(sum(amount_usd),0) from dealer.revenue_ledger where occurred_at >= date_trunc('day', now()))
  );
end; $$;

create or replace function public.dealer_book_configs()
returns jsonb language plpgsql security definer set search_path = public, dealer stable as $$
begin
  if not dealer.can_read() then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
     'id',id,'scope_type',scope_type,'scope_ref',scope_ref,'book',book,'dealing_mode',dealing_mode,
     'execution_model',execution_model,'volume_threshold_lots',volume_threshold_lots,'profit_threshold_usd',profit_threshold_usd,
     'max_slippage_points',max_slippage_points,'max_deviation_points',max_deviation_points,'order_timeout_ms',order_timeout_ms,
     'requires_dealer',requires_dealer,'enabled',enabled,'priority',priority) order by priority), '[]'::jsonb)
   from dealer.book_config);
end; $$;

revoke all on function public.dealer_overview() from public, anon;
revoke all on function public.dealer_book_configs() from public, anon;
grant execute on function public.dealer_overview() to authenticated;
grant execute on function public.dealer_book_configs() to authenticated;

insert into dealer.book_config (scope_type, scope_ref, book, dealing_mode, execution_model, priority)
values ('global', null, 'b_book', 'full_stp', 'market', 100)
on conflict (scope_type, scope_ref, priority) do nothing;
insert into dealer.liquidity_providers (name, status, is_primary, priority, avg_fill_ms, reject_rate)
values ('LP Prime', 'active', true, 10, 42, 0.004), ('LP Edge', 'active', false, 50, 80, 0.012)
on conflict do nothing;

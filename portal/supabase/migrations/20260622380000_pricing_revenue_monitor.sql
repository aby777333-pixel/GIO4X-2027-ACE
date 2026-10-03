-- Revenue Monitor reads the SHARED dealer.revenue_ledger. Gated by pricing.can_read.
create or replace function public.pricing_revenue()
returns jsonb language plpgsql security definer set search_path = public, dealer, pricing stable as $$
begin
  if not pricing.can_read() then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'total',   (select coalesce(sum(amount_usd),0) from dealer.revenue_ledger),
    'today',   (select coalesce(sum(amount_usd),0) from dealer.revenue_ledger where occurred_at >= date_trunc('day', now())),
    'last_7d', (select coalesce(sum(amount_usd),0) from dealer.revenue_ledger where occurred_at >= now()-interval '7 days'),
    'by_source', (select coalesce(jsonb_agg(x order by x.amt desc), '[]') from (select source, round(sum(amount_usd),2) amt from dealer.revenue_ledger group by source) x),
    'by_symbol', (select coalesce(jsonb_agg(x order by x.amt desc), '[]') from (select symbol, round(sum(amount_usd),2) amt from dealer.revenue_ledger where symbol is not null group by symbol order by sum(amount_usd) desc limit 15) x),
    'by_book', (select coalesce(jsonb_agg(x), '[]') from (select coalesce(book::text,'unbooked') book, round(sum(amount_usd),2) amt from dealer.revenue_ledger group by book) x),
    'recent', (select coalesce(jsonb_agg(y), '[]') from (select symbol, source, round(amount_usd,2) amount, book, occurred_at from dealer.revenue_ledger order by occurred_at desc limit 20) y),
    'rows', (select count(*) from dealer.revenue_ledger));
end; $$;
revoke all on function public.pricing_revenue() from public, anon;
grant execute on function public.pricing_revenue() to authenticated;

-- Idempotent ingest of Raptor-derived revenue (full-replace of ref='raptor' rows).
create or replace function public.dealer_revenue_ingest(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public, dealer as $$
declare v int := 0;
begin
  if not (coalesce(dealer.can_write_config(), false) or auth.role() = 'service_role') then raise exception 'forbidden'; end if;
  delete from dealer.revenue_ledger where ref = 'raptor' and id is not null;
  insert into dealer.revenue_ledger (account_id, symbol, source, amount_usd, book, ref)
  select x->>'account_id', x->>'symbol', x->>'source', (x->>'amount_usd')::numeric, nullif(x->>'book','')::dealer.book_type, 'raptor'
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x;
  get diagnostics v = row_count;
  return jsonb_build_object('rows', v);
end; $$;
revoke all on function public.dealer_revenue_ingest(jsonb) from public, anon;
grant execute on function public.dealer_revenue_ingest(jsonb) to authenticated, service_role;

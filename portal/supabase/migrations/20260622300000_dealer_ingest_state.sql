-- Ingest synced positions + computed exposure into the dealer schema. The portal
-- reads GIO Raptor positions, runs dealer-core aggregateExposure, then calls this.
-- Full-replace of the position mirror each sync. Gated to desk writers / service role.
create or replace function public.dealer_ingest_state(p_positions jsonb, p_exposure jsonb)
returns jsonb language plpgsql security definer set search_path = public, dealer as $$
declare v_pos int := 0; v_exp int := 0;
begin
  if not (coalesce(dealer.can_write_config(), false) or auth.role() = 'service_role') then
    raise exception 'forbidden';
  end if;

  delete from dealer.positions;
  insert into dealer.positions (ticket, account_id, symbol, side, volume_lots, open_price, current_price, book, floating_pnl, opened_at)
  select (x->>'ticket')::bigint, x->>'account_id', x->>'symbol', x->>'side', (x->>'volume_lots')::numeric,
         (x->>'open_price')::numeric, nullif(x->>'current_price','')::numeric, (x->>'book')::dealer.book_type,
         nullif(x->>'floating_pnl','')::numeric, nullif(x->>'opened_at','')::timestamptz
  from jsonb_array_elements(coalesce(p_positions, '[]'::jsonb)) x;
  get diagnostics v_pos = row_count;

  insert into dealer.exposure_snapshots (dimension, ref, long_lots, short_lots, net_lots, gross_lots, net_usd)
  select x->>'dimension', x->>'ref', (x->>'long')::numeric, (x->>'short')::numeric, (x->>'net')::numeric,
         (x->>'gross')::numeric, nullif(x->>'netUsd','')::numeric
  from jsonb_array_elements(coalesce(p_exposure, '[]'::jsonb)) x;
  get diagnostics v_exp = row_count;

  return jsonb_build_object('positions', v_pos, 'exposure', v_exp);
end; $$;
revoke all on function public.dealer_ingest_state(jsonb, jsonb) from public, anon;
grant execute on function public.dealer_ingest_state(jsonb, jsonb) to authenticated, service_role;

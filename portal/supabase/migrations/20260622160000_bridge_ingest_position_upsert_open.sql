-- Upgrade the bridge to mirror OPEN positions too (so the staff Trade Log + client
-- positions show live open trades), and to update an open mirror to closed when the
-- terminal position closes. Idempotent + settlement-safe:
--   • new open position       -> insert status='open' (settlement triggers early-return on non-closed)
--   • new closed position      -> insert status='closed' (triggers settle once, as before)
--   • open mirror, now closed  -> UPDATE to closed (triggers settle exactly once on the transition)
--   • already-closed mirror    -> skip (no re-settlement)
create or replace function public.bridge_ingest_position(p jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_acct uuid;
  v_user uuid;
  v_side trade_side;
  v_status trade_status;
  v_id uuid;
  v_src text := p->>'id';
  v_existing record;
begin
  if v_src is null then return null; end if;

  select portal_trading_account_id, portal_user_id into v_acct, v_user
  from public.bridge_account_map
  where raptor_account_id = (p->>'account_id')::uuid;
  if v_acct is null then return null; end if;

  v_side := (case when lower(coalesce(p->>'direction','buy')) in ('sell','short')
                  then 'sell' else 'buy' end)::trade_side;
  v_status := (case when coalesce(p->>'status','closed') = 'closed'
                    then 'closed' else 'open' end)::trade_status;

  -- Existing mirror for this source position?
  select id, status into v_existing
  from public.trades where metadata->>'source_position_id' = v_src limit 1;

  if v_existing.id is not null then
    -- Already settled — never touch it again (avoids double-settlement).
    if v_existing.status = 'closed' then return null; end if;
    -- Portal copy is open and the terminal position has now closed -> transition it.
    if v_status = 'closed' then
      update public.trades set
        status      = 'closed',
        close_price = nullif(p->>'close_price','')::numeric,
        pnl         = coalesce((p->>'realized_pnl')::numeric, 0),
        commission  = coalesce((p->>'commission')::numeric, 0),
        swap        = coalesce((p->>'swap_accrued')::numeric, 0),
        closed_at   = coalesce(nullif(p->>'closed_at','')::timestamptz, now())
      where id = v_existing.id;
      return v_existing.id;
    end if;
    -- Still open on both sides: nothing to change.
    return null;
  end if;

  -- New mirror — insert with the position's current status (open or closed).
  insert into public.trades
    (trading_account_id, user_id, ticket, symbol, side, lots, open_price, close_price,
     pnl, commission, swap, currency, status, source, opened_at, closed_at, metadata)
  values
    (v_acct, v_user, nextval('public.bridge_ticket_seq'),
     coalesce(nullif(p->>'symbol',''),'XAUUSD'),
     v_side,
     coalesce((p->>'size')::numeric, 0),
     nullif(p->>'open_price','')::numeric,
     nullif(p->>'close_price','')::numeric,
     coalesce((p->>'realized_pnl')::numeric, 0),
     coalesce((p->>'commission')::numeric, 0),
     coalesce((p->>'swap_accrued')::numeric, 0),
     'USD'::wallet_currency,
     v_status,
     'raptor',
     coalesce(nullif(p->>'opened_at','')::timestamptz, now()),
     nullif(p->>'closed_at','')::timestamptz,
     jsonb_build_object('source','raptor','source_position_id', v_src,
                        'raptor_account_id', p->>'account_id'))
  returning id into v_id;

  return v_id;
end;
$function$;

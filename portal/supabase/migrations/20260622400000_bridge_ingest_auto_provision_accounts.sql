-- Trade Log full-platform sync: auto-provision a portal mirror account + map row
-- for ANY Raptor account the bridge sees that isn't mapped yet. Previously the
-- bridge silently skipped unmapped accounts (v_acct is null -> return null), so
-- new terminal accounts never appeared in the Trade Log. The mapped branch is
-- unchanged — existing mappings (e.g. RAPTOR-MIRROR-01) behave exactly as before.
-- Pairs with the raptor-trade-bridge edge function now scanning EVERY terminal
-- position (not only mapped accounts) and passing account_number for naming.
create or replace function public.bridge_ingest_position(p jsonb)
returns uuid language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare
  v_acct uuid;
  v_user uuid;
  v_side trade_side;
  v_status trade_status;
  v_id uuid;
  v_src text := p->>'id';
  v_existing record;
  v_raptor_acct uuid;
  v_acctnum text;
begin
  if v_src is null then return null; end if;
  v_raptor_acct := nullif(p->>'account_id','')::uuid;
  if v_raptor_acct is null then return null; end if;

  select portal_trading_account_id, portal_user_id into v_acct, v_user
  from public.bridge_account_map
  where raptor_account_id = v_raptor_acct;

  -- Auto-provision a mirror account for an unmapped Raptor account so the whole
  -- platform is reflected without manual mapping.
  if v_acct is null then
    select portal_user_id into v_user from public.bridge_account_map where portal_user_id is not null limit 1;
    if v_user is null then
      select id into v_user from public.profiles where role = 'admin' order by created_at limit 1;
    end if;
    if v_user is null then return null; end if;

    v_acctnum := coalesce(nullif(p->>'account_number',''), 'RAPTOR-' || left(replace(v_raptor_acct::text,'-',''),8));
    -- Never collide with an existing (possibly real) portal account number.
    if exists (select 1 from public.trading_accounts where account_number = v_acctnum) then
      v_acctnum := 'RAPTOR-' || left(replace(v_raptor_acct::text,'-',''),12);
    end if;

    -- Clone enum/plan defaults from any existing account; mirror carries no balance.
    insert into public.trading_accounts
      (id, account_number, user_id, account_kind, leverage, base_currency, balance, equity, margin_free, status, plan_name, server, created_at, updated_at)
    select gen_random_uuid(), v_acctnum, v_user, account_kind, leverage, base_currency, 0, 0, 0, status, plan_name, 'GIO-Raptor-Live', now(), now()
    from public.trading_accounts order by created_at limit 1
    returning id into v_acct;

    insert into public.bridge_account_map (raptor_account_id, portal_trading_account_id, portal_user_id)
    values (v_raptor_acct, v_acct, v_user)
    on conflict (raptor_account_id) do nothing;

    select portal_trading_account_id, portal_user_id into v_acct, v_user
    from public.bridge_account_map where raptor_account_id = v_raptor_acct;
    if v_acct is null then return null; end if;
  end if;

  v_side := (case when lower(coalesce(p->>'direction','buy')) in ('sell','short')
                  then 'sell' else 'buy' end)::trade_side;
  v_status := (case when coalesce(p->>'status','closed') = 'closed'
                    then 'closed' else 'open' end)::trade_status;

  select id, status into v_existing
  from public.trades where metadata->>'source_position_id' = v_src limit 1;

  if v_existing.id is not null then
    if v_existing.status = 'closed' then return null; end if;
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
    return null;
  end if;

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
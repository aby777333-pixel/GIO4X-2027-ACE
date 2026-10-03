-- Raptor terminal -> portal trade bridge (additive only).
-- The live GIO RAPTOR terminal runs on a SEPARATE Supabase project
-- (leumpgkfillgeyyfptef). This bridge maps a terminal trading account to a
-- portal trading account and ingests terminal positions into public.trades
-- idempotently. The existing trades_copy_mirror / trades_pamm_apply /
-- trades_settled triggers then populate Copy + PAMM automatically.
--
-- Write-path is the single SECURITY DEFINER function bridge_ingest_position(),
-- reused by the one-time backfill and the scheduled raptor-trade-bridge edge
-- function. Nothing in the terminal app changes.

create table if not exists public.bridge_account_map (
  raptor_account_id uuid primary key,
  portal_trading_account_id uuid not null references public.trading_accounts(id) on delete cascade,
  portal_user_id uuid not null,
  created_at timestamptz not null default now()
);

-- internal mapping table — never exposed to anon/authenticated
alter table public.bridge_account_map enable row level security;

create sequence if not exists public.bridge_ticket_seq start with 9000001;

create or replace function public.bridge_ingest_position(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_acct uuid;
  v_user uuid;
  v_side trade_side;
  v_status trade_status;
  v_id uuid;
  v_src text := p->>'id';
begin
  if v_src is null then return null; end if;

  select portal_trading_account_id, portal_user_id into v_acct, v_user
  from public.bridge_account_map
  where raptor_account_id = (p->>'account_id')::uuid;
  if v_acct is null then return null; end if;

  -- idempotent: skip if this source position has already been mirrored
  if exists (select 1 from public.trades where metadata->>'source_position_id' = v_src) then
    return null;
  end if;

  v_side := (case when lower(coalesce(p->>'direction','buy')) in ('sell','short')
                  then 'sell' else 'buy' end)::trade_side;
  v_status := (case when coalesce(p->>'status','closed') = 'closed'
                    then 'closed' else 'open' end)::trade_status;

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
$$;

revoke all on function public.bridge_ingest_position(jsonb) from public;
grant execute on function public.bridge_ingest_position(jsonb) to service_role;

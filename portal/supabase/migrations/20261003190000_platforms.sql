-- 20261003190000_platforms.sql
--
-- Two trading platforms: 777 Raptor and MetaTrader 5.
--
-- Until now an account's platform was implied (everything was Raptor). It becomes a
-- fact of the record, so that every screen, report and bridge can tell them apart:
--
--   trading_accounts.platform   'raptor' | 'mt5'     which platform the account lives on
--   trades.platform             'raptor' | 'mt5'     copied from the account when a trade is written
--   account_types.platforms     {'raptor','mt5'}     on which platforms a type is offered
--
-- Every existing account and trade is Raptor, which is what they are.
--
-- open_trading_account_on(platform, kind, currency, leverage, plan) is what the portal
-- calls to open an account on a chosen platform. The original open_trading_account is
-- untouched and still opens a Raptor account.
--
-- MetaTrader 5 is PROVIDED FOR, NOT SWITCHED ON. An MT5 account in this table means
-- nothing until a real login exists on an MT5 server, and nothing here can create one:
-- that needs the MT5 Manager API bridge. So opening an MT5 account is refused while the
-- feature flag 'platform_mt5' is off (it is created off). Switch it on only when the
-- bridge that creates the login, and the one that delivers MT5 trades into
-- public.trades with platform = 'mt5', are running. See docs/PLATFORMS.md.
--
-- ROLLBACK
--   drop function if exists public.open_trading_account_on(text, public.account_kind, public.wallet_currency, integer, text);
--   drop trigger if exists trades_platform on public.trades;
--   drop function if exists public.tg_trades_platform();
--   delete from public.feature_flags where key = 'platform_mt5';
--   alter table public.account_types drop column if exists platforms;
--   alter table public.trades drop column if exists platform;
--   alter table public.trading_accounts drop column if exists platform;

alter table public.trading_accounts add column if not exists platform text not null default 'raptor';
alter table public.trading_accounts drop constraint if exists trading_accounts_platform_valid;
alter table public.trading_accounts add constraint trading_accounts_platform_valid check (platform in ('raptor', 'mt5'));

alter table public.trades add column if not exists platform text not null default 'raptor';
alter table public.trades drop constraint if exists trades_platform_valid;
alter table public.trades add constraint trades_platform_valid check (platform in ('raptor', 'mt5'));

alter table public.account_types add column if not exists platforms text[] not null default '{raptor,mt5}';
alter table public.account_types drop constraint if exists account_types_platforms_valid;
alter table public.account_types add constraint account_types_platforms_valid
  check (platforms <@ array['raptor', 'mt5']::text[] and cardinality(platforms) >= 1);

create index if not exists trading_accounts_platform_idx on public.trading_accounts (platform);
create index if not exists trades_platform_idx on public.trades (platform, opened_at desc);

-- A trade is on the platform of its account, whoever writes it.
create or replace function public.tg_trades_platform() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.trading_account_id is not null then
    select a.platform into new.platform from public.trading_accounts a where a.id = new.trading_account_id;
  end if;
  new.platform := coalesce(new.platform, 'raptor');
  return new;
end;
$$;
revoke all on function public.tg_trades_platform() from public, anon, authenticated;
drop trigger if exists trades_platform on public.trades;
create trigger trades_platform before insert on public.trades for each row execute function public.tg_trades_platform();

insert into public.feature_flags (key, enabled, description)
values ('platform_mt5', false, 'MetaTrader 5 accounts can be opened in the portal. Switch on only when the MT5 Manager bridge creates the login and delivers MT5 trades.')
on conflict (key) do nothing;

create or replace function public.open_trading_account_on(
  p_platform text,
  p_kind     public.account_kind,
  p_currency public.wallet_currency,
  p_leverage integer,
  p_plan     text
) returns public.trading_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row     public.trading_accounts%rowtype;
  v_enabled boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'open_trading_account: sign in required';
  end if;
  if p_platform is null or p_platform not in ('raptor', 'mt5') then
    raise exception 'open_trading_account: choose 777 Raptor or MetaTrader 5';
  end if;
  if p_platform = 'mt5' then
    select f.enabled into v_enabled from public.feature_flags f where f.key = 'platform_mt5';
    if not coalesce(v_enabled, false) then
      raise exception 'open_trading_account: MetaTrader 5 accounts are not open yet';
    end if;
  end if;
  if p_plan is not null and exists (select 1 from public.account_types t where t.name = p_plan and t.active and not (p_platform = any (t.platforms))) then
    raise exception 'open_trading_account: this account type is not offered on that platform';
  end if;

  -- the original function mints the number and writes the row, with its own checks
  v_row := public.open_trading_account(p_kind, p_currency, p_leverage, p_plan);

  if p_platform = 'mt5' then
    update public.trading_accounts
       set platform = 'mt5',
           server = case when p_kind = 'demo' then 'GIO4X-MT5-Demo' else 'GIO4X-MT5-Live' end,
           updated_at = now()
     where id = v_row.id
     returning * into v_row;
  end if;
  return v_row;
end;
$$;

revoke all on function public.open_trading_account_on(text, public.account_kind, public.wallet_currency, integer, text) from public, anon;
grant execute on function public.open_trading_account_on(text, public.account_kind, public.wallet_currency, integer, text) to authenticated, service_role;

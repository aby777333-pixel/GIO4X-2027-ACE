# Two platforms: 777 Raptor and MetaTrader 5

GIO4X offers two trading platforms. This is where each one is provided for, what is connected today,
and what has to exist before MetaTrader 5 is switched on. Written 3 October 2026.

## What is true today

| | 777 Raptor | MetaTrader 5 |
|---|---|---|
| Website | `/platforms/raptor`, compared at `/platforms/compare` | `/platforms/metatrader-5`, compared at `/platforms/compare` |
| Accounts in the portal | opened in the portal, live on the Raptor terminal | **provided for, switched off** |
| Trades into the portal | delivered by the Raptor bridge (`trades.source = 'raptor'`) | no bridge yet |
| Per-symbol settings, trading blocks | Control → Broker Controls (the terminal's database) | not connected: they live on the MT5 server |

## Where the platform is recorded (portal database)

`portal/supabase/migrations/20261003190000_platforms.sql`:

- `trading_accounts.platform`: `raptor` or `mt5`. Every existing account is `raptor`.
- `trades.platform`: copied from the account by a trigger when a trade is written, whoever writes it.
- `account_types.platforms`: on which platforms an account type is offered (both, by default).
- `open_trading_account_on(platform, kind, currency, leverage, plan)`: what the portal's "Open account"
  form calls. It refuses a type that is not offered on the chosen platform.
- Feature flag `platform_mt5`, created **off**. While it is off, opening an MT5 account is refused by the
  database and the portal's form shows MetaTrader 5 as "not open yet".

Control shows the platform beside every trading account (Broker Controls, a client's page) and every
trade (Trade Log).

## Why MetaTrader 5 is off

A row in `trading_accounts` is only a record. An MT5 account exists when a login exists on an MT5 server,
and nothing in this repository can create one. Opening "MT5 accounts" in the portal before that would
give clients an account number that logs in to nothing.

## What switching it on needs

1. **An MT5 server and Manager API access** (owner: decision D4 in `docs/BACKOFFICE-PLAN.md`): server
   address, manager login, and the groups each account type maps to.
2. **An account bridge**: when the portal opens an MT5 account, create the login on the server (group from
   the account type, leverage, currency), and write the server's login back as `account_number` and the
   real server name as `server`. The portal already has this shape for Raptor
   (`bridge_account_map`, `bridge_secrets`, `sync_trading_accounts_to_terminal`); MT5 needs its own
   adapter beside it, not a change to Raptor's.
3. **A trade bridge**: deliver MT5 deals into `public.trades` with the account's id. The platform column
   is filled by the trigger; commission, IB rebates, copy and PAMM then work as they do for Raptor,
   because they hang off `trades`.
4. **Balances**: deposits and withdrawals between the wallet and an MT5 account must be mirrored to the
   server (a balance operation through the Manager API) inside `transfer_funds`' flow, or the portal and
   the server will disagree.
5. **Symbols and conditions**: MT5's are managed on the MT5 server (groups, symbols). Control's Broker
   Controls would read them through the same adapter; until then that screen is Raptor only and says so.
6. Then: set `platform_mt5` to on, and narrow `account_types.platforms` for any type that is offered on
   one platform only.

Until step 6, everything a client can do is on 777 Raptor, and every figure in Control is Raptor's.

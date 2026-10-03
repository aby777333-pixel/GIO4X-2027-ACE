-- 20261003200000_client_close_guard.sql
--
-- A client account is closed only when nothing is left in it and nothing is in motion.
--
-- client_close_blockers(user) lists what still stands in the way, as fixed codes:
--   wallet_balance        a wallet holds a balance
--   pending_transactions  a deposit or withdrawal is pending or processing
--   account_balance       a live (non-demo) trading account holds balance or equity
--   open_trades           a trade is open
--   copy                  an active copy subscription, as follower or as the provider followed
--   pamm                  an active fund investment, or a fund they manage with units outstanding
--   ib_unsettled          IB commission awaiting settlement
--   downline              people sit beneath them in the IB network
--
-- The rule is enforced where the status is written, not only where it is asked for: a
-- BEFORE UPDATE trigger on profiles refuses status → 'closed' while any blocker stands,
-- whichever path tries it (GIO4X Control, the portal's own staff console, or SQL).
-- Suspending is not affected: a client can always be suspended at once.
--
-- ROLLBACK
--   drop trigger if exists profiles_close_guard on public.profiles;
--   drop function if exists public.tg_profiles_close_guard();
--   drop function if exists public.client_close_blockers(uuid);

create or replace function public.client_close_blockers(p_user uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(b.code order by b.ord), '{}'::text[])
  from (
    select 1 as ord, 'wallet_balance' as code
     where exists (select 1 from public.wallets w where w.user_id = p_user and w.balance <> 0)
    union all
    select 2, 'pending_transactions'
     where exists (select 1 from public.wallet_transactions t join public.wallets w on w.id = t.wallet_id
                    where w.user_id = p_user and t.status in ('pending', 'processing'))
    union all
    select 3, 'account_balance'
     where exists (select 1 from public.trading_accounts a
                    where a.user_id = p_user and a.account_kind <> 'demo' and (a.balance <> 0 or a.equity <> 0))
    union all
    select 4, 'open_trades'
     where exists (select 1 from public.trades tr where tr.user_id = p_user and tr.status = 'open')
    union all
    select 5, 'copy'
     where exists (select 1 from public.copy_subscriptions c where c.follower_id = p_user and c.status = 'active')
        or exists (select 1 from public.signal_providers sp join public.copy_subscriptions c on c.provider_id = sp.id
                    where sp.user_id = p_user and c.status = 'active')
    union all
    select 6, 'pamm'
     where exists (select 1 from public.pamm_investments i where i.investor_id = p_user and i.status = 'active' and i.units > 0)
        or exists (select 1 from public.pamm_funds f where f.manager_id = p_user and f.units_outstanding > 0)
    union all
    select 7, 'ib_unsettled'
     where exists (select 1 from public.commission_ledger cl where cl.ib_user_id = p_user and not cl.settled and cl.amount <> 0)
    union all
    select 8, 'downline'
     where exists (select 1 from public.ib_relationships r where r.parent_id = p_user)
  ) b;
$$;

revoke all on function public.client_close_blockers(uuid) from public, anon, authenticated;
grant execute on function public.client_close_blockers(uuid) to service_role;

create or replace function public.tg_profiles_close_guard() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_why text[];
begin
  if new.status = 'closed' and old.status is distinct from 'closed' then
    v_why := public.client_close_blockers(new.id);
    if cardinality(v_why) > 0 then
      raise exception 'account cannot be closed yet: %', array_to_string(v_why, ', ') using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.tg_profiles_close_guard() from public, anon, authenticated;

drop trigger if exists profiles_close_guard on public.profiles;
create trigger profiles_close_guard before update of status on public.profiles
  for each row execute function public.tg_profiles_close_guard();

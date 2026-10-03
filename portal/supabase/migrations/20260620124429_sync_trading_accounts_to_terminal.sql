-- Best-effort, NON-BLOCKING mirror of portal trading accounts into the GIORAPTOR
-- terminal (project leumpgkfillgeyyfptef) so "Open in Raptor" finds the account.
-- Fires async via pg_net; the whole network call is wrapped in an exception
-- handler so a terminal outage / bad response can NEVER fail the account write.
create or replace function public.fn_sync_account_to_terminal()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email  text;
  v_isdemo boolean;
  v_type   text;
begin
  -- Skip archived/closed accounts.
  if NEW.account_kind = 'archived' or NEW.status in ('archived', 'closed') then
    return NEW;
  end if;

  select email into v_email from public.profiles where id = NEW.user_id;
  if v_email is null then
    return NEW;
  end if;

  v_isdemo := (NEW.account_kind = 'demo');
  v_type   := case when NEW.account_kind = 'demo' then 'demo' else 'standard' end;

  begin
    perform net.http_post(
      url     := 'https://leumpgkfillgeyyfptef.supabase.co/rest/v1/rpc/sync_account_from_portal',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey',        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxldW1wZ2tmaWxsZ2V5eWZwdGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMzA0NzEsImV4cCI6MjA5MDYwNjQ3MX0.5XRti-gTh1KOuTE_xogRY1Kq1rgEtzela_ScA1-K1Zw',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxldW1wZ2tmaWxsZ2V5eWZwdGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMzA0NzEsImV4cCI6MjA5MDYwNjQ3MX0.5XRti-gTh1KOuTE_xogRY1Kq1rgEtzela_ScA1-K1Zw'
      ),
      body    := jsonb_build_object(
        'p_secret',         'gio4x_term_sync_2026_9f2a7c14e8b6d35041ab',
        'p_email',          v_email,
        'p_account_number', NEW.account_number,
        'p_account_type',   v_type,
        'p_currency',       NEW.base_currency,
        'p_leverage',       NEW.leverage,
        'p_balance',        NEW.balance,
        'p_is_demo',        v_isdemo
      )
    );
  exception when others then
    -- never let the mirror break the portal account write
    null;
  end;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_account_to_terminal on public.trading_accounts;
create trigger trg_sync_account_to_terminal
after insert or update of balance, status, account_kind, base_currency, leverage
on public.trading_accounts
for each row execute function public.fn_sync_account_to_terminal();

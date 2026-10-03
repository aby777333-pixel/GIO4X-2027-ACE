-- 20261003180000_control_trade_email.sql
--
-- Two more things GIO4X Control does here, each executable by service_role ONLY.
--
-- 1. control_trade_record: a closed trade entered by hand (a correction, or a trade the
--    platform bridge did not deliver). It is written exactly as staff_record_trade writes
--    one, so the same triggers run: the per-lot commission is charged, IB rebates are
--    distributed, a copied or managed account is updated. The row is marked
--    source = 'manual' and carries who entered it in metadata. It is not edited or
--    deleted afterwards.
--
-- 2. Service e-mail to clients. Control sends the messages itself (it holds the mail
--    provider's key); this database supplies the audience and keeps the record:
--      control_email_audience(audience)  the addresses of one fixed audience
--      control_email_log(...)            one row in email_logs for what was sent
--    Audiences are fixed here so that no address is typed or pasted by staff:
--      clients_active   every active client (trader, ib, affiliate)
--      ibs_active       every active introducing broker and affiliate
--      kyc_incomplete   active clients whose verification is not approved
--
-- ROLLBACK
--   drop function if exists public.control_trade_record(uuid, text, text, numeric, numeric, numeric, numeric, bigint, text);
--   drop function if exists public.control_email_audience(text);
--   drop function if exists public.control_email_log(text, text, text, text[], text, integer, integer, text, text);

create or replace function public.control_trade_record(
  p_account uuid, p_symbol text, p_side text, p_lots numeric, p_open numeric, p_close numeric, p_pnl numeric, p_ticket bigint, p_actor text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := nullif(btrim(left(coalesce(p_actor, ''), 120)), '');
  v_acc   public.trading_accounts%rowtype;
  v_sym   text := upper(btrim(coalesce(p_symbol, '')));
  v_id    uuid;
begin
  if v_actor is null then raise exception 'control_trade_record: actor required'; end if;
  if v_sym !~ '^[A-Z0-9._]{3,20}$' or p_side is null or p_side not in ('buy', 'sell') then return jsonb_build_object('result', 'invalid'); end if;
  if p_lots is null or p_lots <= 0 or p_lots > 1000 or p_open is null or p_open <= 0 or p_close is null or p_close <= 0 or p_pnl is null then
    return jsonb_build_object('result', 'invalid');
  end if;
  select * into v_acc from public.trading_accounts where id = p_account;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_acc.status <> 'active' then return jsonb_build_object('result', 'account_not_active'); end if;
  if p_ticket is not null and exists (select 1 from public.trades t where t.ticket = p_ticket) then return jsonb_build_object('result', 'duplicate'); end if;

  insert into public.trades (ticket, trading_account_id, user_id, symbol, side, lots, open_price, close_price, pnl, currency, status, source, closed_at, metadata)
  values (p_ticket, v_acc.id, v_acc.user_id, v_sym, p_side::public.trade_side, p_lots, p_open, p_close, p_pnl, v_acc.base_currency, 'closed', 'manual', now(),
          jsonb_build_object('control', jsonb_build_object('by', v_actor, 'at', now())))
  returning id into v_id;
  return jsonb_build_object('result', 'ok', 'id', v_id);
end;
$$;

create or replace function public.control_email_audience(p_audience text)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(x.email order by x.email), '{}'::text[])
  from (
    select distinct lower(p.email::text) as email
    from public.profiles p
    where p.email is not null and p.email::text ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      and p.status = 'active'
      and case p_audience
            when 'clients_active' then p.role in ('trader', 'ib', 'affiliate')
            when 'ibs_active' then p.role in ('ib', 'affiliate')
            when 'kyc_incomplete' then p.role in ('trader', 'ib', 'affiliate') and p.kyc_status <> 'approved'
            else false
          end
    limit 2000
  ) x;
$$;

create or replace function public.control_email_log(
  p_audience text, p_subject text, p_body text, p_recipients text[], p_status text, p_sent integer, p_failed integer, p_error text, p_actor text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := nullif(btrim(left(coalesce(p_actor, ''), 120)), '');
  v_id    uuid;
begin
  if v_actor is null then raise exception 'control_email_log: actor required'; end if;
  if p_status is null or p_status not in ('sent', 'partial', 'failed') then raise exception 'control_email_log: bad status'; end if;
  insert into public.email_logs (sent_by, recipients, subject, body, attachment_names, template_id, status, sent_count, failed_count, error_message, metadata)
  values (null, coalesce(p_recipients, '{}'::text[]), left(coalesce(p_subject, ''), 200), left(coalesce(p_body, ''), 20000), '{}'::text[], null, p_status,
          greatest(coalesce(p_sent, 0), 0), greatest(coalesce(p_failed, 0), 0), nullif(left(coalesce(p_error, ''), 300), ''),
          jsonb_build_object('audience', p_audience, 'control', jsonb_build_object('by', v_actor, 'at', now())))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.control_trade_record(uuid, text, text, numeric, numeric, numeric, numeric, bigint, text) from public, anon, authenticated;
revoke all on function public.control_email_audience(text) from public, anon, authenticated;
revoke all on function public.control_email_log(text, text, text, text[], text, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.control_trade_record(uuid, text, text, numeric, numeric, numeric, numeric, bigint, text) to service_role;
grant execute on function public.control_email_audience(text) to service_role;
grant execute on function public.control_email_log(text, text, text, text[], text, integer, integer, text, text) to service_role;

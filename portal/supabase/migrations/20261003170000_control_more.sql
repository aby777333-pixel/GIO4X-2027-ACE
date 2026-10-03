-- 20261003170000_control_more.sql
--
-- Four more things GIO4X Control does in this database.
--
-- 1. MARKETING. The IB portal's "Campaign Links" and "Marketing Materials" pages showed
--    sample data. They now read real rows:
--      * campaign links are the IB's own rows of public.referrals (name, channel in
--        sub_id, clicks, conversions), which staff can also create for an IB;
--      * materials are rows of the new table public.marketing_materials: a title, a
--        kind, a description and an https address of the file. Staff add, change and
--        retire them in Control; a signed-in portal user reads the active ones.
--        Files are not stored here: the address points at wherever the file is hosted.
--
-- 2. CLIENTS. control_client_detail(id): one client as a back office needs to see them
--    (profile, wallets, trading accounts, KYC documents, latest wallet transactions and
--    trades). control_more('client_status'): activate, suspend or close a client. Staff
--    and admin profiles are not changed from Control.
--
-- 3. FEES BY HAND. control_more('fee_charge'): charge a fee of a stated amount to a
--    client's main wallet (charge_fee does the journal and the debit). 'fee_waive': a
--    pending charge is waived. 'fee_reverse': an applied charge is reversed: the journal
--    is reversed, the wallet is credited back, and the charge is marked reversed. Each
--    can be done once.
--
-- All of it is executable by service_role ONLY; Control decides who may ask and writes
-- its own audit entry first. Nothing is deleted.
--
-- ROLLBACK
--   drop function if exists public.control_more(text, jsonb, text);
--   drop function if exists public.control_client_detail(uuid);
--   drop table if exists public.marketing_materials;

create table if not exists public.marketing_materials (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  kind        text not null default 'other',
  description text,
  url         text not null,
  language    text not null default 'en',
  sort        integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint marketing_materials_kind_valid check (kind in ('banner', 'logo', 'video', 'document', 'copy', 'landing_page', 'other')),
  constraint marketing_materials_url_https check (url ~ '^https://[^[:space:]]+$' and char_length(url) <= 500),
  constraint marketing_materials_title_len check (char_length(title) between 1 and 160)
);
comment on table public.marketing_materials is 'Brand-approved material for introducing brokers: a title and the https address of the file. Written by GIO4X Control only.';

alter table public.marketing_materials enable row level security;
revoke all on table public.marketing_materials from anon, authenticated;
grant select on table public.marketing_materials to authenticated;
drop policy if exists marketing_materials_read on public.marketing_materials;
create policy marketing_materials_read on public.marketing_materials for select to authenticated using (active);

create or replace function public.control_client_detail(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.id is null then null else jsonb_build_object(
    'profile', jsonb_build_object('id', p.id, 'name', p.full_name, 'email', p.email::text, 'phone', p.phone, 'country', p.country, 'role', p.role::text,
                                  'status', p.status::text, 'kyc_status', p.kyc_status::text, 'referral_code', p.referral_code, 'joined', p.created_at,
                                  'referred_by', p.referred_by, 'referred_by_name', (select r.full_name from public.profiles r where r.id = p.referred_by)),
    'wallets', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'wallet_id', w.wallet_id, 'type', w.type::text, 'currency', w.currency::text, 'balance', w.balance, 'status', w.status::text,
                                                             'reserved', coalesce((select sum(t.amount) from public.wallet_transactions t where t.wallet_id = w.id and t.type = 'withdraw' and t.status in ('pending', 'processing')), 0))
                                          order by w.type, w.currency)
                           from public.wallets w where w.user_id = p.id), '[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'account_number', a.account_number, 'kind', a.account_kind::text, 'leverage', a.leverage, 'currency', a.base_currency::text,
                                                              'balance', a.balance, 'equity', a.equity, 'status', a.status::text, 'plan', a.plan_name, 'opened', a.created_at) order by a.created_at desc)
                            from public.trading_accounts a where a.user_id = p.id), '[]'::jsonb),
    'kyc', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'doc_type', k.doc_type::text, 'file_name', k.file_name, 'status', k.status::text, 'uploaded', k.created_at,
                                                         'reviewed_at', k.reviewed_at, 'rejection_reason', k.rejection_reason) order by k.created_at desc)
                       from public.kyc_documents k where k.user_id = p.id), '[]'::jsonb),
    'transactions', coalesce((select jsonb_agg(x order by x.created_at desc) from (
                         select t.id, t.type::text as type, t.amount, t.currency::text as currency, t.status::text as status, t.gateway, t.created_at
                           from public.wallet_transactions t join public.wallets w on w.id = t.wallet_id
                          where w.user_id = p.id order by t.created_at desc limit 20) x), '[]'::jsonb),
    'trades', coalesce((select jsonb_agg(x order by x.at desc) from (
                         select tr.id, tr.ticket, tr.symbol, tr.side::text as side, tr.lots, tr.pnl, tr.currency::text as currency, tr.status::text as status,
                                coalesce(tr.closed_at, tr.opened_at, tr.created_at) as at
                           from public.trades tr where tr.user_id = p.id order by coalesce(tr.closed_at, tr.opened_at, tr.created_at) desc limit 20) x), '[]'::jsonb),
    'counts', jsonb_build_object('trades', (select count(*) from public.trades tr where tr.user_id = p.id),
                                 'transactions', (select count(*) from public.wallet_transactions t join public.wallets w on w.id = t.wallet_id where w.user_id = p.id))
  ) end
  from (select 1) one
  left join public.profiles p on p.id = p_id;
$$;

create or replace function public.control_more(p_op text, p_args jsonb, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  text := nullif(btrim(left(coalesce(p_actor, ''), 120)), '');
  a        jsonb := coalesce(p_args, '{}'::jsonb);
  v_ctx    jsonb;
  v_id     uuid;
  v_text   text;
  v_role   public.user_role;
  v_old    text;
  v_wallet public.wallets%rowtype;
  v_charge public.fee_charges%rowtype;
  v_amount numeric;
  v_key    text;
  v_tx     uuid;
begin
  if v_actor is null then raise exception 'control_more: actor required'; end if;
  v_ctx := jsonb_build_object('source', 'gio4x_control', 'by', v_actor, 'op', p_op);

  if p_op = 'material_save' then
    if nullif(btrim(coalesce(a ->> 'title', '')), '') is null or coalesce(a ->> 'url', '') !~ '^https://[^[:space:]]+$' or char_length(a ->> 'url') > 500 then return jsonb_build_object('result', 'invalid'); end if;
    begin
      if (a ->> 'id') is null then
        insert into public.marketing_materials (title, kind, description, url, language, sort, active)
        values (btrim(left(a ->> 'title', 160)), coalesce(a ->> 'kind', 'other'), nullif(btrim(left(coalesce(a ->> 'description', ''), 400)), ''), a ->> 'url',
                coalesce(nullif(btrim(left(coalesce(a ->> 'language', ''), 8)), ''), 'en'), coalesce((a ->> 'sort')::integer, 0), coalesce((a ->> 'active')::boolean, true))
        returning id into v_id;
      else
        update public.marketing_materials
           set title = btrim(left(a ->> 'title', 160)), kind = coalesce(a ->> 'kind', 'other'), description = nullif(btrim(left(coalesce(a ->> 'description', ''), 400)), ''),
               url = a ->> 'url', language = coalesce(nullif(btrim(left(coalesce(a ->> 'language', ''), 8)), ''), 'en'), sort = coalesce((a ->> 'sort')::integer, 0),
               active = coalesce((a ->> 'active')::boolean, true), updated_at = now()
         where id = (a ->> 'id')::uuid returning id into v_id;
        if v_id is null then return jsonb_build_object('result', 'not_found'); end if;
      end if;
    exception when check_violation or invalid_text_representation then return jsonb_build_object('result', 'invalid');
    end;
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
    values (null, case when (a ->> 'id') is null then 'INSERT' else 'UPDATE' end::public.audit_action, 'marketing_materials', v_id::text, null, a - 'id', v_ctx);
    return jsonb_build_object('result', 'ok', 'id', v_id);

  elsif p_op = 'material_retire' then
    update public.marketing_materials set active = false, updated_at = now() where id = (a ->> 'id')::uuid returning id into v_id;
    if v_id is null then return jsonb_build_object('result', 'not_found'); end if;
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
    values (null, 'UPDATE', 'marketing_materials', v_id::text, null, jsonb_build_object('active', false), v_ctx);
    return jsonb_build_object('result', 'ok');

  elsif p_op = 'referral_create' then
    select role, referral_code into v_role, v_text from public.profiles where id = (a ->> 'owner')::uuid;
    if v_role is null then return jsonb_build_object('result', 'not_found'); end if;
    if v_role not in ('ib', 'affiliate') then return jsonb_build_object('result', 'not_ib'); end if;
    if coalesce(a ->> 'destination', 'register') not in ('register', 'register-demo', 'home', 'raptor') then return jsonb_build_object('result', 'invalid'); end if;
    v_text := left(coalesce(v_text, 'G4X'), 4) || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    insert into public.referrals (owner_id, code, name, destination, sub_id)
    values ((a ->> 'owner')::uuid, v_text, nullif(btrim(left(coalesce(a ->> 'name', ''), 80)), ''), coalesce(a ->> 'destination', 'register'),
            nullif(btrim(left(coalesce(a ->> 'sub_id', ''), 40)), ''))
    returning id into v_id;
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
    values (null, 'INSERT', 'referrals', v_id::text, null, jsonb_build_object('code', v_text, 'owner_id', a ->> 'owner'), v_ctx);
    return jsonb_build_object('result', 'ok', 'code', v_text);

  elsif p_op = 'client_status' then
    if coalesce(a ->> 'status', '') not in ('active', 'suspended', 'closed') then return jsonb_build_object('result', 'invalid'); end if;
    select role, status::text into v_role, v_old from public.profiles where id = (a ->> 'id')::uuid for update;
    if v_role is null then return jsonb_build_object('result', 'not_found'); end if;
    if v_role in ('staff', 'admin') then return jsonb_build_object('result', 'staff_profile'); end if;
    update public.profiles set status = (a ->> 'status')::public.user_status, updated_at = now() where id = (a ->> 'id')::uuid;
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
    values (null, 'UPDATE', 'profiles', a ->> 'id', jsonb_build_object('status', v_old), jsonb_build_object('status', a ->> 'status', 'reason', left(coalesce(a ->> 'reason', ''), 300)), v_ctx);
    return jsonb_build_object('result', 'ok');

  elsif p_op = 'fee_charge' then
    v_amount := (a ->> 'amount')::numeric;
    if v_amount is null or v_amount <= 0 or (a ->> 'key') is null or nullif(btrim(coalesce(a ->> 'notes', '')), '') is null then return jsonb_build_object('result', 'invalid'); end if;
    select * into v_wallet from public.wallets w where w.user_id = (a ->> 'user_id')::uuid and w.type = 'main' and w.currency = 'USD' limit 1;
    if not found then return jsonb_build_object('result', 'not_found'); end if;
    if v_wallet.status <> 'active' then return jsonb_build_object('result', 'wallet_not_active'); end if;
    v_key := 'ctl-fee-' || (a ->> 'key');
    if exists (select 1 from public.fee_charges f where f.idempotency_key = v_key) then return jsonb_build_object('result', 'already_done'); end if;
    begin
      v_charge := public.charge_fee(
        p_fee_type => (a ->> 'fee_type')::public.fee_type, p_idempotency_key => v_key, p_user_id => v_wallet.user_id, p_wallet_id => v_wallet.id,
        p_trading_account_id => null, p_base_amount => v_amount, p_lots => null, p_scope => '{}'::jsonb, p_override_amount => v_amount,
        p_move_wallet => true, p_source_type => 'manual', p_source_id => null, p_created_by => null,
        p_notes => left(btrim(a ->> 'notes'), 300) || ' · by ' || v_actor);
    exception
      when invalid_text_representation then return jsonb_build_object('result', 'invalid');
      when others then
        if sqlerrm like '%insufficient%' then return jsonb_build_object('result', 'insufficient_balance'); end if;
        raise;
    end;
    return jsonb_build_object('result', 'ok', 'id', v_charge.id, 'amount', v_charge.computed_amount, 'currency', v_charge.currency);

  elsif p_op = 'fee_waive' then
    select * into v_charge from public.fee_charges where id = (a ->> 'id')::uuid for update;
    if not found then return jsonb_build_object('result', 'not_found'); end if;
    if v_charge.status <> 'pending' then return jsonb_build_object('result', 'already_done', 'status', v_charge.status); end if;
    update public.fee_charges set status = 'waived', notes = coalesce(notes || ' · ', '') || 'waived by ' || v_actor, updated_at = now() where id = v_charge.id;
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
    values (null, 'UPDATE', 'fee_charges', v_charge.id::text, jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'waived'), v_ctx);
    return jsonb_build_object('result', 'ok');

  elsif p_op = 'fee_reverse' then
    select * into v_charge from public.fee_charges where id = (a ->> 'id')::uuid for update;
    if not found then return jsonb_build_object('result', 'not_found'); end if;
    if v_charge.status <> 'applied' then return jsonb_build_object('result', 'already_done', 'status', v_charge.status); end if;
    if v_charge.computed_amount <= 0 then return jsonb_build_object('result', 'not_a_fee'); end if;
    perform public.post_journal_entry(
      p_idempotency_key => 'feerev-' || v_charge.id::text,
      p_lines => jsonb_build_array(
        jsonb_build_object('account_code', 'FEE_REVENUE', 'direction', 'debit', 'amount', v_charge.computed_amount, 'currency', v_charge.currency, 'memo', 'fee reversal'),
        jsonb_build_object('account_code', 'CLIENT_FUNDS', 'direction', 'credit', 'amount', v_charge.computed_amount, 'currency', v_charge.currency, 'memo', 'fee reversal')),
      p_source_type => 'fee_reversal', p_source_id => v_charge.id::text, p_description => v_charge.fee_type::text || ' fee reversed',
      p_reference => null, p_created_by => null, p_metadata => jsonb_build_object('control', jsonb_build_object('by', v_actor, 'at', now())));
    if v_charge.wallet_tx_id is not null and v_charge.wallet_id is not null then
      v_tx := public.process_wallet_transaction_core(v_charge.wallet_id, 'adjustment', v_charge.computed_amount, 'feerevwx-' || v_charge.id::text, 'fee_reversal', null,
                'completed', v_charge.user_id, jsonb_build_object('fee_charge_id', v_charge.id, 'control', jsonb_build_object('by', v_actor, 'action', 'fee_reverse')));
    end if;
    update public.fee_charges set status = 'reversed', notes = coalesce(notes || ' · ', '') || 'reversed by ' || v_actor, updated_at = now() where id = v_charge.id;
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
    values (null, 'UPDATE', 'fee_charges', v_charge.id::text, jsonb_build_object('status', 'applied'), jsonb_build_object('status', 'reversed', 'refund_tx', v_tx), v_ctx);
    return jsonb_build_object('result', 'ok', 'amount', v_charge.computed_amount, 'currency', v_charge.currency);
  end if;

  raise exception 'control_more: unknown operation';
end;
$$;

revoke all on function public.control_client_detail(uuid) from public, anon, authenticated;
revoke all on function public.control_more(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.control_client_detail(uuid) to service_role;
grant execute on function public.control_more(text, jsonb, text) to service_role;

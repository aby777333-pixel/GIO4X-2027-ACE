-- 20261003130000_control_actions.sql
--
-- Two decisions that GIO4X Control (the staff console of the website, a separate
-- application with its own staff accounts) makes on this database:
--
--   control_review_kyc_document       accept or reject ONE document awaiting review
--   control_settle_wallet_transaction approve or reject ONE pending deposit or withdrawal
--
-- Control reaches this database with the service-role key, so there is no auth.uid()
-- here and is_staff() would say no. Who may decide is settled in Control before the
-- call (its own capabilities kyc.decide and funds.settle, and an audit entry written
-- first in its own database). These functions are therefore executable by
-- service_role ONLY: no signed-in portal user, client or staff, can call them.
--
-- What they add over review_kyc_user / staff_settle_wallet_transaction:
--   * one row at a time, compare-and-set on its status: a decision is made once;
--   * a withdrawal or deposit only (no other transaction type is settled from Control);
--   * who decided is recorded as text (p_actor, the Control member of staff), since
--     that person has no profile in this database: in audit_logs.context for a
--     document, in wallet_transactions.metadata -> 'control' for a transaction.
--
-- ROLLBACK
--   drop function if exists public.control_review_kyc_document(uuid, boolean, text, text);
--   drop function if exists public.control_settle_wallet_transaction(uuid, text, text, text);

create or replace function public.control_review_kyc_document(
  p_doc_id  uuid,
  p_approve boolean,
  p_reason  text,
  p_actor   text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc    public.kyc_documents%rowtype;
  v_reason text := nullif(btrim(left(coalesce(p_reason, ''), 300)), '');
  v_actor  text := nullif(btrim(left(coalesce(p_actor, ''), 120)), '');
  v_status public.kyc_doc_status;
  v_kyc    public.kyc_status;
begin
  if v_actor is null then
    raise exception 'control_review_kyc_document: actor required';
  end if;
  if p_approve is null then
    raise exception 'control_review_kyc_document: decision required';
  end if;
  if not p_approve and v_reason is null then
    raise exception 'control_review_kyc_document: a rejection needs a reason';
  end if;

  select * into v_doc from public.kyc_documents where id = p_doc_id for update;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;
  if v_doc.status not in ('pending', 'in_review') then
    return jsonb_build_object('result', 'already_decided', 'status', v_doc.status);
  end if;

  v_status := case when p_approve then 'approved'::public.kyc_doc_status else 'rejected'::public.kyc_doc_status end;

  update public.kyc_documents
     set status = v_status,
         reviewed_by = null,
         reviewed_at = now(),
         rejection_reason = case when p_approve then null else v_reason end,
         updated_at = now()
   where id = p_doc_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
  values (
    null, 'UPDATE', 'kyc_documents', p_doc_id::text,
    jsonb_build_object('status', v_doc.status),
    jsonb_build_object('status', v_status, 'rejection_reason', case when p_approve then null else v_reason end),
    jsonb_build_object('source', 'gio4x_control', 'by', v_actor)
  );

  perform public.recompute_kyc_status(v_doc.user_id);
  select kyc_status into v_kyc from public.profiles where id = v_doc.user_id;

  return jsonb_build_object('result', 'ok', 'status', v_status, 'client_kyc_status', v_kyc);
end;
$$;

revoke all on function public.control_review_kyc_document(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.control_review_kyc_document(uuid, boolean, text, text) to service_role;

create or replace function public.control_settle_wallet_transaction(
  p_tx_id       uuid,
  p_action      text,
  p_gateway_ref text,
  p_actor       text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx          public.wallet_transactions%rowtype;
  v_wallet      public.wallets%rowtype;
  v_new_balance numeric(20,8);
  v_ref         text := nullif(btrim(left(coalesce(p_gateway_ref, ''), 120)), '');
  v_actor       text := nullif(btrim(left(coalesce(p_actor, ''), 120)), '');
  v_stamp       jsonb;
begin
  if v_actor is null then
    raise exception 'control_settle_wallet_transaction: actor required';
  end if;
  if p_action is null or p_action not in ('approve', 'reject') then
    raise exception 'control_settle_wallet_transaction: unknown action';
  end if;

  select * into v_tx from public.wallet_transactions where id = p_tx_id for update;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;
  if v_tx.type not in ('deposit', 'withdraw') then
    return jsonb_build_object('result', 'not_settled_here', 'type', v_tx.type);
  end if;
  if v_tx.status not in ('pending', 'processing') then
    return jsonb_build_object('result', 'already_decided', 'status', v_tx.status);
  end if;

  v_stamp := jsonb_build_object('control', jsonb_build_object('by', v_actor, 'action', p_action, 'at', now()));

  if p_action = 'reject' then
    update public.wallet_transactions
       set status = 'failed',
           reviewed_by = null,
           gateway_ref = coalesce(v_ref, gateway_ref),
           metadata = coalesce(metadata, '{}'::jsonb) || v_stamp,
           updated_at = now()
     where id = p_tx_id;
    return jsonb_build_object('result', 'ok', 'status', 'failed', 'type', v_tx.type, 'amount', v_tx.amount, 'currency', v_tx.currency);
  end if;

  select * into v_wallet from public.wallets where id = v_tx.wallet_id for update;
  if not found then
    raise exception 'control_settle_wallet_transaction: wallet not found';
  end if;
  if v_wallet.status <> 'active' then
    return jsonb_build_object('result', 'wallet_not_active', 'wallet_status', v_wallet.status);
  end if;

  if v_tx.type = 'deposit' then
    v_new_balance := v_wallet.balance + v_tx.amount;
  else
    if v_wallet.balance < v_tx.amount then
      return jsonb_build_object('result', 'insufficient_balance');
    end if;
    v_new_balance := v_wallet.balance - v_tx.amount;
  end if;

  update public.wallets set balance = v_new_balance, updated_at = now() where id = v_wallet.id;

  update public.wallet_transactions
     set status = 'completed',
         balance_after = v_new_balance,
         reviewed_by = null,
         gateway_ref = coalesce(v_ref, gateway_ref),
         metadata = coalesce(metadata, '{}'::jsonb) || v_stamp,
         updated_at = now()
   where id = p_tx_id;

  return jsonb_build_object('result', 'ok', 'status', 'completed', 'type', v_tx.type, 'amount', v_tx.amount, 'currency', v_tx.currency);
end;
$$;

revoke all on function public.control_settle_wallet_transaction(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.control_settle_wallet_transaction(uuid, text, text, text) to service_role;

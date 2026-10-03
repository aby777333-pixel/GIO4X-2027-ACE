-- 20261003160000_control_ops.sql
--
-- The remaining changes GIO4X Control makes in this database, in one function,
-- control_ops(op, args, actor), executable by service_role ONLY. Control decides who
-- may call it and writes its own audit entry first; this function decides what each
-- operation may do, and records it in audit_logs with the Control member of staff.
--
--   provider_status       { id, status }   a signal provider: pending → active, pause, resume, close.
--                                          Closed is final. Not closed while followers are subscribed.
--   fund_status           { id, status }   a PAMM fund: the same, and not closed while units are outstanding.
--   ledger_account_create { code, name, type, currency }
--   ledger_account_active { id, active }   switch a ledger account off or on. System accounts stay on.
--   journal_post          { debit, credit, amount, description, reference }
--                                          a manual, balanced, two-line journal entry between two active
--                                          accounts of the same currency (post_journal_entry does the posting).
--                                          It corrects the books; it does not touch any wallet.
--   legal_save            { id?, key, title, body }   create a legal document, or change its title/body
--                                          (the version goes up by one when the text changes).
--   legal_publish         { id, published }  show it to clients at /portal/legal/<key>, or take it down.
--   events_dispatch       { limit }        run the event queue now (dispatch_outbox_events).
--
-- Nothing is deleted by any of these.
--
-- ROLLBACK
--   drop function if exists public.control_ops(text, jsonb, text);

create or replace function public.control_ops(p_op text, p_args jsonb, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  text := nullif(btrim(left(coalesce(p_actor, ''), 120)), '');
  a        jsonb := coalesce(p_args, '{}'::jsonb);
  v_id     uuid;
  v_old    jsonb;
  v_status text;
  v_n      integer;
  v_text   text;
  v_d      public.ledger_accounts%rowtype;
  v_c      public.ledger_accounts%rowtype;
  v_amount numeric;
  v_doc    public.legal_documents%rowtype;
  v_ctx    jsonb;
begin
  if v_actor is null then raise exception 'control_ops: actor required'; end if;
  v_ctx := jsonb_build_object('source', 'gio4x_control', 'by', v_actor, 'op', p_op);

  if p_op in ('provider_status', 'fund_status') then
    v_id := (a ->> 'id')::uuid;
    v_status := a ->> 'status';
    if v_status is null or v_status not in ('pending', 'active', 'paused', 'closed') then return jsonb_build_object('result', 'invalid'); end if;
    if p_op = 'provider_status' then
      select to_jsonb(s) into v_old from public.signal_providers s where s.id = v_id for update;
      if v_old is null then return jsonb_build_object('result', 'not_found'); end if;
      if v_old ->> 'status' = 'closed' then return jsonb_build_object('result', 'closed'); end if;
      if v_status = 'closed' and exists (select 1 from public.copy_subscriptions c where c.provider_id = v_id and c.status = 'active') then
        return jsonb_build_object('result', 'in_use');
      end if;
      update public.signal_providers set status = v_status::public.copy_provider_status, updated_at = now() where id = v_id;
      v_text := 'signal_providers';
    else
      select to_jsonb(f) into v_old from public.pamm_funds f where f.id = v_id for update;
      if v_old is null then return jsonb_build_object('result', 'not_found'); end if;
      if v_old ->> 'status' = 'closed' then return jsonb_build_object('result', 'closed'); end if;
      if v_status = 'closed' and coalesce((v_old ->> 'units_outstanding')::numeric, 0) > 0 then
        return jsonb_build_object('result', 'in_use');
      end if;
      update public.pamm_funds set status = v_status::public.pamm_fund_status, updated_at = now() where id = v_id;
      v_text := 'pamm_funds';
    end if;
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
    values (null, 'UPDATE', v_text, v_id::text, jsonb_build_object('status', v_old -> 'status'), jsonb_build_object('status', v_status), v_ctx);
    return jsonb_build_object('result', 'ok');

  elsif p_op = 'ledger_account_create' then
    v_text := upper(btrim(coalesce(a ->> 'code', '')));
    if v_text !~ '^[A-Z][A-Z0-9_]{2,39}$' or nullif(btrim(coalesce(a ->> 'name', '')), '') is null then return jsonb_build_object('result', 'invalid'); end if;
    begin
      insert into public.ledger_accounts (code, name, type, currency, is_system, active)
      values (v_text, btrim(left(a ->> 'name', 120)), (a ->> 'type')::public.ledger_account_type, coalesce(a ->> 'currency', 'USD')::public.wallet_currency, false, true)
      returning id into v_id;
    exception
      when unique_violation then return jsonb_build_object('result', 'duplicate');
      when invalid_text_representation or not_null_violation then return jsonb_build_object('result', 'invalid');
    end;
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
    values (null, 'INSERT', 'ledger_accounts', v_id::text, null, jsonb_build_object('code', v_text, 'type', a ->> 'type', 'currency', coalesce(a ->> 'currency', 'USD')), v_ctx);
    return jsonb_build_object('result', 'ok', 'id', v_id);

  elsif p_op = 'ledger_account_active' then
    v_id := (a ->> 'id')::uuid;
    select * into v_d from public.ledger_accounts where id = v_id for update;
    if not found then return jsonb_build_object('result', 'not_found'); end if;
    if v_d.is_system and not coalesce((a ->> 'active')::boolean, true) then return jsonb_build_object('result', 'system'); end if;
    update public.ledger_accounts set active = coalesce((a ->> 'active')::boolean, true), updated_at = now() where id = v_id;
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
    values (null, 'UPDATE', 'ledger_accounts', v_id::text, jsonb_build_object('active', v_d.active), jsonb_build_object('active', coalesce((a ->> 'active')::boolean, true)), v_ctx);
    return jsonb_build_object('result', 'ok');

  elsif p_op = 'journal_post' then
    v_amount := (a ->> 'amount')::numeric;
    if v_amount is null or v_amount <= 0 or nullif(btrim(coalesce(a ->> 'description', '')), '') is null then return jsonb_build_object('result', 'invalid'); end if;
    select * into v_d from public.ledger_accounts where id = (a ->> 'debit')::uuid;
    select * into v_c from public.ledger_accounts where id = (a ->> 'credit')::uuid;
    if v_d.id is null or v_c.id is null then return jsonb_build_object('result', 'not_found'); end if;
    if v_d.id = v_c.id then return jsonb_build_object('result', 'same_account'); end if;
    if not v_d.active or not v_c.active then return jsonb_build_object('result', 'inactive'); end if;
    if v_d.currency <> v_c.currency then return jsonb_build_object('result', 'currency'); end if;
    v_id := public.post_journal_entry(
      p_idempotency_key => 'ctl-journal-' || replace(gen_random_uuid()::text, '-', ''),
      p_lines => jsonb_build_array(
        jsonb_build_object('account_id', v_d.id, 'direction', 'debit', 'amount', v_amount),
        jsonb_build_object('account_id', v_c.id, 'direction', 'credit', 'amount', v_amount)),
      p_source_type => 'manual',
      p_source_id => null,
      p_description => btrim(left(a ->> 'description', 300)),
      p_reference => nullif(btrim(left(coalesce(a ->> 'reference', ''), 120)), ''),
      p_created_by => null,
      p_metadata => jsonb_build_object('control', jsonb_build_object('by', v_actor, 'at', now())));
    return jsonb_build_object('result', 'ok', 'id', v_id);

  elsif p_op = 'legal_save' then
    if nullif(btrim(coalesce(a ->> 'title', '')), '') is null or length(coalesce(a ->> 'body', '')) > 200000 then return jsonb_build_object('result', 'invalid'); end if;
    if (a ->> 'id') is null then
      v_text := lower(btrim(coalesce(a ->> 'key', '')));
      if v_text !~ '^[a-z][a-z0-9_]{1,39}$' then return jsonb_build_object('result', 'invalid'); end if;
      begin
        insert into public.legal_documents (key, title, body, version, published)
        values (v_text, btrim(left(a ->> 'title', 160)), coalesce(a ->> 'body', ''), 1, false) returning id into v_id;
      exception when unique_violation then return jsonb_build_object('result', 'duplicate');
      end;
      insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
      values (null, 'INSERT', 'legal_documents', v_id::text, null, jsonb_build_object('key', v_text, 'version', 1), v_ctx);
      return jsonb_build_object('result', 'ok', 'id', v_id);
    end if;
    select * into v_doc from public.legal_documents where id = (a ->> 'id')::uuid for update;
    if not found then return jsonb_build_object('result', 'not_found'); end if;
    v_n := v_doc.version + case when v_doc.body is distinct from coalesce(a ->> 'body', '') or v_doc.title is distinct from btrim(left(a ->> 'title', 160)) then 1 else 0 end;
    update public.legal_documents set title = btrim(left(a ->> 'title', 160)), body = coalesce(a ->> 'body', ''), version = v_n, updated_by = null, updated_at = now() where id = v_doc.id;
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
    values (null, 'UPDATE', 'legal_documents', v_doc.id::text, jsonb_build_object('version', v_doc.version, 'title', v_doc.title),
            jsonb_build_object('version', v_n, 'title', btrim(left(a ->> 'title', 160))), v_ctx);
    return jsonb_build_object('result', 'ok', 'id', v_doc.id, 'version', v_n);

  elsif p_op = 'legal_publish' then
    select * into v_doc from public.legal_documents where id = (a ->> 'id')::uuid for update;
    if not found then return jsonb_build_object('result', 'not_found'); end if;
    if coalesce((a ->> 'published')::boolean, false) and length(btrim(v_doc.body)) < 200 then return jsonb_build_object('result', 'too_short'); end if;
    update public.legal_documents set published = coalesce((a ->> 'published')::boolean, false), updated_by = null, updated_at = now() where id = v_doc.id;
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
    values (null, 'UPDATE', 'legal_documents', v_doc.id::text, jsonb_build_object('published', v_doc.published),
            jsonb_build_object('published', coalesce((a ->> 'published')::boolean, false), 'version', v_doc.version), v_ctx);
    return jsonb_build_object('result', 'ok');

  elsif p_op = 'events_dispatch' then
    v_n := public.dispatch_outbox_events(least(greatest(coalesce((a ->> 'limit')::integer, 100), 1), 500));
    return jsonb_build_object('result', 'ok', 'processed', coalesce(v_n, 0));
  end if;

  raise exception 'control_ops: unknown operation';
end;
$$;

revoke all on function public.control_ops(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.control_ops(text, jsonb, text) to service_role;

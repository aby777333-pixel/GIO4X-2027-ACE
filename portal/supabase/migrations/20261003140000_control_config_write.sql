-- 20261003140000_control_config_write.sql
--
-- GIO4X Control (the website's staff console) manages four configuration tables of
-- this database: what the broker charges, what it pays partners, and what it offers.
--
--   fee_schedules      a named, versioned set of fee rules
--   fee_rules          one charge: type, method, rate, bounds, currency
--   commission_plans   what an introducing broker earns per lot, and the sub-IB shares
--   account_types      the account types a client can open
--
-- One function, control_config_write, executable by service_role ONLY. Control decides
-- who may call it (its own capabilities and audit log); this function decides what may
-- be written:
--   * only these four tables, and only the columns listed for each;
--   * 'create', 'update' or 'retire'. Nothing is ever deleted: fee charges, IB
--     relationships and trading accounts point at these rows, so a row that is no
--     longer wanted is switched off (active = false) and stays for the record;
--   * numbers are checked: no negative rate, amount, share or leverage; a share and a
--     percentage rate are fractions between 0 and 1; a maximum is not below a minimum;
--   * exactly one commission plan is the default: making one the default clears the
--     flag on the others, and the default plan cannot be retired;
--   * every write is recorded in audit_logs with the Control member of staff as text.
--
-- ROLLBACK
--   drop function if exists public.control_config_write(text, text, uuid, jsonb, text);

create or replace function public.control_config_write(
  p_table  text,
  p_op     text,
  p_id     uuid,
  p_values jsonb,
  p_actor  text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor   text := nullif(btrim(left(coalesce(p_actor, ''), 120)), '');
  v_allowed text[];
  v_cols    text[];
  v_list    text;
  v_old     jsonb;
  v_new     jsonb;
  v_merged  jsonb;
  v_id      uuid;
  k         text;
begin
  if v_actor is null then
    raise exception 'control_config_write: actor required';
  end if;
  if p_op is null or p_op not in ('create', 'update', 'retire') then
    raise exception 'control_config_write: unknown operation';
  end if;

  v_allowed := case p_table
    when 'fee_schedules'    then array['code', 'name', 'version', 'active', 'precedence', 'effective_from', 'effective_to', 'description']
    when 'fee_rules'        then array['schedule_id', 'fee_type', 'calc_method', 'rate', 'min_amount', 'max_amount', 'currency', 'is_rebate', 'priority', 'active']
    when 'commission_plans' then array['name', 'rate_per_lot', 'sub_ib_share_l1', 'sub_ib_share_l2', 'is_default', 'active', 'description']
    when 'account_types'    then array['name', 'leverage', 'min_deposit', 'base_currency', 'spread_from', 'commission', 'sort', 'active']
    else null
  end;
  if v_allowed is null then
    raise exception 'control_config_write: table not managed here';
  end if;

  if p_op <> 'create' then
    if p_id is null then
      return jsonb_build_object('result', 'not_found');
    end if;
    execute format('select to_jsonb(t) from public.%I t where t.id = $1 for update', p_table) into v_old using p_id;
    if v_old is null then
      return jsonb_build_object('result', 'not_found');
    end if;
  end if;

  if p_op = 'retire' then
    if p_table = 'commission_plans' and coalesce((v_old ->> 'is_default')::boolean, false) then
      return jsonb_build_object('result', 'default_plan');
    end if;
    execute format('update public.%I set active = false where id = $1', p_table) using p_id;
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
    values (null, 'UPDATE', p_table, p_id::text, jsonb_build_object('active', v_old -> 'active'), jsonb_build_object('active', false),
            jsonb_build_object('source', 'gio4x_control', 'by', v_actor, 'op', 'retire'));
    return jsonb_build_object('result', 'ok', 'id', p_id);
  end if;

  if p_values is null or jsonb_typeof(p_values) <> 'object' then
    raise exception 'control_config_write: values required';
  end if;
  for k in select jsonb_object_keys(p_values) loop
    if not (k = any (v_allowed)) then
      raise exception 'control_config_write: column % is not managed here', k;
    end if;
    v_cols := array_append(v_cols, k);
  end loop;
  if v_cols is null then
    return jsonb_build_object('result', 'nothing_to_write');
  end if;

  -- the row as it would be after the write, for the checks below
  v_merged := coalesce(v_old, '{}'::jsonb) || p_values;

  if p_table = 'fee_rules' then
    if (v_merged ->> 'schedule_id') is null or (v_merged ->> 'fee_type') is null or (v_merged ->> 'calc_method') is null then
      return jsonb_build_object('result', 'invalid', 'why', 'schedule, fee type and method are required');
    end if;
    if not exists (select 1 from public.fee_schedules s where s.id = (v_merged ->> 'schedule_id')::uuid) then
      return jsonb_build_object('result', 'invalid', 'why', 'schedule not found');
    end if;
    if coalesce((v_merged ->> 'rate')::numeric, 0) < 0 or coalesce((v_merged ->> 'min_amount')::numeric, 0) < 0 or coalesce((v_merged ->> 'max_amount')::numeric, 0) < 0 then
      return jsonb_build_object('result', 'invalid', 'why', 'a rate or an amount is negative');
    end if;
    if (v_merged ->> 'calc_method') in ('percentage', 'spread_markup') and coalesce((v_merged ->> 'rate')::numeric, 0) > 1 then
      return jsonb_build_object('result', 'invalid', 'why', 'a percentage rate is a fraction: 0.005 is 0.5%, and it cannot exceed 1');
    end if;
    if (v_merged ->> 'min_amount') is not null and (v_merged ->> 'max_amount') is not null
       and (v_merged ->> 'max_amount')::numeric < (v_merged ->> 'min_amount')::numeric then
      return jsonb_build_object('result', 'invalid', 'why', 'the maximum is below the minimum');
    end if;
  elsif p_table = 'fee_schedules' then
    if nullif(btrim(coalesce(v_merged ->> 'code', '')), '') is null or nullif(btrim(coalesce(v_merged ->> 'name', '')), '') is null then
      return jsonb_build_object('result', 'invalid', 'why', 'code and name are required');
    end if;
    if coalesce((v_merged ->> 'version')::integer, 1) < 1 then
      return jsonb_build_object('result', 'invalid', 'why', 'the version starts at 1');
    end if;
    if (v_merged ->> 'effective_to') is not null and (v_merged ->> 'effective_from') is not null
       and (v_merged ->> 'effective_to')::timestamptz <= (v_merged ->> 'effective_from')::timestamptz then
      return jsonb_build_object('result', 'invalid', 'why', 'the end is not after the start');
    end if;
  elsif p_table = 'commission_plans' then
    if nullif(btrim(coalesce(v_merged ->> 'name', '')), '') is null then
      return jsonb_build_object('result', 'invalid', 'why', 'a name is required');
    end if;
    if coalesce((v_merged ->> 'rate_per_lot')::numeric, 0) < 0 then
      return jsonb_build_object('result', 'invalid', 'why', 'the rate per lot is negative');
    end if;
    if coalesce((v_merged ->> 'sub_ib_share_l1')::numeric, 0) not between 0 and 1 or coalesce((v_merged ->> 'sub_ib_share_l2')::numeric, 0) not between 0 and 1 then
      return jsonb_build_object('result', 'invalid', 'why', 'a share is a fraction between 0 and 1: 0.15 is 15%');
    end if;
    if coalesce((v_merged ->> 'is_default')::boolean, false) and not coalesce((v_merged ->> 'active')::boolean, true) then
      return jsonb_build_object('result', 'invalid', 'why', 'the default plan must be active');
    end if;
    if p_op = 'update' and coalesce((v_old ->> 'is_default')::boolean, false) and not coalesce((v_merged ->> 'is_default')::boolean, false) then
      return jsonb_build_object('result', 'invalid', 'why', 'make another plan the default instead: there is always one');
    end if;
  elsif p_table = 'account_types' then
    if nullif(btrim(coalesce(v_merged ->> 'name', '')), '') is null then
      return jsonb_build_object('result', 'invalid', 'why', 'a name is required');
    end if;
    if coalesce((v_merged ->> 'leverage')::integer, 1) < 1 or coalesce((v_merged ->> 'leverage')::integer, 1) > 2000 then
      return jsonb_build_object('result', 'invalid', 'why', 'leverage is a whole number from 1 to 2000');
    end if;
    if coalesce((v_merged ->> 'min_deposit')::numeric, 0) < 0 then
      return jsonb_build_object('result', 'invalid', 'why', 'the minimum deposit is negative');
    end if;
  end if;

  select string_agg(format('%I', c), ', ') into v_list from unnest(v_cols) c;

  begin
    -- one default plan at a time (the table enforces it): clear the flag elsewhere
    -- first. Inside this block, so a write that fails puts the flag back.
    if p_table = 'commission_plans' and coalesce((p_values ->> 'is_default')::boolean, false) then
      update public.commission_plans set is_default = false where is_default and id is distinct from p_id;
    end if;
    if p_op = 'create' then
      execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) returning id', p_table, v_list)
        into v_id using p_values;
    else
      execute format('update public.%1$I t set (%2$s) = (select %2$s from jsonb_populate_record(null::public.%1$I, $1)) where t.id = $2 returning t.id', p_table, v_list)
        into v_id using p_values, p_id;
    end if;
  exception
    when unique_violation then
      return jsonb_build_object('result', 'duplicate');
    when invalid_text_representation or not_null_violation or check_violation or numeric_value_out_of_range or invalid_datetime_format then
      return jsonb_build_object('result', 'invalid', 'why', 'a value is not of the kind this column holds');
  end;

  execute format('select to_jsonb(t) from public.%I t where t.id = $1', p_table) into v_new using v_id;
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
  values (null, case when p_op = 'create' then 'INSERT' else 'UPDATE' end::public.audit_action, p_table, v_id::text, v_old, v_new,
          jsonb_build_object('source', 'gio4x_control', 'by', v_actor, 'op', p_op));

  return jsonb_build_object('result', 'ok', 'id', v_id);
end;
$$;

revoke all on function public.control_config_write(text, text, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.control_config_write(text, text, uuid, jsonb, text) to service_role;

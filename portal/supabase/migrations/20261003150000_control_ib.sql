-- 20261003150000_control_ib.sql
--
-- IB management from GIO4X Control. Seven functions, executable by service_role ONLY
-- (Control decides who may call them and writes its own audit entry first):
--
--   control_ib_list()                      every introducing broker / affiliate and anyone with a
--                                          downline: parent, plan, direct and whole-network counts,
--                                          commission awaiting settlement per currency
--   control_ib_detail(ib)                  one partner: profile, parent and plan, downline with lots and
--                                          commission per member, totals per currency, referral links
--   control_ib_set_role(user, is_ib)       make a client an IB, or an IB a client again
--   control_ib_link(parent, child, plan)   put a person under an IB (moves them if they had a parent)
--   control_ib_unlink(child)               detach a person from their parent
--   control_ib_set_plan(parent, child, plan, share)  the plan and share override of one direct link
--   control_ib_settle(ib, currency)        pay commission awaiting settlement into the IB's wallet
--
-- ib_relationships is a closure table: a level-1 row is a direct link, and tg_ib_closure
-- adds the level 2..8 rows for every ancestor and descendant when one is inserted.
-- Moving or detaching a person therefore removes every row that joins one of their
-- ancestors to them or to one of their descendants, not only the person's own rows
-- (staff_reparent_ib / staff_unlink_ib remove only the latter and leave stale rows
-- behind). Sub-trees stay intact: links inside the moved branch are not touched.
--
-- Sums of money are made here, in SQL, on numeric columns: Control shows them and
-- never adds amounts up itself.
--
-- ROLLBACK
--   drop function if exists public.control_ib_list();
--   drop function if exists public.control_ib_detail(uuid);
--   drop function if exists public.control_ib_set_role(uuid, boolean, text);
--   drop function if exists public.control_ib_link(uuid, uuid, uuid, text);
--   drop function if exists public.control_ib_unlink(uuid, text);
--   drop function if exists public.control_ib_set_plan(uuid, uuid, uuid, numeric, text);
--   drop function if exists public.control_ib_settle(uuid, text, text);
--   drop function if exists public.control_ib_detach(uuid);

create or replace function public.control_ib_list()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x.joined desc), '[]'::jsonb)
  from (
    select p.id, p.full_name as name, p.email::text as email, p.role::text as role, p.status::text as status,
           p.kyc_status::text as kyc_status, p.referral_code, p.created_at as joined,
           par.parent_id,
           (select pp.full_name from public.profiles pp where pp.id = par.parent_id) as parent_name,
           (select cp.name from public.commission_plans cp where cp.id = par.commission_plan_id) as plan_name,
           (select count(*) from public.ib_relationships r where r.parent_id = p.id and r.level = 1) as direct,
           (select count(*) from public.ib_relationships r where r.parent_id = p.id) as network,
           coalesce((select jsonb_agg(jsonb_build_object('currency', u.currency, 'amount', u.amount, 'rows', u.n) order by u.currency)
                       from (select cl.currency::text as currency, sum(cl.amount) as amount, count(*) as n
                               from public.commission_ledger cl
                              where cl.ib_user_id = p.id and cl.settled = false
                              group by cl.currency) u), '[]'::jsonb) as unsettled
    from public.profiles p
    left join lateral (
      select r.parent_id, r.commission_plan_id from public.ib_relationships r
       where r.child_id = p.id and r.level = 1 order by r.created_at limit 1
    ) par on true
    where p.role in ('ib', 'affiliate')
       or exists (select 1 from public.ib_relationships r where r.parent_id = p.id)
    order by p.created_at desc
    limit 500
  ) x;
$$;

create or replace function public.control_ib_detail(p_ib uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.id is null then null else jsonb_build_object(
    'profile', jsonb_build_object('id', p.id, 'name', p.full_name, 'email', p.email::text, 'role', p.role::text, 'status', p.status::text,
                                  'kyc_status', p.kyc_status::text, 'country', p.country, 'referral_code', p.referral_code, 'joined', p.created_at),
    'parent', (select jsonb_build_object('id', r.parent_id, 'name', pp.full_name, 'email', pp.email::text, 'plan_id', r.commission_plan_id,
                                         'plan_name', cp.name, 'share_override', r.share_override, 'since', r.created_at)
                 from public.ib_relationships r
                 join public.profiles pp on pp.id = r.parent_id
                 left join public.commission_plans cp on cp.id = r.commission_plan_id
                where r.child_id = p.id and r.level = 1 order by r.created_at limit 1),
    'downline', coalesce((select jsonb_agg(d order by d.level, d.name nulls last) from (
                   select r.child_id as id, r.level, c.full_name as name, c.email::text as email, c.role::text as role, c.status::text as status,
                          c.kyc_status::text as kyc_status, r.commission_plan_id as plan_id, r.share_override,
                          (select count(*) from public.trading_accounts t where t.user_id = r.child_id) as accounts,
                          coalesce((select sum(cl.lots) from public.commission_ledger cl where cl.ib_user_id = p.id and cl.source_user_id = r.child_id), 0) as lots,
                          coalesce((select sum(cl.amount) from public.commission_ledger cl where cl.ib_user_id = p.id and cl.source_user_id = r.child_id), 0) as commission,
                          (select max(cl.created_at) from public.commission_ledger cl where cl.ib_user_id = p.id and cl.source_user_id = r.child_id) as last_activity
                     from public.ib_relationships r join public.profiles c on c.id = r.child_id
                    where r.parent_id = p.id
                    order by r.level, c.full_name nulls last
                    limit 500) d), '[]'::jsonb),
    'totals', coalesce((select jsonb_agg(t order by t.currency) from (
                   select cl.currency::text as currency,
                          coalesce(sum(cl.amount) filter (where not cl.settled), 0) as unsettled,
                          coalesce(sum(cl.amount) filter (where cl.settled), 0) as settled,
                          coalesce(sum(cl.lots), 0) as lots, count(*) as rows
                     from public.commission_ledger cl where cl.ib_user_id = p.id group by cl.currency) t), '[]'::jsonb),
    'wallets', coalesce((select jsonb_agg(jsonb_build_object('currency', w.currency::text, 'balance', w.balance, 'status', w.status::text) order by w.currency)
                   from public.wallets w where w.user_id = p.id and w.type = 'ib_commission'), '[]'::jsonb),
    'referrals', coalesce((select jsonb_agg(jsonb_build_object('code', f.code, 'name', f.name, 'destination', f.destination, 'clicks', f.clicks,
                                                               'conversions', f.conversions, 'created_at', f.created_at) order by f.created_at desc)
                   from public.referrals f where f.owner_id = p.id), '[]'::jsonb)
  ) end
  from (select 1) one
  left join public.profiles p on p.id = p_ib;
$$;

-- Internal: remove every closure row that joins an ancestor of p_child to p_child or to one of its descendants.
create or replace function public.control_ib_detach(p_child uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  with anc as (select r.parent_id as id from public.ib_relationships r where r.child_id = p_child),
       des as (select p_child as id union select r.child_id from public.ib_relationships r where r.parent_id = p_child)
  delete from public.ib_relationships x
   using anc a, des d
   where x.parent_id = a.id and x.child_id = d.id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.control_ib_set_role(p_user uuid, p_is_ib boolean, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := nullif(btrim(left(coalesce(p_actor, ''), 120)), '');
  v_role  public.user_role;
  v_new   public.user_role;
begin
  if v_actor is null or p_is_ib is null then raise exception 'control_ib_set_role: actor and choice required'; end if;
  select role into v_role from public.profiles where id = p_user for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_role in ('staff', 'admin') then return jsonb_build_object('result', 'staff_profile'); end if;
  v_new := case when p_is_ib then 'ib'::public.user_role else 'trader'::public.user_role end;
  if v_role = v_new then return jsonb_build_object('result', 'ok', 'role', v_new, 'changed', false); end if;
  if not p_is_ib and exists (select 1 from public.ib_relationships r where r.parent_id = p_user) then
    return jsonb_build_object('result', 'has_downline');
  end if;
  update public.profiles set role = v_new, updated_at = now() where id = p_user;
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
  values (null, 'UPDATE', 'profiles', p_user::text, jsonb_build_object('role', v_role), jsonb_build_object('role', v_new),
          jsonb_build_object('source', 'gio4x_control', 'by', v_actor, 'op', 'ib_role'));
  return jsonb_build_object('result', 'ok', 'role', v_new, 'changed', true);
end;
$$;

create or replace function public.control_ib_link(p_parent uuid, p_child uuid, p_plan uuid, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := nullif(btrim(left(coalesce(p_actor, ''), 120)), '');
  v_prole public.user_role;
  v_crole public.user_role;
  v_plan  uuid;
  v_old   uuid;
begin
  if v_actor is null then raise exception 'control_ib_link: actor required'; end if;
  if p_parent is null or p_child is null then return jsonb_build_object('result', 'not_found'); end if;
  if p_parent = p_child then return jsonb_build_object('result', 'self'); end if;

  -- one change to the tree at a time
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('control_ib_tree', 0));

  select role into v_prole from public.profiles where id = p_parent;
  select role into v_crole from public.profiles where id = p_child;
  if v_prole is null or v_crole is null then return jsonb_build_object('result', 'not_found'); end if;
  if v_prole not in ('ib', 'affiliate') then return jsonb_build_object('result', 'parent_not_ib'); end if;
  if v_crole in ('staff', 'admin') then return jsonb_build_object('result', 'staff_profile'); end if;
  if exists (select 1 from public.ib_relationships r where r.parent_id = p_child and r.child_id = p_parent) then
    return jsonb_build_object('result', 'cycle');
  end if;

  v_plan := coalesce(p_plan, (select id from public.commission_plans where is_default limit 1));
  if p_plan is not null and not exists (select 1 from public.commission_plans cp where cp.id = p_plan and cp.active) then
    return jsonb_build_object('result', 'plan_not_found');
  end if;

  select r.parent_id into v_old from public.ib_relationships r where r.child_id = p_child and r.level = 1 order by r.created_at limit 1;
  if v_old = p_parent then
    update public.ib_relationships set commission_plan_id = v_plan where parent_id = p_parent and child_id = p_child and level = 1;
  else
    perform public.control_ib_detach(p_child);
    insert into public.ib_relationships (parent_id, child_id, level, commission_plan_id) values (p_parent, p_child, 1, v_plan);
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
  values (null, 'UPDATE', 'ib_relationships', p_child::text, jsonb_build_object('parent_id', v_old),
          jsonb_build_object('parent_id', p_parent, 'commission_plan_id', v_plan),
          jsonb_build_object('source', 'gio4x_control', 'by', v_actor, 'op', 'ib_link'));
  return jsonb_build_object('result', 'ok', 'moved', v_old is not null and v_old <> p_parent);
end;
$$;

create or replace function public.control_ib_unlink(p_child uuid, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := nullif(btrim(left(coalesce(p_actor, ''), 120)), '');
  v_old   uuid;
begin
  if v_actor is null then raise exception 'control_ib_unlink: actor required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('control_ib_tree', 0));
  select r.parent_id into v_old from public.ib_relationships r where r.child_id = p_child and r.level = 1 order by r.created_at limit 1;
  if v_old is null then return jsonb_build_object('result', 'no_parent'); end if;
  perform public.control_ib_detach(p_child);
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
  values (null, 'DELETE', 'ib_relationships', p_child::text, jsonb_build_object('parent_id', v_old), null,
          jsonb_build_object('source', 'gio4x_control', 'by', v_actor, 'op', 'ib_unlink'));
  return jsonb_build_object('result', 'ok');
end;
$$;

create or replace function public.control_ib_set_plan(p_parent uuid, p_child uuid, p_plan uuid, p_share numeric, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := nullif(btrim(left(coalesce(p_actor, ''), 120)), '');
  v_row   public.ib_relationships%rowtype;
begin
  if v_actor is null then raise exception 'control_ib_set_plan: actor required'; end if;
  if p_share is not null and (p_share < 0 or p_share > 1) then return jsonb_build_object('result', 'invalid'); end if;
  if p_plan is null or not exists (select 1 from public.commission_plans cp where cp.id = p_plan and cp.active) then
    return jsonb_build_object('result', 'plan_not_found');
  end if;
  select * into v_row from public.ib_relationships r where r.parent_id = p_parent and r.child_id = p_child and r.level = 1 for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  update public.ib_relationships set commission_plan_id = p_plan, share_override = p_share where id = v_row.id;
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, context)
  values (null, 'UPDATE', 'ib_relationships', v_row.id::text,
          jsonb_build_object('commission_plan_id', v_row.commission_plan_id, 'share_override', v_row.share_override),
          jsonb_build_object('commission_plan_id', p_plan, 'share_override', p_share),
          jsonb_build_object('source', 'gio4x_control', 'by', v_actor, 'op', 'ib_plan'));
  return jsonb_build_object('result', 'ok');
end;
$$;

create or replace function public.control_ib_settle(p_ib uuid, p_currency text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  text := nullif(btrim(left(coalesce(p_actor, ''), 120)), '');
  v_ccy    public.wallet_currency;
  v_key    text;
  v_amount numeric;
begin
  if v_actor is null then raise exception 'control_ib_settle: actor required'; end if;
  begin
    v_ccy := p_currency::public.wallet_currency;
  exception when others then
    return jsonb_build_object('result', 'invalid');
  end;
  if not exists (select 1 from public.profiles p where p.id = p_ib) then return jsonb_build_object('result', 'not_found'); end if;

  v_key := 'ibsettle-ctl-' || p_ib::text || '-' || v_ccy::text || '-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
  v_amount := public.settle_ib_commissions(p_ib, v_ccy, v_key);
  if v_amount is null or v_amount <= 0 then
    return jsonb_build_object('result', 'nothing');
  end if;
  update public.wallet_transactions
     set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('control', jsonb_build_object('by', v_actor, 'action', 'ib_settle', 'at', now()))
   where idempotency_key = v_key;
  return jsonb_build_object('result', 'ok', 'amount', v_amount, 'currency', v_ccy);
end;
$$;

revoke all on function public.control_ib_list() from public, anon, authenticated;
revoke all on function public.control_ib_detail(uuid) from public, anon, authenticated;
revoke all on function public.control_ib_detach(uuid) from public, anon, authenticated;
revoke all on function public.control_ib_set_role(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.control_ib_link(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.control_ib_unlink(uuid, text) from public, anon, authenticated;
revoke all on function public.control_ib_set_plan(uuid, uuid, uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.control_ib_settle(uuid, text, text) from public, anon, authenticated;
grant execute on function public.control_ib_list() to service_role;
grant execute on function public.control_ib_detail(uuid) to service_role;
grant execute on function public.control_ib_set_role(uuid, boolean, text) to service_role;
grant execute on function public.control_ib_link(uuid, uuid, uuid, text) to service_role;
grant execute on function public.control_ib_unlink(uuid, text) to service_role;
grant execute on function public.control_ib_set_plan(uuid, uuid, uuid, numeric, text) to service_role;
grant execute on function public.control_ib_settle(uuid, text, text) to service_role;

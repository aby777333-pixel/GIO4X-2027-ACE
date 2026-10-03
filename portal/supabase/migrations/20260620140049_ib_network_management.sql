-- Staff-side IB network management: promote/demote IB role, re-parent, unlink,
-- and a tree-fetch. All staff-gated (is_staff via the backing console session).

-- Promote a profile to IB (or demote back to trader).
create or replace function public.staff_set_ib_role(p_user_id uuid, p_is_ib boolean)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff access only'; end if;
  update public.profiles
     set role = case when p_is_ib then 'ib'::public.user_role else 'trader'::public.user_role end,
         updated_at = now()
   where id = p_user_id;
  return 'ok';
end; $$;

-- Remove a node from its parent (detach this child edge).
create or replace function public.staff_unlink_ib(p_child_id uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff access only'; end if;
  delete from public.ib_relationships where child_id = p_child_id;
  return 'ok';
end; $$;

-- Move a node under a new parent (cycle-checked: the new parent may not be
-- inside the child's own downline).
create or replace function public.staff_reparent_ib(p_child_id uuid, p_new_parent_id uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff access only'; end if;
  if p_child_id = p_new_parent_id then raise exception 'an IB cannot be parented to itself'; end if;
  if exists (
    with recursive dn as (
      select child_id from public.ib_relationships where parent_id = p_child_id
      union all
      select r.child_id from public.ib_relationships r join dn on r.parent_id = dn.child_id
    ) select 1 from dn where child_id = p_new_parent_id
  ) then
    raise exception 'cycle: the chosen parent is within this node''s downline';
  end if;
  delete from public.ib_relationships where child_id = p_child_id;
  insert into public.ib_relationships (parent_id, child_id, level, commission_plan_id)
  values (p_new_parent_id, p_child_id, 1, (select id from public.commission_plans where is_default limit 1))
  on conflict (parent_id, child_id) do nothing;
  return 'ok';
end; $$;

-- Flat node list for the staff IB tree (UI nests it by parent_id). Includes any
-- profile that is an IB, or is a parent/child in a relationship.
create or replace function public.ib_network_nodes()
returns table(id uuid, parent_id uuid, full_name text, email text, role text, referral_code text, accrued numeric)
language sql security definer set search_path = public stable as $$
  select p.id,
         (select r.parent_id from public.ib_relationships r where r.child_id = p.id order by r.created_at limit 1),
         p.full_name, p.email, p.role::text, p.referral_code,
         coalesce((select sum(cl.amount) from public.commission_ledger cl
                    where cl.ib_user_id = p.id and cl.settled = false), 0)
  from public.profiles p
  where public.is_staff()
    and ( p.role = 'ib'
       or exists (select 1 from public.ib_relationships r where r.child_id = p.id)
       or exists (select 1 from public.ib_relationships r where r.parent_id = p.id) );
$$;

revoke all on function public.staff_set_ib_role(uuid,boolean)  from public, anon;
revoke all on function public.staff_unlink_ib(uuid)            from public, anon;
revoke all on function public.staff_reparent_ib(uuid,uuid)     from public, anon;
revoke all on function public.ib_network_nodes()               from public, anon;
grant execute on function public.staff_set_ib_role(uuid,boolean) to authenticated;
grant execute on function public.staff_unlink_ib(uuid)          to authenticated;
grant execute on function public.staff_reparent_ib(uuid,uuid)   to authenticated;
grant execute on function public.ib_network_nodes()             to authenticated;

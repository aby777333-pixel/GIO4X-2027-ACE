-- Master-admin (role=admin) team + per-section access control for /staff.
-- profiles.staff_sections = list of console section keys a staff member may see.
--   NULL  -> unrestricted (all sections; backward-compatible for existing staff)
--   [...] -> only those sections. role=admin is always full access.

alter table public.profiles add column if not exists staff_sections text[];

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Set a team member's role + section access (master-admin only).
create or replace function public.admin_set_staff_access(p_user_id uuid, p_role text, p_sections text[])
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'master admin access only'; end if;
  if p_role not in ('staff','admin','trader','ib','affiliate') then
    raise exception 'invalid role %', p_role;
  end if;
  update public.profiles
     set role = p_role::public.user_role,
         -- admins are unrestricted; only staff carry a section list
         staff_sections = case when p_role = 'staff' then p_sections else null end,
         updated_at = now()
   where id = p_user_id;
  return 'ok';
end; $$;

-- Team roster for the admin panel (staff + admins).
create or replace function public.admin_list_team()
returns table(id uuid, full_name text, email text, role text, staff_sections text[], created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select p.id, p.full_name, p.email, p.role::text, p.staff_sections, p.created_at
  from public.profiles p
  where public.is_admin() and p.role in ('staff','admin')
  order by (p.role = 'admin') desc, p.created_at;
$$;

revoke all on function public.is_admin()                                   from public, anon;
revoke all on function public.admin_set_staff_access(uuid,text,text[])     from public, anon;
revoke all on function public.admin_list_team()                            from public, anon;
grant execute on function public.is_admin()                                to authenticated;
grant execute on function public.admin_set_staff_access(uuid,text,text[])  to authenticated;
grant execute on function public.admin_list_team()                         to authenticated;

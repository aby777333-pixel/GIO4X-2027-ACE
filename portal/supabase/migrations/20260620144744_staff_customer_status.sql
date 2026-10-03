-- Staff: suspend / activate / close a customer account.
create or replace function public.staff_set_customer_status(p_user_id uuid, p_status text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff access only'; end if;
  if p_status not in ('active','suspended','closed','pending_verification') then
    raise exception 'invalid status %', p_status;
  end if;
  update public.profiles set status = p_status::public.user_status, updated_at = now()
   where id = p_user_id;
  return 'ok';
end; $$;

revoke all on function public.staff_set_customer_status(uuid,text) from public, anon;
grant execute on function public.staff_set_customer_status(uuid,text) to authenticated;

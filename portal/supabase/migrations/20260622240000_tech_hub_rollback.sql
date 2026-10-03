-- One-click rollback: revert a config change to its recorded "before" value.
-- Relies on the before/after values captured by 20260622230000_tech_hub_audit_hardening.
create or replace function public.tech_rollback(p_audit_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.tech_is_super_admin() then raise exception 'super admin only'; end if;
  select action, module, detail into r from public.tech_audit_log where id = p_audit_id;
  if not found then raise exception 'audit row not found'; end if;
  if not (r.detail ? 'before') then raise exception 'this action is not revertible'; end if;

  if r.action = 'setting.changed' then
    perform public.tech_setting_set(r.detail->>'key', coalesce(r.detail->'before', 'null'::jsonb));
  elsif r.action = 'flag.set' then
    perform public.tech_flag_set(r.detail->>'key', coalesce((r.detail->>'before')::boolean, false));
  elsif r.action in ('module.enabled','module.disabled') then
    perform public.tech_module_toggle(r.module, (r.detail->>'before')::boolean);
  elsif r.action in ('superadmin.granted','superadmin.revoked') then
    perform public.tech_set_super_admin((r.detail->>'user_id')::uuid, coalesce((r.detail->>'before')::boolean, false));
  else
    raise exception 'action % is not revertible', r.action;
  end if;

  perform public.tech_audit_write('rollback', coalesce(r.module,'platform'), jsonb_build_object('reverted_audit', p_audit_id, 'reverted_action', r.action));
  return 'ok';
end; $$;
revoke all on function public.tech_rollback(uuid) from public, anon;
grant execute on function public.tech_rollback(uuid) to authenticated;

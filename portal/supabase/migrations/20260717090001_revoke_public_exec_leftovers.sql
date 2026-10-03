-- 20260717090001_revoke_public_exec_leftovers.sql
-- Follow-up to 20260717090000: recompute_kyc_status and tech_audit_search still
-- carried the default PUBLIC execute grant (=X in proacl), so revoking `anon`
-- alone had no effect — anon inherited execute via PUBLIC. Revoke PUBLIC; the
-- explicit grants they need (service_role on both, authenticated on
-- tech_audit_search) are already in place.
revoke execute on function public.recompute_kyc_status(uuid) from public;
revoke execute on function public.tech_audit_search(text, integer) from public;

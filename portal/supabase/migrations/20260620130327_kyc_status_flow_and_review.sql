-- KYC was permanently stuck: documents upload as 'pending' but nothing ever
-- approves them and profiles.kyc_status never tracked doc state. Add (1) a
-- recompute function + trigger so kyc_status always reflects the docs, and
-- (2) a staff-gated review RPC to approve/reject.

-- 1) derive kyc_status from the user's documents
create or replace function public.recompute_kyc_status(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id boolean; v_selfie boolean; v_addr boolean;
  v_open boolean; v_rej boolean; v_any boolean;
  v_new public.kyc_status;
begin
  select
    bool_or(status='approved' and doc_type in ('passport','national_id','drivers_license')),
    bool_or(status='approved' and doc_type='selfie'),
    bool_or(status='approved' and doc_type in ('utility_bill','bank_statement')),
    bool_or(status in ('pending','in_review')),
    bool_or(status='rejected'),
    count(*) > 0
  into v_id, v_selfie, v_addr, v_open, v_rej, v_any
  from public.kyc_documents where user_id = p_user_id;

  if coalesce(v_id,false) and coalesce(v_selfie,false) and coalesce(v_addr,false) then
    v_new := 'approved';
  elsif coalesce(v_open,false) then
    v_new := 'in_review';
  elsif coalesce(v_rej,false) then
    v_new := 'rejected';
  elsif coalesce(v_any,false) then
    v_new := 'in_progress';
  else
    v_new := 'not_started';
  end if;

  update public.profiles
     set kyc_status = v_new,
         status = case when v_new='approved' then 'active'::public.user_status else status end,
         updated_at = now()
   where id = p_user_id and kyc_status is distinct from v_new;
end; $$;

-- 2) trigger: any doc change recomputes the owner's kyc_status
create or replace function public.fn_kyc_docs_recompute()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_kyc_status(coalesce(NEW.user_id, OLD.user_id));
  return coalesce(NEW, OLD);
end; $$;

drop trigger if exists trg_kyc_docs_recompute on public.kyc_documents;
create trigger trg_kyc_docs_recompute
after insert or delete or update of status on public.kyc_documents
for each row execute function public.fn_kyc_docs_recompute();

-- 3) staff review RPC (approve/reject all of a user's open docs)
create or replace function public.review_kyc_user(p_user_id uuid, p_approve boolean, p_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    return 'forbidden';
  end if;
  update public.kyc_documents
     set status = case when p_approve then 'approved'::public.kyc_doc_status else 'rejected'::public.kyc_doc_status end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         rejection_reason = case when p_approve then null else coalesce(p_reason,'Documents did not meet requirements.') end,
         updated_at = now()
   where user_id = p_user_id and status in ('pending','in_review');
  perform public.recompute_kyc_status(p_user_id);
  return 'ok';
end; $$;

revoke all on function public.review_kyc_user(uuid,boolean,text) from public, anon;
grant execute on function public.review_kyc_user(uuid,boolean,text) to authenticated;

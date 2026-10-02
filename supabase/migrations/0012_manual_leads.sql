-- =============================================================================
-- GIO4X · 0012_manual_leads · an enquiry entered by a member of staff
-- =============================================================================
-- Until now every row in `leads` came from a form on the website and carried
-- the visitor's acceptance of the Privacy Policy. Staff also meet people by
-- telephone, at events and by referral, and need to record them.
--
-- A staff-entered enquiry is marked as such (`origin = 'staff'`, `added_by`),
-- and it carries NO consent evidence, because none was given on the website:
-- `privacy_accepted_at` is empty and marketing consent is false. The console
-- shows that plainly. The row is written only by lead_add_manual(), which
-- requires leads.write and records the entry in the audit log.
-- =============================================================================

do $guard$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles r
    where r.rolname = current_user and (r.rolbypassrls or r.rolsuper)
  ) then
    raise exception
      'GIO4X migrations must be applied by a role with BYPASSRLS (on Supabase: postgres). Current role: %', current_user;
  end if;
end
$guard$;

alter table public.leads add column if not exists origin text not null default 'website';
alter table public.leads add column if not exists added_by uuid;
alter table public.leads alter column privacy_accepted_at drop not null;

alter table public.leads drop constraint if exists leads_origin_valid;
alter table public.leads add constraint leads_origin_valid check (origin in ('website', 'staff'));

-- website rows always carry the acceptance; staff rows never claim one
alter table public.leads drop constraint if exists leads_origin_consent;
alter table public.leads add constraint leads_origin_consent check (
  (origin = 'website' and privacy_accepted_at is not null and added_by is null)
  or (origin = 'staff' and privacy_accepted_at is null and not marketing_consent and added_by is not null)
);

-- The public forms insert through column grants that do not include `origin`
-- or `added_by`, so a visitor cannot mark a row as staff-entered.

create or replace function public.lead_add_manual(
  p_name text,
  p_email text,
  p_phone text,
  p_country text,
  p_topic text,
  p_message text,
  p_how text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid := gen_random_uuid();
  ref text;
  how text := coalesce(nullif(btrim(p_how), ''), 'staff-entered');
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  bytes bytea;
  i integer;
begin
  if not (select public.staff_can('leads.write')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if how !~ '^[a-z0-9-]{2,40}$' then
    raise exception 'invalid source' using errcode = '22023';
  end if;

  -- GX- + 8 base32 characters from 40 random bits, as the website generates them
  bytes := extensions.gen_random_bytes(8);
  ref := 'GX-';
  for i in 0..7 loop
    ref := ref || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;

  insert into public.leads (
    id, reference, name, email, phone, country, topic, message, page, utm,
    privacy_accepted_at, privacy_version, marketing_consent, origin, added_by
  ) values (
    new_id, ref, btrim(p_name), lower(btrim(p_email)), nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_country, '')), ''), p_topic, p_message, '/',
    jsonb_build_object('utm_source', how),
    null, 'staff-entered', false, 'staff', (select auth.uid())
  );

  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values ((select auth.uid()), 'lead.add_manual', 'lead', new_id::text, jsonb_build_object('reference', ref, 'how', how));

  return new_id;
end;
$$;

revoke all on function public.lead_add_manual(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.lead_add_manual(text, text, text, text, text, text, text) to authenticated;

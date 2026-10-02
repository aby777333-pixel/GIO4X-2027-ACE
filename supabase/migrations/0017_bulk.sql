-- =============================================================================
-- GIO4X · 0017_bulk · enquiries imported from a file
-- -----------------------------------------------------------------------------
-- Apply after 0016. Re-runnable. Additive: one capability, one function, and
-- one `create or replace` of an existing trigger function (leads_before_insert,
-- 0003), described under 3 below. No table, column, policy or grant changes.
--
-- The boards and the bulk actions in the console (drag a card to another
-- column, change twenty rows at once) need nothing from the database: they
-- repeat, row by row and as the signed-in person, the same UPDATE the
-- single-row screens send, so the existing column grants, policies and
-- triggers (0002, 0004, 0005, 0007) decide and audit each row as before.
--
-- 1. Capability `leads.import` (admin only). Importing needs it AND
--    `leads.write`.
--
-- 2. leads_import(p_rows jsonb) -> jsonb
--    Up to 25 rows per call, each an object with the text keys
--      name, email, phone, country, topic, message, how
--    (phone, country and how may be absent, null or empty; how defaults to
--    'import'). Each valid row is inserted the way lead_add_manual() (0012)
--    inserts one: origin 'staff', added_by the caller, NO consent evidence
--    (privacy_accepted_at empty, marketing consent false), page '/', the
--    source in utm.utm_source, a generated GX- reference. The one difference:
--    privacy_version is 'staff-import' instead of 'staff-entered', so that an
--    imported row can be told from one typed in by hand (see 3).
--
--    The table's own CHECK constraints are the validation: a row they refuse
--    is reported and the others carry on. One bad row never fails the batch.
--    Returns an array, one entry per input row, in order:
--      {"result": "ok"}
--      {"result": "duplicate"}                       same address and same note
--                                                    as a staff-entered row made
--                                                    today (UTC), which includes
--                                                    rows earlier in this batch
--      {"result": "invalid", "reason": "<code>"}     code is one of: shape, name,
--                                                    email, phone, country, topic,
--                                                    message, how, address_limit,
--                                                    other
--    Errors for the whole call: 42501 (not authorised), 22023 (not an array of
--    1 to 25 elements).
--
--    ONE audit row per call: 'lead.import' with counts only
--    (rows, imported, duplicates, invalid). No name, address or reference.
--
-- 3. The throttle on leads (leads_before_insert, 0003) and the import.
--    That trigger applies to the API roles, and inside a SECURITY DEFINER
--    function auth.role() is still the caller's, so it applies to the import
--    as it does to lead_add_manual(). It has two rules:
--      · 3 rows per address per hour: KEPT for imported rows. A fourth row for
--        one address in a file is reported as invalid / address_limit.
--      · 30 rows per minute for everyone (the circuit breaker): an import of
--        many different people would trip it at once, and, worse, the rows it
--        had already written would shut the website's contact form for a
--        minute. So, for imports only:
--          a. a row being inserted by leads_import() is not refused by the
--             breaker;
--          b. imported rows are not counted by the breaker.
--    How a row is recognised as "being inserted by leads_import()":
--      the function sets the transaction-local setting gio4x.lead_import to
--      'on' for the duration of its loop, AND the row has origin = 'staff'
--      (a column no API role can write: 0012), AND the caller holds
--      leads.import. All three are required. A visitor cannot issue SET
--      through PostgREST; and if one somehow did, the other two conditions
--      still fail, so the setting alone exempts nobody.
--    How an imported row is recognised afterwards (b):
--      origin = 'staff' and privacy_version = 'staff-import'. A visitor can
--      choose privacy_version but not origin, so a visitor's row can never
--      escape the count.
--    For every other caller (the website's forms, lead_add_manual(), the
--    owner in SQL) the function body below is the 0003 body with those two
--    conditions added: same lock, same clock, same counts, same errors.
--    supabase/tests/0017_bulk.sql proves that the public throttles still bite.
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

insert into public.role_capabilities (role, capability) values
  ('admin', 'leads.import')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- The throttle, with the import recognised. Compare with 0003: the only
-- additions are `importing`, the `if not importing` around the breaker, and
-- the last line of the breaker's WHERE.
-- ---------------------------------------------------------------------------
create or replace function public.leads_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_all  integer;
  recent_same integer;
  importing   boolean;
begin
  if coalesce((select auth.role()), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  new.created_at := now();
  new.updated_at := now();

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('gio4x.throttle.leads'));

  -- all three, or the row is treated like any other (see the header, 3)
  importing := coalesce(pg_catalog.current_setting('gio4x.lead_import', true), '') = 'on'
               and new.origin = 'staff'
               and (select public.staff_can('leads.import'));

  if not importing then
    select count(*) into recent_all
    from public.leads l
    where l.created_at > now() - interval '1 minute'
      and not (l.origin = 'staff' and l.privacy_version = 'staff-import');
    if recent_all >= 30 then
      raise exception 'Too many requests' using errcode = 'PT429';
    end if;
  end if;

  select count(*) into recent_same
  from public.leads l
  where l.email = lower(new.email)
    and l.created_at > now() - interval '1 hour';
  if recent_same >= 3 then
    raise exception 'Too many requests' using errcode = 'PT429';
  end if;

  return new;
end;
$$;

revoke all on function public.leads_before_insert() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- leads_import
-- ---------------------------------------------------------------------------
create or replace function public.leads_import(p_rows jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet  constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  actor     uuid := (select auth.uid());
  -- "today" is the UTC day, the console's one clock
  day_start timestamptz := pg_catalog.date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  results   jsonb := '[]'::jsonb;
  total     integer;
  r         jsonb;
  v_name    text;
  v_email   text;
  v_phone   text;
  v_country text;
  v_topic   text;
  v_message text;
  v_how     text;
  ref       text;
  bytes     bytea;
  i         integer;
  attempt   integer;
  outcome   text;
  reason    text;
  cname     text;
  n_ok      integer := 0;
  n_dup     integer := 0;
  n_bad     integer := 0;
begin
  if actor is null
     or not (select public.staff_can('leads.write'))
     or not (select public.staff_can('leads.import'))
  then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be an array' using errcode = '22023';
  end if;
  total := jsonb_array_length(p_rows);
  if total < 1 or total > 25 then
    raise exception 'between 1 and 25 rows per call' using errcode = '22023';
  end if;

  -- read by leads_before_insert; transaction-local, and switched off again below
  perform pg_catalog.set_config('gio4x.lead_import', 'on', true);

  for r in
    select e.value from jsonb_array_elements(p_rows) with ordinality as e(value, n) order by e.n
  loop
    outcome := 'invalid';
    reason := null;

    if jsonb_typeof(r) <> 'object' then
      reason := 'shape';
    elsif exists (
      select 1 from jsonb_each(r) f
      where f.key not in ('name', 'email', 'phone', 'country', 'topic', 'message', 'how')
         or jsonb_typeof(f.value) not in ('string', 'null')
    ) then
      reason := 'shape';
    else
      -- the same trimming lead_add_manual() applies
      v_name    := btrim(coalesce(r ->> 'name', ''));
      v_email   := lower(btrim(coalesce(r ->> 'email', '')));
      v_phone   := nullif(btrim(coalesce(r ->> 'phone', '')), '');
      v_country := nullif(btrim(coalesce(r ->> 'country', '')), '');
      v_topic   := coalesce(r ->> 'topic', '');
      v_message := coalesce(r ->> 'message', '');
      v_how     := coalesce(nullif(btrim(coalesce(r ->> 'how', '')), ''), 'import');

      if v_how !~ '^[a-z0-9-]{2,40}$' then
        reason := 'how';
      elsif exists (
        select 1 from public.leads l
        where l.origin = 'staff'
          and l.email = v_email
          and l.message = v_message
          and l.created_at >= day_start
      ) then
        outcome := 'duplicate';
      else
        -- a reference that already exists (40 random bits) is simply drawn again
        for attempt in 1..3 loop
          bytes := extensions.gen_random_bytes(8);
          ref := 'GX-';
          for i in 0..7 loop
            ref := ref || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
          end loop;

          begin
            insert into public.leads (
              id, reference, name, email, phone, country, topic, message, page, utm,
              privacy_accepted_at, privacy_version, marketing_consent, origin, added_by
            ) values (
              gen_random_uuid(), ref, v_name, v_email, v_phone, v_country, v_topic, v_message, '/',
              jsonb_build_object('utm_source', v_how),
              null, 'staff-import', false, 'staff', actor
            );
            outcome := 'ok';
            reason := null;
            exit;
          exception
            when unique_violation then
              reason := 'other';
            when check_violation then
              get stacked diagnostics cname = constraint_name;
              reason := case cname
                when 'leads_name_valid' then 'name'
                when 'leads_email_valid' then 'email'
                when 'leads_phone_valid' then 'phone'
                when 'leads_country_valid' then 'country'
                when 'leads_topic_valid' then 'topic'
                when 'leads_message_valid' then 'message'
                when 'leads_utm_valid' then 'how'
                else 'other'
              end;
              exit;
            when others then
              -- PT429 here is the per-address rule (the breaker does not apply to an import)
              reason := case when sqlstate = 'PT429' then 'address_limit' else 'other' end;
              exit;
          end;
        end loop;
      end if;
    end if;

    if outcome = 'ok' then
      n_ok := n_ok + 1;
    elsif outcome = 'duplicate' then
      n_dup := n_dup + 1;
    else
      n_bad := n_bad + 1;
    end if;

    results := results || jsonb_build_array(
      jsonb_build_object('result', outcome)
      || case when outcome = 'invalid' then jsonb_build_object('reason', coalesce(reason, 'other')) else '{}'::jsonb end
    );
  end loop;

  perform pg_catalog.set_config('gio4x.lead_import', 'off', true);

  -- counts only: who was imported is on the rows themselves (added_by), never here
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (actor, 'lead.import', 'lead', null,
          jsonb_build_object('rows', total, 'imported', n_ok, 'duplicates', n_dup, 'invalid', n_bad));

  return results;
end;
$$;

revoke all on function public.leads_import(jsonb) from public, anon;
grant execute on function public.leads_import(jsonb) to authenticated;

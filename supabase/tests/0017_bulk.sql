-- =============================================================================
-- GIO4X · tests for 0017_bulk · run after applying supabase/migrations/0017_bulk.sql
-- =============================================================================
-- Run as the role that applies migrations (on Supabase: postgres). Everything
-- happens inside one transaction that is rolled back: no enquiry, capability or
-- audit entry made here survives.
--
-- How it works: the script becomes the API roles the way PostgREST does
-- (`role` and `request.jwt.claims`, both transaction-local), tries something,
-- returns to the role it started as, and writes one row per check into a
-- temporary table. The last statement before the rollback lists the results:
-- every row should say PASS.
--
-- Identities used:
--   importer   an existing active admin from public.staff
--   non-admin  the same person while the admin role is, inside this
--              transaction only, without leads.import (the rollback puts it
--              back). The real mapping (admin only) is checked separately from
--              the role_capabilities rows.
--   outsider   a signed-in user with no staff row (an id that does not exist)
--   visitor    the anon role, inserting the way the website's contact form does
--
-- The clock: now() does not move inside a transaction, so every row made here
-- is "within the last minute" and "within the last hour" for the throttles.
-- The circuit-breaker check counts whatever real enquiries arrived from the
-- website in the minute before the run and allows for them. All addresses used
-- are at example.invalid and begin with zz-0017.
-- =============================================================================

begin;

create temp table bulk_test_results (
  n    serial primary key,
  test text not null,
  pass boolean not null,
  note text not null default ''
) on commit drop;

do $test$
declare
  me        text := current_user;
  admin_id  uuid;
  staff_jwt text;
  other_jwt text := json_build_object('sub', '00000000-0000-4000-8000-000000000017', 'role', 'authenticated')::text;
  anon_jwt  text := json_build_object('role', 'anon')::text;
  res       jsonb;
  batch     jsonb;
  outcome   text;
  n         integer;
  seen      integer;
  base      integer;
  accepted  integer;
  audit_before bigint;
  note_a constant text := '[TEST] 0017 met at an event; asked about account types.';
begin
  select s.user_id into admin_id from public.staff s where s.role = 'admin' and s.active order by s.created_at limit 1;
  insert into bulk_test_results (test, pass, note) values ('an active admin exists to act as', admin_id is not null, coalesce(left(admin_id::text, 8), 'none'));
  if admin_id is null then
    return;
  end if;
  staff_jwt := json_build_object('sub', admin_id, 'role', 'authenticated')::text;

  -- ---- structure ------------------------------------------------------------
  select count(*) into n from public.role_capabilities rc where rc.capability = 'leads.import';
  select count(*) into seen from public.role_capabilities rc where rc.capability = 'leads.import' and rc.role = 'admin';
  insert into bulk_test_results (test, pass, note) values ('leads.import is held by admin and by no other role', n = 1 and seen = 1, n || ' role(s)');

  insert into bulk_test_results (test, pass) values (
    'anon may not execute leads_import; authenticated may (the function then checks the capability)',
    not has_function_privilege('anon', 'public.leads_import(jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.leads_import(jsonb)', 'execute')
  );
  insert into bulk_test_results (test, pass) values (
    'the throttle trigger function is still not callable by the API roles',
    not has_function_privilege('anon', 'public.leads_before_insert()', 'execute')
    and not has_function_privilege('authenticated', 'public.leads_before_insert()', 'execute')
  );
  insert into bulk_test_results (test, pass) values (
    'no API role can write origin, added_by or the staff columns of a lead on insert',
    not has_column_privilege('anon', 'public.leads', 'origin', 'insert')
    and not has_column_privilege('authenticated', 'public.leads', 'origin', 'insert')
    and not has_column_privilege('authenticated', 'public.leads', 'added_by', 'insert')
  );

  -- ---- who is refused ---------------------------------------------------------
  batch := jsonb_build_array(jsonb_build_object('name', 'Sample Person', 'email', 'zz-0017-refused@example.invalid', 'topic', 'General', 'message', note_a));

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', other_jwt, true);
  begin
    res := public.leads_import(batch);
    outcome := 'allowed';
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into bulk_test_results (test, pass, note) values ('a signed-in user who is not staff is refused', outcome = 'refused', outcome);

  delete from public.role_capabilities where role = 'admin' and capability = 'leads.import';
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    res := public.leads_import(batch);
    outcome := 'allowed';
  exception when insufficient_privilege then
    outcome := 'refused';
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into public.role_capabilities (role, capability) values ('admin', 'leads.import') on conflict do nothing;
  insert into bulk_test_results (test, pass, note) values ('a member of staff without leads.import (a non-admin) is refused, even with leads.write', outcome = 'refused', outcome);

  select count(*) into n from public.leads l where l.email = 'zz-0017-refused@example.invalid';
  insert into bulk_test_results (test, pass, note) values ('a refused call writes nothing', n = 0, n || ' row(s)');

  -- ---- the shape of a call ------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    res := public.leads_import('{"name": "not an array"}'::jsonb);
    outcome := 'allowed';
  exception when others then
    outcome := sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into bulk_test_results (test, pass, note) values ('something that is not an array is refused (22023)', outcome = '22023', outcome);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    res := public.leads_import('[]'::jsonb);
    outcome := 'allowed';
  exception when others then
    outcome := sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into bulk_test_results (test, pass, note) values ('an empty array is refused (22023)', outcome = '22023', outcome);

  select jsonb_agg(jsonb_build_object('name', 'Sample Person ' || g, 'email', 'zz-0017-over-' || g || '@example.invalid', 'topic', 'General', 'message', note_a))
    into batch from generate_series(1, 26) g;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    res := public.leads_import(batch);
    outcome := 'allowed';
  exception when others then
    outcome := sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into n from public.leads l where l.email like 'zz-0017-over-%';
  insert into bulk_test_results (test, pass, note) values ('26 rows in one call are refused (22023) and nothing is written', outcome = '22023' and n = 0, outcome || ', ' || n || ' row(s)');

  -- ---- one mixed batch ----------------------------------------------------------
  select coalesce(max(l.id), 0) into audit_before from public.audit_log l;

  batch := jsonb_build_array(
    /* 0 ok        */ jsonb_build_object('name', 'Sample Person One', 'email', 'ZZ-0017-One@Example.Invalid', 'topic', 'General', 'message', note_a),
    /* 1 ok        */ jsonb_build_object('name', 'Sample Person Two', 'email', 'zz-0017-two@example.invalid', 'phone', '+00 0000 000 000', 'country', 'Nowhere', 'topic', 'Account opening', 'message', note_a, 'how', 'event'),
    /* 2 email     */ jsonb_build_object('name', 'Sample Person Three', 'email', 'not-an-address', 'topic', 'General', 'message', note_a),
    /* 3 topic     */ jsonb_build_object('name', 'Sample Person Four', 'email', 'zz-0017-four@example.invalid', 'topic', 'Not a topic', 'message', note_a),
    /* 4 duplicate */ jsonb_build_object('name', 'Sample Person One again', 'email', 'zz-0017-one@example.invalid', 'topic', 'General', 'message', note_a),
    /* 5 ok        */ jsonb_build_object('name', 'Sample Person Five', 'email', 'zz-0017-five@example.invalid', 'phone', null, 'topic', 'Partnership', 'message', note_a, 'how', ''),
    /* 6 shape     */ to_jsonb('just a string'::text),
    /* 7 name      */ jsonb_build_object('name', '   ', 'email', 'zz-0017-seven@example.invalid', 'topic', 'General', 'message', note_a),
    /* 8 phone     */ jsonb_build_object('name', 'Sample Person Eight', 'email', 'zz-0017-eight@example.invalid', 'phone', 'call me', 'topic', 'General', 'message', note_a),
    /* 9 shape     */ jsonb_build_object('name', 'Sample Person Nine', 'email', 'zz-0017-nine@example.invalid', 'topic', 'General', 'message', note_a, 'status', 'resolved'),
    /* 10 how      */ jsonb_build_object('name', 'Sample Person Ten', 'email', 'zz-0017-ten@example.invalid', 'topic', 'General', 'message', note_a, 'how', 'Not A Source!'),
    /* 11 message  */ jsonb_build_object('name', 'Sample Person Eleven', 'email', 'zz-0017-eleven@example.invalid', 'topic', 'General', 'message', '')
  );

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    res := public.leads_import(batch);
    outcome := 'returned';
  exception when others then
    res := null;
    outcome := 'raised ' || sqlstate;
  end;
  seen := case when pg_catalog.current_setting('gio4x.lead_import', true) = 'on' then 1 else 0 end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into bulk_test_results (test, pass, note) values ('a batch with bad rows in it returns instead of failing', outcome = 'returned' and coalesce(jsonb_array_length(res), 0) = 12, outcome);
  if res is null then
    return;
  end if;

  insert into bulk_test_results (test, pass, note) values (
    'valid rows are imported although other rows in the batch are invalid',
    res -> 0 ->> 'result' = 'ok' and res -> 1 ->> 'result' = 'ok' and res -> 5 ->> 'result' = 'ok',
    concat_ws(', ', res -> 0 ->> 'result', res -> 1 ->> 'result', res -> 5 ->> 'result'));
  insert into bulk_test_results (test, pass, note) values (
    'each invalid row carries its fixed reason code',
    res -> 2 = '{"result": "invalid", "reason": "email"}'::jsonb
    and res -> 3 = '{"result": "invalid", "reason": "topic"}'::jsonb
    and res -> 6 = '{"result": "invalid", "reason": "shape"}'::jsonb
    and res -> 7 = '{"result": "invalid", "reason": "name"}'::jsonb
    and res -> 8 = '{"result": "invalid", "reason": "phone"}'::jsonb
    and res -> 9 = '{"result": "invalid", "reason": "shape"}'::jsonb
    and res -> 10 = '{"result": "invalid", "reason": "how"}'::jsonb
    and res -> 11 = '{"result": "invalid", "reason": "message"}'::jsonb,
    concat_ws(' ', res -> 2 ->> 'reason', res -> 3 ->> 'reason', res -> 6 ->> 'reason', res -> 7 ->> 'reason', res -> 8 ->> 'reason', res -> 9 ->> 'reason', res -> 10 ->> 'reason', res -> 11 ->> 'reason'));
  insert into bulk_test_results (test, pass, note) values (
    'a row repeating an address and note from earlier in the batch is skipped as a duplicate',
    res -> 4 = '{"result": "duplicate"}'::jsonb, coalesce(res -> 4 ->> 'result', 'none'));
  insert into bulk_test_results (test, pass, note) values (
    'a result says nothing but the outcome (no name, address or reference comes back)',
    res::text !~ '@' and res::text !~ 'GX-' and res::text !~ 'Sample', left((res -> 0)::text, 40));
  insert into bulk_test_results (test, pass, note) values ('the import setting is switched off again when the function returns', seen = 0, case when seen = 0 then 'off' else 'still on' end);

  select count(*) into n from public.leads l where l.email like 'zz-0017-%' and l.message = note_a;
  select count(*) into seen from public.leads l
    where l.email in ('zz-0017-one@example.invalid', 'zz-0017-two@example.invalid', 'zz-0017-five@example.invalid')
      and l.origin = 'staff' and l.added_by = admin_id
      and l.privacy_accepted_at is null and not l.marketing_consent and l.marketing_consent_at is null
      and l.privacy_version = 'staff-import'
      and l.status = 'new' and l.stage = 'enquiry' and l.assigned_to is null and l.page = '/'
      and l.reference ~ '^GX-[A-Z2-7]{8}$';
  insert into bulk_test_results (test, pass, note) values (
    'exactly the three valid rows exist: origin staff, added by the importer, NO consent, status new',
    n = 3 and seen = 3, n || ' row(s), ' || seen || ' as expected');

  select count(*) into n from public.leads l where
       (l.email = 'zz-0017-one@example.invalid' and l.utm = '{"utm_source": "import"}'::jsonb and l.name = 'Sample Person One' and l.phone is null)
    or (l.email = 'zz-0017-two@example.invalid' and l.utm = '{"utm_source": "event"}'::jsonb and l.phone = '+00 0000 000 000' and l.country = 'Nowhere')
    or (l.email = 'zz-0017-five@example.invalid' and l.utm = '{"utm_source": "import"}'::jsonb);
  insert into bulk_test_results (test, pass, note) values ('the address is stored lower-case and the source is the chosen "how", or import', n = 3, n || ' of 3');

  select count(*) into n from public.audit_log l where l.id > audit_before;
  select count(*) into seen from public.audit_log l
    where l.id > audit_before and l.action = 'lead.import' and l.entity = 'lead' and l.entity_id is null and l.actor = admin_id
      and l.detail = '{"rows": 12, "imported": 3, "duplicates": 1, "invalid": 8}'::jsonb;
  insert into bulk_test_results (test, pass, note) values (
    'ONE audit entry for the batch, with counts only',
    n = 1 and seen = 1, n || ' audit row(s) written, ' || seen || ' with the expected counts');

  -- ---- the same file again ---------------------------------------------------------
  batch := jsonb_build_array(batch -> 0, batch -> 1, batch -> 5);
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  res := public.leads_import(batch);
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into n from public.leads l where l.email like 'zz-0017-%' and l.message = note_a;
  insert into bulk_test_results (test, pass, note) values (
    'importing the same rows again the same day skips all of them as duplicates',
    res = '[{"result": "duplicate"}, {"result": "duplicate"}, {"result": "duplicate"}]'::jsonb and n = 3, res::text);

  -- ---- the per-address rule still applies to an import --------------------------------
  select jsonb_agg(jsonb_build_object('name', 'Sample Person Same', 'email', 'zz-0017-same@example.invalid', 'topic', 'General', 'message', '[TEST] 0017 note number ' || g) order by g)
    into batch from generate_series(1, 4) g;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  res := public.leads_import(batch);
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into bulk_test_results (test, pass, note) values (
    'three enquiries per address per hour still applies inside an import: the fourth is refused, the batch carries on',
    res = '[{"result": "ok"}, {"result": "ok"}, {"result": "ok"}, {"result": "invalid", "reason": "address_limit"}]'::jsonb, res::text);

  -- ---- many different addresses are not stopped by the 30-a-minute breaker --------------
  accepted := 0;
  for n in 0..1 loop
    select jsonb_agg(jsonb_build_object('name', 'Sample Person ' || g, 'email', 'zz-0017-many-' || g || '@example.invalid', 'topic', 'General', 'message', note_a) order by g)
      into batch from generate_series(n * 25 + 1, n * 25 + 25) g;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', staff_jwt, true);
    res := public.leads_import(batch);
    perform set_config('role', me, true);
    perform set_config('request.jwt.claims', '{}', true);
    select accepted + count(*) into accepted from jsonb_array_elements(res) e where e.value ->> 'result' = 'ok';
  end loop;
  insert into bulk_test_results (test, pass, note) values ('50 different people import in one minute (the breaker does not stop an import)', accepted = 50, accepted || ' of 50');

  -- ---- the website's form afterwards ---------------------------------------------------
  -- what the breaker counts: everything in the last minute except imported rows
  select count(*) into base from public.leads l
    where l.created_at > now() - interval '1 minute' and not (l.origin = 'staff' and l.privacy_version = 'staff-import');

  -- three per address per hour, as a visitor
  accepted := 0;
  outcome := 'never refused';
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', anon_jwt, true);
  for n in 1..4 loop
    begin
      insert into public.leads (id, reference, name, email, topic, message, page, utm, privacy_accepted_at, privacy_version, marketing_consent, marketing_consent_at)
      values (gen_random_uuid(), 'GX-' || translate(upper(substr(md5(random()::text || n), 1, 8)), '0189', 'WXYZ'),
              'Test Visitor', 'zz-0017-visitor@example.invalid', 'General', '[TEST] 0017 from the form, ' || n, '/contact', '{}'::jsonb, now(), 'test', false, null);
      accepted := accepted + 1;
    exception when others then
      outcome := 'attempt ' || n || ' refused ' || sqlstate;
    end;
  end loop;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into bulk_test_results (test, pass, note) values (
    'PUBLIC FORM: after 50 imported rows a visitor is still accepted, three times for one address, and refused the fourth (PT429)',
    base + 3 <= 30 and accepted = 3 and outcome = 'attempt 4 refused PT429', accepted || ' accepted, ' || outcome || ', ' || base || ' other row(s) in the minute before');

  -- thirty a minute for everyone, as visitors with different addresses
  select count(*) into base from public.leads l
    where l.created_at > now() - interval '1 minute' and not (l.origin = 'staff' and l.privacy_version = 'staff-import');
  accepted := 0;
  outcome := 'never refused';
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', anon_jwt, true);
  for n in 1..40 loop
    begin
      insert into public.leads (id, reference, name, email, topic, message, page, utm, privacy_accepted_at, privacy_version, marketing_consent, marketing_consent_at)
      values (gen_random_uuid(), 'GX-' || translate(upper(substr(md5(random()::text || n), 1, 8)), '0189', 'WXYZ'),
              'Test Visitor', 'zz-0017-crowd-' || n || '@example.invalid', 'General', '[TEST] 0017 from the form', '/contact', '{}'::jsonb, now(), 'test', false, null);
      accepted := accepted + 1;
    exception when others then
      outcome := 'refused ' || sqlstate;
      exit;
    end;
  end loop;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into bulk_test_results (test, pass, note) values (
    'PUBLIC FORM: the 30-a-minute breaker still trips at exactly 30 rows, imported rows not counted',
    base + accepted = 30 and outcome = 'refused PT429', base || ' before + ' || accepted || ' accepted, then ' || outcome);

  -- the breaker is now tripped. Nothing a visitor can do gets past it.
  perform set_config('gio4x.lead_import', 'on', true);
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', anon_jwt, true);
  begin
    insert into public.leads (id, reference, name, email, topic, message, page, utm, privacy_accepted_at, privacy_version, marketing_consent, marketing_consent_at)
    values (gen_random_uuid(), 'GX-ZZZZ2222', 'Test Visitor', 'zz-0017-setting@example.invalid', 'General', '[TEST] 0017 with the setting on', '/contact', '{}'::jsonb, now(), 'staff-import', false, null);
    outcome := 'allowed';
  exception when others then
    outcome := 'refused ' || sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into bulk_test_results (test, pass, note) values (
    'PUBLIC FORM: a visitor is still refused with the import setting on and privacy_version "staff-import" (the setting alone exempts nobody)',
    outcome = 'refused PT429', outcome);

  -- a member of staff holding leads.import, inserting the way the website does, with the setting on
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    insert into public.leads (id, reference, name, email, topic, message, page, utm, privacy_accepted_at, privacy_version, marketing_consent, marketing_consent_at)
    values (gen_random_uuid(), 'GX-ZZZZ3333', 'Test Visitor', 'zz-0017-staff-form@example.invalid', 'General', '[TEST] 0017 staff through the form', '/contact', '{}'::jsonb, now(), 'staff-import', false, null);
    outcome := 'allowed';
  exception when others then
    outcome := 'refused ' || sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('gio4x.lead_import', 'off', true);
  insert into bulk_test_results (test, pass, note) values (
    'a website-origin row is throttled even for an importer with the setting on (origin must be staff, which the API cannot write)',
    outcome = 'refused PT429', outcome);

  -- lead_add_manual() behaves as before: it is counted by, and stopped by, the breaker
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    perform public.lead_add_manual('Sample Person Manual', 'zz-0017-manual@example.invalid', null, null, 'General', '[TEST] 0017 by hand', 'telephone');
    outcome := 'allowed';
  exception when others then
    outcome := 'refused ' || sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into bulk_test_results (test, pass, note) values ('an enquiry added by hand is still stopped by the tripped breaker, as before this migration', outcome = 'refused PT429', outcome);

  -- and an import still goes through while the breaker is tripped for everyone else
  batch := jsonb_build_array(jsonb_build_object('name', 'Sample Person Late', 'email', 'zz-0017-late@example.invalid', 'topic', 'General', 'message', note_a));
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', staff_jwt, true);
  begin
    res := public.leads_import(batch);
    outcome := res -> 0 ->> 'result';
  exception when others then
    outcome := 'raised ' || sqlstate;
  end;
  perform set_config('role', me, true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into bulk_test_results (test, pass, note) values ('an import still goes through while the breaker is tripped for the website', outcome = 'ok', outcome);

  -- ---- nothing personal in the audit log ---------------------------------------------
  select count(*) into n from public.audit_log l where l.id > audit_before and l.action = 'lead.import';
  select count(*) into seen from public.audit_log l
    where l.id > audit_before and l.action = 'lead.import'
      and (l.detail::text ~ '@' or l.detail::text ~* 'sample' or l.detail::text ~ 'GX-' or l.entity_id is not null
           or (l.detail - array['rows', 'imported', 'duplicates', 'invalid']) <> '{}'::jsonb);
  insert into bulk_test_results (test, pass, note) values (
    'six import calls returned, six audit entries, none with anything but the four counts',
    n = 6 and seen = 0, n || ' entries, ' || seen || ' with something else in them');

  select count(*) into n from public.audit_log l where l.id > audit_before and l.action = 'lead.add_manual';
  insert into bulk_test_results (test, pass, note) values ('an import writes no per-row audit entries', n = 0, n || ' lead.add_manual row(s)');
end
$test$;

select n, test, case when pass then 'PASS' else 'FAIL' end as result, note from bulk_test_results order by n;

rollback;

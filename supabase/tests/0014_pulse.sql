-- =============================================================================
-- GIO4X · tests for 0014_pulse
-- =============================================================================
-- Run after applying supabase/migrations/0014_pulse.sql, as the role that
-- applied it (postgres). Everything happens inside one transaction that is
-- rolled back, so no count is left behind. The last statement lists every
-- check with pass = true or false; all of them must be true.
--
-- The checks switch between the API roles with set_config('role', …, true) and
-- back with set_config('role', 'none', true); results are written only while
-- the privileged role is in effect, so the temp table needs no grant.
--
-- The staff identity is an existing active admin from public.staff. Without
-- one, the checks that need staff are recorded as failed with the reason.
-- =============================================================================

begin;

create temp table pulse_t (n integer, name text, pass boolean, detail text) on commit drop;

-- ---- 1. structure: only counts, nothing about a visitor ----------------------
insert into pulse_t
select 1, 'pulse_pages has exactly the columns day, path, ref_class, views',
       coalesce(string_agg(column_name::text, ',' order by ordinal_position), '') = 'day,path,ref_class,views',
       coalesce(string_agg(column_name::text, ',' order by ordinal_position), '')
from information_schema.columns where table_schema = 'public' and table_name = 'pulse_pages';

insert into pulse_t
select 2, 'pulse_forms has exactly the columns day, form, count',
       coalesce(string_agg(column_name::text, ',' order by ordinal_position), '') = 'day,form,count',
       coalesce(string_agg(column_name::text, ',' order by ordinal_position), '')
from information_schema.columns where table_schema = 'public' and table_name = 'pulse_forms';

insert into pulse_t
select 3, 'pulse_search has exactly the columns day, term, count',
       coalesce(string_agg(column_name::text, ',' order by ordinal_position), '') = 'day,term,count',
       coalesce(string_agg(column_name::text, ',' order by ordinal_position), '')
from information_schema.columns where table_schema = 'public' and table_name = 'pulse_search';

insert into pulse_t
select 4, 'row level security is enabled and forced on all four tables',
       count(*) = 4 and bool_and(c.relrowsecurity and c.relforcerowsecurity),
       count(*)::text || ' tables found'
from pg_catalog.pg_class c join pg_catalog.pg_namespace ns on ns.oid = c.relnamespace
where ns.nspname = 'public' and c.relname in ('pulse_pages', 'pulse_forms', 'pulse_search', 'pulse_state');

insert into pulse_t
select 5, 'no API role holds any privilege on the tables',
       not exists (
         select 1 from information_schema.role_table_grants g
         where g.table_schema = 'public' and g.table_name like 'pulse\_%' and g.grantee in ('anon', 'authenticated', 'PUBLIC')),
       '';

insert into pulse_t
select 6, 'analytics.read belongs to admin, sales and compliance and to nobody else',
       coalesce(string_agg(rc.role, ',' order by rc.role), '') = 'admin,compliance,sales',
       coalesce(string_agg(rc.role, ',' order by rc.role), '')
from public.role_capabilities rc where rc.capability = 'analytics.read';

-- ---- 2. the anonymous role: may count, may not look ---------------------------
do $$
declare
  today  date := (now() at time zone 'utc')::date;
  before integer;
  after  integer;
  rows_before bigint;
  rows_after  bigint;
  got    boolean;
  denied boolean;
begin
  -- start from a quiet minute so the throttle is not what is being tested here
  update public.pulse_state set hits = 0, minute = date_trunc('minute', now()), pruned_on = today where id = 1;

  -- direct reads and writes are refused
  perform set_config('role', 'anon', true);
  begin
    perform 1 from public.pulse_pages limit 1;
    denied := false;
  exception when insufficient_privilege then denied := true;
  end;
  perform set_config('role', 'none', true);
  insert into pulse_t values (10, 'anon cannot select from pulse_pages', denied, '');

  perform set_config('role', 'anon', true);
  begin
    insert into public.pulse_pages (day, path, ref_class, views) values ((now() at time zone 'utc')::date, '/contact', 'none', 999);
    denied := false;
  exception when insufficient_privilege then denied := true;
  end;
  perform set_config('role', 'none', true);
  insert into pulse_t values (11, 'anon cannot insert into pulse_pages', denied, '');

  perform set_config('role', 'anon', true);
  begin
    perform 1 from public.pulse_search limit 1;
    denied := false;
  exception when insufficient_privilege then denied := true;
  end;
  perform set_config('role', 'none', true);
  insert into pulse_t values (12, 'anon cannot select from pulse_search', denied, '');

  perform set_config('role', 'anon', true);
  begin
    perform public.pulse_summary(7);
    denied := false;
  exception when insufficient_privilege then denied := true;
  end;
  perform set_config('role', 'none', true);
  insert into pulse_t values (13, 'anon cannot call pulse_summary', denied, '');

  perform set_config('role', 'anon', true);
  begin
    perform public.pulse_gate();
    denied := false;
  exception when insufficient_privilege then denied := true;
  end;
  perform set_config('role', 'none', true);
  insert into pulse_t values (14, 'anon cannot call pulse_gate', denied, '');

  perform set_config('role', 'anon', true);
  begin
    perform public.pulse_prune();
    denied := false;
  exception when insufficient_privilege then denied := true;
  end;
  perform set_config('role', 'none', true);
  insert into pulse_t values (15, 'anon cannot call pulse_prune', denied, '');

  -- a page view adds exactly one to one row
  select coalesce(sum(views), 0) into before from public.pulse_pages where day = today and path = '/contact' and ref_class = 'none';
  perform set_config('role', 'anon', true);
  got := public.pulse_hit('/contact', 'none');
  perform set_config('role', 'none', true);
  select coalesce(sum(views), 0) into after from public.pulse_pages where day = today and path = '/contact' and ref_class = 'none';
  insert into pulse_t values (20, 'pulse_hit as anon returns true and adds exactly 1', got and after = before + 1, before || ' -> ' || after);

  select count(*) into rows_before from public.pulse_pages;
  perform set_config('role', 'anon', true);
  got := public.pulse_hit('/contact', 'none');
  perform set_config('role', 'none', true);
  select count(*) into rows_after from public.pulse_pages;
  select coalesce(sum(views), 0) into after from public.pulse_pages where day = today and path = '/contact' and ref_class = 'none';
  insert into pulse_t values (21, 'a second view of the same page adds to the same row, not a new one', got and rows_after = rows_before and after = before + 2, rows_before || ' rows -> ' || rows_after);

  -- the same page from a search engine is its own row, and nothing else about the referrer is kept
  perform set_config('role', 'anon', true);
  got := public.pulse_hit('/contact', 'search');
  perform set_config('role', 'none', true);
  insert into pulse_t values (22, 'the referrer class is stored as a class',
    got and exists (select 1 from public.pulse_pages where day = today and path = '/contact' and ref_class = 'search'), '');

  -- values that are not a clean path or a known class are not counted at all
  select count(*) into rows_before from public.pulse_pages;
  select coalesce(sum(views), 0) into before from public.pulse_pages;
  perform set_config('role', 'anon', true);
  got := public.pulse_hit('/contact?email=someone@example.invalid', 'none')
      or public.pulse_hit('/someone@example.invalid', 'none')
      or public.pulse_hit('contact', 'none')
      or public.pulse_hit('/Contact', 'none')
      or public.pulse_hit('/a b', 'none')
      or public.pulse_hit('/' || repeat('a', 120), 'none')
      or public.pulse_hit(null, 'none')
      or public.pulse_hit('/contact', 'https://example.invalid/page')
      or public.pulse_hit('/contact', 'google');
  perform set_config('role', 'none', true);
  select count(*) into rows_after from public.pulse_pages;
  select coalesce(sum(views), 0) into after from public.pulse_pages;
  insert into pulse_t values (23, 'a query string, an e-mail address, upper case, a space, an over-long path and an unknown referrer are all refused and store nothing',
    not got and rows_after = rows_before and after = before, '');

  perform set_config('role', 'anon', true);
  got := public.pulse_hit('(other)', 'other');
  perform set_config('role', 'none', true);
  insert into pulse_t values (24, 'the literal (other) is accepted',
    got and exists (select 1 from public.pulse_pages where day = today and path = '(other)' and ref_class = 'other'), '');

  -- forms
  select coalesce(sum(count), 0) into before from public.pulse_forms where day = today and form = 'support';
  perform set_config('role', 'anon', true);
  got := public.pulse_form_hit('support');
  perform set_config('role', 'none', true);
  select coalesce(sum(count), 0) into after from public.pulse_forms where day = today and form = 'support';
  insert into pulse_t values (30, 'pulse_form_hit adds exactly 1 for a known form', got and after = before + 1, before || ' -> ' || after);

  select coalesce(sum(count), 0) into before from public.pulse_forms;
  perform set_config('role', 'anon', true);
  got := public.pulse_form_hit('someone@example.invalid') or public.pulse_form_hit('') or public.pulse_form_hit(null);
  perform set_config('role', 'none', true);
  select coalesce(sum(count), 0) into after from public.pulse_forms;
  insert into pulse_t values (31, 'pulse_form_hit refuses anything that is not one of the four forms', not got and after = before, '');

  -- search
  select coalesce(sum(count), 0) into before from public.pulse_search where day = today and term = 'slippage';
  perform set_config('role', 'anon', true);
  got := public.pulse_search_hit('slippage');
  perform set_config('role', 'none', true);
  select coalesce(sum(count), 0) into after from public.pulse_search where day = today and term = 'slippage';
  insert into pulse_t values (40, 'pulse_search_hit adds exactly 1 for a term', got and after = before + 1, before || ' -> ' || after);

  select coalesce(sum(count), 0) into before from public.pulse_search where day = today and term = '(unmatched)';
  perform set_config('role', 'anon', true);
  got := public.pulse_search_hit('') and public.pulse_search_hit(null) and public.pulse_search_hit();
  perform set_config('role', 'none', true);
  select coalesce(sum(count), 0) into after from public.pulse_search where day = today and term = '(unmatched)';
  insert into pulse_t values (41, 'an empty or missing term is counted as (unmatched)', got and after = before + 3, before || ' -> ' || after);

  select count(*) into rows_before from public.pulse_search;
  select coalesce(sum(count), 0) into before from public.pulse_search;
  perform set_config('role', 'anon', true);
  got := public.pulse_search_hit('someone@example.invalid')
      or public.pulse_search_hit('Sample Person')
      or public.pulse_search_hit('+44 20 7946 0000')
      or public.pulse_search_hit(repeat('a', 49))
      or public.pulse_search_hit(' leading space');
  perform set_config('role', 'none', true);
  select count(*) into rows_after from public.pulse_search;
  select coalesce(sum(count), 0) into after from public.pulse_search;
  insert into pulse_t values (42, 'an e-mail address, a capitalised name, a telephone number and an over-long string are refused and store nothing',
    not got and rows_after = rows_before and after = before, '');
end
$$;

-- ---- 3. the throttle ----------------------------------------------------------
do $$
declare
  today  date := (now() at time zone 'utc')::date;
  before bigint;
  after  bigint;
  got    boolean;
begin
  -- now() does not move inside a transaction, so this is "the current minute is full"
  update public.pulse_state set hits = 600, minute = date_trunc('minute', now()) where id = 1;
  select coalesce(sum(views), 0) into before from public.pulse_pages;
  perform set_config('role', 'anon', true);
  got := public.pulse_hit('/contact', 'none') or public.pulse_form_hit('contact') or public.pulse_search_hit('slippage');
  perform set_config('role', 'none', true);
  select coalesce(sum(views), 0) into after from public.pulse_pages;
  insert into pulse_t values (50, 'past 600 events in a minute nothing more is counted', not got and after = before, '');

  -- a new minute starts from one
  update public.pulse_state set hits = 600, minute = date_trunc('minute', now()) - interval '1 minute' where id = 1;
  perform set_config('role', 'anon', true);
  got := public.pulse_hit('/contact', 'none');
  perform set_config('role', 'none', true);
  insert into pulse_t values (51, 'the next minute counts again, starting from 1',
    got and (select hits from public.pulse_state where id = 1) = 1, '');
end
$$;

-- ---- 4. the bounds on distinct paths and terms --------------------------------
do $$
declare
  today  date := (now() at time zone 'utc')::date;
  before integer;
  after  integer;
  got    boolean;
begin
  update public.pulse_state set hits = 0, minute = date_trunc('minute', now()) where id = 1;

  insert into public.pulse_pages (day, path, ref_class, views)
  select today, '/zz-test/' || g, 'none', 1 from generate_series(1, 1500) g
  on conflict do nothing;

  select coalesce(sum(views), 0) into before from public.pulse_pages where day = today and path = '(other)';
  perform set_config('role', 'anon', true);
  got := public.pulse_hit('/zz-test/a-path-not-seen-today', 'none');
  perform set_config('role', 'none', true);
  select coalesce(sum(views), 0) into after from public.pulse_pages where day = today and path = '(other)';
  insert into pulse_t values (60, 'once 1500 paths have been seen in a day, a new path is counted as (other)',
    got and after = before + 1 and not exists (select 1 from public.pulse_pages where path = '/zz-test/a-path-not-seen-today'), before || ' -> ' || after);

  select views into before from public.pulse_pages where day = today and path = '/zz-test/7' and ref_class = 'none';
  perform set_config('role', 'anon', true);
  got := public.pulse_hit('/zz-test/7', 'none');
  perform set_config('role', 'none', true);
  select views into after from public.pulse_pages where day = today and path = '/zz-test/7' and ref_class = 'none';
  insert into pulse_t values (61, 'a path already seen today is still counted under its own name', got and after = before + 1, before || ' -> ' || after);

  insert into public.pulse_search (day, term, count)
  select today, 'zz test ' || g, 1 from generate_series(1, 1000) g
  on conflict do nothing;

  select coalesce(sum(count), 0) into before from public.pulse_search where day = today and term = '(other)';
  perform set_config('role', 'anon', true);
  got := public.pulse_search_hit('a term not seen today');
  perform set_config('role', 'none', true);
  select coalesce(sum(count), 0) into after from public.pulse_search where day = today and term = '(other)';
  insert into pulse_t values (62, 'once 1000 terms have been seen in a day, a new term is counted as (other)',
    got and after = before + 1 and not exists (select 1 from public.pulse_search where term = 'a term not seen today'), before || ' -> ' || after);
end
$$;

-- ---- 5. retention ---------------------------------------------------------------
do $$
declare
  today date := (now() at time zone 'utc')::date;
  got   boolean;
begin
  insert into public.pulse_pages (day, path, ref_class, views) values (today - 401, '/zz-test/old', 'none', 5), (today - 399, '/zz-test/kept', 'none', 5);
  insert into public.pulse_forms (day, form, count) values (today - 401, 'contact', 5), (today - 399, 'contact', 5);
  insert into public.pulse_search (day, term, count) values (today - 401, 'zz old', 5), (today - 399, 'zz kept', 5);

  -- already tidied today: the old rows stay for now
  update public.pulse_state set hits = 0, minute = date_trunc('minute', now()), pruned_on = today where id = 1;
  perform set_config('role', 'anon', true);
  got := public.pulse_hit('/contact', 'none');
  perform set_config('role', 'none', true);
  insert into pulse_t values (70, 'the tidy-up runs at most once a day',
    got and exists (select 1 from public.pulse_pages where day = today - 401), '');

  -- the first counted event of a new day removes them
  update public.pulse_state set pruned_on = today - 1 where id = 1;
  perform set_config('role', 'anon', true);
  got := public.pulse_hit('/contact', 'none');
  perform set_config('role', 'none', true);
  insert into pulse_t values (71, 'rows older than 400 days are deleted from all three tables, newer rows are kept',
    got
    and not exists (select 1 from public.pulse_pages where day < today - 400)
    and not exists (select 1 from public.pulse_forms where day < today - 400)
    and not exists (select 1 from public.pulse_search where day < today - 400)
    and exists (select 1 from public.pulse_pages where day = today - 399)
    and exists (select 1 from public.pulse_forms where day = today - 399)
    and exists (select 1 from public.pulse_search where day = today - 399)
    and (select pruned_on from public.pulse_state where id = 1) = today, '');
end
$$;

-- ---- 6. staff read the summary; nobody else does --------------------------------
do $$
declare
  today  date := (now() at time zone 'utc')::date;
  admin  uuid;
  s      jsonb;
  denied boolean;
  expected bigint;
begin
  select st.user_id into admin from public.staff st where st.role = 'admin' and st.active order by st.created_at limit 1;
  if admin is null then
    insert into pulse_t values (80, 'pulse_summary as an admin', false, 'no active admin in public.staff: this check could not run');
    return;
  end if;

  select coalesce(sum(views), 0) into expected from public.pulse_pages where day >= today - 6;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  s := public.pulse_summary(7);
  perform set_config('role', 'none', true);

  insert into pulse_t values (80, 'pulse_summary as an admin returns the period asked for',
    (s ->> 'days')::integer = 7 and (s ->> 'until')::date = today and (s ->> 'since')::date = today - 6, s ->> 'since' || ' to ' || (s ->> 'until'));
  insert into pulse_t values (81, 'views.by_day has one entry for every day of the period, zeros included',
    jsonb_array_length(s -> 'views' -> 'by_day') = 7, jsonb_array_length(s -> 'views' -> 'by_day')::text);
  insert into pulse_t values (82, 'views.total equals the sum of the rows in the period',
    (s -> 'views' ->> 'total')::bigint = expected, (s -> 'views' ->> 'total') || ' = ' || expected);
  insert into pulse_t values (83, 'views.by_day adds up to views.total',
    (select sum((e ->> 'count')::bigint) from jsonb_array_elements(s -> 'views' -> 'by_day') e) = (s -> 'views' ->> 'total')::bigint, '');
  insert into pulse_t values (84, 'by_path lists at most 25 paths and form_pages includes /contact',
    jsonb_array_length(s -> 'views' -> 'by_path') <= 25
    and exists (select 1 from jsonb_array_elements(s -> 'views' -> 'form_pages') e where e ->> 'key' = '/contact'), '');
  insert into pulse_t values (85, 'search totals: total = unmatched + other + the matched terms',
    (s -> 'search' ->> 'total')::bigint
      = (s -> 'search' ->> 'unmatched')::bigint + (s -> 'search' ->> 'other')::bigint
        + (select coalesce(sum(count), 0) from public.pulse_search where day >= today - 6 and term not in ('(unmatched)', '(other)')), '');
  insert into pulse_t values (86, 'no (unmatched) or (other) entry appears among the matched terms',
    not exists (select 1 from jsonb_array_elements(s -> 'search' -> 'by_term') e where e ->> 'key' in ('(unmatched)', '(other)')), '');
  insert into pulse_t values (87, 'forms lists the support form counted above',
    exists (select 1 from jsonb_array_elements(s -> 'forms') e where e ->> 'key' = 'support' and (e ->> 'count')::bigint >= 1), '');

  -- an out-of-range period is clamped, not obeyed
  perform set_config('role', 'authenticated', true);
  s := public.pulse_summary(100000);
  perform set_config('role', 'none', true);
  insert into pulse_t values (88, 'a period longer than 365 days is clamped to 365', (s ->> 'days')::integer = 365 and jsonb_array_length(s -> 'views' -> 'by_day') = 365, s ->> 'days');

  -- a signed-in user who is not staff
  perform set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.pulse_summary(7);
    denied := false;
  exception when insufficient_privilege then denied := true;
  end;
  perform set_config('role', 'none', true);
  insert into pulse_t values (89, 'a signed-in user who is not staff is refused by pulse_summary', denied, '');

  -- a member of staff whose role does not hold analytics.read (only if one exists)
  select st.user_id into admin from public.staff st
  where st.active and st.role not in (select rc.role from public.role_capabilities rc where rc.capability = 'analytics.read')
  limit 1;
  if admin is not null then
    perform set_config('request.jwt.claims', jsonb_build_object('sub', admin, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    begin
      perform public.pulse_summary(7);
      denied := false;
    exception when insufficient_privilege then denied := true;
    end;
    perform set_config('role', 'none', true);
    insert into pulse_t values (90, 'staff without analytics.read are refused by pulse_summary', denied, '');
  end if;
  perform set_config('request.jwt.claims', '', true);
end
$$;

select n, name, pass, detail from pulse_t order by n;

rollback;

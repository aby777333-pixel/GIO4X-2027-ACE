-- =============================================================================
-- GIO4X · 0014_pulse · the website's own visit counter
-- =============================================================================
-- Apply after 0009 (it uses staff_can and role_capabilities). Re-runnable and
-- purely additive.
--
-- What this stores, in full:
--
--   pulse_pages   (day, path, ref_class, views)   page views per UTC day, per
--                 path, per kind of place the visitor came from
--   pulse_forms   (day, form, count)              forms that were accepted
--   pulse_search  (day, term, count)              site searches
--   pulse_state   one row: the throttle window and the day of the last tidy-up
--
-- Every row is a COUNT. There is no row per visit and no column that could
-- describe a visitor: no identifier, no cookie value, no IP address, no user
-- agent, no referrer address, no query string, no time of day. A path is one
-- of the website's own public paths or the literal '(other)'; a search term is
-- one of the website's own words or the literal '(unmatched)'. The checks that
-- make that true live in the API (src/lib/server/pulse.ts): the database
-- cannot know the site's pages, so here the values are held to a strict
-- character set and length, which is what stops an e-mail address ('@') or a
-- query string ('?', '=', '&') from ever being stored, whoever calls.
--
-- Who may do what:
--   anon, authenticated   call pulse_hit(), pulse_form_hit(), pulse_search_hit().
--                         Each adds 1 to a counter and returns whether it did.
--                         Nobody can read or write the tables through the API.
--   analytics.read        (admin, sales, compliance) read pulse_summary().
--
-- Limits, stated plainly:
--   · Anyone holding the publishable key can call the three counting functions
--     directly, so the figures can be inflated by a deliberate sender. They
--     are counts for orientation, not audited figures.
--   · A global throttle of 600 counted events a minute, across all three
--     functions. Past it, events are dropped (not queued) until the minute
--     ends, so a flood makes that minute under-count for everyone.
--   · At most 1500 distinct paths and 1000 distinct search terms a day (the
--     site publishes about 300 pages and about 540 terms); past that, new
--     ones are added to '(other)'. The tables therefore cannot grow by more
--     than about 6000 + 4 + 1000 rows a day whatever is sent.
--   · Rows older than 400 days are deleted, at most once a day, by the first
--     counted event of the day (there is no scheduler in this project).
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
  ('admin', 'analytics.read'), ('sales', 'analytics.read'), ('compliance', 'analytics.read')
on conflict do nothing;

-- ---- tables -----------------------------------------------------------------
create table if not exists public.pulse_pages (
  day        date not null,
  path       text not null,
  ref_class  text not null,
  views      integer not null default 0,
  constraint pulse_pages_pkey primary key (day, path, ref_class),
  -- lower-case path characters only: no '?', '=', '&', '@', '%', no spaces
  constraint pulse_pages_path_valid check (path = '(other)' or (path ~ '^/[a-z0-9/_.-]*$' and char_length(path) <= 120)),
  constraint pulse_pages_ref_valid check (ref_class in ('none', 'internal', 'search', 'other')),
  constraint pulse_pages_views_valid check (views >= 0)
);
comment on table public.pulse_pages is 'Page views per UTC day, path and referrer class. A count: no row per visit, nothing about a visitor.';

create table if not exists public.pulse_forms (
  day    date not null,
  form   text not null,
  count  integer not null default 0,
  constraint pulse_forms_pkey primary key (day, form),
  constraint pulse_forms_form_valid check (form in ('contact', 'interest', 'support', 'newsletter')),
  constraint pulse_forms_count_valid check (count >= 0)
);
comment on table public.pulse_forms is 'Forms accepted per UTC day. A count only: the submissions themselves are in leads, tickets and newsletter_subscribers.';

create table if not exists public.pulse_search (
  day    date not null,
  term   text not null,
  count  integer not null default 0,
  constraint pulse_search_pkey primary key (day, term),
  -- a word or phrase from the site's own index, or one of two fixed labels
  constraint pulse_search_term_valid check (
    term in ('(unmatched)', '(other)') or (term ~ '^[a-z0-9][a-z0-9 .]*$' and char_length(term) <= 48)
  ),
  constraint pulse_search_count_valid check (count >= 0)
);
comment on table public.pulse_search is 'Site searches per UTC day. A term is stored only when it is one of the site''s own; anything else is counted under (unmatched) with no text.';

create table if not exists public.pulse_state (
  id         smallint not null,
  minute     timestamptz not null default now(),
  hits       integer not null default 0,
  pruned_on  date not null default ((now() at time zone 'utc')::date),
  constraint pulse_state_pkey primary key (id),
  constraint pulse_state_single check (id = 1)
);
comment on table public.pulse_state is 'One row: the current throttle minute, how many events it has counted, and the day old rows were last deleted.';

insert into public.pulse_state (id) values (1) on conflict (id) do nothing;

alter table public.pulse_pages enable row level security;
alter table public.pulse_pages force row level security;
alter table public.pulse_forms enable row level security;
alter table public.pulse_forms force row level security;
alter table public.pulse_search enable row level security;
alter table public.pulse_search force row level security;
alter table public.pulse_state enable row level security;
alter table public.pulse_state force row level security;

-- No grant and no policy for any API role: the tables are reached only through
-- the functions below.
revoke all on table public.pulse_pages from public, anon, authenticated;
revoke all on table public.pulse_forms from public, anon, authenticated;
revoke all on table public.pulse_search from public, anon, authenticated;
revoke all on table public.pulse_state from public, anon, authenticated;

create index if not exists pulse_pages_day_idx on public.pulse_pages (day);

-- ---- retention --------------------------------------------------------------
-- Deletes every count older than 400 days. Returns how many rows went.
create or replace function public.pulse_prune()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cutoff date := (now() at time zone 'utc')::date - 400;
  gone   integer := 0;
  n      integer;
begin
  delete from public.pulse_pages where day < cutoff;
  get diagnostics n = row_count;
  gone := gone + n;
  delete from public.pulse_forms where day < cutoff;
  get diagnostics n = row_count;
  gone := gone + n;
  delete from public.pulse_search where day < cutoff;
  get diagnostics n = row_count;
  gone := gone + n;
  return gone;
end;
$$;

-- ---- the gate every counted event passes ------------------------------------
-- True when the event may be counted. Updating the single state row also takes
-- its lock, so two events are never counted at the same moment: the "is this a
-- new path today?" question below cannot race.
create or replace function public.pulse_gate()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  this_minute timestamptz := date_trunc('minute', now());
  today       date := (now() at time zone 'utc')::date;
  n           integer;
  last_prune  date;
begin
  update public.pulse_state s
     set hits = case when s.minute = this_minute then least(s.hits + 1, 1000000) else 1 end,
         minute = this_minute
   where s.id = 1
  returning s.hits, s.pruned_on into n, last_prune;

  if n is null or n > 600 then
    return false; -- the state row is missing, or this minute is full
  end if;

  if last_prune < today then
    perform public.pulse_prune();
    update public.pulse_state set pruned_on = today where id = 1;
  end if;
  return true;
end;
$$;

-- ---- counting ---------------------------------------------------------------
-- One page view. Returns true when it was counted. A value that is not a clean
-- path or a known class is not counted at all.
create or replace function public.pulse_hit(p_path text, p_ref text default 'none')
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
  pth   text := p_path;
  ref   text := coalesce(p_ref, 'none');
begin
  if pth is null or not (pth = '(other)' or (pth ~ '^/[a-z0-9/_.-]*$' and char_length(pth) <= 120)) then
    return false;
  end if;
  if ref not in ('none', 'internal', 'search', 'other') then
    return false;
  end if;
  if not public.pulse_gate() then
    return false;
  end if;

  -- the day's list of paths is bounded: a path not seen today, once the list is full, is counted as '(other)'
  if pth <> '(other)'
     and not exists (select 1 from public.pulse_pages p where p.day = today and p.path = pth)
     and (select count(distinct p.path) from public.pulse_pages p where p.day = today) >= 1500 then
    pth := '(other)';
  end if;

  insert into public.pulse_pages as t (day, path, ref_class, views)
  values (today, pth, ref, 1)
  on conflict (day, path, ref_class) do update set views = t.views + 1;
  return true;
end;
$$;

-- One accepted form. Called by the website's API at the moment a submission is stored.
create or replace function public.pulse_form_hit(p_form text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
begin
  if p_form is null or p_form not in ('contact', 'interest', 'support', 'newsletter') then
    return false;
  end if;
  if not public.pulse_gate() then
    return false;
  end if;
  insert into public.pulse_forms as t (day, form, count)
  values (today, p_form, 1)
  on conflict (day, form) do update set count = t.count + 1;
  return true;
end;
$$;

-- One site search. p_term is one of the site's own terms, or null / '' when the
-- query was not one (nothing of what was typed is passed, so nothing is stored).
create or replace function public.pulse_search_hit(p_term text default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
  trm   text := coalesce(nullif(p_term, ''), '(unmatched)');
begin
  if not (trm = '(unmatched)' or (trm ~ '^[a-z0-9][a-z0-9 .]*$' and char_length(trm) <= 48)) then
    return false;
  end if;
  if not public.pulse_gate() then
    return false;
  end if;

  if trm <> '(unmatched)'
     and not exists (select 1 from public.pulse_search s where s.day = today and s.term = trm)
     and (select count(*) from public.pulse_search s where s.day = today) >= 1000 then
    trm := '(other)';
  end if;

  insert into public.pulse_search as t (day, term, count)
  values (today, trm, 1)
  on conflict (day, term) do update set count = t.count + 1;
  return true;
end;
$$;

-- ---- reading ----------------------------------------------------------------
-- The counts over the last p_days UTC days, today included (1 to 365).
-- `form_pages` lists the views of the pages that hold a form, so that the
-- console can divide one by the other; the paths must equal PULSE_FORM_PAGE in
-- src/lib/pulse.ts.
create or replace function public.pulse_summary(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d         integer := least(greatest(coalesce(p_days, 30), 1), 365);
  until_day date := (now() at time zone 'utc')::date;
  since_day date := (now() at time zone 'utc')::date - (least(greatest(coalesce(p_days, 30), 1), 365) - 1);
begin
  if not (select public.staff_can('analytics.read')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'days', d,
    'since', since_day,
    'until', until_day,
    -- the first day anything was counted at all, so the console can say when counting began
    'first_day', (
      select min(x.day) from (
        select min(p.day) as day from public.pulse_pages p
        union all select min(f.day) from public.pulse_forms f
        union all select min(s.day) from public.pulse_search s
      ) x),
    'views', jsonb_build_object(
      'total', coalesce((select sum(p.views) from public.pulse_pages p where p.day >= since_day), 0),
      'paths', (select count(distinct p.path) from public.pulse_pages p where p.day >= since_day and p.path <> '(other)'),
      'by_day', coalesce((
        select jsonb_agg(jsonb_build_object('day', g.day, 'count', coalesce(v.n, 0)) order by g.day)
        from (select generate_series(since_day::timestamp, until_day::timestamp, interval '1 day')::date as day) g
        left join (select p.day, sum(p.views) as n from public.pulse_pages p where p.day >= since_day group by p.day) v on v.day = g.day), '[]'::jsonb),
      'by_path', coalesce((select jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.n desc, x.k)
        from (select p.path as k, sum(p.views) as n from public.pulse_pages p where p.day >= since_day group by p.path order by 2 desc, 1 limit 25) x), '[]'::jsonb),
      'by_ref', coalesce((select jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.n desc, x.k)
        from (select p.ref_class as k, sum(p.views) as n from public.pulse_pages p where p.day >= since_day group by p.ref_class) x), '[]'::jsonb),
      'form_pages', coalesce((select jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.k)
        from (select p.path as k, sum(p.views) as n from public.pulse_pages p
              where p.day >= since_day and p.path in ('/contact', '/open-account', '/support') group by p.path) x), '[]'::jsonb)
    ),
    'forms', coalesce((select jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.k)
      from (select f.form as k, sum(f.count) as n from public.pulse_forms f where f.day >= since_day group by f.form) x), '[]'::jsonb),
    'search', jsonb_build_object(
      'total', coalesce((select sum(s.count) from public.pulse_search s where s.day >= since_day), 0),
      'unmatched', coalesce((select sum(s.count) from public.pulse_search s where s.day >= since_day and s.term = '(unmatched)'), 0),
      'other', coalesce((select sum(s.count) from public.pulse_search s where s.day >= since_day and s.term = '(other)'), 0),
      'by_term', coalesce((select jsonb_agg(jsonb_build_object('key', x.k, 'count', x.n) order by x.n desc, x.k)
        from (select s.term as k, sum(s.count) as n from public.pulse_search s
              where s.day >= since_day and s.term not in ('(unmatched)', '(other)') group by s.term order by 2 desc, 1 limit 25) x), '[]'::jsonb)
    )
  );
end;
$$;

-- ---- who may call what ------------------------------------------------------
revoke all on function public.pulse_prune() from public, anon, authenticated;
revoke all on function public.pulse_gate() from public, anon, authenticated;
revoke all on function public.pulse_hit(text, text) from public;
revoke all on function public.pulse_form_hit(text) from public;
revoke all on function public.pulse_search_hit(text) from public;
revoke all on function public.pulse_summary(integer) from public, anon;

grant execute on function public.pulse_hit(text, text) to anon, authenticated;
grant execute on function public.pulse_form_hit(text) to anon, authenticated;
grant execute on function public.pulse_search_hit(text) to anon, authenticated;
grant execute on function public.pulse_summary(integer) to authenticated;

-- 0029_reader_riddles.sql
--
-- Readers' riddles: a visitor may send a two-line riddle whose answer is a
-- glossary term. Nothing a visitor sends is shown until a member of staff has
-- read it and approved it in GIO4X Control.
--
--   anon            may insert a riddle, always as 'pending'; may read approved ones
--   content.read    staff see every riddle, pending and rejected included
--   content.publish staff approve or reject; only the status can be changed
--
-- What is kept: the two lines, the answer's glossary slug, and optional
-- initials (up to 24 characters). No e-mail address, no IP address, no
-- identifier. A line may not contain a web address or a control character.
-- At most 300 riddles may wait unread at once, so the table cannot be flooded.
--
-- ROLLBACK
--   drop table if exists public.reader_riddles;
--   drop function if exists public.tg_reader_riddles_insert();
--   drop function if exists public.tg_reader_riddles_decide();

create table if not exists public.reader_riddles (
  id          uuid primary key default gen_random_uuid(),
  line_a      text not null,
  line_b      text not null,
  answer_slug text not null,
  byline      text not null default '',
  status      text not null default 'pending',
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid,
  constraint reader_riddles_line_a_valid check (char_length(line_a) between 8 and 120 and line_a !~ '[\x00-\x1f]' and line_a !~* '(https?:|www\.|<|>)'),
  constraint reader_riddles_line_b_valid check (char_length(line_b) between 8 and 120 and line_b !~ '[\x00-\x1f]' and line_b !~* '(https?:|www\.|<|>)'),
  constraint reader_riddles_slug_valid check (answer_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(answer_slug) <= 60),
  constraint reader_riddles_byline_valid check (char_length(byline) <= 24 and byline !~ '[\x00-\x1f]' and byline !~* '(https?:|www\.|@|<|>)'),
  constraint reader_riddles_status_valid check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists reader_riddles_status_idx on public.reader_riddles (status, created_at desc);

alter table public.reader_riddles enable row level security;

revoke all on public.reader_riddles from anon, authenticated;
grant insert (line_a, line_b, answer_slug, byline) on public.reader_riddles to anon, authenticated;
grant select on public.reader_riddles to anon, authenticated;
grant update (status) on public.reader_riddles to authenticated;

drop policy if exists reader_riddles_public_insert on public.reader_riddles;
create policy reader_riddles_public_insert on public.reader_riddles
  for insert
  to anon, authenticated
  with check (status = 'pending' and decided_at is null and decided_by is null);

drop policy if exists reader_riddles_public_select on public.reader_riddles;
create policy reader_riddles_public_select on public.reader_riddles
  for select
  to anon
  using (status = 'approved');

drop policy if exists reader_riddles_signed_in_select on public.reader_riddles;
create policy reader_riddles_signed_in_select on public.reader_riddles
  for select
  to authenticated
  using (status = 'approved' or (select public.staff_can('content.read')));

drop policy if exists reader_riddles_staff_update on public.reader_riddles;
create policy reader_riddles_staff_update on public.reader_riddles
  for update
  to authenticated
  using ((select public.staff_can('content.publish')))
  with check ((select public.staff_can('content.publish')));

-- A new riddle always starts pending, whatever was sent; and no more than 300 may wait at once.
create or replace function public.tg_reader_riddles_insert() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.status := 'pending';
  new.decided_at := null;
  new.decided_by := null;
  new.created_at := now();
  if (select count(*) from public.reader_riddles r where r.status = 'pending') >= 300 then
    raise exception 'too many riddles are waiting to be read' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.tg_reader_riddles_insert() from public, anon, authenticated;
drop trigger if exists reader_riddles_insert on public.reader_riddles;
create trigger reader_riddles_insert before insert on public.reader_riddles
  for each row execute function public.tg_reader_riddles_insert();

-- A decision records who made it and when; the words of a riddle are never changed.
create or replace function public.tg_reader_riddles_decide() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.line_a is distinct from old.line_a or new.line_b is distinct from old.line_b or new.answer_slug is distinct from old.answer_slug or new.byline is distinct from old.byline then
    raise exception 'a riddle''s words cannot be changed' using errcode = '23514';
  end if;
  if new.status is distinct from old.status then
    new.decided_at := now();
    new.decided_by := (select auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.tg_reader_riddles_decide() from public, anon, authenticated;
drop trigger if exists reader_riddles_decide on public.reader_riddles;
create trigger reader_riddles_decide before update on public.reader_riddles
  for each row execute function public.tg_reader_riddles_decide();

-- Self-test: what the anonymous role may and may not do. Everything it writes is rolled back.
do $selftest$
declare
  v_id uuid;
  v_n integer;
begin
  begin
    set local role anon;
    insert into public.reader_riddles (line_a, line_b, answer_slug, byline)
      values ('A test line that is long enough,', 'and a second to make it rhyme.', 'pip', 'T.T.');
    -- a pending riddle is not readable by the public
    select count(*) into v_n from public.reader_riddles where answer_slug = 'pip' and byline = 'T.T.';
    if v_n <> 0 then raise exception 'SELFTEST: a pending riddle is visible to anon'; end if;
    begin
      insert into public.reader_riddles (line_a, line_b, answer_slug) values ('See https://example.com for more', 'and a second line of the riddle', 'pip');
      raise exception 'SELFTEST: a web address was accepted';
    exception when check_violation then null;
    end;
    reset role;
    select id into v_id from public.reader_riddles where byline = 'T.T.' limit 1;
    if v_id is null then raise exception 'SELFTEST: the riddle was not stored'; end if;
    if (select status from public.reader_riddles where id = v_id) <> 'pending' then raise exception 'SELFTEST: not pending'; end if;
    raise exception 'SELFTEST_DONE';
  exception when others then
    reset role;
    if sqlerrm <> 'SELFTEST_DONE' then raise; end if;
  end;
end;
$selftest$;

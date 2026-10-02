-- =============================================================================
-- GIO4X · 0016_faq · the website's FAQ, edited in the console
-- =============================================================================
-- The FAQ's questions stay in the code (src/data/faqs.ts): that list is the
-- base, and the public page shows it exactly as written whenever this table is
-- empty or cannot be read. This table holds what staff changed on top of it:
--
-- faq_entries   one row per change.
--                 base_id set   the row is about a question in the code:
--                               'published'  its text replaces the code's
--                               'hidden'     the question is left off the page
--                               'draft'      nothing changes on the website
--                 base_id null  the row is a new question:
--                               'published'  shown in its category, ordered
--                                            by `position`
--                               'draft'      not shown
--               A question in the code has at most one row. Nothing is ever
--               deleted: "restore the original" sets the row back to 'draft'.
--
-- Who may do what:
--   content.read      see every row, drafts included, in the console
--   content.write     create a draft and edit a draft
--   content.publish   publish, hide, take off the website, and edit a row that
--                     is published or hidden (so that what the public sees is
--                     never changed by a writer alone)
--
-- A visitor reads only rows that are 'published' or 'hidden' (the page has to
-- know what to leave out), and only the columns the page needs: nothing about
-- who edited or when.
--
-- Every creation, publication, hiding, withdrawal and change to a published
-- row is written to the audit log by a trigger.
--
-- Re-runnable and additive: it creates its own table, functions, policies and
-- capability rows, and touches nothing that exists.
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
  ('admin', 'content.read'), ('compliance', 'content.read'), ('agent', 'content.read'), ('sales', 'content.read'),
  ('support', 'content.read'),
  ('admin', 'content.write'), ('agent', 'content.write'),
  ('admin', 'content.publish')
on conflict do nothing;

create table if not exists public.faq_entries (
  id         uuid primary key default gen_random_uuid(),
  -- the id of the question in src/data/faqs.ts this row replaces or hides; null for a new question
  base_id    text,
  category   text not null,
  question   text not null,
  -- restricted Markdown, rendered by src/components/blog/BlogBody.tsx (never inserted as HTML)
  answer     text not null,
  -- the place of a NEW question within its category. The code's questions stand at 10, 20, 30...
  -- in each category, so 25 puts a new question between the second and the third. A row with a
  -- base_id keeps the place of the question it replaces and this number is not used.
  position   integer not null default 1000,
  status     text not null default 'draft',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint faq_entries_base_id_valid check (base_id is null or (base_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(base_id) between 1 and 96)),
  -- the category keys of src/data/generated/faqs.json (FAQ_CATEGORY_KEYS in src/lib/faq.ts)
  constraint faq_entries_category_valid check (
    category in ('getting-started', 'accounts', 'trading-basics', 'margin-leverage', 'orders', 'platforms', 'funding', 'security', 'partners')
  ),
  constraint faq_entries_question_valid check (char_length(question) between 10 and 200 and question !~ '[\x00-\x1f]'),
  constraint faq_entries_answer_valid check (char_length(answer) between 10 and 4000),
  constraint faq_entries_position_valid check (position between 0 and 9999),
  constraint faq_entries_status_valid check (status in ('draft', 'published', 'hidden')),
  -- only a question that exists in the code can be hidden; a new question is taken off the page by making it a draft
  constraint faq_entries_hidden_has_base check (status <> 'hidden' or base_id is not null)
);
comment on table public.faq_entries is 'Changes to the website FAQ made in the console: replacements for, and additions to, the questions in the code. Public when status is published or hidden.';

alter table public.faq_entries enable row level security;
alter table public.faq_entries force row level security;
revoke all on table public.faq_entries from public, anon, authenticated;

-- a question in the code has at most one row
create unique index if not exists faq_entries_base_id_key on public.faq_entries (base_id) where base_id is not null;
create index if not exists faq_entries_public_idx on public.faq_entries (category, position) where status in ('published', 'hidden');

-- A visitor reads what the page shows or leaves out, and nothing about who edited the row or when.
grant select (id, base_id, category, question, answer, position, status) on public.faq_entries to anon;
grant select on public.faq_entries to authenticated;
-- base_id is given once, when the row is made; no API role may delete a row
grant insert (base_id, category, question, answer, position, status) on public.faq_entries to authenticated;
grant update (category, question, answer, position, status) on public.faq_entries to authenticated;

-- (A visitor's policy must not call a staff function: the anonymous role may not execute it.)
drop policy if exists faq_entries_public_select on public.faq_entries;
create policy faq_entries_public_select on public.faq_entries
  for select
  to anon
  using (status in ('published', 'hidden'));

drop policy if exists faq_entries_signed_in_select on public.faq_entries;
create policy faq_entries_signed_in_select on public.faq_entries
  for select
  to authenticated
  using (status in ('published', 'hidden') or (select public.staff_can('content.read')));

drop policy if exists faq_entries_staff_insert on public.faq_entries;
create policy faq_entries_staff_insert on public.faq_entries
  for insert
  to authenticated
  with check ((select public.staff_can('content.write')) or (select public.staff_can('content.publish')));

drop policy if exists faq_entries_staff_update on public.faq_entries;
create policy faq_entries_staff_update on public.faq_entries
  for update
  to authenticated
  using ((select public.staff_can('content.write')) or (select public.staff_can('content.publish')))
  with check ((select public.staff_can('content.write')) or (select public.staff_can('content.publish')));

-- Who wrote and when is set here, never by the caller; and the rule that only
-- content.publish may change what the public sees: put a row in front of the
-- public (published or hidden), change it once it is there, or take it away.
create or replace function public.faq_entries_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  api boolean := coalesce((select auth.role()), '') in ('anon', 'authenticated');
  was_public boolean := tg_op = 'UPDATE' and old.status in ('published', 'hidden');
  now_public boolean := new.status in ('published', 'hidden');
begin
  if tg_op = 'INSERT' then
    if api then
      new.created_at := now();
      new.created_by := (select auth.uid());
    end if;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  if api then
    new.updated_by := (select auth.uid());
    if (was_public or now_public) and not (select public.staff_can('content.publish')) then
      raise exception 'changing what the website shows needs content.publish' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.faq_entries_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  act text;
begin
  if tg_op = 'INSERT' then
    act := case new.status when 'published' then 'faq.publish' when 'hidden' then 'faq.hide' else 'faq.create' end;
  elsif new.status is distinct from old.status then
    -- to 'draft' from published or hidden: off the website (for a question in the code, the original is back)
    act := case new.status when 'published' then 'faq.publish' when 'hidden' then 'faq.hide' else 'faq.unpublish' end;
  elsif old.status = 'published' then
    act := 'faq.edit_published';
  else
    return null; -- ordinary drafting is not an audited event
  end if;
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values ((select auth.uid()), act, 'faq_entry', new.id::text,
          jsonb_build_object('base_id', new.base_id, 'category', new.category, 'status', new.status));
  return null;
end;
$$;

drop trigger if exists faq_entries_before_write on public.faq_entries;
create trigger faq_entries_before_write
  before insert or update on public.faq_entries
  for each row execute function public.faq_entries_before_write();

drop trigger if exists faq_entries_after_write on public.faq_entries;
create trigger faq_entries_after_write
  after insert or update on public.faq_entries
  for each row execute function public.faq_entries_after_write();

revoke all on function public.faq_entries_before_write() from public, anon, authenticated;
revoke all on function public.faq_entries_after_write() from public, anon, authenticated;

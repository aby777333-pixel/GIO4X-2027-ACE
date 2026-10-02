-- =============================================================================
-- GIO4X · 0020_blog_revisions · what a post's words were, each time they changed
-- =============================================================================
-- blog_revisions   one row per saved change to the words of a post in
--                  `blog_posts` (0011): its title, excerpt, body, SEO title and
--                  meta description AS THEY WERE AFTER the change, who saved
--                  them, when, where the post stood at that moment, and which
--                  of the five fields differed from the revision before.
--
-- How a row gets here: only through the trigger `blog_posts_keep_revision` on
-- `blog_posts`. A new post writes revision 1. An update writes the next
-- revision when at least one of the five fields changed, and nothing when the
-- change was to something else (the status, the publication time, the category,
-- the cover, a correction note).
--
-- How many are kept: the latest 50 per post. Older ones are deleted by the
-- same trigger, with one exception that is never deleted: the revision that
-- was current each time the post became 'published' (`at_publication`), so the
-- words that were put in front of the public can always be read again. A post
-- scheduled for later counts: its status becomes 'published' when it is
-- scheduled.
--
-- The trigger never fails a save. Everything it does sits inside an exception
-- block: if a revision cannot be written, the post is saved all the same and a
-- warning (the SQLSTATE only, no text of the post) goes to the database log.
--
-- Who may do what:
--   blog.read   read the revisions of every post, in the console
--   nobody      insert, change or delete a revision through the API: the API
--               roles hold no such privilege, and there is no policy for it
--   anon        nothing at all
--
-- Posts that existed before this migration get revision 1 here: the text as it
-- stands today, dated the post's last change.
--
-- Re-runnable and additive: it creates its own table, function, trigger and
-- policy, and changes nothing that exists. No new capability.
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

create table if not exists public.blog_revisions (
  id              bigint generated always as identity primary key,
  post_id         uuid not null references public.blog_posts (id) on delete cascade,
  -- 1, 2, 3... within the post; never reused, so numbers stay meaningful after old revisions are deleted
  revision        integer not null,
  saved_at        timestamptz not null default now(),
  -- null: the change was made in SQL, not through the console
  saved_by        uuid,
  title           text not null,
  excerpt         text not null,
  body            text not null,
  seo_title       text not null,
  seo_description text not null,
  -- where the post stood when these words were saved
  status          text not null,
  -- which of the five fields differ from the revision before; empty for the first revision of a post
  changed         text[] not null default '{}',
  -- true: these were the post's words at a moment it became 'published'. Such a row is never deleted by the cap.
  at_publication  boolean not null default false,
  constraint blog_revisions_post_revision_key unique (post_id, revision),
  constraint blog_revisions_revision_valid check (revision >= 1),
  constraint blog_revisions_status_valid check (status in ('draft', 'review', 'published', 'archived')),
  constraint blog_revisions_changed_valid check (changed <@ array['title', 'excerpt', 'body', 'seo_title', 'seo_description']::text[])
);
comment on table public.blog_revisions is 'The words of each blog post after every saved change to them. Written only by a trigger on blog_posts; the latest 50 per post, plus the revision current at each publication.';

alter table public.blog_revisions enable row level security;
alter table public.blog_revisions force row level security;
revoke all on table public.blog_revisions from public, anon, authenticated;

-- Read only, and only for staff who may read the blog. No insert, update or delete for any API role.
grant select on public.blog_revisions to authenticated;

drop policy if exists blog_revisions_staff_select on public.blog_revisions;
create policy blog_revisions_staff_select on public.blog_revisions
  for select
  to authenticated
  using ((select public.staff_can('blog.read')));

-- Writes the revision, marks the one current at a publication, and trims to
-- the cap. AFTER the row is written, so it sees what was actually stored (the
-- before-trigger of 0011 has already had its say). It returns null and never
-- raises: a post is saved whether or not its revision could be.
create or replace function public.blog_posts_keep_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  keep constant integer := 50;
  what text[] := '{}';
  wrote boolean := false;
  published_now boolean := new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published');
  latest integer;
begin
  begin
    if tg_op = 'INSERT' then
      wrote := true;
    else
      if new.title is distinct from old.title then what := array_append(what, 'title'); end if;
      if new.excerpt is distinct from old.excerpt then what := array_append(what, 'excerpt'); end if;
      if new.body is distinct from old.body then what := array_append(what, 'body'); end if;
      if new.seo_title is distinct from old.seo_title then what := array_append(what, 'seo_title'); end if;
      if new.seo_description is distinct from old.seo_description then what := array_append(what, 'seo_description'); end if;
      wrote := cardinality(what) > 0;
    end if;

    if not wrote and not published_now then
      return null; -- a change to something other than the words: nothing to record
    end if;

    -- the row lock on the post makes two saves of the same post take turns, so the next number is safe to read
    select max(r.revision) into latest from public.blog_revisions r where r.post_id = new.id;

    if wrote or latest is null then
      -- (latest is null without a change of words: a post with no revision yet is being published; its words are recorded now)
      latest := coalesce(latest, 0) + 1;
      insert into public.blog_revisions
        (post_id, revision, saved_by, title, excerpt, body, seo_title, seo_description, status, changed, at_publication)
      values
        (new.id, latest, (select auth.uid()), new.title, new.excerpt, new.body, new.seo_title, new.seo_description, new.status, what, published_now);
      delete from public.blog_revisions r
        where r.post_id = new.id and r.revision <= latest - keep and not r.at_publication;
    else
      -- published as it stands: the latest revision is what went in front of the public
      update public.blog_revisions r set at_publication = true
        where r.post_id = new.id and r.revision = latest and not r.at_publication;
    end if;
  exception when others then
    raise warning 'blog_posts_keep_revision: a revision was not recorded (SQLSTATE %)', sqlstate;
  end;
  return null;
end;
$$;

drop trigger if exists blog_posts_keep_revision on public.blog_posts;
create trigger blog_posts_keep_revision
  after insert or update on public.blog_posts
  for each row execute function public.blog_posts_keep_revision();

revoke all on function public.blog_posts_keep_revision() from public, anon, authenticated;

-- Posts written before this migration: their words as they stand, as revision 1.
-- (Only posts that have no revision at all, so running this again adds nothing.)
insert into public.blog_revisions
  (post_id, revision, saved_at, saved_by, title, excerpt, body, seo_title, seo_description, status, at_publication)
select p.id, 1, p.updated_at, p.updated_by, p.title, p.excerpt, p.body, p.seo_title, p.seo_description, p.status, p.status = 'published'
from public.blog_posts p
where not exists (select 1 from public.blog_revisions r where r.post_id = p.id);

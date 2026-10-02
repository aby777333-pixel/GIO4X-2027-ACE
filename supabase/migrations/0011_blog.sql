-- =============================================================================
-- GIO4X · 0011_blog · the daily blog, written in the console
-- =============================================================================
-- blog_posts   one row per post. Staff write drafts in GIO4X Control; a post
--              is public only when its status is 'published' AND its
--              publication time has passed, so a post can be scheduled by
--              publishing it with a time in the future.
--
-- Who may do what:
--   blog.read      see drafts and every post in the console
--   blog.write     create a draft and edit anything that is not published
--   blog.publish   publish, unpublish, archive, and edit a published post
--                  (so that published words cannot be changed by a writer
--                  alone)
--
-- Images live in the public storage bucket `blog`. Anyone can read a file
-- there (they are on public pages); only staff holding blog.write can add or
-- replace one.
--
-- Every creation, publication, withdrawal and change to a published post is
-- written to the audit log by a trigger.
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
  ('admin', 'blog.read'), ('compliance', 'blog.read'), ('agent', 'blog.read'), ('sales', 'blog.read'),
  ('support', 'blog.read'), ('viewer', 'blog.read'),
  ('admin', 'blog.write'), ('agent', 'blog.write'), ('sales', 'blog.write'),
  ('admin', 'blog.publish')
on conflict do nothing;

create table if not exists public.blog_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  excerpt         text not null default '',
  body            text not null default '',
  category        text not null default 'market-notes',
  tags            text[] not null default '{}',
  byline          text not null default 'GIO4X Editorial Desk',
  status          text not null default 'draft',
  published_at    timestamptz,
  -- a material change after publication: the date, and what changed (shown on the post)
  corrected_at    timestamptz,
  correction_note text not null default '',
  -- search and sharing
  seo_title       text not null default '',
  seo_description text not null default '',
  canonical_url   text not null default '',
  noindex         boolean not null default false,
  og_image_path   text not null default '',
  -- the cover picture: a path inside the `blog` bucket, and what a reader needs to know about it
  cover_path      text not null default '',
  cover_alt       text not null default '',
  cover_caption   text not null default '',
  cover_credit    text not null default '',
  cover_width     integer,
  cover_height    integer,
  created_by      uuid,
  updated_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint blog_posts_slug_valid check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 96),
  constraint blog_posts_title_valid check (char_length(title) between 3 and 140 and title !~ '[\x00-\x1f]'),
  constraint blog_posts_excerpt_valid check (char_length(excerpt) <= 320),
  constraint blog_posts_body_valid check (char_length(body) <= 60000),
  constraint blog_posts_category_valid check (category in ('market-notes', 'education', 'platform', 'company')),
  constraint blog_posts_tags_valid check (coalesce(array_length(tags, 1), 0) <= 8),
  constraint blog_posts_byline_valid check (char_length(byline) between 2 and 80 and byline !~ '[\x00-\x1f]'),
  constraint blog_posts_status_valid check (status in ('draft', 'review', 'published', 'archived')),
  constraint blog_posts_published_evidence check (status <> 'published' or published_at is not null),
  constraint blog_posts_correction_valid check (char_length(correction_note) <= 500),
  constraint blog_posts_seo_title_valid check (char_length(seo_title) <= 70),
  constraint blog_posts_seo_description_valid check (char_length(seo_description) <= 170),
  constraint blog_posts_canonical_valid check (canonical_url = '' or (canonical_url ~ '^(https://|/)' and char_length(canonical_url) <= 300)),
  constraint blog_posts_og_path_valid check (og_image_path = '' or (og_image_path ~ '^[a-z0-9][a-z0-9/_.-]*$' and char_length(og_image_path) <= 200)),
  constraint blog_posts_cover_path_valid check (cover_path = '' or (cover_path ~ '^[a-z0-9][a-z0-9/_.-]*$' and char_length(cover_path) <= 200)),
  -- a picture without a description is not published: alt text is required once there is a cover
  constraint blog_posts_cover_alt_valid check (char_length(cover_alt) <= 200 and (cover_path = '' or status <> 'published' or char_length(cover_alt) >= 3)),
  constraint blog_posts_cover_caption_valid check (char_length(cover_caption) <= 300),
  constraint blog_posts_cover_credit_valid check (char_length(cover_credit) <= 120),
  constraint blog_posts_cover_size_valid check (
    (cover_width is null or cover_width between 1 and 10000) and (cover_height is null or cover_height between 1 and 10000)
  )
);
comment on table public.blog_posts is 'The daily blog. Public when status is published and published_at has passed.';

alter table public.blog_posts enable row level security;
alter table public.blog_posts force row level security;
revoke all on table public.blog_posts from public, anon, authenticated;

create index if not exists blog_posts_public_idx on public.blog_posts (published_at desc) where status = 'published';
create index if not exists blog_posts_updated_idx on public.blog_posts (updated_at desc);

-- A visitor reads what is on the page and nothing about who wrote the row.
grant select (
  id, slug, title, excerpt, body, category, tags, byline, status, published_at, corrected_at, correction_note,
  seo_title, seo_description, canonical_url, noindex, og_image_path,
  cover_path, cover_alt, cover_caption, cover_credit, cover_width, cover_height, updated_at
) on public.blog_posts to anon;
grant select on public.blog_posts to authenticated;
grant insert (
  slug, title, excerpt, body, category, tags, byline, status, published_at,
  seo_title, seo_description, canonical_url, noindex, og_image_path,
  cover_path, cover_alt, cover_caption, cover_credit, cover_width, cover_height
) on public.blog_posts to authenticated;
grant update (
  slug, title, excerpt, body, category, tags, byline, status, published_at, corrected_at, correction_note,
  seo_title, seo_description, canonical_url, noindex, og_image_path,
  cover_path, cover_alt, cover_caption, cover_credit, cover_width, cover_height
) on public.blog_posts to authenticated;

-- (A visitor's policy must not call a staff function: the anonymous role may not execute it.)
drop policy if exists blog_posts_public_select on public.blog_posts;
create policy blog_posts_public_select on public.blog_posts
  for select
  to anon
  using (status = 'published' and published_at <= now());

drop policy if exists blog_posts_signed_in_select on public.blog_posts;
create policy blog_posts_signed_in_select on public.blog_posts
  for select
  to authenticated
  using ((status = 'published' and published_at <= now()) or (select public.staff_can('blog.read')));

drop policy if exists blog_posts_staff_insert on public.blog_posts;
create policy blog_posts_staff_insert on public.blog_posts
  for insert
  to authenticated
  with check ((select public.staff_can('blog.write')));

drop policy if exists blog_posts_staff_update on public.blog_posts;
create policy blog_posts_staff_update on public.blog_posts
  for update
  to authenticated
  using ((select public.staff_can('blog.write')) or (select public.staff_can('blog.publish')))
  with check ((select public.staff_can('blog.write')) or (select public.staff_can('blog.publish')));

-- Who wrote and when is set here, never by the caller; and the rule that only
-- blog.publish may put words in front of the public, change them once they are
-- there, or take them away.
create or replace function public.blog_posts_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  api boolean := coalesce((select auth.role()), '') in ('anon', 'authenticated');
  was_public boolean := tg_op = 'UPDATE' and old.status = 'published';
  now_public boolean := new.status = 'published';
begin
  if tg_op = 'INSERT' then
    if api then
      new.created_at := now();
      new.created_by := (select auth.uid());
      new.corrected_at := null;
      new.correction_note := '';
    end if;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  if api then
    new.updated_by := (select auth.uid());
    if (was_public or now_public or new.status = 'archived' or (tg_op = 'UPDATE' and old.status = 'archived'))
       and not (select public.staff_can('blog.publish')) then
      raise exception 'publishing needs blog.publish' using errcode = '42501';
    end if;
  end if;
  if now_public and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.blog_posts_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  act text;
begin
  if tg_op = 'INSERT' then
    act := case when new.status = 'published' then 'blog.publish' else 'blog.create' end;
  elsif new.status is distinct from old.status then
    act := case
      when new.status = 'published' then 'blog.publish'
      when old.status = 'published' then 'blog.unpublish'
      when new.status = 'archived' then 'blog.archive'
      else 'blog.status'
    end;
  elsif old.status = 'published' then
    act := 'blog.edit_published';
  else
    return null; -- ordinary drafting is not an audited event
  end if;
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values ((select auth.uid()), act, 'blog_post', new.id::text,
          jsonb_build_object('slug', new.slug, 'status', new.status, 'published_at', new.published_at));
  return null;
end;
$$;

drop trigger if exists blog_posts_before_write on public.blog_posts;
create trigger blog_posts_before_write
  before insert or update on public.blog_posts
  for each row execute function public.blog_posts_before_write();

drop trigger if exists blog_posts_after_write on public.blog_posts;
create trigger blog_posts_after_write
  after insert or update on public.blog_posts
  for each row execute function public.blog_posts_after_write();

revoke all on function public.blog_posts_before_write() from public, anon, authenticated;
revoke all on function public.blog_posts_after_write() from public, anon, authenticated;

-- ---- pictures ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog', 'blog', true, 4194304, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists blog_images_staff_insert on storage.objects;
create policy blog_images_staff_insert on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'blog' and (select public.staff_can('blog.write')));

drop policy if exists blog_images_staff_update on storage.objects;
create policy blog_images_staff_update on storage.objects
  for update
  to authenticated
  using (bucket_id = 'blog' and (select public.staff_can('blog.write')))
  with check (bucket_id = 'blog' and (select public.staff_can('blog.write')));

-- the console lists what has been uploaded; the public reads files by their address, which a public bucket serves without a policy
drop policy if exists blog_images_staff_select on storage.objects;
create policy blog_images_staff_select on storage.objects
  for select
  to authenticated
  using (bucket_id = 'blog' and (select public.staff_can('blog.read')));

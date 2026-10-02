-- =============================================================================
-- GIO4X · 0019_timeline · one person's history on one line, and notes between staff
-- -----------------------------------------------------------------------------
-- Apply after 0013 (it reads tables and audit entries from 0001 to 0013).
-- Re-runnable. Purely additive: one capability, one table, two trigger
-- functions, four callable functions. No existing column, policy or function
-- is changed.
--
-- A "customer" here is what 0009 says it is: everyone who has written in, one
-- record per e-mail address, addressed by `person_key` (a hash of the address)
-- so that no address appears in a URL. There are still no client accounts.
--
--   person_timeline(key, limit, before, kinds)
--        One stream of EVENTS for that person, newest first, paged by time.
--        Nothing is stored for it: every event is read from the row that
--        already records it. Needs customers.read; and each kind of event is
--        returned ONLY to a caller holding the capability that shows it on its
--        own screen, exactly as person_view() does since 0010:
--
--          enquiry_received / enquiry_entered           leads.read
--          enquiry_note                                 leads.read
--          followup_created / followup_completed        leads.read
--          enquiry_status / enquiry_stage               leads.read AND audit.read
--          ticket_opened                                tickets.read
--          ticket_customer_message / ticket_staff_reply tickets.read
--          ticket_internal_note                         tickets.read
--          ticket_status / ticket_escalated             tickets.read AND audit.read
--          newsletter_joined / newsletter_left          customers.read
--          person_note                                  customers.read
--
--        (Status, stage and escalation events are entries of the audit log,
--        which the enquiry and ticket screens show only to audit.read. The
--        newsletter state is part of what customers.read already is: 0009.)
--
--        Live chats are NOT in the timeline, on purpose. A chat conversation
--        (0008) records a visitor's name and no e-mail address, and nothing
--        else in the database ties a conversation to an address. Matching by
--        name would be a guess about who somebody is, so it is not done.
--
--        Paging: `p_before` returns events strictly older than that time.
--        Events that share one instant (a reply and the status change it
--        caused are written in one transaction) are never split across two
--        pages: a page may therefore be a little longer than `p_limit`.
--        `has_older` on every row says whether anything older remains.
--        `p_kinds` (optional) limits the stream to those kinds.
--
--        Message and note text is returned as ONE LINE of at most 160
--        characters. The full text lives on the ticket or enquiry screen.
--
--   person_notes      Internal notes about a person, keyed by `person_key`,
--        never by address. Read with customers.read; written with the new
--        capability customers.note (admin, agent, sales, support). Append-only
--        through the API: there is no UPDATE and no DELETE privilege, so a
--        correction is a new note. (The owner can still remove a row in SQL,
--        which is how a request for erasure is honoured.) Every note writes an
--        audit entry `person.note`; the text is never copied there.
--
--        A note may MENTION colleagues. The console sends the ids it resolved
--        from the "@Display Name" it found in the text; the database does not
--        trust them. It keeps only ids that are active members of staff, can
--        open a customer record (customers.read), are not the author, and
--        whose "@Display Name" really is in the text.
--
--   staff_mentionable()   who can be mentioned: active staff holding
--        customers.read, without the caller. For holders of customers.note.
--        (staff_directory() also lists people who have been switched off,
--        because their names are on old records; it cannot serve here.)
--
--   my_mentions(limit)    the caller's own recent mentions: note id, person
--        key, author name, time. No note text. Only ever the caller's.
--
-- New capability: customers.note (admin, agent, sales, support).
-- New audit action: person.note (entity `person`, entity_id the person key).
--
-- At the end of this file, commented out: the trigger that turns a mention into
-- a row of staff_notifications once 0018 is applied.
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
  ('admin', 'customers.note'), ('agent', 'customers.note'), ('sales', 'customers.note'), ('support', 'customers.note')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- person_notes
-- `author` is not a foreign key to staff on purpose (as lead_notes): a note
-- outlives the removal of the person who wrote it. `author` and `created_at`
-- are never supplied by a caller.
-- ---------------------------------------------------------------------------
create table if not exists public.person_notes (
  id         uuid primary key default gen_random_uuid(),
  person_key text not null,
  author     uuid default auth.uid() references auth.users (id) on delete set null,
  body       text not null,
  mentions   uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  -- 32 hex characters of the address's SHA-256: what person_key() returns
  constraint person_notes_key_valid check (person_key ~ '^[0-9a-f]{32}$'),
  constraint person_notes_body_valid check (
    char_length(body) between 1 and 2000
    and char_length(btrim(body)) >= 1
    and body !~ '[\u0001-\u0008\u000B-\u001F\u007F]'
  ),
  constraint person_notes_mentions_valid check (coalesce(array_length(mentions, 1), 0) <= 20)
);
comment on table public.person_notes is 'Internal staff notes about a person who has written in, keyed by person_key (never by address). Append-only through the API.';

alter table public.person_notes enable row level security;
alter table public.person_notes force row level security;
revoke all on table public.person_notes from public, anon, authenticated;

create index if not exists person_notes_person_idx on public.person_notes (person_key, created_at desc);
create index if not exists person_notes_mentions_idx on public.person_notes using gin (mentions);

-- Read, and add. Nothing else: no UPDATE and no DELETE privilege exists for an API role.
grant select on public.person_notes to authenticated;
grant insert (person_key, body, mentions) on public.person_notes to authenticated;

drop policy if exists person_notes_staff_select on public.person_notes;
create policy person_notes_staff_select on public.person_notes
  for select
  to authenticated
  using ((select public.staff_can('customers.read')));

drop policy if exists person_notes_staff_insert on public.person_notes;
create policy person_notes_staff_insert on public.person_notes
  for insert
  to authenticated
  with check (
    (select public.staff_can('customers.note'))
    and author = (select auth.uid())
  );

-- Who wrote and when is set here; the person must exist; and the mentions are
-- reduced to the people who may really be mentioned (see the header).
create or replace function public.person_notes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') in ('anon', 'authenticated') then
    new.created_at := now();
    new.author := (select auth.uid());
  end if;

  -- a note is about somebody who has written in: the same test as person_view()
  if not exists (
    select 1
    from (
      select email from public.leads
      union select email from public.tickets
      union select email from public.newsletter_subscribers
    ) x
    where public.person_key(x.email) = new.person_key
  ) then
    raise exception 'nobody has that key' using errcode = 'P0002';
  end if;

  new.mentions := coalesce((
    select array_agg(s.user_id order by s.display_name, s.user_id)
    from public.staff s
    where s.user_id = any (coalesce(new.mentions, '{}'::uuid[]))
      and s.active
      and s.user_id is distinct from new.author
      and exists (
        select 1 from public.role_capabilities rc
        where rc.role = s.role and rc.capability = 'customers.read'
      )
      and position('@' || s.display_name in new.body) > 0
  ), '{}'::uuid[]);

  return new;
end;
$$;

-- That a note was written, by whom, about which record. Never its text.
create or replace function public.person_notes_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (
    coalesce((select auth.uid()), new.author), 'person.note', 'person', new.person_key,
    jsonb_build_object('note_id', new.id, 'mentions', coalesce(array_length(new.mentions, 1), 0))
  );
  return null;
end;
$$;

drop trigger if exists person_notes_before_insert on public.person_notes;
create trigger person_notes_before_insert
  before insert on public.person_notes
  for each row execute function public.person_notes_before_insert();

drop trigger if exists person_notes_after_insert on public.person_notes;
create trigger person_notes_after_insert
  after insert on public.person_notes
  for each row execute function public.person_notes_after_insert();

-- ---------------------------------------------------------------------------
-- Who can be mentioned in a note.
-- ---------------------------------------------------------------------------
create or replace function public.staff_mentionable()
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, s.display_name
  from public.staff s
  where (select public.staff_can('customers.note'))
    and s.active
    and s.user_id <> (select auth.uid())
    and exists (
      select 1 from public.role_capabilities rc
      where rc.role = s.role and rc.capability = 'customers.read'
    )
  order by s.display_name, s.user_id;
$$;

-- The caller's own recent mentions, newest first. No note text. Nothing for
-- a caller who cannot open a customer record.
create or replace function public.my_mentions(p_limit integer default 20)
returns table (note_id uuid, person_key text, author_name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := (select auth.uid());
begin
  if me is null or not (select public.is_staff()) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  return query
    select n.id, n.person_key, s.display_name, n.created_at
    from public.person_notes n
    left join public.staff s on s.user_id = n.author
    where n.mentions @> array[me]
      and (select public.staff_can('customers.read'))
    order by n.created_at desc, n.id
    limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$$;

-- ---------------------------------------------------------------------------
-- Internal: message or note text as one line of at most 160 characters.
-- ---------------------------------------------------------------------------
create or replace function public.timeline_excerpt(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when char_length(x.t) > 160 then left(x.t, 157) || '...' else x.t end
  from (select btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')) as t) x;
$$;

-- ---------------------------------------------------------------------------
-- The timeline. See the header for what each kind needs and how paging works.
-- `ord` orders events that share one instant: something arriving (1), then
-- what was written on it (2), then what changed because of it (3); newest
-- first, so a change is listed above the message that caused it.
-- ---------------------------------------------------------------------------
create or replace function public.person_timeline(
  p_key text,
  p_limit integer default 50,
  p_before timestamptz default null,
  p_kinds text[] default null
)
returns table (
  id text, at timestamptz, kind text, summary text, actor uuid, actor_name text,
  entity text, entity_id text, reference text, detail jsonb, has_older boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  addr        text;
  lim         integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  see_leads   boolean;
  see_tickets boolean;
  see_audit   boolean;
begin
  if not (select public.staff_can('customers.read')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_key is null or p_key !~ '^[0-9a-f]{32}$' then
    return;
  end if;

  select x.email into addr
  from (
    select email from public.leads
    union select email from public.tickets
    union select email from public.newsletter_subscribers
  ) x
  where public.person_key(x.email) = p_key
  limit 1;
  if addr is null then
    return;
  end if;

  see_leads := (select public.staff_can('leads.read'));
  see_tickets := (select public.staff_can('tickets.read'));
  see_audit := (select public.staff_can('audit.read'));

  return query
  with ev as (
    -- an enquiry arrived, from the website or entered by a member of staff (0012)
    select
      'lead:' || l.id::text as id,
      l.created_at as at,
      case when l.origin = 'staff' then 'enquiry_entered' else 'enquiry_received' end as kind,
      l.topic as summary,
      l.added_by as actor,
      'lead'::text as entity,
      l.id::text as entity_id,
      l.reference as reference,
      jsonb_strip_nulls(jsonb_build_object(
        'origin', l.origin,
        'how', case when l.origin = 'staff' then l.utm ->> 'utm_source' end)) as detail,
      1 as ord
    from public.leads l
    where see_leads and l.email = addr

    union all
    -- its status or its stage changed (audit entries written by leads_after_update)
    select
      'audit:' || a.id::text, a.at,
      case a.action when 'lead.status' then 'enquiry_status' else 'enquiry_stage' end,
      coalesce(a.detail ->> 'from', '') || ' to ' || coalesce(a.detail ->> 'to', ''),
      a.actor, 'lead'::text, l.id::text, l.reference,
      jsonb_strip_nulls(jsonb_build_object(
        'from', a.detail ->> 'from', 'to', a.detail ->> 'to', 'reason', a.detail ->> 'reason')),
      3
    from public.leads l
    join public.audit_log a on a.entity = 'lead' and a.entity_id = l.id::text
    where see_leads and see_audit and l.email = addr
      and a.action in ('lead.status', 'lead.stage')

    union all
    -- a note written on one of their enquiries
    select
      'lnote:' || n.id::text, n.created_at, 'enquiry_note'::text,
      public.timeline_excerpt(n.body),
      n.author, 'lead'::text, l.id::text, l.reference, '{}'::jsonb, 2
    from public.leads l
    join public.lead_notes n on n.lead_id = l.id
    where see_leads and l.email = addr

    union all
    -- a follow-up was created
    select
      'task:' || k.id::text || ':created', k.created_at, 'followup_created'::text,
      k.title, k.created_by, 'lead'::text, l.id::text, l.reference,
      jsonb_build_object('due_at', k.due_at), 2
    from public.leads l
    join public.lead_tasks k on k.lead_id = l.id
    where see_leads and l.email = addr

    union all
    -- and completed (one that was reopened since is not listed, as in 0015)
    select
      'task:' || k.id::text || ':done', k.done_at, 'followup_completed'::text,
      k.title, k.done_by, 'lead'::text, l.id::text, l.reference, '{}'::jsonb, 3
    from public.leads l
    join public.lead_tasks k on k.lead_id = l.id
    where see_leads and l.email = addr and k.done and k.done_at is not null

    union all
    -- a ticket was opened
    select
      'ticket:' || t.id::text, t.created_at, 'ticket_opened'::text,
      t.subject, null::uuid, 'ticket'::text, t.id::text, t.reference,
      jsonb_build_object('category', t.category), 1
    from public.tickets t
    where see_tickets and t.email = addr

    union all
    -- each message under it: from the customer, a reply from staff, or an internal note (marked)
    select
      'tmsg:' || m.id::text, m.created_at,
      case
        when m.author_kind = 'customer' then 'ticket_customer_message'
        when m.internal then 'ticket_internal_note'
        else 'ticket_staff_reply'
      end,
      public.timeline_excerpt(m.body),
      case when m.author_kind = 'staff' then m.author end,
      'ticket'::text, t.id::text, t.reference,
      jsonb_build_object('internal', m.internal), 2
    from public.tickets t
    join public.ticket_messages m on m.ticket_id = t.id
    where see_tickets and t.email = addr

    union all
    -- its status changed, or it was escalated (audit entries from 0007 and 0013)
    select
      'audit:' || a.id::text, a.at,
      case a.action when 'ticket.status' then 'ticket_status' else 'ticket_escalated' end,
      coalesce(a.detail ->> 'from', '') || ' to ' || coalesce(a.detail ->> 'to', ''),
      a.actor, 'ticket'::text, t.id::text, t.reference,
      jsonb_strip_nulls(jsonb_build_object(
        'from', a.detail ->> 'from', 'to', a.detail ->> 'to', 'hours_overdue', a.detail -> 'hours_overdue')),
      3
    from public.tickets t
    join public.audit_log a on a.entity = 'ticket' and a.entity_id = t.id::text
    where see_tickets and see_audit and t.email = addr
      and a.action in ('ticket.status', 'ticket.escalate')

    union all
    -- the newsletter: joined
    select
      'news:' || s.id::text || ':joined', s.created_at, 'newsletter_joined'::text,
      s.source, null::uuid, 'newsletter'::text, null::text, null::text,
      jsonb_build_object('consent_version', s.consent_version), 1
    from public.newsletter_subscribers s
    where s.email = addr

    union all
    -- and left
    select
      'news:' || s.id::text || ':left', s.unsubscribed_at, 'newsletter_left'::text,
      s.source, null::uuid, 'newsletter'::text, null::text, null::text, '{}'::jsonb, 3
    from public.newsletter_subscribers s
    where s.email = addr and s.unsubscribed_at is not null

    union all
    -- a note about the person
    select
      'pnote:' || pn.id::text, pn.created_at, 'person_note'::text,
      public.timeline_excerpt(pn.body),
      pn.author, 'person'::text, pn.id::text, null::text,
      jsonb_build_object('mentions', coalesce(array_length(pn.mentions, 1), 0)), 2
    from public.person_notes pn
    where pn.person_key = p_key
  ),
  wanted as (
    select e.* from ev e where p_kinds is null or e.kind = any (p_kinds)
  ),
  page as (
    select w.*
    from wanted w
    where p_before is null or w.at < p_before
    order by w.at desc
    fetch first (lim) rows with ties
  )
  select
    p.id, p.at, p.kind, p.summary, p.actor, st.display_name,
    p.entity, p.entity_id, p.reference, p.detail,
    exists (select 1 from wanted o where o.at < (select min(p2.at) from page p2))
  from page p
  left join public.staff st on st.user_id = p.actor
  order by p.at desc, p.ord desc, p.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
-- triggers and the internal helper: not callable through the API
revoke all on function public.person_notes_before_insert() from public, anon, authenticated;
revoke all on function public.person_notes_after_insert() from public, anon, authenticated;
revoke all on function public.timeline_excerpt(text) from public, anon, authenticated;

revoke all on function public.staff_mentionable() from public, anon;
revoke all on function public.my_mentions(integer) from public, anon;
revoke all on function public.person_timeline(text, integer, timestamptz, text[]) from public, anon;
grant execute on function public.staff_mentionable() to authenticated;
grant execute on function public.my_mentions(integer) to authenticated;
grant execute on function public.person_timeline(text, integer, timestamptz, text[]) to authenticated;

-- =============================================================================
-- NOT APPLIED YET: a mention becomes a notification.
--
-- 0018_personal.sql adds `staff_notifications` and notify_staff(). This file
-- must not depend on it, so the block below is commented out. Once 0018 is
-- applied, remove the comment marks and run the block on its own. It is
-- written against 0018 as it stood when this file was written:
--
--   staff_notifications (recipient uuid, kind text, title text, entity text,
--                        entity_id text, created_at, read_at)
--   notify_staff(p_recipient, p_kind, p_title, p_entity, p_entity_id)
--        says nothing to the person who did the thing or to somebody who is
--        not active staff, and writes no second line while the first one about
--        the same thing is unread: three mentions on one record are one
--        notification until it is read.
--
-- A mention is a new kind, `person.mention`, about a new entity, `person`,
-- whose id is the person key (32 hex characters, not a uuid). So three of
-- 0018's CHECK constraints are widened first; nothing else about them changes.
-- The title is a fixed sentence: no name, no note text, no "@".
--
-- The console needs three lines in src/components/control/notify.ts to match:
--   NOTIFY_KINDS        add "person.mention"
--   NOTIFY_KIND_LABEL   "person.mention": "Mention"
--   notifyHref()        if (entity === "person" && /^[0-9a-f]{32}$/.test(entityId))
--                         return `/control/customers/${entityId}#notes`;
--
-- Until then, mentions are recorded in person_notes.mentions and read with
-- my_mentions().
--
-- alter table public.staff_notifications drop constraint if exists staff_notifications_kind_valid;
-- alter table public.staff_notifications add constraint staff_notifications_kind_valid check (kind in (
--   'ticket.assigned', 'ticket.customer_reply', 'lead.assigned', 'task.assigned',
--   'staff.approval', 'blog.review', 'chat.waiting', 'person.mention'
-- ));
-- alter table public.staff_notifications drop constraint if exists staff_notifications_entity_valid;
-- alter table public.staff_notifications add constraint staff_notifications_entity_valid check (
--   entity in ('ticket', 'lead', 'staff_change', 'blog_post', 'chat', 'person')
-- );
-- alter table public.staff_notifications drop constraint if exists staff_notifications_entity_id_valid;
-- alter table public.staff_notifications add constraint staff_notifications_entity_id_valid check (
--   (entity <> 'person' and entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
--   or (entity = 'person' and entity_id ~ '^[0-9a-f]{32}$')
-- );
--
-- -- Like every trigger in 0018, it cannot fail the action: whatever goes wrong
-- -- inside the block is rolled back and the note is still saved.
-- create or replace function public.notify_person_mention()
-- returns trigger
-- language plpgsql
-- security definer
-- set search_path = ''
-- as $$
-- declare
--   who uuid;
-- begin
--   if coalesce(array_length(new.mentions, 1), 0) > 0 then
--     begin
--       foreach who in array new.mentions loop
--         perform public.notify_staff(who, 'person.mention',
--           'You were mentioned in a note on a customer record', 'person', new.person_key);
--       end loop;
--     exception when others then
--       null;
--     end;
--   end if;
--   return null;
-- end;
-- $$;
--
-- drop trigger if exists zz_notify_person_notes_mention on public.person_notes;
-- create trigger zz_notify_person_notes_mention
--   after insert on public.person_notes
--   for each row execute function public.notify_person_mention();
--
-- revoke all on function public.notify_person_mention() from public, anon, authenticated;
-- =============================================================================

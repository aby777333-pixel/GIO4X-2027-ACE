-- =============================================================================
-- GIO4X · 0018_personal · saved views and the notifications centre
-- -----------------------------------------------------------------------------
-- Apply after 0016. It depends only on 0004 (staff, capabilities, staff
-- changes), 0005 (follow-ups), 0007 (tickets), 0008 (chat, presence) and 0011
-- (blog), so its order among the other second-wave migrations does not matter.
-- Re-runnable. Purely additive: no existing table, column,
-- policy, function or trigger function is changed. What it adds to existing
-- tables is six AFTER ROW triggers, each of which can do nothing but write a
-- notification, and none of which can refuse the statement that fired it.
--
-- 1. staff_views          a member of staff's own saved filters for a list
--                         screen (Leads, Tickets, Follow-ups, Blog): a name
--                         and the screen's filter parameters. A view is that
--                         screen's own address; opening one navigates there.
--                         Pinned views appear on the person's dashboard with
--                         a live count.
--
--    Who may do what      a person reads and writes ONLY their own rows
--                         (owner = auth.uid() and is_staff()). Nobody, with
--                         any capability, sees a colleague's views. At most 30
--                         per person, enforced by trigger.
--
--    No personal data     `params` holds filter choices only. The console
--                         validates every value against the screen's
--                         allow-list before it writes, and never sends the
--                         search box (which could hold an e-mail address).
--                         The database repeats what it can: the keys must be
--                         that screen's filter keys (there is no key for
--                         search text), every value is a short string of
--                         letters, digits, space and  : . _ -  (so no "@"),
--                         and the whole object is at most 400 bytes. The name
--                         is the person's own label; it may not contain "@".
--
-- 2. staff_notifications  one line per thing a person should know about: a
--                         kind, a short title, and what to open. The title
--                         NEVER carries personal data: it names a ticket or an
--                         enquiry by its reference (random characters), never
--                         by the customer's name or address.
--
--    Who may do what      a person reads only their own rows. No API role can
--                         insert, update or delete: rows are written by the
--                         triggers below, marked read by
--                         notifications_mark_read() (the caller's own rows
--                         only), and removed by notifications_prune().
--
--    What notifies whom   a ticket or an enquiry assigned to you
--                         a customer replied on a ticket assigned to you
--                         a follow-up assigned to you
--                         a staff change waiting for approval  -> holders of
--                           staff.manage who could decide it (not the
--                           requester, not the person it is about)
--                         a blog post sent for review          -> holders of
--                           blog.publish
--                         a visitor waiting in live chat        -> staff whose
--                           Live Chats screen is open (staff_presence, 0008)
--                         Never the person who did the thing (auth.uid()), and
--                         never somebody who is not active staff. While a
--                         person has an UNREAD line of the same kind about the
--                         same thing, no second one is written: five replies
--                         on one ticket are one notification until it is read.
--
--    They cannot fail     every trigger function does its work inside one
--    the action           exception block. Whatever goes wrong in it (a bad
--                         row, a broken constraint, this code) is rolled back
--                         to the start of that block and the statement that
--                         fired the trigger carries on untouched. The triggers
--                         are named zz_notify_…, so among AFTER ROW triggers
--                         on a table (fired in name order) they run after
--                         every existing one: the audit rows are written
--                         first, exactly as before.
--
--    Retention            read lines older than 30 days and every line older
--                         than 90 days are deleted. There is no scheduler:
--                         notifications_prune() runs whenever somebody marks
--                         something read.
--
-- No new capability: both tables are personal, and every member of staff has
-- their own.
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

-- ---------------------------------------------------------------------------
-- staff_views
-- ---------------------------------------------------------------------------

-- What a view may hold, for a screen. Must list the same keys as VIEW_SCREENS
-- in src/components/control/views-shared.ts. There is deliberately no key for
-- search text. The console checks every VALUE against the screen's own
-- allow-list; here a value only has to be a short, plain string.
create or replace function public.staff_view_params_ok(p_screen text, p_params jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_params is null or jsonb_typeof(p_params) <> 'object' then false
    when octet_length(p_params::text) > 400 then false
    else not exists (
      select 1
      from jsonb_each(p_params) e
      where jsonb_typeof(e.value) <> 'string'
         or (e.value #>> '{}') !~ '^[A-Za-z0-9][A-Za-z0-9 :._-]{0,39}$'
         or not (e.key = any (
              case p_screen
                when 'leads' then array['status', 'stage', 'topic', 'origin', 'sort', 'who']
                when 'tickets' then array['status', 'category', 'priority', 'who', 'overdue']
                when 'tasks' then array['who', 'show']
                when 'blog' then array['status', 'category']
                else array[]::text[]
              end))
    )
  end;
$$;

create table if not exists public.staff_views (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references public.staff (user_id) on delete cascade,
  screen     text not null,
  name       text not null,
  params     jsonb not null default '{}'::jsonb,
  pinned     boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- must equal VIEW_SCREEN_KEYS in src/components/control/views-shared.ts
  constraint staff_views_screen_valid check (screen in ('leads', 'tickets', 'tasks', 'blog')),
  constraint staff_views_name_valid check (
    char_length(name) between 1 and 60
    and char_length(btrim(name)) >= 1
    and name !~ '[\u0001-\u001F\u007F]'
    and name !~ '@'
  ),
  constraint staff_views_params_valid check (public.staff_view_params_ok(screen, params)),
  constraint staff_views_position_valid check (position between 0 and 1000000)
);
comment on table public.staff_views is 'A member of staff''s own saved filters for a list screen. Readable and writable by its owner only. Filter choices only: never search text, never personal data.';

alter table public.staff_views enable row level security;
alter table public.staff_views force row level security;
revoke all on table public.staff_views from public, anon, authenticated;

create index if not exists staff_views_owner_idx on public.staff_views (owner, screen, position);

-- `owner` is not grantable: it is the caller, set by default and again by the
-- trigger. `screen` and `params` cannot be changed once saved: a view with
-- other filters is another view.
grant select on public.staff_views to authenticated;
grant insert (screen, name, params, pinned) on public.staff_views to authenticated;
grant update (name, pinned, position) on public.staff_views to authenticated;
grant delete on public.staff_views to authenticated;

drop policy if exists staff_views_own_select on public.staff_views;
create policy staff_views_own_select on public.staff_views
  for select
  to authenticated
  using (owner = (select auth.uid()) and (select public.is_staff()));

drop policy if exists staff_views_own_insert on public.staff_views;
create policy staff_views_own_insert on public.staff_views
  for insert
  to authenticated
  with check (owner = (select auth.uid()) and (select public.is_staff()));

drop policy if exists staff_views_own_update on public.staff_views;
create policy staff_views_own_update on public.staff_views
  for update
  to authenticated
  using (owner = (select auth.uid()) and (select public.is_staff()))
  with check (owner = (select auth.uid()) and (select public.is_staff()));

drop policy if exists staff_views_own_delete on public.staff_views;
create policy staff_views_own_delete on public.staff_views
  for delete
  to authenticated
  using (owner = (select auth.uid()) and (select public.is_staff()));

-- Who owns a view and when it was made are set here, never by the caller; a
-- new view goes to the end of the person's list; and the cap of 30.
create or replace function public.staff_views_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  api  boolean := coalesce((select auth.role()), '') in ('anon', 'authenticated');
  held integer;
  top  integer;
begin
  if tg_op = 'INSERT' then
    if api then
      new.owner := (select auth.uid());
      new.created_at := now();
    end if;
    new.updated_at := now();

    -- count-then-insert, one person at a time: two saves at once cannot both take the last place
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('gio4x.staff_views.' || new.owner::text));
    select count(*), coalesce(max(v.position), 0) into held, top
    from public.staff_views v
    where v.owner = new.owner;
    if held >= 30 then
      raise exception 'a person keeps at most 30 saved views' using errcode = '54000';
    end if;
    new.position := top + 1;
  else
    new.owner := old.owner;
    new.created_at := old.created_at;
    if api then
      new.screen := old.screen;
      new.params := old.params;
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists staff_views_before_write on public.staff_views;
create trigger staff_views_before_write
  before insert or update on public.staff_views
  for each row execute function public.staff_views_before_write();

revoke all on function public.staff_view_params_ok(text, jsonb) from public, anon, authenticated;
revoke all on function public.staff_views_before_write() from public, anon, authenticated;
-- the check constraint is evaluated as the role doing the insert
grant execute on function public.staff_view_params_ok(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- staff_notifications
-- ---------------------------------------------------------------------------
create table if not exists public.staff_notifications (
  id         bigint generated always as identity primary key,
  recipient  uuid not null references public.staff (user_id) on delete cascade,
  kind       text not null,
  title      text not null,
  entity     text not null,
  entity_id  text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  -- must equal NOTIFY_KINDS in src/components/control/notify.ts
  constraint staff_notifications_kind_valid check (kind in (
    'ticket.assigned', 'ticket.customer_reply', 'lead.assigned', 'task.assigned',
    'staff.approval', 'blog.review', 'chat.waiting'
  )),
  -- a fixed sentence and, at most, a reference: never a name, never an address
  constraint staff_notifications_title_valid check (
    char_length(title) between 1 and 120
    and title !~ '[\u0001-\u001F\u007F]'
    and title !~ '@'
  ),
  -- must equal the entities notifyHref() knows in src/components/control/notify.ts
  constraint staff_notifications_entity_valid check (entity in ('ticket', 'lead', 'staff_change', 'blog_post', 'chat')),
  constraint staff_notifications_entity_id_valid check (entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
);
comment on table public.staff_notifications is 'What a member of staff should know about. Written by triggers only; readable by the recipient only; the title never carries personal data.';

alter table public.staff_notifications enable row level security;
alter table public.staff_notifications force row level security;
revoke all on table public.staff_notifications from public, anon, authenticated;

create index if not exists staff_notifications_recipient_idx on public.staff_notifications (recipient, id desc);
create index if not exists staff_notifications_unread_idx on public.staff_notifications (recipient, kind, entity, entity_id) where read_at is null;
create index if not exists staff_notifications_created_at_idx on public.staff_notifications (created_at);

-- read only: nothing else is granted, so no policy for insert, update or delete exists or is needed
grant select on public.staff_notifications to authenticated;

drop policy if exists staff_notifications_own_select on public.staff_notifications;
create policy staff_notifications_own_select on public.staff_notifications
  for select
  to authenticated
  using (recipient = (select auth.uid()) and (select public.is_staff()));

-- Internal: write one notification. Not callable through the API.
-- Says nothing to the person who did the thing, to somebody who is not active
-- staff, or twice about the same thing while the first line is still unread.
create or replace function public.notify_staff(p_recipient uuid, p_kind text, p_title text, p_entity text, p_entity_id text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_recipient is null or p_recipient is not distinct from (select auth.uid()) then
    return;
  end if;
  if not exists (select 1 from public.staff s where s.user_id = p_recipient and s.active) then
    return;
  end if;
  if exists (
    select 1 from public.staff_notifications n
    where n.recipient = p_recipient and n.kind = p_kind and n.entity = p_entity and n.entity_id = p_entity_id
      and n.read_at is null
  ) then
    return;
  end if;
  insert into public.staff_notifications (recipient, kind, title, entity, entity_id)
  values (p_recipient, p_kind, p_title, p_entity, p_entity_id);
end;
$$;

-- Internal: retention. Read lines older than 30 days, and every line older than 90.
create or replace function public.notifications_prune()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.staff_notifications x
  where (x.read_at is not null and x.created_at < now() - interval '30 days')
     or x.created_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Mark the caller's own notifications as read: the ones named, or all of them
-- when p_ids is null. Returns how many changed. Somebody else's ids are simply
-- not found. Afterwards, opportunistically, retention; a failure there never
-- undoes the marking.
create or replace function public.notifications_mark_read(p_ids bigint[] default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  n     integer;
begin
  if actor is null or not (select public.is_staff()) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_ids is not null and coalesce(array_length(p_ids, 1), 0) > 200 then
    raise exception 'too many ids' using errcode = '22023';
  end if;

  update public.staff_notifications x
  set read_at = now()
  where x.recipient = actor
    and x.read_at is null
    and (p_ids is null or x.id = any (p_ids));
  get diagnostics n = row_count;

  begin
    perform public.notifications_prune();
  exception when others then
    null;
  end;

  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- The triggers. Each function tests cheaply, outside any block, whether there
-- is anything to say; only then does it open the exception block that makes it
-- harmless. They return null (AFTER ROW) whatever happens.
-- ---------------------------------------------------------------------------

-- A ticket given to somebody. Covers assignment in the console, and the
-- assignment rules applied to a new ticket (0013), which are an UPDATE too.
-- A first reply that takes an unowned ticket (0007) is the replier's own doing
-- and says nothing.
create or replace function public.notify_ticket_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to then
    begin
      perform public.notify_staff(new.assigned_to, 'ticket.assigned',
        'A ticket was assigned to you: ' || new.reference, 'ticket', new.id::text);
    exception when others then
      null;
    end;
  end if;
  return null;
end;
$$;

drop trigger if exists zz_notify_tickets_assigned on public.tickets;
create trigger zz_notify_tickets_assigned
  after update on public.tickets
  for each row execute function public.notify_ticket_assigned();

-- The customer wrote on a ticket somebody holds.
create or replace function public.notify_ticket_customer_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  holder uuid;
  ref    text;
begin
  if new.author_kind = 'customer' then
    begin
      select t.assigned_to, t.reference into holder, ref from public.tickets t where t.id = new.ticket_id;
      if holder is not null then
        perform public.notify_staff(holder, 'ticket.customer_reply',
          'The customer replied on your ticket ' || ref, 'ticket', new.ticket_id::text);
      end if;
    exception when others then
      null;
    end;
  end if;
  return null;
end;
$$;

drop trigger if exists zz_notify_ticket_messages_reply on public.ticket_messages;
create trigger zz_notify_ticket_messages_reply
  after insert on public.ticket_messages
  for each row execute function public.notify_ticket_customer_reply();

-- An enquiry given to somebody.
create or replace function public.notify_lead_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to then
    begin
      perform public.notify_staff(new.assigned_to, 'lead.assigned',
        'An enquiry was assigned to you: ' || new.reference, 'lead', new.id::text);
    exception when others then
      null;
    end;
  end if;
  return null;
end;
$$;

drop trigger if exists zz_notify_leads_assigned on public.leads;
create trigger zz_notify_leads_assigned
  after update on public.leads
  for each row execute function public.notify_lead_assigned();

-- A follow-up created for somebody else. The follow-up's own line is not
-- repeated (a person typed it, and it may name a customer): the notification
-- names the enquiry by reference and opens it.
create or replace function public.notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref text;
begin
  if new.assigned_to is not null then
    begin
      select l.reference into ref from public.leads l where l.id = new.lead_id;
      perform public.notify_staff(new.assigned_to, 'task.assigned',
        'A follow-up was assigned to you on enquiry ' || coalesce(ref, ''), 'lead', new.lead_id::text);
    exception when others then
      null;
    end;
  end if;
  return null;
end;
$$;

drop trigger if exists zz_notify_lead_tasks_assigned on public.lead_tasks;
create trigger zz_notify_lead_tasks_assigned
  after insert on public.lead_tasks
  for each row execute function public.notify_task_assigned();

-- A staff change waiting for a second person: to everyone who could decide it.
-- staff_decide() (0004) refuses the requester and the person the request is
-- about, so neither is told. When nobody else can decide, the request is
-- applied at once (0004) and this finds nobody to tell.
create or replace function public.notify_staff_change_pending()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if new.status = 'pending' then
    begin
      for r in
        select s.user_id
        from public.staff s
        join public.role_capabilities rc on rc.role = s.role and rc.capability = 'staff.manage'
        where s.active and s.user_id not in (new.requested_by, new.target)
      loop
        perform public.notify_staff(r.user_id, 'staff.approval',
          'A staff change is waiting for approval', 'staff_change', new.id::text);
      end loop;
    exception when others then
      null;
    end;
  end if;
  return null;
end;
$$;

drop trigger if exists zz_notify_staff_changes_pending on public.staff_changes;
create trigger zz_notify_staff_changes_pending
  after insert on public.staff_changes
  for each row execute function public.notify_staff_change_pending();

-- A blog post sent for review: to everyone who may publish. Fires when the
-- status BECOMES 'review' (a new row in review, or a row moved to it), not on
-- each later save of a post that is already there.
create or replace function public.notify_blog_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r    record;
  sent boolean;
begin
  if tg_op = 'INSERT' then
    sent := new.status = 'review';
  else
    sent := new.status = 'review' and old.status is distinct from 'review';
  end if;
  if sent then
    begin
      for r in
        select s.user_id
        from public.staff s
        join public.role_capabilities rc on rc.role = s.role and rc.capability = 'blog.publish'
        where s.active
      loop
        perform public.notify_staff(r.user_id, 'blog.review',
          'A blog post was sent for review', 'blog_post', new.id::text);
      end loop;
    exception when others then
      null;
    end;
  end if;
  return null;
end;
$$;

drop trigger if exists zz_notify_blog_posts_review on public.blog_posts;
create trigger zz_notify_blog_posts_review
  after insert or update on public.blog_posts
  for each row execute function public.notify_blog_review();

-- A visitor started a live chat: to the staff whose Live Chats screen is open
-- at that moment (their heartbeat in staff_presence has not expired). Nothing
-- about the visitor is in the title.
create or replace function public.notify_chat_waiting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if new.status = 'waiting' then
    begin
      for r in
        select p.user_id
        from public.staff_presence p
        join public.staff s on s.user_id = p.user_id and s.active
        where p.chat_until > now()
      loop
        perform public.notify_staff(r.user_id, 'chat.waiting',
          'A visitor is waiting in live chat', 'chat', new.id::text);
      end loop;
    exception when others then
      null;
    end;
  end if;
  return null;
end;
$$;

drop trigger if exists zz_notify_chat_conversations_waiting on public.chat_conversations;
create trigger zz_notify_chat_conversations_waiting
  after insert on public.chat_conversations
  for each row execute function public.notify_chat_waiting();

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke all on function public.notify_staff(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.notifications_prune() from public, anon, authenticated;
revoke all on function public.notify_ticket_assigned() from public, anon, authenticated;
revoke all on function public.notify_ticket_customer_reply() from public, anon, authenticated;
revoke all on function public.notify_lead_assigned() from public, anon, authenticated;
revoke all on function public.notify_task_assigned() from public, anon, authenticated;
revoke all on function public.notify_staff_change_pending() from public, anon, authenticated;
revoke all on function public.notify_blog_review() from public, anon, authenticated;
revoke all on function public.notify_chat_waiting() from public, anon, authenticated;

revoke all on function public.notifications_mark_read(bigint[]) from public, anon;
grant execute on function public.notifications_mark_read(bigint[]) to authenticated;

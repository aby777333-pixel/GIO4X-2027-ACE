-- =============================================================================
-- GIO4X · 0007_support · support tickets
-- -----------------------------------------------------------------------------
-- Apply after 0006. Re-runnable.
--
-- A ticket is a request for help with a thread under it. It differs from a
-- lead (0001) in one way that matters: the person who opened it can come back.
-- With the reference they were shown and the address they gave, they can read
-- the replies and answer, on the website, without an account and without
-- e-mail (this application cannot send any).
--
-- How the public reaches it, with the publishable key only:
--   INSERT            a visitor opens a ticket. As with leads, only the columns
--                     a visitor supplies are grantable; everything else takes
--                     its default. Throttled by trigger.
--   ticket_view()     reference + address -> the ticket and its public
--                     messages. Both must match: the reference carries 40
--                     random bits, so it cannot be guessed, and an address
--                     alone finds nothing. Internal notes are never returned.
--   ticket_reply()    reference + address + text -> a message from the
--                     customer. Reopens a ticket that was waiting or solved.
--                     A closed ticket takes no more replies.
--
-- Staff (tickets.read / tickets.write) work the queue as themselves: status,
-- priority, category and assignment by column grant, replies and internal
-- notes by INSERT. A first public reply from staff stamps first_response_at,
-- takes the ticket if nobody owns it, and moves it to "pending" (waiting for
-- the customer). Every change is audited; message text never is.
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
  ('admin', 'tickets.read'), ('admin', 'tickets.write'),
  ('agent', 'tickets.read'), ('agent', 'tickets.write'),
  ('support', 'tickets.read'), ('support', 'tickets.write'),
  ('sales', 'tickets.read'),
  ('compliance', 'tickets.read'),
  ('viewer', 'tickets.read')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- tickets
-- ---------------------------------------------------------------------------
create table if not exists public.tickets (
  id                  uuid primary key default gen_random_uuid(),
  reference           text not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  name                text not null,
  email               text not null,
  category            text not null,
  subject             text not null,
  message             text not null,
  page                text not null default '/support',
  privacy_accepted_at timestamptz not null,
  privacy_version     text not null,
  -- staff-controlled
  status              text not null default 'open',
  priority            text not null default 'normal',
  assigned_to         uuid references public.staff (user_id) on delete set null,
  first_response_at   timestamptz,
  solved_at           timestamptz,
  last_customer_at    timestamptz,

  constraint tickets_reference_key unique (reference),
  -- TK- + 8 characters of RFC 4648 base32 (40 random bits)
  constraint tickets_reference_format check (reference ~ '^TK-[A-Z2-7]{8}$'),
  constraint tickets_name_valid check (char_length(name) between 1 and 120 and name !~ '[\u0001-\u001F\u007F]'),
  constraint tickets_email_valid check (
    char_length(email) between 6 and 254
    and email = lower(email)
    and email ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$'
  ),
  -- must equal TICKET_CATEGORIES in src/lib/server/constants.ts
  constraint tickets_category_valid check (category in (
    'account', 'platform', 'funding', 'technical', 'complaint', 'privacy', 'security', 'other'
  )),
  constraint tickets_subject_valid check (
    char_length(subject) between 1 and 160 and char_length(btrim(subject)) >= 1 and subject !~ '[\u0001-\u001F\u007F]'
  ),
  constraint tickets_message_valid check (
    char_length(message) between 1 and 5000
    and char_length(btrim(message)) >= 1
    and message !~ '[\u0001-\u0008\u000B-\u001F\u007F]'
  ),
  constraint tickets_page_valid check (
    char_length(page) between 1 and 300 and page ~ '^/([^/\\[:space:]][^\\[:space:]]*)?$'
  ),
  constraint tickets_privacy_version_valid check (privacy_version ~ '^[A-Za-z0-9._-]{1,40}$'),
  constraint tickets_status_valid check (status in ('open', 'pending', 'solved', 'closed')),
  constraint tickets_priority_valid check (priority in ('low', 'normal', 'high', 'urgent'))
);
comment on table public.tickets is 'Support requests. Opened by the public, worked by staff; the opener can follow it with reference + address.';

alter table public.tickets enable row level security;
alter table public.tickets force row level security;
revoke all on table public.tickets from public, anon, authenticated;

create index if not exists tickets_created_at_idx on public.tickets (created_at desc);
create index if not exists tickets_status_created_at_idx on public.tickets (status, created_at desc);
create index if not exists tickets_email_created_at_idx on public.tickets (email, created_at desc);
create index if not exists tickets_assigned_to_idx on public.tickets (assigned_to) where assigned_to is not null;
create index if not exists tickets_category_idx on public.tickets (category, created_at desc);

-- ---------------------------------------------------------------------------
-- ticket_messages: the thread. `internal` notes are for staff only.
-- A customer's message has no author; staff messages are always the caller.
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  created_at  timestamptz not null default now(),
  author_kind text not null default 'staff',
  author      uuid default auth.uid() references auth.users (id) on delete set null,
  internal    boolean not null default false,
  body        text not null,
  constraint ticket_messages_author_kind_valid check (author_kind in ('customer', 'staff')),
  constraint ticket_messages_customer_public check (not (author_kind = 'customer' and internal)),
  constraint ticket_messages_body_valid check (
    char_length(body) between 1 and 5000
    and char_length(btrim(body)) >= 1
    and body !~ '[\u0001-\u0008\u000B-\u001F\u007F]'
  )
);
comment on table public.ticket_messages is 'Replies and internal notes on a ticket.';

alter table public.ticket_messages enable row level security;
alter table public.ticket_messages force row level security;
revoke all on table public.ticket_messages from public, anon, authenticated;

create index if not exists ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

-- ---------------------------------------------------------------------------
-- Privileges and policies
-- ---------------------------------------------------------------------------
grant insert (
  id, reference, name, email, category, subject, message, page, privacy_accepted_at, privacy_version
) on public.tickets to anon, authenticated;
grant select on public.tickets to authenticated;
grant update (status, priority, category, assigned_to) on public.tickets to authenticated;

grant select on public.ticket_messages to authenticated;
grant insert (ticket_id, body, internal) on public.ticket_messages to authenticated;

drop policy if exists tickets_public_insert on public.tickets;
create policy tickets_public_insert on public.tickets
  for insert
  to anon, authenticated
  with check (
    status = 'open'
    and assigned_to is null
    and first_response_at is null
    and solved_at is null
    and privacy_accepted_at between now() - interval '15 minutes' and now() + interval '2 minutes'
  );

drop policy if exists tickets_staff_select on public.tickets;
create policy tickets_staff_select on public.tickets
  for select
  to authenticated
  using ((select public.staff_can('tickets.read')));

drop policy if exists tickets_staff_update on public.tickets;
create policy tickets_staff_update on public.tickets
  for update
  to authenticated
  using ((select public.staff_can('tickets.write')))
  with check ((select public.staff_can('tickets.write')));

drop policy if exists ticket_messages_staff_select on public.ticket_messages;
create policy ticket_messages_staff_select on public.ticket_messages
  for select
  to authenticated
  using ((select public.staff_can('tickets.read')));

drop policy if exists ticket_messages_staff_insert on public.ticket_messages;
create policy ticket_messages_staff_insert on public.ticket_messages
  for insert
  to authenticated
  with check (
    (select public.staff_can('tickets.write'))
    and author_kind = 'staff'
    and author = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Opening a ticket: the same throttle as leads (30 a minute for everyone,
-- 5 an hour for one address), the database clock, and a complaint starts high.
create or replace function public.tickets_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_all  integer;
  recent_same integer;
begin
  if new.category = 'complaint' then
    new.priority := 'high';
  end if;
  new.last_customer_at := coalesce(new.created_at, now());

  if coalesce((select auth.role()), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  new.created_at := now();
  new.updated_at := now();
  new.last_customer_at := now();

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('gio4x.throttle.tickets'));

  select count(*) into recent_all from public.tickets t where t.created_at > now() - interval '1 minute';
  if recent_all >= 30 then
    raise exception 'Too many requests' using errcode = 'PT429';
  end if;

  select count(*) into recent_same
  from public.tickets t
  where t.email = lower(new.email) and t.created_at > now() - interval '1 hour';
  if recent_same >= 5 then
    raise exception 'Too many requests' using errcode = 'PT429';
  end if;

  return new;
end;
$$;

create or replace function public.tickets_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  new.updated_at := now();

  -- as with leads: anyone who works tickets may take or release one;
  -- giving it to somebody else needs leads.assign
  if actor is not null
     and new.assigned_to is distinct from old.assigned_to
     and new.assigned_to is not null
     and new.assigned_to <> actor
     and not (select public.staff_can('leads.assign'))
  then
    raise exception 'Only an admin may assign a ticket to another member of staff' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if new.status in ('solved', 'closed') then
      new.solved_at := coalesce(old.solved_at, now());
    else
      new.solved_at := null;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.tickets_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), 'ticket.status', 'ticket', new.id::text,
            jsonb_build_object('reference', new.reference, 'from', old.status, 'to', new.status));
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), 'ticket.assign', 'ticket', new.id::text,
            jsonb_build_object('reference', new.reference, 'from', old.assigned_to, 'to', new.assigned_to));
  end if;
  if new.priority is distinct from old.priority then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), 'ticket.priority', 'ticket', new.id::text,
            jsonb_build_object('reference', new.reference, 'from', old.priority, 'to', new.priority));
  end if;
  if new.category is distinct from old.category then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), 'ticket.category', 'ticket', new.id::text,
            jsonb_build_object('reference', new.reference, 'from', old.category, 'to', new.category));
  end if;
  return null;
end;
$$;

-- A message moves its ticket: a public reply from staff answers it, a message
-- from the customer puts it back in front of staff. Text is never audited.
create or replace function public.ticket_messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.author_kind = 'staff' and not new.internal then
    update public.tickets t
    set first_response_at = coalesce(t.first_response_at, now()),
        assigned_to = coalesce(t.assigned_to, new.author),
        status = case when t.status = 'open' then 'pending' else t.status end
    where t.id = new.ticket_id;
  elsif new.author_kind = 'customer' then
    update public.tickets t
    set last_customer_at = now(),
        status = case when t.status in ('pending', 'solved') then 'open' else t.status end
    where t.id = new.ticket_id;
  end if;

  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (
    coalesce((select auth.uid()), new.author),
    case when new.author_kind = 'customer' then 'ticket.customer_reply' when new.internal then 'ticket.note' else 'ticket.reply' end,
    'ticket', new.ticket_id::text, jsonb_build_object('message_id', new.id));
  return null;
end;
$$;

drop trigger if exists tickets_before_insert on public.tickets;
create trigger tickets_before_insert
  before insert on public.tickets
  for each row execute function public.tickets_before_insert();

drop trigger if exists tickets_before_update on public.tickets;
create trigger tickets_before_update
  before update on public.tickets
  for each row execute function public.tickets_before_update();

drop trigger if exists tickets_after_update on public.tickets;
create trigger tickets_after_update
  after update on public.tickets
  for each row execute function public.tickets_after_update();

drop trigger if exists ticket_messages_after_insert on public.ticket_messages;
create trigger ticket_messages_after_insert
  after insert on public.ticket_messages
  for each row execute function public.ticket_messages_after_insert();

revoke all on function public.tickets_before_insert() from public, anon, authenticated;
revoke all on function public.tickets_before_update() from public, anon, authenticated;
revoke all on function public.tickets_after_update() from public, anon, authenticated;
revoke all on function public.ticket_messages_after_insert() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What the person who opened a ticket may do, with reference + address.
-- Staff are never named to the public: a staff message is "GIO4X Support".
-- ---------------------------------------------------------------------------
create or replace function public.ticket_view(p_reference text, p_email text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'reference', t.reference,
    'created_at', t.created_at,
    'category', t.category,
    'subject', t.subject,
    'message', t.message,
    'status', t.status,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('at', m.created_at, 'from', m.author_kind, 'body', m.body) order by m.created_at)
      from public.ticket_messages m
      where m.ticket_id = t.id and not m.internal
    ), '[]'::jsonb)
  )
  from public.tickets t
  where t.reference = upper(btrim(p_reference))
    and t.email = lower(btrim(p_email));
$$;

-- Returns 'ok', 'closed' or 'not_found'. One answer for a wrong reference and
-- a wrong address, so neither can be probed.
create or replace function public.ticket_reply(p_reference text, p_email text, p_body text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t          public.tickets%rowtype;
  recent     integer;
  recent_all integer;
begin
  select * into t
  from public.tickets
  where reference = upper(btrim(p_reference)) and email = lower(btrim(p_email));
  if not found then
    return 'not_found';
  end if;
  if t.status = 'closed' then
    return 'closed';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('gio4x.throttle.ticket_messages'));

  select count(*) into recent
  from public.ticket_messages m
  where m.ticket_id = t.id and m.author_kind = 'customer' and m.created_at > now() - interval '1 hour';
  if recent >= 10 then
    raise exception 'Too many requests' using errcode = 'PT429';
  end if;
  select count(*) into recent_all
  from public.ticket_messages m
  where m.author_kind = 'customer' and m.created_at > now() - interval '1 minute';
  if recent_all >= 60 then
    raise exception 'Too many requests' using errcode = 'PT429';
  end if;

  insert into public.ticket_messages (ticket_id, author_kind, author, internal, body)
  values (t.id, 'customer', null, false, p_body);
  return 'ok';
end;
$$;

revoke all on function public.ticket_view(text, text) from public;
revoke all on function public.ticket_reply(text, text, text) from public;
grant execute on function public.ticket_view(text, text) to anon, authenticated;
grant execute on function public.ticket_reply(text, text, text) to anon, authenticated;

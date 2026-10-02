-- =============================================================================
-- GIO4X · 0008_chat · live chat between a visitor and staff
-- -----------------------------------------------------------------------------
-- Apply after 0007. Re-runnable.
--
-- The rule this is built around: the website never offers a chat that nobody
-- is there to answer. chat_available() is true only while live chat is switched
-- on in Configuration AND at least one member of staff has the Live Chats
-- screen open (their presence is a heartbeat that expires by itself). When it
-- is false the website points to the support form instead.
--
-- A visitor has no account. chat_start() gives them a conversation id and a
-- random token; only a hash of the token is stored. Every later call must
-- present both. No API role can read or write the chat tables directly as a
-- visitor: everything a visitor does goes through the four chat_* functions.
--
-- Staff (chats.read / chats.write) read conversations and messages as
-- themselves and act through the chat_staff_* functions, which record who
-- claimed and who closed a conversation. Message text is never audited.
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
  ('admin', 'chats.read'), ('admin', 'chats.write'),
  ('agent', 'chats.read'), ('agent', 'chats.write'),
  ('support', 'chats.read'), ('support', 'chats.write'),
  ('sales', 'chats.read'), ('sales', 'chats.write'),
  ('compliance', 'chats.read'),
  ('viewer', 'chats.read')
on conflict do nothing;

create table if not exists public.chat_conversations (
  id              uuid primary key default gen_random_uuid(),
  token_hash      text not null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  status          text not null default 'waiting',
  visitor_name    text,
  page            text not null default '/',
  claimed_by      uuid references public.staff (user_id) on delete set null,
  closed_at       timestamptz,
  closed_by       text,
  constraint chat_conversations_status_valid check (status in ('waiting', 'active', 'closed')),
  constraint chat_conversations_name_valid check (
    visitor_name is null or (char_length(visitor_name) between 1 and 80 and visitor_name !~ '[\u0001-\u001F\u007F]')
  ),
  constraint chat_conversations_page_valid check (
    char_length(page) between 1 and 300 and page ~ '^/([^/\\[:space:]][^\\[:space:]]*)?$'
  ),
  constraint chat_conversations_closed_by_valid check (closed_by is null or closed_by in ('visitor', 'staff')),
  constraint chat_conversations_closed_evidence check ((status = 'closed') = (closed_at is not null))
);
comment on table public.chat_conversations is 'Live chat conversations. A visitor reaches one only through the chat_* functions, with its token.';

create table if not exists public.chat_messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  created_at      timestamptz not null default now(),
  author_kind     text not null,
  author          uuid,
  body            text not null,
  constraint chat_messages_author_kind_valid check (author_kind in ('visitor', 'staff')),
  constraint chat_messages_body_valid check (
    char_length(body) between 1 and 2000
    and char_length(btrim(body)) >= 1
    and body !~ '[\u0001-\u0008\u000B-\u001F\u007F]'
  )
);
comment on table public.chat_messages is 'Messages in a live chat conversation.';

-- who has the Live Chats screen open; a row is only meaningful while chat_until is in the future
create table if not exists public.staff_presence (
  user_id    uuid primary key references public.staff (user_id) on delete cascade,
  chat_until timestamptz not null
);
comment on table public.staff_presence is 'Heartbeat of staff available for live chat. Written by chat_presence().';

alter table public.chat_conversations enable row level security;
alter table public.chat_conversations force row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_messages force row level security;
alter table public.staff_presence enable row level security;
alter table public.staff_presence force row level security;
revoke all on table public.chat_conversations, public.chat_messages, public.staff_presence from public, anon, authenticated;

create index if not exists chat_conversations_open_idx on public.chat_conversations (last_message_at desc) where status <> 'closed';
create index if not exists chat_conversations_created_at_idx on public.chat_conversations (created_at desc);
create index if not exists chat_messages_conversation_idx on public.chat_messages (conversation_id, id);

-- staff read as themselves; the token hash is not readable by anyone through the API
grant select (id, created_at, last_message_at, status, visitor_name, page, claimed_by, closed_at, closed_by) on public.chat_conversations to authenticated;
grant select on public.chat_messages to authenticated;
grant select on public.staff_presence to authenticated;

drop policy if exists chat_conversations_staff_select on public.chat_conversations;
create policy chat_conversations_staff_select on public.chat_conversations
  for select
  to authenticated
  using ((select public.staff_can('chats.read')));

drop policy if exists chat_messages_staff_select on public.chat_messages;
create policy chat_messages_staff_select on public.chat_messages
  for select
  to authenticated
  using ((select public.staff_can('chats.read')));

drop policy if exists staff_presence_staff_select on public.staff_presence;
create policy staff_presence_staff_select on public.staff_presence
  for select
  to authenticated
  using ((select public.is_staff()));

-- ---------------------------------------------------------------------------
-- For the website
-- ---------------------------------------------------------------------------

-- true only when chat is switched on and somebody is there to answer
create or replace function public.chat_available()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (s.value ->> 'enabled')::boolean from public.site_settings s where s.key = 'chat'), false)
     and exists (select 1 from public.staff_presence p join public.staff st on st.user_id = p.user_id and st.active where p.chat_until > now());
$$;

-- internal: the conversation for an id + token, or nothing
create or replace function public.chat_conversation_for(p_id uuid, p_token text)
returns public.chat_conversations
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from public.chat_conversations c
  where c.id = p_id
    and p_token is not null
    and c.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- Start a conversation. Returns {id, token}, or raises when chat is not
-- available (P0001 'unavailable') or the throttle is reached (PT429).
create or replace function public.chat_start(p_name text, p_page text, p_body text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  token  text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  cid    uuid;
  recent integer;
  nm     text := nullif(btrim(coalesce(p_name, '')), '');
  pg     text := coalesce(nullif(btrim(coalesce(p_page, '')), ''), '/');
begin
  if not (select public.chat_available()) then
    raise exception 'unavailable' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('gio4x.throttle.chat'));
  select count(*) into recent from public.chat_conversations c where c.created_at > now() - interval '1 minute';
  if recent >= 12 then
    raise exception 'Too many requests' using errcode = 'PT429';
  end if;

  insert into public.chat_conversations (token_hash, visitor_name, page)
  values (encode(sha256(convert_to(token, 'UTF8')), 'hex'), nm, pg)
  returning id into cid;

  insert into public.chat_messages (conversation_id, author_kind, author, body)
  values (cid, 'visitor', null, p_body);

  return jsonb_build_object('id', cid, 'token', token);
end;
$$;

-- Returns 'ok', 'closed' or 'not_found'.
create or replace function public.chat_send(p_id uuid, p_token text, p_body text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c      public.chat_conversations;
  recent integer;
begin
  c := public.chat_conversation_for(p_id, p_token);
  if c.id is null then
    return 'not_found';
  end if;
  if c.status = 'closed' then
    return 'closed';
  end if;

  select count(*) into recent
  from public.chat_messages m
  where m.conversation_id = c.id and m.author_kind = 'visitor' and m.created_at > now() - interval '1 minute';
  if recent >= 20 then
    raise exception 'Too many requests' using errcode = 'PT429';
  end if;

  insert into public.chat_messages (conversation_id, author_kind, author, body) values (c.id, 'visitor', null, p_body);
  update public.chat_conversations set last_message_at = now() where id = c.id;
  return 'ok';
end;
$$;

-- The conversation's state and the messages after a given id. Staff are not
-- named: a staff message is "GIO4X". Null when the id or token is wrong.
create or replace function public.chat_poll(p_id uuid, p_token text, p_after bigint default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.chat_conversations;
begin
  c := public.chat_conversation_for(p_id, p_token);
  if c.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'status', c.status,
    'joined', c.claimed_by is not null,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'from', m.author_kind, 'body', m.body, 'at', m.created_at) order by m.id)
      from public.chat_messages m
      where m.conversation_id = c.id and m.id > coalesce(p_after, 0)
    ), '[]'::jsonb)
  );
end;
$$;

-- The visitor ends the conversation.
create or replace function public.chat_end(p_id uuid, p_token text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.chat_conversations;
begin
  c := public.chat_conversation_for(p_id, p_token);
  if c.id is null then
    return 'not_found';
  end if;
  if c.status <> 'closed' then
    update public.chat_conversations set status = 'closed', closed_at = now(), closed_by = 'visitor' where id = c.id;
  end if;
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- For staff
-- ---------------------------------------------------------------------------

-- "I am here": called every minute or so while the Live Chats screen is open.
create or replace function public.chat_presence(p_on boolean default true)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or not (select public.staff_can('chats.write')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_on then
    insert into public.staff_presence (user_id, chat_until) values (actor, now() + interval '2 minutes')
    on conflict (user_id) do update set chat_until = excluded.chat_until;
  else
    delete from public.staff_presence where user_id = actor;
  end if;
end;
$$;

create or replace function public.chat_staff_claim(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  n     integer;
begin
  if actor is null or not (select public.staff_can('chats.write')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  -- compare-and-set: two people cannot both take the same conversation
  update public.chat_conversations
  set claimed_by = actor, status = 'active'
  where id = p_id and status <> 'closed' and (claimed_by is null or claimed_by = actor);
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'conversation is closed or already taken' using errcode = 'P0002';
  end if;
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (actor, 'chat.claim', 'chat', p_id::text, '{}'::jsonb);
end;
$$;

-- A reply from staff. Replying takes a conversation nobody has taken.
create or replace function public.chat_staff_send(p_id uuid, p_body text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  c     public.chat_conversations%rowtype;
begin
  if actor is null or not (select public.staff_can('chats.write')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  select * into c from public.chat_conversations where id = p_id for update;
  if not found or c.status = 'closed' then
    raise exception 'conversation not found or closed' using errcode = 'P0002';
  end if;
  if c.claimed_by is not null and c.claimed_by <> actor and not (select public.staff_can('leads.assign')) then
    raise exception 'this conversation belongs to a colleague' using errcode = '42501';
  end if;

  insert into public.chat_messages (conversation_id, author_kind, author, body) values (p_id, 'staff', actor, p_body);
  update public.chat_conversations
  set last_message_at = now(), status = 'active', claimed_by = coalesce(claimed_by, actor)
  where id = p_id;

  if c.claimed_by is null then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (actor, 'chat.claim', 'chat', p_id::text, '{}'::jsonb);
  end if;
end;
$$;

create or replace function public.chat_staff_close(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  n     integer;
begin
  if actor is null or not (select public.staff_can('chats.write')) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  update public.chat_conversations
  set status = 'closed', closed_at = now(), closed_by = 'staff'
  where id = p_id and status <> 'closed';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'conversation not found or already closed' using errcode = 'P0002';
  end if;
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (actor, 'chat.close', 'chat', p_id::text, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke all on function public.chat_conversation_for(uuid, text) from public, anon, authenticated;

revoke all on function public.chat_available() from public;
revoke all on function public.chat_start(text, text, text) from public;
revoke all on function public.chat_send(uuid, text, text) from public;
revoke all on function public.chat_poll(uuid, text, bigint) from public;
revoke all on function public.chat_end(uuid, text) from public;
grant execute on function public.chat_available() to anon, authenticated;
grant execute on function public.chat_start(text, text, text) to anon, authenticated;
grant execute on function public.chat_send(uuid, text, text) to anon, authenticated;
grant execute on function public.chat_poll(uuid, text, bigint) to anon, authenticated;
grant execute on function public.chat_end(uuid, text) to anon, authenticated;

revoke all on function public.chat_presence(boolean) from public, anon;
revoke all on function public.chat_staff_claim(uuid) from public, anon;
revoke all on function public.chat_staff_send(uuid, text) from public, anon;
revoke all on function public.chat_staff_close(uuid) from public, anon;
grant execute on function public.chat_presence(boolean) to authenticated;
grant execute on function public.chat_staff_claim(uuid) to authenticated;
grant execute on function public.chat_staff_send(uuid, text) to authenticated;
grant execute on function public.chat_staff_close(uuid) to authenticated;

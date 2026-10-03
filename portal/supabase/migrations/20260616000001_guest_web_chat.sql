-- Guest (anonymous) web live chat.
--
-- The portal's live chat was authenticated-only. This adds a secure path for
-- logged-out website visitors: a client-generated `guest_token` (kept in the
-- browser's localStorage) scopes a visitor to their own conversation. Access
-- is granted ONLY through SECURITY DEFINER functions that anon may execute and
-- that self-scope by the token — the base-table RLS is left completely
-- untouched, so nothing about existing (authenticated) chat behaviour changes.
--
-- Staff already see guest conversations: chat_conversations has guest_name /
-- guest_email / source and the staff console labels rows with user_id IS NULL
-- as guests. Staff replies go through the existing is_staff() policies.

-- 1) Token column + partial index for fast lookup.
alter table public.chat_conversations
  add column if not exists guest_token uuid;

create index if not exists chat_conversations_guest_token_idx
  on public.chat_conversations (guest_token)
  where guest_token is not null;

-- 2) Start (or resume) a guest's open conversation. Idempotent per token.
create or replace function public.guest_start_conversation(
  p_token uuid,
  p_source text default 'web',
  p_name text default null,
  p_email text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_token is null then
    raise exception 'guest token required';
  end if;

  select id into v_id
  from public.chat_conversations
  where guest_token = p_token and status <> 'closed'
  order by last_message_at desc
  limit 1;

  if v_id is not null then
    if p_name is not null or p_email is not null then
      update public.chat_conversations
        set guest_name  = coalesce(guest_name,  nullif(btrim(p_name),  '')),
            guest_email = coalesce(guest_email, nullif(btrim(p_email), ''))
        where id = v_id;
    end if;
    return v_id;
  end if;

  -- guest_name is required by the chat_conv_owner_or_guest CHECK (user_id is
  -- null for guests); default to a clear label for the staff console.
  insert into public.chat_conversations
    (user_id, guest_token, guest_name, guest_email, source, status, subject)
  values
    (null, p_token, coalesce(nullif(btrim(p_name), ''), 'Guest (web)'),
     nullif(btrim(p_email), ''),
     coalesce(nullif(btrim(p_source), ''), 'web'), 'open', 'Live chat')
  returning id into v_id;

  return v_id;
end;
$$;

-- 3) Guest posts a message into their own open conversation.
create or replace function public.guest_send_message(
  p_token uuid,
  p_body text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conv uuid;
  v_msg  uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if p_token is null then raise exception 'guest token required'; end if;
  if v_body = '' then raise exception 'message cannot be empty'; end if;
  if length(v_body) > 4000 then v_body := left(v_body, 4000); end if;

  select id into v_conv
  from public.chat_conversations
  where guest_token = p_token and status <> 'closed'
  order by last_message_at desc
  limit 1;

  if v_conv is null then
    raise exception 'no open conversation for token';
  end if;

  insert into public.chat_messages (conversation_id, author_id, body, is_staff_reply)
  values (v_conv, null, v_body, false)
  returning id into v_msg;

  update public.chat_conversations
    set last_message_at = now(), updated_at = now()
    where id = v_conv;

  return v_msg;
end;
$$;

-- 4) Guest fetches their conversation's messages (used for polling).
create or replace function public.guest_fetch_messages(
  p_token uuid
) returns table (id uuid, body text, is_staff_reply boolean, created_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.body, m.is_staff_reply, m.created_at
  from public.chat_messages m
  join public.chat_conversations c on c.id = m.conversation_id
  where c.guest_token = p_token
  order by m.created_at asc;
$$;

-- 5) Grants: anon may execute the self-scoping guest functions; nothing else.
revoke all on function public.guest_start_conversation(uuid, text, text, text) from public;
revoke all on function public.guest_send_message(uuid, text) from public;
revoke all on function public.guest_fetch_messages(uuid) from public;

grant execute on function public.guest_start_conversation(uuid, text, text, text) to anon, authenticated;
grant execute on function public.guest_send_message(uuid, text) to anon, authenticated;
grant execute on function public.guest_fetch_messages(uuid) to anon, authenticated;

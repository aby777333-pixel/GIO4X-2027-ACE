/**
 * What the Live Chats screen reads, in one place so that the page (first
 * render) and the feed (every few seconds afterwards) cannot drift apart.
 *
 * Everything is read AS THE SIGNED-IN MEMBER OF STAFF: row-level security
 * decides what comes back. `chat_conversations` is never selected with "*":
 * the token hash is not granted to any API role, and asking for it would make
 * the whole query fail.
 */
import type { ChatFeed } from "@/components/control/views/ChatsLive";
import type { Db } from "@/lib/supabase/server";
import { CHAT_CONVERSATION_COLUMNS, type ChatConversationRow, type ChatMessageRow } from "@/lib/supabase/types";

/** Open conversations are all shown; a queue longer than this is not a queue any more. */
const OPEN_LIMIT = 200;
/** "Recently closed": the last few, for context. Older ones stay in the database. */
const CLOSED_LIMIT = 20;
/** A visitor may send 20 messages a minute; this bounds one read, not the conversation. */
const MESSAGE_LIMIT = 1000;

const MESSAGE_COLUMNS = "id, conversation_id, created_at, author_kind, author, body";

export type ChatBoard = Pick<ChatFeed, "at" | "enabled" | "offered" | "present" | "conversations"> & { failed: boolean };

/** The list, and the three facts that decide whether the website offers chat. */
export async function readBoard(supabase: Db): Promise<ChatBoard> {
  const at = new Date().toISOString();
  const [open, closed, setting, offered, presence] = await Promise.all([
    supabase.from("chat_conversations").select(CHAT_CONVERSATION_COLUMNS).neq("status", "closed").order("created_at", { ascending: true }).limit(OPEN_LIMIT),
    supabase.from("chat_conversations").select(CHAT_CONVERSATION_COLUMNS).eq("status", "closed").order("closed_at", { ascending: false }).limit(CLOSED_LIMIT),
    supabase.from("site_settings").select("value").eq("key", "chat").maybeSingle(),
    // exactly the question the website asks, so the screen can never say "offered" when it is not
    supabase.rpc("chat_available"),
    supabase.from("staff_presence").select("user_id").gt("chat_until", at),
  ]);

  const value = setting.data?.value;
  const enabled = typeof value === "object" && value !== null && !Array.isArray(value) && value.enabled === true;

  return {
    at,
    failed: !!open.error || !!closed.error || !!setting.error || !!offered.error || !!presence.error,
    enabled,
    offered: offered.data === true,
    present: (presence.data ?? []).map((row) => row.user_id),
    conversations: [...((open.data ?? []) as ChatConversationRow[]), ...((closed.data ?? []) as ChatConversationRow[])],
  };
}

export type ChatThread = { failed: boolean; selected: ChatConversationRow | null; messages: ChatMessageRow[] };

/** One conversation and its messages after `after` (0 for all of them). `id` must already be a checked uuid. */
export async function readThread(supabase: Db, id: string, after: number): Promise<ChatThread> {
  const [conversation, messages] = await Promise.all([
    supabase.from("chat_conversations").select(CHAT_CONVERSATION_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("chat_messages").select(MESSAGE_COLUMNS).eq("conversation_id", id).gt("id", after).order("id", { ascending: true }).limit(MESSAGE_LIMIT),
  ]);
  const selected = (conversation.data as ChatConversationRow | null) ?? null;
  return {
    failed: !!conversation.error || !!messages.error,
    selected,
    // no conversation, no messages: never show text without the row it belongs to
    messages: selected ? ((messages.data ?? []) as ChatMessageRow[]) : [],
  };
}

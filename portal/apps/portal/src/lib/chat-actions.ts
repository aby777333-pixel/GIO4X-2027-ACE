"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";
import type { Enums } from "@gio4x/supabase";

export type ChatActionResult =
  | { ok: true; conversationId?: string }
  | { ok: false; error: string };

// Customer: return the user's most recent non-closed conversation, or open a
// fresh one. is_staff_reply is decided server-side from the profile role, never
// trusted from the client.
export async function getOrCreateMyConversation(): Promise<ChatActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const supabase = getSupabaseServer();

  const { data: existing } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("user_id", user.id)
    .neq("status", "closed")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return { ok: true, conversationId: existing.id };

  const { data: created, error } = await supabase
    .from("chat_conversations")
    .insert({ user_id: user.id, status: "open" })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  return { ok: true, conversationId: created.id };
}

export async function sendChatMessage(
  conversationId: string,
  body: string,
): Promise<ChatActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const text = body.trim();
  if (!text) return { ok: false, error: "Message cannot be empty." };

  const supabase = getSupabaseServer();
  const isStaff = user.profile?.role === "staff" || user.profile?.role === "admin";

  const { error } = await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    author_id: user.id,
    body: text,
    is_staff_reply: isStaff,
  });
  if (error) return { ok: false, error: error.message };

  // When a staff member replies, claim + activate the conversation if unassigned.
  if (isStaff) {
    const { data: conv } = await supabase
      .from("chat_conversations")
      .select("assigned_staff, status")
      .eq("id", conversationId)
      .maybeSingle();
    if (conv) {
      const patch: { assigned_staff?: string; status?: Enums<"chat_status"> } = {};
      if (!conv.assigned_staff) patch.assigned_staff = user.id;
      if (conv.status !== "active") patch.status = "active";
      if (Object.keys(patch).length > 0) {
        await supabase.from("chat_conversations").update(patch).eq("id", conversationId);
      }
    }
    revalidatePath("/staff/chats");
  }

  return { ok: true, conversationId };
}

// Staff: claim an unassigned conversation.
export async function assignChatToMe(conversationId: string): Promise<ChatActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (user.profile?.role !== "staff" && user.profile?.role !== "admin")
    return { ok: false, error: "Staff only." };

  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from("chat_conversations")
    .update({ assigned_staff: user.id, status: "active" })
    .eq("id", conversationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/chats");
  return { ok: true, conversationId };
}

export async function setChatStatus(
  conversationId: string,
  status: Enums<"chat_status">,
): Promise<ChatActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const supabase = getSupabaseServer();
  // Customers may only close their own thread; staff may set any status.
  const isStaff = user.profile?.role === "staff" || user.profile?.role === "admin";
  if (!isStaff && status !== "closed")
    return { ok: false, error: "Not permitted." };

  const { error } = await supabase
    .from("chat_conversations")
    .update({ status })
    .eq("id", conversationId);
  if (error) return { ok: false, error: error.message };
  if (isStaff) revalidatePath("/staff/chats");
  return { ok: true, conversationId };
}

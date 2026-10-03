"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { requireUser } from "./session";
import type { Enums } from "@gio4x/supabase";

export type ActionResult =
  | { ok: true; message?: string; id?: string; ref?: string }
  | { ok: false; error: string };

export async function createSupportTicket(input: {
  subject: string;
  category: Enums<"ticket_category">;
  priority: Enums<"ticket_priority">;
  body: string;
}): Promise<ActionResult> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Not signed in." };
  if (!input.subject.trim() || !input.body.trim())
    return { ok: false, error: "Subject and message are required." };

  const supabase = getSupabaseServer();
  const ref = `T-${Date.now().toString().slice(-5)}`;

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      subject: input.subject.trim(),
      category: input.category,
      priority: input.priority,
      ticket_ref: ref,
      status: "open",
    })
    .select("id, ticket_ref")
    .single();
  if (error) return { ok: false, error: error.message };

  // first message
  await supabase.from("ticket_messages").insert({
    ticket_id: ticket.id,
    author_id: user.id,
    body: input.body.trim(),
    is_staff_reply: false,
  });

  revalidatePath("/support");
  return { ok: true, message: "Ticket created.", id: ticket.id, ref: ticket.ticket_ref };
}

export async function submitCsat(ticketId: string, score: number): Promise<ActionResult> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Not signed in." };
  if (!Number.isInteger(score) || score < 1 || score > 5) return { ok: false, error: "Pick a rating from 1 to 5." };
  const supabase = getSupabaseServer();
  // RLS (tickets_self_update) allows this only on the customer's OWN, CLOSED ticket.
  const { error } = await supabase
    .from("support_tickets")
    .update({ csat_score: score })
    .eq("id", ticketId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/support/${ticketId}`);
  return { ok: true, message: "Thanks for your feedback." };
}

export async function replyToTicket(ticketId: string, body: string): Promise<ActionResult> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Not signed in." };
  if (!body.trim()) return { ok: false, error: "Reply cannot be empty." };
  const supabase = getSupabaseServer();
  const { error } = await supabase.from("ticket_messages").insert({
    ticket_id: ticketId,
    author_id: user.id,
    body: body.trim(),
    is_staff_reply: false,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/support/${ticketId}`);
  return { ok: true };
}

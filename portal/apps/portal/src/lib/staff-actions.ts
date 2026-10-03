"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";
import { isValidResolutionCode } from "./ticket-constants";
import type { Enums } from "@gio4x/supabase";

export type StaffActionResult = { ok: true } | { ok: false; error: string };

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: "Not signed in." as const };
  const isStaff = user.profile?.role === "staff" || user.profile?.role === "admin";
  if (!isStaff) return { user: null, error: "Staff access only." as const };
  return { user, error: null };
}

export async function staffReplyToTicket(
  ticketId: string,
  body: string,
): Promise<StaffActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  const text = body.trim();
  if (!text) return { ok: false, error: "Reply cannot be empty." };

  const supabase = getSupabaseServer();
  const { error: insErr } = await supabase.from("ticket_messages").insert({
    ticket_id: ticketId,
    author_id: user.id,
    body: text,
    is_staff_reply: true,
  });
  if (insErr) return { ok: false, error: insErr.message };

  // Replying moves an untouched ticket into "in_progress" and claims it.
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("status, assigned_staff")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticket) {
    const patch: {
      status?: Enums<"ticket_status">;
      assigned_staff?: string;
    } = {};
    if (ticket.status === "open") patch.status = "in_progress";
    if (!ticket.assigned_staff) patch.assigned_staff = user.id;
    if (Object.keys(patch).length > 0) {
      await supabase.from("support_tickets").update(patch).eq("id", ticketId);
    }
  }

  revalidatePath(`/staff/tickets/${ticketId}`);
  revalidatePath("/staff/tickets");
  return { ok: true };
}

export async function setTicketStatus(
  ticketId: string,
  status: Enums<"ticket_status">,
): Promise<StaffActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  const supabase = getSupabaseServer();
  // Stamp resolved_at when the ticket first reaches a terminal state; clear it
  // if the ticket is reopened so time-to-resolution stays truthful.
  const terminal = status === "resolved" || status === "closed";
  const { error: updErr } = await supabase
    .from("support_tickets")
    .update({ status, resolved_at: terminal ? new Date().toISOString() : null })
    .eq("id", ticketId);
  if (updErr) return { ok: false, error: updErr.message };
  revalidatePath(`/staff/tickets/${ticketId}`);
  revalidatePath("/staff/tickets");
  return { ok: true };
}

export async function setTicketResolution(
  ticketId: string,
  code: string,
  note: string,
): Promise<StaffActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  if (code && !isValidResolutionCode(code)) return { ok: false, error: "Unknown resolution code." };
  const supabase = getSupabaseServer();
  const { error: updErr } = await supabase
    .from("support_tickets")
    .update({ resolution_code: code || null, resolution_note: note.trim() || null })
    .eq("id", ticketId);
  if (updErr) return { ok: false, error: updErr.message };
  revalidatePath(`/staff/tickets/${ticketId}`);
  return { ok: true };
}

export async function setTicketPriority(
  ticketId: string,
  priority: Enums<"ticket_priority">,
): Promise<StaffActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  const supabase = getSupabaseServer();
  const { error: updErr } = await supabase
    .from("support_tickets")
    .update({ priority })
    .eq("id", ticketId);
  if (updErr) return { ok: false, error: updErr.message };
  revalidatePath(`/staff/tickets/${ticketId}`);
  revalidatePath("/staff/tickets");
  return { ok: true };
}

export async function assignTicketToMe(ticketId: string): Promise<StaffActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  const supabase = getSupabaseServer();
  const { error: updErr } = await supabase
    .from("support_tickets")
    .update({ assigned_staff: user.id })
    .eq("id", ticketId);
  if (updErr) return { ok: false, error: updErr.message };
  revalidatePath(`/staff/tickets/${ticketId}`);
  revalidatePath("/staff/tickets");
  return { ok: true };
}

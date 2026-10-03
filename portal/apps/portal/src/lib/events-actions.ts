"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";

// ---------------------------------------------------------------------------
// Event-bus (events_outbox) staff tooling.
//   • dispatchEvents()  → drains unprocessed events into per-user notifications
//     and admin alerts (SECURITY DEFINER RPC dispatch_outbox_events).
//   • loadRecentEvents()→ admin-only feed of the outbox for the monitor UI.
//   • runDispatch()     → fire-and-forget drain wired into the money actions so
//     notifications fan out the instant a fee/trade/rebate event is emitted.
// events_outbox SELECT is admin-only via RLS; dispatch is staff-gated in-RPC.
// ---------------------------------------------------------------------------

export type EventsActionResult =
  | { ok: true; dispatched: number }
  | { ok: false; error: string };

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return { user: null, isAdmin: false, error: "Not signed in." as const };
  const role = user.profile?.role;
  const isStaff = role === "staff" || role === "admin";
  if (!isStaff) return { user: null, isAdmin: false, error: "Staff access only." as const };
  return { user, isAdmin: role === "admin", error: null };
}

export type OutboxEvent = {
  id: string;
  topic: string;
  payload: Record<string, unknown>;
  actor_id: string | null;
  attempts: number;
  processed_at: string | null;
  created_at: string;
};

// Admin-only feed of recent events. Returns [] for non-admins (RLS would also
// block, but we short-circuit to avoid a pointless round-trip).
export async function loadRecentEvents(limit = 80): Promise<OutboxEvent[]> {
  const { isAdmin } = await requireStaff();
  if (!isAdmin) return [];
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("events_outbox")
    .select("id, topic, payload, actor_id, attempts, processed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((e) => ({
    id: e.id,
    topic: e.topic,
    payload: (e.payload as Record<string, unknown>) ?? {},
    actor_id: e.actor_id,
    attempts: e.attempts,
    processed_at: e.processed_at,
    created_at: e.created_at,
  }));
}

// Explicit "Process now" button on the monitor — drains the outbox and reports
// how many events were fanned out.
export async function dispatchEvents(limit = 200): Promise<EventsActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  const supabase = getSupabaseServer();
  const { data, error: rpcErr } = await supabase.rpc("dispatch_outbox_events", {
    p_limit: limit,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };
  revalidatePath("/staff/events");
  return { ok: true, dispatched: Number(data ?? 0) };
}

// Fire-and-forget drain for wiring into other staff actions (settle / trade).
// Swallows errors so a dispatch hiccup never fails the parent money action —
// unprocessed events are retried on the next drain or by the scheduled cron.
export async function runDispatch(limit = 200): Promise<number> {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.rpc("dispatch_outbox_events", {
      p_limit: limit,
    });
    if (error) return 0;
    return Number(data ?? 0);
  } catch {
    return 0;
  }
}

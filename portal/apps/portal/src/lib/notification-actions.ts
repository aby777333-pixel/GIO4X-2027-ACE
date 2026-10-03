"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { requireUser } from "./session";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notifications");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { requireUser } from "./session";
import type { TablesUpdate } from "@gio4x/supabase";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

// Only the columns the user is allowed to edit on their own profile.
// RLS pins role / status / kyc_status to their current values.
const EDITABLE_FIELDS = [
  "full_name",
  "phone",
  "country",
  "language",
  "timezone",
  "avatar_url",
] as const;

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Not signed in." };

  const patch: TablesUpdate<"profiles"> = {};
  for (const field of EDITABLE_FIELDS) {
    const raw = formData.get(field);
    if (raw === null) continue;
    const v = String(raw).trim();
    (patch as Record<string, string | null>)[field] = v === "" ? null : v;
  }
  if (Object.keys(patch).length === 0)
    return { ok: false, error: "Nothing to save." };

  const supabase = getSupabaseServer();
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile updated." };
}

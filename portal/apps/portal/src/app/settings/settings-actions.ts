"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase-server";
import { requireUser } from "@/lib/session";
import type { TablesUpdate } from "@gio4x/supabase";
import { DEFAULT_PREFERENCES, type Preferences } from "./preferences";

// Display/trading/privacy preferences live under profiles.metadata.preferences
// (jsonb) so no schema change is needed; language + timezone map to their own
// first-class columns (also read by the Profile page).
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export async function saveSettings(formData: FormData): Promise<ActionResult> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Not signed in." };

  const str = (k: string, fallback: string) => {
    const v = formData.get(k);
    return v === null ? fallback : String(v).trim() || fallback;
  };
  const bool = (k: string) => formData.get(k) === "on";

  const language = str("language", user.profile?.language ?? "en");
  const timezone = str("timezone", user.profile?.timezone ?? "UTC");

  const preferences: Preferences = {
    density: str("density", DEFAULT_PREFERENCES.density),
    sidebar: str("sidebar", DEFAULT_PREFERENCES.sidebar),
    displayCurrency: str("displayCurrency", DEFAULT_PREFERENCES.displayCurrency),
    defaultAccount: str("defaultAccount", DEFAULT_PREFERENCES.defaultAccount),
    defaultLot: str("defaultLot", DEFAULT_PREFERENCES.defaultLot),
    confirmTrades: str("confirmTrades", DEFAULT_PREFERENCES.confirmTrades),
    privacyTradeData: bool("privacyTradeData"),
    privacyMarketing: bool("privacyMarketing"),
    privacyLeaderboard: bool("privacyLeaderboard"),
  };

  // Merge into existing metadata so we never clobber other keys.
  const existingMeta =
    (user.profile?.metadata as Record<string, unknown> | null) ?? {};
  const patch: TablesUpdate<"profiles"> = {
    language,
    timezone,
    metadata: { ...existingMeta, preferences },
  };

  const supabase = getSupabaseServer();
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

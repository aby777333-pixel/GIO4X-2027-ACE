"use server";

// §24 Broker Configuration Centre — the one config the broker console owns
// directly: platform feature flags. Reads are staff-visible, writes are admin
// only, both enforced by the feature_flags RLS (select is_staff / write is_admin)
// plus an explicit admin check. Deeper platform settings (pricing, kill switches,
// maintenance) live in the super-admin Tech Hub and are linked, not duplicated.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  description: string | null;
  updated_at: string | null;
};

export async function loadFeatureFlags(): Promise<FeatureFlag[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("feature_flags")
    .select("key, enabled, description, updated_at")
    .order("key", { ascending: true });
  return (data ?? []) as FeatureFlag[];
}

export async function setFeatureFlag(key: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.profile?.role !== "admin") return { ok: false, error: "Admin access only." };
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from("feature_flags")
    .update({ enabled, updated_by: user.id })
    .eq("key", key);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/config");
  return { ok: true };
}

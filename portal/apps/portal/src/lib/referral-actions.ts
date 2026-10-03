"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { requireUser } from "./session";

export type ActionResult =
  | { ok: true; code?: string }
  | { ok: false; error: string };

export async function createReferralLink(input: {
  name?: string;
  destination?: string;
  subId?: string;
}): Promise<ActionResult> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = getSupabaseServer();
  // unique short code
  const code = `${(user.profile?.referral_code ?? "G4X").slice(0, 4)}-${Date.now()
    .toString(36)
    .toUpperCase()
    .slice(-6)}`;
  const { error } = await supabase.from("referrals").insert({
    owner_id: user.id,
    code,
    name: input.name?.trim() || null,
    destination: input.destination || "register",
    sub_id: input.subId?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ib/referrals");
  return { ok: true, code };
}

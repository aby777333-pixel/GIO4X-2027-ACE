"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can, getAccess, SIGN_IN_PATH } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";

/**
 * Readers' riddles: approve or reject one. A riddle a visitor sent is shown on
 * the website only after this, by someone who may publish content
 * (content.publish). Only the status changes: the table refuses any change to
 * a riddle's words and records who decided and when.
 */
const BACK = "/control/content/riddles";

export async function decideRiddle(formData: FormData): Promise<void> {
  const access = await getAccess();
  if (access.state === "anonymous") redirect(SIGN_IN_PATH);
  if (access.state !== "staff") redirect("/control");
  const id = formData.get("id");
  const to = formData.get("status");
  if (!isUuid(id) || (to !== "approved" && to !== "rejected" && to !== "pending")) redirect(`${BACK}?error=invalid`);
  if (!can(access, "content.publish")) redirect(`${BACK}?error=forbidden`);

  const db = access.supabase as unknown as SupabaseClient;
  const { data, error } = await db.from("reader_riddles").update({ status: to }).eq("id", id).select("id");
  if (error) redirect(`${BACK}?error=save`);
  if (!data || data.length !== 1) redirect(`${BACK}?error=forbidden`);

  // the Verse Room reads the approved riddles
  revalidatePath("/verse");
  redirect(`${BACK}?notice=${to}`);
}

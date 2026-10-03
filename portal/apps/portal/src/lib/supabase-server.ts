// Helper that wires Next.js `cookies()` into the @gio4x/supabase server
// client. Keeping this here (in apps/portal) so packages/supabase doesn't
// take a runtime dep on "next/headers".

import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@gio4x/supabase";

export function getSupabaseServer() {
  return createServerSupabaseClient(cookies());
}

"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Browser client.
 *
 * GIO4X Control does NOT use this for authentication or data: sign-in,
 * sign-out and every query run on the server, and the session cookies are
 * HttpOnly and scoped to /control, so this client cannot read them and is
 * always the anonymous role. That is deliberate: no session token is ever
 * reachable from page scripts.
 *
 * It exists for future anonymous, read-only uses (for example a public status
 * feed) and must never be given anything but the publishable key.
 */
let client: SupabaseClient<Database> | null = null;

export function getBrowserSupabase(): SupabaseClient<Database> | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client = createBrowserClient<Database>(url, key);
  return client;
}

// Public surface of @gio4x/supabase.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums } from "./types";
export { Constants } from "./types";
export type AppSupabaseClient = SupabaseClient<Database>;

// SSR-aware clients for Next.js App Router
export { createBrowserSupabaseClient } from "./client";
export {
  createServerSupabaseClient,
  createServiceRoleClient,
  type CookieStoreLike,
} from "./server";

// Adapters
export {
  getSms,
  generateNumericOtp,
  type SmsAdapter,
  type SmsSendResult,
} from "./sms";
export {
  getEmail,
  type EmailAdapter,
  type EmailSendResult,
  type EmailTemplateKey,
  type EmailTemplateVars,
} from "./email";

// ---------------------------------------------------------------------------
// Legacy non-SSR client factories. Kept for callers that don't need cookie
// session sync (e.g. one-off public reads from a script). Prefer
// createBrowserSupabaseClient / createServerSupabaseClient for the app.
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tdifcayznqnaduchzfqz.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let browserClient: AppSupabaseClient | null = null;

export function getBrowserClient(): AppSupabaseClient {
  if (!browserClient) {
    browserClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, flowType: "pkce" },
    });
  }
  return browserClient;
}

export function getServerClient(serviceRoleKey?: string): AppSupabaseClient {
  return createClient<Database>(
    SUPABASE_URL,
    serviceRoleKey ?? SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

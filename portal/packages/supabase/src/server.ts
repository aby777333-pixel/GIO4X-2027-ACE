// Server-side Supabase clients for Next.js App Router.
//
//   createServerSupabaseClient(cookieStore)   – cookie-bound session, RLS on
//   createServiceRoleClient()                 – bypasses RLS, NEVER ship to browser
//
// The cookie adapter takes the `cookies()` from "next/headers" — we don't
// import "next/headers" here so this package stays framework-neutral.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tdifcayznqnaduchzfqz.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export interface CookieStoreLike {
  get(name: string): { value: string } | undefined;
  set?(opts: { name: string; value: string } & CookieOptions): void;
}

/**
 * Cookie-bound server client. Use in route handlers, server components, and
 * server actions. `cookieStore` is the result of `cookies()` from
 * "next/headers" — pass it in to keep this package framework-neutral.
 */
export function createServerSupabaseClient(cookieStore: CookieStoreLike) {
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set?.({ name, value, ...options });
        } catch {
          // server components can't set cookies — silently no-op.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set?.({ name, value: "", ...options });
        } catch {
          // ignore
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS. Use ONLY in:
 *   - server actions (`"use server"`)
 *   - route handlers under /api or /auth
 *   - edge functions
 *
 * If this ever appears in code that ships to the browser, that is a
 * security bug. We throw at construction time if the key is missing so
 * silent fallback to anon is impossible.
 */
export function createServiceRoleClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Refusing to construct a service-role client.",
    );
  }
  return createClient<Database>(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

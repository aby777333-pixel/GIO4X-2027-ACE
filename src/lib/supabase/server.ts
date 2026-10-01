import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { CONTROL_COOKIE_OPTIONS, getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";

export type Db = SupabaseClient<Database>;

/** Every request to Supabase is bounded: a slow database must not hang a function. */
function boundedFetch(ms: number): typeof fetch {
  return (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(ms) });
}

/**
 * Server client bound to the caller's session cookies (GIO4X Control).
 * Every query runs as the signed-in user, so row-level security decides what
 * they can see and change. A new client is created for each request.
 *
 * Server Components cannot write cookies; the refresh of an expiring session
 * is done by src/middleware.ts before rendering. Server Actions and Route
 * Handlers can, which is how sign-in and sign-out set and clear the session.
 */
export async function createServerSupabase(): Promise<Db | null> {
  const env = getSupabaseEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient<Database>(env.url, env.key, {
    cookieOptions: CONTROL_COOKIE_OPTIONS,
    global: { fetch: boundedFetch(10_000) },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          /* called from a Server Component: cookies are read-only here and the
             middleware has already refreshed the session */
        }
      },
    },
  });
}

/**
 * Stateless client for the public form endpoints. No cookies, no session, no
 * token refresh: it is always the `anon` role and can do only what the
 * insert-only policies allow.
 */
export function createPublicSupabase(): Db | null {
  const env = getSupabaseEnv();
  if (!env) return null;
  return createClient<Database>(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: boundedFetch(8_000) },
  });
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CONTROL_COOKIE_OPTIONS, getSupabaseEnv } from "@/lib/supabase/env";

const SIGN_IN = "/control/sign-in";

/**
 * Session upkeep for GIO4X Control, and nothing else.
 *
 * Scoped by `matcher` to /control so the public site is never touched by
 * middleware and stays static and cookie-free.
 *
 * Two jobs:
 *   1. Exchange an expiring session for a fresh one and write the new cookies
 *      (Server Components cannot write cookies themselves).
 *   2. Send a visitor with no usable session to the sign-in page with a real
 *      HTTP redirect, before any rendering starts.
 *
 * This is NOT where access is decided. The redirect is a convenience; every
 * Control page, action and route establishes the caller on the server
 * (src/lib/server/staff.ts) and the database enforces the same rules again
 * through row-level security. Removing this file would change redirects, not
 * who can read what.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = getSupabaseEnv();
  // Not configured: let the page explain that, rather than loop to a sign-in that cannot work.
  if (!env) return response;

  const { pathname } = request.nextUrl;
  const navigational = request.method === "GET" || request.method === "HEAD";
  const mayRedirect = navigational && pathname !== SIGN_IN;

  const toSignIn = () => {
    const url = request.nextUrl.clone();
    url.pathname = SIGN_IN;
    url.search = "";
    const redirect = NextResponse.redirect(url, 307);
    // keep any cookie changes (for example, clearing a dead session)
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  };

  // No session cookie at all: nothing to refresh, no network call.
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    return mayRedirect ? toSignIn() : response;
  }

  const supabase = createServerClient(env.url, env.key, {
    cookieOptions: CONTROL_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        // cache headers that must accompany auth cookies
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  let signedIn = false;
  try {
    // Loads the session, refreshes it when it is close to expiry, verifies the token.
    const { data } = await supabase.auth.getClaims();
    signedIn = !!data?.claims;
  } catch {
    signedIn = false;
  }

  if (!signedIn && mayRedirect) return toSignIn();
  return response;
}

export const config = {
  matcher: ["/control", "/control/:path*"],
};

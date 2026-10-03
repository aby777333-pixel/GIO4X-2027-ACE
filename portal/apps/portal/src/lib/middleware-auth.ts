// Cookie-session refresher + protection decisions for Next.js middleware.
// Kept separate from middleware.ts so the auth wiring is unit-testable.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@gio4x/supabase";
import { siteOrigin } from "@/lib/base-path";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tdifcayznqnaduchzfqz.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Routes that never require auth.
const PUBLIC_PREFIXES = [
  "/auth/",
  "/staff/login", // staff portal has its own shared-credential login
  "/api/",
  "/_next/",
  "/favicon.ico",
  "/logo.png",
  "/robots.txt",
  "/sitemap.xml",
];

// Routes that should bounce a signed-in user back to the app.
const ANONYMOUS_ONLY_PREFIXES = ["/auth/login", "/auth/signup", "/auth/forgot-password"];

/**
 * A redirect target on the public address. `request.nextUrl` keeps the base
 * path, but behind the website's proxy its host is this app's own Netlify
 * address; sending the browser there would take the visitor off the website.
 */
export function publicRedirectUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    const pub = new URL(siteOrigin());
    url.protocol = pub.protocol;
    url.host = pub.host;
  }
  return url;
}

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function isAnonymousOnly(pathname: string): boolean {
  return ANONYMOUS_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // Expose the pathname to server components (the /staff console layout reads
  // it to enforce per-section access). Header-only; no auth-logic change.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  // refresh the session cookie if needed
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  // Bounce signed-in users away from sign-in/sign-up.
  if (user && isAnonymousOnly(pathname)) {
    const url = publicRedirectUrl(request);
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Enforce sign-in on protected routes only when AUTH_ENFORCE !== "false".
  // Default is enforce-on. Set AUTH_ENFORCE=false to keep the demo public.
  const enforce = (process.env.AUTH_ENFORCE ?? "true").toLowerCase() !== "false";

  if (enforce && !user && !isPublic(pathname)) {
    const url = publicRedirectUrl(request);
    // Staff console routes have their own login; never bounce them to the
    // client /auth/login.
    if (pathname.startsWith("/staff")) {
      url.pathname = "/staff/login";
      url.search = "";
    } else {
      url.pathname = "/auth/login";
      url.search = `?redirect=${encodeURIComponent(pathname + search)}`;
    }
    return NextResponse.redirect(url);
  }

  return response;
}

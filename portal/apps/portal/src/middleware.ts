import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/middleware-auth";

// Branded module subdomains → the module's home route. One portal app serves
// all of them; this only maps each subdomain's bare root ("/") to the right
// module. Every other host (zippy-piroshki.netlify.app, localhost, previews)
// and every deeper path falls through to the normal session middleware
// unchanged. Auth enforcement is governed by AUTH_ENFORCE (currently "false",
// so updateSession only refreshes the session cookie here).
const SUBDOMAIN_HOME: Record<string, string> = {
  "copy.gio4x.com": "/copy/discover",
  "pamm.gio4x.com": "/pamm",
  "mam.gio4x.com": "/pamm",
};

export async function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const home = SUBDOMAIN_HOME[host];
  if (home && request.nextUrl.pathname === "/") {
    // branded subdomains are their own public address: keep the request's host
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }
  return await updateSession(request);
}

export const config = {
  // Skip Next internals + static assets. The trailing extension group keeps
  // any image/static file in /public (e.g. /auth-bg.jpg, /logo.png, /hero/*)
  // from being auth-gated — otherwise the session check 307s the asset to
  // /auth/login and it never loads.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/v1|.*\\.(?:jpg|jpeg|png|gif|svg|webp|avif|ico)$).*)",
  ],
};

// PKCE / OTP auth callback. Supabase email links land here with ?code=...
// We exchange the code for a session, then redirect to ?next= (or /).

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@gio4x/supabase";
import { cookies } from "next/headers";
import { publicUrl } from "@/lib/base-path";

export async function GET(request: NextRequest) {
  // Redirects go to the public address (website origin + base path), never to
  // the host of the incoming request: behind the proxy that is this app's own.
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";
  const errorDescription = searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(
      publicUrl(`/auth/login?error=${encodeURIComponent(errorDescription)}`),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      publicUrl("/auth/login?error=missing_code"),
    );
  }

  const supabase = createServerSupabaseClient(cookies());
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      publicUrl(`/auth/login?error=${encodeURIComponent(error.message)}`),
    );
  }

  return NextResponse.redirect(publicUrl(next.startsWith("/") && !next.startsWith("//") ? next : "/"));
}

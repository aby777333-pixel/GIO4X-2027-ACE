"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@gio4x/supabase";

// ---------------------------------------------------------------------------
// Staff portal auth — TWO accepted paths, both ending in an RLS-bound session
// whose profiles.role must be staff/admin:
//
//   A) SHARED credential (env-configured username + password) → signs into a
//      designated backing staff/admin Supabase account. Unchanged, backward-
//      compatible: every existing /staff page keeps reading under the same
//      session it always has.
//
//   B) PER-USER login — if an email is entered (and it isn't the shared
//      username), authenticate that individual's own Supabase account directly.
//      These accounts are minted by the Team module (createStaffUser) and carry
//      their own role + staff_sections, so per-section RBAC becomes meaningful
//      instead of everyone sharing one backing identity.
//
// Env (server-only):
//   STAFF_PORTAL_USERNAME          — the shared username staff type
//   STAFF_PORTAL_PASSWORD          — the shared password staff type
//   STAFF_PORTAL_ACCOUNT_EMAIL     — backing Supabase staff/admin email
//   STAFF_PORTAL_ACCOUNT_PASSWORD  — backing Supabase staff/admin password
// ---------------------------------------------------------------------------

export type StaffAuthResult = { ok: true; redirectTo?: string } | { ok: false; error: string };

// Length-independent, branch-light comparison to avoid trivial timing oracles.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function staffSignIn(formData: FormData): Promise<StaffAuthResult> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!username || !password) {
    return { ok: false, error: "Username and password are required." };
  }

  const expectedUser = process.env.STAFF_PORTAL_USERNAME ?? "";
  const expectedPass = process.env.STAFF_PORTAL_PASSWORD ?? "";
  const backingEmail = process.env.STAFF_PORTAL_ACCOUNT_EMAIL ?? "";
  const backingPass = process.env.STAFF_PORTAL_ACCOUNT_PASSWORD ?? "";

  const sharedConfigured = Boolean(expectedUser && expectedPass && backingEmail && backingPass);
  const isSharedUsername = sharedConfigured && safeEqual(username, expectedUser);

  // Decide which Supabase credentials to sign in with.
  let signInEmail: string;
  let signInPassword: string;

  if (isSharedUsername) {
    // Path A — shared credential: the password must match too, then we sign
    // into the backing staff/admin account (unchanged behaviour).
    if (!safeEqual(password, expectedPass)) {
      return { ok: false, error: "Invalid staff username or password." };
    }
    signInEmail = backingEmail;
    signInPassword = backingPass;
  } else if (username.includes("@")) {
    // Path B — per-user login: authenticate this individual's own account.
    signInEmail = username.toLowerCase();
    signInPassword = password;
  } else if (!sharedConfigured) {
    return {
      ok: false,
      error: "Staff portal is not configured. Sign in with your staff email and password.",
    };
  } else {
    return { ok: false, error: "Invalid staff username or password." };
  }

  // Establish the Supabase session so RLS-bound pages work.
  const supabase = createServerSupabaseClient(cookies());
  const { data, error } = await supabase.auth.signInWithPassword({
    email: signInEmail,
    password: signInPassword,
  });
  if (error || !data.user) {
    return {
      ok: false,
      error: isSharedUsername
        ? "Staff portal sign-in failed. The backing account is misconfigured."
        : "Invalid staff email or password.",
    };
  }

  // Defense in depth: the backing account must really be staff/admin.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  const role = profile?.role;
  if (role !== "staff" && role !== "admin") {
    await supabase.auth.signOut();
    return { ok: false, error: "The backing account is not a staff/admin user." };
  }

  revalidatePath("/staff", "layout");
  return { ok: true, redirectTo: "/staff" };
}

export async function staffSignOut(): Promise<void> {
  const supabase = createServerSupabaseClient(cookies());
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/staff/login");
}

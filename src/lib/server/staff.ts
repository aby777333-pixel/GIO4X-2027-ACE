/**
 * Who is calling GIO4X Control, decided on the server for every request.
 *
 * Every Control page, server action and route handler calls getAccess() (or
 * requireStaff()) itself. The layout does too, but a layout is not re-run on
 * every navigation, so it is never the only check. The database then enforces
 * the same rules again through row-level security: a hidden button is a
 * courtesy, not a control.
 *
 * Identity comes from supabase.auth.getUser(), which asks the Auth server to
 * validate the session. The contents of a cookie are never trusted on their
 * own, so a revoked or signed-out session stops working immediately.
 */
import { redirect } from "next/navigation";
import { cache } from "react";
import { createServerSupabase, type Db } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/supabase/types";

export const SIGN_IN_PATH = "/control/sign-in";

export type StaffContext = {
  state: "staff";
  supabase: Db;
  userId: string;
  email: string | null;
  role: StaffRole;
  displayName: string;
};

export type Access =
  | { state: "unconfigured" } // Supabase environment variables are missing
  | { state: "anonymous" } // no valid session
  | { state: "unavailable" } // signed in, but the database could not be read (for example, migrations not applied)
  | { state: "forbidden"; email: string | null } // signed in, no staff row
  | StaffContext;

function isRole(value: unknown): value is StaffRole {
  return value === "admin" || value === "agent" || value === "viewer";
}

/** Resolved once per request (React cache), however many components ask. */
export const getAccess = cache(async (): Promise<Access> => {
  const supabase = await createServerSupabase();
  if (!supabase) return { state: "unconfigured" };

  let userId: string;
  let email: string | null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { state: "anonymous" };
    userId = data.user.id;
    email = data.user.email ?? null;
  } catch {
    return { state: "anonymous" };
  }

  try {
    const { data, error } = await supabase.from("staff").select("role, display_name").eq("user_id", userId).maybeSingle();
    if (error) return { state: "unavailable" };
    if (!data || !isRole(data.role)) return { state: "forbidden", email };
    return { state: "staff", supabase, userId, email, role: data.role, displayName: data.display_name };
  } catch {
    return { state: "unavailable" };
  }
});

/**
 * For pages: returns the staff context, redirects a signed-out visitor to
 * sign-in, and returns null for every other state (the layout renders the
 * matching notice in place of the page, so the page must render nothing).
 */
export async function requireStaff(): Promise<StaffContext | null> {
  const access = await getAccess();
  if (access.state === "anonymous") redirect(SIGN_IN_PATH);
  return access.state === "staff" ? access : null;
}

/** admin and agent may change things; viewer is read-only (and RLS agrees). */
export function canWrite(role: StaffRole): boolean {
  return role === "admin" || role === "agent";
}

/** id → display name for everyone on staff. Empty if it cannot be read. */
export async function staffDirectory(supabase: Db): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  try {
    const { data } = await supabase.rpc("staff_directory");
    for (const row of data ?? []) names.set(row.user_id, row.display_name);
  } catch {
    /* names are a convenience; the page still renders without them */
  }
  return names;
}

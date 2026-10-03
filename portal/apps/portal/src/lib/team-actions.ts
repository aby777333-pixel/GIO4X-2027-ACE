"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";
import { createServiceRoleClient } from "@gio4x/supabase";

export type TeamResult = { ok: true; message?: string } | { ok: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: "Not signed in." as const };
  if (user.profile?.role !== "admin") return { user: null, error: "Master admin access only." as const };
  return { user, error: null };
}

// New RPCs aren't in the generated Database types; call via a client cast that
// keeps the method binding (extracting .rpc loses `this` → "reading 'rest'").
type RpcResult = { data: unknown; error: { message: string } | null };
async function callRpc(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const supabase = getSupabaseServer();
  const sb = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
  };
  return sb.rpc(fn, args);
}

export type TeamMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  staff_sections: string[] | null;
  created_at: string;
};

export async function listTeam(): Promise<TeamMember[]> {
  const { user } = await requireAdmin();
  if (!user) return [];
  const { data, error } = await callRpc("admin_list_team", {});
  if (error) return [];
  return (data ?? []) as TeamMember[];
}

export async function setStaffAccess(
  userId: string,
  role: string,
  sections: string[],
): Promise<TeamResult> {
  const { user, error } = await requireAdmin();
  if (!user) return { ok: false, error };
  if (userId === user.id && role !== "admin") {
    return { ok: false, error: "You can't remove your own master-admin access." };
  }
  const { error: e } = await callRpc("admin_set_staff_access", {
    p_user_id: userId,
    p_role: role,
    p_sections: sections,
  });
  if (e) return { ok: false, error: e.message };
  revalidatePath("/staff/team");
  return { ok: true, message: "Access updated." };
}

export async function createStaffUser(input: {
  email: string;
  password: string;
  fullName: string;
  role: string;
  sections: string[];
}): Promise<TeamResult> {
  const { user, error } = await requireAdmin();
  if (!user) return { ok: false, error };

  const email = input.email.trim().toLowerCase();
  if (!email || !input.password || input.password.length < 8) {
    return { ok: false, error: "Email and an 8+ character password are required." };
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return { ok: false, error: "Service role key isn't configured on the server." };
  }

  const { data, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName, role: input.role, source: "admin_created" },
  });
  if (createErr || !data.user) {
    return { ok: false, error: createErr?.message ?? "Could not create the user." };
  }

  // The signup trigger created the profile; set role + section grants.
  await callRpc("admin_set_staff_access", {
    p_user_id: data.user.id,
    p_role: input.role,
    p_sections: input.sections,
  });
  revalidatePath("/staff/team");
  return { ok: true, message: `${email} created.` };
}

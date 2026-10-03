// Server-only helpers for reading the current session + profile.
// Cached per-request via React.cache so multiple components hitting these
// don't redo the round-trip.

import { cache } from "react";
import { getSupabaseServer } from "./supabase-server";
import type { Tables } from "@gio4x/supabase";

export type SessionUser = {
  id: string;
  email: string | null;
  profile: Tables<"profiles"> | null;
};

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { id: user.id, email: user.email ?? null, profile: profile ?? null };
});

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("not authenticated");
  return u;
}

"use server";

// §24 Legal documents — admin CRUD + public read of PUBLISHED docs. RLS: public
// reads only published rows; admins read/write all. Editing bumps the version.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";

export type LegalDoc = {
  id: string;
  key: string;
  title: string;
  body: string;
  version: number;
  published: boolean;
  updated_at: string;
};

type Result = { ok: boolean; error?: string };

async function requireAdmin(): Promise<Result> {
  const user = await getCurrentUser();
  if (!user || user.profile?.role !== "admin") return { ok: false, error: "Admin access only." };
  return { ok: true };
}

/** All docs (admin view — includes drafts). */
export async function loadLegalDocs(): Promise<LegalDoc[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("legal_documents")
    .select("id, key, title, body, version, published, updated_at")
    .order("key", { ascending: true });
  return (data ?? []) as LegalDoc[];
}

/** A single PUBLISHED doc for public rendering (null if unpublished/missing). */
export async function loadPublishedLegal(key: string): Promise<LegalDoc | null> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("legal_documents")
    .select("id, key, title, body, version, published, updated_at")
    .eq("key", key)
    .eq("published", true)
    .maybeSingle();
  return (data as LegalDoc) ?? null;
}

export async function saveLegalDoc(input: { id: string; title: string; body: string }): Promise<Result> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  const user = await getCurrentUser();
  const supabase = getSupabaseServer();
  // Read current version so an edit bumps it.
  const { data: cur } = await supabase.from("legal_documents").select("version").eq("id", input.id).maybeSingle();
  const nextVersion = (Number(cur?.version ?? 0) || 0) + 1;
  const { error } = await supabase
    .from("legal_documents")
    .update({ title: input.title.trim(), body: input.body, version: nextVersion, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/config");
  return { ok: true };
}

export async function setLegalPublished(id: string, published: boolean): Promise<Result> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = getSupabaseServer();
  const { data: cur } = await supabase.from("legal_documents").select("key").eq("id", id).maybeSingle();
  const { error } = await supabase
    .from("legal_documents")
    .update({ published, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/config");
  if (cur?.key) revalidatePath(`/legal/${cur.key}`);
  return { ok: true };
}

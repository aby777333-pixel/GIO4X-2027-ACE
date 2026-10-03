"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { requireUser } from "./session";
import type { Enums } from "@gio4x/supabase";

export type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

// Record a kyc_documents row after the browser uploads the file directly
// to Supabase Storage at `<userId>/<docType>/<filename>`.
export async function recordKycDocument(input: {
  docType: Enums<"kyc_doc_type">;
  storagePath: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
}): Promise<ActionResult> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Not signed in." };

  // Sanity: the storage path must begin with the user's UUID
  if (!input.storagePath.startsWith(`${user.id}/`)) {
    return { ok: false, error: "Invalid storage path." };
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("kyc_documents")
    .insert({
      user_id: user.id,
      doc_type: input.docType,
      storage_path: input.storagePath,
      file_name: input.fileName,
      file_size_bytes: input.fileSizeBytes,
      mime_type: input.mimeType,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  // mark the profile kyc_status as in_progress on first document
  await supabase
    .from("profiles")
    .update({ kyc_status: "in_progress" })
    .eq("id", user.id)
    .eq("kyc_status", "not_started");

  revalidatePath("/verification");
  revalidatePath("/");
  return { ok: true, message: "Document submitted for review.", id: data.id };
}

// Staff-only: approve or reject all of a user's open KYC documents. The DB
// RPC enforces is_staff() and recomputes the user's kyc_status via trigger.
export async function reviewKycUser(userId: string, approve: boolean, reason?: string): Promise<ActionResult> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Not signed in." };

  const supabase = getSupabaseServer();
  // review_kyc_user isn't in the generated Database types yet. Cast the CLIENT
  // (not the extracted .rpc method — extracting it loses the `this` binding the
  // supabase-js SDK relies on, which throws "Cannot read properties of
  // undefined (reading 'rest')").
  const sb = supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await sb.rpc("review_kyc_user", {
    p_user_id: userId,
    p_approve: approve,
    p_reason: reason ?? null,
  });
  if (error) return { ok: false, error: error.message };
  if (data === "forbidden") return { ok: false, error: "Staff access required." };

  revalidatePath("/staff/customers");
  return { ok: true, message: approve ? "KYC approved." : "KYC rejected." };
}

export async function deleteKycDocument(docId: string): Promise<ActionResult> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Not signed in." };

  const supabase = getSupabaseServer();
  const { data: doc } = await supabase
    .from("kyc_documents")
    .select("user_id, status, storage_path")
    .eq("id", docId)
    .maybeSingle();
  if (!doc || doc.user_id !== user.id) return { ok: false, error: "Document not found." };
  if (doc.status !== "pending")
    return { ok: false, error: "Only pending documents can be removed." };

  await supabase.storage.from("kyc-documents").remove([doc.storage_path]);
  const { error } = await supabase.from("kyc_documents").delete().eq("id", docId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/verification");
  return { ok: true, message: "Removed." };
}

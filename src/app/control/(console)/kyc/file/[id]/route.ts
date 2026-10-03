/**
 * GET /control/kyc/file/<document id>  →  the client's uploaded document.
 *
 * A reviewer must see a document before deciding on it. The files are in the
 * portal's private storage bucket; nobody can fetch them without a signed
 * link. This route:
 *   1. establishes the caller as staff holding kyc.read (requirePortal);
 *   2. accepts the request only from a Control page (same origin), so another
 *      site cannot make a reviewer's browser open, and log, a document;
 *   3. looks the document up by id. The storage path is never taken from the
 *      request;
 *   4. writes the audit entry (kyc.view) as the signed-in member of staff. No
 *      audit entry, no document;
 *   5. answers with a redirect to a link that works for one minute.
 *
 * The link is to the portal's storage, opened in a tab of its own. It is not
 * cached, and the redirect carries no referrer.
 */
import { NextResponse } from "next/server";
import { fail, isSameOrigin } from "@/lib/server/http";
import { requirePortal } from "@/lib/server/portal-db";
import { isUuid } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "kyc-documents";
const LINK_SECONDS = 60;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return fail(404, "Not found.");
  if (!isSameOrigin(request)) return fail(403, "Open the document from the KYC screen.");

  const access = await requirePortal("kyc.read");
  if (access.state === "none") return fail(401, "Sign in to continue.");
  if (access.state === "forbidden") return fail(403, "Your role does not include KYC documents.");
  if (access.state === "unconfigured") return fail(503, "The portal’s database is not connected.");
  const { ctx, db } = access;

  const { data: doc, error } = await db.from("kyc_documents").select("id, storage_path").eq("id", id).maybeSingle();
  if (error) return fail(503, "The document could not be looked up just now.");
  if (!doc?.storage_path) return fail(404, "Not found.");

  const record = await ctx.supabase.rpc("portal_action_record", { p_action: "kyc.view", p_entity_id: id, p_detail: {} });
  if (record.error) return fail(record.error.code === "42501" ? 403 : 503, "Opening the document could not be recorded, so it was not opened.");

  const signed = await db.storage.from(BUCKET).createSignedUrl(doc.storage_path, LINK_SECONDS);
  if (signed.error || !signed.data?.signedUrl) return fail(404, "The file is not in the portal’s storage.");

  return NextResponse.redirect(signed.data.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" },
  });
}

/**
 * POST /control/subscribers/export  →  CSV of newsletter subscribers.
 *
 * Admin only, checked here on the server and again by the database:
 *   · the rows are read as the signed-in user, so RLS applies;
 *   · record_subscriber_export() refuses anyone who is not an admin and writes
 *     the audit entry. It is called BEFORE the file is sent: if the export
 *     cannot be recorded, it does not happen.
 *
 * POST with a same-origin check, so another site cannot make an admin's
 * browser trigger (and log) an export. The response is never cached.
 * Cells are protected against spreadsheet formula injection (src/lib/server/csv.ts).
 */
import { toCsv } from "@/lib/server/csv";
import { fail, isSameOrigin } from "@/lib/server/http";
import { can, getAccess } from "@/lib/server/staff";
import type { SubscriberRow } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE = 1000;
const MAX_ROWS = 50_000;

type ExportRow = Pick<SubscriberRow, "email" | "created_at" | "source" | "consent_at" | "consent_version" | "unsubscribed_at">;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, "Not allowed.");

  const access = await getAccess();
  if (access.state === "unconfigured" || access.state === "unavailable") return fail(503, "The export is not available just now.");
  if (access.state === "anonymous") return fail(401, "Sign in to continue.");
  if (access.state !== "staff" || !can(access, "subscribers.export")) return fail(403, "Only an administrator can export subscribers.");

  const rows: ExportRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await access.supabase
      .from("newsletter_subscribers")
      .select("email, created_at, source, consent_at, consent_version, unsubscribed_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return fail(503, "The export is not available just now.");
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  // no audit entry, no export
  const { error: auditError } = await access.supabase.rpc("record_subscriber_export", { row_count: rows.length });
  if (auditError) return fail(503, "The export could not be recorded, so it was not produced.");

  const csv = toCsv(
    ["email", "subscribed_at_utc", "source", "consent_at_utc", "consent_version", "unsubscribed_at_utc"],
    rows.map((r) => [r.email, r.created_at, r.source, r.consent_at, r.consent_version, r.unsubscribed_at ?? ""]),
  );
  const day = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gio4x-subscribers-${day}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

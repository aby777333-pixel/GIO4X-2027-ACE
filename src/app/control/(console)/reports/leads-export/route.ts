/**
 * POST /control/reports/leads-export  →  CSV of the enquiries received in a period.
 *
 * Admin only, checked here on the server and again by the database:
 *   · the rows are read as the signed-in user, so RLS applies;
 *   · record_leads_export() refuses anyone who does not hold
 *     `subscribers.export` and writes the audit entry. It is called BEFORE the
 *     file is sent: if the export cannot be recorded, it does not happen.
 *
 * POST with a same-origin check, so another site cannot make an admin's
 * browser trigger (and log) an export. The response is never cached.
 * Cells are protected against spreadsheet formula injection (src/lib/server/csv.ts).
 *
 * The period is the one the Reporting Centre was showing: the form field
 * `days`, accepted only if it is one of REPORT_PERIODS.
 */
import { REPORT_PERIODS } from "@/components/control/views/ReportsView";
import { toCsv } from "@/lib/server/csv";
import { fail, isSameOrigin } from "@/lib/server/http";
import { can, getAccess } from "@/lib/server/staff";
import type { LeadRow } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE = 1000;
const MAX_ROWS = 50_000;
const DAY_MS = 24 * 60 * 60 * 1000;

type ExportRow = Pick<LeadRow, "reference" | "created_at" | "name" | "email" | "phone" | "country" | "topic" | "stage" | "status" | "score" | "page" | "utm" | "marketing_consent">;

/** The campaign source recorded with the enquiry, or empty. */
function utmSource(utm: ExportRow["utm"]): string {
  if (typeof utm !== "object" || utm === null || Array.isArray(utm)) return "";
  const source = utm.utm_source;
  return typeof source === "string" ? source : "";
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, "Not allowed.");

  const access = await getAccess();
  if (access.state === "unconfigured" || access.state === "unavailable") return fail(503, "The export is not available just now.");
  if (access.state === "anonymous") return fail(401, "Sign in to continue.");
  if (access.state !== "staff" || !can(access, "subscribers.export")) return fail(403, "Only an administrator can export enquiries.");

  let requested: FormDataEntryValue | null;
  try {
    requested = (await request.formData()).get("days");
  } catch {
    return fail(400, "That request was not valid.");
  }
  const days = REPORT_PERIODS.find((p) => String(p) === requested);
  if (!days) return fail(400, "That request was not valid.");
  const since = new Date(Date.now() - days * DAY_MS).toISOString();

  const rows: ExportRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await access.supabase
      .from("leads")
      .select("reference, created_at, name, email, phone, country, topic, stage, status, score, page, utm, marketing_consent")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return fail(503, "The export is not available just now.");
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  // no audit entry, no export
  const { error: auditError } = await access.supabase.rpc("record_leads_export", { row_count: rows.length });
  if (auditError) return fail(503, "The export could not be recorded, so it was not produced.");

  const csv = toCsv(
    ["reference", "received_at_utc", "name", "email", "phone", "country", "topic", "stage", "status", "score", "source_page", "utm_source", "marketing_consent"],
    rows.map((r) => [r.reference, r.created_at, r.name, r.email, r.phone ?? "", r.country ?? "", r.topic, r.stage, r.status, r.score, r.page, utmSource(r.utm), r.marketing_consent ? "yes" : "no"]),
  );
  const day = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gio4x-enquiries-last-${days}-days-${day}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

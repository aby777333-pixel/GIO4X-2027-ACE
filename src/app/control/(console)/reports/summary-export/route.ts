/**
 * POST /control/reports/summary-export  →  CSV of one calendar month in counts.
 *
 * The same figures as the printable summary at /control/reports/summary, as
 * rows of `section,metric,value`: both are written from monthSections()
 * (src/components/control/report-month.ts), so they cannot differ. Counts only: no name, address or message is in the file.
 *
 * `reports.read`, checked here on the server and again by the database:
 *   · report_month() counts as the signed-in user and refuses anyone without
 *     the capability;
 *   · record_report_download() refuses the same people and writes the audit
 *     entry. It is called BEFORE the file is sent: if the download cannot be
 *     recorded, it does not happen.
 *
 * POST with a same-origin check, so another site cannot make a member of
 * staff's browser trigger (and log) a download. The response is never cached.
 * Cells are protected against spreadsheet formula injection (src/lib/server/csv.ts):
 * a source name is text a stranger put in a link.
 *
 * The month is the form field `month` ("YYYY-MM"), accepted only if it is one
 * of the twelve months the Reporting Centre offers.
 */
import { findReportMonth, isReportMonth, MONTH_CSV_HEADER, monthCsvRows } from "@/components/control/report-month";
import { toCsv } from "@/lib/server/csv";
import { fail, isSameOrigin } from "@/lib/server/http";
import { can, getAccess } from "@/lib/server/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, "Not allowed.");

  const access = await getAccess();
  if (access.state === "unconfigured" || access.state === "unavailable") return fail(503, "The summary is not available just now.");
  if (access.state === "anonymous") return fail(401, "Sign in to continue.");
  if (access.state !== "staff" || !can(access, "reports.read")) return fail(403, "Your role does not include the Reporting Centre.");

  let requested: FormDataEntryValue | null;
  try {
    requested = (await request.formData()).get("month");
  } catch {
    return fail(400, "That request was not valid.");
  }
  const month = findReportMonth(requested);
  if (!month) return fail(400, "That request was not valid.");

  const { data, error } = await access.supabase.rpc("report_month", { p_month: month.value });
  if (error || !isReportMonth(data) || data.month !== month.value) return fail(503, "The summary is not available just now.");

  // no audit entry, no file
  const { error: auditError } = await access.supabase.rpc("record_report_download", { p_month: month.value });
  if (auditError) return fail(503, "The download could not be recorded, so it was not produced.");

  const csv = toCsv(MONTH_CSV_HEADER, monthCsvRows(data));

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gio4x-monthly-summary-${month.value}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

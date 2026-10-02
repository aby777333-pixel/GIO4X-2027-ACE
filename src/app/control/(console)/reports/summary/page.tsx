import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { findReportMonth, isReportMonth, reportMonths } from "@/components/control/report-month";
import { MonthSummaryView } from "@/components/control/views/MonthSummaryView";
import { can, requireStaff } from "@/lib/server/staff";
import type { ReportMonth } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Monthly summary", "/control/reports/summary");

/**
 * One calendar month in counts, laid out for print (A4). The browser's own
 * Print, then "Save as PDF", makes the file: there is no PDF library here.
 *
 * `month` is "YYYY-MM" and must be one of the twelve months on offer; anything
 * else shows the list of months, never a guess. The figures are counted by the
 * database as the signed-in member of staff, and report_month() refuses anyone
 * without `reports.read`. Counts only, so nothing personal reaches the page or
 * its address.
 */
export default async function MonthSummaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "reports.read")) return <NoAccess title="Monthly summary" />;

  const params = await searchParams;
  const now = new Date();
  const month = findReportMonth(firstParam(params.month), now) ?? null;

  let summary: ReportMonth | null = null;
  if (month) {
    const { data, error } = await ctx.supabase.rpc("report_month", { p_month: month.value });
    // a summary for another month than the one asked for is not believed either
    summary = !error && isReportMonth(data) && data.month === month.value ? data : null;
  }

  return <MonthSummaryView month={month} months={reportMonths(now)} summary={summary} generatedBy={ctx.displayName} />;
}

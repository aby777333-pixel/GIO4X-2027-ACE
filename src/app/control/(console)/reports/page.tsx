import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { DEFAULT_REPORT_PERIOD, REPORT_PERIODS, ReportsView } from "@/components/control/views/ReportsView";
import { can, requireStaff } from "@/lib/server/staff";
import type { ReportSummary } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Reporting Centre", "/control/reports");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isTally(value: unknown): boolean {
  return Array.isArray(value) && value.every((row) => isRecord(row) && typeof row.key === "string" && isCount(row.count));
}

/**
 * report_summary() returns JSON, which the client types as `Json`. The view
 * prints these fields as figures, so the shape is checked here before it is
 * believed: anything else is treated as "could not be read", never as zeros.
 */
function isReportSummary(value: unknown): value is ReportSummary {
  if (!isRecord(value) || !isCount(value.days) || typeof value.since !== "string") return false;
  const { leads, tickets, chats, subscribers, follow_ups } = value;
  if (!isRecord(leads) || !isRecord(tickets) || !isRecord(chats) || !isRecord(subscribers) || !isRecord(follow_ups)) return false;
  const median = tickets.first_response_median_minutes;
  return (
    isCount(leads.total) &&
    isCount(leads.spam) &&
    [leads.by_topic, leads.by_stage, leads.by_status, leads.by_source, leads.by_page, leads.lost_reasons, tickets.by_category, tickets.by_status].every(isTally) &&
    isCount(tickets.total) &&
    isCount(tickets.solved) &&
    isCount(tickets.answered) &&
    (median === null || isCount(median)) &&
    isCount(chats.total) &&
    isCount(chats.answered) &&
    isCount(subscribers.new) &&
    isCount(subscribers.unsubscribed) &&
    isCount(subscribers.active) &&
    isCount(follow_ups.created) &&
    isCount(follow_ups.completed)
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "reports.read")) return <NoAccess title="Reporting Centre" />;

  const params = await searchParams;
  const requested = firstParam(params.days);
  const days = REPORT_PERIODS.find((p) => String(p) === requested) ?? DEFAULT_REPORT_PERIOD;

  // counted by the database, as the signed-in member of staff; it refuses anyone without reports.read
  const { data, error } = await ctx.supabase.rpc("report_summary", { p_days: days });
  const summary = !error && isReportSummary(data) ? data : null;

  return <ReportsView days={days} summary={summary} canExport={can(ctx, "subscribers.export")} />;
}

import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { AnalyticsView } from "@/components/control/views/AnalyticsView";
import { DEFAULT_PULSE_PERIOD, PULSE_PERIODS } from "@/lib/pulse";
import { can, requireStaff } from "@/lib/server/staff";
import type { PulseSummary } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Analytics", "/control/analytics");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (value: unknown): value is string => typeof value === "string" && DAY.test(value);

function isTally(value: unknown): boolean {
  return Array.isArray(value) && value.every((row) => isRecord(row) && typeof row.key === "string" && isCount(row.count));
}

/**
 * pulse_summary() returns JSON, which the client types as `Json`. The view
 * prints these fields as figures, so the shape is checked here before it is
 * believed: anything else is treated as "could not be read", never as zeros.
 */
function isPulseSummary(value: unknown): value is PulseSummary {
  if (!isRecord(value) || !isCount(value.days) || !isDay(value.since) || !isDay(value.until)) return false;
  if (value.first_day !== null && !isDay(value.first_day)) return false;
  const { views, forms, search } = value;
  if (!isRecord(views) || !isRecord(search)) return false;
  return (
    isCount(views.total) &&
    isCount(views.paths) &&
    Array.isArray(views.by_day) &&
    views.by_day.every((row) => isRecord(row) && isDay(row.day) && isCount(row.count)) &&
    [views.by_path, views.by_ref, views.form_pages, forms, search.by_term].every(isTally) &&
    isCount(search.total) &&
    isCount(search.unmatched) &&
    isCount(search.other)
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "analytics.read")) return <NoAccess title="Analytics" />;

  const params = await searchParams;
  const requested = firstParam(params.days);
  const days = PULSE_PERIODS.find((p) => String(p) === requested) ?? DEFAULT_PULSE_PERIOD;

  // added up by the database, as the signed-in member of staff; it refuses anyone without analytics.read
  const { data, error } = await ctx.supabase.rpc("pulse_summary", { p_days: days });
  const summary = !error && isPulseSummary(data) ? data : null;

  return <AnalyticsView days={days} summary={summary} />;
}

import { ACTIVITY_PERIODS, DEFAULT_ACTIVITY_PERIOD, DEFAULT_ACTIVITY_SORT, defaultDir, isActivityRow, isActivitySort, sortActivity, type ActivityDir } from "@/components/control/activity";
import { controlMeta, firstParam } from "@/components/control/format";
import { ActivityView } from "@/components/control/views/ActivityView";
import { can, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Team activity", "/control/activity");

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What the console recorded about staff's work over a period.
 *
 * Two readers, one screen. Somebody holding `activity.read` (admin and
 * compliance) sees everyone, through staff_activity(). Anybody else on staff
 * sees their own row and nothing more, through my_activity(): the database
 * returns one row to them whatever is asked of it, so there is no parameter
 * here that could name another person.
 *
 * `days`, `sort` and `dir` are each checked against a fixed list; anything
 * else falls back to the default view.
 */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  const team = can(ctx, "activity.read");

  const params = await searchParams;
  const requestedDays = firstParam(params.days);
  const days = ACTIVITY_PERIODS.find((p) => String(p) === requestedDays) ?? DEFAULT_ACTIVITY_PERIOD;
  const requestedSort = firstParam(params.sort);
  const sort = team && isActivitySort(requestedSort) ? requestedSort : DEFAULT_ACTIVITY_SORT;
  const requestedDir = firstParam(params.dir);
  const dir: ActivityDir = requestedDir === "asc" || requestedDir === "desc" ? requestedDir : defaultDir(sort);

  // counted by the database, as the signed-in member of staff; each function decides for itself whom it answers
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  const { data, error } = team ? await ctx.supabase.rpc("staff_activity", { p_days: days }) : await ctx.supabase.rpc("my_activity", { p_days: days });
  const read = !error && Array.isArray(data) && data.every(isActivityRow) ? data : null;
  // the database already returns one row to somebody without activity.read; the filter only restates it
  const rows = read ? sortActivity(team ? read : read.filter((row) => row.user_id === ctx.userId), sort, dir) : null;

  return <ActivityView scope={team ? "team" : "own"} days={days} since={since} rows={rows} me={ctx.userId} sort={sort} dir={dir} />;
}

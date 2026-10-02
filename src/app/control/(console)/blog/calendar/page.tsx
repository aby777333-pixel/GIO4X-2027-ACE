import { scheduleBlogPost, unscheduleBlogPost } from "@/app/control/actions-blog-calendar";
import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { CALENDAR_COLUMNS, CALENDAR_MONTH_MAX, CALENDAR_TRAY_MAX, type CalendarPost } from "@/components/control/views/blog-calendar-shared";
import { BlogCalendarView } from "@/components/control/views/BlogCalendarView";
import { monthGrid, monthKeyOf, readMonth, shiftMonth } from "@/lib/blog-calendar";
import { can, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Editorial calendar", "/control/blog/calendar");

/**
 * The blog by the day: one month of UTC days with the posts published or
 * scheduled on each, and the posts that have no date yet. Read as the
 * signed-in user, so row-level security decides (blog.read sees every post).
 *
 * The month arrives in the query string and is checked against what the
 * calendar opens (a well-formed month between 2020 and five years ahead);
 * anything else shows the current month. "Scheduled" and "published" are the
 * same status in the database and differ by whether the publication time has
 * passed, so both are read together and told apart against the moment this
 * page was rendered.
 */
export default async function BlogCalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "blog.read")) return <NoAccess title="Editorial calendar" />;
  const { supabase } = ctx;

  const now = Date.now();
  const month = readMonth(firstParam((await searchParams).month), now);
  const grid = monthGrid(month);
  // readMonth only returns a month monthGrid can draw
  if (!grid) return null;

  const [datedResult, trayResult] = await Promise.all([
    supabase
      .from("blog_posts")
      .select(CALENDAR_COLUMNS)
      .eq("status", "published")
      .gte("published_at", grid.from)
      .lt("published_at", grid.to)
      .order("published_at", { ascending: true })
      .order("id", { ascending: true })
      // one more than is shown, to know whether there are more
      .limit(CALENDAR_MONTH_MAX + 1),
    supabase
      .from("blog_posts")
      .select(CALENDAR_COLUMNS, { count: "exact" })
      .in("status", ["draft", "review"])
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(CALENDAR_TRAY_MAX),
  ]);

  const dated = (datedResult.data ?? []) as CalendarPost[];

  return (
    <BlogCalendarView
      month={month}
      previous={shiftMonth(month, -1, now)}
      next={shiftMonth(month, 1, now)}
      isCurrent={month === monthKeyOf(now)}
      days={grid.days}
      dated={dated.slice(0, CALENDAR_MONTH_MAX)}
      tray={(trayResult.data ?? []) as CalendarPost[]}
      // a figure that could not be counted is not shown as zero
      trayTotal={trayResult.error ? null : (trayResult.count ?? null)}
      now={now}
      canPublish={can(ctx, "blog.publish")}
      canWrite={can(ctx, "blog.write")}
      failed={!!datedResult.error || !!trayResult.error}
      truncated={dated.length > CALENDAR_MONTH_MAX}
      schedule={scheduleBlogPost}
      unschedule={unscheduleBlogPost}
    />
  );
}

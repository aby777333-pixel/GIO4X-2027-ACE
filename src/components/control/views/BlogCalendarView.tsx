import Link from "next/link";
import { ControlHead, Notice } from "@/components/control/bits";
import { BlogCalendar } from "@/components/control/views/BlogCalendar";
import type { CalendarPost, ScheduleAction, UnscheduleAction } from "@/components/control/views/blog-calendar-shared";
import { blogState } from "@/components/control/views/blog-shared";
import { monthLabel } from "@/lib/blog-calendar";

export type BlogCalendarViewProps = {
  /** "YYYY-MM", already validated by the page */
  month: string;
  /** the months either side, or null at the ends of what the calendar opens */
  previous: string | null;
  next: string | null;
  /** whether `month` is the month `now` falls in */
  isCurrent: boolean;
  /** the days drawn: whole weeks, Monday first */
  days: string[];
  dated: CalendarPost[];
  tray: CalendarPost[];
  trayTotal: number | null;
  /** rendered-at time: decides which days have passed and "scheduled" against "published" */
  now: number;
  /** may schedule, move and unschedule (blog.publish) */
  canPublish: boolean;
  /** may create a post (blog.write) */
  canWrite: boolean;
  /** the month's posts could not be read */
  failed: boolean;
  /** the month holds more posts than the page reads */
  truncated: boolean;
  schedule: ScheduleAction;
  unschedule: UnscheduleAction;
};

const monthHref = (month: string) => `/control/blog/calendar?month=${month}`;

/**
 * The frame around the calendar: which month, the way to the months either
 * side and back to today, and what the role can do here. Presentation only;
 * the calendar itself (a client component) handles the dragging and the
 * menus, and the server actions do the saving.
 */
export function BlogCalendarView({ month, previous, next, isCurrent, days, dated, tray, trayTotal, now, canPublish, canWrite, failed, truncated, schedule, unschedule }: BlogCalendarViewProps) {
  // counted from the rows on show, nothing else
  const scheduled = dated.filter((post) => blogState(post, now) === "scheduled").length;
  const live = dated.length - scheduled;

  return (
    <>
      <p className="text-xs text-ink-3">
        <Link href="/control/blog" className="link-quiet">
          Blog
        </Link>
        <span aria-hidden className="mx-8 inline-block h-px w-8 bg-line-strong align-middle" />
        <span className="text-ink-2">Calendar</span>
      </p>

      <div className="mt-13">
        <ControlHead
          title="Editorial calendar"
          lead="When each post is published, by UTC day. A scheduled post appears on the website by itself when its time comes. Publishing a post immediately, and changing or withdrawing one that is already on the website, is done in the editor."
          actions={
            <>
              <Link href="/control/blog" className="btn btn-ghost">
                All posts
              </Link>
              {canWrite && (
                <Link href="/control/blog/new" className="btn btn-primary">
                  New post
                </Link>
              )}
            </>
          }
        />
      </div>

      <nav aria-label="Month" className="mt-21 flex flex-wrap items-center justify-between gap-13">
        <div>
          <h2 className="h4" data-calendar-month>
            {monthLabel(month)}
          </h2>
          {!failed && (
            <p className="num mt-2 text-xs text-ink-3" data-calendar-counts>
              {scheduled} scheduled · {live} published in the weeks shown · UTC
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-8">
          {previous ? (
            <Link href={monthHref(previous)} rel="prev" className="btn btn-ghost btn-sm" aria-label={`Previous month: ${monthLabel(previous)}`}>
              Previous
            </Link>
          ) : (
            <span className="btn btn-ghost btn-sm" aria-disabled="true">
              Previous
            </span>
          )}
          {isCurrent ? (
            <span className="btn btn-ghost btn-sm" aria-current="date">
              Today
            </span>
          ) : (
            <Link href="/control/blog/calendar" className="btn btn-ghost btn-sm" aria-label="Today: the current month">
              Today
            </Link>
          )}
          {next ? (
            <Link href={monthHref(next)} rel="next" className="btn btn-ghost btn-sm" aria-label={`Next month: ${monthLabel(next)}`}>
              Next
            </Link>
          ) : (
            <span className="btn btn-ghost btn-sm" aria-disabled="true">
              Next
            </span>
          )}
        </div>
      </nav>

      <div className="mt-13 grid gap-13 empty:hidden">
        {failed && (
          <Notice title="The posts could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        )}
        {truncated && <Notice title="This month holds more posts than the calendar shows">The earliest are shown. The rest are in the list of posts.</Notice>}
        {!canPublish && (
          <Notice title="Read-only">
            Your role can read the calendar. Scheduling a post, moving it and taking it off the calendar are done by someone whose role includes publishing. {canWrite ? "When a post is ready, send it for review from the editor." : ""}
          </Notice>
        )}
      </div>

      {!failed && (
        <div className="mt-13">
          <BlogCalendar month={month} days={days} dated={dated} tray={tray} trayTotal={trayTotal} now={now} canPublish={canPublish} schedule={schedule} unschedule={unschedule} />
        </div>
      )}
    </>
  );
}

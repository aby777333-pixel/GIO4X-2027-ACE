/**
 * What the editorial calendar's screen and its server actions share: the
 * columns a chip needs, the fixed outcome codes with their words, and the
 * shapes of the two actions (so the screen can be handed either the real
 * actions or stand-ins).
 *
 * Pure: nothing here reads the database, the clock or the browser.
 */
import type { BlogPostRow } from "@/lib/supabase/types";

/** What a chip on the calendar shows of a post. No body, no pictures: the calendar is about when. */
export type CalendarPost = Pick<BlogPostRow, "id" | "title" | "category" | "status" | "published_at">;

export const CALENDAR_COLUMNS = "id, title, category, status, published_at";

/** How many unscheduled posts the tray lists: the most recently changed. The count beside it is of all of them. */
export const CALENDAR_TRAY_MAX = 60;
/** A bound on what one month can make the page read. A daily blog has about thirty. */
export const CALENDAR_MONTH_MAX = 400;

/** Why the calendar changed nothing. Fixed sentences: nothing typed and nothing the database said is ever shown. */
export const CALENDAR_ERRORS = {
  invalid: "That request was not valid. Nothing was changed.",
  forbidden: "Your role cannot schedule posts: that needs a role that includes publishing. Nothing was changed.",
  when: "That is not a date and time that can be used. Both are in UTC. Nothing was changed.",
  past: "That moment has already passed. A post cannot be scheduled in the past: to publish it now, open it in the editor. Nothing was changed.",
  live: "This post is already on the website. It is changed or withdrawn in the editor, not on the calendar. Nothing was changed.",
  archived: "This post is archived. Restore it in the editor before scheduling it. Nothing was changed.",
  unscheduled: "This post is not scheduled, so there is nothing to unschedule. Nothing was changed.",
  alt: "This post has a cover picture without alt text. Describe the picture in the editor, then schedule the post. Nothing was changed.",
  body: "This post has no body yet. Write it in the editor, then schedule the post. Nothing was changed.",
  gone: "This post no longer exists. Nothing was changed.",
  save: "The change could not be saved. Nothing was changed; please try again.",
} as const;
export type CalendarErrorCode = keyof typeof CALENDAR_ERRORS;

export type CalendarResult =
  /** `at`: the publication time now stored, as the database returned it (null once unscheduled) */
  | { ok: true; code: "scheduled" | "moved" | "unscheduled"; at: string | null }
  | { ok: false; code: CalendarErrorCode };

/** Schedules a post, or moves a scheduled one: `day` is "YYYY-MM-DD" and `time` is "HH:MM", both UTC. */
export type ScheduleAction = (id: string, day: string, time: string) => Promise<CalendarResult>;
/** Takes a scheduled post off the calendar: it is a draft again and its publication time is cleared. */
export type UnscheduleAction = (id: string) => Promise<CalendarResult>;

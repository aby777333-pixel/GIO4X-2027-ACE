/**
 * Reading one person's timeline, for the customer page and for the route that
 * loads older events into it. Both read AS THE SIGNED-IN USER through
 * person_timeline() (0019_timeline.sql), which checks customers.read itself
 * and leaves out every kind of event the caller's role does not include.
 */
import { asTimelinePage, isTimelineFilter, TIMELINE_CURSOR, TIMELINE_FILTER_KINDS, TIMELINE_PAGE, type TimelineFilter, type TimelinePage } from "@/components/control/timeline";
import { can, type StaffContext } from "@/lib/server/staff";

/**
 * The filter asked for, if it is one the caller could see anything under.
 * A role without enquiries is not offered "Enquiries", and a hand-typed
 * address asking for it gets everything (which, for that role, has no
 * enquiry event in it either: the database decides).
 */
export function timelineFilter(ctx: Pick<StaffContext, "caps">, raw: string): TimelineFilter {
  if (!isTimelineFilter(raw)) return "all";
  if (raw === "enquiries" && !can(ctx, "leads.read")) return "all";
  if (raw === "tickets" && !can(ctx, "tickets.read")) return "all";
  return raw;
}

/** The paging cursor, exactly as the database wrote it, or null. */
export function timelineCursor(raw: string): string | null {
  return TIMELINE_CURSOR.test(raw) && !Number.isNaN(new Date(raw).getTime()) ? raw : null;
}

export async function readTimeline(ctx: Pick<StaffContext, "supabase">, key: string, show: TimelineFilter, before: string | null): Promise<TimelinePage & { failed: boolean }> {
  try {
    const { data, error } = await ctx.supabase.rpc("person_timeline", {
      p_key: key,
      p_limit: TIMELINE_PAGE,
      p_before: before,
      p_kinds: show === "all" ? null : [...TIMELINE_FILTER_KINDS[show]],
    });
    if (error) return { events: [], hasOlder: false, failed: true };
    return { ...asTimelinePage(data), failed: false };
  } catch {
    return { events: [], hasOlder: false, failed: true };
  }
}

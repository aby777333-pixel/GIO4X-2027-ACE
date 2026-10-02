"use server";

/**
 * Server actions for the blog's editorial calendar (/control/blog/calendar).
 *
 * The calendar changes one thing about a post: when it is published. It
 * schedules a draft, moves a scheduled post to another moment, or takes a
 * scheduled post off the calendar. It never touches the words.
 *
 * These are siblings of the actions in actions-blog.ts, not a second way
 * round them:
 *   · the same four steps: who is calling, what they may do (blog.publish for
 *     every action here), is the input acceptable, then the write AS THE
 *     SIGNED-IN USER. Row-level security and the trigger of 0011_blog.sql have
 *     the final say, and the trigger writes the audit entries;
 *   · the same question before a post is put in front of the public
 *     (blogPublishBlocker in blog-shared.ts: a body, and alt text on a cover),
 *     and the same reading of a date and time (parseWhen);
 *   · the same refresh of the public pages afterwards.
 * The difference is the answer. The calendar keeps the member of staff on the
 * page (a drop, a small confirmation, the chip moves), so these ANSWER with a
 * fixed code instead of redirecting. Nothing a caller sent, and nothing the
 * database said, is ever echoed.
 *
 * Two things the calendar deliberately does not do: it does not publish
 * immediately (a moment that has passed is refused; that is the editor's
 * "Publish"), and it does not touch a post that is already on the website.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { CalendarErrorCode, CalendarResult } from "@/components/control/views/blog-calendar-shared";
import { blogPublishBlocker, parseWhen } from "@/components/control/views/blog-shared";
import { BLOG_PATH, isLive } from "@/lib/blog";
import { BLOG_CACHE_TAG } from "@/lib/server/blog";
import { can, getAccess, SIGN_IN_PATH } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";

async function publisher() {
  const access = await getAccess();
  if (access.state === "anonymous") redirect(SIGN_IN_PATH);
  if (access.state !== "staff") redirect("/control");
  return access;
}

/** The website reads again. The same three calls as refreshPublic() in actions-blog.ts: keep the two alike. */
function refreshPublic(): void {
  revalidateTag(BLOG_CACHE_TAG);
  revalidatePath(BLOG_PATH, "layout");
  revalidatePath("/intelligence");
}

const refuse = (code: CalendarErrorCode): CalendarResult => ({ ok: false, code });

/** A database refusal as a fixed code. The only check a change of status and time can fail is the alt text of a cover. */
function dbError(code: string | undefined): CalendarErrorCode {
  if (code === "42501") return "forbidden";
  if (code === "23514") return "alt";
  return "save";
}

/**
 * Schedules a draft or a post ready for review for `day` at `time` (UTC), or
 * moves a post that is already scheduled. The moment must be in the future.
 */
export async function scheduleBlogPost(id: unknown, day: unknown, time: unknown): Promise<CalendarResult> {
  const ctx = await publisher();
  if (!isUuid(id) || typeof day !== "string" || typeof time !== "string") return refuse("invalid");
  // putting a post in front of the public, now or later, is blog.publish (the trigger refuses anyone else)
  if (!can(ctx, "blog.publish")) return refuse("forbidden");

  const now = Date.now();
  // the calendar always gives both: a date without a time would silently mean midnight
  if (day === "" || time === "") return refuse("when");
  const when = parseWhen(day, time, now);
  if (!when.ok || when.iso === null) return refuse("when");
  if (Date.parse(when.iso) <= now) return refuse("past");

  // where the post stands now, and what the publishing check needs to see
  const current = await ctx.supabase.from("blog_posts").select("id, status, published_at, body, cover_path, cover_alt").eq("id", id).maybeSingle();
  if (current.error) return refuse("save");
  if (!current.data) return refuse("gone");
  const post = current.data;
  if (post.status === "archived") return refuse("archived");
  if (isLive(post, now)) return refuse("live");
  const blocker = blogPublishBlocker(post);
  if (blocker) return refuse(blocker);
  const moving = post.status === "published";

  // .select() makes a refusal visible: a row that row-level security filters out is simply "0 rows updated"
  const { data, error } = await ctx.supabase.from("blog_posts").update({ status: "published", published_at: when.iso }).eq("id", id).select("id, published_at");
  if (error) return refuse(dbError(error.code));
  if (!data || data.length !== 1) return refuse("forbidden");

  refreshPublic();
  return { ok: true, code: moving ? "moved" : "scheduled", at: data[0].published_at };
}

/**
 * Takes a scheduled post off the calendar: it is a draft again, and its
 * publication time is cleared so that a later "Publish" in the editor does not
 * pick up a moment nobody chose.
 */
export async function unscheduleBlogPost(id: unknown): Promise<CalendarResult> {
  const ctx = await publisher();
  if (!isUuid(id)) return refuse("invalid");
  if (!can(ctx, "blog.publish")) return refuse("forbidden");

  const now = Date.now();
  const current = await ctx.supabase.from("blog_posts").select("id, status, published_at").eq("id", id).maybeSingle();
  if (current.error) return refuse("save");
  if (!current.data) return refuse("gone");
  if (current.data.status !== "published") return refuse("unscheduled");
  // its time came while the calendar was open: withdrawing a post the public can read is the editor's "Unpublish"
  if (isLive(current.data, now)) return refuse("live");

  const { data, error } = await ctx.supabase.from("blog_posts").update({ status: "draft", published_at: null }).eq("id", id).select("id");
  if (error) return refuse(dbError(error.code));
  if (!data || data.length !== 1) return refuse("forbidden");

  // it was 'published' (with a time to come): the public pages are told, as after any change to a published post
  refreshPublic();
  return { ok: true, code: "unscheduled", at: null };
}

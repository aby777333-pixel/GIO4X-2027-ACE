"use server";

/**
 * Reads the words of a post's revisions for the editor's "compare" view.
 *
 * The editor's page lists a post's revisions without their words (fifty
 * bodies of up to 60,000 characters each have no business in a page that may
 * never be asked to compare anything). When two are chosen, their words are
 * read here: as the signed-in member of staff, so the policy on
 * `blog_revisions` (0020_blog_revisions.sql: blog.read) decides.
 *
 * It changes nothing. Restoring a revision is not an action at all: the
 * editor copies the words into its own fields as unsaved changes, and the
 * ordinary save, with its ordinary rules, does the rest.
 */
import { redirect } from "next/navigation";
import { BLOG_REVISION_TEXT_COLUMNS, type BlogRevisionErrorCode, type BlogRevisionResult } from "@/components/control/views/blog-revisions-shared";
import { can, getAccess, SIGN_IN_PATH } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";

const refuse = (code: BlogRevisionErrorCode): BlogRevisionResult => ({ ok: false, code });

/** A comparison is of two revisions: one or two numbers, each a whole number a revision can have. */
function readNumbers(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) return null;
  const numbers: number[] = [];
  for (const n of value as unknown[]) {
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 2_000_000_000) return null;
    if (!numbers.includes(n)) numbers.push(n);
  }
  return numbers;
}

export async function readBlogRevisions(postId: unknown, revisions: unknown): Promise<BlogRevisionResult> {
  const access = await getAccess();
  if (access.state === "anonymous") redirect(SIGN_IN_PATH);
  if (access.state !== "staff") redirect("/control");

  const numbers = readNumbers(revisions);
  if (!isUuid(postId) || !numbers) return refuse("invalid");
  if (!can(access, "blog.read")) return refuse("forbidden");

  const { data, error } = await access.supabase.from("blog_revisions").select(BLOG_REVISION_TEXT_COLUMNS).eq("post_id", postId).in("revision", numbers);
  if (error) return refuse(error.code === "42501" ? "forbidden" : "read");
  // fewer rows than asked for: a revision was trimmed since the list was drawn (or the policy hid it)
  if (!data || data.length !== numbers.length) return refuse("gone");
  return { ok: true, rows: data };
}

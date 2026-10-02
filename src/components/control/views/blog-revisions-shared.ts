/**
 * What the editor's revision history and the action that reads a revision
 * share: the columns, the fixed outcome codes with their words, and how a
 * list of changed fields is said in a sentence.
 *
 * Revisions are rows of `blog_revisions` (supabase/migrations/0020_blog_revisions.sql),
 * written by a trigger each time a post's words change. The console only
 * reads them. Pure: nothing here reads the database, the clock or the browser.
 */
import type { BlogRevisionField, BlogRevisionRow } from "@/lib/supabase/types";

/** How many revisions of a post the database keeps (`keep` in blog_posts_keep_revision), not counting those kept for a publication. */
export const BLOG_REVISIONS_KEPT = 50;
/** A bound on what the editor's page reads: the kept 50 and the publications beyond them. */
export const BLOG_REVISIONS_MAX = 200;

/** What the list needs of a revision. The words themselves are read only when two revisions are compared. */
export const BLOG_REVISION_LIST_COLUMNS = "revision, saved_at, saved_by, status, changed, at_publication";
export type BlogRevisionListRow = Pick<BlogRevisionRow, "revision" | "saved_at" | "saved_by" | "status" | "changed" | "at_publication">;

/** A revision as the list shows it: who saved it is already a name (or "You"), never an id. */
export type BlogRevisionMeta = Omit<BlogRevisionListRow, "saved_by"> & { by: string };

/** The words of one revision: the five fields a revision records. */
export const BLOG_REVISION_TEXT_COLUMNS = "revision, title, excerpt, body, seo_title, seo_description";
export type BlogRevisionText = Pick<BlogRevisionRow, "revision" | "title" | "excerpt" | "body" | "seo_title" | "seo_description">;
export type BlogRevisionWords = Omit<BlogRevisionText, "revision">;

export const BLOG_REVISION_FIELDS = ["title", "excerpt", "body", "seo_title", "seo_description"] as const satisfies readonly BlogRevisionField[];

export const BLOG_REVISION_FIELD_LABEL: Record<BlogRevisionField, string> = {
  title: "Title",
  excerpt: "Excerpt",
  body: "Body",
  seo_title: "SEO title",
  seo_description: "Meta description",
};

/** The same names inside a sentence. */
const IN_A_SENTENCE: Record<BlogRevisionField, string> = {
  title: "title",
  excerpt: "excerpt",
  body: "body",
  seo_title: "SEO title",
  seo_description: "meta description",
};

const isField = (value: unknown): value is BlogRevisionField => typeof value === "string" && (BLOG_REVISION_FIELDS as readonly string[]).includes(value);

/**
 * What changed in a revision, in words: "body", "title and excerpt",
 * "title, excerpt and body". A revision with nothing listed is the first one
 * recorded for its post: there was nothing before it to differ from.
 */
export function changedNote(changed: readonly unknown[]): string {
  // in the order the editor shows the fields, whatever order the database listed them in
  const names = BLOG_REVISION_FIELDS.filter((f) => changed.some((c) => isField(c) && c === f)).map((f) => IN_A_SENTENCE[f]);
  if (names.length === 0) return "first recorded version";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export const BLOG_REVISION_ERRORS = {
  invalid: "That request was not valid.",
  forbidden: "Your role cannot read revisions.",
  gone: "That revision is no longer kept. The latest 50 of a post are kept, and the one that was current at each publication.",
  read: "The revision could not be read. Try again.",
} as const;
export type BlogRevisionErrorCode = keyof typeof BLOG_REVISION_ERRORS;

export type BlogRevisionResult = { ok: true; rows: BlogRevisionText[] } | { ok: false; code: BlogRevisionErrorCode };

/** Reads the words of up to two revisions of one post. The editor is handed the real action, or a stand-in. */
export type LoadRevisions = (postId: string, revisions: number[]) => Promise<BlogRevisionResult>;

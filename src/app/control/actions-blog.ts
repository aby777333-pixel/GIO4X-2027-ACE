"use server";

/**
 * Server actions for the Blog in GIO4X Control.
 *
 * The same four steps as src/app/control/actions.ts: who is calling, what they
 * may do, is every field on the allow-list and inside its limit, then the
 * write AS THE SIGNED-IN USER. Column grants, row-level security, the checks
 * and the trigger `blog_posts_before_write` in supabase/migrations/0011_blog.sql
 * have the final say: only blog.publish may put words in front of the public,
 * change them once they are there, or take them away. The trigger also writes
 * who and when, and the audit entries.
 *
 * Two kinds of outcome:
 *   · createBlogPost and saveBlogPost carry a whole post, up to 60,000
 *     characters of it. When they refuse, they ANSWER with a fixed code (and
 *     the names of the fields to look at) instead of redirecting, so the
 *     editor keeps what was typed. On success they redirect with a fixed code.
 *   · setBlogStatus and saveBlogCorrection carry a few values and redirect
 *     with a fixed code either way, as every other Control action does.
 * Nothing a caller typed, and nothing the database said, is ever echoed.
 *
 * The public blog pages keep what they read for about a minute (the cache
 * tagged BLOG_CACHE_TAG in src/lib/server/blog.ts). Every action that changes
 * what the public can see tells Next.js to read again, so a publication, a
 * withdrawal or a correction shows at once.
 *
 * Only text travels through these actions. Pictures go through the route
 * handler at /control/blog/upload, and arrive here as paths in the bucket.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  BLOG_INTENTS,
  blogDbError,
  DEFAULT_BYLINE,
  intentStatus,
  isCanonical,
  parseTags,
  parseWhen,
  type BlogErrorCode,
  type BlogFormState,
  type BlogIntent,
} from "@/components/control/views/blog-shared";
import { BLOG_CATEGORIES, BLOG_LIMITS, BLOG_PATH, BLOG_STATUSES, isBlogImagePath, isBlogSlug } from "@/lib/blog";
import { BLOG_CACHE_TAG } from "@/lib/server/blog";
import { can, getAccess, SIGN_IN_PATH } from "@/lib/server/staff";
import { cleanLine, cleanText, isUuid } from "@/lib/server/validate";
import type { BlogCategory, BlogStatus } from "@/lib/supabase/types";

const LIST = "/control/blog";

async function writer() {
  const access = await getAccess();
  if (access.state === "anonymous") redirect(SIGN_IN_PATH);
  if (access.state !== "staff") redirect("/control");
  return access;
}

/**
 * The website reads again: the cached lists, every page under the blog (the
 * list, each post, the feed), and the Intelligence page that shows the latest
 * posts. Called after a write that touched a post the public can see, or could
 * see a moment ago.
 */
function refreshPublic(): void {
  revalidateTag(BLOG_CACHE_TAG);
  revalidatePath(BLOG_PATH, "layout");
  revalidatePath("/intelligence");
}

function isCategory(value: unknown): value is BlogCategory {
  return typeof value === "string" && (BLOG_CATEGORIES as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is BlogStatus {
  return typeof value === "string" && (BLOG_STATUSES as readonly string[]).includes(value);
}

function isIntent(value: unknown): value is BlogIntent {
  return typeof value === "string" && (BLOG_INTENTS as readonly string[]).includes(value);
}

const text = (formData: FormData, name: string): string => {
  const raw = formData.get(name);
  return typeof raw === "string" ? raw : "";
};
const line = (formData: FormData, name: string): string => cleanLine(text(formData, name));

type Fields = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: BlogCategory;
  tags: string[];
  byline: string;
  seo_title: string;
  seo_description: string;
  canonical_url: string;
  noindex: boolean;
  og_image_path: string;
  cover_path: string;
  cover_alt: string;
  cover_caption: string;
  cover_credit: string;
  cover_width: number | null;
  cover_height: number | null;
};

/** A picture's side in pixels: empty is "not known", otherwise a whole number the database accepts. */
function readSize(raw: string): { ok: true; value: number | null } | { ok: false } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: null };
  if (!/^\d{1,5}$/.test(t)) return { ok: false };
  const n = Number(t);
  return n >= 1 && n <= 10000 ? { ok: true, value: n } : { ok: false };
}

/**
 * Every field of the form, normalised and measured against BLOG_LIMITS (which
 * mirror the checks in 0011). `bad` names the fields that are not acceptable;
 * the names are this file's own, never anything the caller sent.
 */
function readFields(formData: FormData): { values: Fields; bad: string[] } {
  const bad: string[] = [];

  const title = line(formData, "title");
  if (title.length < 3 || title.length > BLOG_LIMITS.title) bad.push("title");

  const slug = text(formData, "slug").trim().toLowerCase();
  if (!isBlogSlug(slug)) bad.push("slug");

  const excerpt = line(formData, "excerpt");
  if (excerpt.length > BLOG_LIMITS.excerpt) bad.push("excerpt");

  const body = cleanText(text(formData, "body"));
  if (body.length > BLOG_LIMITS.body) bad.push("body");

  const categoryRaw = formData.get("category");
  const category: BlogCategory = isCategory(categoryRaw) ? categoryRaw : "market-notes";
  if (!isCategory(categoryRaw)) bad.push("category");

  const parsedTags = parseTags(cleanLine(text(formData, "tags")));
  if (parsedTags.problem) bad.push("tags");

  const byline = line(formData, "byline") || DEFAULT_BYLINE;
  if (byline.length < 2 || byline.length > BLOG_LIMITS.byline) bad.push("byline");

  const seoTitle = line(formData, "seo_title");
  if (seoTitle.length > BLOG_LIMITS.seoTitle) bad.push("seo_title");
  const seoDescription = line(formData, "seo_description");
  if (seoDescription.length > BLOG_LIMITS.seoDescription) bad.push("seo_description");

  const canonical = text(formData, "canonical_url").trim();
  if (!isCanonical(canonical)) bad.push("canonical_url");

  const ogPath = text(formData, "og_image_path").trim();
  if (ogPath !== "" && !isBlogImagePath(ogPath)) bad.push("og_image_path");
  const coverPath = text(formData, "cover_path").trim();
  if (coverPath !== "" && !isBlogImagePath(coverPath)) bad.push("cover_path");

  const coverAlt = line(formData, "cover_alt");
  if (coverAlt.length > BLOG_LIMITS.coverAlt) bad.push("cover_alt");
  const coverCaption = line(formData, "cover_caption");
  if (coverCaption.length > BLOG_LIMITS.coverCaption) bad.push("cover_caption");
  const coverCredit = line(formData, "cover_credit");
  if (coverCredit.length > BLOG_LIMITS.coverCredit) bad.push("cover_credit");

  const width = readSize(text(formData, "cover_width"));
  if (!width.ok) bad.push("cover_width");
  const height = readSize(text(formData, "cover_height"));
  if (!height.ok) bad.push("cover_height");
  // a size describes a picture: without a cover there is nothing to measure
  const hasCover = coverPath !== "";

  return {
    bad,
    values: {
      slug,
      title,
      excerpt,
      body,
      category,
      tags: parsedTags.tags,
      byline,
      seo_title: seoTitle,
      seo_description: seoDescription,
      canonical_url: canonical,
      noindex: formData.get("noindex") === "1",
      og_image_path: ogPath,
      cover_path: coverPath,
      cover_alt: coverAlt,
      cover_caption: coverCaption,
      cover_credit: coverCredit,
      cover_width: hasCover && width.ok ? width.value : null,
      cover_height: hasCover && height.ok ? height.value : null,
    },
  };
}

/** What must be true of a post before it can be in front of the public. The database repeats the alt-text rule. */
function publishProblem(values: Fields): BlogFormState | null {
  if (values.cover_path !== "" && values.cover_alt.length < 3) return { error: "alt", fields: ["cover_alt"] };
  if (values.body === "") return { error: "check", fields: ["body"] };
  return null;
}

const refuse = (error: BlogErrorCode, fields?: string[]): BlogFormState => (fields?.length ? { error, fields } : { error });

/* -------------------------------------------------------------------------- */
/* create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createBlogPost(_prev: BlogFormState, formData: FormData): Promise<BlogFormState> {
  const ctx = await writer();
  // the insert policy asks for blog.write, whatever else the caller holds
  if (!can(ctx, "blog.write")) return refuse("forbidden");

  const intent = formData.get("intent");
  if (!isIntent(intent) || intent === "keep") return refuse("invalid");
  const status = intentStatus(intent, "draft");
  const mayPublish = can(ctx, "blog.publish");
  if (status === "published" && !mayPublish) return refuse("forbidden");

  const { values, bad } = readFields(formData);
  if (bad.length) return refuse("check", bad);

  const now = Date.now();
  // a publication time is the publisher's to set: a writer's form does not carry one
  let publishedAt: string | null = null;
  if (mayPublish) {
    const when = parseWhen(text(formData, "published_date"), text(formData, "published_time"), now);
    if (!when.ok) return refuse("when", ["published_at"]);
    publishedAt = when.iso;
  }
  if (status === "published") {
    const problem = publishProblem(values);
    if (problem) return problem;
    // no time given: now. A time in the future schedules the post.
    publishedAt ??= new Date(now).toISOString();
  }

  // created_by, updated_by and the timestamps are not sent: the trigger sets them to the caller and the clock
  const { data, error } = await ctx.supabase
    .from("blog_posts")
    .insert({ ...values, status, published_at: publishedAt })
    .select("id");
  if (error) return refuse(blogDbError(error.code), error.code === "23505" ? ["slug"] : undefined);
  const id = data?.[0]?.id;
  if (!data || data.length !== 1 || !isUuid(id)) return refuse("save");

  if (status === "published") refreshPublic();
  const notice = status !== "published" ? "created" : publishedAt && Date.parse(publishedAt) > now ? "scheduled" : "published";
  redirect(`${LIST}/${id}?notice=${notice}`);
}

/* -------------------------------------------------------------------------- */
/* save                                                                       */
/* -------------------------------------------------------------------------- */

export async function saveBlogPost(_prev: BlogFormState, formData: FormData): Promise<BlogFormState> {
  const ctx = await writer();
  const id = formData.get("id");
  const intent = formData.get("intent");
  if (!isUuid(id) || !isIntent(intent)) return refuse("invalid");
  const mayWrite = can(ctx, "blog.write");
  const mayPublish = can(ctx, "blog.publish");
  if (!mayWrite && !mayPublish) return refuse("forbidden");

  // where the post stands now decides what this caller may do to it
  const current = await ctx.supabase.from("blog_posts").select("id, status, published_at").eq("id", id).maybeSingle();
  if (current.error) return refuse("save");
  if (!current.data) return refuse("gone");
  const was = current.data.status;
  const status = intentStatus(intent, was);

  // published or archived, before or after: that is blog.publish (the trigger refuses anyone else)
  const publicMatter = was === "published" || was === "archived" || status === "published" || status === "archived";
  if (publicMatter && !mayPublish) return refuse("forbidden");

  const { values, bad } = readFields(formData);
  if (bad.length) return refuse("check", bad);

  const now = Date.now();
  // undefined: leave the stored time as it is
  let publishedAt: string | null | undefined;
  if (mayPublish) {
    const when = parseWhen(text(formData, "published_date"), text(formData, "published_time"), now);
    if (!when.ok) return refuse("when", ["published_at"]);
    if (status !== "published") publishedAt = when.iso;
    else if (when.iso) publishedAt = when.iso;
    // publishing with no time given is "now"; a post already published keeps the time it has
    else if (was !== "published") publishedAt = new Date(now).toISOString();
  }
  if (status === "published") {
    const problem = publishProblem(values);
    if (problem) return problem;
  }

  // .select() makes a refusal visible: a row that row-level security filters out is simply "0 rows updated"
  const { data, error } = await ctx.supabase
    .from("blog_posts")
    .update({ ...values, status, ...(publishedAt === undefined ? {} : { published_at: publishedAt }) })
    .eq("id", id)
    .select("id, published_at");
  if (error) return refuse(blogDbError(error.code), error.code === "23505" ? ["slug"] : undefined);
  if (!data || data.length !== 1) return refuse("forbidden");

  if (was === "published" || status === "published") refreshPublic();
  let notice = "saved";
  if (status !== was) {
    const at = data[0].published_at;
    notice = status === "published" ? (at && Date.parse(at) > now ? "scheduled" : "published") : status;
  }
  redirect(`${LIST}/${id}?notice=${notice}`);
}

/* -------------------------------------------------------------------------- */
/* status alone                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Moves a saved post to another status without touching its words: unpublish
 * (back to draft), archive, send for review, publish as it stands. Publishing
 * this way uses the publication time already stored on the post, or now when
 * there is none (the trigger fills it in); a time in the future schedules it.
 */
export async function setBlogStatus(formData: FormData): Promise<void> {
  const ctx = await writer();
  const id = formData.get("id");
  const to = formData.get("status");
  if (!isUuid(id)) redirect(`${LIST}?error=invalid`);
  const back = `${LIST}/${id}`;
  if (!isStatus(to)) redirect(`${back}?error=invalid`);
  const mayPublish = can(ctx, "blog.publish");
  if (!mayPublish && !can(ctx, "blog.write")) redirect(`${back}?error=forbidden`);

  const current = await ctx.supabase.from("blog_posts").select("id, status").eq("id", id).maybeSingle();
  if (current.error) redirect(`${back}?error=save`);
  if (!current.data) redirect(`${LIST}?error=gone`);
  const was = current.data.status;
  if (was === to) redirect(`${back}?error=invalid`);
  const publicMatter = was === "published" || was === "archived" || to === "published" || to === "archived";
  if (publicMatter && !mayPublish) redirect(`${back}?error=forbidden`);

  const { data, error } = await ctx.supabase.from("blog_posts").update({ status: to }).eq("id", id).select("id, published_at");
  if (error) redirect(`${back}?error=${blogDbError(error.code)}`);
  if (!data || data.length !== 1) redirect(`${back}?error=forbidden`);

  if (was === "published" || to === "published") refreshPublic();
  const at = data[0].published_at;
  const notice = to === "published" ? (at && Date.parse(at) > Date.now() ? "scheduled" : "published") : to === "draft" && was === "published" ? "unpublished" : to;
  redirect(`${back}?notice=${notice}`);
}

/* -------------------------------------------------------------------------- */
/* correction                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The note a reader sees when a published post was materially changed, and the
 * date of that change. The site's rule (Editorial standards) is that such a
 * change is noted on the post with its date, so a date is never set without
 * words saying what changed.
 */
export async function saveBlogCorrection(formData: FormData): Promise<void> {
  const ctx = await writer();
  const id = formData.get("id");
  if (!isUuid(id)) redirect(`${LIST}?error=invalid`);
  const back = `${LIST}/${id}`;
  // a correction changes a published post: blog.publish
  if (!can(ctx, "blog.publish")) redirect(`${back}?error=forbidden`);

  const note = line(formData, "correction_note");
  if (note.length > BLOG_LIMITS.correction) redirect(`${back}?error=check#correction`);
  const markNow = formData.get("corrected_now") === "1";
  const clear = formData.get("corrected_clear") === "1";
  if (markNow && clear) redirect(`${back}?error=invalid#correction`);
  if (markNow && note.length < 3) redirect(`${back}?error=note#correction`);

  const current = await ctx.supabase.from("blog_posts").select("id, status").eq("id", id).maybeSingle();
  if (current.error) redirect(`${back}?error=save#correction`);
  if (!current.data) redirect(`${LIST}?error=gone`);
  // a draft has no readers to tell
  if (current.data.status !== "published") redirect(`${back}?error=invalid#correction`);

  const { data, error } = await ctx.supabase
    .from("blog_posts")
    .update({ correction_note: note, ...(markNow ? { corrected_at: new Date().toISOString() } : clear ? { corrected_at: null } : {}) })
    .eq("id", id)
    .select("id");
  if (error) redirect(`${back}?error=${blogDbError(error.code)}#correction`);
  if (!data || data.length !== 1) redirect(`${back}?error=forbidden#correction`);
  refreshPublic();
  redirect(`${back}?notice=correction#correction`);
}

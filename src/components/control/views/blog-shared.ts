/**
 * What the blog's console screens and its server actions share: the rules that
 * must read the same on both sides (tags, the address of a post, where a post
 * stands), the fixed outcome codes, and the editorial checklist.
 *
 * Pure functions only: nothing here reads the database, the clock or the
 * browser, so the same code runs in the editor as the writer types and in the
 * action when the form arrives.
 */
import { BLOG_LIMITS, isBlogImagePath } from "@/lib/blog";
import type { BlogPostRow, BlogStatus } from "@/lib/supabase/types";

/* -------------------------------------------------------------------------- */
/* where a post stands                                                        */
/* -------------------------------------------------------------------------- */

/** The five things a post can be in the console: "published" splits by whether its time has come. */
export type BlogState = "draft" | "review" | "scheduled" | "live" | "archived";

export const BLOG_STATE_LABEL: Record<BlogState, string> = {
  draft: "Draft",
  review: "Ready for review",
  scheduled: "Scheduled",
  live: "Published",
  archived: "Archived",
};

export function blogState(post: Pick<BlogPostRow, "status" | "published_at">, now: number): BlogState {
  if (post.status !== "published") return post.status;
  // published without a time cannot exist (blog_posts_published_evidence); treated as live if it ever did
  return post.published_at && Date.parse(post.published_at) > now ? "scheduled" : "live";
}

/** The list's status filter. "" is every post. */
export const BLOG_FILTERS = ["draft", "review", "scheduled", "published", "archived"] as const;
export type BlogFilter = (typeof BLOG_FILTERS)[number];

export const BLOG_FILTER_LABEL: Record<BlogFilter, string> = {
  draft: "Drafts",
  review: "Ready for review",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

/* -------------------------------------------------------------------------- */
/* outcomes                                                                   */
/* -------------------------------------------------------------------------- */

/** What the save and create actions answer with when nothing was saved. The editor keeps what was typed. */
export type BlogFormState = { error?: BlogErrorCode; fields?: readonly string[] };

export const BLOG_ERRORS = {
  invalid: "That request was not valid. Nothing was saved.",
  forbidden: "Your role cannot do that. Nothing was saved.",
  check: "Check the highlighted fields. Nothing was saved.",
  slug: "That address is already used by another post. Choose a different one. Nothing was saved.",
  alt: "A post with a cover picture cannot be published without alt text describing the picture. Nothing was saved.",
  when: "The publication date and time must be a real moment, entered in UTC. Nothing was saved.",
  gone: "This post no longer exists.",
  note: "Say what changed, in a few words, before marking the post as updated. Nothing was saved.",
  save: "The post could not be saved. Nothing was changed; please try again.",
} as const;
export type BlogErrorCode = keyof typeof BLOG_ERRORS;

/** A database refusal as a fixed code. Nothing the database said is ever shown. */
export function blogDbError(code: string | undefined): BlogErrorCode {
  if (code === "23505") return "slug";
  if (code === "23514") return "check";
  if (code === "42501") return "forbidden";
  return "save";
}

/* -------------------------------------------------------------------------- */
/* fields                                                                     */
/* -------------------------------------------------------------------------- */

export const DEFAULT_BYLINE = "GIO4X Editorial Desk";

/** Letters and digits first, then letters, digits, spaces, and a few joining marks. */
const TAG = /^[\p{L}\p{N}][\p{L}\p{N} &+.-]*$/u;

/**
 * Tags as typed (comma separated) to tags as stored: trimmed, lower-cased,
 * single-spaced, without repeats. `problem` says in words why the list cannot
 * be saved, or is empty when it can.
 */
export function parseTags(raw: string): { tags: string[]; problem: string } {
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > BLOG_LIMITS.tags) return { tags, problem: `At most ${BLOG_LIMITS.tags} tags.` };
  if (tags.some((t) => t.length > BLOG_LIMITS.tag)) return { tags, problem: `Each tag can be at most ${BLOG_LIMITS.tag} characters.` };
  if (tags.some((t) => !TAG.test(t))) return { tags, problem: "A tag is made of letters, digits, spaces and hyphens." };
  return { tags, problem: "" };
}

/** A canonical address: empty, a path on this site, or an https address. Stricter than the database (no "//host"). */
export function isCanonical(value: string): boolean {
  if (value === "") return true;
  // no spaces and no control characters: an address is typed, not smuggled
  if (value.length > BLOG_LIMITS.canonical || /[\s\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//") && !value.includes("\\");
  if (!value.startsWith("https://")) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * A moment from the form's UTC date and time fields. Both empty is "no time
 * given" (null). A date without a time is midnight. Anything that is not a real
 * moment between 2020 and five years from `now` is refused.
 */
export function parseWhen(date: string, time: string, now: number): { ok: true; iso: string | null } | { ok: false } {
  if (!date && !time) return { ok: true, iso: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false };
  const clock = time === "" ? "00:00" : time;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) return { ok: false };
  const at = new Date(`${date}T${clock}:00Z`);
  // "2026-02-31" parses to March: a date that does not survive the round trip is not a date
  if (Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== date) return { ok: false };
  if (at.getTime() < Date.UTC(2020, 0, 1) || at.getTime() > now + 5 * 366 * 24 * 60 * 60 * 1000) return { ok: false };
  return { ok: true, iso: at.toISOString() };
}

/* -------------------------------------------------------------------------- */
/* previews                                                                   */
/* -------------------------------------------------------------------------- */

/** About where a search engine cuts a result's title and description. */
export const SEARCH_TITLE_LENGTH = 60;
export const SEARCH_DESCRIPTION_LENGTH = 160;

/** Cut the way a search result is: at a word, with an ellipsis. */
export function cutForSearch(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/, "")}…`;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/* -------------------------------------------------------------------------- */
/* the editorial checklist                                                    */
/* -------------------------------------------------------------------------- */

export type BlogDraft = {
  title: string;
  excerpt: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  coverPath: string;
  coverAlt: string;
  coverCaption: string;
};

export type BlogFlag = { key: string; text: string };

export const MIN_BODY_WORDS = 150;

/** Wording the site's editorial standards rule out: promises and trading calls. */
const RULED_OUT: readonly { label: string; pattern: RegExp }[] = [
  { label: "guaranteed", pattern: /\bguaranteed\b/i },
  { label: "risk-free", pattern: /\brisk[\s-]?free\b/i },
  { label: "buy now", pattern: /\bbuy\s+now\b/i },
  { label: "sell now", pattern: /\bsell\s+now\b/i },
  { label: "will rise", pattern: /\bwill\s+rise\b/i },
  { label: "will fall", pattern: /\bwill\s+fall\b/i },
  { label: "sure profit", pattern: /\bsure\s+profits?\b/i },
];

/** The same rule BlogBody applies before it makes a link: a path on this site, or https. */
const SAFE_HREF = /^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/;
const LINK = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/**
 * Reads a draft and says, in plain words, what an editor would point at.
 * Nothing here stops a save: the database enforces what must be enforced
 * (alt text on a published cover), the rest is judgement.
 */
export function blogChecks(draft: BlogDraft): BlogFlag[] {
  const flags: BlogFlag[] = [];

  if (!draft.excerpt.trim()) flags.push({ key: "excerpt", text: "There is no excerpt. It is the summary shown in the list of posts and, unless a meta description is written, in search results." });

  if (draft.coverPath && draft.coverAlt.trim().length < 3) flags.push({ key: "alt", text: "The cover picture has no alt text. The post cannot be published until the picture is described for people who cannot see it." });

  const searchTitle = (draft.seoTitle.trim() || draft.title.trim()).length;
  if (searchTitle > SEARCH_TITLE_LENGTH)
    flags.push({ key: "title", text: `The title shown in search results is ${searchTitle} characters. About ${SEARCH_TITLE_LENGTH} are shown; the rest is cut. Write a shorter SEO title.` });

  const searchDescription = (draft.seoDescription.trim() || draft.excerpt.trim()).length;
  if (searchDescription > SEARCH_DESCRIPTION_LENGTH)
    flags.push({ key: "description", text: `The description shown in search results is ${searchDescription} characters. About ${SEARCH_DESCRIPTION_LENGTH} are shown; the rest is cut. Write a shorter meta description.` });

  const words = wordCount(draft.body);
  if (words < MIN_BODY_WORDS) flags.push({ key: "body", text: `The body is ${words} ${words === 1 ? "word" : "words"} long. Under ${MIN_BODY_WORDS} words is thin for a post.` });

  let badLinks = 0;
  let badPictures = 0;
  for (const m of draft.body.matchAll(LINK)) {
    if (m[1] === "!") {
      if (!isBlogImagePath(m[3])) badPictures++;
    } else if (!SAFE_HREF.test(m[3])) badLinks++;
  }
  if (badLinks)
    flags.push({
      key: "links",
      text: `${badLinks === 1 ? "One link points" : `${badLinks} links point`} to an address that is neither a page on this site (starting with /) nor an https address. ${badLinks === 1 ? "It is" : "They are"} shown to readers as plain text, not as a link.`,
    });
  if (badPictures)
    flags.push({
      key: "pictures",
      text: `${badPictures === 1 ? "One picture in the body is" : `${badPictures} pictures in the body are`} not in the blog’s picture store. Only pictures uploaded here are shown; use the Picture button.`,
    });

  const everything = [draft.title, draft.excerpt, draft.body, draft.seoTitle, draft.seoDescription, draft.coverCaption].join("\n");
  const found = RULED_OUT.filter((w) => w.pattern.test(everything)).map((w) => `“${w.label}”`);
  if (found.length)
    flags.push({
      key: "wording",
      text: `The draft uses ${found.join(", ")}. The site does not publish trading recommendations or promises about what a market or an account will do. Rewrite the sentence.`,
    });

  return flags;
}

/** The status a save intent leads to. "keep" leaves the post where it is. */
export const BLOG_INTENTS = ["keep", "draft", "review", "publish"] as const;
export type BlogIntent = (typeof BLOG_INTENTS)[number];

export function intentStatus(intent: BlogIntent, current: BlogStatus): BlogStatus {
  return intent === "keep" ? current : intent === "publish" ? "published" : intent;
}

/* -------------------------------------------------------------------------- */
/* before a post can be in front of the public                                */
/* -------------------------------------------------------------------------- */

export type BlogPublishBlocker = "alt" | "body";

/**
 * What stops a post from being published or scheduled, or null when nothing
 * does: a cover picture needs alt text (the database repeats this rule), and a
 * post needs a body. One rule for every way of publishing: the editor's save
 * (actions-blog.ts) and the calendar (actions-blog-calendar.ts) both ask here.
 */
export function blogPublishBlocker(post: { cover_path: string; cover_alt: string; body: string }): BlogPublishBlocker | null {
  if (post.cover_path !== "" && post.cover_alt.trim().length < 3) return "alt";
  if (post.body.trim() === "") return "body";
  return null;
}

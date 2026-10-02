"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createBlogPost, saveBlogCorrection, saveBlogPost, setBlogStatus } from "@/app/control/actions-blog";
import { readBlogRevisions } from "@/app/control/actions-blog-revisions";
import { BlogBody } from "@/components/blog/BlogBody";
import { Notice } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { LibraryButton, type LibraryChoice } from "@/components/control/MediaPicker";
import { SubmitButton } from "@/components/control/SubmitButton";
import { BlogHistory } from "@/components/control/views/BlogHistory";
import { BlogStateBadge } from "@/components/control/views/BlogListView";
import type { BlogRevisionMeta, BlogRevisionWords, LoadRevisions } from "@/components/control/views/blog-revisions-shared";
import {
  BLOG_ERRORS,
  blogChecks,
  blogState,
  cutForSearch,
  DEFAULT_BYLINE,
  isCanonical,
  parseTags,
  parseWhen,
  SEARCH_DESCRIPTION_LENGTH,
  SEARCH_TITLE_LENGTH,
  wordCount,
  type BlogFormState,
} from "@/components/control/views/blog-shared";
import { BLOG_CATEGORIES, BLOG_CATEGORY_LABEL, BLOG_IMAGE_TYPES, BLOG_LIMITS, BLOG_PATH, blogImageUrl, isBlogSlug, readingMinutes, slugify } from "@/lib/blog";
import type { BlogCategory, BlogPostRow } from "@/lib/supabase/types";

const STANDARDS_PATH = "/trust/editorial-standards";
const UPLOAD_PATH = "/control/blog/upload";
const NO_STATE: BlogFormState = {};

export type BlogEditorProps = {
  /** null: a post that does not exist yet */
  post: BlogPostRow | null;
  /** may create drafts and edit what is not published (blog.write) */
  canWrite: boolean;
  /** may publish, unpublish, archive, and edit a published post (blog.publish) */
  canPublish: boolean;
  /** rendered-at time: decides "scheduled" against "published" */
  now: number;
  /** the website's origin, for the previews */
  siteUrl: string;
  /**
   * The post's revisions (0020), newest first, for the "History of the text" panel; `revisions: null` when
   * they could not be read. Left out, no panel is drawn. `load` reads a revision's words and is the
   * server action unless a stand-in is given.
   */
  history?: { revisions: BlogRevisionMeta[] | null; load?: LoadRevisions };
};

/** Everything being typed. Saved values arrive in `post`; saving is the server action's job. */
type Values = {
  title: string;
  slug: string;
  excerpt: string;
  category: BlogCategory;
  tags: string;
  byline: string;
  body: string;
  coverPath: string;
  coverAlt: string;
  coverCaption: string;
  coverCredit: string;
  coverWidth: string;
  coverHeight: string;
  seoTitle: string;
  seoDescription: string;
  canonical: string;
  noindex: boolean;
  ogPath: string;
  publishedDate: string;
  publishedTime: string;
};

function initialValues(post: BlogPostRow | null): Values {
  const at = post?.published_at ? new Date(post.published_at) : null;
  const iso = at && !Number.isNaN(at.getTime()) ? at.toISOString() : "";
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    category: post?.category ?? "market-notes",
    tags: (post?.tags ?? []).join(", "),
    byline: post?.byline ?? DEFAULT_BYLINE,
    body: post?.body ?? "",
    coverPath: post?.cover_path ?? "",
    coverAlt: post?.cover_alt ?? "",
    coverCaption: post?.cover_caption ?? "",
    coverCredit: post?.cover_credit ?? "",
    coverWidth: post?.cover_width ? String(post.cover_width) : "",
    coverHeight: post?.cover_height ? String(post.cover_height) : "",
    seoTitle: post?.seo_title ?? "",
    seoDescription: post?.seo_description ?? "",
    canonical: post?.canonical_url ?? "",
    noindex: post?.noindex ?? false,
    ogPath: post?.og_image_path ?? "",
    publishedDate: iso.slice(0, 10),
    publishedTime: iso.slice(11, 16),
  };
}

/* -------------------------------------------------------------------------- */
/* small parts                                                                */
/* -------------------------------------------------------------------------- */

function Card({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="gxc-card min-w-0 scroll-mt-[5rem]">
      <div className="gxc-card-head">
        <h2 id={`${id}-h`} className="gxc-card-title">
          {title}
        </h2>
        {aside}
      </div>
      <div className="gxc-card-body">{children}</div>
    </section>
  );
}

/** Characters used against the limit, in figures and, when over, in words. */
function Count({ value, max, name }: { value: string; max: number; name: string }) {
  const n = value.length;
  const over = n > max;
  return (
    <span data-count={name} className={`num shrink-0 whitespace-nowrap ${over ? "font-semibold text-neg" : ""}`}>
      {n.toLocaleString("en-GB")} / {max.toLocaleString("en-GB")}
      {over ? " · too long" : ""}
    </span>
  );
}

/** The plain-words line under a field, with the character count at its end. */
function Hint({ id, children, count }: { id: string; children: ReactNode; count?: ReactNode }) {
  return (
    <div id={id} className="flex items-start justify-between gap-13 text-xs text-ink-3">
      <p className="min-w-0">{children}</p>
      {count}
    </div>
  );
}

function NewTab({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="link">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* uploading a picture                                                        */
/* -------------------------------------------------------------------------- */

type UploadState = { phase: "idle" | "busy" | "done" | "error"; message: string };
const IDLE: UploadState = { phase: "idle", message: "" };
type Uploaded = { path: string; width: number | null; height: number | null };

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** The picture's size in pixels, read in the browser. Null when this browser cannot decode the file (it is still uploaded). */
async function pictureSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size.width > 0 && size.height > 0 ? size : null;
  } catch {
    return null;
  }
}

function uploadAnswer(value: unknown): { path: string } | { error: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as { ok?: unknown; path?: unknown; error?: unknown };
  if (v.ok === true && typeof v.path === "string") return { path: v.path };
  if (v.ok === false && typeof v.error === "string") return { error: v.error };
  return null;
}

/**
 * Sends one picture to the upload route and says, in words, how it is going.
 * The checks here only save a round trip: the route repeats them, reads the
 * file's own bytes, and decides the path. The file's name is never sent on.
 */
async function uploadPicture(file: File, report: (state: UploadState) => void): Promise<Uploaded | null> {
  if (!(BLOG_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    report({ phase: "error", message: "That file is not a JPEG, PNG, WebP or AVIF picture. SVG and GIF are not accepted." });
    return null;
  }
  if (file.size > BLOG_LIMITS.image) {
    report({ phase: "error", message: `That picture is ${megabytes(file.size)}. The limit is 4 MB: export it smaller and try again.` });
    return null;
  }
  report({ phase: "busy", message: "Reading the picture…" });
  const size = await pictureSize(file);
  report({ phase: "busy", message: `Uploading ${megabytes(file.size)}…` });
  try {
    const body = new FormData();
    // a fixed name: the route makes the stored path itself, and the file's own name is of no use to it
    body.append("file", file, "picture");
    const response = await fetch(UPLOAD_PATH, { method: "POST", body, credentials: "same-origin" });
    const answer = uploadAnswer(await response.json().catch(() => null));
    if (answer && "path" in answer) {
      report({ phase: "done", message: size ? `Uploaded: ${size.width} × ${size.height} pixels.` : "Uploaded. This browser could not read the picture’s size: enter the width and height yourself." });
      return { path: answer.path, width: size?.width ?? null, height: size?.height ?? null };
    }
    report({ phase: "error", message: answer && "error" in answer ? answer.error : "The picture could not be uploaded. Try again." });
  } catch {
    report({ phase: "error", message: "The upload did not reach the server. Check the connection and try again." });
  }
  return null;
}

/** A button that opens the file chooser, and a line that says what happened. */
function UploadButton({ id, label, state, onFile, className = "btn btn-ghost" }: { id: string; label: string; state: UploadState; onFile: (file: File) => void; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        id={id}
        type="file"
        hidden
        tabIndex={-1}
        aria-hidden
        accept={BLOG_IMAGE_TYPES.join(",")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // cleared so that choosing the same file again is still a change
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <button type="button" className={className} disabled={state.phase === "busy"} onClick={() => input.current?.click()}>
        {state.phase === "busy" ? "Uploading…" : label}
      </button>
    </>
  );
}

function UploadStatus({ state, name }: { state: UploadState; name: string }) {
  return (
    <p role="status" data-upload={name} className={`text-xs empty:hidden ${state.phase === "error" ? "font-medium text-neg" : "text-ink-3"}`}>
      {state.message}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* marks in the body                                                          */
/* -------------------------------------------------------------------------- */

type Edit = { text: string; start: number; end: number };

/** Wraps the selection (or a placeholder) in a mark, and leaves the wrapped words selected. */
function wrap(text: string, start: number, end: number, before: string, after: string, placeholder: string): Edit {
  const inner = text.slice(start, end) || placeholder;
  return { text: text.slice(0, start) + before + inner + after + text.slice(end), start: start + before.length, end: start + before.length + inner.length };
}

/** Puts a mark at the start of every line the selection touches. An empty line gets a placeholder to type over. */
function prefixLines(text: string, start: number, end: number, prefix: string, placeholder: string): Edit {
  const from = text.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = text.indexOf("\n", end);
  const to = nextBreak === -1 ? text.length : nextBreak;
  const chosen = text.slice(from, to);
  const lines = (chosen.trim() ? chosen : placeholder).split("\n").map((l) => (l.trim() ? prefix + l : l));
  const block = lines.join("\n");
  return { text: text.slice(0, from) + block + text.slice(to), start: from + prefix.length, end: from + block.length };
}

/** Puts a block on a line of its own at the cursor, and selects part of it. */
function insertBlock(text: string, at: number, block: string, selectFrom: number, selectLength: number): Edit {
  const lead = at > 0 && text[at - 1] !== "\n" ? "\n\n" : at > 1 && text[at - 2] !== "\n" ? "\n" : "";
  const rest = text.slice(at);
  const tail = rest === "" || rest.startsWith("\n\n") ? "" : rest.startsWith("\n") ? "\n" : "\n\n";
  const begin = at + lead.length + selectFrom;
  return { text: text.slice(0, at) + lead + block + tail + rest, start: begin, end: begin + selectLength };
}

const ALT_PLACEHOLDER = "Describe the picture";

const SYNTAX: { mark: string; means: string }[] = [
  { mark: "## Heading", means: "a section heading" },
  { mark: "### Smaller heading", means: "a heading inside a section" },
  { mark: "**bold**", means: "bold" },
  { mark: "*italic*", means: "italic" },
  { mark: "`code`", means: "a term shown as code" },
  { mark: "[words](/path)", means: "a link to a page on this site" },
  { mark: "[words](https://…)", means: "a link elsewhere: opens in a new tab" },
  { mark: "- item", means: "a list" },
  { mark: "1. item", means: "a numbered list" },
  { mark: "> words", means: "a quotation" },
  { mark: "---", means: "a rule across the page" },
  { mark: '![alt text](path "caption")', means: "a picture, on a line of its own" },
];

/* -------------------------------------------------------------------------- */
/* the editor                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Writes one post: its words, its cover picture and image parameters, how it
 * appears in search results and when shared, and when it is published.
 *
 * What is offered follows the role and where the post stands, as a courtesy:
 * the server actions check the role again, and the database has the final
 * say. A refusal comes back as a fixed code and the form keeps what was typed.
 */
export function BlogEditor({ post, canWrite, canPublish, now, siteUrl, history }: BlogEditorProps) {
  const start = useMemo(() => initialValues(post), [post]);
  const [values, setValues] = useState<Values>(start);
  // a new post's address follows its title until the writer types an address of their own
  const [slugOwn, setSlugOwn] = useState(post !== null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [state, formAction, pending] = useActionState(post ? saveBlogPost : createBlogPost, NO_STATE);
  const [coverUpload, setCoverUpload] = useState<UploadState>(IDLE);
  const [ogUpload, setOgUpload] = useState<UploadState>(IDLE);
  const [bodyUpload, setBodyUpload] = useState<UploadState>(IDLE);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const selection = useRef<[number, number] | null>(null);
  const problemRef = useRef<HTMLDivElement>(null);

  const stateNow = post ? blogState(post, now) : null;
  const isPublic = post?.status === "published" || post?.status === "archived";
  // published and archived posts are blog.publish's to change; everything else is a writer's too
  const editable = post ? canPublish || (canWrite && !isPublic) : canWrite;
  const ro = !editable;
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(start), [values, start]);
  const bad = useMemo(() => new Set(state.fields ?? []), [state]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));

  // The five fields a revision records, as they stand in the form now: what the history panel compares against.
  const revisionWords = useMemo<BlogRevisionWords>(
    () => ({ title: values.title, excerpt: values.excerpt, body: values.body, seo_title: values.seoTitle, seo_description: values.seoDescription }),
    [values.title, values.excerpt, values.body, values.seoTitle, values.seoDescription],
  );
  // A revision restored from the history panel: its words go into the same five fields as unsaved changes, on the
  // form's "Write" side so that they are seen. Nothing is saved here; the address, the cover and the rest are left alone.
  const restoreWords = (from: BlogRevisionWords) => {
    setValues((v) => ({ ...v, title: from.title, excerpt: from.excerpt, body: from.body, seoTitle: from.seo_title, seoDescription: from.seo_description }));
    setTab("write");
  };

  // after a toolbar button changed the body, put the cursor where the writer expects it
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !selection.current) return;
    el.focus();
    el.setSelectionRange(selection.current[0], selection.current[1]);
    selection.current = null;
  }, [values.body]);

  // a refusal: show the form (not the preview) and bring the reason into view
  useEffect(() => {
    if (!state.error) return;
    setTab("write");
    problemRef.current?.scrollIntoView({ block: "center" });
  }, [state]);

  // leaving the page with unsaved words asks first; saving navigates inside the app and does not ask
  useEffect(() => {
    if (!dirty || ro) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, ro]);

  const editBody = (change: (text: string, from: number, to: number) => Edit) => {
    const el = bodyRef.current;
    if (!el) return;
    const next = change(values.body, el.selectionStart, el.selectionEnd);
    selection.current = [next.start, next.end];
    set("body", next.text);
  };

  const onTitle = (title: string) => setValues((v) => ({ ...v, title, slug: slugOwn ? v.slug : slugify(title) }));

  const onCover = async (file: File) => {
    const done = await uploadPicture(file, setCoverUpload);
    if (!done) return;
    setValues((v) => ({ ...v, coverPath: done.path, coverWidth: done.width ? String(done.width) : "", coverHeight: done.height ? String(done.height) : "" }));
  };
  const onOg = async (file: File) => {
    const done = await uploadPicture(file, setOgUpload);
    if (done) set("ogPath", done.path);
  };
  const onBodyPicture = async (file: File) => {
    // where the cursor was when the picture was chosen
    const at = bodyRef.current?.selectionStart ?? values.body.length;
    const done = await uploadPicture(file, setBodyUpload);
    if (!done) return;
    setValues((v) => {
      const next = insertBlock(v.body, Math.min(at, v.body.length), `![${ALT_PLACEHOLDER}](${done.path})`, 2, ALT_PLACEHOLDER.length);
      selection.current = [next.start, next.end];
      return { ...v, body: next.text };
    });
  };
  const removeCover = () => {
    setValues((v) => ({ ...v, coverPath: "", coverAlt: "", coverCaption: "", coverCredit: "", coverWidth: "", coverHeight: "" }));
    setCoverUpload(IDLE);
  };

  // a picture already in the store, chosen from the library: it fills in the same fields an upload does
  const onCoverChosen = (chosen: LibraryChoice) => {
    setValues((v) => ({ ...v, coverPath: chosen.path, coverWidth: chosen.width ? String(chosen.width) : "", coverHeight: chosen.height ? String(chosen.height) : "" }));
    setCoverUpload({
      phase: "done",
      message: chosen.width && chosen.height ? `Chosen from the library: ${chosen.width} × ${chosen.height} pixels.` : "Chosen from the library. Its size could not be read here: enter the width and height yourself.",
    });
  };
  const onOgChosen = (chosen: LibraryChoice) => {
    set("ogPath", chosen.path);
    setOgUpload({ phase: "done", message: "Chosen from the library." });
  };
  const onBodyChosen = (chosen: LibraryChoice) => {
    // where the cursor was before the library opened: a textarea keeps its selection when it loses focus
    const at = bodyRef.current?.selectionStart ?? values.body.length;
    setValues((v) => {
      const next = insertBlock(v.body, Math.min(at, v.body.length), `![${ALT_PLACEHOLDER}](${chosen.path})`, 2, ALT_PLACEHOLDER.length);
      selection.current = [next.start, next.end];
      return { ...v, body: next.text };
    });
    setBodyUpload({ phase: "done", message: "Inserted from the library. Type a description of the picture over the selected words." });
  };

  /* ---- what the fields amount to ---- */
  const slugOk = isBlogSlug(values.slug);
  const tags = parseTags(values.tags);
  const canonicalOk = isCanonical(values.canonical.trim());
  const when = parseWhen(values.publishedDate, values.publishedTime, now);
  const scheduling = when.ok && when.iso !== null && Date.parse(when.iso) > now;
  const words = wordCount(values.body);
  const flags = blogChecks(values);

  const searchTitle = values.seoTitle.trim() || values.title.trim();
  const searchDescription = values.seoDescription.trim() || values.excerpt.trim();
  const host = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const crumbs = [host, ...BLOG_PATH.split("/").filter(Boolean), values.slug || "…"].join(" › ");
  const coverUrl = blogImageUrl(values.coverPath);
  const ogUrl = blogImageUrl(values.ogPath);
  const shareUrl = ogUrl ?? coverUrl;
  const liveUrl = post && stateNow === "live" ? `${BLOG_PATH}/${post.slug}` : null;

  const previewDate = when.ok && when.iso ? when.iso : (post?.published_at ?? null);

  const invalid = (name: string, also = false) => (bad.has(name) || also ? true : undefined);
  const tabClass = (current: boolean) =>
    `flex h-[2.75rem] items-center border-b-2 px-13 text-sm transition-colors duration-fast ${current ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"}`;

  return (
    <div className="grid gap-13">
      <div ref={problemRef} className="grid gap-13 empty:hidden">
        {state.error && <Notice title={BLOG_ERRORS[state.error]} tone="error" />}
        {ro && post && (
          <Notice title="Read-only">
            {!canWrite && !canPublish
              ? "Your role can read the blog but cannot write or change posts."
              : post.status === "published"
                ? "This post is published. Published words can be changed, withdrawn or archived only by someone whose role includes publishing, so that they are never altered by a writer alone. Ask them to make the change, or to unpublish the post so that it can be edited."
                : "This post is archived. Only someone whose role includes publishing can change or restore it."}
          </Notice>
        )}
      </div>

      <form action={formAction} onInvalidCapture={() => setTab("write")} className="grid items-start gap-13 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {post && <input type="hidden" name="id" value={post.id} />}

        <div className="grid min-w-0 gap-13">
          <div role="tablist" aria-label="Write or preview" className="flex border-b border-line">
            <button type="button" role="tab" id="tab-write" aria-selected={tab === "write"} aria-controls="panel-write" className={tabClass(tab === "write")} onClick={() => setTab("write")}>
              {ro ? "Post" : "Write"}
            </button>
            <button type="button" role="tab" id="tab-preview" aria-selected={tab === "preview"} aria-controls="panel-preview" className={tabClass(tab === "preview")} onClick={() => setTab("preview")}>
              Preview
            </button>
          </div>

          {/* hidden, not removed: the fields stay in the form while the preview is open */}
          <div id="panel-write" role="tabpanel" aria-labelledby="tab-write" hidden={tab !== "write"} className="grid min-w-0 gap-13">
            <Card id="content" title="Content">
              <div className="grid gap-21">
                <div className="field">
                  <label htmlFor="blog-title">Title</label>
                  <input
                    id="blog-title"
                    name="title"
                    type="text"
                    className="input"
                    value={values.title}
                    onChange={(e) => onTitle(e.target.value)}
                    minLength={3}
                    maxLength={BLOG_LIMITS.title}
                    required
                    readOnly={ro}
                    autoComplete="off"
                    aria-invalid={invalid("title")}
                    aria-describedby="blog-title-hint"
                  />
                  <Hint id="blog-title-hint" count={<Count name="title" value={values.title} max={BLOG_LIMITS.title} />}>
                    The headline a reader sees at the top of the post and in the list of posts. At least 3 characters.
                  </Hint>
                </div>

                <div className="field">
                  <label htmlFor="blog-slug">Address (slug)</label>
                  <input
                    id="blog-slug"
                    name="slug"
                    type="text"
                    className="input num"
                    value={values.slug}
                    onChange={(e) => {
                      setSlugOwn(true);
                      set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"));
                    }}
                    minLength={3}
                    maxLength={BLOG_LIMITS.slug}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    title="Lower-case letters, digits and single hyphens"
                    required
                    readOnly={ro}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={invalid("slug", values.slug !== "" && !slugOk)}
                    aria-describedby="blog-slug-hint"
                  />
                  <Hint id="blog-slug-hint" count={<Count name="slug" value={values.slug} max={BLOG_LIMITS.slug} />}>
                    The end of the post’s address:{" "}
                    <span className="num break-all text-ink-2">
                      {BLOG_PATH}/{values.slug || "…"}
                    </span>
                    . Lower-case letters, digits and single hyphens, 3 to {BLOG_LIMITS.slug} characters. {!post && !slugOwn ? "It follows the title until you change it here." : ""}
                    {values.slug !== "" && !slugOk && <span className="mt-3 block font-medium text-neg">This is not a valid address yet.</span>}
                    {!ro && slugOwn && slugify(values.title) !== values.slug && values.title.trim().length >= 3 && (
                      <button
                        type="button"
                        className="link mt-3 block text-left"
                        onClick={() => {
                          setSlugOwn(post !== null);
                          set("slug", slugify(values.title));
                        }}
                      >
                        Make it from the title
                      </button>
                    )}
                    {post?.status === "published" && values.slug !== post.slug && (
                      <span className="mt-3 block font-medium text-warn" data-slug-warning>
                        This post is published. Changing its address breaks every link to it, in search engines and on other sites: the old address is not redirected.
                      </span>
                    )}
                  </Hint>
                </div>

                <div className="field">
                  <label htmlFor="blog-excerpt">Excerpt</label>
                  <textarea
                    id="blog-excerpt"
                    name="excerpt"
                    className="textarea"
                    style={{ minHeight: "5.5rem" }}
                    value={values.excerpt}
                    onChange={(e) => set("excerpt", e.target.value)}
                    maxLength={BLOG_LIMITS.excerpt}
                    readOnly={ro}
                    aria-invalid={invalid("excerpt")}
                    aria-describedby="blog-excerpt-hint"
                  />
                  <Hint id="blog-excerpt-hint" count={<Count name="excerpt" value={values.excerpt} max={BLOG_LIMITS.excerpt} />}>
                    One or two sentences saying what the post is about. It is the summary shown in the list of posts, and in search results unless a meta description is written below.
                  </Hint>
                </div>

                <div className="grid gap-21 sm:grid-cols-2 sm:items-start">
                  <div className="field">
                    <label htmlFor="blog-category">Category</label>
                    <select id="blog-category" name="category" className="select" value={values.category} onChange={(e) => set("category", e.target.value as BlogCategory)} disabled={ro} aria-invalid={invalid("category")} aria-describedby="blog-category-hint">
                      {BLOG_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {BLOG_CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </select>
                    <Hint id="blog-category-hint">The one section of the blog the post belongs to.</Hint>
                  </div>
                  <div className="field">
                    <label htmlFor="blog-byline">Byline</label>
                    <input
                      id="blog-byline"
                      name="byline"
                      type="text"
                      className="input"
                      value={values.byline}
                      onChange={(e) => set("byline", e.target.value)}
                      minLength={2}
                      maxLength={BLOG_LIMITS.byline}
                      readOnly={ro}
                      autoComplete="off"
                      placeholder={DEFAULT_BYLINE}
                      aria-invalid={invalid("byline")}
                      aria-describedby="blog-byline-hint"
                    />
                    <Hint id="blog-byline-hint" count={<Count name="byline" value={values.byline} max={BLOG_LIMITS.byline} />}>
                      The site publishes under desks, not invented people: see <NewTab href={STANDARDS_PATH}>Editorial standards</NewTab>. Left empty, it is “{DEFAULT_BYLINE}”.
                    </Hint>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="blog-tags">Tags</label>
                  <input
                    id="blog-tags"
                    name="tags"
                    type="text"
                    className="input"
                    value={values.tags}
                    onChange={(e) => set("tags", e.target.value)}
                    maxLength={BLOG_LIMITS.tags * (BLOG_LIMITS.tag + 2)}
                    readOnly={ro}
                    autoComplete="off"
                    placeholder="gold, central banks, risk management"
                    aria-invalid={invalid("tags", tags.problem !== "")}
                    aria-describedby="blog-tags-hint"
                  />
                  <Hint
                    id="blog-tags-hint"
                    count={
                      <span data-count="tags" className={`num shrink-0 whitespace-nowrap ${tags.tags.length > BLOG_LIMITS.tags ? "font-semibold text-neg" : ""}`}>
                        {tags.tags.length} / {BLOG_LIMITS.tags}
                      </span>
                    }
                  >
                    Separated by commas. Up to {BLOG_LIMITS.tags} tags of up to {BLOG_LIMITS.tag} characters each; they are stored in lower case.
                    {tags.problem && <span className="mt-3 block font-medium text-neg">{tags.problem}</span>}
                  </Hint>
                </div>

                <div className="grid gap-13 xl:grid-cols-[minmax(0,1fr)_13.5rem] xl:items-start">
                  <div className="field min-w-0">
                    <label htmlFor="blog-body">Body</label>
                    {!ro && (
                      <div role="toolbar" aria-label="Insert a mark at the cursor" className="flex flex-wrap items-center gap-5">
                        <button type="button" className="btn btn-ghost btn-sm" data-mark="heading" onClick={() => editBody((t, a, b) => prefixLines(t, a, b, "## ", "Heading"))}>
                          Heading
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" data-mark="bold" onClick={() => editBody((t, a, b) => wrap(t, a, b, "**", "**", "bold words"))}>
                          Bold
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" data-mark="italic" onClick={() => editBody((t, a, b) => wrap(t, a, b, "*", "*", "italic words"))}>
                          Italic
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" data-mark="link" onClick={() => editBody((t, a, b) => wrap(t, a, b, "[", "](https://)", "linked words"))}>
                          Link
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" data-mark="list" onClick={() => editBody((t, a, b) => prefixLines(t, a, b, "- ", "List item"))}>
                          List
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" data-mark="quote" onClick={() => editBody((t, a, b) => prefixLines(t, a, b, "> ", "Quoted words"))}>
                          Quote
                        </button>
                        <UploadButton id="blog-body-file" label="Picture" state={bodyUpload} onFile={onBodyPicture} className="btn btn-ghost btn-sm" />
                        <LibraryButton label="From the library" className="btn btn-ghost btn-sm" onChoose={onBodyChosen} />
                      </div>
                    )}
                    <textarea
                      ref={bodyRef}
                      id="blog-body"
                      name="body"
                      className="textarea"
                      style={{ minHeight: "28rem" }}
                      value={values.body}
                      onChange={(e) => set("body", e.target.value)}
                      readOnly={ro}
                      aria-invalid={invalid("body", values.body.length > BLOG_LIMITS.body)}
                      aria-describedby="blog-body-hint"
                    />
                    <UploadStatus state={bodyUpload} name="body" />
                    <Hint id="blog-body-hint" count={<Count name="body" value={values.body} max={BLOG_LIMITS.body} />}>
                      <span data-words>
                        {words.toLocaleString("en-GB")} {words === 1 ? "word" : "words"}
                      </span>
                      , about {readingMinutes(values.body)} min to read. Leave an empty line between paragraphs. HTML is not understood: it is shown to the reader as typed.
                    </Hint>
                  </div>

                  <aside aria-labelledby="blog-syntax-h" className="min-w-0 rounded-md border border-line bg-surface-2 p-13">
                    <h3 id="blog-syntax-h" className="text-xs font-semibold text-ink">
                      What the body understands
                    </h3>
                    <dl className="mt-8 grid grid-cols-2 gap-x-13 gap-y-5 text-xs xl:grid-cols-1">
                      {SYNTAX.map((s) => (
                        <div key={s.mark}>
                          <dt className="break-words font-mono text-ink">{s.mark}</dt>
                          <dd className="text-ink-3">{s.means}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-8 text-xs text-ink-3">Nothing else. A picture comes only from this blog’s picture store (use the Picture button); a link goes to a page on this site or to an https address.</p>
                  </aside>
                </div>
              </div>
            </Card>

            <Card id="cover" title="Cover picture" aside={<span className={`state ${values.coverPath ? "state-open" : "state-off"}`}>{values.coverPath ? "Has a cover" : "No cover"}</span>}>
              <input type="hidden" name="cover_path" value={values.coverPath} />
              <div className="grid gap-21">
                <div className="grid gap-13 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start">
                  {coverUrl ? (
                    <img src={coverUrl} alt={values.coverAlt || "The cover picture (no alt text yet)"} className="aspect-[1.618/1] w-full rounded-md border border-line object-cover" data-cover-thumb />
                  ) : (
                    <div className="grid aspect-[1.618/1] w-full place-items-center rounded-md border border-dashed border-line-strong bg-surface-2 p-13 text-center text-xs text-ink-3">No picture</div>
                  )}
                  <div className="grid gap-8">
                    <p className="text-sm text-ink-2">The picture at the top of the post and beside it in the list of posts. JPEG, PNG, WebP or AVIF, up to 4 MB. A post can be published without one.</p>
                    {!ro && (
                      <div className="flex flex-wrap items-center gap-8">
                        <UploadButton id="blog-cover-file" label={values.coverPath ? "Replace the picture" : "Upload a picture"} state={coverUpload} onFile={onCover} />
                        <LibraryButton onChoose={onCoverChosen} />
                        {values.coverPath && (
                          <button type="button" className="btn btn-quiet" onClick={removeCover} data-remove-cover>
                            Remove cover
                          </button>
                        )}
                      </div>
                    )}
                    <UploadStatus state={coverUpload} name="cover" />
                    {!ro && values.coverPath && <p className="text-xs text-ink-3">Removing the cover also clears its alt text, caption, credit and size. Nothing changes on the website until the post is saved.</p>}
                  </div>
                </div>

                <fieldset className="grid gap-21" disabled={!values.coverPath && !ro}>
                  <legend className="label">Image parameters</legend>
                  {!values.coverPath && <p className="mt-8 text-xs text-ink-3">These describe the cover picture. Upload one first.</p>}
                  <div className="field mt-13">
                    <label htmlFor="blog-cover-alt">Alt text</label>
                    <input
                      id="blog-cover-alt"
                      name="cover_alt"
                      type="text"
                      className="input"
                      value={values.coverAlt}
                      onChange={(e) => set("coverAlt", e.target.value)}
                      maxLength={BLOG_LIMITS.coverAlt}
                      readOnly={ro}
                      autoComplete="off"
                      aria-invalid={invalid("cover_alt")}
                      aria-describedby="blog-cover-alt-hint"
                    />
                    <Hint id="blog-cover-alt-hint" count={<Count name="cover_alt" value={values.coverAlt} max={BLOG_LIMITS.coverAlt} />}>
                      What the picture shows, for people who cannot see it and for search engines. Required before a post with a cover can be published: the database refuses it otherwise.
                    </Hint>
                  </div>
                  <div className="field">
                    <label htmlFor="blog-cover-caption">Caption</label>
                    <input
                      id="blog-cover-caption"
                      name="cover_caption"
                      type="text"
                      className="input"
                      value={values.coverCaption}
                      onChange={(e) => set("coverCaption", e.target.value)}
                      maxLength={BLOG_LIMITS.coverCaption}
                      readOnly={ro}
                      autoComplete="off"
                      aria-invalid={invalid("cover_caption")}
                      aria-describedby="blog-cover-caption-hint"
                    />
                    <Hint id="blog-cover-caption-hint" count={<Count name="cover_caption" value={values.coverCaption} max={BLOG_LIMITS.coverCaption} />}>
                      Optional. The line printed under the picture.
                    </Hint>
                  </div>
                  <div className="field">
                    <label htmlFor="blog-cover-credit">Credit</label>
                    <input
                      id="blog-cover-credit"
                      name="cover_credit"
                      type="text"
                      className="input"
                      value={values.coverCredit}
                      onChange={(e) => set("coverCredit", e.target.value)}
                      maxLength={BLOG_LIMITS.coverCredit}
                      readOnly={ro}
                      autoComplete="off"
                      aria-invalid={invalid("cover_credit")}
                      aria-describedby="blog-cover-credit-hint"
                    />
                    <Hint id="blog-cover-credit-hint" count={<Count name="cover_credit" value={values.coverCredit} max={BLOG_LIMITS.coverCredit} />}>
                      Who made the picture or holds the rights to it. Use only pictures GIO4X may publish.
                    </Hint>
                  </div>
                  <div className="grid grid-cols-2 gap-13">
                    <div className="field">
                      <label htmlFor="blog-cover-width">Width (pixels)</label>
                      <input
                        id="blog-cover-width"
                        name="cover_width"
                        type="number"
                        inputMode="numeric"
                        className="input num"
                        value={values.coverWidth}
                        onChange={(e) => set("coverWidth", e.target.value)}
                        min={1}
                        max={10000}
                        step={1}
                        readOnly={ro}
                        aria-invalid={invalid("cover_width")}
                        aria-describedby="blog-cover-size-hint"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="blog-cover-height">Height (pixels)</label>
                      <input
                        id="blog-cover-height"
                        name="cover_height"
                        type="number"
                        inputMode="numeric"
                        className="input num"
                        value={values.coverHeight}
                        onChange={(e) => set("coverHeight", e.target.value)}
                        min={1}
                        max={10000}
                        step={1}
                        readOnly={ro}
                        aria-invalid={invalid("cover_height")}
                        aria-describedby="blog-cover-size-hint"
                      />
                    </div>
                    <p id="blog-cover-size-hint" className="col-span-2 text-xs text-ink-3">
                      Filled in from the uploaded file. The page uses them to keep room for the picture, so the text does not jump while it loads. Correct them only if they are wrong.
                    </p>
                  </div>
                </fieldset>
              </div>
            </Card>

            <Card id="seo" title="Search and sharing (SEO)">
              <div className="grid gap-21">
                <div className="field">
                  <label htmlFor="blog-seo-title">SEO title</label>
                  <input
                    id="blog-seo-title"
                    name="seo_title"
                    type="text"
                    className="input"
                    value={values.seoTitle}
                    onChange={(e) => set("seoTitle", e.target.value)}
                    maxLength={BLOG_LIMITS.seoTitle}
                    readOnly={ro}
                    autoComplete="off"
                    placeholder={values.title}
                    aria-invalid={invalid("seo_title")}
                    aria-describedby="blog-seo-title-hint"
                  />
                  <Hint id="blog-seo-title-hint" count={<Count name="seo_title" value={values.seoTitle} max={BLOG_LIMITS.seoTitle} />}>
                    The title for search results and browser tabs. A search result shows about {SEARCH_TITLE_LENGTH} characters.{" "}
                    {values.seoTitle.trim() ? "" : <span data-fallback="seo_title">Empty: the post’s title is used{values.title.trim() ? ` (“${cutForSearch(values.title, 48)}”)` : ""}.</span>}
                  </Hint>
                </div>
                <div className="field">
                  <label htmlFor="blog-seo-description">Meta description</label>
                  <textarea
                    id="blog-seo-description"
                    name="seo_description"
                    className="textarea"
                    style={{ minHeight: "5.5rem" }}
                    value={values.seoDescription}
                    onChange={(e) => set("seoDescription", e.target.value)}
                    maxLength={BLOG_LIMITS.seoDescription}
                    readOnly={ro}
                    placeholder={values.excerpt}
                    aria-invalid={invalid("seo_description")}
                    aria-describedby="blog-seo-description-hint"
                  />
                  <Hint id="blog-seo-description-hint" count={<Count name="seo_description" value={values.seoDescription} max={BLOG_LIMITS.seoDescription} />}>
                    The lines under the title in a search result: about {SEARCH_DESCRIPTION_LENGTH} characters are shown. {values.seoDescription.trim() ? "" : <span data-fallback="seo_description">Empty: the excerpt is used.</span>}
                  </Hint>
                </div>
                <div className="field">
                  <label htmlFor="blog-canonical">Canonical address</label>
                  <input
                    id="blog-canonical"
                    name="canonical_url"
                    type="text"
                    className="input num"
                    value={values.canonical}
                    onChange={(e) => set("canonical", e.target.value)}
                    maxLength={BLOG_LIMITS.canonical}
                    readOnly={ro}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={`${BLOG_PATH}/${values.slug || "…"}`}
                    aria-invalid={invalid("canonical_url", !canonicalOk)}
                    aria-describedby="blog-canonical-hint"
                  />
                  <Hint id="blog-canonical-hint" count={<Count name="canonical_url" value={values.canonical} max={BLOG_LIMITS.canonical} />}>
                    Leave empty: the post’s own address is then the canonical one. Fill it in only when the same text was first published at another address. It must start with https:// or with /.
                    {!canonicalOk && <span className="mt-3 block font-medium text-neg">This must start with https:// or with a single /, and contain no spaces.</span>}
                  </Hint>
                </div>
                <label className="check">
                  <input type="checkbox" name="noindex" value="1" checked={values.noindex} onChange={(e) => set("noindex", e.target.checked)} disabled={ro} />
                  <span>
                    <span className="font-medium text-ink">Ask search engines not to index this post</span>
                    <span className="block text-xs text-ink-3">The post stays on the website for anyone with its address. It is a request (noindex) that search engines honour; it does not hide the post.</span>
                  </span>
                </label>

                <div>
                  <p className="field-label">Social-share picture</p>
                  <input type="hidden" name="og_image_path" value={values.ogPath} />
                  <p className="mt-5 text-sm text-ink-2" data-og-source>
                    {values.ogPath ? "A separate picture is used when the post is shared." : values.coverPath ? "The cover picture is used when the post is shared." : "No picture is chosen for sharing: upload a cover, or a separate picture here."}
                  </p>
                  {!ro && (
                    <div className="mt-8 flex flex-wrap items-center gap-8">
                      <UploadButton id="blog-og-file" label={values.ogPath ? "Replace the separate picture" : "Upload a separate picture"} state={ogUpload} onFile={onOg} />
                      <LibraryButton onChoose={onOgChosen} />
                      {values.ogPath && (
                        <button
                          type="button"
                          className="btn btn-quiet"
                          onClick={() => {
                            set("ogPath", "");
                            setOgUpload(IDLE);
                          }}
                        >
                          {values.coverPath ? "Use the cover instead" : "Remove it"}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="mt-5">
                    <UploadStatus state={ogUpload} name="og" />
                  </div>
                  <p className="mt-5 text-xs text-ink-3">
                    Share cards are drawn wide, about 1200 × 630 pixels. A picture of another shape is cropped by the network that shows it. A separate share picture has no description of its own: the cover’s alt text is used for it, so write that
                    alt text even when the share picture differs.
                  </p>
                </div>

                <div className="grid gap-13 xl:grid-cols-2">
                  <div className="min-w-0">
                    <p className="field-label">Search-result preview</p>
                    <div className="mt-8 rounded-md border border-line bg-surface-2 p-13" data-preview="search">
                      <p className="truncate text-xs text-ink-3" data-search="address">
                        {crumbs}
                      </p>
                      <p className="mt-3 break-words text-[1.0625rem] leading-snug text-accent" data-search="title">
                        {searchTitle ? cutForSearch(searchTitle, SEARCH_TITLE_LENGTH) : "The title appears here"}
                      </p>
                      <p className="mt-3 break-words text-sm text-ink-2" data-search="description">
                        {searchDescription ? cutForSearch(searchDescription, SEARCH_DESCRIPTION_LENGTH) : "Without an excerpt or a meta description, a search engine picks sentences from the post itself."}
                      </p>
                    </div>
                    {values.noindex && <p className="mt-5 text-xs text-ink-3">Search engines are asked not to index this post, so it should not appear in results at all.</p>}
                  </div>
                  <div className="min-w-0">
                    <p className="field-label">Share-card preview</p>
                    <div className="mt-8 overflow-hidden rounded-md border border-line bg-surface-2" data-preview="share">
                      {shareUrl ? (
                        <img src={shareUrl} alt="" className="aspect-[1.91/1] w-full object-cover" />
                      ) : (
                        <div className="grid aspect-[1.91/1] w-full place-items-center border-b border-line p-13 text-center text-xs text-ink-3">No picture chosen for this post</div>
                      )}
                      <div className="p-13">
                        <p className="truncate text-xs uppercase tracking-wide text-ink-3">{host}</p>
                        <p className="mt-3 break-words text-sm font-semibold text-ink" data-share="title">
                          {searchTitle || "The title appears here"}
                        </p>
                        <p className="mt-3 line-clamp-2 break-words text-xs text-ink-2" data-share="description">
                          {searchDescription}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-ink-3">Both previews are drawn from the fields above as you type. They show roughly what a search engine or a network does with them; each one decides its own cut and may rewrite a title or description.</p>
              </div>
            </Card>
          </div>

          <div id="panel-preview" role="tabpanel" aria-labelledby="tab-preview" hidden={tab !== "preview"} className="min-w-0">
            {tab === "preview" && (
              <article className="gxc-card min-w-0 p-21 sm:p-34" data-preview="post">
                <p className="label">{BLOG_CATEGORY_LABEL[values.category]}</p>
                <h2 className="mt-8 break-words text-[1.75rem] font-bold leading-tight text-ink">{values.title.trim() || "Untitled post"}</h2>
                {values.excerpt.trim() && <p className="mt-13 max-w-measure text-md text-ink-2">{values.excerpt.trim()}</p>}
                <p className="mt-13 flex flex-wrap gap-x-13 gap-y-3 text-sm text-ink-3">
                  <span className="font-medium text-ink-2">{values.byline.trim() || DEFAULT_BYLINE}</span>
                  <span className="num">{previewDate ? fmtDateTime(previewDate) : "Not published yet"}</span>
                  <span>{readingMinutes(values.body)} min read</span>
                </p>
                {post?.status === "published" && post.corrected_at && post.correction_note && (
                  <p className="mt-13 max-w-measure border-l-2 border-line-strong pl-13 text-sm text-ink-2">
                    Updated <span className="num">{fmtDateTime(post.corrected_at)}</span>: {post.correction_note}
                  </p>
                )}
                {coverUrl && (
                  <figure className="mt-21">
                    <img src={coverUrl} alt={values.coverAlt} width={Number(values.coverWidth) || undefined} height={Number(values.coverHeight) || undefined} className="h-auto w-full rounded-md border border-line" />
                    {(values.coverCaption.trim() || values.coverCredit.trim()) && (
                      <figcaption className="mt-8 text-sm text-ink-3">
                        {values.coverCaption.trim()}
                        {values.coverCaption.trim() && values.coverCredit.trim() ? " " : ""}
                        {values.coverCredit.trim() && <span className="text-xs">Picture: {values.coverCredit.trim()}</span>}
                      </figcaption>
                    )}
                  </figure>
                )}
                {values.body.trim() ? <BlogBody source={values.body} className="mt-21" /> : <p className="mt-21 text-sm text-ink-3">The body is empty.</p>}
                <p className="mt-34 border-t border-line pt-13 text-xs text-ink-3">
                  The body is drawn by the same code the website uses, so the headings, lists, links and pictures are what a reader gets. The page around it (the site’s header, its typeface and colours) is the website’s own and is not shown here.
                </p>
              </article>
            )}
          </div>
        </div>

        <div className="grid min-w-0 gap-13 lg:sticky lg:top-21">
          <Card id="publication" title="Publication" aside={post ? <BlogStateBadge post={post} now={now} /> : <span className="state state-off">Not saved yet</span>}>
            <div className="grid gap-13">
              {post && (
                <p className="text-sm text-ink-2" data-standing>
                  {stateNow === "live" && (
                    <>
                      On the website since <span className="num">{fmtDateTime(post.published_at)}</span>.{" "}
                      {liveUrl && <NewTab href={liveUrl}>View the post</NewTab>}
                    </>
                  )}
                  {stateNow === "scheduled" && (
                    <>
                      Scheduled for <span className="num">{fmtDateTime(post.published_at)}</span>. It appears on the website by itself when that time comes.
                    </>
                  )}
                  {stateNow === "draft" && "A draft. Only staff can see it."}
                  {stateNow === "review" && "Ready for review. Only staff can see it until someone publishes it."}
                  {stateNow === "archived" && "Archived. It is not on the website."}
                </p>
              )}

              {canPublish && !ro ? (
                <fieldset className="grid gap-8">
                  <legend className="field-label">Publication date and time (UTC)</legend>
                  <div className="mt-8 grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-8">
                    <div className="field min-w-0">
                      <label htmlFor="blog-date" className="sr-only">
                        Publication date (UTC)
                      </label>
                      <input id="blog-date" name="published_date" type="date" className="input num" value={values.publishedDate} onChange={(e) => set("publishedDate", e.target.value)} aria-invalid={invalid("published_at", !when.ok)} aria-describedby="blog-when-hint" />
                    </div>
                    <div className="field min-w-0">
                      <label htmlFor="blog-time" className="sr-only">
                        Publication time (UTC)
                      </label>
                      <input id="blog-time" name="published_time" type="time" className="input num" value={values.publishedTime} onChange={(e) => set("publishedTime", e.target.value)} aria-invalid={invalid("published_at", !when.ok)} aria-describedby="blog-when-hint" />
                    </div>
                  </div>
                  <div id="blog-when-hint" className="text-xs text-ink-3">
                    <p>Both in UTC, not your local time. Empty when you publish means now. A time in the future schedules the post: it appears by itself when that time comes.</p>
                    <p className="mt-3 font-medium text-ink-2" data-when>
                      {!when.ok
                        ? "That is not a date and time that can be used."
                        : when.iso === null
                          ? post?.status === "published"
                            ? "Empty: the post keeps the publication time it has."
                            : "Empty: the post is dated the moment it is published."
                          : post?.status === "published"
                            ? scheduling
                              ? `In the future: saving takes the post off the website until ${fmtDateTime(when.iso)}.`
                              : `The post is dated ${fmtDateTime(when.iso)}.`
                            : scheduling
                              ? `In the future: the post would be scheduled for ${fmtDateTime(when.iso)}.`
                              : `In the past: the post would appear at once, dated ${fmtDateTime(when.iso)}.`}
                    </p>
                    {(values.publishedDate || values.publishedTime) && (
                      <button type="button" className="link mt-3" onClick={() => setValues((v) => ({ ...v, publishedDate: "", publishedTime: "" }))}>
                        Clear the date and time
                      </button>
                    )}
                  </div>
                </fieldset>
              ) : (
                !ro && <p className="text-xs text-ink-3">Publishing is done by someone whose role includes it. When the post is ready, send it for review: it then shows under “Ready for review” in the list.</p>
              )}

              {!ro && (
                <div className="grid gap-8 border-t border-line pt-13">
                  {post?.status === "published" || post?.status === "archived" ? (
                    <IntentButton intent="keep" pending={pending} primary>
                      {post.status === "published" ? (stateNow === "scheduled" ? "Save changes" : "Save changes to the published post") : "Save changes"}
                    </IntentButton>
                  ) : (
                    <>
                      {canPublish && (
                        <IntentButton intent="publish" pending={pending} primary>
                          {scheduling ? "Schedule" : "Publish"}
                        </IntentButton>
                      )}
                      {post?.status === "review" ? (
                        <>
                          <IntentButton intent="keep" pending={pending} primary={!canPublish}>
                            Save changes
                          </IntentButton>
                          <IntentButton intent="draft" pending={pending}>
                            Save and move back to draft
                          </IntentButton>
                        </>
                      ) : (
                        <>
                          <IntentButton intent="draft" pending={pending} primary={!canPublish}>
                            Save draft
                          </IntentButton>
                          <IntentButton intent="review" pending={pending}>
                            Send for review
                          </IntentButton>
                        </>
                      )}
                    </>
                  )}
                  {post?.status === "archived" && canPublish && (
                    <IntentButton intent="publish" pending={pending}>
                      {scheduling ? "Save and schedule" : "Save and publish again"}
                    </IntentButton>
                  )}
                  <p className="text-xs text-ink-3" role="status" data-dirty>
                    {pending ? "Saving…" : dirty ? "There are unsaved changes." : post ? "Everything shown is saved." : "Nothing is saved until you press a button."}
                  </p>
                  {post?.status === "published" && <p className="text-xs text-ink-3">Every saved change to a published post is recorded in the audit log with your name. If the change is material, say so under “Correction” below.</p>}
                </div>
              )}
            </div>
          </Card>

          <Card id="checklist" title="Editorial checklist" aside={<span className={`state ${flags.length ? "state-pre" : "state-open"}`}>{flags.length ? `${flags.length} to look at` : "Nothing flagged"}</span>}>
            {flags.length ? (
              <ul className="grid gap-8" data-checklist>
                {flags.map((flag) => (
                  <li key={flag.key} data-flag={flag.key} className="grid grid-cols-[auto_minmax(0,1fr)] gap-8 text-sm text-ink-2">
                    <span aria-hidden className="mt-[0.4rem] h-[0.4375rem] w-[0.4375rem] rounded-full border border-warn bg-warn" />
                    <span>{flag.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-2" data-checklist>
                The draft has an excerpt, a described cover (or none), titles and descriptions that fit a search result, at least 150 words, working links, and none of the wording the standards rule out.
              </p>
            )}
            <p className="mt-13 text-xs text-ink-3">
              Reminders, not rules: nothing here stops a save. It reads the draft for a few mechanical things and cannot judge whether the post is accurate or fair. That is the editor’s job: see <NewTab href={STANDARDS_PATH}>Editorial standards</NewTab>.
            </p>
          </Card>
        </div>
      </form>

      {post && canPublish && (
        <div className="grid items-start gap-13 lg:grid-cols-2">
          {post.status === "published" && (
            <Card id="correction" title="Correction" aside={<span className={`state ${post.corrected_at ? "state-overlap" : "state-off"}`}>{post.corrected_at ? "Marked as updated" : "Not marked"}</span>}>
              <p className="text-sm text-ink-2">
                The site’s rule: a material change after publication is noted on the post with its date. Fixing a typo is not material; changing a figure, a claim or a conclusion is. See <NewTab href={STANDARDS_PATH}>Editorial standards</NewTab>.
              </p>
              {post.corrected_at && (
                <p className="mt-8 text-sm text-ink-2">
                  Marked as materially updated <span className="num">{fmtDateTime(post.corrected_at)}</span>.
                </p>
              )}
              <CorrectionForm post={post} blocked={dirty} />
            </Card>
          )}

          <Card id="standing" title={post.status === "archived" ? "Restore" : post.status === "published" ? "Withdraw" : "Archive"}>
            <div className="grid gap-13">
              {post.status === "published" && (
                <StatusForm id={post.id} to="draft" label="Unpublish" blocked={dirty}>
                  Takes the post off the website at once and makes it a draft again. Its address stops working until it is published again; it keeps its publication time unless you clear it.
                </StatusForm>
              )}
              {post.status !== "archived" && (
                <StatusForm id={post.id} to="archived" label="Archive" blocked={dirty}>
                  {post.status === "published" ? "Takes the post off the website and puts it away. " : "Puts the post away. "}
                  An archived post is kept, is not on the website, and can be restored as a draft.
                </StatusForm>
              )}
              {post.status === "archived" && (
                <StatusForm id={post.id} to="draft" label="Restore as a draft" blocked={dirty}>
                  Makes the post a draft again, so that it can be edited by writers and published.
                </StatusForm>
              )}
              {dirty && <p className="text-xs font-medium text-warn">Save your changes first: these act on the saved post, and unsaved words would be lost.</p>}
            </div>
          </Card>
        </div>
      )}

      {/* what the words were, each time they were saved: compare, and put a revision back into the fields above */}
      {post && history && <BlogHistory postId={post.id} revisions={history.revisions} current={revisionWords} dirty={dirty} canRestore={!ro} load={history.load ?? readBlogRevisions} onRestore={restoreWords} />}

      {/* a reader of a published post sees the note; so does anyone who can open it here */}
      {post && !canPublish && post.status === "published" && post.corrected_at && (
        <Card id="correction" title="Correction">
          <p className="text-sm text-ink-2">
            Marked as materially updated <span className="num">{fmtDateTime(post.corrected_at)}</span>
            {post.correction_note ? `: ${post.correction_note}` : "."}
          </p>
        </Card>
      )}
    </div>
  );
}

/** One of the editor's submit buttons: it carries what should happen to the post's status. */
function IntentButton({ intent, pending, primary = false, children }: { intent: "keep" | "draft" | "review" | "publish"; pending: boolean; primary?: boolean; children: ReactNode }) {
  return (
    <button type="submit" name="intent" value={intent} data-intent={intent} className={`btn w-full ${primary ? "btn-primary" : "btn-ghost"}`} disabled={pending} aria-disabled={pending}>
      {children}
    </button>
  );
}

/** A change of status alone, on the saved post. Not offered while there are unsaved words, which it would discard. */
function StatusForm({ id, to, label, blocked, children }: { id: string; to: "draft" | "archived"; label: string; blocked: boolean; children: ReactNode }) {
  return (
    <form action={setBlogStatus} className="grid gap-8">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={to} />
      <p className="text-sm text-ink-2">{children}</p>
      <div>
        {blocked ? (
          <button type="button" className="btn btn-ghost" disabled aria-disabled="true">
            {label}
          </button>
        ) : (
          <SubmitButton pending="Saving…" className="btn btn-ghost">
            {label}
          </SubmitButton>
        )}
      </div>
    </form>
  );
}

function CorrectionForm({ post, blocked }: { post: BlogPostRow; blocked: boolean }) {
  const [note, setNote] = useState(post.correction_note);
  return (
    <form action={saveBlogCorrection} className="mt-13 grid gap-13">
      <input type="hidden" name="id" value={post.id} />
      <div className="field">
        <label htmlFor="blog-correction">Correction note</label>
        <textarea id="blog-correction" name="correction_note" className="textarea" style={{ minHeight: "5.5rem" }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={BLOG_LIMITS.correction} aria-describedby="blog-correction-hint" />
        <Hint id="blog-correction-hint" count={<Count name="correction_note" value={note} max={BLOG_LIMITS.correction} />}>
          What changed, in a sentence a reader can follow. It is shown on the post.
        </Hint>
      </div>
      <label className="check">
        <input type="checkbox" name="corrected_now" value="1" />
        <span>
          <span className="font-medium text-ink">Mark as materially updated now</span>
          <span className="block text-xs text-ink-3">Records this moment as the date of the change. It needs a note saying what changed.</span>
        </span>
      </label>
      {post.corrected_at && (
        <label className="check">
          <input type="checkbox" name="corrected_clear" value="1" />
          <span>
            <span className="font-medium text-ink">Remove the mark</span>
            <span className="block text-xs text-ink-3">Only when it was set by mistake.</span>
          </span>
        </label>
      )}
      <div>
        {blocked ? (
          <button type="button" className="btn btn-ghost" disabled aria-disabled="true">
            Save correction
          </button>
        ) : (
          <SubmitButton pending="Saving…" className="btn btn-ghost">
            Save correction
          </SubmitButton>
        )}
      </div>
    </form>
  );
}

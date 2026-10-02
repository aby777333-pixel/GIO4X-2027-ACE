import Link from "next/link";
import { ControlHead, Notice } from "@/components/control/bits";
import { fmtDateTime, jsonPairs } from "@/components/control/format";
import { BLOG_STATE_LABEL, blogState } from "@/components/control/views/blog-shared";
import { BlogEditor } from "@/components/control/views/BlogEditor";
import { BlogStateBadge } from "@/components/control/views/BlogListView";
import { BLOG_STATUS_LABEL, BLOG_STATUSES } from "@/lib/blog";
import type { AuditRow, BlogPostRow, BlogStatus } from "@/lib/supabase/types";

export type BlogEditorViewProps = {
  /** null: the screen for a new post */
  post: BlogPostRow | null;
  /** the audit entries for this post, newest first (written by the trigger in 0011) */
  audit: Pick<AuditRow, "id" | "at" | "actor" | "action" | "detail">[];
  auditFailed: boolean;
  names: Map<string, string>;
  me: string;
  /** rendered-at time: decides "scheduled" against "published" */
  now: number;
  /** may create drafts and edit what is not published (blog.write) */
  canWrite: boolean;
  /** may publish, unpublish, archive, and edit a published post (blog.publish) */
  canPublish: boolean;
  /** the website's origin, for the previews */
  siteUrl: string;
  notice?: string;
  error?: string;
};

const isStatus = (v: string): v is BlogStatus => (BLOG_STATUSES as readonly string[]).includes(v);

/** An audit entry in words. The trigger records the address, the status and the publication time as they were after the change. */
function describe(entry: BlogEditorViewProps["audit"][number]): { what: string; detail: string } {
  const pairs = jsonPairs(entry.detail);
  const value = (key: string) => pairs.find((p) => p.key === key)?.value ?? "";
  const status = value("status");
  const at = value("published_at");
  // "none" is how jsonPairs prints a null
  const when = at && at !== "none" ? fmtDateTime(at) : "";
  // a post published with a time later than the entry itself was scheduled, not put live
  const scheduled = entry.action === "blog.publish" && when !== "" && Date.parse(at) > Date.parse(entry.at);
  switch (entry.action) {
    case "blog.create":
      return { what: "Created", detail: isStatus(status) ? `as ${BLOG_STATUS_LABEL[status].toLowerCase()}` : "" };
    case "blog.publish":
      return scheduled ? { what: "Scheduled", detail: `for ${when}` } : { what: "Published", detail: when ? `dated ${when}` : "" };
    case "blog.unpublish":
      return { what: "Taken off the website", detail: isStatus(status) ? `now ${BLOG_STATUS_LABEL[status].toLowerCase()}` : "" };
    case "blog.archive":
      return { what: "Archived", detail: "" };
    case "blog.status":
      return { what: "Status changed", detail: isStatus(status) ? `to ${BLOG_STATUS_LABEL[status].toLowerCase()}` : "" };
    case "blog.edit_published":
      return { what: "Edited while published", detail: "" };
    default:
      return { what: entry.action, detail: "" };
  }
}

/**
 * The frame around the editor: where the post stands, what just happened, and
 * its history. Presentation only; the editor itself (a client component) holds
 * what is being typed, and the server actions do the saving.
 */
export function BlogEditorView({ post, audit, auditFailed, names, me, now, canWrite, canPublish, siteUrl, notice, error }: BlogEditorViewProps) {
  const who = (userId: string | null) => (!userId ? "Database (SQL)" : userId === me ? "You" : (names.get(userId) ?? "Former member of staff"));
  const state = post ? blogState(post, now) : null;

  return (
    <>
      <p className="text-xs text-ink-3">
        <Link href="/control/blog" className="link-quiet">
          Blog
        </Link>
        <span aria-hidden className="mx-8 inline-block h-px w-8 bg-line-strong align-middle" />
        <span className="text-ink-2">{post ? "Post" : "New post"}</span>
      </p>

      <div className="mt-13">
        <ControlHead
          title={post ? <span className="break-words">{post.title}</span> : "New post"}
          lead={
            post ? (
              <>
                {state ? BLOG_STATE_LABEL[state] : ""} · last changed <span className="num">{fmtDateTime(post.updated_at)}</span> by {who(post.updated_by)} · created <span className="num">{fmtDateTime(post.created_at)}</span> by {who(post.created_by)}
              </>
            ) : (
              "Nothing is on the website until a post is published. Save a draft as often as you like."
            )
          }
          actions={post ? <BlogStateBadge post={post} now={now} withTime /> : undefined}
        />
      </div>

      <div className="mt-21 grid gap-13 empty:hidden">
        {notice && !error && <Notice title={notice} tone="ok" />}
        {error && <Notice title={error} tone="error" />}
      </div>

      <div className="mt-13">
        {/* a saved post comes back with a new change time: the editor starts again from what was saved */}
        <BlogEditor key={post ? `${post.id}:${post.updated_at}` : "new"} post={post} canWrite={canWrite} canPublish={canPublish} now={now} siteUrl={siteUrl} />
      </div>

      {post && (
        <section aria-labelledby="blog-history" className="mt-34">
          <h2 id="blog-history" className="label">
            History
          </h2>
          {auditFailed ? (
            <div className="mt-13">
              <Notice title="The history could not be read" tone="error" />
            </div>
          ) : audit.length ? (
            <ol className="mt-13 border-t border-line">
              {audit.map((entry) => {
                const { what, detail } = describe(entry);
                return (
                  <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-3 border-b border-line py-8 text-sm">
                    <span className="text-ink">
                      {what}
                      {detail && <span className="text-ink-3"> · {detail}</span>}
                    </span>
                    <span className="text-xs text-ink-3">
                      {who(entry.actor)} · <span className="num">{fmtDateTime(entry.at)}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-13 border-y border-line py-13 text-sm text-ink-3">Nothing recorded yet.</p>
          )}
          <p className="mt-8 max-w-measure text-xs text-ink-3">
            Recorded by the database itself: when a post is created, published, taken off the website or archived, and every edit made while it is published. Ordinary drafting is not recorded.
          </p>
        </section>
      )}
    </>
  );
}

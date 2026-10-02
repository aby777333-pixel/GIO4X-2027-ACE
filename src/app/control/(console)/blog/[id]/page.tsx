import Link from "next/link";
import { notFound } from "next/navigation";
import { ControlHead, NoAccess, Notice } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { BLOG_ERRORS } from "@/components/control/views/blog-shared";
import { BlogEditorView } from "@/components/control/views/BlogEditorView";
import { site } from "@/config/site";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Post", "/control/blog");

const NOTICES: Record<string, string> = {
  created: "Draft created.",
  saved: "Saved.",
  draft: "Saved as a draft.",
  review: "Sent for review.",
  published: "Published. The post is on the website now.",
  scheduled: "Scheduled. The post appears on the website by itself at the time shown.",
  unpublished: "Unpublished. The post is off the website and is a draft again.",
  archived: "Archived. The post is not on the website.",
  correction: "Correction saved.",
};

/**
 * One post in the editor. Read as the signed-in user: row-level security lets
 * anyone holding blog.read see every post here, whatever its status. What may
 * be changed is decided by the role and by where the post stands, in the
 * actions and again in the database.
 */
export default async function BlogPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "blog.read")) return <NoAccess title="Post" />;
  const { supabase } = ctx;

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [postResult, auditResult, names] = await Promise.all([
    supabase.from("blog_posts").select("*").eq("id", id).maybeSingle(),
    supabase.from("audit_log").select("id, at, actor, action, detail").eq("entity", "blog_post").eq("entity_id", id).order("at", { ascending: false }).limit(50),
    staffDirectory(supabase),
  ]);

  if (postResult.error) {
    return (
      <>
        <ControlHead title="This post could not be read" />
        <div className="mt-21">
          <Notice title="The database did not answer" tone="error">
            Reload the page, or go back to{" "}
            <Link href="/control/blog" className="link">
              all posts
            </Link>
            .
          </Notice>
        </div>
      </>
    );
  }
  const post = postResult.data;
  // Not found and not permitted look the same on purpose.
  if (!post) notFound();

  const sp = await searchParams;
  const errorCode = firstParam(sp.error);

  return (
    <BlogEditorView
      post={post}
      audit={auditResult.data ?? []}
      auditFailed={!!auditResult.error}
      names={names}
      me={ctx.userId}
      now={Date.now()}
      canWrite={can(ctx, "blog.write")}
      canPublish={can(ctx, "blog.publish")}
      siteUrl={site.url}
      notice={NOTICES[firstParam(sp.notice)]}
      error={Object.hasOwn(BLOG_ERRORS, errorCode) ? BLOG_ERRORS[errorCode as keyof typeof BLOG_ERRORS] : undefined}
    />
  );
}

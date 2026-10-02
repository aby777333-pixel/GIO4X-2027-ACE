import Link from "next/link";
import { ControlHead, NoAccess, Notice } from "@/components/control/bits";
import { controlMeta } from "@/components/control/format";
import { BlogEditorView } from "@/components/control/views/BlogEditorView";
import { site } from "@/config/site";
import { can, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("New post", "/control/blog/new");

/**
 * The editor with nothing in it. Reads nothing: a post exists only once the
 * create action has stored it, and the action then opens it at its own address.
 */
export default async function NewBlogPostPage() {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "blog.read")) return <NoAccess title="New post" />;

  // reading the blog is not writing it: the database refuses an insert without blog.write
  if (!can(ctx, "blog.write")) {
    return (
      <>
        <ControlHead title="New post" />
        <div className="mt-21">
          <Notice title="Your role can read the blog but cannot write posts">
            If you need to write for the blog, ask an administrator to change your role on the Staff page. You can still read{" "}
            <Link href="/control/blog" className="link">
              every post
            </Link>
            .
          </Notice>
        </div>
      </>
    );
  }

  return (
    <BlogEditorView post={null} audit={[]} auditFailed={false} names={new Map()} me={ctx.userId} now={Date.now()} canWrite canPublish={can(ctx, "blog.publish")} siteUrl={site.url} />
  );
}

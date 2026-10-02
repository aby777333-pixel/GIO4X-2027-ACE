import { headers } from "next/headers";
import { readSeoPosts } from "@/app/control/(console)/seo/posts";
import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { SeoView } from "@/components/control/views/SeoView";
import { redirectRows, seoReport } from "@/lib/server/seo-check";
import { can, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("SEO health", "/control/seo");

const NOTICES: Record<string, string> = {
  rechecked: "Checked again. What is below was read from the website just now.",
};
const ERRORS: Record<string, string> = {
  forbidden: "Your role cannot do that. Nothing was changed.",
};

/**
 * SEO health. Two sources, both real:
 *   · the website itself, fetched anonymously from this request's own host
 *     (src/lib/server/seo-check.ts says exactly what a run may do), kept for
 *     ten minutes;
 *   · the blog's posts, read from the database as the signed-in user.
 * The redirects are the file the site is built with. Nothing here is
 * estimated, and when the website cannot be reached the screen says so rather
 * than showing empty tables.
 */
export default async function SeoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "blog.read")) return <NoAccess title="SEO health" />;

  const params = await searchParams;
  const now = Date.now();
  // the host this request was sent to decides where the check goes; nothing a caller types does
  const host = (await headers()).get("host");
  const [outcome, posts] = await Promise.all([seoReport(host), readSeoPosts(ctx.supabase, now)]);

  return <SeoView outcome={outcome} posts={posts} redirects={redirectRows()} now={now} notice={NOTICES[firstParam(params.notice)]} error={ERRORS[firstParam(params.error)]} />;
}

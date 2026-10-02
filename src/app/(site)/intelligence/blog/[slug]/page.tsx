import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPostView } from "@/components/blog/BlogPost";
import { blogPostMetadata, blogPostSchema } from "@/components/blog/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps } from "@/components/ui/Page";
import { absoluteUrl } from "@/config/site";
import { BLOG_PATH, isBlogSlug } from "@/lib/blog";
import { blogCover, blogPostPath, getPost, neighbours } from "@/lib/server/blog";

type Params = { params: Promise<{ slug: string }> };

/**
 * A post is a row in the database, written in GIO4X Control, and it changes
 * without a deploy. So there is no generateStaticParams: the page is rendered
 * the first time it is asked for and kept for a minute, after which the next
 * request reads the row again. A correction, a withdrawal or a scheduled post
 * reaching its time is therefore on the site within about a minute.
 */
export const revalidate = 60;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  if (!isBlogSlug(slug)) return {};
  const result = await getPost(slug);
  if (result.state !== "ok") return {};
  return blogPostMetadata(result.post, blogCover(result.post));
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  if (!isBlogSlug(slug)) notFound();
  const result = await getPost(slug);
  // "there is no such public post" is a 404; "the database did not answer" is an error, so that it is never kept as a 404
  if (result.state === "none" || (result.state === "failed" && result.reason === "not-configured")) notFound();
  if (result.state === "failed") throw new Error("The post could not be read.");
  const { post } = result;

  const cover = blogCover(post);
  const around = await neighbours(post);

  return (
    <>
      <JsonLd data={blogPostSchema(post, cover)} />
      <BlogPostView post={post} cover={cover} previous={around.state === "ok" ? around.previous : null} next={around.state === "ok" ? around.next : null} url={absoluteUrl(blogPostPath(post.slug))} />
      <NextSteps
        items={[
          { kind: "Daily blog", label: "All posts", href: BLOG_PATH, note: "Every post, newest first." },
          { kind: "Intelligence", label: "GIO4X Intelligence", href: "/intelligence", note: "Longer analysis, explainers and guides." },
          { kind: "Academy", label: "Learn it in order", href: "/academy", note: "Lessons from first principles." },
          { kind: "Reference", label: "Glossary", href: "/glossary", note: "Every term, defined plainly." },
        ]}
      />
    </>
  );
}

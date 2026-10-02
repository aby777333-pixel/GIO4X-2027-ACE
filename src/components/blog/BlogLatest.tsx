import Link from "next/link";
import { BLOG_PATH } from "@/lib/blog";
import { latestPosts, type BlogLatest as Latest } from "@/lib/server/blog";
import { BlogCompactList } from "./BlogList";

/**
 * "From the daily blog": the newest posts, as a section on another page.
 * The section is always there. With no post it says so in one line; when the
 * posts cannot be read it says that instead, and the link to the blog stands
 * in every case.
 */
export function BlogLatestView({ result }: { result: Latest }) {
  return (
    <section className="section-quiet hairline" aria-labelledby="from-the-blog">
      <div className="wrap">
        <div className="flex flex-wrap items-end justify-between gap-x-34 gap-y-13">
          <div>
            <p className="eyebrow">Daily blog</p>
            <h2 id="from-the-blog" className="h3 mt-13">
              From the daily blog
            </h2>
          </div>
          <Link href={BLOG_PATH} className="go no-print min-h-[2.75rem]">
            {result.state === "ok" ? "All posts" : "Open the daily blog"}
          </Link>
        </div>
        {result.state === "ok" ? (
          <div className="mt-21">
            <BlogCompactList posts={result.posts} />
          </div>
        ) : (
          <p className="mt-13 max-w-measure text-ink-2" role={result.state === "failed" ? "status" : undefined}>
            {result.state === "none" ? "No post has been published yet. Short notes from GIO4X’s desks will appear here as they are published." : "Posts could not be loaded just now."}
          </p>
        )}
      </div>
    </section>
  );
}

export async function BlogLatest({ count = 3 }: { count?: number }) {
  return <BlogLatestView result={await latestPosts(count)} />;
}

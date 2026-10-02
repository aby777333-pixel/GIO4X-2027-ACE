/**
 * What the blog's published posts are missing for search and sharing, read
 * from `blog_posts` AS THE SIGNED-IN MEMBER OF STAFF (blog.read lets them see
 * every post). Counted from the rows at the moment the page is opened; the
 * body of a post is not read.
 */
import { SEO_TITLE_MAX } from "@/lib/server/seo-check";
import type { Db } from "@/lib/supabase/server";
import type { BlogPostRow } from "@/lib/supabase/types";

export type SeoPostFlag = "excerpt" | "description" | "cover" | "alt" | "title" | "noindex" | "scheduled";

export type SeoPostFinding = {
  id: string;
  title: string;
  /** "live": in front of the public now; "scheduled": published with a time still to come */
  state: "live" | "scheduled";
  publishedAt: string | null;
  flags: { kind: SeoPostFlag; text: string }[];
};

export type SeoPosts =
  | {
      state: "ok";
      /** published posts read (live and scheduled) */
      published: number;
      /** true when there are more published posts than were read */
      truncated: boolean;
      findings: SeoPostFinding[];
      byKind: Partial<Record<SeoPostFlag, number>>;
    }
  | { state: "failed" };

const COLUMNS = "id, title, published_at, excerpt, seo_title, seo_description, cover_path, cover_alt, noindex";
type Row = Pick<BlogPostRow, "id" | "title" | "published_at" | "excerpt" | "seo_title" | "seo_description" | "cover_path" | "cover_alt" | "noindex">;

const MAX_POSTS = 1000;

export async function readSeoPosts(supabase: Db, now: number): Promise<SeoPosts> {
  try {
    const { data, error, count } = await supabase
      .from("blog_posts")
      .select(COLUMNS, { count: "exact" })
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .order("id", { ascending: false })
      .range(0, MAX_POSTS - 1);
    if (error) return { state: "failed" };
    const rows = (data ?? []) as Row[];

    const findings: SeoPostFinding[] = [];
    const byKind: Partial<Record<SeoPostFlag, number>> = {};
    for (const row of rows) {
      const flags: SeoPostFinding["flags"] = [];
      const scheduled = !!row.published_at && Date.parse(row.published_at) > now;
      const excerpt = row.excerpt.trim();
      const description = row.seo_description.trim();
      const searchTitle = (row.seo_title.trim() || row.title.trim()).length;

      if (scheduled) flags.push({ kind: "scheduled", text: "Scheduled: not on the website yet." });
      if (!excerpt) flags.push({ kind: "excerpt", text: "No excerpt." });
      if (!description) flags.push({ kind: "description", text: excerpt ? "No meta description: the excerpt is used in its place." : "No meta description, and no excerpt to stand in for it." });
      if (!row.cover_path) flags.push({ kind: "cover", text: "No cover picture, so no picture when the post is shared unless a share picture is set." });
      else if (row.cover_alt.trim().length < 3) flags.push({ kind: "alt", text: "The cover has no alt text." });
      if (searchTitle > SEO_TITLE_MAX) flags.push({ kind: "title", text: `The title shown in search results is ${searchTitle} characters. About ${SEO_TITLE_MAX} are shown.` });
      if (row.noindex) flags.push({ kind: "noindex", text: "Marked noindex: search engines are asked to leave it out." });

      if (!flags.length) continue;
      for (const flag of flags) byKind[flag.kind] = (byKind[flag.kind] ?? 0) + 1;
      findings.push({ id: row.id, title: row.title, state: scheduled ? "scheduled" : "live", publishedAt: row.published_at, flags });
    }
    return { state: "ok", published: rows.length, truncated: (count ?? rows.length) > rows.length, findings, byKind };
  } catch {
    return { state: "failed" };
  }
}

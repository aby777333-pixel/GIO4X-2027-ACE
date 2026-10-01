import { articles, getArticle, sectionLabels } from "@/data/articles";
import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";

export const alt = "GIO4X Intelligence";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

/** Share card for an article: its section as the eyebrow, its title as the statement. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getArticle(slug);
  return renderOg({ eyebrow: a ? `Intelligence · ${sectionLabels[a.section]}` : "GIO4X Intelligence", title: a?.title ?? "GIO4X Intelligence" });
}

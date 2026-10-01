import { getTerm, glossary } from "@/data/glossary";
import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";

export const alt = "GIO4X Financial Glossary";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamicParams = false;

export function generateStaticParams() {
  return glossary.map((t) => ({ slug: t.slug }));
}

/** Share card for a glossary term: the term as the statement, its topic as the eyebrow. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getTerm(slug);
  return renderOg({ eyebrow: t ? `Glossary · ${t.topic}` : "GIO4X Glossary", title: t?.term ?? "GIO4X Financial Glossary" });
}

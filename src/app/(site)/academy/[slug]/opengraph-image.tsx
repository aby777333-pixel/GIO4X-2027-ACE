import { getLesson, lessons } from "@/data/academy";
import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";

export const alt = "GIO4X Academy";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return lessons.map((l) => ({ slug: l.slug }));
}

/** Share card for a lesson: its level as the eyebrow, its title as the statement. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = getLesson(slug);
  return renderOg({ eyebrow: l ? `Academy · ${l.level}` : "GIO4X Academy", title: l?.title ?? "GIO4X Academy" });
}

import { getTool, tools } from "@/data/tools";
import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";

export const alt = "GIO4X Trader Toolkit";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamicParams = false;

export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }));
}

/** Share card for a tool: its name and what it does. Never a result or a number. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getTool(slug);
  return renderOg({ eyebrow: `Trader Toolkit · ${t?.kind ?? "Tool"}`, title: t?.name ?? "GIO4X Trader Toolkit", detail: t?.line });
}

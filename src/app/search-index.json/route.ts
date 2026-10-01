import { buildSearchIndex } from "@/lib/search-index";

export const dynamic = "force-static";

/** The site search index, generated at build time and cached at the edge. */
export function GET() {
  return Response.json(buildSearchIndex(), {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800" },
  });
}

import { describe, edges, KIND_LABEL, nodes } from "@/data/graph";

export const dynamic = "force-static";

/**
 * A compact, static projection of the GIO4X graph for the Lens "Related" view:
 * node id, kind label, display label, page; and each edge with its sentence.
 */
export function GET() {
  return Response.json(
    {
      nodes: nodes.map((n) => ({ id: n.id, kind: KIND_LABEL[n.kind].one, label: n.label, href: n.href })),
      edges: edges.map((e) => ({ from: e.from, to: e.to, text: describe(e).sentence })),
    },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}

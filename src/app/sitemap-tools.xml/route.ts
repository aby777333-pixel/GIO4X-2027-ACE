import { urlsetResponse } from "@/lib/sitemap";
import { sitemapEntries } from "@/lib/sitemap-data";

export const dynamic = "force-static";

export function GET() {
  return urlsetResponse(sitemapEntries("tools"));
}

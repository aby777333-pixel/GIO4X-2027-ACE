import type { Metadata } from "next";
import { NotFoundContent } from "@/components/shell/NotFoundContent";
import { SiteShell } from "@/components/shell/SiteShell";

export const metadata: Metadata = { title: "This market doesn’t exist", robots: { index: false, follow: true } };

/** 404 for URLs that match no route at all: rendered with the site shell around it. */
export default function NotFound() {
  return (
    <SiteShell>
      <NotFoundContent />
    </SiteShell>
  );
}

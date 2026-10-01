import type { Metadata } from "next";
import { NotFoundContent } from "@/components/shell/NotFoundContent";

export const metadata: Metadata = { title: "This market doesn’t exist", robots: { index: false, follow: true } };

/** 404 raised by a page inside the site group (an unknown instrument, term, article): the group layout supplies the shell. */
export default function SiteNotFound() {
  return <NotFoundContent />;
}

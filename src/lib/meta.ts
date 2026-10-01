import type { Metadata } from "next";
import { site } from "@/config/site";

type PageMeta = {
  /** page title without the brand suffix */
  title: string;
  description: string;
  /** canonical path, e.g. "/markets/forex" */
  path: string;
  /** set false for utility pages (search results, preferences, gateways) */
  index?: boolean;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  /** use the title as-is, without the "| GIO4X" template */
  absoluteTitle?: boolean;
};

/**
 * One metadata builder for every route: canonical, Open Graph and X card are
 * always consistent, and tracking or filter parameters can never leak into a
 * canonical URL because the path is supplied explicitly.
 */
export function pageMeta(m: PageMeta): Metadata {
  const fullTitle = m.absoluteTitle ? m.title : `${m.title} | ${site.name}`;
  return {
    title: m.absoluteTitle ? { absolute: m.title } : m.title,
    description: m.description,
    alternates: { canonical: m.path },
    ...(m.index === false ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: m.type ?? "website",
      siteName: site.name,
      locale: "en_GB",
      url: m.path,
      title: fullTitle,
      description: m.description,
      ...(m.type === "article" ? { publishedTime: m.publishedTime, modifiedTime: m.modifiedTime ?? m.publishedTime } : {}),
    },
    twitter: { card: "summary_large_image", title: fullTitle, description: m.description },
  };
}

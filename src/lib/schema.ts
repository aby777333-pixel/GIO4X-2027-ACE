import { absoluteUrl, site } from "@/config/site";
import { socials } from "@/config/destinations";

/** One consistent GIO4X entity across the whole site. Verified facts only. */
export function organizationSchema() {
  const sameAs = Object.values(socials).filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${site.url}/#organization`,
    name: site.name,
    legalName: site.legalName,
    url: site.url,
    slogan: site.tagline,
    logo: { "@type": "ImageObject", url: absoluteUrl("/brand/gio4x-logo.png"), width: 960, height: 299 },
    email: site.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.headOffice.lines.slice(0, 2).join(", "),
      addressLocality: "Ruislip, London",
      postalCode: "HA4 7AE",
      addressCountry: "GB",
    },
    contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: site.email, availableLanguage: ["en"] }],
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site.url}/#website`,
    url: site.url,
    name: site.name,
    description: site.description,
    inLanguage: "en",
    publisher: { "@id": `${site.url}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${site.url}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export type Crumb = { name: string; href: string };

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absoluteUrl(c.href) })),
  };
}

export function webPageSchema(opts: { path: string; name: string; description: string; type?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": opts.type ?? "WebPage",
    "@id": `${absoluteUrl(opts.path)}#webpage`,
    url: absoluteUrl(opts.path),
    name: opts.name,
    description: opts.description,
    inLanguage: "en",
    isPartOf: { "@id": `${site.url}/#website` },
    publisher: { "@id": `${site.url}/#organization` },
  };
}

export function articleSchema(opts: {
  path: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  section?: string;
  type?: "Article" | "NewsArticle" | "BlogPosting" | "TechArticle";
}) {
  return {
    "@context": "https://schema.org",
    "@type": opts.type ?? "Article",
    mainEntityOfPage: absoluteUrl(opts.path),
    headline: opts.headline,
    description: opts.description,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    articleSection: opts.section,
    inLanguage: "en",
    image: absoluteUrl("/opengraph-image"),
    // Desk bylines are organisational authors: no invented individuals.
    author: { "@type": "Organization", name: opts.author, url: site.url },
    publisher: { "@id": `${site.url}/#organization` },
  };
}

export function definedTermSchema(opts: { path: string; term: string; definition: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "@id": absoluteUrl(opts.path),
    name: opts.term,
    description: opts.definition,
    url: absoluteUrl(opts.path),
    inDefinedTermSet: { "@type": "DefinedTermSet", "@id": absoluteUrl("/glossary"), name: "GIO4X Financial Glossary" },
  };
}

export function faqSchema(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
}

export function softwareSchema(opts: { path: string; name: string; description: string; os?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: opts.name,
    description: opts.description,
    url: absoluteUrl(opts.path),
    applicationCategory: "FinanceApplication",
    ...(opts.os ? { operatingSystem: opts.os } : {}),
  };
}

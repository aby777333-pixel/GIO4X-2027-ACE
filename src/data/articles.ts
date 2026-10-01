import raw from "./generated/articles.json";

/**
 * GIO4X Intelligence: article model.
 *
 * Content is carried over from the previous site after an editorial audit
 * (see docs/CONTENT-AUDIT.md). `body` is sanitised HTML restricted to an
 * allow-list of tags by the import script; nothing here is user-supplied.
 * Bylines are desks, never invented individuals.
 */
export type ArticleFormat = "Analysis" | "Explainer" | "Guide" | "Deep Dive" | "Research Note" | "GIO4X";

export type ArticleSection = "markets" | "macro" | "forex" | "commodities" | "crypto" | "education" | "risk" | "technical" | "platforms" | "gio4x";

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  /** meta description, human-written */
  description: string;
  section: ArticleSection;
  format: ArticleFormat;
  byline: string;
  /** ISO date of first publication */
  published: string;
  /** ISO date of the last material update, if any */
  updated?: string;
  readMinutes: number;
  tags: string[];
  /** related knowledge-graph node ids */
  related: string[];
  /** table of contents: h2 headings with anchor ids */
  toc: { id: string; text: string }[];
  /** three to five key points, written by an editor */
  brief: string[];
  body: string;
  /** shown above the body when the piece is time-sensitive */
  notice?: string;
};

export const articles: Article[] = (raw as Article[]).slice().sort((a, b) => b.published.localeCompare(a.published));

export const sectionLabels: Record<ArticleSection, string> = {
  markets: "Markets",
  macro: "Macro",
  forex: "Forex",
  commodities: "Commodities",
  crypto: "Crypto",
  education: "Education",
  risk: "Risk",
  technical: "Technical analysis",
  platforms: "Platforms",
  gio4x: "GIO4X",
};

export const latestArticles = (n = 3) => articles.slice(0, n);
export const getArticle = (slug: string) => articles.find((a) => a.slug === slug);
export const articlesBySection = (s: ArticleSection) => articles.filter((a) => a.section === s);
export const relatedArticles = (a: Article, n = 3) =>
  articles
    .filter((b) => b.slug !== a.slug)
    .map((b) => ({ b, score: (b.section === a.section ? 2 : 0) + b.tags.filter((t) => a.tags.includes(t)).length + b.related.filter((r) => a.related.includes(r)).length }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, n)
    .map((x) => x.b);

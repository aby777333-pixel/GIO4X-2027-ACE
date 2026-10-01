import { firstSentence } from "@/components/markets/graph";
import { glossary, getTerm, type Term } from "@/data/glossary";

/**
 * Server-side preparation of sanitised article HTML (see
 * scripts/import-content.mjs for the allow-list). Two things happen here, at
 * build time:
 *
 *  1. tables are wrapped so they scroll inside the measure on small screens;
 *  2. the first occurrence of a handful of glossary terms is linked to its
 *     definition, with the first sentence of the definition as a tooltip.
 *
 * Linking is deliberately sparse: at most `max` terms per piece and never
 * more than one per paragraph. Terms the piece is actually about (`prefer`)
 * are placed first; ordinary words that happen to be glossary entries are
 * never linked unless they are preferred.
 */

/** Glossary entries that are also everyday words in this kind of prose. */
const COMMON = new Set([
  "pair", "order", "flat", "offer", "range", "trend", "gap", "fill", "tick", "volume", "trader", "broker", "forex", "rally", "usd", "equity", "support", "resistance",
  "indicator", "momentum", "sentiment", "turnover", "yield", "index", "appreciation", "depreciation", "uptick", "consolidation", "open-position", "long-position", "spot-market",
  "profit-taking", "dividend", "recession", "cable", "wick", "trend-line", "candlestick", "technical-analysis", "fundamental-analysis", "risk-management", "money-management",
]);

const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Candidate = { term: Term; re: RegExp };

function pattern(t: Term): RegExp {
  const names = [t.term, ...(t.aliases ?? []).filter((a) => a.length >= 5)]
    .map((n) => n.replace(/\s*\(.*?\)\s*/g, " ").trim())
    .filter((n) => n.length >= 3)
    .sort((a, b) => b.length - a.length)
    .map((n) => escRe(n).replace(/[\s-]+/g, "[\\s-]"));
  // whole words only; a plural "s" is tolerated; short all-caps terms must match case
  const body = `(?<![\\w/-])(?:${names.join("|")})s?(?![\\w/-])`;
  return new RegExp(body, /^[A-Z0-9/ &-]{2,6}$/.test(t.term) ? "" : "i");
}

let cache: Map<string, Candidate> | null = null;
function candidates(): Map<string, Candidate> {
  if (!cache) cache = new Map(glossary.map((t) => [t.slug, { term: t, re: pattern(t) }]));
  return cache;
}

/** Link the first match of `c` inside the text nodes of `inner`, or return null. */
function linkIn(inner: string, c: Candidate): string | null {
  const parts = inner.split(/(<[^>]+>)/);
  let inAnchor = false;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith("<")) {
      if (/^<a\b/i.test(p)) inAnchor = true;
      else if (/^<\/a>/i.test(p)) inAnchor = false;
      continue;
    }
    if (inAnchor) continue;
    const m = c.re.exec(p);
    if (!m) continue;
    const title = escAttr(`${c.term.term}: ${firstSentence(c.term.definition, 170)}`);
    parts[i] = `${p.slice(0, m.index)}<a class="gloss" href="/glossary/${c.term.slug}" title="${title}">${m[0]}</a>${p.slice(m.index + m[0].length)}`;
    return parts.join("");
  }
  return null;
}

export type ProseOptions = {
  /** glossary slugs the piece is about: linked first */
  prefer?: string[];
  /** never link these (for example the term a page defines) */
  skip?: string[];
  /** maximum number of glossary links in the piece */
  max?: number;
};

export function renderProse(html: string, { prefer = [], skip = [], max = 6 }: ProseOptions = {}): { html: string; linked: Term[] } {
  const all = candidates();
  const blocks: { open: string; inner: string; close: string; used: boolean }[] = [];
  // paragraphs and list items are the only places a term is linked (never headings or table cells)
  const shell = html.replace(/<(p|li)>([\s\S]*?)<\/\1>/g, (_m, tag: string, inner: string) => {
    blocks.push({ open: `<${tag}>`, inner, close: `</${tag}>`, used: false });
    return `<!--b:${blocks.length - 1}-->`;
  });

  const linked: Term[] = [];
  const done = new Set(skip);
  const place = (c: Candidate) => {
    if (linked.length >= max || done.has(c.term.slug)) return;
    for (const b of blocks) {
      if (b.used) continue;
      const next = linkIn(b.inner, c);
      if (next) {
        b.inner = next;
        b.used = true;
        done.add(c.term.slug);
        linked.push(c.term);
        return;
      }
    }
  };

  for (const slug of prefer) {
    const c = all.get(slug);
    if (c && getTerm(slug)) place(c);
  }
  // then whatever else appears, longest names first so "margin call" wins over "margin"
  const rest = [...all.values()].filter((c) => !COMMON.has(c.term.slug)).sort((a, b) => b.term.term.length - a.term.term.length);
  for (const c of rest) place(c);

  const out = shell
    .replace(/<!--b:(\d+)-->/g, (_m, i: string) => {
      const b = blocks[Number(i)];
      return `${b.open}${b.inner}${b.close}`;
    })
    .replace(/<table>/g, '<div class="scroll-x"><table>')
    .replace(/<\/table>/g, "</table></div>");
  return { html: out, linked };
}

/** Glossary slugs named in a list of knowledge-graph ids (`c:leverage` → `leverage`). */
export const conceptSlugs = (related: string[]) => related.filter((r) => r.startsWith("c:")).map((r) => r.slice(2));

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const DATE_SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
/** "15 March 2026" from an ISO date. */
export const longDate = (iso: string) => DATE.format(new Date(`${iso}T00:00:00Z`));
/** "15 Mar 2026" from an ISO date. */
export const shortDate = (iso: string) => DATE_SHORT.format(new Date(`${iso}T00:00:00Z`));

/**
 * THE GIO4X GRAPH.
 *
 * One knowledge graph for the whole site, built at module level from the data
 * modules that already exist (instruments, knowledge, glossary, tools), so it
 * cannot drift from them: add an instrument and it is in the graph.
 *
 * What this is: deterministic software over curated relations. There is no
 * model, no inference, no randomness and no market data in here.
 *
 * What the relations say: how things are documented to be connected ("is
 * priced in", "is issued by", "is commonly watched alongside"). They never say
 * how a price will move, and nothing here is a score or a signal.
 *
 * Node ids follow the convention already used across the site:
 *   ac:forex · i:eur-usd · ccy:USD · cb:fed · ev:cpi · c:leverage · t:margin · p:raptor
 */
import { assetClasses, instrumentHref, instruments, type Instrument } from "./instruments";
import { centralBanks, currencies, econEvents } from "./knowledge";
import { getTerm, hasTerm } from "./glossary";
import { tools } from "./tools";

/* ── vocabulary ─────────────────────────────────────────────────────────── */

export type NodeKind = "assetClass" | "instrument" | "currency" | "centralBank" | "event" | "concept" | "tool" | "platform";

/** Fixed order: used for sectors on the map, grouping in lists and tie-breaks. */
export const KIND_ORDER: NodeKind[] = ["assetClass", "instrument", "currency", "centralBank", "event", "concept", "tool", "platform"];

export const KIND_LABEL: Record<NodeKind, { one: string; many: string }> = {
  assetClass: { one: "Asset class", many: "Asset classes" },
  instrument: { one: "Instrument", many: "Instruments" },
  currency: { one: "Currency", many: "Currencies" },
  centralBank: { one: "Central bank", many: "Central banks" },
  event: { one: "Economic event", many: "Economic events" },
  concept: { one: "Concept", many: "Concepts" },
  tool: { one: "Tool", many: "Tools" },
  platform: { one: "Platform", many: "Platforms" },
};

export type GraphNode = {
  id: string;
  kind: NodeKind;
  /** full display name: "US Dollar", "EUR/USD", "Federal Reserve" */
  label: string;
  /** compact form for the map and chips: "USD", "Fed", "CPI" */
  short: string;
  /** one quiet line under the label */
  sub?: string;
  /** the real page for this node */
  href: string;
  /** one or two factual sentences, taken from the source data */
  blurb: string;
  /** how the node is written inside a sentence: "the US dollar", "gold (XAU/USD)" */
  phrase: string;
  /** grammatical number of `phrase`, for verb agreement */
  plural: boolean;
  /** extra strings the search matches */
  aliases: string[];
};

export type Relation =
  | "IS_IN"
  | "USES"
  | "ISSUED_BY"
  | "SETS_POLICY_VIA"
  | "TRADED_ON"
  | "CALCULATED_WITH"
  | "EXPLAINED_BY"
  | "COMMONLY_WATCHED_WITH"
  | "RELATES_TO";

export type GraphEdge = {
  from: string;
  to: string;
  rel: Relation;
  /** qualifies the relation: "base" or "quote" for USES */
  note?: string;
};

/** A piece of a sentence. Pieces that name a node carry its id and page. */
export type SentencePart = { text: string; id?: string; href?: string };

/** One relation seen from one end. */
export type Link = {
  node: GraphNode;
  edge: GraphEdge;
  rel: Relation;
  /** true when the edge runs from the node asked about to `node` */
  outgoing: boolean;
  sentence: string;
  parts: SentencePart[];
};

export type Hop = { from: GraphNode; to: GraphNode; edge: GraphEdge; sentence: string; parts: SentencePart[] };
export type Path = { nodes: GraphNode[]; hops: Hop[] };

/* ── small text helpers ─────────────────────────────────────────────────── */

function firstSentence(text: string, max = 220): string {
  const m = text.match(/^.*?[.!?](?=\s|$)/);
  const s = (m ? m[0] : text).trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** Lower-case the listed common nouns, leave everything else as written. */
function lowerNouns(s: string, nouns: string[]): string {
  return s
    .split(" ")
    .map((w) => (nouns.includes(w.toLowerCase()) ? w.toLowerCase() : w))
    .join(" ");
}

/** Lower-case ordinary words; keep acronyms and camel-case names (CFD, FOMC, MetaTrader). */
function lowerWords(s: string): string {
  return s.replace(/[A-Za-z]+/g, (w) => (/[A-Z]/.test(w.slice(1)) ? w : w.toLowerCase()));
}

const stripParens = (s: string) => s.replace(/\s*\([^)]*\)\s*/g, " ").trim();
const isAcronym = (s: string) => /^[A-Z0-9&]+$/.test(s);
const looksPlural = (s: string) => /[^su]s$/i.test(s) && !/(is|ss)$/i.test(s);
const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const CURRENCY_NOUNS = ["dollar", "euro", "pound", "yen", "franc"];
const COMMODITY_NOUNS = ["gold", "silver", "platinum", "palladium", "crude", "oil", "natural", "gas"];

/* ── nodes ──────────────────────────────────────────────────────────────── */

function instrumentPhrase(i: Instrument): string {
  switch (i.class) {
    case "forex":
      return i.symbol;
    case "indices":
      return `the ${i.name} (${i.symbol})`;
    case "equities":
      return `${i.name} (${i.symbol})`;
    default: {
      const subject = lowerNouns(i.name.split(" / ")[0], COMMODITY_NOUNS);
      return subject === i.base ? i.symbol : `${subject} (${i.symbol})`;
    }
  }
}

/**
 * Glossary terms that become concept nodes. Curated rather than exhaustive:
 * the terms the rest of the data points at, plus the core vocabulary.
 */
const CORE_CONCEPTS = [
  "pip", "spread", "leverage", "margin", "swap", "slippage", "volatility", "liquidity", "correlation", "hedging",
  "carry-trade", "inflation", "monetary-policy", "real-yields", "safe-haven", "recession", "cfd", "drawdown",
  "central-bank", "fomc", "gdp", "nfp", "interest-rate-differential", "notional-value", "contract-size", "free-margin",
  "stop-out", "currency-pair", "forex", "metatrader", "expert-advisor", "hawkish", "dovish", "quantitative-easing", "deflation",
];

/**
 * Curated "explained by" links that the source data does not carry itself.
 * Each is a plain statement of vocabulary, nothing more.
 */
const CURATED_EXPLAINERS: [string, string][] = [
  ["ev:gdp", "c:gdp"],
  ["ev:non-farm-payrolls", "c:nfp"],
  ["ev:cpi", "c:inflation"],
  ["ev:interest-rate-decision", "c:monetary-policy"],
  ["cb:fed", "c:fomc"],
  ...centralBanks.map((b): [string, string] => [`cb:${b.slug}`, "c:central-bank"]),
  ["ac:forex", "c:forex"],
  ["ac:forex", "c:currency-pair"],
  ["p:mt5", "c:metatrader"],
  ["p:mt5", "c:expert-advisor"],
];

const unresolvedMap = new Map<string, Set<string>>();
function noteUnresolved(id: string, source: string) {
  const set = unresolvedMap.get(id) ?? new Set<string>();
  set.add(source);
  unresolvedMap.set(id, set);
}

function buildNodes(): GraphNode[] {
  const out: GraphNode[] = [];

  for (const a of assetClasses) {
    out.push({
      id: `ac:${a.key}`, kind: "assetClass", label: a.name, short: a.name, sub: "Asset class",
      href: `/markets/${a.key}`, blurb: a.line, phrase: `the ${a.name} asset class`, plural: false, aliases: [],
    });
  }

  for (const i of instruments) {
    out.push({
      id: `i:${i.slug}`, kind: "instrument", label: i.symbol, short: i.symbol, sub: i.name,
      href: instrumentHref(i), blurb: i.about, phrase: instrumentPhrase(i), plural: false, aliases: [i.name, i.code, ...i.aliases],
    });
  }

  for (const c of currencies) {
    const noun = lowerNouns(c.name, CURRENCY_NOUNS);
    out.push({
      id: `ccy:${c.code}`, kind: "currency", label: c.name, short: c.code, sub: `${c.code} · ${c.area}`,
      // A currency's home on this site is the page of the bank that issues it.
      href: `/markets/central-banks/${c.bank}`, blurb: c.note, phrase: `the ${noun}`, plural: false, aliases: [c.code, ...c.nicknames],
    });
  }

  for (const b of centralBanks) {
    out.push({
      id: `cb:${b.slug}`, kind: "centralBank", label: b.name, short: b.short, sub: `${b.short} · ${b.area}`,
      href: `/markets/central-banks/${b.slug}`,
      blurb: `The central bank for ${b.area}, based in ${b.city}. Policy is set by its ${b.committee}. Mandate: ${b.mandate}`,
      phrase: `the ${b.name}`, plural: false, aliases: [b.short, b.currency, b.committee],
    });
  }

  for (const e of econEvents) {
    const lower = e.name.toLowerCase();
    // A policy decision is one of many: it reads best in the plural ("interest rate decisions").
    const many = e.kind === "Monetary policy" && !looksPlural(lower);
    const phrase = isAcronym(e.short) ? e.short : many ? `${lower}s` : looksPlural(lower) ? lower : `the ${lower}`;
    out.push({
      id: `ev:${e.slug}`, kind: "event", label: e.name, short: e.short, sub: `${e.kind} · ${e.cadence}`,
      href: `/markets/events/${e.slug}`, blurb: firstSentence(e.what), phrase, plural: !isAcronym(e.short) && (many || looksPlural(lower)), aliases: [e.short],
    });
  }

  // concepts: every `c:` id the data refers to, every glossary slug the tools
  // and asset classes point at, and the core list. Only published terms.
  const wanted = new Map<string, string>();
  const want = (slug: string, source: string) => {
    if (!wanted.has(slug)) wanted.set(slug, source);
  };
  for (const i of instruments) for (const r of i.related) if (r.startsWith("c:")) want(r.slice(2), `instruments.ts › ${i.slug}.related`);
  for (const e of econEvents) for (const r of e.related) if (r.startsWith("c:")) want(r.slice(2), `knowledge.ts › ${e.slug}.related`);
  for (const a of assetClasses) for (const g of a.related.glossary) want(g, `instruments.ts › assetClasses.${a.key}.related.glossary`);
  for (const t of tools) for (const g of t.glossary) want(g, `tools.ts › ${t.slug}.glossary`);
  for (const [, c] of CURATED_EXPLAINERS) want(c.slice(2), "graph.ts › CURATED_EXPLAINERS");
  for (const s of CORE_CONCEPTS) want(s, "graph.ts › CORE_CONCEPTS");

  for (const [slug, source] of wanted) {
    const t = hasTerm(slug) ? getTerm(slug) : undefined;
    if (!t) {
      noteUnresolved(`c:${slug}`, source);
      continue;
    }
    const short = stripParens(t.term);
    const phrase = lowerWords(short);
    out.push({
      id: `c:${slug}`, kind: "concept", label: t.term, short, sub: t.topic,
      href: `/glossary/${slug}`, blurb: firstSentence(t.definition), phrase, plural: looksPlural(phrase), aliases: t.aliases ?? [],
    });
  }

  for (const t of tools) {
    out.push({
      id: `t:${t.slug}`, kind: "tool", label: t.name, short: t.name, sub: t.kind,
      href: `/tools/${t.slug}`, blurb: t.line, phrase: `the ${t.name} tool`, plural: false, aliases: t.aliases,
    });
  }

  out.push(
    {
      id: "p:raptor", kind: "platform", label: "777 Raptor", short: "Raptor", sub: "GIO4X proprietary platform",
      href: "/platforms/raptor", blurb: "GIO4X’s own multi-asset trading workspace, on web, desktop and mobile.",
      phrase: "777 Raptor", plural: false, aliases: ["raptor", "777"],
    },
    {
      id: "p:mt5", kind: "platform", label: "MetaTrader 5", short: "MT5", sub: "Platform from MetaQuotes",
      href: "/platforms/metatrader-5",
      blurb: "The multi-asset platform from MetaQuotes, with charting, order types and automated trading through Expert Advisors. MetaTrader 5 is a trademark of MetaQuotes Ltd.",
      phrase: "MetaTrader 5", plural: false, aliases: ["mt5", "metatrader", "meta trader"],
    },
  );

  return out;
}

export const nodes: GraphNode[] = buildNodes();
const byId = new Map(nodes.map((n) => [n.id, n]));
export const getNode = (id: string): GraphNode | undefined => byId.get(id);

const kindRank = (k: NodeKind) => KIND_ORDER.indexOf(k);
/** Stable ordering of nodes: by kind sector, then alphabetically. */
export const compareNodes = (a: GraphNode, b: GraphNode) => kindRank(a.kind) - kindRank(b.kind) || a.label.localeCompare(b.label, "en") || a.id.localeCompare(b.id);

/* ── relations: label, strength and a sentence in each direction ────────── */

type Piece = string | GraphNode | { node: GraphNode; text: string };
type Template = (a: GraphNode, b: GraphNode, note?: string) => Piece[];

const be = (n: GraphNode) => (n.plural ? "are" : "is");
const term = (n: GraphNode): Piece => ({ node: n, text: `“${n.phrase}”` });
const titled = (n: GraphNode): Piece => ({ node: n, text: n.label });

/** "Related to" reads differently when one or both ends are vocabulary rather than things. */
function relatesTo(a: GraphNode, b: GraphNode): Piece[] {
  const ca = a.kind === "concept";
  const cb = b.kind === "concept";
  if (ca && cb) return ["The terms ", term(a), " and ", term(b), " are related."];
  if (cb) return [a, ` ${be(a)} commonly discussed in terms of `, term(b), "."];
  if (ca) return ["The term ", term(a), " is commonly used when discussing ", b, "."];
  return [a, ` ${be(a)} commonly monitored alongside `, b, "."];
}

/**
 * `rank` orders relations from structural (1) to associative (4). It is used
 * only to choose between equally short paths and to sort lists.
 */
export const RELATIONS: Record<Relation, { label: string; rank: number; forward: Template; reverse: Template }> = {
  SETS_POLICY_VIA: {
    label: "Sets policy through",
    rank: 1,
    forward: (a) => [a, " sets policy through its interest rate decisions."],
    reverse: (a, b) => [{ node: b, text: `an ${b.label.toLowerCase()}` }, " is the announcement at which ", a, " sets its policy rate."],
  },
  ISSUED_BY: {
    label: "Issued by",
    rank: 2,
    forward: (a, b) => [a, " is issued by ", b, "."],
    reverse: (a, b) => [b, " issues ", a, "."],
  },
  USES: {
    label: "Priced in",
    rank: 2,
    forward: (a, b, note) => {
      if (note === "base") return [a, " has ", b, " as its base currency."];
      const many = b.phrase.replace(/^the /, "");
      return [a, " is priced in ", { node: b, text: /yen$/.test(many) ? many : `${many}s` }, "."];
    },
    reverse: (a, b, note) => (note === "base" ? [b, " is the base currency of ", a, "."] : [b, " is the currency in which ", a, " is priced."]),
  },
  IS_IN: {
    label: "Belongs to",
    rank: 3,
    forward: (a, b) => [a, " belongs to ", b, "."],
    reverse: (a, b) => [b, " includes ", a, "."],
  },
  EXPLAINED_BY: {
    label: "Explained by",
    rank: 3,
    forward: (a, b) => [a, ` ${be(a)} explained using the term `, term(b), "."],
    reverse: (a, b) => ["The term ", term(b), " is used to explain ", a, "."],
  },
  CALCULATED_WITH: {
    label: "Worked out with",
    rank: 3,
    forward: (a, b) => (a.kind === "concept" ? ["The term ", term(a), " can be worked through with ", b, "."] : [a, " can be worked through with ", b, "."]),
    reverse: (a, b) => (a.kind === "concept" ? [b, " works with the term ", term(a), "."] : [b, " works with ", a, "."]),
  },
  RELATES_TO: {
    label: "Related to",
    rank: 3,
    forward: (a, b) => relatesTo(a, b),
    reverse: (a, b) => relatesTo(b, a),
  },
  TRADED_ON: {
    label: "Offered on",
    rank: 4,
    forward: (a, b) => [a, " is offered by GIO4X on ", titled(b), "."],
    reverse: (a, b) => [titled(b), " is one of the two platforms on which GIO4X offers ", a, "."],
  },
  COMMONLY_WATCHED_WITH: {
    label: "Commonly watched with",
    rank: 4,
    forward: (a, b) => [a, ` ${be(a)} commonly watched alongside `, b, "."],
    reverse: (a, b) => [b, ` ${be(b)} commonly watched alongside `, a, "."],
  },
};

function toParts(pieces: Piece[]): SentencePart[] {
  const parts = pieces.map((p): SentencePart => {
    if (typeof p === "string") return { text: p };
    if ("node" in p) return { text: p.text, id: p.node.id, href: p.node.href };
    return { text: p.phrase, id: p.id, href: p.href };
  });
  if (parts.length) parts[0] = { ...parts[0], text: capFirst(parts[0].text) };
  return parts;
}

/** The sentence for an edge, read from `fromId` (either end of the edge). */
export function describe(edge: GraphEdge, fromId: string = edge.from): { sentence: string; parts: SentencePart[] } {
  const a = byId.get(edge.from);
  const b = byId.get(edge.to);
  if (!a || !b) return { sentence: "", parts: [] };
  const r = RELATIONS[edge.rel];
  const parts = toParts(fromId === edge.to ? r.reverse(a, b, edge.note) : r.forward(a, b, edge.note));
  return { sentence: parts.map((p) => p.text).join(""), parts };
}

/* ── edges ──────────────────────────────────────────────────────────────── */

function buildEdges(): GraphEdge[] {
  const out: GraphEdge[] = [];
  const seen = new Set<string>();
  /** One edge per unordered pair. Passes run from the most specific relation to the least, so the specific one wins. */
  const add = (from: string, to: string, rel: Relation, source: string, note?: string) => {
    if (from === to) return;
    let ok = true;
    for (const id of [from, to]) {
      if (!byId.has(id)) {
        noteUnresolved(id, source);
        ok = false;
      }
    }
    if (!ok) return;
    const key = from < to ? `${from}|${to}` : `${to}|${from}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(note ? { from, to, rel, note } : { from, to, rel });
  };
  const isCcy = (code?: string) => !!code && currencies.some((c) => c.code === code);

  // 1 · structure
  for (const b of centralBanks) add(`cb:${b.slug}`, "ev:interest-rate-decision", "SETS_POLICY_VIA", "knowledge.ts › centralBanks");
  for (const c of currencies) add(`ccy:${c.code}`, `cb:${c.bank}`, "ISSUED_BY", `knowledge.ts › currencies.${c.code}.bank`);
  for (const b of centralBanks) if (!isCcy(b.currency)) noteUnresolved(`ccy:${b.currency}`, `knowledge.ts › centralBanks.${b.slug}.currency`);
  for (const i of instruments) {
    if (isCcy(i.quote)) add(`i:${i.slug}`, `ccy:${i.quote}`, "USES", `instruments.ts › ${i.slug}.quote`, "quote");
    if (isCcy(i.base)) add(`i:${i.slug}`, `ccy:${i.base}`, "USES", `instruments.ts › ${i.slug}.base`, "base");
  }
  for (const i of instruments) add(`i:${i.slug}`, `ac:${i.class}`, "IS_IN", `instruments.ts › ${i.slug}.class`);

  // 2 · vocabulary and tools
  for (const a of assetClasses) for (const g of a.related.glossary) add(`ac:${a.key}`, `c:${g}`, "EXPLAINED_BY", `instruments.ts › assetClasses.${a.key}.related.glossary`);
  for (const [from, to] of CURATED_EXPLAINERS) add(from, to, "EXPLAINED_BY", "graph.ts › CURATED_EXPLAINERS");
  for (const t of tools) for (const g of t.glossary) add(`c:${g}`, `t:${t.slug}`, "CALCULATED_WITH", `tools.ts › ${t.slug}.glossary`);
  for (const n of nodes) {
    if (n.kind !== "concept") continue;
    for (const slug of getTerm(n.id.slice(2))?.tools ?? []) add(n.id, `t:${slug}`, "CALCULATED_WITH", `glossary.ts › ${n.id.slice(2)}.tools`);
  }
  for (const a of assetClasses) for (const t of a.related.tools) add(`ac:${a.key}`, `t:${t}`, "CALCULATED_WITH", `instruments.ts › assetClasses.${a.key}.related.tools`);

  // 3 · curated associations
  for (const i of instruments) {
    for (const r of i.related) if (!r.startsWith("ev:")) add(`i:${i.slug}`, r, "RELATES_TO", `instruments.ts › ${i.slug}.related`);
  }
  for (const e of econEvents) for (const r of e.related) add(`ev:${e.slug}`, r, "RELATES_TO", `knowledge.ts › ${e.slug}.related`);
  for (const n of nodes) {
    if (n.kind !== "concept") continue;
    // glossary cross-references, kept only where both terms are concept nodes
    for (const slug of getTerm(n.id.slice(2))?.related ?? []) if (byId.has(`c:${slug}`)) add(n.id, `c:${slug}`, "RELATES_TO", `glossary.ts › ${n.id.slice(2)}.related`);
  }

  // 4 · platforms and "watched by"
  for (const a of assetClasses) for (const p of ["p:raptor", "p:mt5"]) add(`ac:${a.key}`, p, "TRADED_ON", "graph.ts › platforms");
  for (const e of econEvents) for (const w of e.watchedBy) add(`ev:${e.slug}`, w, "COMMONLY_WATCHED_WITH", `knowledge.ts › ${e.slug}.watchedBy`);
  for (const i of instruments) {
    for (const r of i.related) if (r.startsWith("ev:")) add(r, `i:${i.slug}`, "COMMONLY_WATCHED_WITH", `instruments.ts › ${i.slug}.related`);
  }
  for (const a of assetClasses) for (const e of a.related.events) add(`ev:${e}`, `ac:${a.key}`, "COMMONLY_WATCHED_WITH", `instruments.ts › assetClasses.${a.key}.related.events`);

  return out;
}

export const edges: GraphEdge[] = buildEdges();

/**
 * Ids the source data refers to that do not resolve to a node, with where each
 * reference comes from. For the maintainers: fix the source, not the graph.
 */
export const unresolved: { id: string; sources: string[] }[] = [...unresolvedMap].map(([id, s]) => ({ id, sources: [...s] })).sort((a, b) => a.id.localeCompare(b.id));

/* ── adjacency ──────────────────────────────────────────────────────────── */

const adjacency = new Map<string, Link[]>();
for (const n of nodes) adjacency.set(n.id, []);
for (const edge of edges) {
  const a = byId.get(edge.from);
  const b = byId.get(edge.to);
  if (!a || !b) continue;
  adjacency.get(a.id)?.push({ node: b, edge, rel: edge.rel, outgoing: true, ...describe(edge, a.id) });
  adjacency.get(b.id)?.push({ node: a, edge, rel: edge.rel, outgoing: false, ...describe(edge, b.id) });
}
for (const list of adjacency.values()) list.sort((x, y) => compareNodes(x.node, y.node));

const EMPTY: Link[] = [];

/** Every node directly related to `id`, each with the sentence that relates them, in kind-then-name order. */
export function neighbours(id: string): Link[] {
  return adjacency.get(id) ?? EMPTY;
}

export const degree = (id: string) => neighbours(id).length;

/* ── paths ──────────────────────────────────────────────────────────────── */

/**
 * Shortest path between two nodes (breadth-first). Among paths of equal
 * length the one built from the more structural relations is chosen, so the
 * result is stable and reads well. Returns null when no path exists.
 */
export function shortestPath(a: string, b: string): Path | null {
  const start = byId.get(a);
  const goal = byId.get(b);
  if (!start || !goal) return null;
  if (a === b) return { nodes: [start], hops: [] };

  const dist = new Map<string, number>([[a, 0]]);
  const cost = new Map<string, number>([[a, 0]]);
  const prev = new Map<string, Link>();
  const queue: string[] = [a];
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head];
    const du = dist.get(u) ?? 0;
    const cu = cost.get(u) ?? 0;
    if (dist.has(b) && du >= (dist.get(b) ?? 0)) break;
    for (const link of neighbours(u)) {
      const v = link.node.id;
      const c = cu + RELATIONS[link.rel].rank;
      const dv = dist.get(v);
      if (dv === undefined) {
        dist.set(v, du + 1);
        cost.set(v, c);
        prev.set(v, { ...link, node: byId.get(u) ?? link.node });
        queue.push(v);
      } else if (dv === du + 1 && c < (cost.get(v) ?? Infinity)) {
        cost.set(v, c);
        prev.set(v, { ...link, node: byId.get(u) ?? link.node });
      }
    }
  }
  if (!dist.has(b)) return null;

  const hops: Hop[] = [];
  let at = b;
  while (at !== a) {
    const step = prev.get(at);
    const to = byId.get(at);
    if (!step || !to) return null;
    const from = step.node;
    hops.unshift({ from, to, edge: step.edge, ...describe(step.edge, from.id) });
    at = from.id;
  }
  return { nodes: [start, ...hops.map((h) => h.to)], hops };
}

export type Connection = {
  /** the valid, de-duplicated ids that were asked for, in order */
  ids: string[];
  /** every node in the connecting sub-graph, picks first */
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** shortest path for every pair of picks */
  paths: Path[];
  /** the hops that lead from each pick to the next, each edge stated once */
  chain: Hop[];
  /** hops from the remaining pairs that the chain did not already state */
  also: Hop[];
  /** pairs of picks with no path between them */
  missing: [GraphNode, GraphNode][];
};

const edgeKey = (e: GraphEdge) => (e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`);

/** The union of pairwise shortest paths between two to five nodes. */
export function connect(ids: string[]): Connection {
  const picked = [...new Set(ids)].filter((id) => byId.has(id)).slice(0, 5);
  const paths: Path[] = [];
  const missing: [GraphNode, GraphNode][] = [];
  const chain: Hop[] = [];
  const also: Hop[] = [];
  const stated = new Set<string>();
  const subNodes = new Map<string, GraphNode>();
  const subEdges: GraphEdge[] = [];
  for (const id of picked) {
    const n = byId.get(id);
    if (n) subNodes.set(id, n);
  }

  const take = (i: number, j: number, into: Hop[]) => {
    const p = shortestPath(picked[i], picked[j]);
    const a = byId.get(picked[i]);
    const b = byId.get(picked[j]);
    if (!p) {
      if (a && b) missing.push([a, b]);
      return;
    }
    paths.push(p);
    for (const n of p.nodes) subNodes.set(n.id, n);
    for (const h of p.hops) {
      const k = edgeKey(h.edge);
      if (stated.has(k)) continue;
      stated.add(k);
      subEdges.push(h.edge);
      into.push(h);
    }
  };

  for (let i = 0; i + 1 < picked.length; i++) take(i, i + 1, chain);
  for (let i = 0; i < picked.length; i++) for (let j = i + 2; j < picked.length; j++) take(i, j, also);

  return { ids: picked, nodes: [...subNodes.values()], edges: subEdges, paths, chain, also, missing };
}

/* ── for other pages ────────────────────────────────────────────────────── */

export type Related = Link & { distance: 1 | 2 };

/**
 * Related nodes for a page to show: direct relations first (structural before
 * associative), then, if there is room, things one step further out.
 */
export function relatedFor(id: string, opts: { kinds?: NodeKind[]; limit?: number } = {}): Related[] {
  const { kinds, limit = 6 } = opts;
  const allow = (n: GraphNode) => !kinds || kinds.includes(n.kind);
  const out: Related[] = [];
  const seen = new Set<string>([id]);
  const direct = [...neighbours(id)].sort((x, y) => RELATIONS[x.rel].rank - RELATIONS[y.rel].rank || compareNodes(x.node, y.node));
  for (const l of direct) {
    seen.add(l.node.id);
    if (allow(l.node)) out.push({ ...l, distance: 1 });
  }
  if (out.length < limit) {
    for (const l of direct) {
      for (const m of neighbours(l.node.id)) {
        if (out.length >= limit) break;
        if (seen.has(m.node.id)) continue;
        seen.add(m.node.id);
        if (allow(m.node)) out.push({ ...m, distance: 2 });
      }
    }
  }
  return out.slice(0, limit);
}

/** Plain, deterministic search over labels and aliases. */
export function searchNodes(query: string, limit = 8): GraphNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { n: GraphNode; s: number }[] = [];
  for (const n of nodes) {
    const names = [n.label, n.short, ...n.aliases].map((x) => x.toLowerCase());
    let s = 0;
    if (names.some((x) => x === q)) s = 4;
    else if (names.slice(0, 2).some((x) => x.startsWith(q))) s = 3;
    else if (names.some((x) => x.startsWith(q) || x.split(/[\s/]+/).some((w) => w.startsWith(q)))) s = 2;
    else if (q.length > 2 && names.some((x) => x.includes(q))) s = 1;
    if (s) scored.push({ n, s });
  }
  return scored.sort((a, b) => b.s - a.s || compareNodes(a.n, b.n)).slice(0, limit).map((x) => x.n);
}

/** Counts for the method note: computed, never typed in. */
export const graphStats = {
  nodes: nodes.length,
  edges: edges.length,
  byKind: KIND_ORDER.map((k) => ({ kind: k, count: nodes.filter((n) => n.kind === k).length })),
};

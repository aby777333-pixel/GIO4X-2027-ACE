/**
 * GIO4X search: one small, dependency-free engine shared by the command bar,
 * the /search page and the 404 "were you looking for" suggestions.
 *
 * It understands the way people actually type financial things:
 *   EURUSD = EUR/USD = eur usd      (symbol normalisation)
 *   gold → XAU/USD, sterling → GBP  (aliases, carried on each entry)
 *   "leverege", "bitcon"            (typo tolerance, edit distance ≤ 2)
 *   $EURUSD   define:slippage   calc:margin   verify:https://…   (prefixes)
 *   "open gold", "explain leverage", "find articles about inflation"
 */

export type SearchGroup =
  | "Instruments"
  | "Markets"
  | "Tools"
  | "Glossary"
  | "Academy"
  | "Intelligence"
  | "Platforms"
  | "Trading"
  | "Company"
  | "Trust & legal"
  | "Labs"
  | "Help";

export type SearchEntry = {
  /** title */
  t: string;
  /** one-line description */
  d?: string;
  /** href */
  h: string;
  g: SearchGroup;
  /** aliases / keywords, lower case */
  k?: string[];
  /** ranking weight, default 1 */
  w?: number;
};

export type SearchHit = SearchEntry & { score: number };

export type Intent =
  | { kind: "search"; query: string; bias?: SearchGroup[] }
  | { kind: "symbol"; query: string }
  | { kind: "define"; query: string }
  | { kind: "calc"; query: string }
  | { kind: "verify"; query: string }
  | { kind: "phi" }
  | { kind: "command"; id: CommandId; label: string };

export type CommandId = "theme-dark" | "theme-light" | "theme-auto" | "motion-reduce" | "motion-full" | "contrast-high" | "text-large" | "reset";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9φ.]+/g, " ")
    .trim();

/** "eur/usd", "eur usd", "EURUSD" → "eurusd" */
const squash = (s: string) => norm(s).replace(/\s+/g, "");

const STOP = new Set([
  "a", "an", "the", "of", "to", "for", "about", "on", "in", "me", "my", "is", "are", "what", "whats", "how", "do", "does", "i", "please", "and", "with", "today", "todays",
]);
const VERBS: Record<string, SearchGroup[] | undefined> = {
  open: undefined,
  show: undefined,
  go: undefined,
  take: undefined,
  find: undefined,
  search: undefined,
  explain: ["Glossary", "Academy"],
  define: ["Glossary"],
  learn: ["Academy", "Glossary"],
  teach: ["Academy", "Glossary"],
  calculate: ["Tools"],
  compare: ["Platforms", "Trading"],
  read: ["Intelligence"],
  articles: ["Intelligence"],
  article: ["Intelligence"],
};

const COMMANDS: { id: CommandId; label: string; match: RegExp }[] = [
  { id: "theme-dark", label: "Switch to dark mode", match: /\b(dark|night)\b.*\b(mode|theme)?\b|^dark$/ },
  { id: "theme-light", label: "Switch to light mode", match: /\b(light|day)\b.*\b(mode|theme)\b|^light$/ },
  { id: "theme-auto", label: "Follow system appearance", match: /\b(auto|system)\b.*\b(mode|theme|appearance)\b/ },
  { id: "motion-reduce", label: "Reduce motion", match: /\b(reduce|less|stop|disable)\b.*\b(motion|animation|animations)\b/ },
  { id: "motion-full", label: "Restore motion", match: /\b(restore|enable|full)\b.*\b(motion|animation|animations)\b/ },
  { id: "contrast-high", label: "Higher contrast", match: /\b(high|higher|more)\b.*\bcontrast\b/ },
  { id: "text-large", label: "Larger text", match: /\b(larger|bigger|increase)\b.*\b(text|font)\b/ },
  { id: "reset", label: "Reset to GIO4X default", match: /\breset\b.*\b(default|preferences|display|gio4x)\b/ },
];

export function parseIntent(raw: string): Intent {
  const q = raw.trim();
  if (!q) return { kind: "search", query: "" };
  if (/^(φ|phi|1\.618\d*)$/i.test(q)) return { kind: "phi" };
  if (q.startsWith("$")) return { kind: "symbol", query: q.slice(1) };
  const prefix = /^(define|calc|verify)\s*:\s*(.*)$/i.exec(q);
  if (prefix) {
    const kind = prefix[1].toLowerCase() as "define" | "calc" | "verify";
    return { kind, query: prefix[2] };
  }
  const n = norm(q);
  if (n.startsWith("switch ") || n.startsWith("turn ") || /\b(mode|theme|motion|contrast|text)\b/.test(n) || n === "dark" || n === "light") {
    const cmd = COMMANDS.find((c) => c.match.test(n));
    if (cmd) return { kind: "command", id: cmd.id, label: cmd.label };
  }
  const words = n.split(" ");
  let bias: SearchGroup[] | undefined;
  const kept: string[] = [];
  for (const w of words) {
    if (w in VERBS) {
      bias = VERBS[w] ?? bias;
      continue;
    }
    if (STOP.has(w)) continue;
    kept.push(w);
  }
  return { kind: "search", query: kept.join(" ") || n, bias };
}

/** Damerau–Levenshtein with early exit; returns max+1 when over budget. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, (prev2[j - 2] ?? 0) + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev = cur;
  }
  return prev[b.length];
}

function scoreEntry(e: SearchEntry, qWords: string[], qSquash: string): number {
  const title = norm(e.t);
  const titleSquash = squash(e.t);
  const keys = e.k ?? [];
  let score = 0;

  // symbol / exact forms
  if (qSquash.length >= 2) {
    if (titleSquash === qSquash) score += 120;
    else if (keys.some((k) => squash(k) === qSquash)) score += 110;
    else if (titleSquash.startsWith(qSquash)) score += 60;
    else if (keys.some((k) => squash(k).startsWith(qSquash))) score += 45;
  }

  const titleWords = title.split(" ");
  const keyWords = keys.flatMap((k) => norm(k).split(" "));
  const descWords = e.d ? norm(e.d).split(" ") : [];
  let matched = 0;
  for (const w of qWords) {
    let best = 0;
    for (const tw of titleWords) {
      if (tw === w) best = Math.max(best, 30);
      else if (tw.startsWith(w) && w.length >= 2) best = Math.max(best, 20);
      else if (w.length >= 4 && distance(w, tw, w.length >= 7 ? 2 : 1) <= (w.length >= 7 ? 2 : 1)) best = Math.max(best, 12);
    }
    for (const kw of keyWords) {
      if (kw === w) best = Math.max(best, 24);
      else if (kw.startsWith(w) && w.length >= 2) best = Math.max(best, 14);
      else if (w.length >= 4 && distance(w, kw, w.length >= 7 ? 2 : 1) <= (w.length >= 7 ? 2 : 1)) best = Math.max(best, 9);
    }
    if (best === 0 && w.length >= 3) {
      for (const dw of descWords) {
        if (dw === w) best = Math.max(best, 6);
        else if (dw.startsWith(w)) best = Math.max(best, 4);
      }
    }
    if (best > 0) matched++;
    score += best;
  }
  // every word must contribute unless a symbol form already matched
  if (matched < qWords.length && score < 45) return 0;
  return score * (e.w ?? 1);
}

export function search(index: SearchEntry[], raw: string, opts: { limit?: number; bias?: SearchGroup[]; only?: SearchGroup[] } = {}): SearchHit[] {
  const q = norm(raw);
  if (!q) return [];
  const qWords = q.split(" ").filter(Boolean);
  const qSquash = squash(raw);
  const hits: SearchHit[] = [];
  for (const e of index) {
    if (opts.only && !opts.only.includes(e.g)) continue;
    let s = scoreEntry(e, qWords, qSquash);
    if (s <= 0) continue;
    if (opts.bias?.includes(e.g)) s *= 1.618;
    hits.push({ ...e, score: s });
  }
  hits.sort((a, b) => b.score - a.score || a.t.length - b.t.length);
  return hits.slice(0, opts.limit ?? 24);
}

export const GROUP_ORDER: SearchGroup[] = [
  "Instruments",
  "Markets",
  "Tools",
  "Glossary",
  "Academy",
  "Intelligence",
  "Platforms",
  "Trading",
  "Labs",
  "Trust & legal",
  "Company",
  "Help",
];

export function groupHits(hits: SearchHit[]): { group: SearchGroup; hits: SearchHit[] }[] {
  const by = new Map<SearchGroup, SearchHit[]>();
  for (const h of hits) {
    const list = by.get(h.g) ?? [];
    list.push(h);
    by.set(h.g, list);
  }
  // groups ordered by their best hit, so the most relevant kind of thing leads
  return [...by.entries()]
    .sort((a, b) => b[1][0].score - a[1][0].score || GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]))
    .map(([group, hs]) => ({ group, hits: hs }));
}

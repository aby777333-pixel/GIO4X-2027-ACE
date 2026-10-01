/**
 * The Markets knowledge graph, resolved.
 *
 * Instruments, events and asset classes refer to each other by short ids
 * (`ccy:USD`, `cb:fed`, `ev:cpi`, `c:real-yields`, `ac:energy`, `i:eur-usd`).
 * This module turns those ids into links that exist on the site. An id that
 * cannot be resolved (for example a glossary slug that is not published) is
 * skipped silently: a page never shows a dead link.
 */
import { assetClasses, getAssetClass, instrumentHref, instruments, type AssetClassKey, type Instrument } from "@/data/instruments";
import { getTerm, hasTerm } from "@/data/glossary";
import { centralBanks, econEvents, getBank, getCurrency, getEvent, type CentralBank, type EconEvent } from "@/data/knowledge";
import { getTool } from "@/data/tools";
import { isRateCurrency, type RateCurrency } from "@/lib/rates";

export type NodeKind = "Currency" | "Central bank" | "Economic event" | "Concept" | "Asset class" | "Instrument" | "Tool";

export type Resolved = {
  id: string;
  kind: NodeKind;
  label: string;
  href: string;
  /** one quiet line of context */
  note?: string;
  /** short form for dense places (chips, tables) */
  short?: string;
};

export const bankHref = (slug: string) => `/markets/central-banks/${slug}`;
export const eventHref = (slug: string) => `/markets/events/${slug}`;
export const termHref = (slug: string) => `/glossary/${slug}`;
export const toolHref = (slug: string) => `/tools/${slug}`;
export const classHref = (key: string) => `/markets/${key}`;

export const instrumentBySlug = (slug: string) => instruments.find((i) => i.slug === slug);

/** First sentence of a longer text, for one-line notes. */
export function firstSentence(text: string, max = 150): string {
  const m = text.match(/^.*?[.!?](?=\s|$)/);
  const s = (m ? m[0] : text).trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function resolveId(id: string): Resolved | null {
  const at = id.indexOf(":");
  if (at < 0) return null;
  const type = id.slice(0, at);
  const key = id.slice(at + 1);
  switch (type) {
    case "ccy": {
      const c = getCurrency(key);
      if (!c) return null;
      // A currency's home on this site is the page of the bank that issues it.
      return { id, kind: "Currency", label: c.name, short: c.code, href: `${bankHref(c.bank)}#currency`, note: c.note };
    }
    case "cb": {
      const b = getBank(key);
      if (!b) return null;
      return { id, kind: "Central bank", label: b.name, short: b.short, href: bankHref(b.slug), note: `${b.instrument}. ${b.city.endsWith(".") ? b.city.slice(0, -1) : b.city}.` };
    }
    case "ev": {
      const e = getEvent(key);
      if (!e) return null;
      return { id, kind: "Economic event", label: e.name, short: e.short, href: eventHref(e.slug), note: `${e.kind}. ${e.cadence}.` };
    }
    case "c": {
      if (!hasTerm(key)) return null;
      const t = getTerm(key);
      if (!t) return null;
      return { id, kind: "Concept", label: t.term, short: t.term, href: termHref(t.slug), note: firstSentence(t.definition) };
    }
    case "ac": {
      const a = getAssetClass(key);
      if (!a) return null;
      return { id, kind: "Asset class", label: a.name, short: a.name, href: classHref(a.key), note: a.line };
    }
    case "i": {
      const i = instrumentBySlug(key);
      if (!i) return null;
      return { id, kind: "Instrument", label: i.symbol, short: i.symbol, href: instrumentHref(i), note: i.name };
    }
    default:
      return null;
  }
}

export function resolveAll(ids: string[]): Resolved[] {
  const seen = new Set<string>();
  const out: Resolved[] = [];
  for (const id of ids) {
    const r = resolveId(id);
    if (!r || seen.has(r.href)) continue;
    seen.add(r.href);
    out.push(r);
  }
  return out;
}

export const ofKind = (list: Resolved[], kind: NodeKind) => list.filter((r) => r.kind === kind);

export function resolveTerms(slugs: string[]): Resolved[] {
  return resolveAll(slugs.map((s) => `c:${s}`));
}

export function resolveEvents(slugs: string[]): Resolved[] {
  return resolveAll(slugs.map((s) => `ev:${s}`));
}

export function resolveTools(slugs: string[]): Resolved[] {
  const out: Resolved[] = [];
  for (const s of slugs) {
    const t = getTool(s);
    if (t) out.push({ id: `tool:${s}`, kind: "Tool", label: t.name, short: t.name, href: toolHref(t.slug), note: t.line });
  }
  return out;
}

/** Currency pairs in which the bank's currency is a leg, then other instruments whose data names the bank. */
export function instrumentsForBank(b: CentralBank): { pairs: Instrument[]; others: Instrument[] } {
  const pairs = instruments.filter((i) => i.class === "forex" && (i.base === b.currency || i.quote === b.currency));
  const others = instruments.filter((i) => i.class !== "forex" && i.related.includes(`cb:${b.slug}`));
  return { pairs, others };
}

/** Events connected to a central bank: named in the event's `related`, watched through its currency, or published for its area. */
export function eventsForBank(b: CentralBank): EconEvent[] {
  return econEvents.filter((e) => e.related.includes(`cb:${b.slug}`) || e.watchedBy.includes(`ccy:${b.currency}`) || e.publishers.some((p) => p.area === b.area));
}

/** Banks whose currency or name an event is commonly read against. */
export function banksForEvent(e: EconEvent): CentralBank[] {
  return centralBanks.filter((b) => e.related.includes(`cb:${b.slug}`) || e.watchedBy.includes(`ccy:${b.currency}`));
}

/** Both legs are covered by the ECB reference fixings. */
export function ratePair(i: Instrument): [RateCurrency, RateCurrency] | null {
  return isRateCurrency(i.base) && isRateCurrency(i.quote) ? [i.base, i.quote] : null;
}

/** The FX session in which a currency's home business day falls. */
const HOME_SESSION: Record<string, string> = { USD: "New York", CAD: "New York", EUR: "London", GBP: "London", CHF: "London", JPY: "Tokyo", AUD: "Sydney", NZD: "Sydney" };
export function homeSessions(i: Instrument): string[] {
  const out: string[] = [];
  for (const c of [i.base, i.quote]) {
    const s = c ? HOME_SESSION[c] : undefined;
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/** The token each asset class is tinted with. A tint of an existing token, never a new colour. */
export const TONE_VAR: Record<(typeof assetClasses)[number]["tone"], string> = {
  brand: "var(--brand)",
  prestige: "var(--prestige)",
  teal: "var(--teal)",
  // the night chapter is tinted with platinum, which reads on ivory and on the night surface alike
  night: "var(--platinum)",
  emerald: "var(--emerald)",
  accent: "var(--accent)",
};

export const toneStyle = (key: AssetClassKey): Record<string, string> => {
  const a = getAssetClass(key);
  return { "--tone": a ? TONE_VAR[a.tone] : "var(--accent)" };
};

/** A correlation coefficient with an explicit sign, e.g. "+0.82" or "−0.41". */
export function formatCorr(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "n/a";
  const s = v > 0.004 ? "+" : v < -0.004 ? "−" : "";
  return `${s}${Math.abs(v).toFixed(2)}`;
}

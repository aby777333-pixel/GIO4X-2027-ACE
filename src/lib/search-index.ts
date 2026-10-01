import { nav, secondaryNav } from "@/config/nav";
import { lessons } from "@/data/academy";
import { articles } from "@/data/articles";
import { glossary } from "@/data/glossary";
import { assetClasses, instrumentHref, instruments } from "@/data/instruments";
import { centralBanks, currencies, econEvents } from "@/data/knowledge";
import { tools } from "@/data/tools";
import type { SearchEntry, SearchGroup } from "@/lib/search";

const groupOfSection: Record<string, SearchGroup> = {
  markets: "Markets",
  trading: "Trading",
  platforms: "Platforms",
  intelligence: "Intelligence",
  academy: "Academy",
  company: "Company",
};

/**
 * The one index that connects the GIO4X universe. Built at build time from
 * the same data the pages render from, so search can never point at a page
 * that does not exist.
 */
export function buildSearchIndex(): SearchEntry[] {
  const out: SearchEntry[] = [];
  const seen = new Set<string>();
  const add = (e: SearchEntry) => {
    const key = `${e.g}:${e.h}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(e);
  };

  // instruments first: a symbol typed into search should land on the instrument
  for (const i of instruments) {
    add({ t: i.symbol, d: i.name, h: instrumentHref(i), g: "Instruments", k: [i.name.toLowerCase(), i.code.toLowerCase(), ...i.aliases], w: 1.3 });
  }
  for (const a of assetClasses) {
    add({ t: `${a.name} markets`, d: a.line, h: `/markets/${a.key}`, g: "Markets", k: [a.key, a.name.toLowerCase(), ...(a.key === "forex" ? ["fx", "currencies", "currency"] : []), ...(a.key === "energy" ? ["oil", "commodities"] : []), ...(a.key === "equities" ? ["stocks", "shares"] : []), ...(a.key === "crypto" ? ["cryptocurrency", "digital assets"] : [])], w: 1.1 });
  }
  for (const c of currencies) {
    add({ t: `${c.name} (${c.code})`, d: c.note, h: `/markets/central-banks/${c.bank}`, g: "Markets", k: [c.code.toLowerCase(), ...c.nicknames], w: 0.8 });
  }
  for (const b of centralBanks) {
    add({ t: b.name, d: `${b.committee}. Sets the ${b.instrument.toLowerCase()}.`, h: `/markets/central-banks/${b.slug}`, g: "Markets", k: [b.short.toLowerCase(), b.currency.toLowerCase(), b.area.toLowerCase(), "central bank", "rates"] });
  }
  for (const e of econEvents) {
    add({ t: e.name, d: e.what.split(". ")[0] + ".", h: `/markets/events/${e.slug}`, g: "Markets", k: [e.short.toLowerCase(), e.kind.toLowerCase(), "economic event", "calendar"] });
  }
  for (const t of tools) {
    add({ t: `${t.name}${t.kind === "Calculator" ? " calculator" : ""}`, d: t.line, h: `/tools/${t.slug}`, g: "Tools", k: [...t.aliases, t.kind.toLowerCase(), "calculator", "tool"], w: 1.15 });
  }
  for (const g of glossary) {
    add({ t: g.term, d: g.definition.length > 240 ? `${g.definition.slice(0, 237).replace(/\s+\S*$/, "")}…` : g.definition, h: `/glossary/${g.slug}`, g: "Glossary", k: [g.slug.replace(/-/g, " "), ...(g.aliases ?? [])], w: 0.95 });
  }
  for (const a of articles) {
    add({ t: a.title, d: a.excerpt, h: `/intelligence/${a.slug}`, g: "Intelligence", k: a.tags.map((x) => x.toLowerCase()), w: 0.9 });
  }
  for (const l of lessons) {
    add({ t: l.title, d: l.description, h: `/academy/${l.slug}`, g: "Academy", k: [l.level.toLowerCase(), "lesson"], w: 0.9 });
  }
  for (const s of nav) {
    const g = groupOfSection[s.key] ?? "Company";
    add({ t: s.label, d: s.blurb, h: s.href, g });
    for (const grp of s.groups)
      for (const i of grp.items) {
        if (i.href.includes("#")) continue;
        const group: SearchGroup = i.href.startsWith("/tools") ? "Tools" : i.href.startsWith("/trust") || i.href.startsWith("/legal") ? "Trust & legal" : i.href.startsWith("/labs") ? "Labs" : i.href.startsWith("/glossary") ? "Glossary" : g;
        add({ t: i.label, d: i.note, h: i.href, g: group });
      }
  }
  for (const grp of secondaryNav)
    for (const i of grp.items) {
      const group: SearchGroup = grp.title === "Legal" || i.href.startsWith("/trust") ? "Trust & legal" : grp.title === "Support" ? "Help" : "Company";
      add({ t: i.label, h: i.href, g: group });
    }

  // a few things people ask for in their own words
  add({ t: "Sign in", d: "Client, Trader and IB portals", h: "/sign-in", g: "Help", k: ["login", "log in", "portal", "client portal", "ib portal"] });
  add({ t: "Open an account", d: "Start a GIO4X application", h: "/open-account", g: "Help", k: ["register", "sign up", "signup", "join", "new account"] });
  add({ t: "Market hours", d: "Regular sessions of nine financial centres", h: "/markets/clock", g: "Markets", k: ["hours", "session", "sessions", "london", "new york", "tokyo", "sydney", "open", "close", "holidays"] });
  add({ t: "MetaTrader 5", d: "The MetaQuotes multi-asset platform at GIO4X", h: "/platforms/metatrader-5", g: "Platforms", k: ["mt5", "metatrader", "meta trader", "mql5", "expert advisor"], w: 1.2 });
  add({ t: "777 Raptor", d: "GIO4X’s flagship trading workspace", h: "/platforms/raptor", g: "Platforms", k: ["raptor", "777", "gio4x raptor", "webtrader", "terminal"], w: 1.2 });
  add({ t: "Compare MetaTrader 5 and 777 Raptor", h: "/platforms/compare", g: "Platforms", k: ["compare", "comparison", "versus", "vs", "which platform"] });
  return out;
}

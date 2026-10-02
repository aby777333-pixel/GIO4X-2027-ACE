import type { SceneId } from "@/components/cockpit/scenes";

/**
 * Which instrument a page opens with.
 *
 * The rule is the owner's: every page in the menus has its own scene, related
 * to that page, and no animation is repeated. Only pages generated from data
 * (an instrument, a glossary term, a lesson, an article, a tool) share their
 * family's scene, and they pass their own subject as `tag` (the instrument, the
 * term, the tool), so the scene picks that subject out and no two pages look
 * the same. The first matching prefix wins, so the list runs from the most
 * specific path to the least.
 */
export type SceneChoice = { scene: SceneId; tag: string };

const ROUTES: [prefix: string, scene: SceneId, ownTag?: string][] = [
  // pages that used to share their family's instrument: each has its own
  ["/about/what-we-are", "charter"],
  ["/about/why-gio4x", "compass"],
  ["/about/world", "atlas"],
  ["/careers", "atelier"],
  ["/design", "golden"],
  ["/media", "press"],
  ["/preferences", "switchboard"],
  ["/desk", "workbench"],
  ["/whats-new", "ribbon"],
  ["/trust/ai", "lattice"],
  ["/trust/client-funds", "strongroom"],
  ["/trust/data-methodology", "provenance"],
  ["/trust/editorial-standards", "proof"],
  ["/trust/security", "bastion"],
  ["/trust/transparency", "prism"],
  ["/trust/verify", "seal"],
  ["/legal/aml", "sieve"],
  ["/legal/cookies", "drawers"],
  ["/legal/privacy", "veil"],
  ["/legal/risk", "barometer"],
  ["/legal/terms", "accord"],
  ["/explore", "atlas"],
  ["/faq", "lantern"],
  ["/academy/books", "library"],
  ["/labs/connect-the-dots", "threads"],
  ["/labs/market-universe", "galaxy"],
  ["/labs/market-day", "clock"],
  ["/labs/trade-anatomy", "trading"],
  ["/labs/simulator", "instrument"],
  ["/open-account", "threshold"],
  ["/partners/money-managers", "helm"],
  ["/markets/forex", "forex"],
  ["/markets/metals", "metals"],
  ["/markets/indices", "indices"],
  ["/markets/energy", "energy"],
  ["/markets/equities", "equities"],
  ["/markets/crypto", "crypto"],
  ["/markets/clock", "clock"],
  ["/markets/currency-strength", "strength"],
  ["/markets/central-banks", "banks"],
  ["/markets/events", "events"],
  ["/markets", "markets"],
  ["/trading/accounts", "accounts"],
  ["/trading/conditions", "conditions"],
  ["/trading/funding", "funding"],
  ["/trading/copy-trading", "copy"],
  ["/trading/pamm", "pamm"],
  ["/trading", "trading"],
  ["/partners", "network"],
  ["/platforms/raptor", "raptor"],
  ["/platforms/metatrader-5", "mt5"],
  ["/platforms/compare", "compare"],
  ["/platforms", "platforms"],
  ["/tools", "instrument"],
  ["/intelligence/blog", "press"],
  ["/intelligence", "signal"],
  ["/morning-room", "horizon"],
  ["/labs", "constellation"],
  ["/academy", "course"],
  ["/glossary", "lexicon"],
  ["/faq", "lexicon"],
  ["/explore", "lexicon"],
  ["/search", "lexicon"],
  ["/contact", "beacon"],
  ["/support", "beacon"],
  ["/status", "annunciator"],
  ["/trust", "vault"],
  ["/legal", "document"],
  // entry points are themselves the subject of their scene
  ["/sign-in", "gateway", "sign-in"],
  ["/open-account", "gateway", "open-account"],
];

/** Pages whose own scene must not pass to the pages beneath them (each tool keeps the family's instrument). */
const EXACT: Record<string, SceneId> = { "/tools": "workbench" };

/** Everything else (About, Careers, Media, Design, What's new, Preferences, not found) carries the rosette. */
const FALLBACK: SceneId = "rosette";

export function sceneFor(pathname: string): SceneChoice {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { scene: "flightdeck", tag: "" };
  const exact = Object.prototype.hasOwnProperty.call(EXACT, path) ? EXACT[path] : undefined;
  if (exact) return { scene: exact, tag: "" };
  for (const [prefix, scene, ownTag] of ROUTES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      // the page's own subject is the last segment below the family's root
      const rest = path.slice(prefix.length).split("/").filter(Boolean);
      return { scene, tag: rest.length ? rest[rest.length - 1] : (ownTag ?? "") };
    }
  }
  const parts = path.split("/").filter(Boolean);
  return { scene: FALLBACK, tag: parts[parts.length - 1] ?? "" };
}

import type { SceneId } from "@/components/cockpit/scenes";

/**
 * Which instrument a page opens with.
 *
 * The rule is the owner's: every major page has its own scene, related to
 * that page, and no animation is repeated everywhere. Pages of one family
 * share a scene but pass their own subject as `tag` (the instrument, the
 * term, the tool), so the scene picks that subject out and no two pages look
 * the same. The first matching prefix wins, so the list runs from the most
 * specific path to the least.
 */
export type SceneChoice = { scene: SceneId; tag: string };

const ROUTES: [prefix: string, scene: SceneId, ownTag?: string][] = [
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
  ["/intelligence", "signal"],
  ["/morning-room", "horizon"],
  ["/labs", "constellation"],
  ["/academy", "course"],
  ["/glossary", "lexicon"],
  ["/faq", "lexicon"],
  ["/explore", "lexicon"],
  ["/search", "lexicon"],
  ["/contact", "beacon"],
  ["/status", "annunciator"],
  ["/trust", "vault"],
  ["/legal", "document"],
  // entry points are themselves the subject of their scene
  ["/sign-in", "gateway", "sign-in"],
  ["/open-account", "gateway", "open-account"],
];

/** Everything else (About, Careers, Media, Design, What's new, Preferences, not found) carries the rosette. */
const FALLBACK: SceneId = "rosette";

export function sceneFor(pathname: string): SceneChoice {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { scene: "flightdeck", tag: "" };
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

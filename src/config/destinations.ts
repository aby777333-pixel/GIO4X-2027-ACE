/**
 * GIO4X VERIFIED DESTINATION REGISTRY
 * -----------------------------------------------------------------------------
 * Every place GIO4X is allowed to send a visitor lives here and nowhere else.
 *
 * Portal destinations are read from server environment variables, never from
 * query strings, CMS content or user input (see docs/PORTAL-GATEWAY.md).
 * There are two ways one becomes CONFIGURED:
 *   1. The portal is connected to this website (PORTAL_ORIGIN is set, so
 *      next.config.mjs proxies /portal to it). Each destination is then a
 *      path on this site, and the visitor never leaves its address.
 *   2. An explicit https URL on an allow-listed host is given for it
 *      (CLIENT_PORTAL_URL and the others), which takes precedence.
 * Otherwise it is UNCONFIGURED and shown as "not connected yet".
 */
import { site } from "@/config/site";

export type PortalKey = "client" | "trader" | "ib" | "openAccount";

export type Destination = { status: "CONFIGURED"; url: string } | { status: "UNCONFIGURED"; url: null };

const PORTAL_ENV: Record<PortalKey, string | undefined> = {
  client: process.env.CLIENT_PORTAL_URL,
  trader: process.env.TRADER_PORTAL_URL,
  ib: process.env.IB_PORTAL_URL,
  openAccount: process.env.ACCOUNT_OPENING_URL,
};

/** Where this website serves the portal, and each destination inside it. */
export const PORTAL_PATH = "/portal";
const SAME_SITE: Record<PortalKey, string> = {
  client: `${PORTAL_PATH}/auth/login`,
  trader: `${PORTAL_PATH}/accounts`,
  ib: `${PORTAL_PATH}/ib`,
  openAccount: `${PORTAL_PATH}/auth/signup`,
};

/** The same test next.config.mjs makes before it proxies /portal: https, or http on localhost. */
export const portalConnected = (() => {
  try {
    const u = new URL(process.env.PORTAL_ORIGIN ?? "");
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    return (u.protocol === "https:" || (local && u.protocol === "http:")) && !u.username && !u.password;
  } catch {
    return false;
  }
})();

/**
 * Extra hosts allowed for portal destinations, comma separated (e.g. "portal.gio4x.com").
 * Public on purpose: the browser-side link checker must recognise the same hosts
 * the server does, and a hostname clients are sent to is not a secret.
 */
const extraHosts = (process.env.NEXT_PUBLIC_OFFICIAL_PORTAL_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/** First-party domains. A hostname is official if it equals or is a subdomain of one of these. */
export const officialDomains = ["gio4x.com"] as const;

/** Approved third parties GIO4X links to on purpose. */
export const approvedThirdParties: { host: string; label: string; why: string }[] = [
  { host: "777raptor.com", label: "777 Raptor", why: "Technology provider of the 777 Raptor platform." },
  { host: "metatrader5.com", label: "MetaTrader 5", why: "Official MetaTrader 5 website, operated by MetaQuotes." },
  { host: "metaquotes.net", label: "MetaQuotes", why: "Developer of MetaTrader 5." },
  { host: "tradingview.com", label: "TradingView", why: "Provider of the embedded market charts, economic calendar, heat maps and quote panels." },
  { host: "ecb.europa.eu", label: "European Central Bank", why: "Source of the euro foreign exchange reference rates." },
  { host: "frankfurter.dev", label: "Frankfurter", why: "Open API that republishes ECB reference rates." },
  { host: "amazon.com", label: "Amazon", why: "Bookseller’s search results for titles on the Academy reading list. GIO4X sells no books and earns nothing from these links." },
  { host: "worldcat.org", label: "WorldCat", why: "Library catalogue run by OCLC: search results for titles on the Academy reading list." },
];

function hostOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return u.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

function matches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function isOfficialHost(host: string): boolean {
  return officialDomains.some((d) => matches(host, d)) || extraHosts.some((d) => matches(host, d));
}

function resolve(key: PortalKey): Destination {
  const raw = PORTAL_ENV[key]?.trim();
  const host = raw ? hostOf(raw) : null;
  // An explicit address is honoured only if it is https and on an allow-listed host.
  if (raw && host && isOfficialHost(host)) return { status: "CONFIGURED", url: raw };
  if (portalConnected) return { status: "CONFIGURED", url: SAME_SITE[key] };
  return { status: "UNCONFIGURED", url: null };
}

export const portals: Record<PortalKey, Destination> = {
  client: resolve("client"),
  trader: resolve("trader"),
  ib: resolve("ib"),
  openAccount: resolve("openAccount"),
};

/** The address to show beside a destination: this site's own for a path, the hostname otherwise. */
export function destinationAddress(url: string): string {
  if (url.startsWith("/")) {
    try {
      return `${new URL(site.url).host}${PORTAL_PATH}`;
    } catch {
      return PORTAL_PATH;
    }
  }
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * The portal's own staff console, for the Service Console sections GIO4X
 * Control has not built itself. Null while the portal is not connected.
 */
export function portalStaffUrl(section: string): string | null {
  return portalConnected ? `${PORTAL_PATH}/staff/${section}` : null;
}

export const portalMeta: Record<PortalKey, { label: string; summary: string }> = {
  client: { label: "Client Portal", summary: "Profile, verification, funding and account documents." },
  trader: { label: "Trader Portal", summary: "Trading accounts and platform access." },
  ib: { label: "IB Portal", summary: "For introducing brokers and partners." },
  openAccount: { label: "Open an account", summary: "Start a GIO4X application." },
};

/**
 * Official social profiles. Empty until the owner supplies them; every
 * consumer (footer, schema sameAs, share system) renders nothing when empty.
 */
export type SocialKey = "linkedin" | "x" | "facebook" | "instagram" | "youtube" | "telegram" | "whatsapp" | "threads" | "tiktok";
export const socials: Partial<Record<SocialKey, string>> = {};

export type Verdict =
  | { verdict: "OFFICIAL"; host: string }
  | { verdict: "APPROVED_THIRD_PARTY"; host: string; label: string; why: string }
  | { verdict: "NOT_RECOGNIZED"; host: string | null; reason?: "not-https" | "unparseable" | "has-credentials" };

/**
 * Pure string comparison against the registry. It never fetches the URL
 * (no SSRF surface) and never calls an unknown link malicious.
 */
export function verifyDestination(input: string): Verdict {
  const trimmed = input.trim().slice(0, 2048);
  if (!trimmed) return { verdict: "NOT_RECOGNIZED", host: null, reason: "unparseable" };
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return { verdict: "NOT_RECOGNIZED", host: null, reason: "unparseable" };
  }
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (u.username || u.password) return { verdict: "NOT_RECOGNIZED", host, reason: "has-credentials" };
  if (u.protocol !== "https:") return { verdict: "NOT_RECOGNIZED", host, reason: "not-https" };
  if (isOfficialHost(host)) return { verdict: "OFFICIAL", host };
  const third = approvedThirdParties.find((t) => matches(host, t.host));
  if (third) return { verdict: "APPROVED_THIRD_PARTY", host, label: third.label, why: third.why };
  const social = Object.values(socials).some((s) => s && candidate.toLowerCase().startsWith(s.toLowerCase()));
  if (social) return { verdict: "OFFICIAL", host };
  return { verdict: "NOT_RECOGNIZED", host };
}

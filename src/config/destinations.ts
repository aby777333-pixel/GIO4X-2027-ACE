/**
 * GIO4X VERIFIED DESTINATION REGISTRY
 * -----------------------------------------------------------------------------
 * Every place GIO4X is allowed to send a visitor lives here and nowhere else.
 *
 * Portal destinations are UNCONFIGURED until the owner supplies and security-
 * reviews them (see docs/PORTAL-GATEWAY.md). They are read from server
 * environment variables, never from query strings, CMS content or user
 * input, and must be https URLs on an allow-listed host.
 */

export type PortalKey = "client" | "trader" | "ib" | "openAccount";

export type Destination = { status: "CONFIGURED"; url: string } | { status: "UNCONFIGURED"; url: null };

const PORTAL_ENV: Record<PortalKey, string | undefined> = {
  client: process.env.CLIENT_PORTAL_URL,
  trader: process.env.TRADER_PORTAL_URL,
  ib: process.env.IB_PORTAL_URL,
  openAccount: process.env.ACCOUNT_OPENING_URL,
};

/** Extra hosts allowed for portal destinations, comma separated (e.g. "portal.gio4x.com"). */
const extraHosts = (process.env.OFFICIAL_PORTAL_HOSTS ?? "")
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
  { host: "tradingview.com", label: "TradingView", why: "Provider of the embedded market charts." },
  { host: "ecb.europa.eu", label: "European Central Bank", why: "Source of the euro foreign exchange reference rates." },
  { host: "frankfurter.dev", label: "Frankfurter", why: "Open API that republishes ECB reference rates." },
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

function resolve(value: string | undefined): Destination {
  const raw = value?.trim();
  if (!raw) return { status: "UNCONFIGURED", url: null };
  const host = hostOf(raw);
  // Not https, or not on an allow-listed host: treated as unconfigured, not trusted.
  if (!host || !isOfficialHost(host)) return { status: "UNCONFIGURED", url: null };
  return { status: "CONFIGURED", url: raw };
}

export const portals: Record<PortalKey, Destination> = {
  client: resolve(PORTAL_ENV.client),
  trader: resolve(PORTAL_ENV.trader),
  ib: resolve(PORTAL_ENV.ib),
  openAccount: resolve(PORTAL_ENV.openAccount),
};

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

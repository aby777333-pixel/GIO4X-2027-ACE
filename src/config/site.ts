/**
 * Single source of truth for the GIO4X organisation entity.
 * Only facts carried over from the previous GIO4X sites live here. Anything
 * the owner has not confirmed is `null` and listed in docs/WAITING-FOR-ABE.md;
 * components render an intentional "not yet published" state, never a guess.
 */
const rawUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

export const site = {
  name: "GIO4X",
  legalName: "777 Capital Markets Limited",
  tagline: "The Gentleman’s Brokerage House",
  /** Canonical production origin. Override with NEXT_PUBLIC_SITE_URL per environment. */
  url: rawUrl || "https://www.gio4x.com",
  domain: "gio4x.com",
  description:
    "GIO4X is a multi-asset brokerage offering access to global markets through MetaTrader 5 and 777 Raptor, with an open library of market tools, research and education.",
  locale: "en",
  email: "info@gio4x.com",
  /** Published on the previous GIO4X site as the head-office address. */
  headOffice: {
    lines: ["2nd Floor College House", "17 King Edwards Road", "Ruislip, London HA4 7AE"],
    country: "United Kingdom",
  },
  supportOffice: {
    lines: ["No 48 Immanual Complex", "Thirunagar Katpadi", "Vellore 632006, Tamil Nadu"],
    country: "India",
  },
  /** Not verified: the previous codebase carried a placeholder number. */
  phone: null as string | null,
  /** Regulatory status must be supplied and evidenced by the owner before it is published. */
  regulation: null as string | null,
  technologyPartner: {
    name: "777 Raptor",
    url: "https://www.777raptor.com/",
    logo: "/brand/777-raptor-logo.png",
    logoWidth: 474,
    logoHeight: 220,
  },
} as const;

/** Only the production environment is indexable. */
export const isProduction = process.env.NEXT_PUBLIC_SITE_ENV === "production";

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}

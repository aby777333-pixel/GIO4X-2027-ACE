// External + internal link map for the GIO4X client/IB portal.
// One source of truth so marketing, the Raptor terminal, and support
// channels can be updated in a single place.

// This app (apps/portal) is GIO4X — the client/IB portal where users land,
// sign in, complete KYC, and open accounts. TERMINAL_URL points at the
// GIORAPTOR trading terminal that clients enter after their formalities are
// done. While the in-monorepo apps/raptor is still being stood up, the
// terminal URL still resolves to the standalone Gioraptor deploy.
//
// The portal is served under a path of the GIO4X website (…/portal), so both
// addresses derive from the one public origin in NEXT_PUBLIC_SITE_URL.
import { BASE_PATH, siteOrigin } from "@/lib/base-path";

export const WEBSITE_BASE = siteOrigin();
export const PORTAL_BASE = `${WEBSITE_BASE}${BASE_PATH}`;
export const TERMINAL_URL = "https://dashing-hamster-0028ed.netlify.app/terminal";

// Back-compat aliases — older components still import these names.
// Safe to remove once all call sites move to PORTAL_BASE / TERMINAL_URL.
export const RAPTOR_BASE = PORTAL_BASE;
export const PORTAL_URL = "https://dashing-hamster-0028ed.netlify.app";

export const LINKS = {
  website: {
    home: WEBSITE_BASE,
    about: `${WEBSITE_BASE}/about`,
    markets: `${WEBSITE_BASE}/markets`,
    accountTypes: `${WEBSITE_BASE}/trading/accounts`,
    funding: `${WEBSITE_BASE}/trading/funding`,
    education: `${WEBSITE_BASE}/academy`,
    blog: `${WEBSITE_BASE}/intelligence/blog`,
    contact: `${WEBSITE_BASE}/contact`,
    legal: `${WEBSITE_BASE}/legal`,
    risk: `${WEBSITE_BASE}/legal/risk`,
    careers: `${WEBSITE_BASE}/careers`,
    faq: `${WEBSITE_BASE}/faq`,
  },
  raptor: {
    // The GIORAPTOR trading terminal lives on its own deploy until the
    // in-monorepo apps/raptor stack convergence lands (Phase D). Point every
    // "open the terminal" CTA at TERMINAL_URL so they actually reach it
    // instead of reloading the portal home.
    home: TERMINAL_URL,
    terminal: TERMINAL_URL,
    // login / register stay on the portal's own auth routes — users complete
    // their formalities here before entering the terminal.
    login: "/auth/login",
    register: "/auth/signup",
  },
  support: {
    email: "support@gio4x.com",
    phone: "+91 1111 1111 11111",
    hours: "24/7",
  },
  social: {
    twitter: "https://twitter.com/gio4x",
    telegram: "https://t.me/gio4x",
    linkedin: "https://linkedin.com/company/gio4x",
  },
  legal: {
    license: "GIO4X is a subsidiary of 777 Capital Markets Limited (UK), Company No. 17049134. Registered office: 2nd Floor College House, 17 King Edwards Road, Ruislip, London, HA4 7AE, United Kingdom",
  },
} as const;

export type AccountType = "Classic" | "Premium" | "ECN" | "Cent" | "Swap-Free STP";

export const ACCOUNT_TYPES: Array<{
  name: AccountType;
  spreadFrom: string;
  commission: string;
  leverage: string;
  minDeposit: string;
  highlight?: boolean;
}> = [
  { name: "Classic", spreadFrom: "2.5 pips", commission: "None", leverage: "1:500", minDeposit: "$150" },
  { name: "Premium", spreadFrom: "1.5 pips", commission: "None", leverage: "1:500", minDeposit: "$500", highlight: true },
  { name: "ECN", spreadFrom: "0.2 pips", commission: "$3.50/lot", leverage: "1:500", minDeposit: "$2,000" },
  { name: "Cent", spreadFrom: "2.0 pips", commission: "None", leverage: "1:500", minDeposit: "$50" },
  { name: "Swap-Free STP", spreadFrom: "1.8 pips", commission: "None", leverage: "1:500", minDeposit: "$200" },
];

export const DEPOSIT_METHODS = [
  { id: "card", name: "Credit / Debit Card", fee: "0%", processing: "Instant", logos: ["VISA", "MC", "AMEX"] },
  { id: "bank", name: "Bank Transfer", fee: "0%", processing: "1–3 business days", logos: ["SWIFT", "SEPA"] },
  { id: "crypto", name: "Cryptocurrency", fee: "0%", processing: "10–30 min", logos: ["BTC", "ETH", "USDT"] },
  { id: "upi", name: "UPI / Local Methods", fee: "0%", processing: "Instant", logos: ["UPI", "IMPS", "Paytm"] },
  { id: "skrill", name: "Skrill / Neteller", fee: "0%", processing: "Instant", logos: ["SKL", "NTL"] },
] as const;

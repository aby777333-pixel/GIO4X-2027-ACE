import { readFileSync } from "node:fs";

/** @type {{ source: string; destination: string }[]} */
const legacyRedirects = JSON.parse(readFileSync(new URL("./src/config/redirects.json", import.meta.url), "utf8"));

const isDev = process.env.NODE_ENV !== "production";
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

/**
 * The client and IB portal is a separate application (the `portal/` folder,
 * its own Netlify site and its own database). This website serves it at
 * /portal by proxying to PORTAL_ORIGIN, so a visitor never leaves the site's
 * address. Unset, or anything but https (http is accepted for localhost
 * only), means no proxy: /portal is then a 404 and the gateway pages say
 * "not connected yet". The same test is made in src/config/destinations.ts.
 */
const originOf = (value, { localHttp = false } = {}) => {
  try {
    const u = new URL(value ?? "");
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(localHttp && local && u.protocol === "http:")) return "";
    if (u.username || u.password) return "";
    return u.origin;
  } catch {
    return "";
  }
};
const portalOrigin = originOf(process.env.PORTAL_ORIGIN, { localHttp: true });
// Address of the portal's database, read by Control's portal sections on the
// server (src/lib/server/portal-db.ts). Not a secret; the key that goes with
// it is, and is never written into the build.
const portalSupabaseUrl = originOf(process.env.PORTAL_SUPABASE_URL);

/**
 * Content-Security-Policy, written for this application rather than copied.
 *  - No third-party scripts at all. Charts are TradingView iframes (frame-src).
 *  - 'unsafe-inline' for script-src is required by Next.js' inline bootstrap
 *    when pages are statically generated (a nonce would force every page to be
 *    rendered on demand). No inline event handlers are used anywhere.
 *    'unsafe-eval' is development only (React refresh).
 *  - connect-src is limited to this origin and the Supabase project.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // blog pictures are served from the project's public storage bucket
  `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "font-src 'self'",
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}${isDev ? " ws: wss:" : ""}`,
  "frame-src https://s.tradingview.com https://www.tradingview.com https://www.tradingview-widget.com",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

/** @type {import("next").NextConfig} */
const nextConfig = {
  // Written into the build, so the pages that run on the server (GIO4X Control,
  // the gateway pages) see the same value this file proxies to. A variable set
  // only for the build (netlify.toml) does not exist when the site is running.
  env: { PORTAL_ORIGIN: portalOrigin, PORTAL_SUPABASE_URL: portalSupabaseUrl },
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: false,
  images: { formats: ["image/avif", "image/webp"] },
  // Share cards read their fonts and the logo from disk. Trace those files into
  // the server bundle so cards can also be rendered on demand, not only at build.
  outputFileTracingIncludes: {
    "/**": ["./src/fonts/og/*.otf", "./public/brand/gio4x-logo.png"],
  },
  async headers() {
    return [
      // everything but the portal: it is another application, answered through this
      // site, and sends its own headers (portal/apps/portal/next.config.mjs)
      { source: "/((?!portal(?:/|$)).*)", headers: securityHeaders },
      // private surfaces are never cached by shared caches or indexed
      {
        source: "/control/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
  async redirects() {
    return legacyRedirects.map((r) => ({ ...r, permanent: true }));
  },
  async rewrites() {
    if (!portalOrigin) return [];
    return [
      { source: "/portal", destination: `${portalOrigin}/portal` },
      { source: "/portal/:path*", destination: `${portalOrigin}/portal/:path*` },
    ];
  },
};

export default nextConfig;

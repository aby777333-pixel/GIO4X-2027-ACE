// The portal lives under a path of the GIO4X website, which proxies
// /portal/* to this app (see the website's next.config.mjs). Everything this
// app serves is therefore under BASE_PATH, on its own Netlify address too.
const BASE_PATH = "/portal";

// Hosts allowed to submit Server Actions. Behind the website's proxy the
// browser's Origin is the website, not this app's own host, and Next.js
// rejects the action unless that origin is listed here.
const siteHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").host;
  } catch {
    return "";
  }
})();
const allowedOrigins = [
  siteHost,
  "gio4x-2027-ace.netlify.app",
  "gio4x.com",
  "*.gio4x.com",
  "localhost:3000",
  ...(process.env.PORTAL_ALLOWED_ORIGINS ?? "").split(",").map((h) => h.trim()),
].filter(Boolean);

// Security headers. The browser talks to this app's own Supabase project
// (requests and the realtime socket) and to nothing else; no third-party
// script, frame or font is loaded. 'unsafe-inline' for scripts is required by
// Next.js' inline bootstrap; 'unsafe-eval' is development only.
const isDev = process.env.NODE_ENV !== "production";
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tdifcayznqnaduchzfqz.supabase.co").origin;
  } catch {
    return "";
  }
})();
const supabaseWs = supabaseOrigin.replace(/^https:/, "wss:");
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}${isDev ? " ws: wss:" : ""}`,
  "frame-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
].join("; ");
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: BASE_PATH,
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  transpilePackages: ["@gio4x/ui", "@gio4x/supabase", "@gio4x/dealer-core", "@gio4x/scope-engine", "@gio4x/pricing-core"],
  images: {
    formats: ["image/webp"],
  },
  experimental: {
    serverActions: { allowedOrigins },
  },
  // The Netlify build runner treats Next.js lint failures as fatal even
  // when local builds skip lint. We don't have an eslint config in the
  // app, so disable lint-during-build explicitly to avoid CI surprises.
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    // Old bookmarks of this app's own address root land on the portal home.
    return [{ source: "/", destination: BASE_PATH, basePath: false, permanent: false }];
  },
};

export default nextConfig;

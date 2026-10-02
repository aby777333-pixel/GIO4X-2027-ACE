import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "@/styles/globals.css";
import "@/styles/depth.css";
import "@/styles/cockpit.css";
import { isProduction, site } from "@/config/site";
import { BOOT_SCRIPT } from "@/lib/boot";
import { PREFS_BOOT_SCRIPT } from "@/lib/prefs";

// INTER — interface, data, forms, long functional reading.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// TT NORMS — brand moments and major headings only. Four weights, Latin
// subset, ~21 KB each. Only the two display weights are preloaded.
const norms = localFont({
  variable: "--font-norms",
  display: "swap",
  preload: true,
  fallback: ["Inter", "system-ui", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
  src: [
    { path: "../fonts/TTNorms-Light.woff2", weight: "300", style: "normal" },
    { path: "../fonts/TTNorms-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/TTNorms-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/TTNorms-Bold.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  publisher: site.legalName,
  alternates: { canonical: "/", types: { "application/rss+xml": [{ url: "/intelligence/feed.xml", title: "GIO4X Intelligence" }] } },
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: "en_GB",
    url: site.url,
    title: `${site.name} | ${site.tagline}`,
    description: site.description,
  },
  twitter: { card: "summary_large_image", title: `${site.name} | ${site.tagline}`, description: site.description },
  // Only the production environment may be indexed.
  robots: isProduction
    ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } }
    : { index: false, follow: false },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
  formatDetection: { telephone: false, email: false, address: false },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f4ee",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" data-accent="gio4x" className={`${inter.variable} ${norms.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies saved display preferences before first paint: no theme flash. */}
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT_SCRIPT }} />
        {/* First visit only: arms the cockpit start-up before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

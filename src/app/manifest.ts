import type { MetadataRoute } from "next";
import { site } from "@/config/site";

/**
 * Web app manifest: what makes the site installable. Colours are the ivory
 * `--bg` token (src/styles/tokens.css); the maskable icons are generated from
 * the brand mark by scripts/make-icons.mjs. The offline side is public/sw.js
 * (docs/OFFLINE.md).
 */
export default function manifest(): MetadataRoute.Manifest {
  const shortcutIcons = [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }];
  return {
    id: "/",
    name: `${site.name}: ${site.tagline}`,
    short_name: site.name,
    description: site.description,
    lang: "en-GB",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f4ee",
    theme_color: "#f6f4ee",
    categories: ["finance", "education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Trader Toolkit", short_name: "Tools", description: "Calculators that also work offline", url: "/tools", icons: shortcutIcons },
      { name: "Market Command", short_name: "Markets", description: "Sessions, reference rates and instruments", url: "/markets", icons: shortcutIcons },
      { name: "My desk", short_name: "My desk", description: "Your watchlist, saved pages and figures", url: "/desk", icons: shortcutIcons },
    ],
  };
}

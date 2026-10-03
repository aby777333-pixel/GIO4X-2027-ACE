import type { MetadataRoute } from "next";
import { isProduction, site } from "@/config/site";

/**
 * Crawler policy.
 *  - Production: everything public is crawlable (CSS, JS and images are never
 *    blocked). Only surfaces that are private or have no search value are
 *    disallowed. Disallow is not a security control: /control is protected by
 *    authentication and row-level security, and sent with noindex headers.
 *  - Any other environment (preview, staging, local): disallow everything.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isProduction) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/control", "/portal", "/search", "/sign-in", "/open-account", "/preferences", "/desk", "/offline"],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}

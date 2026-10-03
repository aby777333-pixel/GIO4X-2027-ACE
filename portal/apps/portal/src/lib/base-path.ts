// The portal is served under a path of the GIO4X website (…/portal), not at
// the root of its own domain. next.config.mjs sets `basePath` and publishes
// the same value as NEXT_PUBLIC_BASE_PATH, so there is one source of truth.
//
// Next.js adds the base path to <Link>, router.push(), redirect() and its own
// assets. It does NOT add it to: next/image `src`, plain <a href>,
// window.location, or absolute URLs built by hand (e-mail links, middleware
// redirects). Use the helpers below for those.

export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

/** Prefix an app-internal path ("/logo.png", "/auth/login") with the base path. */
export function withBase(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  return `${BASE_PATH}${path}`;
}

/**
 * Public origin visitors see in their address bar (the website's origin, which
 * proxies /portal here). Never derive this from the incoming request: behind
 * the proxy the request's own host is this app's Netlify address.
 */
export function siteOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3000";
  }
}

/** Absolute public URL of an app-internal path: origin + base path + path. */
export function publicUrl(path: string): string {
  return `${siteOrigin()}${withBase(path.startsWith("/") ? path : `/${path}`)}`;
}

/**
 * Supabase connection settings.
 *
 * Both values are safe to ship to a browser: the publishable key identifies the
 * project and maps to the `anon` database role. It is not a secret and grants
 * only what row-level security allows (see docs/SECURITY.md). There is no
 * service-role key in this application.
 *
 * Returns null when the project is not configured, so callers can show a
 * deliberate "not configured" state instead of crashing.
 */
export type SupabaseEnv = { url: string; key: string };

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") return null;
  } catch {
    return null;
  }
  return { url, key };
}

/**
 * Session cookies for GIO4X Control.
 *  - HttpOnly: page scripts can never read the session tokens.
 *  - Path=/control: the cookies are not sent to the public site or to /api, so
 *    public pages stay cookie-free and cacheable.
 *  - SameSite=Lax + Secure in production.
 */
export const CONTROL_COOKIE_OPTIONS = {
  path: "/control",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/**
 * The client portal's database, read by GIO4X Control.
 *
 * Client accounts, documents, wallets, trades and partner records live in the
 * portal's own Supabase project (the application in `portal/`), not in this
 * one. Control's sections for them read that database from the server with
 * the portal project's secret key.
 *
 * This is the one secret key in the application, and the rules for it are:
 *  - It exists only in the hosting environment (PORTAL_SUPABASE_SECRET_KEY),
 *    never in the repository and never in a NEXT_PUBLIC_ variable.
 *  - It is used only here, on the server ("server-only" makes a client import
 *    a build error), and only after the caller has been established as staff
 *    and holds the section's capability: see requirePortal() below.
 *  - That key bypasses the portal's row-level security, so the portal's
 *    database does NOT check who is asking. The check is Control's: the
 *    capability comes from this project's database (my_capabilities), not
 *    from anything the browser sends.
 *  - Sections read. Nothing in Control writes to the portal's database until
 *    the write is a reviewed function with its own audit entry.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Capability } from "@/lib/server/constants";
import { can, requireStaff, type StaffContext } from "@/lib/server/staff";

// The portal's schema is not part of this project's generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PortalDb = SupabaseClient<any, "public", any>;

function portalEnv(): { url: string; key: string } | null {
  const url = process.env.PORTAL_SUPABASE_URL?.trim();
  const key = process.env.PORTAL_SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) return null;
  try {
    if (new URL(url).protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { url, key };
}

/** Stateless, no session, bounded: a slow portal database must not hang a Control page. */
function createPortalDb(): PortalDb | null {
  const env = portalEnv();
  if (!env) return null;
  return createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10_000), cache: "no-store" }) },
  });
}

export type PortalAccess =
  | { state: "none" } // not staff: the layout shows the matching notice, the page renders nothing
  | { state: "forbidden" } // staff without the section's capability
  | { state: "unconfigured"; ctx: StaffContext } // the portal's database is not connected to this deployment
  | { state: "ok"; ctx: StaffContext; db: PortalDb };

/**
 * The only way a page obtains the portal database: staff first, capability
 * second, client last. Called by every portal-backed page itself.
 */
export async function requirePortal(capability: Capability): Promise<PortalAccess> {
  const ctx = await requireStaff();
  if (!ctx) return { state: "none" };
  if (!can(ctx, capability)) return { state: "forbidden" };
  const db = createPortalDb();
  if (!db) return { state: "unconfigured", ctx };
  return { state: "ok", ctx, db };
}

export type PortalPerson = { id: string; name: string; email: string; role: string; status: string; kyc: string; country: string | null };

/** id → who it is, for the ids on a page. Missing ids are simply absent; a page shows the id's first characters instead. */
export async function portalPeople(db: PortalDb, ids: Iterable<string | null | undefined>): Promise<Map<string, PortalPerson>> {
  const wanted = [...new Set([...ids].filter((v): v is string => typeof v === "string" && v.length > 0))].slice(0, 500);
  const people = new Map<string, PortalPerson>();
  if (!wanted.length) return people;
  try {
    const { data } = await db.from("profiles").select("id, full_name, email, role, status, kyc_status, country").in("id", wanted);
    for (const row of data ?? []) {
      people.set(row.id, { id: row.id, name: row.full_name ?? "", email: row.email ?? "", role: row.role, status: row.status, kyc: row.kyc_status, country: row.country ?? null });
    }
  } catch {
    /* names are a convenience; the page still renders without them */
  }
  return people;
}

/** `?page=` as a whole number from 1, and the row range it means. */
export function pageRange(raw: string | undefined, perPage: number): { page: number; from: number; to: number } {
  const n = Number.parseInt(raw ?? "", 10);
  const page = Number.isFinite(n) && n >= 1 && n <= 100000 ? n : 1;
  return { page, from: (page - 1) * perPage, to: page * perPage - 1 };
}

/** One of the allowed values, or the fallback: a filter is never passed to the database as typed. */
export function oneOf<T extends string>(raw: string | undefined, allowed: readonly T[], fallback: T | ""): T | "" {
  return (allowed as readonly string[]).includes(raw ?? "") ? (raw as T) : fallback;
}

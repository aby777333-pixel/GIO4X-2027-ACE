/**
 * The trading terminal's database, reached by GIO4X Control.
 *
 * Per-symbol trading conditions (whether a symbol trades, its markup,
 * commission, swaps, lot limits, routing) and trading blocks live in the
 * terminal's own Supabase project, a third database beside this one and the
 * client portal's. The portal's staff console changes them over the same
 * connection; this file is Control's.
 *
 * Two values, hosting environment only, the same two the portal's deployment
 * uses: TERMINAL_URL-style address in RAPTOR_BRIDGE_URL and the terminal's
 * service key in RAPTOR_BRIDGE_SERVICE_KEY. The key is a secret with the same
 * rules as the portal's (docs/SECURITY.md 8a): never in the repository, never
 * NEXT_PUBLIC_, used only here, and only after requireStaff + a capability.
 * Without them the screens say "not connected".
 *
 * Plain PostgREST over fetch, bounded, never cached. Paths are built by the
 * callers from fixed table names and encoded values only.
 */
import "server-only";
import type { Capability } from "@/lib/server/constants";
import { can, requireStaff, type StaffContext } from "@/lib/server/staff";

type Cfg = { url: string; key: string };

function cfg(): Cfg | null {
  const url = process.env.RAPTOR_BRIDGE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.RAPTOR_BRIDGE_SERVICE_KEY?.trim();
  if (!url || !key) return null;
  try {
    if (new URL(url).protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { url, key };
}

export type Terminal = {
  select: <T>(path: string) => Promise<T[] | null>;
  patch: (path: string, body: Record<string, unknown>) => Promise<boolean>;
  insert: (table: string, body: Record<string, unknown>) => Promise<boolean>;
};

function client(c: Cfg): Terminal {
  const headers = (extra?: Record<string, string>) => ({ apikey: c.key, Authorization: `Bearer ${c.key}`, ...(extra ?? {}) });
  const call = (path: string, init: RequestInit) => fetch(`${c.url}/rest/v1/${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  return {
    async select<T>(path: string) {
      try {
        const r = await call(path, { headers: headers() });
        return r.ok ? ((await r.json()) as T[]) : null;
      } catch {
        return null;
      }
    },
    async patch(path, body) {
      try {
        const r = await call(path, { method: "PATCH", headers: headers({ "Content-Type": "application/json", Prefer: "return=minimal" }), body: JSON.stringify(body) });
        return r.ok;
      } catch {
        return false;
      }
    },
    async insert(table, body) {
      try {
        const r = await call(table, { method: "POST", headers: headers({ "Content-Type": "application/json", Prefer: "return=minimal" }), body: JSON.stringify(body) });
        return r.ok;
      } catch {
        return false;
      }
    },
  };
}

export type TerminalAccess =
  | { state: "none" }
  | { state: "forbidden" }
  | { state: "unconfigured"; ctx: StaffContext }
  | { state: "ok"; ctx: StaffContext; terminal: Terminal };

/** Staff first, capability second, connection last: the only way a page or action reaches the terminal. */
export async function requireTerminal(capability: Capability): Promise<TerminalAccess> {
  const ctx = await requireStaff();
  if (!ctx) return { state: "none" };
  if (!can(ctx, capability)) return { state: "forbidden" };
  const c = cfg();
  if (!c) return { state: "unconfigured", ctx };
  return { state: "ok", ctx, terminal: client(c) };
}

/** A symbol as the terminal names it: capitals, digits, dot, underscore. Anything else is not a symbol. */
export function isSymbol(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z0-9._]{2,20}$/.test(value);
}

export type Instrument = {
  symbol: string;
  type: string;
  description: string | null;
  is_active: boolean;
  spread_markup: number;
  commission_per_lot: number;
  swap_long: number;
  swap_short: number;
  min_lot: number;
  max_lot: number;
  routing_mode: string;
  session_hours: string | null;
  enforce_sessions: boolean;
};

export const INSTRUMENT_COLUMNS = "symbol,type,description,is_active,spread_markup,commission_per_lot,swap_long,swap_short,min_lot,max_lot,routing_mode,session_hours,enforce_sessions";

/** What staff may change on a symbol, and within what bounds. The same bounds the portal's console applies. */
export const INSTRUMENT_FIELDS = {
  is_active: { kind: "flag", label: "Trading allowed" },
  enforce_sessions: { kind: "flag", label: "Enforce session hours" },
  spread_markup: { kind: "number", label: "Spread markup", min: 0, max: 100 },
  commission_per_lot: { kind: "number", label: "Commission per lot", min: 0, max: 500 },
  swap_long: { kind: "number", label: "Swap, long", min: -500, max: 500 },
  swap_short: { kind: "number", label: "Swap, short", min: -500, max: 500 },
  min_lot: { kind: "number", label: "Minimum lot", min: 0.01, max: 10 },
  max_lot: { kind: "number", label: "Maximum lot", min: 0.01, max: 10000 },
  routing_mode: { kind: "routing", label: "Routing" },
} as const;
export type InstrumentField = keyof typeof INSTRUMENT_FIELDS;
export const ROUTING_MODES = ["a_book", "b_book", "hybrid"] as const;

export type TradingBlock = { id: string; symbol: string | null; reason: string; starts_at: string; ends_at: string; created_by: string | null };
export type TerminalAudit = { actor: string; symbol: string; field: string; old_value: string | null; new_value: string | null; changed_at: string };

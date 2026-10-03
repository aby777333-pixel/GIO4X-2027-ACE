"use server";

// Broker Control Center (staff module — enhancement prompt §16, increment 1).
// Per-symbol trading controls on the LIVE Raptor terminal, over the existing
// service-role bridge (tech-terminal). Every write is access-checked against
// the staff session and recorded in the terminal's broker_config_audit table.
// Traders have no path to these controls: the audit + instrument writes go
// through the service role only, and this module runs solely inside the
// staff console (role-gated at the layout AND re-checked here).

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { canAccessSection } from "@/lib/staff-sections";
import { terminalSelect, terminalPatch, terminalInsert, terminalDelete } from "@/lib/tech-terminal";

export type BrokerInstrument = {
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

export type TradingBlock = {
  id: string;
  symbol: string | null;
  reason: string;
  starts_at: string;
  ends_at: string;
  created_by: string;
};

export type BrokerAuditRow = {
  actor: string; symbol: string; field: string;
  old_value: string | null; new_value: string | null; changed_at: string;
};

// Fields staff may edit, with bounds. Everything here is REAL:
// is_active/min/max/commission enforced in place_market_order, swaps applied
// at close_position, routing_mode consumed by the dealer bridge. spread_markup
// is stored config the pricing layer reads — the demo feed does not apply it
// yet (labelled honestly in the UI).
const EDITABLE: Record<string, { min?: number; max?: number; kind: "number" | "boolean" | "routing" }> = {
  is_active: { kind: "boolean" },
  enforce_sessions: { kind: "boolean" },
  spread_markup: { kind: "number", min: 0, max: 100 },
  commission_per_lot: { kind: "number", min: 0, max: 500 },
  swap_long: { kind: "number", min: -500, max: 500 },
  swap_short: { kind: "number", min: -500, max: 500 },
  min_lot: { kind: "number", min: 0.01, max: 10 },
  max_lot: { kind: "number", min: 0.01, max: 10000 },
  routing_mode: { kind: "routing" },
};

// Validate + coerce a value against the EDITABLE rules. Single source of truth
// shared by the per-symbol and group (bulk) writers so bounds never diverge.
function coerceEditable(
  field: string,
  value: string | number | boolean,
): { ok: true; v: string | number | boolean } | { ok: false; error: string } {
  const rule = EDITABLE[field];
  if (!rule) return { ok: false, error: `Field "${field}" is not editable.` };
  if (rule.kind === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return { ok: false, error: "Enter a valid number." };
    if (rule.min != null && n < rule.min) return { ok: false, error: `Minimum is ${rule.min}.` };
    if (rule.max != null && n > rule.max) return { ok: false, error: `Maximum is ${rule.max}.` };
    return { ok: true, v: n };
  }
  if (rule.kind === "boolean") return { ok: true, v: value === true || value === "true" };
  if (rule.kind === "routing") {
    if (!["a_book", "b_book", "hybrid"].includes(String(value))) {
      return { ok: false, error: "Routing must be a_book, b_book or hybrid." };
    }
    return { ok: true, v: String(value) };
  }
  return { ok: false, error: `Field "${field}" is not editable.` };
}

async function requireBrokerAccess(): Promise<{ ok: true; actor: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  const role = user?.profile?.role;
  const sections = (user?.profile as { staff_sections?: string[] | null } | null)?.staff_sections ?? null;
  if (!user || !canAccessSection("broker", role, sections)) {
    return { ok: false, error: "Not authorized for Broker Controls." };
  }
  return { ok: true, actor: user.email ?? user.id };
}

export async function listBrokerInstruments(): Promise<BrokerInstrument[] | null> {
  const gate = await requireBrokerAccess();
  if (!gate.ok) return null;
  const rows = await terminalSelect<BrokerInstrument>(
    "instruments?select=symbol,type,description,is_active,spread_markup,commission_per_lot,swap_long,swap_short,min_lot,max_lot,routing_mode,session_hours,enforce_sessions&order=symbol.asc",
  );
  return rows;
}

// ── Trading blocks (news/maintenance windows, enforced in place_market_order) ──

export async function listTradingBlocks(): Promise<TradingBlock[] | null> {
  const gate = await requireBrokerAccess();
  if (!gate.ok) return null;
  // Current + future blocks (past ones age out of the view; audit keeps history).
  return terminalSelect<TradingBlock>(
    `broker_trading_blocks?select=id,symbol,reason,starts_at,ends_at,created_by&ends_at=gt.${encodeURIComponent(new Date().toISOString())}&order=starts_at.asc`,
  );
}

export async function createTradingBlock(input: {
  symbol: string | null; reason: string; startsAt: string; endsAt: string;
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireBrokerAccess();
  if (!gate.ok) return { ok: false, error: gate.error };
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "A reason is required (shown to traders)." };
  const starts = new Date(input.startsAt), ends = new Date(input.endsAt);
  if (!(starts.getTime() > 0) || !(ends.getTime() > 0)) return { ok: false, error: "Enter valid start and end times." };
  if (ends <= starts) return { ok: false, error: "End must be after start." };

  const res = await terminalInsert("broker_trading_blocks", {
    symbol: input.symbol || null, reason,
    starts_at: starts.toISOString(), ends_at: ends.toISOString(),
    created_by: gate.actor,
  });
  if (!res.ok) return res;
  await terminalInsert("broker_config_audit", {
    actor: gate.actor, symbol: input.symbol || "ALL", field: "trading_block",
    old_value: null,
    new_value: `${reason} (${starts.toISOString()} → ${ends.toISOString()})`,
  });
  revalidatePath("/staff/broker");
  return { ok: true };
}

export async function deleteTradingBlock(id: string): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireBrokerAccess();
  if (!gate.ok) return { ok: false, error: gate.error };
  const cur = await terminalSelect<TradingBlock>(
    `broker_trading_blocks?id=eq.${encodeURIComponent(id)}&select=id,symbol,reason,starts_at,ends_at&limit=1`,
  );
  const res = await terminalDelete(`broker_trading_blocks?id=eq.${encodeURIComponent(id)}`);
  if (!res.ok) return res;
  await terminalInsert("broker_config_audit", {
    actor: gate.actor, symbol: cur?.[0]?.symbol ?? "ALL", field: "trading_block",
    old_value: cur?.[0] ? `${cur[0].reason} (${cur[0].starts_at} → ${cur[0].ends_at})` : id,
    new_value: "removed",
  });
  revalidatePath("/staff/broker");
  return { ok: true };
}

export async function listBrokerAudit(): Promise<BrokerAuditRow[] | null> {
  const gate = await requireBrokerAccess();
  if (!gate.ok) return null;
  return terminalSelect<BrokerAuditRow>(
    "broker_config_audit?select=actor,symbol,field,old_value,new_value,changed_at&order=changed_at.desc&limit=25",
  );
}

export async function updateBrokerInstrument(
  symbol: string,
  field: string,
  value: string | number | boolean,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireBrokerAccess();
  if (!gate.ok) return { ok: false, error: gate.error };

  const coerced = coerceEditable(field, value);
  if (!coerced.ok) return coerced;
  const v = coerced.v;

  // Read the current value first so the audit row is truthful.
  const cur = await terminalSelect<Record<string, unknown>>(
    `instruments?symbol=eq.${encodeURIComponent(symbol)}&select=${encodeURIComponent(field)}&limit=1`,
  );
  if (!cur || cur.length === 0) return { ok: false, error: `Unknown symbol ${symbol}.` };
  const oldValue = cur[0][field];

  const res = await terminalPatch(`instruments?symbol=eq.${encodeURIComponent(symbol)}`, { [field]: v });
  if (!res.ok) return res;

  await terminalInsert("broker_config_audit", {
    actor: gate.actor, symbol, field,
    old_value: oldValue == null ? null : String(oldValue),
    new_value: String(v),
  });

  revalidatePath("/staff/broker");
  return { ok: true };
}

// ── Group standards (bulk apply) ──────────────────────────────────────
// Apply ONE field to every instrument in a group (its `type`) in one action —
// e.g. set commission for all metals, or routing for all forex. Each symbol is
// patched and audited individually, so the audit trail stays per-symbol and
// truthful, and the same EDITABLE bounds apply as the per-symbol editor.
export async function updateBrokerGroup(
  groupType: string,
  field: string,
  value: string | number | boolean,
): Promise<{ ok: boolean; error?: string; updated?: number; failed?: number }> {
  const gate = await requireBrokerAccess();
  if (!gate.ok) return { ok: false, error: gate.error };

  const coerced = coerceEditable(field, value);
  if (!coerced.ok) return { ok: false, error: coerced.error };
  const v = coerced.v;

  const rows = await terminalSelect<Record<string, unknown>>(
    `instruments?type=eq.${encodeURIComponent(groupType)}&select=symbol,${encodeURIComponent(field)}`,
  );
  if (!rows || rows.length === 0) return { ok: false, error: `No instruments in group "${groupType}".` };

  let updated = 0, failed = 0;
  for (const row of rows) {
    const symbol = String(row.symbol);
    const res = await terminalPatch(`instruments?symbol=eq.${encodeURIComponent(symbol)}`, { [field]: v });
    if (!res.ok) { failed++; continue; }
    await terminalInsert("broker_config_audit", {
      actor: gate.actor, symbol, field,
      old_value: row[field] == null ? null : String(row[field]),
      new_value: String(v),
    });
    updated++;
  }

  revalidatePath("/staff/broker");
  if (updated === 0) return { ok: false, error: `Could not update any ${groupType} symbols.`, updated, failed };
  return { ok: true, updated, failed };
}

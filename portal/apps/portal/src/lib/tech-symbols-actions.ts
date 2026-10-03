"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./session";
import { getSupabaseServer } from "./supabase-server";
import { terminalPatch, terminalInsert, terminalDelete, terminalSelect } from "./tech-terminal";

export type TechResult = { ok: true; message?: string } | { ok: false; error: string };

async function requireSuper() {
  const user = await getCurrentUser();
  const isSuper = Boolean((user?.profile as { is_super_admin?: boolean } | null)?.is_super_admin);
  if (!user || !isSuper) return { ok: false as const, error: "Super admin only." };
  return { ok: true as const };
}

async function audit(action: string, detail: Record<string, unknown>) {
  try {
    const sb = getSupabaseServer() as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown> };
    await sb.rpc("tech_audit_write", { p_action: action, p_module: "trading", p_detail: detail });
  } catch { /* audit is best-effort */ }
}

const enc = (s: string) => encodeURIComponent(s);

export async function toggleSymbol(symbol: string, active: boolean): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const r = await terminalPatch(`instruments?symbol=eq.${enc(symbol)}`, { is_active: active });
  if (!r.ok) return { ok: false, error: r.error ?? "Update failed." };
  await audit(active ? "symbol.enabled" : "symbol.disabled", { symbol });
  revalidatePath("/tech/trading");
  return { ok: true, message: `${symbol} ${active ? "enabled" : "disabled"} — live on the terminal.` };
}

export async function updateSymbol(
  symbol: string,
  fields: { spread_markup?: number; commission_per_lot?: number; min_lot?: number; max_lot?: number; lot_step?: number; margin_rate?: number },
): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const patch: Record<string, number> = {};
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && Number.isFinite(v)) patch[k] = v as number;
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update." };
  const r = await terminalPatch(`instruments?symbol=eq.${enc(symbol)}`, patch);
  if (!r.ok) return { ok: false, error: r.error ?? "Update failed." };
  await audit("symbol.updated", { symbol, ...patch });
  revalidatePath("/tech/trading");
  return { ok: true, message: `${symbol} updated — live on the terminal.` };
}

export async function createSymbol(input: {
  symbol: string; description: string; type: string; pricescale: number;
  min_lot: number; max_lot: number; lot_step: number; contract_size: number; spread_markup?: number;
}): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  if (!input.symbol.trim() || !input.description.trim()) return { ok: false, error: "Symbol and description are required." };
  const r = await terminalInsert("instruments", {
    symbol: input.symbol.trim().toUpperCase(), description: input.description.trim(), type: input.type,
    pricescale: input.pricescale, min_lot: input.min_lot, max_lot: input.max_lot, lot_step: input.lot_step,
    contract_size: input.contract_size, spread_markup: input.spread_markup ?? 0, is_active: true,
  });
  if (!r.ok) return { ok: false, error: r.error ?? "Create failed." };
  await audit("symbol.created", { symbol: input.symbol });
  revalidatePath("/tech/trading");
  return { ok: true, message: `${input.symbol} created.` };
}

export async function deleteSymbol(symbol: string): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  // Guard: refuse if there are open positions on this symbol.
  const open = await terminalSelect(`positions?symbol=eq.${enc(symbol)}&status=eq.open&select=id&limit=1`);
  if (open && open.length > 0) return { ok: false, error: `${symbol} has open positions — disable it instead.` };
  const r = await terminalDelete(`instruments?symbol=eq.${enc(symbol)}`);
  if (!r.ok) return { ok: false, error: r.error ?? "Delete failed." };
  await audit("symbol.deleted", { symbol });
  revalidatePath("/tech/trading");
  return { ok: true, message: `${symbol} deleted.` };
}

"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./session";
import { getSupabaseServer } from "./supabase-server";
import { terminalSelect, terminalPatch } from "./tech-terminal";

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
    await sb.rpc("tech_audit_write", { p_action: action, p_module: "liquidity", p_detail: detail });
  } catch { /* best-effort */ }
}
const enc = (s: string) => encodeURIComponent(s);

// Live LP edits write the terminal liquidity_providers table → the aggregation &
// router immediately use the new config.
export async function setLpStatus(name: string, status: string): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  if (!["active", "degraded", "disabled", "down"].includes(status)) return { ok: false, error: "Invalid status." };
  const r = await terminalPatch(`liquidity_providers?name=eq.${enc(name)}`, { status });
  if (!r.ok) return { ok: false, error: r.error ?? "Update failed." };
  await audit("lp.status", { name, status });
  revalidatePath("/tech/liquidity");
  return { ok: true, message: `${name} → ${status} (live routing updated).` };
}

export async function setLpMarkup(name: string, bps: number): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  if (!Number.isFinite(bps) || bps < 0) return { ok: false, error: "Invalid markup." };
  const rows = await terminalSelect<{ config: Record<string, unknown> }>(`liquidity_providers?name=eq.${enc(name)}&select=config`);
  const cfg = (rows?.[0]?.config as Record<string, unknown>) ?? {};
  const r = await terminalPatch(`liquidity_providers?name=eq.${enc(name)}`, { config: { ...cfg, markup_bps: bps } });
  if (!r.ok) return { ok: false, error: r.error ?? "Update failed." };
  await audit("lp.markup", { name, markup_bps: bps });
  revalidatePath("/tech/liquidity");
  return { ok: true, message: `${name} markup → ${bps} bps (live spread updated).` };
}

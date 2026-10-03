"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";
import type { AuditRow } from "./tech-hub-console";
import { loadExecDashboard, loadTechHub, loadRisk } from "./tech-hub-data";
import { terminalRpc } from "./tech-terminal";

export async function techSignOut(): Promise<void> {
  const sb = getSupabaseServer();
  await sb.auth.signOut();
  redirect("/auth/login?redirect=/tech");
}

export type TechResult = { ok: true; message?: string } | { ok: false; error: string };

async function requireSuper() {
  const user = await getCurrentUser();
  const isSuper = Boolean((user?.profile as { is_super_admin?: boolean } | null)?.is_super_admin);
  if (!user || !isSuper) return { ok: false as const, error: "Super admin only." };
  return { ok: true as const, user };
}

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export async function toggleModule(key: string, enabled: boolean): Promise<TechResult> {
  const g = await requireSuper();
  if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_module_toggle", { p_key: key, p_enabled: enabled });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech", "layout");
  return { ok: true, message: `${key} ${enabled ? "enabled" : "disabled"}.` };
}

export async function setSetting(key: string, value: unknown): Promise<TechResult> {
  const g = await requireSuper();
  if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_setting_set", { p_key: key, p_value: value });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech", "layout");
  return { ok: true, message: `${key} updated.` };
}

export async function setSuperAdmin(userId: string, on: boolean): Promise<TechResult> {
  const g = await requireSuper();
  if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_set_super_admin", { p_user_id: userId, p_on: on });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech", "layout");
  return { ok: true, message: on ? "Super-admin granted." : "Super-admin revoked." };
}

export type BridgeInput = {
  id?: string; name: string; kind: string; category: string; direction: string;
  endpoint?: string; config?: Record<string, unknown>;
};

export async function upsertBridge(input: BridgeInput): Promise<TechResult> {
  const g = await requireSuper();
  if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_bridge_upsert", { p: { ...input, config: input.config ?? {} } });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/bridges");
  return { ok: true, message: input.id ? "Bridge updated." : "Bridge created." };
}

export async function setBridgeStatus(id: string, status: string): Promise<TechResult> {
  const g = await requireSuper();
  if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_bridge_set_status", { p_id: id, p_status: status });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/bridges");
  return { ok: true, message: `Bridge ${status}.` };
}

export async function deleteBridge(id: string): Promise<TechResult> {
  const g = await requireSuper();
  if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_bridge_delete", { p_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/bridges");
  return { ok: true, message: "Bridge deleted." };
}

// ── API keys ──────────────────────────────────────────────────────────────
export async function createApiKey(name: string, scopes: string[], rateLimit: number): Promise<{ ok: true; fullKey: string } | { ok: false; error: string }> {
  const g = await requireSuper();
  if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data, error } = await sb.rpc("tech_api_key_create", { p_name: name, p_scopes: scopes, p_rate_limit: rateLimit });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/api");
  return { ok: true, fullKey: (data as { full_key?: string })?.full_key ?? "" };
}
export async function setApiKeyStatus(id: string, status: string): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_api_key_set_status", { p_id: id, p_status: status });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/api"); return { ok: true, message: `Key ${status}.` };
}
export async function deleteApiKey(id: string): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_api_key_delete", { p_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/api"); return { ok: true, message: "Key deleted." };
}

// ── Security rules ────────────────────────────────────────────────────────
export async function upsertSecurityRule(input: { id?: string; kind: string; value: string; note?: string }): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_security_upsert", { p: input });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/security"); return { ok: true, message: input.id ? "Rule updated." : "Rule added." };
}
export async function toggleSecurityRule(id: string, enabled: boolean): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_security_toggle", { p_id: id, p_enabled: enabled });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/security"); return { ok: true };
}
export async function deleteSecurityRule(id: string): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_security_delete", { p_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/security"); return { ok: true, message: "Rule deleted." };
}

// ── Reporting exports (CSV / JSON download) ───────────────────────────────
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
export async function exportReport(kind: string, format: "csv" | "json"): Promise<{ ok: true; filename: string; mime: string; content: string } | { ok: false; error: string }> {
  const g = await requireSuper();
  if (!g.ok) return g;

  // Terminal-sourced business reports (live trading core).
  if (kind === "revenue" || kind === "lp_performance" || kind === "exposure") {
    let rows: Record<string, unknown>[] = [];
    if (kind === "revenue") { const e = await loadExecDashboard(); rows = (e?.by_symbol as unknown as Record<string, unknown>[]) ?? []; }
    else if (kind === "lp_performance") { const h = await loadTechHub(); rows = h.ok ? (h.data.lps as unknown as Record<string, unknown>[]) : []; }
    else { const r = await loadRisk(); rows = (r?.by_symbol as unknown as Record<string, unknown>[]) ?? []; }
    if (format === "json") return { ok: true, filename: `gio4x-${kind}.json`, mime: "application/json", content: JSON.stringify(rows, null, 2) };
    return { ok: true, filename: `gio4x-${kind}.csv`, mime: "text/csv", content: toCsv(rows) };
  }

  const sb = getSupabaseServer() as unknown as Rpc;
  const map: Record<string, string> = { audit: "tech_audit_recent", apikeys: "tech_api_keys_list", bridges: "tech_bridges_list", security: "tech_security_list", overview: "tech_overview" };
  const fn = map[kind];
  if (!fn) return { ok: false, error: "Unknown report." };
  const { data, error } = await sb.rpc(fn, kind === "audit" ? { p_limit: 500 } : {});
  if (error) return { ok: false, error: error.message };
  const stamp = kind;
  if (format === "json" || !Array.isArray(data)) {
    return { ok: true, filename: `gio4x-${stamp}.json`, mime: "application/json", content: JSON.stringify(data, null, 2) };
  }
  return { ok: true, filename: `gio4x-${stamp}.csv`, mime: "text/csv", content: toCsv(data as Record<string, unknown>[]) };
}

// ── Feature flags (real public.feature_flags) ─────────────────────────────
export async function setFlag(key: string, enabled: boolean): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_flag_set", { p_key: key, p_enabled: enabled });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/platform"); return { ok: true, message: `${key} ${enabled ? "on" : "off"} — live.` };
}

// ── Capabilities (every module aspect, editable + persisted) ───────────────
export async function toggleCapability(moduleKey: string, capability: string, enabled: boolean): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_capability_toggle", { p_module: moduleKey, p_capability: capability, p_enabled: enabled });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/tech/${moduleKey}`); return { ok: true };
}
export async function setCapabilityConfig(moduleKey: string, capability: string, config: Record<string, unknown>): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_capability_config", { p_module: moduleKey, p_capability: capability, p_config: config });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/tech/${moduleKey}`); return { ok: true, message: "Settings saved." };
}

// ── Generic registry (infra / brokers / env / extensions / spread profiles) ─
export async function upsertRegistryItem(input: { id?: string; kind: string; name: string; label?: string; status?: string; config?: Record<string, unknown> }): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_registry_upsert", { p: { ...input, config: input.config ?? {} } });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech", "layout"); return { ok: true, message: input.id ? "Saved." : "Added." };
}
export async function toggleRegistryItem(id: string, enabled: boolean): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_registry_toggle", { p_id: id, p_enabled: enabled });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech", "layout"); return { ok: true };
}
export async function deleteRegistryItem(id: string): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_registry_delete", { p_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech", "layout"); return { ok: true, message: "Deleted." };
}

// ── Audit search + rollback ────────────────────────────────────────────────
export async function searchAudit(q: string): Promise<{ ok: true; rows: AuditRow[] } | { ok: false; error: string }> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data, error } = await sb.rpc("tech_audit_search", { p_q: q || null, p_limit: 200 });
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data as AuditRow[]) ?? [] };
}
export async function rollbackAudit(id: string): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_rollback", { p_audit_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech", "layout");
  return { ok: true, message: "Reverted to previous value." };
}

// ── Automation: scheduled jobs + outbox ────────────────────────────────────
export async function toggleJob(jobid: number, active: boolean): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_job_toggle", { p_jobid: jobid, p_active: active });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/automation"); return { ok: true, message: `Job ${active ? "resumed" : "paused"}.` };
}
export async function processOutbox(): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_outbox_process");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/automation"); return { ok: true, message: "Outbox processed." };
}

// ── Trade surveillance (live anomaly detection over the trading core) ───────
export async function runSurveillance(): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const findings = await terminalRpc<unknown[]>("fn_tech_surveillance");
  const sb = getSupabaseServer() as unknown as Rpc;
  const { data, error } = await sb.rpc("tech_surveillance_ingest", { p_findings: findings ?? [] });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/automation");
  return { ok: true, message: `Scan complete — ${(data as number) ?? 0} new alert(s).` };
}
export async function resolveAlert(id: string): Promise<TechResult> {
  const g = await requireSuper(); if (!g.ok) return g;
  const sb = getSupabaseServer() as unknown as Rpc;
  const { error } = await sb.rpc("tech_surveillance_resolve", { p_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech/automation"); return { ok: true, message: "Alert resolved." };
}

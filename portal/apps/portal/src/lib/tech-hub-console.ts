import { getCurrentUser } from "./session";
import { getSupabaseServer } from "./supabase-server";

// Technology Hub (Super Admin) data layer. Reads run under the logged-in super
// admin's RLS session; the tech_* tables/RPCs are gated to super admins in the DB.
// tech_* objects aren't in the generated types — we use a loose-cast helper.

export type TechModule = {
  key: string; category: string; name: string; description: string | null;
  features: string[]; status: "available" | "beta" | "roadmap"; enabled: boolean;
  icon: string | null; sort: number;
};
export type TechAdmin = {
  id: string; email: string | null; full_name: string | null; role: string;
  is_super_admin: boolean; tech_permissions: string[] | null; created_at: string;
};
export type TechAudit = { actor_email: string | null; action: string; module: string | null; detail: Record<string, unknown>; ip?: string | null; created_at: string };
export type AuditRow = { id: string; actor_email: string | null; action: string; module: string | null; detail: Record<string, unknown>; ip: string | null; created_at: string };
export type TechOverview = {
  db: { size_pretty: string; size_bytes: number; tables: number; profiles: number; trades: number };
  modules: { total: number; enabled: number; available: number; beta: number; roadmap: number };
  super_admins: number; audit_24h: number; settings: Record<string, unknown>;
};

type LooseClient = {
  from: (t: string) => { select: (c: string) => { order: (c: string, o?: { ascending?: boolean }) => Promise<{ data: unknown[] | null }>; eq: (c: string, v: unknown) => { maybeSingle: () => Promise<{ data: unknown }> } } };
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>;
};

export async function getSuperAdmin() {
  const user = await getCurrentUser();
  const isSuper = Boolean((user?.profile as { is_super_admin?: boolean } | null)?.is_super_admin);
  return { user, isSuper };
}

export async function loadTechConsole() {
  const { user, isSuper } = await getSuperAdmin();
  if (!user || !isSuper) return { ok: false as const, error: "Super admin only." };
  const sb = getSupabaseServer() as unknown as LooseClient;
  const [ov, mods, admins, audit] = await Promise.all([
    sb.rpc("tech_overview"),
    sb.from("tech_modules").select("*").order("sort"),
    sb.rpc("tech_admins_list"),
    sb.rpc("tech_audit_recent", { p_limit: 30 }),
  ]);
  return {
    ok: true as const,
    overview: (ov.data as TechOverview) ?? null,
    modules: ((mods.data as TechModule[]) ?? []),
    admins: ((admins.data as TechAdmin[]) ?? []),
    audit: ((audit.data as TechAudit[]) ?? []),
  };
}

export async function loadTechModules(): Promise<TechModule[]> {
  const { user, isSuper } = await getSuperAdmin();
  if (!user || !isSuper) return [];
  const sb = getSupabaseServer() as unknown as LooseClient;
  const { data } = await sb.from("tech_modules").select("*").order("sort");
  return (data as TechModule[]) ?? [];
}

export async function loadTechModule(key: string): Promise<TechModule | null> {
  const mods = await loadTechModules();
  return mods.find((m) => m.key === key) ?? null;
}

export type Bridge = {
  id: string; name: string; kind: string; category: string; direction: string;
  endpoint: string | null; status: string; config: Record<string, unknown>;
  is_system: boolean; last_sync: string | null; created_at: string;
};

export async function loadBridges(): Promise<Bridge[]> {
  const { user, isSuper } = await getSuperAdmin();
  if (!user || !isSuper) return [];
  const sb = getSupabaseServer() as unknown as LooseClient;
  const { data } = await sb.rpc("tech_bridges_list");
  return (data as Bridge[]) ?? [];
}

export type ApiKey = { id: string; name: string; key_prefix: string; scopes: string[]; rate_limit: number; status: string; last_used: string | null; created_at: string };
export type SecurityRule = { id: string; kind: string; value: string; enabled: boolean; note: string | null; created_at: string };
export type Flag = { key: string; enabled: boolean };

async function rpcList<T>(fn: string): Promise<T[]> {
  const { user, isSuper } = await getSuperAdmin();
  if (!user || !isSuper) return [];
  const sb = getSupabaseServer() as unknown as LooseClient;
  const { data } = await sb.rpc(fn);
  return (data as T[]) ?? [];
}

export const loadApiKeys = () => rpcList<ApiKey>("tech_api_keys_list");
export const loadSecurityRules = () => rpcList<SecurityRule>("tech_security_list");
export const loadFlags = () => rpcList<Flag>("tech_flags_list");

export type RegistryItem = { id: string; kind: string; name: string; label: string | null; status: string; config: Record<string, unknown>; enabled: boolean; created_at: string };
export type SignalProvider = { id: string; name: string; status: string; subscribers: number };
export type PammFund = { id: string; name: string; status: string; aum: number | null; nav: number | null };
export type Signals = { providers: SignalProvider[]; funds: PammFund[]; stats: { providers: number; funds: number; subscriptions: number } };
export type CronJob = { jobid: number; name: string; schedule: string; active: boolean; last_run: string | null; last_status: string | null };
export type Jobs = { jobs: CronJob[]; outbox: { pending: number; total: number } };

export async function loadRegistry(kind: string): Promise<RegistryItem[]> {
  const { user, isSuper } = await getSuperAdmin();
  if (!user || !isSuper) return [];
  const sb = getSupabaseServer() as unknown as LooseClient;
  const { data } = await sb.rpc("tech_registry_list", { p_kind: kind });
  return (data as RegistryItem[]) ?? [];
}
export async function loadSignals(): Promise<Signals | null> {
  const { user, isSuper } = await getSuperAdmin();
  if (!user || !isSuper) return null;
  const sb = getSupabaseServer() as unknown as LooseClient;
  const { data } = await sb.rpc("tech_signals");
  return (data as Signals) ?? null;
}
export async function loadJobs(): Promise<Jobs | null> {
  const { user, isSuper } = await getSuperAdmin();
  if (!user || !isSuper) return null;
  const sb = getSupabaseServer() as unknown as LooseClient;
  const { data } = await sb.rpc("tech_jobs");
  return (data as Jobs) ?? null;
}
export type ApiUsage = {
  total: number; last_24h: number; last_1h: number; errors_24h: number; avg_latency_ms: number;
  by_endpoint: { path: string; calls: number; avg_ms: number }[];
  recent: { key_name: string | null; path: string; method: string; status: number; latency_ms: number; ip: string | null; created_at: string }[];
};
export async function loadApiUsage(): Promise<ApiUsage | null> {
  const { user, isSuper } = await getSuperAdmin();
  if (!user || !isSuper) return null;
  const sb = getSupabaseServer() as unknown as LooseClient;
  const { data } = await sb.rpc("tech_api_usage");
  return (data as ApiUsage) ?? null;
}

export type Capability = { capability: string; enabled: boolean; config: Record<string, unknown> };
export async function loadCapabilities(moduleKey: string): Promise<Capability[]> {
  const { user, isSuper } = await getSuperAdmin();
  if (!user || !isSuper) return [];
  const sb = getSupabaseServer() as unknown as LooseClient;
  const { data } = await sb.rpc("tech_capabilities_list", { p_module: moduleKey });
  return (data as Capability[]) ?? [];
}

export type SurveillanceAlert = { id: string; kind: string; severity: string; subject: string | null; detail: string | null; created_at: string };
export type Surveillance = { open: SurveillanceAlert[]; counts: { open: number; high: number; resolved_24h: number } };
export async function loadSurveillance(): Promise<Surveillance | null> {
  const { user, isSuper } = await getSuperAdmin();
  if (!user || !isSuper) return null;
  const sb = getSupabaseServer() as unknown as LooseClient;
  const { data } = await sb.rpc("tech_surveillance_list");
  return (data as Surveillance) ?? null;
}

export async function loadAuditRows(): Promise<AuditRow[]> {
  const { user, isSuper } = await getSuperAdmin();
  if (!user || !isSuper) return [];
  const sb = getSupabaseServer() as unknown as LooseClient;
  const { data } = await sb.rpc("tech_audit_search", { p_q: null, p_limit: 200 });
  return (data as AuditRow[]) ?? [];
}

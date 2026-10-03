"use server";

// §20 Compliance & Surveillance — a REAL, explainable risk view computed from
// the data we actually hold (KYC status, country on file, account age, and
// device/IP sharing between accounts). No external screening provider is wired,
// so sanctions / PEP / adverse-media are surfaced honestly as "needs a provider"
// rather than faked. Read-only: this module scores and surfaces, it never acts.

import { getSupabaseServer } from "@/lib/supabase-server";

const DAY_MS = 86_400_000;

export type RiskReason = { label: string; weight: number };
export type ClientRisk = {
  id: string;
  name: string;
  email: string | null;
  country: string | null;
  kycStatus: string | null;
  createdAt: string;
  score: number;              // 0–100
  band: "low" | "medium" | "high";
  reasons: RiskReason[];
  linkedCount: number;        // other accounts sharing a device or IP
};

export type LinkedCluster = {
  kind: "device" | "ip";
  key: string;                // masked device/ip
  members: { id: string; name: string; email: string | null }[];
};

export type ComplianceOverview = {
  monitored: number;
  highRisk: number;
  kycBacklog: number;
  clusters: LinkedCluster[];
  watchlist: ClientRisk[];    // sorted by score desc
};

function band(score: number): ClientRisk["band"] {
  return score >= 50 ? "high" : score >= 25 ? "medium" : "low";
}
function maskIp(ip: string): string {
  const p = ip.split(".");
  return p.length === 4 ? `${p[0]}.${p[1]}.x.x` : ip.slice(0, 6) + "…";
}

export async function loadComplianceOverview(): Promise<ComplianceOverview> {
  const supabase = getSupabaseServer();
  const [profilesRes, devicesRes, kycRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, country, kyc_status, created_at").eq("role", "trader"),
    supabase.from("device_sessions").select("user_id, device_id, ip_address").is("revoked_at", null),
    supabase.from("kyc_documents").select("user_id, status"),
  ]);

  const profiles = (profilesRes.data ?? []) as Array<{
    id: string; full_name: string | null; email: string | null; country: string | null; kyc_status: string | null; created_at: string;
  }>;
  const devices = (devicesRes.data ?? []) as Array<{ user_id: string; device_id: string | null; ip_address: string | null }>;

  // ── Linked-account detection: users sharing a device_id or IP ──
  const byDevice = new Map<string, Set<string>>();
  const byIp = new Map<string, Set<string>>();
  for (const d of devices) {
    if (d.device_id) (byDevice.get(d.device_id) ?? byDevice.set(d.device_id, new Set()).get(d.device_id)!).add(d.user_id);
    if (d.ip_address) (byIp.get(d.ip_address) ?? byIp.set(d.ip_address, new Set()).get(d.ip_address)!).add(d.user_id);
  }
  const linkedWith = new Map<string, Set<string>>();
  const addLink = (users: Set<string>) => {
    if (users.size < 2) return;
    for (const u of users) {
      const set = linkedWith.get(u) ?? linkedWith.set(u, new Set()).get(u)!;
      for (const other of users) if (other !== u) set.add(other);
    }
  };
  for (const s of byDevice.values()) addLink(s);
  for (const s of byIp.values()) addLink(s);

  const nameOf = new Map(profiles.map((p) => [p.id, p.full_name || p.email || `User ${p.id.slice(0, 8)}`]));
  const emailOf = new Map(profiles.map((p) => [p.id, p.email]));

  const clusters: LinkedCluster[] = [];
  const seen = new Set<string>();
  for (const [dev, users] of byDevice) {
    if (users.size < 2) continue;
    const k = "d:" + [...users].sort().join(",");
    if (seen.has(k)) continue; seen.add(k);
    clusters.push({ kind: "device", key: dev.slice(0, 8) + "…", members: [...users].map((id) => ({ id, name: nameOf.get(id) ?? id, email: emailOf.get(id) ?? null })) });
  }
  for (const [ip, users] of byIp) {
    if (users.size < 2) continue;
    const k = "i:" + [...users].sort().join(",");
    if (seen.has(k)) continue; seen.add(k);
    clusters.push({ kind: "ip", key: maskIp(ip), members: [...users].map((id) => ({ id, name: nameOf.get(id) ?? id, email: emailOf.get(id) ?? null })) });
  }

  // ── Per-client risk score ──
  const now = Date.now();
  const watchlist: ClientRisk[] = profiles.map((p) => {
    const reasons: RiskReason[] = [];
    const kyc = p.kyc_status ?? "not_started";
    if (kyc === "not_started") reasons.push({ label: "KYC not started", weight: 35 });
    else if (kyc === "in_review" || kyc === "in_progress") reasons.push({ label: "KYC pending review", weight: 15 });
    if (!p.country) reasons.push({ label: "No country on file", weight: 10 });
    const ageDays = (now - new Date(p.created_at).getTime()) / DAY_MS;
    if (ageDays < 7) reasons.push({ label: "New account (< 7 days)", weight: 10 });
    const linked = linkedWith.get(p.id)?.size ?? 0;
    if (linked > 0) reasons.push({ label: `Shares a device/IP with ${linked} other account${linked === 1 ? "" : "s"}`, weight: Math.min(30, 15 + linked * 5) });

    const score = Math.min(100, reasons.reduce((a, r) => a + r.weight, 0));
    return {
      id: p.id, name: p.full_name || p.email || `User ${p.id.slice(0, 8)}`, email: p.email,
      country: p.country, kycStatus: p.kyc_status, createdAt: p.created_at,
      score, band: band(score), reasons: reasons.sort((a, b) => b.weight - a.weight), linkedCount: linked,
    };
  }).sort((a, b) => b.score - a.score);

  const kycBacklog = (kycRes.data ?? []).filter((d) => (d as { status?: string }).status === "pending").length
    || profiles.filter((p) => (p.kyc_status ?? "not_started") !== "approved").length;

  return {
    monitored: profiles.length,
    highRisk: watchlist.filter((c) => c.band === "high").length,
    kycBacklog,
    clusters,
    watchlist,
  };
}

// Server-only helpers for the public REST API gateway (/api/v1/*). Keys are
// validated against tech_api_keys by sha256 hash; usage is logged to
// tech_api_requests. All access is via the portal service role (PostgREST/fetch).
import { createHash } from "crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function h(extra?: Record<string, string>) {
  return { apikey: KEY ?? "", Authorization: `Bearer ${KEY ?? ""}`, ...(extra ?? {}) };
}

async function portalSelect<T = unknown>(path: string): Promise<T[] | null> {
  if (!URL || !KEY) return null;
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: h(), cache: "no-store" });
  if (!r.ok) return null;
  return (await r.json()) as T[];
}
async function portalInsert(path: string, body: unknown): Promise<void> {
  if (!URL || !KEY) return;
  await fetch(`${URL}/rest/v1/${path}`, { method: "POST", headers: h({ "Content-Type": "application/json", Prefer: "return=minimal" }), body: JSON.stringify(body) });
}
async function portalPatch(path: string, body: unknown): Promise<void> {
  if (!URL || !KEY) return;
  await fetch(`${URL}/rest/v1/${path}`, { method: "PATCH", headers: h({ "Content-Type": "application/json", Prefer: "return=minimal" }), body: JSON.stringify(body) });
}

export type ApiKeyRow = { id: string; name: string; rate_limit: number; scopes: string[] };

export async function authenticateKey(fullKey: string): Promise<ApiKeyRow | null> {
  if (!fullKey) return null;
  const hash = createHash("sha256").update(fullKey).digest("hex");
  const rows = await portalSelect<ApiKeyRow>(`tech_api_keys?key_hash=eq.${hash}&status=eq.active&select=id,name,rate_limit,scopes`);
  return rows && rows.length ? rows[0] : null;
}

// Simple fixed-window limiter: max `limit` requests per rolling 60s per key.
export async function withinRateLimit(keyId: string, limit: number): Promise<boolean> {
  const sinceISO = new Date(Date.now() - 60_000).toISOString();
  const rows = await portalSelect<{ id: string }>(`tech_api_requests?key_id=eq.${keyId}&created_at=gte.${sinceISO}&select=id`);
  return (rows?.length ?? 0) < (limit || 1000);
}

export async function logRequest(r: { key_id: string | null; key_name: string | null; path: string; method: string; status: number; latency_ms: number; ip: string | null }): Promise<void> {
  await portalInsert("tech_api_requests", r);
}

export async function touchKey(keyId: string): Promise<void> {
  await portalPatch(`tech_api_keys?id=eq.${keyId}`, { last_used: new Date().toISOString() });
}

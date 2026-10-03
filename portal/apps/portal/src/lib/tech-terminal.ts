// Server-only access to the terminal Supabase project (instruments, positions, LP
// config, etc.). Everything goes over PostgREST/fetch — no supabase-js client — so
// it works in any Node runtime (supabase-js's realtime needs a WebSocket polyfill).
// The portal service-role key (process.env) reads the terminal URL + service key
// from the RLS-locked bridge_secrets; we then talk to the terminal directly.

async function terminalCfg(): Promise<{ url: string; key: string } | null> {
  // Direct env credentials first (Netlify hosting has no portal service key,
  // so the bridge_secrets indirection is unreachable there). Same values as
  // the bridge_secrets rows, just injected as env.
  const directUrl = process.env.RAPTOR_BRIDGE_URL;
  const directKey = process.env.RAPTOR_BRIDGE_SERVICE_KEY;
  if (directUrl && directKey) return { url: directUrl, key: directKey };

  const purl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pkey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!purl || !pkey) return null;
  const r = await fetch(`${purl}/rest/v1/bridge_secrets?select=key,value`, {
    headers: { apikey: pkey, Authorization: `Bearer ${pkey}` }, cache: "no-store",
  });
  if (!r.ok) return null;
  const rows = (await r.json()) as { key: string; value: string }[];
  const cfg = Object.fromEntries((rows ?? []).map((x) => [x.key, x.value]));
  if (!cfg.raptor_url || !cfg.raptor_service_key) return null;
  return { url: cfg.raptor_url, key: cfg.raptor_service_key };
}

function headers(key: string, extra?: Record<string, string>) {
  return { apikey: key, Authorization: `Bearer ${key}`, ...(extra ?? {}) };
}

export async function terminalSelect<T = unknown>(path: string): Promise<T[] | null> {
  const c = await terminalCfg();
  if (!c) return null;
  const r = await fetch(`${c.url}/rest/v1/${path}`, { headers: headers(c.key), cache: "no-store" });
  if (!r.ok) return null;
  return (await r.json()) as T[];
}

export async function terminalRpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T | null> {
  const c = await terminalCfg();
  if (!c) return null;
  const r = await fetch(`${c.url}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: headers(c.key, { "Content-Type": "application/json" }), body: JSON.stringify(args), cache: "no-store",
  });
  if (!r.ok) return null;
  return (await r.json()) as T;
}

export async function terminalPatch(path: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  const c = await terminalCfg();
  if (!c) return { ok: false, error: "Terminal connection not configured." };
  const r = await fetch(`${c.url}/rest/v1/${path}`, {
    method: "PATCH", headers: headers(c.key, { "Content-Type": "application/json", Prefer: "return=minimal" }), body: JSON.stringify(body),
  });
  if (!r.ok) return { ok: false, error: (await r.text()).slice(0, 180) };
  return { ok: true };
}

export async function terminalInsert(path: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  const c = await terminalCfg();
  if (!c) return { ok: false, error: "Terminal connection not configured." };
  const r = await fetch(`${c.url}/rest/v1/${path}`, {
    method: "POST", headers: headers(c.key, { "Content-Type": "application/json", Prefer: "return=minimal" }), body: JSON.stringify(body),
  });
  if (!r.ok) return { ok: false, error: (await r.text()).slice(0, 180) };
  return { ok: true };
}

export async function terminalDelete(path: string): Promise<{ ok: boolean; error?: string }> {
  const c = await terminalCfg();
  if (!c) return { ok: false, error: "Terminal connection not configured." };
  const r = await fetch(`${c.url}/rest/v1/${path}`, { method: "DELETE", headers: headers(c.key, { Prefer: "return=minimal" }) });
  if (!r.ok) return { ok: false, error: (await r.text()).slice(0, 180) };
  return { ok: true };
}

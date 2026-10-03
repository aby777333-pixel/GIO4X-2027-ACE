import { NextResponse, type NextRequest } from "next/server";
import { authenticateKey, withinRateLimit, logRequest, touchKey } from "@/lib/api-gateway";
import { terminalSelect, terminalRpc } from "@/lib/tech-terminal";

export const dynamic = "force-dynamic";

// Public, key-authenticated REST API for GIO4X. Third-party developers call these
// with `Authorization: Bearer gio4x_live_...`. Every call is rate-limited and
// logged to tech_api_requests (surfaced as Usage analytics in the Tech Hub).

type Hub = { book?: unknown[] };

function jres(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest, { params }: { params: { slug?: string[] } }) {
  const t0 = Date.now();
  const slug = (params.slug ?? []).join("/");
  const path = `/api/v1/${slug}`;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return jres(401, { error: "Missing API key. Send 'Authorization: Bearer <key>'." });

  const key = await authenticateKey(token);
  if (!key) {
    await logRequest({ key_id: null, key_name: null, path, method: "GET", status: 401, latency_ms: Date.now() - t0, ip });
    return jres(401, { error: "Invalid, suspended, or revoked API key." });
  }

  if (!(await withinRateLimit(key.id, key.rate_limit))) {
    await logRequest({ key_id: key.id, key_name: key.name, path, method: "GET", status: 429, latency_ms: Date.now() - t0, ip });
    return jres(429, { error: `Rate limit exceeded (${key.rate_limit}/min).` });
  }

  let status = 200;
  let body: unknown;
  switch (slug) {
    case "ping":
      body = { ok: true, time: new Date().toISOString(), key: key.name, scopes: key.scopes };
      break;
    case "instruments":
      body = { data: (await terminalSelect("instruments?select=symbol,description,type,spread_markup,commission_per_lot,min_lot,max_lot&is_active=eq.true&order=symbol.asc")) ?? [] };
      break;
    case "quotes": {
      const hub = (await terminalRpc<Hub>("fn_tech_hub")) ?? {};
      body = { data: hub.book ?? [] };
      break;
    }
    default:
      status = 404;
      body = { error: `Unknown endpoint ${path}`, endpoints: ["/api/v1/ping", "/api/v1/instruments", "/api/v1/quotes"] };
  }

  await logRequest({ key_id: key.id, key_name: key.name, path, method: "GET", status, latency_ms: Date.now() - t0, ip });
  await touchKey(key.id);
  return jres(status, body);
}

import { type NextRequest } from "next/server";
import { authenticateKey, logRequest, touchKey } from "@/lib/api-gateway";
import { terminalRpc } from "@/lib/tech-terminal";

export const dynamic = "force-dynamic";

// Live Server-Sent Events quote stream. Key-authenticated like the REST gateway.
// Streams the aggregated book every 2s for up to 2 minutes per connection, then
// closes (clients reconnect). For true live delivery behind nginx the location
// needs `proxy_buffering off`.
type Hub = { book?: unknown[] };

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const key = await authenticateKey(token);
  if (!key) {
    await logRequest({ key_id: null, key_name: null, path: "/api/v1/stream", method: "GET", status: 401, latency_ms: 0, ip });
    return new Response(JSON.stringify({ error: "Invalid or missing API key." }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      send({ type: "connected", key: key.name, time: new Date().toISOString() });
      for (let i = 0; i < 60 && !cancelled; i++) {
        try {
          const hub = (await terminalRpc<Hub>("fn_tech_hub")) ?? {};
          send({ type: "quotes", time: new Date().toISOString(), book: hub.book ?? [] });
        } catch {
          send({ type: "error", time: new Date().toISOString() });
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      try { controller.close(); } catch { /* already closed */ }
    },
    cancel() { cancelled = true; },
  });

  await logRequest({ key_id: key.id, key_name: key.name, path: "/api/v1/stream", method: "GET", status: 200, latency_ms: 0, ip });
  await touchKey(key.id);
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive" } });
}

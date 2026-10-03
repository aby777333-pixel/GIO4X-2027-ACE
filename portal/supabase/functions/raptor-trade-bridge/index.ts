// raptor-trade-bridge — mirrors GIO RAPTOR terminal positions into this portal's
// public.trades via the idempotent bridge_ingest_position() RPC. Runs on a
// 1-minute pg_cron schedule.
//
// 2026-06-22: mirrors OPEN positions too (Trade Log shows live open trades) and
// updates an open mirror to closed when it closes. Pulls every position for the
// mapped account(s) and relies on the RPC's idempotent upsert (insert open /
// insert closed / open->closed transition / skip already-closed). No watermark,
// so out-of-order closes are never missed.
//
// Config lives in the portal's private public.bridge_secrets table (RLS-locked):
//   raptor_url, raptor_service_key  — terminal project URL + service-role key
//   bridge_secret                   — shared secret the cron caller must send
//
// Auth: verify_jwt is disabled; the function self-guards with bridge_secret.

import { createClient } from "jsr:@supabase/supabase-js@2";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const portal = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: cfgRows, error: cfgErr } = await portal
    .from("bridge_secrets")
    .select("key,value");
  if (cfgErr) return json({ ok: false, error: "config read failed: " + cfgErr.message }, 500);
  const cfg = Object.fromEntries((cfgRows ?? []).map((r) => [r.key, r.value]));

  if (!cfg.bridge_secret || req.headers.get("x-bridge-secret") !== cfg.bridge_secret) {
    return json({ ok: false, error: "forbidden" }, 403);
  }
  if (!cfg.raptor_url || !cfg.raptor_service_key) {
    return json({ ok: false, error: "raptor config missing" }, 500);
  }

  const raptor = createClient(cfg.raptor_url, cfg.raptor_service_key);

  // Friendly account numbers so auto-provisioned mirror accounts are recognisable
  // in the Trade Log (the ingest RPC names a new mirror after account_number).
  const { data: accts } = await raptor.from("trading_accounts").select("id,account_number");
  const numById = Object.fromEntries((accts ?? []).map((a) => [a.id, a.account_number]));

  // Scan EVERY terminal position — the ingest RPC auto-provisions a portal mirror
  // account + map row for any unmapped Raptor account, so the Trade Log reflects
  // the whole platform. The RPC is an idempotent upsert, so re-scanning is cheap.
  const { data: positions, error: posErr } = await raptor
    .from("positions")
    .select(
      "id,account_id,symbol,direction,size,open_price,close_price,realized_pnl,commission,swap_accrued,status,opened_at,closed_at",
    )
    .order("opened_at", { ascending: false })
    .limit(5000);
  if (posErr) return json({ ok: false, error: posErr.message }, 500);

  let ingested = 0;
  for (const p of positions ?? []) {
    const payload = { ...p, account_number: numById[p.account_id] ?? null };
    const { data: tid, error } = await portal.rpc("bridge_ingest_position", { p: payload });
    if (error) return json({ ok: false, error: error.message, ingested }, 500);
    if (tid) ingested++;
  }
  return json({ ok: true, scanned: (positions ?? []).length, ingested });
});

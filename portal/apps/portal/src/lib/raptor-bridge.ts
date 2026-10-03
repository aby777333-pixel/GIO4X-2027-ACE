import { terminalSelect, terminalPatch } from "./tech-terminal";
import { aggregateExposure } from "@gio4x/dealer-core";
import type { Position, BookType, BridgeHealth } from "@gio4x/dealer-core";

// RaptorBridge — the live TradeServerBridge adapter to GIO Raptor (the trade
// server) over the terminal fetch layer. Phase-4 subset: read positions, push
// book assignments, heartbeat. The order-webhook hot-path injection is staged
// (built behind MockBridge) and turned on deliberately, not here.
type RaptorPos = {
  id: string; account_id: string; symbol: string; direction: string; size: number;
  open_price: number; current_price: number | null; floating_pnl: number | null;
  routing_mode: string | null; opened_at: string | null;
};

const enc = (s: string) => encodeURIComponent(s);

// Stable positive bigint ticket derived from the Raptor position uuid.
function ticketOf(uuid: string): number {
  let h = 0;
  for (const ch of uuid.replace(/-/g, "")) {
    const d = parseInt(ch, 16);
    if (!Number.isNaN(d)) h = (h * 31 + d) % 9007199254740991;
  }
  return h || 1;
}

export const RaptorBridge = {
  async syncPositions(): Promise<Position[] | null> {
    const rows = await terminalSelect<RaptorPos>(
      "positions?status=eq.open&select=id,account_id,symbol,direction,size,open_price,current_price,floating_pnl,routing_mode,opened_at&limit=5000",
    );
    if (rows == null) return null;
    return rows.map((r) => ({
      ticket: ticketOf(r.id),
      accountId: r.account_id,
      symbol: r.symbol,
      side: String(r.direction).toLowerCase() === "sell" ? "sell" : "buy",
      volumeLots: Number(r.size),
      openPrice: Number(r.open_price),
      currentPrice: r.current_price ?? undefined,
      book: r.routing_mode === "a_book" ? "a_book" : "b_book",
      floatingPnl: r.floating_pnl ?? undefined,
      openedAt: r.opened_at ?? undefined,
    }));
  },

  // Push a book assignment back to Raptor (used by the auto-switcher).
  async applyBookAssignment(accountId: string, book: BookType): Promise<{ ok: boolean; error?: string }> {
    return terminalPatch(`trading_accounts?id=eq.${enc(accountId)}`, { book_assignment: book });
  },

  async heartbeat(): Promise<BridgeHealth> {
    const r = await terminalSelect("instruments?select=symbol&limit=1");
    return { ok: r != null, lastSync: new Date().toISOString(), message: r != null ? "raptor reachable" : "raptor unreachable" };
  },
};

// Read live positions → run the engine's exposure aggregation → shape the ingest payload.
export async function buildDealerSyncPayload(): Promise<{ positions: object[]; exposure: object[] } | null> {
  const positions = await RaptorBridge.syncPositions();
  if (positions == null) return null;
  const exposure = aggregateExposure(positions);
  return {
    positions: positions.map((p) => ({
      ticket: p.ticket, account_id: p.accountId, symbol: p.symbol, side: p.side, volume_lots: p.volumeLots,
      open_price: p.openPrice, current_price: p.currentPrice ?? null, book: p.book, floating_pnl: p.floatingPnl ?? null, opened_at: p.openedAt ?? null,
    })),
    exposure: exposure.map((e) => ({ dimension: e.dimension, ref: e.ref, long: e.long, short: e.short, net: e.net, gross: e.gross, netUsd: e.netUsd })),
  };
}

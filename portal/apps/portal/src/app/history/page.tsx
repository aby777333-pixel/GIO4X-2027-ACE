import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody } from "@gio4x/ui";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import { TradeHistoryClient, type Trade } from "./history-client";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  let trades: Trade[] = [];

  if (user) {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("trades")
      .select(
        "id, ticket, symbol, side, lots, open_price, close_price, pnl, opened_at, closed_at, trading_accounts(account_number)",
      )
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(300);

    trades = (data ?? []).map((t) => {
      const acct = t.trading_accounts as unknown as { account_number: string } | null;
      return {
        id: t.id,
        ticket: t.ticket ? String(t.ticket) : t.id.slice(0, 8),
        account: acct?.account_number ?? "—",
        symbol: t.symbol,
        side: t.side === "sell" ? "SELL" : "BUY",
        lots: Number(t.lots),
        open: t.open_price !== null ? Number(t.open_price) : null,
        close: t.close_price !== null ? Number(t.close_price) : null,
        pnl: Number(t.pnl),
        openedAt: t.opened_at ? new Date(t.opened_at).toISOString().slice(0, 16).replace("T", " ") : "",
        closedAt: t.closed_at ? new Date(t.closed_at).toISOString().slice(0, 16).replace("T", " ") : "",
      };
    });
  }

  return (
    <Shell title="Trade History">
      <PageHeader
        title="Trade History"
        subtitle="Every closed trade across all live and demo accounts."
      />

      {!user ? (
        <Card>
          <CardBody className="px-6 py-10 text-center text-sm text-steel">
            <Link href="/auth/login?redirect=/history" className="font-medium text-sky hover:underline">
              Sign in
            </Link>{" "}
            to see your trade history.
          </CardBody>
        </Card>
      ) : (
        <TradeHistoryClient trades={trades} />
      )}
    </Shell>
  );
}

import Link from "next/link";
import { Shell } from "@/components/Shell";
import { HeroShowcase } from "@/components/HeroShowcase";
import { MarketsTable } from "@/components/MarketsTable";
import { CurrencyCorrelation } from "@/components/CurrencyCorrelation";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  History,
  ChevronDown,
  LineChart,
  ExternalLink,
} from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import { loadWalletRollup } from "@/lib/wallet-actions";
import { TERMINAL_URL } from "@/lib/constants";

const assetActions = [
  { label: "Deposit", href: "/deposits", icon: ArrowDownToLine, primary: true },
  { label: "Withdrawal", href: "/withdrawals", icon: ArrowUpFromLine, primary: false },
  { label: "Transfer", href: "/transfers", icon: ArrowLeftRight, primary: false },
  { label: "History", href: "/funds/history", icon: History, primary: false },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// Demo fallback when no user is signed in (Netlify AUTH_ENFORCE=false visitor mode).
const demoAccounts = [
  { id: "demo-1", number: "18433282", balance: 0.02, currency: "USC", plan: "Cent Swap-Free STP" },
  { id: "demo-2", number: "15624153", balance: 0, currency: "USD", plan: "Swap-Free STP" },
];

export default async function ClientHomePage() {
  const user = await getCurrentUser();

  let totalUsd = 0;
  let accounts = demoAccounts;
  // Launch Terminal carries the client's account criteria (demo/live) into
  // the GIORAPTOR terminal, which honors ?account= deep-links.
  let launchUrl: string = TERMINAL_URL;

  if (user) {
    const supabase = getSupabaseServer();
    const [{ totalUsdEstimate }, accountRows] = await Promise.all([
      loadWalletRollup(),
      supabase
        .from("trading_accounts")
        .select("id, account_number, balance, base_currency, plan_name, status, account_kind, server")
        .order("created_at", { ascending: false })
        .limit(3),
    ]);
    totalUsd = totalUsdEstimate;
    const rows = accountRows.data ?? [];
    const primary =
      rows.find((a) => a.account_kind !== "demo" && a.status === "active") ??
      rows.find((a) => a.status === "active") ??
      rows[0];
    if (primary?.account_number) {
      const params = new URLSearchParams({
        account: String(primary.account_number),
        demo: primary.account_kind === "demo" ? "1" : "0",
      });
      if (primary.server) params.set("server", String(primary.server));
      launchUrl = `${TERMINAL_URL}?${params.toString()}`;
    }
    accounts = (accountRows.data ?? []).map((a) => ({
      id: a.id,
      number: a.account_number,
      balance: Number(a.balance ?? 0),
      currency: a.base_currency,
      plan: a.plan_name,
    }));
    if (accounts.length === 0) {
      accounts = [];
    }
  }

  return (
    <Shell title="Home">
      <HeroShowcase />

      <Link
        href={launchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky/30 bg-gradient-to-r from-sky/10 via-sky/5 to-transparent px-5 py-4 transition hover:border-sky/60 hover:shadow-lg"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky text-white shadow-md">
            <LineChart size={22} />
          </div>
          <div>
            <div className="text-base font-bold text-navy">Open Trading Terminal</div>
            <div className="mt-0.5 text-xs text-steel">
              Launch the GIO Raptor charts, order book, and execution engine in a new tab.
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky px-4 py-2 text-xs font-semibold text-white">
          Launch Terminal <ExternalLink size={12} />
        </span>
      </Link>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Total assets estimate</CardTitle>
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[10px] text-steel"
                title="Estimated USD equivalent across all wallets"
              >
                ?
              </span>
            </div>
          </CardHeader>
          <CardBody>
            <div className="flex items-end gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">
                $
              </span>
              <span className="text-3xl font-bold text-navy">{fmt(totalUsd)}</span>
              <button className="flex items-center gap-1 pb-1 text-sm text-steel">
                USD <ChevronDown size={14} />
              </button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {assetActions.map((a) => {
                const Icon = a.icon;
                return (
                  <Link
                    key={a.label}
                    href={a.href}
                    className={
                      a.primary
                        ? "inline-flex items-center gap-1.5 rounded-lg bg-sky px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-light"
                        : "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-navy transition hover:border-sky/40"
                    }
                  >
                    <Icon size={12} />
                    {a.label}
                  </Link>
                );
              })}
            </div>
            {!user ? (
              <div className="mt-4 rounded-lg border border-sky/20 bg-sky/5 px-3 py-2 text-[11px] text-navy">
                You&apos;re browsing as a visitor.{" "}
                <Link href="/auth/login" className="font-semibold text-sky hover:underline">
                  Sign in
                </Link>{" "}
                to see your real wallet and accounts.
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trading Account</CardTitle>
            <Link href="/accounts" className="text-xs font-medium text-sky hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardBody>
            {accounts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-steel">
                You don&apos;t have any trading accounts yet.
                <div className="mt-2">
                  <Link
                    href="/accounts/demo"
                    className="inline-flex rounded-lg bg-sky px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Create a demo account
                  </Link>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {accounts.map((acc) => (
                  <li
                    key={acc.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-sky/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky">
                        Raptor
                      </span>
                      <span className="text-sm font-medium text-navy">{acc.number}</span>
                    </div>
                    <div className="flex items-center gap-5 text-xs">
                      <div className="text-right">
                        <div className="font-semibold text-navy">{fmt(acc.balance)}</div>
                        <div className="text-[10px] uppercase text-steel-light">{acc.currency}</div>
                      </div>
                      <div className="hidden text-right text-steel sm:block">{acc.plan}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Markets</CardTitle>
        </CardHeader>
        <CardBody className="px-0 pt-2">
          <MarketsTable />
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardBody>
          <CurrencyCorrelation />
        </CardBody>
      </Card>

      <div className="mt-6 rounded-lg bg-slate-50 px-5 py-4 text-[11px] leading-relaxed text-steel">
        <strong className="text-navy">RISK STATEMENT:</strong> All investments entail risks and may
        result in both profits and losses. In particular, trading leveraged derivative products such
        as Foreign Exchange (Forex) and Contracts for Difference (CFDs) carries a high level of
        risk to your capital. All these derivative products, many of which are leveraged, may not
        be appropriate for all investors. The effect of leverage is that both gains and losses are
        magnified. Please trade responsibly.
      </div>
    </Shell>
  );
}

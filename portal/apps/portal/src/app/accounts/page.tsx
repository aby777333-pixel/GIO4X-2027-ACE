import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHero } from "@/components/PageHero";
import { MetricGrid } from "@/components/MetricGrid";
import { AccountChip } from "@/components/AccountChip";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody } from "@gio4x/ui";
import { LINKS } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import { OpenLiveAccountButton } from "./open-account";
import { loadActiveAccountTypes } from "@/lib/account-type-actions";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Briefcase,
  ChartLine,
  KeyRound,
  Plus,
  Settings2,
  Wallet,
} from "lucide-react";

type AccountRow = {
  id: string;
  account_number: string;
  account_kind: "demo" | "live" | "ib" | "partner" | "archived";
  plan_name: string;
  base_currency: string;
  balance: number;
  equity: number;
  leverage: number;
  server: string;
  status: "active" | "suspended" | "closed" | "archived";
};

const demoAccounts: AccountRow[] = [
  {
    id: "demo-1",
    account_number: "99001122",
    account_kind: "demo",
    plan_name: "Premium Demo",
    base_currency: "USD",
    balance: 10000,
    equity: 10245.6,
    leverage: 500,
    server: "GIO4X-Demo",
    status: "active",
  },
];

const fmt = (n: number, c: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: c === "USC" ? "USD" : c,
  }).format(n);

export default async function AccountsPage() {
  const user = await getCurrentUser();
  const planTypes = await loadActiveAccountTypes().catch(() => []);

  let accounts: AccountRow[] = demoAccounts;
  if (user) {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("trading_accounts")
      .select(
        "id, account_number, account_kind, plan_name, base_currency, balance, equity, leverage, server, status",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    accounts = (data ?? []) as AccountRow[];
  }

  const live = accounts.filter((a) => a.account_kind === "live" && a.status === "active");
  const demo = accounts.filter((a) => a.account_kind === "demo");
  const totalEquity = live.reduce(
    (sum, a) => sum + (a.base_currency === "USC" ? a.equity / 100 : a.equity),
    0,
  );

  return (
    <Shell title="Accounts">
      <PageHero
        eyebrow="Your Accounts"
        image="/hero/hero-accounts.jpg"
        title="Accounts"
        subtitle="All your trading accounts in one place. Open new ones, fund them, switch between live and demo."
        actions={
          <>
            <OpenLiveAccountButton plans={planTypes} />
            <Link
              href="/accounts/demo"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-navy hover:border-sky/40"
            >
              <Plus size={14} />
              New Demo
            </Link>
          </>
        }
      />

      {!user ? (
        <div className="mb-4 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-xs text-steel">
          Showing demo data.{" "}
          <Link href="/auth/login?redirect=/accounts" className="font-medium text-sky hover:underline">
            Sign in
          </Link>{" "}
          to view your real trading accounts.
        </div>
      ) : null}

      <MetricGrid
        metrics={[
          { label: "Live accounts", value: String(live.length), icon: <Briefcase size={14} /> },
          {
            label: "Total equity (USD)",
            value: `$${totalEquity.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            icon: <Wallet size={14} />,
          },
          { label: "Demo accounts", value: String(demo.length), icon: <ChartLine size={14} /> },
          {
            label: "Open positions",
            value: "0",
            icon: <ChartLine size={14} />,
            hint: "across all live accounts",
          },
        ]}
      />

      {accounts.length === 0 ? (
        <Card className="mt-6">
          <CardBody className="!py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sky/10 text-sky">
              <Briefcase size={20} />
            </div>
            <div className="mt-3 text-base font-semibold text-navy">No accounts yet</div>
            <div className="mt-1 text-xs text-steel">
              Spin up a demo to feel the engine, or open a live account when you&apos;re ready.
            </div>
            <div className="mt-4 flex justify-center gap-2">
              <Link
                href="/accounts/demo"
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky px-4 py-2 text-xs font-semibold text-white"
              >
                <Plus size={14} /> Create Demo
              </Link>
              <OpenLiveAccountButton variant="ghost" label="Open Live" plans={planTypes} />
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {accounts.map((acc) => (
            <Card key={acc.id} className="!rounded-xl">
              <CardBody className="!pt-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky/10 text-sky">
                      <Briefcase size={20} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <AccountChip />
                        <span className="text-lg font-bold text-navy">{acc.account_number}</span>
                        <StatusBadge
                          tone={
                            acc.account_kind === "live" && acc.status === "active"
                              ? "success"
                              : acc.account_kind === "demo"
                              ? "info"
                              : "neutral"
                          }
                        >
                          {acc.account_kind.toUpperCase()}
                        </StatusBadge>
                      </div>
                      <div className="mt-0.5 text-xs text-steel">
                        {acc.plan_name} · {acc.server} · Leverage 1:{acc.leverage}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-steel-light">Balance</div>
                      <div className="text-base font-semibold text-navy">
                        {fmt(Number(acc.balance), acc.base_currency)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-steel-light">Equity</div>
                      <div className="text-base font-semibold text-navy">
                        {fmt(Number(acc.equity), acc.base_currency)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-steel-light">Currency</div>
                      <div className="text-base font-semibold text-navy">{acc.base_currency}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {acc.account_kind === "live" ? (
                    <>
                      <Link
                        href="/deposits"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-light"
                      >
                        <ArrowDownToLine size={12} /> Deposit
                      </Link>
                      <Link
                        href="/withdrawals"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-navy hover:border-sky/40"
                      >
                        <ArrowUpFromLine size={12} /> Withdraw
                      </Link>
                      <Link
                        href="/transfers"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-navy hover:border-sky/40"
                      >
                        <ArrowLeftRight size={12} /> Transfer
                      </Link>
                    </>
                  ) : null}
                  <Link
                    href={`${LINKS.raptor.terminal}?account=${encodeURIComponent(acc.account_number)}&server=${encodeURIComponent(acc.server)}&demo=${acc.account_kind === "demo" ? 1 : 0}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-navy hover:border-sky/40"
                  >
                    <ChartLine size={12} /> Open in Raptor
                  </Link>
                  <Link
                    href="/security"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-navy hover:border-sky/40"
                  >
                    <KeyRound size={12} /> Change Password
                  </Link>
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-navy hover:border-sky/40"
                  >
                    <Settings2 size={12} /> Settings
                  </Link>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </Shell>
  );
}

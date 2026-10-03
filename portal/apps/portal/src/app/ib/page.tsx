import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHero } from "@/components/PageHero";
import { PerformanceChart } from "@/components/PerformanceChart";
import { InstrumentDonut } from "@/components/InstrumentDonut";
import { IbGrowthPanel } from "@/components/IbGrowthPanel";
import { Card, CardBody, CardHeader, CardTitle, StatTile, Button } from "@gio4x/ui";
import { getCurrentUser } from "@/lib/session";
import { loadMyRebateSummary } from "@/lib/rebate-actions";
import {
  Coins,
  TrendingUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  UserPlus,
  Users,
  Briefcase,
} from "lucide-react";

export const dynamic = "force-dynamic";

const topAccounts = [
  { account: "7457705", name: "SIVANESAN P", volume: "238.25 Micro", rebate: "4.76" },
  { account: "21641714", name: "GANESAN P", volume: "20.52 Micro", rebate: "1.03" },
  { account: "20511674", name: "MD AFSAR", volume: "17.31 Micro", rebate: "0.87" },
  { account: "22486049", name: "BHUVANESWARI L", volume: "10.26 Micro", rebate: "0.51" },
];

const recentAccounts = [
  { account: "24819714", name: "LOGUPRABHU T", balance: "20,920.62" },
  { account: "24819546", name: "Arul B", balance: "20,977.94" },
  { account: "24819533", name: "Arul B", balance: "0.00" },
  { account: "24813368", name: "Arul B", balance: "31,741.35" },
];

export default async function IbDashboardPage() {
  const user = await getCurrentUser();
  const rebate = await loadMyRebateSummary("USD");
  const totalCommission = rebate.lifetime;

  return (
    <Shell title="IB Dashboard">
      <PageHero
        eyebrow="Partners"
        image="/hero/hero-ib.jpg"
        title="IB Dashboard"
        subtitle="Grow your network, track rebates, and manage your sub-IBs and clients — all in one place."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Rebate Account</CardTitle>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-steel">
                Total Commission
              </div>
            </div>
            <Link href="/ib/funds" className="text-xs font-medium text-sky hover:underline">
              Transaction History →
            </Link>
          </CardHeader>
          <CardBody>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-navy">{totalCommission.toFixed(2)}</span>
              <span className="pb-1 text-sm text-steel">USD</span>
              <Link href="/ib/funds" className="ml-auto text-xs font-medium text-sky hover:underline">
                ↳ Claim Rebate
              </Link>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <div>
                <div className="text-xs text-steel">Available Balance</div>
                <div className="text-sm font-semibold text-navy">{rebate.rebateBalance.toFixed(2)} USD</div>
              </div>
              <div className="flex gap-2">
                <Link href="/ib/funds">
                  <Button variant="primary">Withdraw Rebate</Button>
                </Link>
                <Link href="/ib/funds">
                  <Button variant="ghost" className="border border-slate-200">
                    Transfer Rebate
                  </Button>
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Link</CardTitle>
            <Link href="/ib/referrals" className="text-xs font-medium text-sky hover:underline">More →</Link>
          </CardHeader>
          <CardBody>
            <div className="text-xs text-steel">IB Plan</div>
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option>Swap Free STP (USC only)</option>
            </select>
            <div className="mt-5 text-xs text-steel">live account invitation link</div>
            <div className="mt-1 truncate rounded-lg border border-slate-200 px-3 py-2 text-xs text-navy">
              https://www.gio4x.com/live-account/?affid=MzQ0OTY...
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Performance</CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <select className="rounded-lg border border-slate-200 px-2 py-1">
              <option>Month To Date</option>
              <option>Last 30 Days</option>
              <option>Year To Date</option>
            </select>
            <input
              type="date"
              defaultValue="2026-05-01"
              className="rounded-lg border border-slate-200 px-2 py-1"
            />
            <span className="text-steel">—</span>
            <input
              type="date"
              defaultValue="2026-05-28"
              className="rounded-lg border border-slate-200 px-2 py-1"
            />
            <Link href="/ib/report">
              <Button variant="primary" className="px-3 py-1">
                Full report
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
            <div className="grid grid-cols-3 gap-3 lg:grid-cols-2">
              <StatTile icon={<Coins size={16} />} label="Rebate" value="9.80" unit="USD" active />
              <StatTile
                icon={<TrendingUp size={16} />}
                label="Notional Value"
                value="1,485,088.63"
                unit="USD"
              />
              <StatTile
                icon={<Briefcase size={16} />}
                label="Net Funding"
                value="365.00"
                unit="USD"
              />
              <StatTile
                icon={<ArrowDownToLine size={16} />}
                label="Deposits"
                value="770.00"
                unit="USD"
              />
              <StatTile
                icon={<ArrowUpFromLine size={16} />}
                label="Withdraw"
                value="405.00"
                unit="USD"
              />
              <StatTile icon={<Briefcase size={16} />} label="Opened Account" value="0" />
              <StatTile icon={<UserPlus size={16} />} label="New Clients" value="0" />
              <StatTile icon={<Users size={16} />} label="FTD Clients" value="0" />
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <div className="mb-1 px-2 text-xs font-medium text-steel">Rebate</div>
                <PerformanceChart />
              </div>
              <IbGrowthPanel />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Most Traded Instruments</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-xs text-steel">Micro Lots</div>
              <InstrumentDonut />
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  XAUUSD.c
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-300" />
                  NZDUSD.c
                </span>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-5">
              <div className="text-sm font-semibold text-navy">XAUUSD.c</div>
              <div className="mt-1 text-xs text-steel">Notional Value</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Accounts for this month</CardTitle>
          </CardHeader>
          <CardBody>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-steel">
                <tr>
                  <th className="pb-2 font-medium">Account No</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Volume</th>
                  <th className="pb-2 font-medium">Rebate</th>
                </tr>
              </thead>
              <tbody>
                {topAccounts.map((row) => (
                  <tr key={row.account} className="border-t border-slate-100">
                    <td className="py-2 text-navy">{row.account}</td>
                    <td className="py-2 text-steel">{row.name}</td>
                    <td className="py-2 text-steel">{row.volume}</td>
                    <td className="py-2 font-medium text-navy">{row.rebate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently Opened Accounts</CardTitle>
          </CardHeader>
          <CardBody>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-steel">
                <tr>
                  <th className="pb-2 font-medium">Account No</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Balance</th>
                  <th className="pb-2 font-medium">Contact</th>
                </tr>
              </thead>
              <tbody>
                {recentAccounts.map((row) => (
                  <tr key={row.account} className="border-t border-slate-100">
                    <td className="py-2 text-navy">{row.account}</td>
                    <td className="py-2 text-steel">{row.name}</td>
                    <td className="py-2 font-medium text-navy">{row.balance}</td>
                    <td className="py-2 text-sky">☎</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-900">
        <strong>Risk warning:</strong> Trading Forex and CFDs involves significant risk and can
        result in the loss of your invested capital. Trading leveraged products may not be suitable
        for all investors. Before trading, please take into consideration your level of experience,
        investment objectives and seek independent financial advice if necessary.
      </div>
    </Shell>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { PageHeader } from "@/components/PageHeader";
import { loadFeatureFlags } from "@/lib/config-actions";
import { loadAccountTypes } from "@/lib/account-type-actions";
import { loadLegalDocs } from "@/lib/legal-actions";
import { FlagsClient } from "./flags-client";
import { AccountTypesClient } from "./account-types-client";
import { LegalClient } from "./legal-client";
import {
  Landmark, Receipt, Network, ShieldCheck, Gauge, ScanSearch, FileBarChart, Server, ArrowRight,
} from "lucide-react";

// §24 Broker Configuration Centre — one map of what's configurable, plus the
// feature flags the broker console owns directly. Deeper platform settings live
// in the super-admin Tech Hub and are linked, not duplicated.
export const dynamic = "force-dynamic";

type Entry = { label: string; desc: string; href: string; icon: ReactNode };

const CONFIG_MAP: Entry[] = [
  { label: "Symbols, groups & routing", desc: "Trading on/off, commission, swaps, min/max lot, spread markup, sessions, A/B/Hybrid routing — per group, override per symbol.", href: "/staff/broker", icon: <Landmark size={16} /> },
  { label: "Fee Engine", desc: "Deposit/withdrawal and account fees, schedules and rules, with the ledger they post to.", href: "/staff/fees", icon: <Receipt size={16} /> },
  { label: "IB commission plans", desc: "Tiered rebate plans — $/lot and the share each sub-IB level keeps; set the default.", href: "/staff/ib", icon: <Network size={16} /> },
  { label: "KYC", desc: "Review documents and approve or reject verification for each client.", href: "/staff/kyc", icon: <ShieldCheck size={16} /> },
  { label: "Compliance & Surveillance", desc: "Risk scoring, linked-account detection and the surveillance watchlist.", href: "/staff/compliance", icon: <ScanSearch size={16} /> },
  { label: "Reporting Centre", desc: "Filterable, exportable reports over trades, revenue, IB, cashier and clients.", href: "/staff/reports", icon: <FileBarChart size={16} /> },
  { label: "Command Centre", desc: "The live brokerage control room — every key metric at a glance.", href: "/staff/command", icon: <Gauge size={16} /> },
  { label: "Tech Hub (super-admin)", desc: "Pricing markup, kill switches, maintenance mode, bridge secrets and environment — super-admin only.", href: "/staff/tech-hub", icon: <Server size={16} /> },
];

export default async function ConfigPage() {
  const [flags, accountTypes, legalDocs] = await Promise.all([loadFeatureFlags(), loadAccountTypes(), loadLegalDocs()]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configuration Centre"
        subtitle="Configure the platform without code. Toggle feature flags here; jump to each configuration surface below."
      />

      <Card>
        <CardHeader><CardTitle>Feature flags</CardTitle></CardHeader>
        <CardBody>
          <p className="mb-3 text-xs text-steel">
            Turn platform modules and features on or off for everyone. Admin-only.
          </p>
          <FlagsClient flags={flags} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Account types</CardTitle></CardHeader>
        <CardBody>
          <p className="mb-3 text-xs text-steel">
            The plans clients can open — leverage, minimum deposit, spread and commission. Editing here changes the
            live account-open form. Admin-only.
          </p>
          <AccountTypesClient rows={accountTypes} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Legal documents</CardTitle></CardHeader>
        <CardBody>
          <p className="mb-3 text-xs text-steel">
            Terms, risk disclosure and privacy — write and publish them here. Published docs are public at
            /legal/&lt;key&gt; and linked from signup. Admin-only.
          </p>
          <LegalClient docs={legalDocs} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Configuration map</CardTitle></CardHeader>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            {CONFIG_MAP.map((e) => (
              <Link key={e.href} href={e.href}
                className="group flex items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-sky/40 hover:bg-sky/5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky/10 text-sky">{e.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-semibold text-navy">
                    {e.label} <ArrowRight size={13} className="opacity-0 transition group-hover:opacity-100" />
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-steel">{e.desc}</span>
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-steel">
            Brand kit, domains, email/notification templates, languages/countries, leverage &amp; margin defaults and legal
            text (terms, risk disclosure, consent) are the next configuration surfaces to bring under this hub.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

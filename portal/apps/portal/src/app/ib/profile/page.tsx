import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle, Button } from "@gio4x/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { Award, FileText, Trophy } from "lucide-react";
import { SampleDataBanner } from "@/components/SampleDataBanner";

export default function IbProfilePage() {
  return (
    <Shell title="IB Profile">
      <PageHeader title="IB Profile" subtitle="Your IB plan, tier, agreements, and payout settings." />

      <SampleDataBanner />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardBody className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-2xl text-white">
              <Trophy />
            </div>
            <div className="mt-2 text-sm font-bold text-navy">Gold Partner</div>
            <div className="text-[11px] text-steel">IB ID: 34496</div>
            <StatusBadge tone="success">Active</StatusBadge>
            <div className="mt-5 w-full text-left text-xs">
              <div className="mb-1 flex justify-between"><span className="text-steel">Next tier</span><span className="font-medium text-navy">Platinum</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-3/5 bg-gradient-to-r from-sky to-navy" />
              </div>
              <div className="mt-1 text-[10px] text-steel">$5.2M more volume / $4.8M done</div>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Plan & tier benefits</CardTitle></CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-[11px] uppercase tracking-wider text-steel-light">Plan</dt><dd className="mt-0.5 text-navy">Swap-Free STP (USC only)</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wider text-steel-light">Commission</dt><dd className="mt-0.5 text-navy">$1.00 / standard lot</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wider text-steel-light">Sub-IB share</dt><dd className="mt-0.5 text-navy">15% on L1 · 5% on L2</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wider text-steel-light">Payout cycle</dt><dd className="mt-0.5 text-navy">Monthly · 1st of month</dd></div>
              <div className="col-span-2"><dt className="text-[11px] uppercase tracking-wider text-steel-light">Marketing budget</dt><dd className="mt-0.5 text-navy">$500 / month — apply via Support</dd></div>
            </dl>
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Agreements</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {[
              { name: "IB Partnership Agreement v3.2", signed: "2024-03-14", status: "active" },
              { name: "Sub-IB Addendum", signed: "2025-01-08", status: "active" },
              { name: "Marketing Conduct Policy", signed: "2025-06-22", status: "active" },
              { name: "Updated Compliance Schedule (May 2026)", signed: "—", status: "needs signature" },
            ].map((a) => (
              <div key={a.name} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-sky" />
                  <div>
                    <div className="text-sm font-medium text-navy">{a.name}</div>
                    <div className="text-[11px] text-steel">{a.signed === "—" ? "Pending" : `Signed ${a.signed}`}</div>
                  </div>
                </div>
                {a.status === "needs signature" ? (
                  <Link href={`/support?topic=${encodeURIComponent(`Sign IB agreement: ${a.name}`)}`}>
                    <Button variant="primary" className="!text-xs"><Award size={12} className="mr-1" /> Sign now</Button>
                  </Link>
                ) : (
                  <StatusBadge tone="success">Active</StatusBadge>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </Shell>
  );
}

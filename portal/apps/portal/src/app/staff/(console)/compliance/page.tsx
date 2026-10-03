import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle, StatTile } from "@gio4x/ui";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { loadComplianceOverview, type ClientRisk } from "@/lib/compliance-actions";
import { ShieldCheck, AlertTriangle, Users, GitBranch, ScanSearch, FileWarning } from "lucide-react";

// §20 Compliance & Surveillance — a real, explainable risk view over the
// clients we hold. Read-only: it scores and surfaces; it never acts on accounts.
export const dynamic = "force-dynamic";

const bandTone = (b: ClientRisk["band"]) => (b === "high" ? "danger" : b === "medium" ? "warning" : "success");

export default async function CompliancePage() {
  const o = await loadComplianceOverview();

  const tiles = [
    { label: "Clients monitored", value: String(o.monitored), icon: <Users size={16} /> },
    { label: "High-risk clients", value: String(o.highRisk), icon: <AlertTriangle size={16} /> },
    { label: "KYC backlog", value: String(o.kycBacklog), icon: <ShieldCheck size={16} /> },
    { label: "Linked-account clusters", value: String(o.clusters.length), icon: <GitBranch size={16} /> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Compliance & Surveillance"
        subtitle="Explainable client-risk scoring from real signals — KYC status, country on file, account age and device/IP sharing. Read-only: it flags for review, it never acts."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => <StatTile key={t.label} icon={t.icon} label={t.label} value={t.value} />)}
      </div>

      <Card>
        <CardHeader><CardTitle>Risk watchlist</CardTitle></CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-steel/25 text-[10px] uppercase tracking-wide text-steel">
                <th className="px-2 py-1.5">Client</th>
                <th className="px-2 py-1.5">Country</th>
                <th className="px-2 py-1.5">KYC</th>
                <th className="px-2 py-1.5 text-right">Risk</th>
                <th className="px-2 py-1.5">Why flagged</th>
              </tr>
            </thead>
            <tbody>
              {o.watchlist.map((c) => (
                <tr key={c.id} className="border-b border-steel/10 align-top">
                  <td className="px-2 py-2">
                    <Link href={`/staff/customers?focus=${c.id}`} className="font-semibold text-navy hover:text-sky">{c.name}</Link>
                    {c.email && <div className="text-[10px] text-steel">{c.email}</div>}
                  </td>
                  <td className="px-2 py-2 text-steel">{c.country ?? "—"}</td>
                  <td className="px-2 py-2">
                    <StatusBadge tone={c.kycStatus === "approved" ? "success" : c.kycStatus === "in_review" ? "warning" : "neutral"}>
                      {c.kycStatus ?? "not started"}
                    </StatusBadge>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-mono font-bold text-navy">{c.score}</span>
                      <StatusBadge tone={bandTone(c.band)}>{c.band}</StatusBadge>
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    {c.reasons.length === 0 ? <span className="text-steel">no flags</span> : (
                      <div className="flex flex-wrap gap-1">
                        {c.reasons.map((r, i) => (
                          <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-steel">{r.label}</span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {o.watchlist.length === 0 && (
                <tr><td colSpan={5} className="px-2 py-6 text-center text-steel">No clients to monitor yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Linked accounts (shared device / IP)</CardTitle></CardHeader>
        <CardBody className="space-y-2">
          <p className="text-[11px] text-steel">
            Accounts that signed in from the same device or IP — a signal for multi-accounting, bonus abuse or coordinated
            trading. A shared IP is not proof (households, offices, VPNs); treat as a lead for review.
          </p>
          {o.clusters.length === 0 ? (
            <p className="py-6 text-center text-sm text-steel">No linked-account clusters detected.</p>
          ) : (
            o.clusters.map((cl, i) => (
              <div key={i} className="rounded-xl border border-slate-100 px-3 py-2.5">
                <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-navy">
                  <GitBranch size={13} className="text-sky" />
                  Shared {cl.kind === "device" ? "device" : "IP"} <span className="font-mono text-steel">{cl.key}</span>
                  <StatusBadge tone="warning">{cl.members.length} accounts</StatusBadge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cl.members.map((m) => (
                    <Link key={m.id} href={`/staff/customers?focus=${m.id}`}
                      className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-navy hover:bg-sky/10">
                      {m.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Screening &amp; case management</CardTitle></CardHeader>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2 rounded-xl border border-slate-100 p-3">
              <ScanSearch size={16} className="mt-0.5 shrink-0 text-steel" />
              <div className="text-[12px] text-steel">
                <div className="font-semibold text-navy">Sanctions / PEP / adverse-media</div>
                Not yet connected. These require a licensed screening provider (e.g. an AML vendor). The risk model above
                runs on internal signals only and is <b>not</b> a substitute for sanctions screening.
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-slate-100 p-3">
              <FileWarning size={16} className="mt-0.5 shrink-0 text-steel" />
              <div className="text-[12px] text-steel">
                <div className="font-semibold text-navy">Case management &amp; SARs</div>
                Formal case files, enhanced due diligence and suspicious-activity reports with an immutable audit trail are
                the next build on this console.
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { ArrowLeft, Mail, Phone, Globe, Gift, Wallet as WalletIcon, FileText } from "lucide-react";
import { loadCustomerDetail } from "@/lib/customer-actions";
import { CustomerActions } from "./customer-actions";
import { KycReviewButtons } from "../KycReviewButtons";

export const dynamic = "force-dynamic";

function kycTone(s: string): StatusTone {
  if (s === "approved" || s === "verified") return "success";
  if (s === "rejected") return "danger";
  if (s === "in_review" || s === "in_progress") return "warning";
  return "neutral";
}
function statusTone(s: string): StatusTone {
  if (s === "active") return "success";
  if (s === "suspended" || s === "closed") return "danger";
  return "warning";
}
function docTone(s: string): StatusTone {
  if (s === "approved") return "success";
  if (s === "rejected") return "danger";
  return "warning";
}
const fmt = (n: number, c = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c === "USC" ? "USD" : c }).format(n);

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const detail = await loadCustomerDetail(params.id);
  if (!detail) notFound();
  const { profile, wallets, accounts, kyc } = detail;
  const kycPending = kyc.some((d) => d.status === "pending" || d.status === "in_review");

  return (
    <>
      <Link href="/staff/customers" className="mb-3 inline-flex items-center gap-1 text-xs text-sky hover:underline">
        <ArrowLeft size={14} /> Back to customers
      </Link>
      <PageHeader title={profile.full_name?.trim() || profile.email || "Customer"} subtitle={profile.email ?? ""} />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="neutral">{profile.role}</StatusBadge>
                <StatusBadge tone={statusTone(profile.status)}>{profile.status.replace("_", " ")}</StatusBadge>
                <StatusBadge tone={kycTone(profile.kyc_status)}>KYC: {profile.kyc_status.replace("_", " ")}</StatusBadge>
              </div>
              <dl className="grid grid-cols-2 gap-4">
                <Field icon={<Mail size={12} />} label="Email" value={profile.email} />
                <Field icon={<Phone size={12} />} label="Phone" value={profile.phone} />
                <Field icon={<Globe size={12} />} label="Country" value={profile.country} />
                <Field icon={<Gift size={12} />} label="Referral code" value={profile.referral_code} />
                <Field label="Joined" value={new Date(profile.created_at).toLocaleDateString()} />
                <Field label="Timezone" value={profile.timezone} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trading accounts ({accounts.length})</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              {accounts.length === 0 ? (
                <p className="py-4 text-center text-sm text-steel">No trading accounts.</p>
              ) : (
                accounts.map((a) => (
                  <div key={a.account_number} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-mono font-medium text-navy">{a.account_number}</span>
                      <span className="ml-2 text-[11px] text-steel-light">
                        {a.account_kind} · 1:{a.leverage} · {a.base_currency} · {a.status}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold text-navy">{fmt(a.balance, a.base_currency)}</div>
                      <div className="text-[11px] text-steel-light">eq {fmt(a.equity, a.base_currency)}</div>
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>KYC documents</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              {kyc.length === 0 ? (
                <p className="py-4 text-center text-sm text-steel">No documents uploaded.</p>
              ) : (
                kyc.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <FileText size={14} className="shrink-0 text-sky" />
                      <span className="font-medium text-navy">{d.doc_type.replace("_", " ")}</span>
                      {d.file_name ? <span className="truncate text-[11px] text-steel-light">{d.file_name}</span> : null}
                    </span>
                    <StatusBadge tone={docTone(d.status)}>{d.status}</StatusBadge>
                  </div>
                ))
              )}
              {kycPending ? (
                <div className="pt-1">
                  <KycReviewButtons userId={profile.id} />
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Wallet</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              {wallets.length === 0 ? (
                <p className="py-4 text-center text-sm text-steel">No wallet.</p>
              ) : (
                wallets.map((w) => (
                  <div key={w.wallet_id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <span className="inline-flex items-center gap-2 text-steel">
                      <WalletIcon size={14} /> {w.currency} · {w.type}
                    </span>
                    <span className="font-semibold text-navy">{fmt(w.balance, w.currency)}</span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account actions</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <CustomerActions id={profile.id} status={profile.status} />
              <p className="text-[11px] text-steel-light">
                Suspending blocks the customer&apos;s access. Review KYC above. Promote to IB on the IB Network page.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ icon, label, value }: { icon?: ReactNode; label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-steel-light">
        {icon}
        {label}
      </dt>
      <dd className="truncate text-sm text-navy">{value || "—"}</dd>
    </div>
  );
}

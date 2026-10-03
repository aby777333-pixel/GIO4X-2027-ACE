import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { ProgressRing } from "@/components/ProgressRing";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { Camera, FileCheck, IdCard, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import { KycUploader, type KycDoc } from "./kyc-uploader";

type KycStatus = "not_started" | "in_progress" | "in_review" | "approved" | "rejected";

const STEPS = [
  {
    key: "identity",
    title: "Identity Document",
    detail: "Passport or government-issued ID — clear, all four corners visible.",
    icon: IdCard,
    accept: "image/*,application/pdf",
    docType: "passport" as const,
    docTypes: ["passport", "national_id", "drivers_license"] as const,
  },
  {
    key: "selfie",
    title: "Selfie Verification",
    detail: "Live photo holding your ID. Reviewed within 10 minutes.",
    icon: Camera,
    accept: "image/*",
    docType: "selfie" as const,
    docTypes: ["selfie"] as const,
  },
  {
    key: "address",
    title: "Proof of Address",
    detail: "Utility bill or bank statement under 3 months old.",
    icon: FileCheck,
    accept: "image/*,application/pdf",
    docType: "utility_bill" as const,
    docTypes: ["utility_bill", "bank_statement"] as const,
  },
];

function stepStatus(docs: KycDoc[]): "complete" | "in-review" | "pending" {
  if (docs.some((d) => d.status === "approved")) return "complete";
  if (docs.some((d) => d.status === "pending" || d.status === "in_review")) return "in-review";
  return "pending";
}

const toneFor = {
  complete: "success",
  "in-review": "info",
  pending: "neutral",
} as const;

const labelFor = {
  complete: "Verified",
  "in-review": "In review",
  pending: "Action needed",
} as const;

export default async function VerificationPage() {
  const user = await getCurrentUser();
  const signedIn = !!user;
  const kycStatus: KycStatus = (user?.profile?.kyc_status as KycStatus | undefined) ?? "not_started";

  let docs: KycDoc[] = [];
  if (user) {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("kyc_documents")
      .select("id, doc_type, status, file_name, storage_path, created_at, rejection_reason")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    docs = (data ?? []) as KycDoc[];
  }

  const stepCompleted = STEPS.filter((s) => {
    const stepDocs = docs.filter((d) => (s.docTypes as readonly string[]).includes(d.doc_type));
    return stepStatus(stepDocs) === "complete";
  }).length;
  const percent = (stepCompleted / STEPS.length) * 100;

  return (
    <Shell title="Verification">
      <PageHeader
        title="KYC Verification"
        subtitle="Complete verification to unlock withdrawals, higher limits, and all GIO4X products."
      />

      {!signedIn ? (
        <div className="mb-4 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-xs text-steel">
          <Link href="/auth/login?redirect=/verification" className="font-medium text-sky hover:underline">
            Sign in
          </Link>{" "}
          to start your verification.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardBody className="flex flex-col items-center">
            <ProgressRing value={percent} size={140} stroke={10} />
            <div className="mt-4 text-center">
              <div className="text-sm font-semibold text-navy">
                {stepCompleted} of {STEPS.length} complete
              </div>
              <div className="mt-1 text-xs text-steel">
                Verification typically finishes in under 10 minutes during business hours.
              </div>
            </div>
            <div className="mt-5 w-full space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-steel">Overall status</span>
                <StatusBadge
                  tone={
                    kycStatus === "approved"
                      ? "success"
                      : kycStatus === "rejected"
                      ? "warning"
                      : kycStatus === "in_review"
                      ? "info"
                      : "neutral"
                  }
                >
                  {kycStatus.replace("_", " ")}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-steel">Withdrawals</span>
                <StatusBadge tone={kycStatus === "approved" ? "success" : "warning"}>
                  {kycStatus === "approved" ? "Unlocked" : "Locked"}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-steel">Live trading</span>
                <StatusBadge tone="success">Active</StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-steel">Daily deposit limit</span>
                <span className="font-medium text-navy">
                  {kycStatus === "approved" ? "$50,000" : "$1,000"}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verification steps</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {STEPS.map((s) => {
              const stepDocs = docs.filter((d) =>
                (s.docTypes as readonly string[]).includes(d.doc_type),
              );
              const status = stepStatus(stepDocs);
              return (
                <div key={s.key} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <s.icon size={14} className="text-sky" />
                    <span className="text-xs font-semibold text-navy">{s.title}</span>
                    <StatusBadge tone={toneFor[status]}>{labelFor[status]}</StatusBadge>
                  </div>
                  <KycUploader
                    userId={user?.id ?? null}
                    docType={s.docType}
                    label={s.title}
                    hint={s.detail}
                    accept={s.accept}
                    existing={stepDocs}
                    signedIn={signedIn}
                  />
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6 border-sky/20 bg-sky/5">
        <CardBody className="flex flex-wrap items-center gap-4">
          <ShieldCheck className="text-sky" size={28} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-navy">
              Your documents are encrypted in transit and at rest.
            </div>
            <div className="mt-0.5 text-xs text-steel">
              GIO4X is a subsidiary of 777 Capital Markets Limited (United Kingdom), company number 17049134, with its
              registered office at 2nd Floor College House, 17 King Edwards Road, Ruislip, London, HA4 7AE, United Kingdom. We share
              documents only with regulators when legally required.
            </div>
          </div>
        </CardBody>
      </Card>
    </Shell>
  );
}

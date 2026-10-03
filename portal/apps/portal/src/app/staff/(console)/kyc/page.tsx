import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody } from "@gio4x/ui";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { FileText } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase-server";
import { KycReviewButtons } from "../customers/KycReviewButtons";

export const dynamic = "force-dynamic";

type Doc = { doc_type: string; status: string; file_name: string | null };
type Row = {
  id: string;
  full_name: string | null;
  email: string | null;
  kyc_status: string;
  kyc_documents: Doc[] | null;
};

function docTone(status: string): StatusTone {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

export default async function StaffKycPage() {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("profiles")
    // kyc_documents has two FKs to profiles (user_id + reviewed_by); hint user_id.
    .select("id, full_name, email, kyc_status, kyc_documents!user_id(doc_type, status, file_name)")
    .in("kyc_status", ["in_review", "in_progress"])
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        title="KYC Review"
        subtitle="Approve or reject identity verifications awaiting review."
      />

      <Card>
        <CardBody className="space-y-3">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-steel">No verifications awaiting review.</p>
          ) : (
            rows.map((u) => (
              <div key={u.id} className="rounded-lg border border-slate-100 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-navy">
                      {u.full_name?.trim() || u.email || "Unnamed"}
                    </div>
                    <div className="truncate text-[11px] text-steel-light">{u.email}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge tone="warning">{u.kyc_status.replace("_", " ")}</StatusBadge>
                    <KycReviewButtons userId={u.id} />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(u.kyc_documents ?? []).length === 0 ? (
                    <span className="text-[11px] text-steel-light">No documents uploaded.</span>
                  ) : (
                    (u.kyc_documents ?? []).map((d, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-steel"
                      >
                        <FileText size={12} className="text-sky" />
                        <span className="font-medium text-navy">{d.doc_type.replace("_", " ")}</span>
                        {d.file_name ? <span className="text-steel-light">· {d.file_name}</span> : null}
                        <StatusBadge tone={docTone(d.status)}>{d.status}</StatusBadge>
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </>
  );
}

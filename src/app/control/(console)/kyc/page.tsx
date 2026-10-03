import { decideKycDocument } from "@/app/control/actions-portal";
import { ControlHead, Empty, NoAccess, Pager } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDateTime } from "@/components/control/format";
import { Decide, DecisionNotice } from "@/components/control/portal/Decide";
import { Figures, FilterTabs, Person, PortalReadFailed, PortalSource, PortalUnconfigured, Section, StateBadge, label } from "@/components/control/portal/kit";
import { oneOf, pageRange, portalPeople, requirePortal } from "@/lib/server/portal-db";
import { can } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("KYC", "/control/kyc");

const TITLE = "KYC";
const PER_PAGE = 50;
const DOC_STATUSES = ["pending", "in_review", "approved", "rejected"] as const;
const CLIENT_STATUSES = ["not_started", "in_progress", "in_review", "approved", "rejected"] as const;

type DocRow = {
  id: string;
  user_id: string;
  doc_type: string;
  file_name: string | null;
  file_size_bytes: number | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

function fileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "–";
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Verification, as the client portal holds it: each client's status and the
 * document records behind it (kyc.read). A person who holds kyc.decide can
 * accept or reject a document that is awaiting review: one document at a
 * time, through src/app/control/actions-portal.ts, which records the decision
 * in the audit log before it is made. The client's overall status is then
 * worked out by the portal from their documents; it is never set by hand.
 * The files themselves are not opened here. Every figure is a count of the
 * portal's rows.
 */
export default async function KycPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("kyc.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} />;
  const { db, ctx } = access;
  const decides = can(ctx, "kyc.decide");

  const params = await searchParams;
  const status = oneOf(firstParam(params.status), DOC_STATUSES, "");
  const { page, from, to } = pageRange(firstParam(params.page), PER_PAGE);

  let docsQuery = db
    .from("kyc_documents")
    .select("id, user_id, doc_type, file_name, file_size_bytes, status, reviewed_by, reviewed_at, rejection_reason, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status) docsQuery = docsQuery.eq("status", status);

  const count = (column: "kyc_status", value: string) => db.from("profiles").select("id", { count: "exact", head: true }).eq(column, value).in("role", ["trader", "ib", "affiliate"]);
  const [docs, awaiting, ...byStatus] = await Promise.all([
    docsQuery,
    db.from("kyc_documents").select("id", { count: "exact", head: true }).in("status", ["pending", "in_review"]),
    ...CLIENT_STATUSES.map((s) => count("kyc_status", s)),
  ]);

  const failed = !!docs.error || !!awaiting.error || byStatus.some((r) => r.error);
  const rows = (docs.data ?? []) as DocRow[];
  const total = docs.count ?? 0;
  const people = await portalPeople(db, rows.flatMap((r) => [r.user_id, r.reviewed_by]));
  const n = (i: number) => (byStatus[i]?.error ? "–" : String(byStatus[i]?.count ?? 0));

  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/control/kyc?${s}` : "/control/kyc";
  };

  return (
    <>
      <ControlHead title={TITLE} lead="Each client’s verification status in the portal, and the document records behind it. Newest document first." />
      <PortalSource decides={decides}>Documents are listed, not opened: the files stay in the portal’s storage.</PortalSource>
      <DecisionNotice notice={firstParam(params.notice)} error={firstParam(params.error)} />
      {failed && <PortalReadFailed />}

      <Figures
        items={[
          { label: "Documents awaiting review", value: awaiting.error ? "–" : String(awaiting.count ?? 0), note: "Pending or in review" },
          { label: "Clients in review", value: n(2) },
          { label: "Clients approved", value: n(3) },
          { label: "Clients not started or in progress", value: byStatus[0]?.error || byStatus[1]?.error ? "–" : String((byStatus[0]?.count ?? 0) + (byStatus[1]?.count ?? 0)), note: `Rejected: ${n(4)}` },
        ]}
      />

      <FilterTabs base="/control/kyc" param="status" current={status} options={DOC_STATUSES} allLabel="All documents" />

      <Section title="Documents" aside={status ? label(status) : "All statuses"}>
        {rows.length === 0 ? (
          <Empty title={failed ? "Nothing could be read" : status ? "No documents with this status" : "No documents have been uploaded"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[64rem] text-sm">
              <caption className="sr-only">KYC document records, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Document</th>
                  <th scope="col">File</th>
                  <th scope="col">Uploaded</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reviewed</th>
                  {decides && <th scope="col">Decision</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.user_id)} id={row.user_id} />
                    </td>
                    <td className="whitespace-nowrap text-ink">{label(row.doc_type)}</td>
                    <td className="max-w-[14rem] text-ink-2">
                      <span className="block truncate">{row.file_name ?? "–"}</span>
                      <span className="num block text-xs text-ink-3">{fileSize(row.file_size_bytes)}</span>
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.created_at)}</td>
                    <td>
                      <StateBadge value={row.status} />
                      {row.status === "rejected" && row.rejection_reason && <span className="mt-3 block max-w-[14rem] text-xs text-ink-3">{row.rejection_reason}</span>}
                    </td>
                    <td className="text-ink-2">
                      {row.reviewed_at ? (
                        <>
                          <span className="num block whitespace-nowrap">{fmtDateTime(row.reviewed_at)}</span>
                          <span className="block text-xs text-ink-3">{row.reviewed_by ? people.get(row.reviewed_by)?.name || "Portal staff" : "GIO4X Control"}</span>
                        </>
                      ) : (
                        "–"
                      )}
                    </td>
                    {decides && (
                      <td>
                        {row.status === "pending" || row.status === "in_review" ? (
                          <Decide action={decideKycDocument} id={row.id} what={`${label(row.doc_type)} of ${people.get(row.user_id)?.name || "this client"}`} reason approveLabel="Accept" />
                        ) : (
                          <span className="text-ink-3">–</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageCount={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} noun={total === 1 ? "document" : "documents"} href={href} />
      </Section>
    </>
  );
}

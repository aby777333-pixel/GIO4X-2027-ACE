import { ControlHead, Empty, NoAccess, Pager } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDateTime } from "@/components/control/format";
import { Figures, FilterTabs, Person, PortalReadFailed, PortalSource, PortalUnconfigured, Section, StateBadge, fmtNum, label } from "@/components/control/portal/kit";
import { oneOf, pageRange, portalPeople, requirePortal } from "@/lib/server/portal-db";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Bulk Emailer", "/control/emailer");

const TITLE = "Bulk Emailer";
const BASE = "/control/emailer";
const PER_PAGE = 50;
// the values the portal writes to email_logs.status
const STATUSES = ["sent", "partial", "failed", "scheduled"] as const;

type EmailRow = {
  id: string;
  sent_by: string | null;
  recipients: string[] | null;
  subject: string | null;
  template_id: string | null;
  status: string;
  scheduled_for: string | null;
  sent_count: number | null;
  failed_count: number | null;
  error_message: string | null;
  created_at: string;
};

/**
 * The record of what the client portal's bulk emailer sent: one row per
 * send, with how many addresses it went to and how many succeeded. Reads
 * only (emailer.read): nothing is sent, re-sent or scheduled from this
 * screen, and the addresses themselves are not listed. Every figure is a
 * count of the portal's rows.
 */
export default async function EmailerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("emailer.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} missing={access.missing} />;
  const { db } = access;

  const params = await searchParams;
  const status = oneOf(firstParam(params.status), STATUSES, "");
  const { page, from, to } = pageRange(firstParam(params.page), PER_PAGE);

  let logsQuery = db
    .from("email_logs")
    .select("id, sent_by, recipients, subject, template_id, status, scheduled_for, sent_count, failed_count, error_message, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status) logsQuery = logsQuery.eq("status", status);

  const count = () => db.from("email_logs").select("id", { count: "exact", head: true });
  const [logs, all, ...byStatus] = await Promise.all([logsQuery, count(), ...STATUSES.map((s) => count().eq("status", s))]);

  const failed = !!logs.error || !!all.error || byStatus.some((r) => r.error);
  const rows = (logs.data ?? []) as EmailRow[];
  const total = logs.count ?? 0;
  const people = await portalPeople(
    db,
    rows.map((r) => r.sent_by),
  );
  const n = (i: number) => (byStatus[i]?.error ? "–" : String(byStatus[i]?.count ?? 0));

  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${BASE}?${s}` : BASE;
  };

  return (
    <>
      <ControlHead title={TITLE} lead="The record of what the portal’s bulk emailer sent. Sending is not done from this screen. Newest first." />
      <PortalSource>Each row gives the number of recipients; the addresses are not listed.</PortalSource>
      {failed && <PortalReadFailed />}

      <Figures
        items={[
          { label: "Total sends", value: all.error ? "–" : String(all.count ?? 0), note: `Scheduled: ${n(3)}` },
          { label: "Sent", value: n(0), note: "Every recipient accepted" },
          { label: "Partial", value: n(1), note: "Some recipients failed" },
          { label: "Failed", value: n(2), note: "No recipient accepted" },
        ]}
      />

      <FilterTabs base={BASE} param="status" current={status} options={STATUSES} allLabel="All sends" />

      <Section title="Sends" aside={status ? label(status) : "All statuses"}>
        {rows.length === 0 ? (
          <Empty title={failed ? "Nothing could be read" : status ? "No sends with this status" : "The portal has recorded no sends"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[80rem] text-sm">
              <caption className="sr-only">Bulk e-mail sends, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Subject</th>
                  <th scope="col">Sent by</th>
                  <th scope="col">Recipients</th>
                  <th scope="col">Template</th>
                  <th scope="col">Status</th>
                  <th scope="col">Sent / failed</th>
                  <th scope="col">Scheduled for</th>
                  <th scope="col">Created</th>
                  <th scope="col">Error</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[20rem] text-ink">
                      <span className="block truncate">{row.subject || "–"}</span>
                    </td>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.sent_by ?? "")} id={row.sent_by} />
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{Array.isArray(row.recipients) ? fmtNum(row.recipients.length) : "–"}</td>
                    <td className="num whitespace-nowrap text-ink-2">{row.template_id || "–"}</td>
                    <td>
                      <StateBadge value={row.status} />
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">
                      {fmtNum(row.sent_count)} / {fmtNum(row.failed_count)}
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.scheduled_for)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.created_at)}</td>
                    <td className="max-w-[18rem] text-xs text-ink-3">{row.error_message || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageCount={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} noun={total === 1 ? "send" : "sends"} href={href} />
      </Section>
    </>
  );
}

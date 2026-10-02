import Link from "next/link";
import { ControlHead, Empty, Notice, Pager } from "@/components/control/bits";
import { fmtDateTime, jsonPairs } from "@/components/control/format";
import { isUuid } from "@/lib/server/validate";
import type { AuditRow } from "@/lib/supabase/types";

const ACTION_LABEL: Record<string, string> = {
  "lead.status": "Lead status changed",
  "lead.assign": "Lead assignment changed",
  "lead.note": "Note added to a lead",
  "lead.stage": "Lead stage changed",
  "lead.task": "Follow-up added to a lead",
  "lead.task_done": "Follow-up completed",
  "lead.task_reopened": "Follow-up reopened",
  "staff.request": "Staff change requested",
  "staff.apply": "Staff change applied",
  "staff.reject": "Staff change rejected",
  "staff.cancel": "Staff change withdrawn",
  "ticket.status": "Ticket status changed",
  "ticket.assign": "Ticket assignment changed",
  "ticket.priority": "Ticket priority changed",
  "ticket.category": "Ticket category changed",
  "ticket.reply": "Reply sent on a ticket",
  "ticket.note": "Internal note added to a ticket",
  "ticket.customer_reply": "Customer replied on a ticket",
  "chat.claim": "Live chat taken",
  "chat.close": "Live chat closed",
  "config.set": "Site setting changed",
  "incident.open": "Incident created",
  "incident.update": "Incident update posted",
  "incident.publish": "Incident published",
  "incident.unpublish": "Incident withdrawn from the Status page",
  "leads.export": "Enquiries exported",
  "subscribers.export": "Subscribers exported",
  "staff.grant": "Staff access granted",
  "staff.change": "Staff record changed",
  "staff.revoke": "Staff access removed",
};

export type AuditViewProps = {
  rows: AuditRow[];
  names: Map<string, string>;
  me: string;
  total: number;
  page: number;
  pageCount: number;
  failed: boolean;
  pastEnd: boolean;
};

/** Presentation only: the log exactly as the database recorded it. */
export function AuditView({ rows, names, me, total, page, pageCount, failed, pastEnd }: AuditViewProps) {
  const who = (userId: string | null) => (!userId ? "Database (SQL)" : userId === me ? "You" : (names.get(userId) ?? "Former member of staff"));
  // ids inside the detail are shown as names where they are known
  const readable = (value: string) => (isUuid(value) ? (names.get(value) ?? `${value.slice(0, 8)}…`) : value);

  return (
    <>
      <ControlHead
        eyebrow="Governance"
        title="Audit log"
        lead="Who changed what, and when. Entries are written by the database itself and cannot be edited or removed from this console."
      />

      <div className="mt-21">
        {failed ? (
          <Notice title="The audit log could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        ) : rows.length ? (
          <div className="scroll-x">
            <table className="table-gx min-w-[50rem] text-sm">
              <caption className="sr-only">Audit log, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">What</th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const pairs = jsonPairs(row.detail);
                  return (
                    <tr key={row.id}>
                      <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.at)}</td>
                      <td className="whitespace-nowrap text-ink">{who(row.actor)}</td>
                      <td className="whitespace-nowrap text-ink">
                        {(row.entity === "lead" || row.entity === "ticket") && row.entity_id && isUuid(row.entity_id) ? (
                          <Link href={`/control/${row.entity === "lead" ? "leads" : "tickets"}/${row.entity_id}`} className="link">
                            {ACTION_LABEL[row.action] ?? row.action}
                          </Link>
                        ) : (
                          (ACTION_LABEL[row.action] ?? row.action)
                        )}
                      </td>
                      <td className="py-5 text-xs text-ink-3">
                        {pairs.length ? (
                          pairs.map((p, i) => (
                            <span key={p.key}>
                              {i > 0 && " · "}
                              {p.key.replace(/_/g, " ")}: <span className="num text-ink-2">{readable(p.value)}</span>
                            </span>
                          ))
                        ) : (
                          <span aria-hidden>–</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : pastEnd ? (
          <Empty title="There is no such page" />
        ) : (
          <Empty title="Nothing recorded yet">
            <p>Status and stage changes, assignments, notes, follow-ups, subscriber exports and changes to staff access are recorded here as they happen.</p>
          </Empty>
        )}
      </div>

      {!failed && !pastEnd && total > 0 && (
        <Pager page={page} pageCount={pageCount} total={total} noun={total === 1 ? "entry" : "entries"} href={(p) => (p > 1 ? `/control/audit?page=${p}` : "/control/audit")} />
      )}
    </>
  );
}

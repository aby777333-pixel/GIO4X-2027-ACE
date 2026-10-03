import Link from "next/link";
import { ControlHead, Empty, Notice, Pager } from "@/components/control/bits";
import { fmtDateTime, jsonPairs } from "@/components/control/format";
import { isUuid } from "@/lib/server/validate";
import type { AuditRow } from "@/lib/supabase/types";

const ACTION_LABEL: Record<string, string> = {
  "lead.add_manual": "Enquiry entered by staff",
  "lead.import": "Enquiries imported from a file",
  "lead.status": "Lead status changed",
  "lead.assign": "Lead assignment changed",
  "lead.note": "Note added to a lead",
  "lead.stage": "Lead stage changed",
  "lead.task": "Follow-up added to a lead",
  "lead.task_done": "Follow-up completed",
  "lead.task_reopened": "Follow-up reopened",
  "person.note": "Internal note added to a customer record",
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
  "ticket.escalate": "Late ticket escalated",
  "ticket.rule": "Assignment rule applied to a new ticket",
  "ticket.rule_failed": "Assignment rule failed and was skipped",
  "ticket_macro.create": "Canned reply created",
  "ticket_macro.update": "Canned reply edited",
  "ticket_macro.retire": "Canned reply retired",
  "ticket_macro.restore": "Canned reply restored",
  "ticket_rule.create": "Assignment rule created",
  "ticket_rule.update": "Assignment rule edited",
  "ticket_rule.on": "Assignment rule switched on",
  "ticket_rule.off": "Assignment rule switched off",
  "ticket_rule.move": "Assignment rule moved in the order",
  "chat.claim": "Live chat taken",
  "chat.close": "Live chat closed",
  "config.set": "Site setting changed",
  "blog.create": "Blog draft created",
  "blog.publish": "Blog post published",
  "blog.unpublish": "Blog post withdrawn",
  "blog.archive": "Blog post archived",
  "blog.status": "Blog post status changed",
  "blog.edit_published": "Published blog post edited",
  "faq.create": "FAQ draft created",
  "faq.publish": "FAQ entry published",
  "faq.hide": "FAQ question hidden on the website",
  "faq.unpublish": "FAQ entry taken off the website",
  "faq.edit_published": "Published FAQ entry edited",
  "incident.open": "Incident created",
  "incident.update": "Incident update posted",
  "incident.publish": "Incident published",
  "incident.unpublish": "Incident withdrawn from the Status page",
  "leads.export": "Enquiries exported",
  "report.download": "Monthly summary downloaded",
  "subscribers.export": "Subscribers exported",
  "kyc.approve": "KYC document accepted (portal)",
  "kyc.reject": "KYC document rejected (portal)",
  "kyc.failed": "KYC decision did not go through (portal)",
  "funds.request": "Approval of a deposit or withdrawal requested (portal)",
  "funds.cancel": "Approval request withdrawn (portal)",
  "kyc.view": "KYC document opened (portal)",
  "ib.role": "IB: role changed (portal)",
  "ib.link": "IB: person placed under an IB (portal)",
  "ib.unlink": "IB: person detached from their parent (portal)",
  "ib.plan": "IB: plan or share of a link changed (portal)",
  "ib.settle_request": "IB: commission payment requested (portal)",
  "ib.settle_cancel": "IB: commission payment request withdrawn (portal)",
  "ib.settle": "IB: commission paid (portal)",
  "ib.failed": "IB: change did not go through (portal)",
  "copy.status": "Copy trading: provider status changed (portal)",
  "pamm.status": "PAMM: fund status changed (portal)",
  "ledger.account": "Ledger: account added or switched (portal)",
  "ledger.journal": "Ledger: manual journal entry posted (portal)",
  "legal.save": "Legal document saved (portal)",
  "legal.publish": "Legal document published or taken down (portal)",
  "events.dispatch": "Event queue run (portal)",
  "marketing.material": "IB marketing: material added, changed or retired (portal)",
  "marketing.link": "IB marketing: campaign link created for an IB (portal)",
  "client.status": "Client: account status changed (portal)",
  "fee.waive": "Fee: pending charge waived (portal)",
  "fee.charge_request": "Fee: charge by hand requested (portal)",
  "fee.charge": "Fee: charged by hand (portal)",
  "fee.charge_cancel": "Fee: request to charge by hand withdrawn (portal)",
  "fee.reverse_request": "Fee: reversal requested (portal)",
  "fee.reverse": "Fee: charge reversed (portal)",
  "fee.reverse_cancel": "Fee: reversal request withdrawn (portal)",
  "ops.failed": "Portal change did not go through",
  "broker.symbol": "Trading terminal: symbol setting changed",
  "broker.block": "Trading terminal: trading block added or ended",
  "trade.record": "Trade entered by hand (portal)",
  "email.send": "Service e-mail sent to portal clients",
  "config.create": "Portal configuration: row added",
  "config.update": "Portal configuration: row changed",
  "config.retire": "Portal configuration: row retired",
  "config.failed": "Portal configuration: change did not go through",
  "funds.approve": "Deposit or withdrawal approved (portal)",
  "funds.reject": "Deposit or withdrawal rejected (portal)",
  "funds.failed": "Funds decision did not go through (portal)",
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

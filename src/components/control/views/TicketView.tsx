import Link from "next/link";
import type { ReactNode } from "react";
import { escalateTicket } from "@/app/control/actions-ticket-tools";
import { addTicketNote, assignTicket, setTicketCategory, setTicketPriority, setTicketStatus } from "@/app/control/actions-tickets";
import { ControlHead, Facts, Notice } from "@/components/control/bits";
import { fmtDateTime, jsonPairs } from "@/components/control/format";
import { SubmitButton } from "@/components/control/SubmitButton";
import { replyDue, ReplyDue, ticketAssignee, TicketPriorityBadge, TicketStatusBadge } from "@/components/control/ticket-bits";
import { overdueText, type MacroOption } from "@/components/control/ticket-tools";
import { TicketReplyForm } from "@/components/control/views/TicketReplyForm";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABEL, TICKET_PRIORITIES, TICKET_PRIORITY_LABEL, TICKET_STATUSES, TICKET_STATUS_LABEL, TICKET_TARGET_HOURS } from "@/lib/server/constants";
import type { AuditRow, TicketCategory, TicketMessageRow, TicketPriority, TicketRow, TicketStatus } from "@/lib/supabase/types";

const AUDIT_LABEL: Record<string, string> = {
  "ticket.status": "Status changed",
  "ticket.assign": "Assignment changed",
  "ticket.priority": "Priority changed",
  "ticket.category": "Category changed",
  "ticket.reply": "Reply sent to the customer",
  "ticket.note": "Internal note added",
  "ticket.customer_reply": "The customer wrote",
  "ticket.escalate": "Escalated: late against the reply target",
  "ticket.rule": "An assignment rule was applied on arrival",
  "ticket.rule_failed": "An assignment rule failed and was skipped",
};

/** One step up, as ticket_escalate() raises it. Urgent has nowhere to go. */
const NEXT_PRIORITY: Record<TicketPriority, TicketPriority> = { low: "normal", normal: "high", high: "urgent", urgent: "urgent" };

/** What each status means for the person choosing it. */
const STATUS_NOTE: Record<TicketStatus, string> = {
  open: "Needs a reply from us",
  pending: "We replied; their turn",
  solved: "Answered; a reply from them reopens it",
  closed: "Finished; takes no more replies",
};

/** The solid edge that marks what the customer reads. Inline, so the card's own border cannot outrank it. */
const REPLY_EDGE = { borderLeftWidth: 3, borderLeftColor: "var(--accent)" } as const;

const isStatus = (v: string): v is TicketStatus => (TICKET_STATUSES as readonly string[]).includes(v);
const isPriority = (v: string): v is TicketPriority => (TICKET_PRIORITIES as readonly string[]).includes(v);
const isCategory = (v: string): v is TicketCategory => (TICKET_CATEGORIES as readonly string[]).includes(v);

export type TicketViewProps = {
  ticket: TicketRow;
  /** the thread, oldest first */
  messages: Pick<TicketMessageRow, "id" | "created_at" | "author_kind" | "author" | "internal" | "body">[];
  messagesFailed: boolean;
  audit: Pick<AuditRow, "id" | "at" | "actor" | "action" | "detail">[];
  auditFailed: boolean;
  names: Map<string, string>;
  me: string;
  /** rendered-at time, for "Reply due" and "Late" */
  now: number;
  /** may change status, priority and category, take or release, reply and add notes (tickets.write) */
  writable: boolean;
  /** may give the ticket to somebody else (leads.assign) */
  canAssign: boolean;
  /** active canned replies for the reply form (read only for people who can reply) */
  macros: MacroOption[];
  macrosFailed: boolean;
  /** may manage canned replies and rules (tickets.manage) */
  manage: boolean;
  notice?: string;
  error?: string;
};

function Card({ id, title, aside, children, className = "" }: { id: string; title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`gxc-card min-w-0 ${className}`}>
      <div className="gxc-card-head">
        <h2 id={id} className="gxc-card-title">
          {title}
        </h2>
        {aside}
      </div>
      <div className="gxc-card-body">{children}</div>
    </section>
  );
}

/**
 * Presentation only. The forms are shown according to the role as a courtesy;
 * the server actions check the role again and the database has the final say.
 *
 * Three kinds of writing appear on this page and must never be confused: what
 * the customer wrote, what staff replied (the customer reads it), and internal
 * notes (the customer never does). Each has its own words and its own shape:
 * a plain card, a card with a solid edge set in from the left, and a dashed
 * card on a tinted ground.
 */
export function TicketView({ ticket, messages, messagesFailed, audit, auditFailed, names, me, now, writable, canAssign, macros, macrosFailed, manage, notice, error }: TicketViewProps) {
  const staffName = (userId: string | null) => (!userId ? "Former member of staff" : userId === me ? "You" : (names.get(userId) ?? "Former member of staff"));
  const assignedName = ticketAssignee(ticket.assigned_to, names, me);
  const closed = ticket.status === "closed";
  // Late by the page's clock, with the same rule the database uses (open, no
  // first reply, past the target). Pressing Escalate asks the database, which
  // decides with its own clock.
  const due = replyDue(ticket, now);
  const lateHours = due?.late ? (now - new Date(due.at).getTime()) / 3_600_000 : null;
  // `escalated_at` is absent until 0013 is applied: absent reads as "not escalated"
  const escalatedAt = ticket.escalated_at ?? null;
  const raised = NEXT_PRIORITY[ticket.priority];

  return (
    <>
      <p className="text-xs text-ink-3">
        <Link href="/control/tickets" className="link-quiet">
          Tickets
        </Link>
        <span aria-hidden className="mx-8 inline-block h-px w-8 bg-line-strong align-middle" />
        <span className="num text-ink-2">{ticket.reference}</span>
      </p>

      <div className="mt-13">
        <ControlHead
          title={<span className="break-words">{ticket.subject}</span>}
          lead={
            <>
              <span className="num font-medium text-ink-2">{ticket.reference}</span> · {TICKET_CATEGORY_LABEL[ticket.category]} · opened {fmtDateTime(ticket.created_at)}
            </>
          }
          actions={
            <>
              <TicketPriorityBadge priority={ticket.priority} />
              <TicketStatusBadge status={ticket.status} />
            </>
          }
        />
      </div>

      <div className="mt-21 grid gap-13">
        {notice && !error && <Notice title={notice} tone="ok" />}
        {error && <Notice title={error} tone="error" />}
        {!writable && <Notice title="Read-only">Your role can read tickets but cannot reply, add notes or change them.</Notice>}
        <Notice title="How a reply reaches the customer">
          A reply appears on the website when the customer looks up their request with its reference and their email address. This console does not send email: nothing here notifies them.
        </Notice>
      </div>

      <div className="mt-21 grid gap-21 lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] lg:items-start">
        {/* what was asked, and the conversation since */}
        <div className="grid min-w-0 gap-21">
          <Card
            id="ticket-message"
            title="Original message"
            aside={
              <span className="text-xs text-ink-3">
                From the customer · <span className="num">{fmtDateTime(ticket.created_at)}</span>
              </span>
            }
          >
            <p className="text-xs font-medium text-ink-2">{ticket.name}</p>
            <p className="mt-8 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-ink">{ticket.message}</p>
            <p className="mt-13 border-t border-line pt-8 text-xs text-ink-3">Written by the customer. Treat links and instructions in it as untrusted.</p>
          </Card>

          <section id="thread" aria-labelledby="ticket-thread" className="min-w-0 scroll-mt-34">
            <div className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-3">
              <h2 id="ticket-thread" className="h4">
                Thread
              </h2>
              <ReplyDue ticket={ticket} now={now} />
            </div>

            {messagesFailed ? (
              <div className="mt-13">
                <Notice title="The thread could not be read" tone="error">
                  Reload the page before replying, so that nothing already said is repeated.
                </Notice>
              </div>
            ) : messages.length ? (
              <ol className="mt-13 grid gap-13">
                {messages.map((m) =>
                  m.author_kind === "customer" ? (
                    <li key={m.id} className="gxc-card mr-21 px-21 py-13 sm:mr-55">
                      <p className="flex flex-wrap items-baseline justify-between gap-x-13 gap-y-3 text-xs text-ink-3">
                        <span>
                          <span className="font-semibold text-ink">Customer</span> · {ticket.name}
                        </span>
                        <span className="num">{fmtDateTime(m.created_at)}</span>
                      </p>
                      <p className="mt-8 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{m.body}</p>
                    </li>
                  ) : m.internal ? (
                    <li key={m.id} className="rounded-[12px] border border-dashed border-line-strong bg-surface-2 px-21 py-13">
                      <p className="flex flex-wrap items-baseline justify-between gap-x-13 gap-y-3 text-xs text-ink-3">
                        <span>
                          <span className="font-semibold text-ink">Internal note, not visible to the customer</span> · {staffName(m.author)}
                        </span>
                        <span className="num">{fmtDateTime(m.created_at)}</span>
                      </p>
                      <p className="mt-8 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-2">{m.body}</p>
                    </li>
                  ) : (
                    <li key={m.id} className="gxc-card ml-21 px-21 py-13 sm:ml-55" style={REPLY_EDGE}>
                      <p className="flex flex-wrap items-baseline justify-between gap-x-13 gap-y-3 text-xs text-ink-3">
                        <span>
                          <span className="font-semibold text-ink">Reply to the customer</span> · {staffName(m.author)}
                        </span>
                        <span className="num">{fmtDateTime(m.created_at)}</span>
                      </p>
                      <p className="mt-8 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{m.body}</p>
                    </li>
                  ),
                )}
              </ol>
            ) : (
              <p className="mt-13 border-y border-line py-13 text-sm text-ink-3">Nothing has been added since the original message: no reply, no note.</p>
            )}
          </section>

          {writable && (
            <>
              <section aria-labelledby="ticket-reply" className="gxc-card min-w-0" style={REPLY_EDGE}>
                <div className="gxc-card-head">
                  <h2 id="ticket-reply" className="gxc-card-title">
                    Reply to the customer
                  </h2>
                  <span className="text-xs font-medium text-ink-2">The customer will read this</span>
                </div>
                {/* keyed by the thread's length: once a reply is stored the form starts again, with nothing selected or offered */}
                <TicketReplyForm
                  key={messages.length}
                  ticketId={ticket.id}
                  name={ticket.name}
                  reference={ticket.reference}
                  status={ticket.status}
                  priority={ticket.priority}
                  category={ticket.category}
                  assigned={!!ticket.assigned_to}
                  macros={macros}
                  macrosFailed={macrosFailed}
                  manage={manage}
                />
              </section>

              <section aria-labelledby="ticket-note" className="min-w-0 rounded-[16px] border border-dashed border-line-strong bg-surface-2">
                <div className="gxc-card-head">
                  <h2 id="ticket-note" className="gxc-card-title">
                    Internal note
                  </h2>
                  <span className="text-xs font-medium text-ink-2">Staff only. The customer never sees this</span>
                </div>
                <form action={addTicketNote} className="gxc-card-body grid gap-13">
                  <input type="hidden" name="id" value={ticket.id} />
                  <div className="field">
                    <label htmlFor="note-body">Note for colleagues</label>
                    <textarea id="note-body" name="body" className="textarea" rows={3} maxLength={5000} required aria-describedby="note-hint" />
                    <p id="note-hint" className="field-hint">
                      Kept on this ticket for staff. It does not change the status. Up to 5,000 characters. Do not record passwords, card numbers or one-time codes.
                    </p>
                  </div>
                  <div>
                    <SubmitButton pending="Saving…" className="btn btn-ghost">
                      Save internal note
                    </SubmitButton>
                  </div>
                </form>
              </section>
            </>
          )}

          <Card id="ticket-history" title="History">
            {auditFailed ? (
              <Notice title="The history could not be read" tone="error" />
            ) : audit.length ? (
              <ol className="border-t border-line">
                {audit.map((entry) => {
                  const pairs = jsonPairs(entry.detail);
                  const from = pairs.find((d) => d.key === "from")?.value;
                  const to = pairs.find((d) => d.key === "to")?.value;
                  const describe = (v: string) =>
                    entry.action === "ticket.assign"
                      ? v === "none"
                        ? "nobody"
                        : v === me
                          ? "you"
                          : (names.get(v) ?? "a member of staff")
                      : entry.action === "ticket.status" && isStatus(v)
                        ? TICKET_STATUS_LABEL[v]
                        : (entry.action === "ticket.priority" || entry.action === "ticket.escalate") && isPriority(v)
                          ? TICKET_PRIORITY_LABEL[v]
                          : entry.action === "ticket.category" && isCategory(v)
                            ? TICKET_CATEGORY_LABEL[v]
                            : v;
                  // a customer's message has no member of staff behind it, and neither has the reopening it causes
                  // a rule has no person behind it either: the entry carries the rule's name (0013)
                  const byRule = entry.action === "ticket.rule" || entry.action === "ticket.rule_failed";
                  const ruleName = byRule ? pairs.find((d) => d.key === "rule")?.value : undefined;
                  const actor = entry.actor ? staffName(entry.actor) : entry.action === "ticket.customer_reply" ? "The customer" : byRule ? "Assignment rules" : "Not a member of staff";
                  return (
                    <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-3 border-b border-line py-8 text-sm">
                      <span className="text-ink">
                        {AUDIT_LABEL[entry.action] ?? entry.action}
                        {ruleName !== undefined && <span className="text-ink-3"> · {ruleName}</span>}
                        {from !== undefined && to !== undefined && (
                          <span className="text-ink-3">
                            {" "}
                            · {describe(from)} to {describe(to)}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-ink-3">
                        {actor} · <span className="num">{fmtDateTime(entry.at)}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-ink-3">No changes recorded yet.</p>
            )}
            <p className="mt-13 text-xs text-ink-3">
              Newest first. The database records each change of status, priority, category and assignment, and that a message was added, never its text. A change marked “Not a member of staff” followed a message from the customer, an
              assignment rule applied as the ticket arrived, or was made directly in the database.
            </p>
          </Card>
        </div>

        {/* where it stands, who has it, who asked */}
        <div className="grid min-w-0 gap-21">
          {(lateHours !== null || escalatedAt) && (
            <Card id="ticket-target" title="Reply target" aside={<span className="text-xs font-semibold text-ink-2">{escalatedAt ? "Escalated" : "Late"}</span>}>
              {lateHours !== null && due && (
                <p className="text-sm text-ink">
                  <span className="font-semibold text-neg">Late by {overdueText(lateHours)}.</span> A first reply was due <span className="num">{fmtDateTime(due.at)}</span>: {TICKET_TARGET_HOURS[ticket.priority]} hours after it was opened, the
                  internal target for {TICKET_PRIORITY_LABEL[ticket.priority]}.
                </p>
              )}
              {escalatedAt ? (
                <p className={`text-sm text-ink-2 ${lateHours !== null ? "mt-8" : ""}`}>
                  Escalated <span className="num">{fmtDateTime(escalatedAt)}</span>. A ticket can be escalated once; to raise it further, change the priority under Triage.
                </p>
              ) : writable ? (
                <form action={escalateTicket} className="mt-13 grid gap-8">
                  <input type="hidden" name="id" value={ticket.id} />
                  <p id="escalate-what" className="text-sm text-ink-2">
                    {ticket.priority === "urgent" ? (
                      <>Escalating marks this ticket as escalated and records that with your name and the time. It is already {TICKET_PRIORITY_LABEL.urgent}, so the priority cannot go higher.</>
                    ) : (
                      <>
                        Escalating raises the priority one step, from {TICKET_PRIORITY_LABEL[ticket.priority]} to {TICKET_PRIORITY_LABEL[raised]}, marks the ticket as escalated, and records both with your name and the time.
                      </>
                    )}{" "}
                    It can be done once per ticket. It does not assign the ticket or notify anyone.
                  </p>
                  <div>
                    <SubmitButton pending="Escalating…" className="btn btn-ghost">
                      Escalate<span className="sr-only"> this ticket</span>
                    </SubmitButton>
                  </div>
                </form>
              ) : (
                <p className="mt-8 text-sm text-ink-2">Someone who can work tickets can escalate it, which raises its priority one step.</p>
              )}
              <p className="mt-13 border-t border-line pt-8 text-xs text-ink-3">
                Nothing escalates by itself: there is no timed job. It happens when a person presses the button. The Command Centre shows how many tickets are late. The target is internal and is never shown to the customer.
              </p>
            </Card>
          )}

          <Card id="ticket-triage" title="Triage">
            {writable ? (
              <div className="grid gap-13">
                <form action={setTicketStatus} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-8">
                  <input type="hidden" name="id" value={ticket.id} />
                  <div className="field">
                    <label htmlFor="ticket-status">Status</label>
                    <select id="ticket-status" name="status" className="select" defaultValue={ticket.status}>
                      {TICKET_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {TICKET_STATUS_LABEL[s]} · {STATUS_NOTE[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <SubmitButton pending="Saving…" className="btn btn-ghost">
                    Save<span className="sr-only"> status</span>
                  </SubmitButton>
                </form>

                <form action={setTicketPriority} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-8">
                  <input type="hidden" name="id" value={ticket.id} />
                  <div className="field">
                    <label htmlFor="ticket-priority">Priority</label>
                    <select id="ticket-priority" name="priority" className="select" defaultValue={ticket.priority}>
                      {TICKET_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {TICKET_PRIORITY_LABEL[p]} · first reply within {TICKET_TARGET_HOURS[p]} hours
                        </option>
                      ))}
                    </select>
                  </div>
                  <SubmitButton pending="Saving…" className="btn btn-ghost">
                    Save<span className="sr-only"> priority</span>
                  </SubmitButton>
                </form>

                <form action={setTicketCategory} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-8">
                  <input type="hidden" name="id" value={ticket.id} />
                  <div className="field">
                    <label htmlFor="ticket-category">Category</label>
                    <select id="ticket-category" name="category" className="select" defaultValue={ticket.category}>
                      {TICKET_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {TICKET_CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <SubmitButton pending="Saving…" className="btn btn-ghost">
                    Save<span className="sr-only"> category</span>
                  </SubmitButton>
                </form>
                <p className="text-xs text-ink-3">Each change is recorded with your name and the time. The reply times are internal targets, not promises to the customer.</p>

                <div className="border-t border-line pt-13">
                  <p className="field-label">Assigned to</p>
                  <p className="mt-5 text-sm text-ink">{assignedName}</p>
                  {canAssign ? (
                    <form action={assignTicket} className="mt-13 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-8">
                      <input type="hidden" name="id" value={ticket.id} />
                      <div className="field">
                        <label htmlFor="ticket-assignee">Change assignment</label>
                        <select id="ticket-assignee" name="assignee" className="select" defaultValue={ticket.assigned_to ?? "none"}>
                          <option value="none">Unassigned</option>
                          {[...names.entries()].map(([userId, name]) => (
                            <option key={userId} value={userId}>
                              {name}
                              {userId === me ? " (you)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <SubmitButton pending="Saving…" className="btn btn-ghost">
                        Save<span className="sr-only"> assignment</span>
                      </SubmitButton>
                    </form>
                  ) : (
                    <form action={assignTicket} className="mt-13">
                      <input type="hidden" name="id" value={ticket.id} />
                      {ticket.assigned_to === me ? (
                        <>
                          <input type="hidden" name="assignee" value="none" />
                          <SubmitButton pending="Saving…" className="btn btn-ghost">
                            Release
                          </SubmitButton>
                        </>
                      ) : (
                        <>
                          <input type="hidden" name="assignee" value="me" />
                          <SubmitButton pending="Saving…" className="btn btn-ghost">
                            Assign to me
                          </SubmitButton>
                        </>
                      )}
                    </form>
                  )}
                </div>
              </div>
            ) : (
              <Facts
                rows={[
                  { label: "Status", value: <TicketStatusBadge status={ticket.status} /> },
                  { label: "Priority", value: <TicketPriorityBadge priority={ticket.priority} /> },
                  { label: "Category", value: TICKET_CATEGORY_LABEL[ticket.category] },
                  { label: "Assigned to", value: assignedName },
                ]}
              />
            )}
          </Card>

          <Card id="ticket-who" title="Requester">
            <Facts
              rows={[
                { label: "Name", value: ticket.name },
                {
                  label: "Email",
                  value: (
                    <a href={`mailto:${ticket.email}?subject=${encodeURIComponent(`Your request ${ticket.reference}`)}`} className="link">
                      {ticket.email}
                    </a>
                  ),
                },
                { label: "Sent from", value: <span className="num">{ticket.page}</span> },
                { label: "Last wrote", value: <span className="num">{fmtDateTime(ticket.last_customer_at)}</span> },
                { label: "First reply", value: ticket.first_response_at ? <span className="num">{fmtDateTime(ticket.first_response_at)}</span> : "Not yet" },
                ...(ticket.solved_at ? [{ label: closed ? "Closed" : "Solved", value: <span className="num">{fmtDateTime(ticket.solved_at)}</span> }] : []),
                { label: "Last updated", value: <span className="num">{fmtDateTime(ticket.updated_at)}</span> },
              ]}
            />
            <p className="mt-13 text-xs text-ink-3">The address opens your own mail program. Anything sent from there is outside this ticket: note it here if it matters.</p>
          </Card>

          <Card id="ticket-consent" title="Consent evidence">
            <Facts
              rows={[
                { label: "Privacy notice", value: "Accepted" },
                { label: "Accepted at", value: <span className="num">{fmtDateTime(ticket.privacy_accepted_at)}</span> },
                { label: "Policy version", value: <span className="num">{ticket.privacy_version}</span> },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}

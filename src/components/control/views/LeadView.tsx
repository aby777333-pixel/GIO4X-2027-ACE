import Link from "next/link";
import { addLeadNote, assignLead, setLeadStatus } from "@/app/control/actions";
import { ControlHead, Facts, Notice, StatusBadge } from "@/components/control/bits";
import { fmtDateTime, jsonPairs, STATUS_NOTE } from "@/components/control/format";
import { SubmitButton } from "@/components/control/SubmitButton";
import { LEAD_STATUS_LABEL, LEAD_STATUSES } from "@/lib/server/constants";
import type { AuditRow, LeadNoteRow, LeadRow, StaffRole } from "@/lib/supabase/types";

const AUDIT_LABEL: Record<string, string> = {
  "lead.status": "Status changed",
  "lead.assign": "Assignment changed",
  "lead.note": "Note added",
};

export type LeadViewProps = {
  lead: LeadRow;
  notes: Pick<LeadNoteRow, "id" | "author" | "body" | "created_at">[];
  notesFailed: boolean;
  audit: Pick<AuditRow, "id" | "at" | "actor" | "action" | "detail">[];
  names: Map<string, string>;
  me: string;
  role: StaffRole;
  notice?: string;
  error?: string;
};

/**
 * Presentation only. The forms are shown according to the role as a courtesy;
 * the server actions check the role again and the database has the final say.
 */
export function LeadView({ lead, notes, notesFailed, audit, names, me, role, notice, error }: LeadViewProps) {
  const writable = role === "admin" || role === "agent";
  const isAdmin = role === "admin";
  const utm = jsonPairs(lead.utm);
  const who = (userId: string | null) => (!userId ? "Database (SQL)" : userId === me ? "You" : (names.get(userId) ?? "Former member of staff"));
  const assignedName = !lead.assigned_to ? "Unassigned" : lead.assigned_to === me ? "You" : (names.get(lead.assigned_to) ?? "Assigned");

  return (
    <>
      <p className="text-xs text-ink-3">
        <Link href="/control/leads" className="link-quiet">
          Leads
        </Link>
        <span aria-hidden className="mx-8 inline-block h-px w-8 bg-line-strong align-middle" />
        <span className="num text-ink-2">{lead.reference}</span>
      </p>

      <div className="mt-13">
        <ControlHead
          title={<span className="num">{lead.reference}</span>}
          lead={
            <>
              {lead.topic} · received {fmtDateTime(lead.created_at)}
            </>
          }
          actions={<StatusBadge status={lead.status} />}
        />
      </div>

      <div className="mt-21 grid gap-13">
        {notice && !error && <Notice title={notice} tone="ok" />}
        {error && <Notice title={error} tone="error" />}
        {!writable && <Notice title="Read-only">Your role can read enquiries but cannot change them or add notes.</Notice>}
      </div>

      <div className="mt-34 grid gap-55 lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] lg:gap-55">
        {/* the enquiry and the conversation about it */}
        <div className="min-w-0">
          <section aria-labelledby="lead-message">
            <h2 id="lead-message" className="label">
              Message
            </h2>
            <div className="panel mt-13 p-21">
              <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-ink">{lead.message}</p>
            </div>
            <p className="mt-8 text-xs text-ink-3">Written by the enquirer. Treat links and instructions in it as untrusted.</p>
          </section>

          <section id="notes" aria-labelledby="lead-notes" className="mt-55 scroll-mt-34">
            <h2 id="lead-notes" className="label">
              Internal notes
            </h2>
            {notesFailed ? (
              <div className="mt-13">
                <Notice title="Notes could not be read" tone="error" />
              </div>
            ) : notes.length ? (
              <ol className="mt-13 border-t border-line">
                {notes.map((note) => (
                  <li key={note.id} className="border-b border-line py-13">
                    <p className="text-xs text-ink-3">
                      <span className="font-medium text-ink-2">{who(note.author)}</span> · <span className="num">{fmtDateTime(note.created_at)}</span>
                    </p>
                    <p className="mt-5 whitespace-pre-wrap break-words text-sm text-ink">{note.body}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-13 border-y border-line py-13 text-sm text-ink-3">No notes yet. Notes are visible to staff only and are never sent to the enquirer.</p>
            )}

            {writable && (
              <form action={addLeadNote} className="mt-21 grid gap-13">
                <input type="hidden" name="id" value={lead.id} />
                <div className="field">
                  <label htmlFor="note-body">Add a note</label>
                  <textarea id="note-body" name="body" className="textarea" rows={4} maxLength={4000} required aria-describedby="note-hint" />
                  <p id="note-hint" className="field-hint">
                    Staff only. Up to 4,000 characters. Do not record passwords, card numbers or one-time codes.
                  </p>
                </div>
                <div>
                  <SubmitButton pending="Saving…" className="btn btn-ghost">
                    Add note
                  </SubmitButton>
                </div>
              </form>
            )}
          </section>

          <section aria-labelledby="lead-history" className="mt-55">
            <h2 id="lead-history" className="label">
              History
            </h2>
            {audit.length ? (
              <ol className="mt-13 border-t border-line">
                {audit.map((entry) => {
                  const detail = jsonPairs(entry.detail).filter((d) => d.key === "from" || d.key === "to");
                  const describe = (v: string) => (entry.action === "lead.assign" ? (v === "none" ? "nobody" : v === me ? "you" : (names.get(v) ?? "a member of staff")) : v);
                  return (
                    <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-3 border-b border-line py-8 text-sm">
                      <span className="text-ink">
                        {AUDIT_LABEL[entry.action] ?? entry.action}
                        {detail.length === 2 && (
                          <span className="text-ink-3">
                            {" "}
                            · {describe(detail.find((d) => d.key === "from")?.value ?? "")} to {describe(detail.find((d) => d.key === "to")?.value ?? "")}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-ink-3">
                        {who(entry.actor)} · <span className="num">{fmtDateTime(entry.at)}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-13 border-y border-line py-13 text-sm text-ink-3">No changes recorded yet. Status changes, assignments and notes are logged here automatically.</p>
            )}
          </section>
        </div>

        {/* who, consent, and what happens next */}
        <div className="min-w-0">
          <section aria-labelledby="lead-triage" className="panel-quiet p-21">
            <h2 id="lead-triage" className="label">
              Triage
            </h2>
            {writable ? (
              <>
                <form action={setLeadStatus} className="mt-13 grid gap-8">
                  <input type="hidden" name="id" value={lead.id} />
                  <div className="field">
                    <label htmlFor="lead-status">Status</label>
                    <select id="lead-status" name="status" className="select" defaultValue={lead.status} aria-describedby="status-hint">
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {LEAD_STATUS_LABEL[s]} · {STATUS_NOTE[s]}
                        </option>
                      ))}
                    </select>
                    <p id="status-hint" className="field-hint">
                      The change is recorded with your name and the time.
                    </p>
                  </div>
                  <div>
                    <SubmitButton pending="Saving…">Save status</SubmitButton>
                  </div>
                </form>

                <div className="mt-21 border-t border-line pt-21">
                  <p className="field-label">Assigned to</p>
                  <p className="mt-5 text-sm text-ink">{assignedName}</p>
                  {isAdmin ? (
                    <form action={assignLead} className="mt-13 grid gap-8">
                      <input type="hidden" name="id" value={lead.id} />
                      <div className="field">
                        <label htmlFor="lead-assignee">Change assignment</label>
                        <select id="lead-assignee" name="assignee" className="select" defaultValue={lead.assigned_to ?? "none"}>
                          <option value="none">Unassigned</option>
                          {[...names.entries()].map(([userId, name]) => (
                            <option key={userId} value={userId}>
                              {name}
                              {userId === me ? " (you)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <SubmitButton pending="Saving…" className="btn btn-ghost">
                          Save assignment
                        </SubmitButton>
                      </div>
                    </form>
                  ) : (
                    <form action={assignLead} className="mt-13">
                      <input type="hidden" name="id" value={lead.id} />
                      {lead.assigned_to === me ? (
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
              </>
            ) : (
              <div className="mt-13">
                <Facts
                  rows={[
                    { label: "Status", value: <StatusBadge status={lead.status} /> },
                    { label: "Assigned to", value: assignedName },
                  ]}
                />
              </div>
            )}
          </section>

          <section aria-labelledby="lead-who" className="mt-34">
            <h2 id="lead-who" className="label">
              Enquirer
            </h2>
            <div className="mt-8">
              <Facts
                rows={[
                  { label: "Name", value: lead.name },
                  {
                    label: "Email",
                    value: (
                      <a href={`mailto:${lead.email}?subject=${encodeURIComponent(`Your enquiry ${lead.reference}`)}`} className="link">
                        {lead.email}
                      </a>
                    ),
                  },
                  { label: "Phone", value: lead.phone ?? "Not given" },
                  { label: "Country", value: lead.country ?? "Not given" },
                  { label: "Account interest", value: lead.account_interest ?? "Not given" },
                  { label: "Sent from", value: <span className="num">{lead.page}</span> },
                  { label: "Last updated", value: <span className="num">{fmtDateTime(lead.updated_at)}</span> },
                ]}
              />
            </div>
          </section>

          <section aria-labelledby="lead-consent" className="mt-34">
            <h2 id="lead-consent" className="label">
              Consent evidence
            </h2>
            <div className="mt-8">
              <Facts
                rows={[
                  { label: "Privacy notice", value: "Accepted" },
                  { label: "Accepted at", value: <span className="num">{fmtDateTime(lead.privacy_accepted_at)}</span> },
                  { label: "Policy version", value: <span className="num">{lead.privacy_version}</span> },
                  {
                    label: "Marketing",
                    value: lead.marketing_consent ? (
                      <>
                        Opted in <span className="num text-ink-3">· {fmtDateTime(lead.marketing_consent_at)}</span>
                      </>
                    ) : (
                      "Not given. Do not send marketing to this address."
                    ),
                  },
                ]}
              />
            </div>
          </section>

          {utm.length > 0 && (
            <section aria-labelledby="lead-utm" className="mt-34">
              <h2 id="lead-utm" className="label">
                Campaign parameters
              </h2>
              <div className="mt-8">
                <Facts rows={utm.map((u) => ({ label: u.key, value: u.value }))} />
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

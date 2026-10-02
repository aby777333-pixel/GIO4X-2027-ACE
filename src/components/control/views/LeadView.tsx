import Link from "next/link";
import { addLeadNote, addLeadTask, assignLead, setLeadStage, setLeadStatus } from "@/app/control/actions";
import { ControlHead, Facts, Notice, Score, StageBadge, StatusBadge } from "@/components/control/bits";
import { fmtDateTime, jsonPairs, STAGE_NOTE, STATUS_NOTE } from "@/components/control/format";
import { LeadsTable, type LeadListItem } from "@/components/control/LeadsTable";
import { scoreParts } from "@/components/control/score";
import { SubmitButton } from "@/components/control/SubmitButton";
import { TaskList, type TaskItem } from "@/components/control/TaskList";
import { LEAD_STAGE_LABEL, LEAD_STAGES, LEAD_STATUS_LABEL, LEAD_STATUSES, LOST_REASON_LABEL, LOST_REASONS, MANUAL_LEAD_SOURCE_LABEL, MANUAL_LEAD_SOURCES } from "@/lib/server/constants";
import type { AuditRow, LeadNoteRow, LeadRow, LeadStage, LostReason } from "@/lib/supabase/types";

const AUDIT_LABEL: Record<string, string> = {
  "lead.add_manual": "Entered by staff",
  "lead.status": "Status changed",
  "lead.assign": "Assignment changed",
  "lead.note": "Note added",
  "lead.stage": "Stage changed",
  "lead.task": "Follow-up added",
  "lead.task_done": "Follow-up completed",
  "lead.task_reopened": "Follow-up reopened",
};

const isStage = (v: string): v is LeadStage => (LEAD_STAGES as readonly string[]).includes(v);
const isReason = (v: string): v is LostReason => (LOST_REASONS as readonly string[]).includes(v);
const isManualSource = (v: string): v is (typeof MANUAL_LEAD_SOURCES)[number] => (MANUAL_LEAD_SOURCES as readonly string[]).includes(v);

export type LeadViewProps = {
  lead: LeadRow;
  notes: Pick<LeadNoteRow, "id" | "author" | "body" | "created_at">[];
  notesFailed: boolean;
  audit: Pick<AuditRow, "id" | "at" | "actor" | "action" | "detail">[];
  tasks: TaskItem[];
  tasksFailed: boolean;
  /** other enquiries from the same address */
  related: LeadListItem[];
  names: Map<string, string>;
  me: string;
  /** rendered-at time, for "overdue" and for the default due date */
  now: number;
  /** may change status and stage, take or release, add notes (leads.write) */
  writable: boolean;
  /** may assign to somebody else (leads.assign) */
  canAssign: boolean;
  /** may add and complete follow-ups (tasks.write) */
  canTask: boolean;
  notice?: string;
  error?: string;
};

/**
 * Presentation only. The forms are shown according to the role as a courtesy;
 * the server actions check the role again and the database has the final say.
 */
export function LeadView({ lead, notes, notesFailed, audit, tasks, tasksFailed, related, names, me, now, writable, canAssign, canTask, notice, error }: LeadViewProps) {
  const isAdmin = canAssign;
  const utm = jsonPairs(lead.utm);
  // An enquiry a member of staff entered (0012): its source is how it came about, not a campaign.
  const byStaff = lead.origin === "staff";
  const howRaw = byStaff ? (utm.find((u) => u.key === "utm_source")?.value ?? "") : "";
  const how = isManualSource(howRaw) ? MANUAL_LEAD_SOURCE_LABEL[howRaw] : howRaw || "Not recorded";
  const score = scoreParts(lead);
  const openTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);
  // tomorrow, in UTC, as the suggested due date
  const tomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
              {lead.topic} · {byStaff ? "entered" : "received"} {fmtDateTime(lead.created_at)}
            </>
          }
          actions={
            <>
              {byStaff && <span className="state state-off">Entered by staff</span>}
              <StageBadge stage={lead.stage} />
              <StatusBadge status={lead.status} />
            </>
          }
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
            <p className="mt-8 text-xs text-ink-3">
              {byStaff ? `A note of what was said, written by ${lead.added_by === me ? "you" : who(lead.added_by)}. The enquirer did not write it.` : "Written by the enquirer. Treat links and instructions in it as untrusted."}
            </p>
          </section>

          <section id="tasks" aria-labelledby="lead-tasks" className="mt-55 scroll-mt-34">
            <h2 id="lead-tasks" className="label">
              Follow-ups
            </h2>
            {tasksFailed ? (
              <div className="mt-13">
                <Notice title="Follow-ups could not be read" tone="error" />
              </div>
            ) : openTasks.length ? (
              <div className="mt-13">
                <TaskList tasks={openTasks} names={names} me={me} now={now} from="lead" writable={canTask} label="Open follow-ups for this enquiry" />
              </div>
            ) : (
              <p className="mt-13 border-y border-line py-13 text-sm text-ink-3">Nothing is scheduled. A follow-up is one line and a time: who should do what next, and by when.</p>
            )}

            {canTask && (
              <form action={addLeadTask} className="mt-21 grid gap-13 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                <input type="hidden" name="id" value={lead.id} />
                <div className="field sm:col-span-3">
                  <label htmlFor="task-title">Add a follow-up</label>
                  <input id="task-title" name="title" type="text" className="input" maxLength={200} required placeholder="Call back about the ECN account" autoComplete="off" />
                </div>
                {isAdmin ? (
                  <div className="field">
                    <label htmlFor="task-assignee">For</label>
                    <select id="task-assignee" name="assignee" className="select" defaultValue={me}>
                      {[...names.entries()].map(([userId, name]) => (
                        <option key={userId} value={userId}>
                          {name}
                          {userId === me ? " (you)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="self-center text-xs text-ink-3">It will be yours.</p>
                )}
                <div className="field">
                  <label htmlFor="task-date">Due (UTC)</label>
                  <input id="task-date" name="due_date" type="date" className="input num" defaultValue={tomorrow} required />
                </div>
                <div className="field">
                  <label htmlFor="task-time">At</label>
                  <input id="task-time" name="due_time" type="time" className="input num" defaultValue="09:00" required />
                </div>
                <div className="sm:col-span-3">
                  <SubmitButton pending="Saving…" className="btn btn-ghost">
                    Add follow-up
                  </SubmitButton>
                </div>
              </form>
            )}

            {doneTasks.length > 0 && (
              <details className="mt-21">
                <summary className="cursor-pointer text-sm text-ink-2">
                  {doneTasks.length} completed {doneTasks.length === 1 ? "follow-up" : "follow-ups"}
                </summary>
                <div className="mt-13">
                  <TaskList tasks={doneTasks} names={names} me={me} now={now} from="lead" writable={canTask} label="Completed follow-ups for this enquiry" />
                </div>
              </details>
            )}
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
                  const pairs = jsonPairs(entry.detail);
                  const detail = pairs.filter((d) => d.key === "from" || d.key === "to");
                  const reason = pairs.find((d) => d.key === "reason")?.value ?? "";
                  const describe = (v: string) =>
                    entry.action === "lead.assign"
                      ? v === "none"
                        ? "nobody"
                        : v === me
                          ? "you"
                          : (names.get(v) ?? "a member of staff")
                      : entry.action === "lead.stage" && isStage(v)
                        ? LEAD_STAGE_LABEL[v]
                        : v;
                  return (
                    <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-3 border-b border-line py-8 text-sm">
                      <span className="text-ink">
                        {AUDIT_LABEL[entry.action] ?? entry.action}
                        {detail.length === 2 && (
                          <span className="text-ink-3">
                            {" "}
                            · {describe(detail.find((d) => d.key === "from")?.value ?? "")} to {describe(detail.find((d) => d.key === "to")?.value ?? "")}
                            {isReason(reason) && <> ({LOST_REASON_LABEL[reason].toLowerCase()})</>}
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
              <p className="mt-13 border-y border-line py-13 text-sm text-ink-3">No changes recorded yet. Status and stage changes, assignments, follow-ups and notes are logged here automatically.</p>
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

                <form action={setLeadStage} className="mt-21 grid gap-8 border-t border-line pt-21">
                  <input type="hidden" name="id" value={lead.id} />
                  <div className="field">
                    <label htmlFor="lead-stage">Pipeline stage</label>
                    <select id="lead-stage" name="stage" className="select" defaultValue={lead.stage} aria-describedby="stage-hint">
                      {LEAD_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {LEAD_STAGE_LABEL[s]} · {STAGE_NOTE[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="lead-lost">Reason, if lost</label>
                    <select id="lead-lost" name="lost_reason" className="select" defaultValue={lead.lost_reason ?? ""}>
                      <option value="">Not lost</option>
                      {LOST_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {LOST_REASON_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    <p id="stage-hint" className="field-hint">
                      Status says where the conversation is; stage says where the relationship is. A reason is kept only while the stage is Lost.
                    </p>
                  </div>
                  <div>
                    <SubmitButton pending="Saving…" className="btn btn-ghost">
                      Save stage
                    </SubmitButton>
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
                    { label: "Stage", value: <StageBadge stage={lead.stage} /> },
                    ...(lead.lost_reason ? [{ label: "Reason", value: LOST_REASON_LABEL[lead.lost_reason] }] : []),
                    { label: "Assigned to", value: assignedName },
                  ]}
                />
              </div>
            )}
          </section>

          <section aria-labelledby="lead-score" className="mt-34">
            <div className="flex items-baseline justify-between gap-13">
              <h2 id="lead-score" className="label">
                Score
              </h2>
              <Score value={lead.score} />
            </div>
            {score.excluded ? (
              <p className="mt-8 text-sm text-ink-2">Not scored: a {lead.topic.toLowerCase()} enquiry is a matter to resolve, not a sales lead.</p>
            ) : (
              <ul className="mt-8 border-t border-line">
                {score.parts.map((part) => (
                  <li key={part.label} className="flex items-baseline justify-between gap-13 border-b border-line py-5 text-sm">
                    {/* the database counts a recorded source the same way as a campaign link; for a staff-entered enquiry say what it is */}
                    <span className="text-ink-2">{byStaff && part.label === "Arrived from a campaign link" ? "Has a recorded source" : part.label}</span>
                    <span className="num text-ink">+{part.points}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-8 text-xs text-ink-3">Out of 100, counted by the database from what the enquirer told us. It orders the work; it is not a judgement of the person.</p>
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
                  ...(byStaff
                    ? [
                        { label: "Entered by", value: who(lead.added_by) },
                        { label: "Came about by", value: how },
                      ]
                    : [{ label: "Sent from", value: <span className="num">{lead.page}</span> }]),
                  { label: "Last updated", value: <span className="num">{fmtDateTime(lead.updated_at)}</span> },
                  ...(lead.stage_changed_at ? [{ label: "Stage since", value: <span className="num">{fmtDateTime(lead.stage_changed_at)}</span> }] : []),
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
                  { label: "Privacy notice", value: lead.privacy_accepted_at ? "Accepted" : "Not accepted on the website: entered by staff" },
                  { label: "Accepted at", value: lead.privacy_accepted_at ? <span className="num">{fmtDateTime(lead.privacy_accepted_at)}</span> : "No record" },
                  { label: "Policy version", value: lead.privacy_accepted_at ? <span className="num">{lead.privacy_version}</span> : "None: no policy was accepted" },
                  {
                    label: "Marketing",
                    // consent to marketing only ever stands beside an acceptance of the notice
                    value: lead.marketing_consent && lead.privacy_accepted_at ? (
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

          {utm.length > 0 && !byStaff && (
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

      {related.length > 0 && (
        <section aria-labelledby="lead-related" className="mt-55">
          <h2 id="lead-related" className="h4">
            Other enquiries from this address
          </h2>
          <p className="mt-5 text-sm text-ink-3">The same person may have written before. Read these first so that nobody is asked twice.</p>
          <div className="mt-13">
            <LeadsTable leads={related} names={names} me={me} caption="Other enquiries from the same email address" />
          </div>
        </section>
      )}
    </>
  );
}

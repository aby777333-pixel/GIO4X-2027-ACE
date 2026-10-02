import { changeStaff, decideStaffChange, grantStaff } from "@/app/control/actions";
import { ControlHead, Empty, Notice } from "@/components/control/bits";
import { fmtDate, fmtDateTime, ROLE_LABEL, ROLE_NOTE } from "@/components/control/format";
import { SubmitButton } from "@/components/control/SubmitButton";
import { STAFF_ROLES } from "@/lib/server/constants";
import type { StaffChangeRow, StaffListRow } from "@/lib/supabase/types";

export type StaffViewProps = {
  staff: StaffListRow[];
  changes: StaffChangeRow[];
  failed: boolean;
  me: string;
  /** may request and decide changes (staff.manage); otherwise the page is read-only */
  manage: boolean;
  notice?: string;
  error?: string;
};

const STATUS_LABEL: Record<StaffChangeRow["status"], string> = {
  pending: "Waiting for a second person",
  applied: "Applied",
  rejected: "Rejected",
  cancelled: "Withdrawn",
};

/**
 * Presentation only. Every change to staff access is a request; the database
 * applies it when a second manager approves, and refuses anyone deciding their
 * own request or a request about themselves.
 */
export function StaffView({ staff, changes, failed, me, manage, notice, error }: StaffViewProps) {
  const nameOf = new Map(staff.map((s) => [s.user_id, s.display_name]));
  const who = (userId: string | null) => (!userId ? "Database (SQL)" : userId === me ? "You" : (nameOf.get(userId) ?? "Former member of staff"));
  const pending = changes.filter((c) => c.status === "pending");
  const decided = changes.filter((c) => c.status !== "pending");
  const current = (userId: string) => staff.find((s) => s.user_id === userId);

  const describe = (c: StaffChangeRow) => {
    if (c.kind === "grant") return `Give access as ${ROLE_LABEL[c.role]}, shown as “${c.display_name}”`;
    const before = current(c.target);
    const parts: string[] = [];
    if (c.status !== "pending" || !before) {
      parts.push(`Role ${ROLE_LABEL[c.role]}`, c.active ? "access on" : "access off", `shown as “${c.display_name}”`);
    } else {
      if (before.role !== c.role) parts.push(`role ${ROLE_LABEL[before.role]} to ${ROLE_LABEL[c.role]}`);
      if (before.active !== c.active) parts.push(c.active ? "switch access back on" : "switch access off");
      if (before.display_name !== c.display_name) parts.push(`rename to “${c.display_name}”`);
      if (!parts.length) parts.push("no difference from the current record");
    }
    const text = parts.join(", ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  return (
    <>
      <ControlHead
        eyebrow="Governance"
        title="Staff"
        lead="Who can use GIO4X Control, and in which role. A change is requested by one person and approved by another; both are recorded in the audit log."
      />

      <div className="mt-21 grid gap-13">
        {notice && !error && <Notice title={notice} tone="ok" />}
        {error && <Notice title={error} tone="error" />}
        {!manage && <Notice title="Read-only">Your role can see who is on staff but cannot request or approve changes.</Notice>}
      </div>

      {failed ? (
        <div className="mt-21">
          <Notice title="The staff list could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section aria-labelledby="staff-pending" className="mt-34">
              <h2 id="staff-pending" className="h4">
                Waiting for approval
              </h2>
              <ul className="mt-13 border-t border-line">
                {pending.map((c) => {
                  const mine = c.requested_by === me;
                  const aboutMe = c.target === me;
                  return (
                    <li key={c.id} className="grid gap-13 border-b border-line py-13 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-ink">{c.target_email}</p>
                        <p className="mt-3 text-sm text-ink-2">{describe(c)}</p>
                        <p className="mt-3 text-xs text-ink-3">
                          Requested by {c.requested_by === me ? "you" : who(c.requested_by)} · <span className="num">{fmtDateTime(c.created_at)}</span>
                        </p>
                      </div>
                      {manage &&
                        (mine ? (
                          <form action={decideStaffChange}>
                            <input type="hidden" name="change" value={c.id} />
                            <input type="hidden" name="decision" value="withdraw" />
                            <SubmitButton pending="Saving…" className="btn btn-ghost btn-sm">
                              Withdraw
                            </SubmitButton>
                          </form>
                        ) : aboutMe ? (
                          <p className="text-xs text-ink-3">About you: somebody else decides.</p>
                        ) : (
                          <div className="flex flex-wrap gap-8">
                            <form action={decideStaffChange}>
                              <input type="hidden" name="change" value={c.id} />
                              <input type="hidden" name="decision" value="approve" />
                              <SubmitButton pending="Saving…" className="btn btn-primary btn-sm">
                                Approve
                              </SubmitButton>
                            </form>
                            <form action={decideStaffChange}>
                              <input type="hidden" name="change" value={c.id} />
                              <input type="hidden" name="decision" value="reject" />
                              <SubmitButton pending="Saving…" className="btn btn-ghost btn-sm">
                                Reject
                              </SubmitButton>
                            </form>
                          </div>
                        ))}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby="staff-list" className="mt-34">
            <h2 id="staff-list" className="h4">
              People
            </h2>
            {staff.length ? (
              <ul className="mt-13 border-t border-line">
                {staff.map((s) => {
                  const isMe = s.user_id === me;
                  const hasPending = pending.some((c) => c.target === s.user_id);
                  return (
                    <li key={s.user_id} className="border-b border-line py-13">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-5">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium text-ink">
                            {s.display_name}
                            {isMe && <span className="font-normal text-ink-3"> (you)</span>}
                          </p>
                          <p className="break-all text-xs text-ink-3">{s.email}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-13 gap-y-5 text-xs text-ink-3">
                          <span className={`state ${s.active ? "state-open" : "state-off"}`}>{s.active ? ROLE_LABEL[s.role] : `${ROLE_LABEL[s.role]} · access off`}</span>
                          <span>
                            Since <span className="num">{fmtDate(s.created_at)}</span>
                          </span>
                          <span>
                            Last sign-in <span className="num">{s.last_sign_in_at ? fmtDateTime(s.last_sign_in_at) : "never"}</span>
                          </span>
                        </div>
                      </div>
                      <p className="mt-5 text-xs text-ink-3">{ROLE_NOTE[s.role]}.</p>

                      {manage && !isMe && !hasPending && (
                        <details className="mt-8">
                          <summary className="cursor-pointer text-sm text-accent">Request a change</summary>
                          <form action={changeStaff} className="mt-13 grid gap-13 sm:grid-cols-3 sm:items-end">
                            <input type="hidden" name="user" value={s.user_id} />
                            <div className="field">
                              <label htmlFor={`name-${s.user_id}`}>Shown as</label>
                              <input id={`name-${s.user_id}`} name="display_name" type="text" className="input" defaultValue={s.display_name} maxLength={80} required autoComplete="off" />
                            </div>
                            <div className="field">
                              <label htmlFor={`role-${s.user_id}`}>Role</label>
                              <select id={`role-${s.user_id}`} name="role" className="select" defaultValue={s.role}>
                                {STAFF_ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE_LABEL[r]}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="field">
                              <label htmlFor={`active-${s.user_id}`}>Access</label>
                              <select id={`active-${s.user_id}`} name="active" className="select" defaultValue={s.active ? "1" : "0"}>
                                <option value="1">On</option>
                                <option value="0">Off (keeps their name on past records)</option>
                              </select>
                            </div>
                            <div className="sm:col-span-3">
                              <SubmitButton pending="Saving…" className="btn btn-ghost">
                                Request change
                              </SubmitButton>
                            </div>
                          </form>
                        </details>
                      )}
                      {manage && isMe && <p className="mt-5 text-xs text-ink-3">You cannot change your own access. Another administrator requests it, and a third approves when there is one.</p>}
                      {hasPending && <p className="mt-5 text-xs text-ink-3">A change for this person is waiting for approval.</p>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty title="Nobody is listed" />
            )}
          </section>

          {manage && (
            <section aria-labelledby="staff-grant" className="mt-55">
              <h2 id="staff-grant" className="h4">
                Give someone access
              </h2>
              <p className="mt-5 max-w-measure text-sm text-ink-2">
                The person needs a sign-in account first. Create it in the Supabase dashboard under Authentication, Users (this console holds no key that could create one), then enter the same address here.
              </p>
              <form action={grantStaff} className="mt-21 grid gap-13 sm:grid-cols-3 sm:items-end">
                <div className="field">
                  <label htmlFor="grant-email">Sign-in address</label>
                  <input id="grant-email" name="email" type="email" className="input" maxLength={254} required autoComplete="off" spellCheck={false} />
                </div>
                <div className="field">
                  <label htmlFor="grant-name">Shown as</label>
                  <input id="grant-name" name="display_name" type="text" className="input" maxLength={80} required autoComplete="off" />
                </div>
                <div className="field">
                  <label htmlFor="grant-role">Role</label>
                  <select id="grant-role" name="role" className="select" defaultValue="viewer">
                    {STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <SubmitButton pending="Saving…">Request access</SubmitButton>
                </div>
              </form>
            </section>
          )}

          <section aria-labelledby="staff-roles" className="mt-55">
            <h2 id="staff-roles" className="label">
              What each role can do today
            </h2>
            <dl className="mt-8">
              {STAFF_ROLES.map((r) => (
                <div key={r} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-13 border-b border-line py-8">
                  <dt className="text-sm text-ink">{ROLE_LABEL[r]}</dt>
                  <dd className="text-sm text-ink-2">{ROLE_NOTE[r]}.</dd>
                </div>
              ))}
            </dl>
          </section>

          {decided.length > 0 && (
            <section aria-labelledby="staff-history" className="mt-55">
              <h2 id="staff-history" className="label">
                Recent requests
              </h2>
              <ul className="mt-8 border-t border-line">
                {decided.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-3 border-b border-line py-8 text-sm">
                    <span className="min-w-0 break-words text-ink">
                      {c.target_email} <span className="text-ink-3">· {describe(c)}</span>
                    </span>
                    <span className="text-xs text-ink-3">
                      {STATUS_LABEL[c.status]}
                      {c.unreviewed && " without a second person (nobody else could approve)"} · requested by {c.requested_by === me ? "you" : who(c.requested_by)}
                      {c.status !== "cancelled" && !c.unreviewed && <>, decided by {c.decided_by === me ? "you" : who(c.decided_by)}</>} · <span className="num">{fmtDateTime(c.decided_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}

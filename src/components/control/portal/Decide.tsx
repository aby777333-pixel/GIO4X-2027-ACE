import type { ReactNode } from "react";
import { Notice } from "@/components/control/bits";
import { SubmitButton } from "@/components/control/SubmitButton";

/**
 * The two-button decision on one portal record: approve, or reject. Each is
 * its own small form posting to a server action in
 * src/app/control/actions-portal.ts, which checks the caller again, writes the
 * audit entry and only then makes the decision. Reject is behind a disclosure
 * so that it is never one stray click away.
 *
 *  - `reason`: a rejection must say why (KYC). The text is shown to the client
 *    by the portal, so the hint says so.
 *  - `reference`: an optional payment reference kept with the decision (funds).
 */
export function Decide({
  action,
  id,
  what,
  reason = false,
  reference = false,
  approveLabel = "Approve",
  approveValue = "approve",
  approve = true,
  cancel = false,
  note,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  /** what is being decided, for the accessible names: "passport of Jane Doe" */
  what: string;
  reason?: boolean;
  reference?: boolean;
  approveLabel?: string;
  /** the decision the primary button posts: "approve" (first person) or "confirm" (second person) */
  approveValue?: "approve" | "confirm";
  /** false when this person cannot press the primary button (their own request is waiting for somebody else) */
  approve?: boolean;
  /** offer "Withdraw the request" (an approval somebody asked for and nobody has confirmed) */
  cancel?: boolean;
  /** one line above the buttons: who asked, and when */
  note?: ReactNode;
}) {
  const field = `decide-${id}`;
  return (
    <div className="grid min-w-[12rem] gap-8">
      {note && <p className="text-xs text-ink-2">{note}</p>}
      {approve && (
      <form action={action} className="grid gap-5">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value={approveValue} />
        {reference && (
          <>
            <label htmlFor={`${field}-ref`} className="text-xs text-ink-3">
              Payment reference (optional)
            </label>
            <input id={`${field}-ref`} name="reference" type="text" className="input" maxLength={120} autoComplete="off" spellCheck={false} />
          </>
        )}
        <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
          {approveLabel}
          <span className="sr-only"> {what}</span>
        </SubmitButton>
      </form>
      )}
      {cancel && (
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="cancel" />
          <SubmitButton pending="Recording…" className="btn btn-ghost btn-sm">
            Withdraw the request
            <span className="sr-only"> to approve {what}</span>
          </SubmitButton>
        </form>
      )}
      <details>
        <summary className="cursor-pointer text-xs text-ink-2">
          Reject<span className="sr-only"> {what}</span>…
        </summary>
        <form action={action} className="mt-8 grid gap-5">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="reject" />
          {reason && (
            <>
              <label htmlFor={`${field}-reason`} className="text-xs text-ink-3">
                Reason (the client sees this)
              </label>
              <input id={`${field}-reason`} name="reason" type="text" className="input" required minLength={3} maxLength={300} autoComplete="off" />
            </>
          )}
          <SubmitButton pending="Recording…" className="btn btn-ghost btn-sm">
            Reject
          </SubmitButton>
        </form>
      </details>
    </div>
  );
}

const NOTICES: Record<string, string> = {
  requested: "Approval requested. A second person must confirm it before anything changes; nothing has moved yet.",
  cancelled: "The request was withdrawn. The transaction is still pending.",
  unreviewed: "Approved without a second person, because nobody else on staff can approve funds. The audit log records it as unreviewed.",
  approved: "Approved. The decision is recorded in the audit log.",
  rejected: "Rejected. The decision is recorded in the audit log.",
};

const ERRORS: Record<string, { title: string; body: string }> = {
  forbidden: { title: "Your role does not include this decision", body: "Nothing was changed." },
  unconfigured: { title: "The portal’s database is not connected", body: "Nothing was changed." },
  invalid: { title: "That request was not understood", body: "Nothing was changed. Reload the page and try again." },
  reason: { title: "A rejection needs a reason", body: "Nothing was changed. Say in a few words why; the client sees it." },
  audit: { title: "The decision could not be recorded, so it was not made", body: "Nothing was changed in the portal. Try again in a moment." },
  own: { title: "You asked for this approval, so somebody else must confirm it", body: "Nothing was changed." },
  requested: { title: "Approval has already been requested for this one", body: "Nothing was changed. A second person can confirm it below." },
  norequest: { title: "There is no open request to act on", body: "Nothing was changed. The list below shows where it stands." },
  decided: { title: "Somebody had already decided this", body: "Nothing was changed. The list below shows its current status." },
  missing: { title: "That record no longer exists in the portal", body: "Nothing was changed." },
  balance: { title: "The wallet does not hold enough for this withdrawal", body: "Nothing was changed. The attempt is recorded in the audit log." },
  wallet: { title: "The wallet is not active", body: "Nothing was changed. The attempt is recorded in the audit log." },
  type: { title: "Only deposits and withdrawals are settled here", body: "Nothing was changed." },
  portal: { title: "The portal did not accept the decision", body: "Check the record’s status below before trying again: the attempt is recorded in the audit log." },
};

/** What the last decision did, from the fixed codes the server action redirects with. */
export function DecisionNotice({ notice, error }: { notice: string; error: string }) {
  const failed = ERRORS[error];
  if (failed) {
    return (
      <div className="mt-21">
        <Notice tone="error" title={failed.title}>
          {failed.body}
        </Notice>
      </div>
    );
  }
  const done = NOTICES[notice];
  return done ? (
    <div className="mt-21">
      <Notice tone="ok" title={done} />
    </div>
  ) : null;
}

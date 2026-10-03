import { settleIb } from "@/app/control/actions-portal";
import { Notice } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { fmtMoney } from "@/components/control/portal/kit";
import { SubmitButton } from "@/components/control/SubmitButton";

/** One partner as control_ib_list() returns it (portal: 20261003150000_control_ib.sql). Sums are made by the database. */
export type IbListRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
  kyc_status: string;
  referral_code: string | null;
  joined: string;
  parent_id: string | null;
  parent_name: string | null;
  plan_name: string | null;
  direct: number;
  network: number;
  unsettled: { currency: string; amount: number | string; rows: number }[];
};

/** An open request to pay an IB, from portal_approvals_open(): `reference` is the currency asked for. */
export type SettleRequest = { requested_by_name: string; requested_at: string; reference: string | null; mine: boolean };

/**
 * Paying commission that awaits settlement, in one currency. Two people: the
 * first asks, a different one confirms; the database refuses the requester.
 * `at` is the page to return to (a person's page), absent on the list.
 */
export function SettleControl({ ib, at, currency, amount, request }: { ib: string; at?: string; currency: string; amount: number | string; request?: SettleRequest }) {
  const hidden = (decision: string) => (
    <>
      <input type="hidden" name="ib" value={ib} />
      {at && <input type="hidden" name="at" value={at} />}
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="decision" value={decision} />
    </>
  );
  // a request for another currency is open: one at a time per partner
  if (request && request.reference !== currency) {
    return <span className="text-xs text-ink-3">A payment in {request.reference} is awaiting confirmation first.</span>;
  }
  return (
    <div className="grid gap-5">
      {request && (
        <p className="text-xs text-ink-2">
          {request.mine ? "You asked for this payment" : `${request.requested_by_name} asked for this payment`} on {fmtDateTime(request.requested_at)}.{request.mine ? " Somebody else must confirm it." : ""}
        </p>
      )}
      {!request && (
        <form action={settleIb}>
          {hidden("request")}
          <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
            Pay {fmtMoney(amount, currency)} (1 of 2)
          </SubmitButton>
        </form>
      )}
      {request && !request.mine && (
        <form action={settleIb}>
          {hidden("confirm")}
          <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
            Confirm and pay {fmtMoney(amount, currency)} (2 of 2)
          </SubmitButton>
        </form>
      )}
      {request && (
        <form action={settleIb}>
          {hidden("cancel")}
          <SubmitButton pending="Recording…" className="btn btn-ghost btn-sm">
            Withdraw the request
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

const DONE: Record<string, string> = {
  promoted: "Now an introducing broker. The change is recorded in the audit log.",
  demoted: "Now a client again. The change is recorded in the audit log.",
  linked: "Placed under the chosen IB, with everyone beneath them. The change is recorded in the audit log.",
  unlinked: "Detached from their parent. Everyone beneath them stays beneath them.",
  plan: "Plan saved for this link.",
  requested: "Payment requested. A second person must confirm it before anything is paid.",
  cancelled: "The request was withdrawn. Nothing was paid.",
  paid: "Paid into the IB’s commission wallet. The audit log has both names.",
  paid_unreviewed: "Paid into the IB’s commission wallet without a second person, because nobody else on staff can approve partner payments. The audit log records it as unreviewed.",
  created: "Added. The change is recorded in the audit log.",
  updated: "Saved. The change is recorded in the audit log.",
  retired: "Retired. It is switched off and stays on record.",
};

const REFUSED: Record<string, { title: string; body: string }> = {
  forbidden: { title: "Your role does not include this", body: "Nothing was changed." },
  unconfigured: { title: "The portal’s database is not connected", body: "Nothing was changed." },
  invalid: { title: "That request was not understood", body: "Nothing was changed. Reload the page and try again." },
  audit: { title: "The change could not be recorded, so it was not made", body: "Nothing was changed in the portal. Try again in a moment." },
  missing: { title: "That person is no longer in the portal", body: "Nothing was changed." },
  staff: { title: "A portal staff or admin profile cannot be an IB or sit under one", body: "Nothing was changed." },
  downline: { title: "This IB still has people beneath them", body: "Nothing was changed. Move or detach their downline first, then make them a client." },
  parent: { title: "The chosen parent is not an introducing broker", body: "Nothing was changed. Make them an IB first." },
  cycle: { title: "That would put a person beneath their own downline", body: "Nothing was changed." },
  self: { title: "A person cannot sit under themselves", body: "Nothing was changed." },
  plan: { title: "That commission plan is not active", body: "Nothing was changed." },
  noparent: { title: "This person has no parent to be detached from", body: "Nothing was changed." },
  value: { title: "A value was not accepted", body: "Nothing was changed. A share is a fraction between 0 and 1: 0.15 is 15%. In a plan, rates are not negative and a required field is not empty." },
  duplicate: { title: "That name is already used", body: "Nothing was changed." },
  defaultplan: { title: "The default plan cannot be retired", body: "Nothing was changed. Make another plan the default first." },
  own: { title: "You asked for this payment, so somebody else must confirm it", body: "Nothing was paid." },
  requested: { title: "A payment to this IB is already awaiting confirmation", body: "Nothing was changed." },
  norequest: { title: "There is no open request to act on", body: "Nothing was changed." },
  nothing: { title: "There was nothing left to pay", body: "The commission had already been settled. The attempt is recorded in the audit log." },
  portal: { title: "The portal did not accept the change", body: "The attempt is recorded in the audit log. Check the figures below before trying again." },
};

/** What the last action did, from the fixed codes the server actions redirect with. */
export function IbNotice({ notice, error }: { notice: string; error: string }) {
  const refused = REFUSED[error];
  if (refused) {
    return (
      <div className="mt-21">
        <Notice tone="error" title={refused.title}>
          {refused.body}
        </Notice>
      </div>
    );
  }
  const done = DONE[notice];
  return done ? (
    <div className="mt-21">
      <Notice tone="ok" title={done} />
    </div>
  ) : null;
}

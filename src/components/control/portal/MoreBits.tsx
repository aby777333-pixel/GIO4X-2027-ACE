import { chargeFeeByHand, retireMaterial, reverseFee, saveMaterial, waiveFee } from "@/app/control/actions-portal-more";
import { Notice } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { Section, label } from "@/components/control/portal/kit";
import { SubmitButton } from "@/components/control/SubmitButton";
import type { Json } from "@/lib/supabase/types";

/**
 * The forms and notices for the changes of src/app/control/actions-portal-more.ts
 * (0027_portal_clients_fees.sql): marketing materials, fees waived, charged or
 * reversed by hand. Each form posts to a server action that checks the caller,
 * writes the audit entry and only then asks the portal. The page decides
 * whether to draw a form at all; nothing here grants anything.
 */

export const MATERIAL_KINDS = ["banner", "logo", "video", "document", "copy", "landing_page", "other"] as const;
export const LINK_DESTINATIONS = ["register", "register-demo", "home", "raptor"] as const;
export const LINK_DESTINATION_LABEL: Record<string, string> = { register: "Registration", "register-demo": "Demo registration", home: "Home page", raptor: "Raptor" };

/** An open two-person request, as portal_requests_open() returns it. `id` is what the request is about. */
export type OpenRequest = { id: string; payload: Json; requested_by_name: string; requested_at: string; mine: boolean };

/** One text value of a request's payload; anything else is nothing. */
export function payloadText(payload: Json, key: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const v = payload[key];
  return typeof v === "string" ? v : "";
}

export type MaterialRow = { id: string; title: string; kind: string; description: string | null; url: string; language: string | null; sort: number | null; active: boolean | null };

function MaterialForm({ row }: { row?: MaterialRow }) {
  const key = row?.id ?? "new";
  return (
    <form action={saveMaterial} className="mt-13 grid gap-13">
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="grid gap-13 sm:grid-cols-2 xl:grid-cols-3">
        <div className="field">
          <label htmlFor={`mm-${key}-title`}>Title</label>
          <input id={`mm-${key}-title`} name="title" type="text" className="input" required maxLength={160} defaultValue={row?.title ?? ""} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor={`mm-${key}-kind`}>Kind</label>
          <select id={`mm-${key}-kind`} name="kind" className="select" required defaultValue={row?.kind ?? "banner"}>
            {MATERIAL_KINDS.map((k) => (
              <option key={k} value={k}>
                {label(k)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`mm-${key}-language`}>Language</label>
          <input id={`mm-${key}-language`} name="language" type="text" className="input" pattern="[a-z\-]{2,8}" maxLength={8} defaultValue={row?.language ?? "en"} autoComplete="off" spellCheck={false} aria-describedby={`mm-${key}-language-hint`} />
          <p id={`mm-${key}-language-hint`} className="field-hint">
            Lower case, for example: en, ar, pt-br
          </p>
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor={`mm-${key}-url`}>Address of the file</label>
          <input id={`mm-${key}-url`} name="url" type="url" className="input" required pattern="https://\S{4,}" maxLength={500} defaultValue={row?.url ?? ""} autoComplete="off" spellCheck={false} aria-describedby={`mm-${key}-url-hint`} />
          <p id={`mm-${key}-url-hint`} className="field-hint">
            The https address where the file is hosted. Nothing is uploaded here.
          </p>
        </div>
        <div className="field">
          <label htmlFor={`mm-${key}-sort`}>Order in the list</label>
          <input id={`mm-${key}-sort`} name="sort" type="text" inputMode="numeric" pattern="[0-9]{1,4}" className="input" defaultValue={String(row?.sort ?? 0)} autoComplete="off" />
        </div>
        <div className="field sm:col-span-2 xl:col-span-3">
          <label htmlFor={`mm-${key}-description`}>Description (optional)</label>
          <input id={`mm-${key}-description`} name="description" type="text" className="input" maxLength={400} defaultValue={row?.description ?? ""} autoComplete="off" />
        </div>
        <div className="flex items-center gap-8">
          <input id={`mm-${key}-active`} name="active" type="checkbox" defaultChecked={row ? row.active !== false : true} />
          <label htmlFor={`mm-${key}-active`} className="text-sm text-ink">
            Active (IBs see it)
          </label>
        </div>
      </div>
      <div>
        <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
          {row ? "Save the changes" : "Add the material"}
        </SubmitButton>
      </div>
    </form>
  );
}

/**
 * Add, change and retire marketing materials, each behind its own disclosure
 * as ConfigManager.tsx has it. There is no delete: a material that is no
 * longer wanted is retired and stays on record.
 */
export function MaterialManager({ rows }: { rows: MaterialRow[] }) {
  return (
    <Section title="Add or change a material" aside="Recorded in the audit log with your name">
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-ink">Add a material</summary>
        <MaterialForm />
      </details>
      {rows.map((row) => (
        <details key={row.id} className="mt-13 border-t border-line pt-13">
          <summary className="cursor-pointer text-sm text-ink">
            Change <span className="font-semibold">{row.title}</span>
            {row.active === false && <span className="text-ink-3"> (retired)</span>}
          </summary>
          <MaterialForm row={row} />
          {row.active !== false && (
            <form action={retireMaterial} className="mt-13">
              <input type="hidden" name="id" value={row.id} />
              <SubmitButton pending="Recording…" className="btn btn-ghost btn-sm">
                Retire this material
              </SubmitButton>
              <span className="ml-13 text-xs text-ink-3">It is switched off and kept on record; nothing is deleted.</span>
            </form>
          )}
        </details>
      ))}
    </Section>
  );
}

/** Who asked, and when: the line above a two-person control. */
function Asked({ request, what }: { request: OpenRequest; what: string }) {
  return (
    <p className="text-xs text-ink-2">
      {request.mine ? `You asked for this ${what}` : `${request.requested_by_name} asked for this ${what}`} on {fmtDateTime(request.requested_at)}.{request.mine ? " Somebody else must confirm it." : ""}
    </p>
  );
}

/** Waive a charge that is still pending. One person. */
export function WaiveControl({ id }: { id: string }) {
  return (
    <form action={waiveFee}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton pending="Recording…" className="btn btn-ghost btn-sm">
        Waive
      </SubmitButton>
    </form>
  );
}

/**
 * Reversing an applied fee: the first person asks, with a note that says why;
 * a different person confirms; the database refuses the requester.
 */
export function ReverseControl({ id, request }: { id: string; request?: OpenRequest }) {
  const hidden = (decision: string) => (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value={decision} />
    </>
  );
  if (!request) {
    return (
      <details>
        <summary className="cursor-pointer text-xs text-ink-2">Reverse…</summary>
        <form action={reverseFee} className="mt-8 grid min-w-[12rem] gap-5">
          {hidden("request")}
          <label htmlFor={`rev-${id}`} className="text-xs text-ink-3">
            Why it is reversed
          </label>
          <input id={`rev-${id}`} name="note" type="text" className="input" required minLength={5} maxLength={300} autoComplete="off" />
          <SubmitButton pending="Recording…" className="btn btn-ghost btn-sm">
            Ask for the reversal (1 of 2)
          </SubmitButton>
        </form>
      </details>
    );
  }
  const note = payloadText(request.payload, "note");
  return (
    <div className="grid min-w-[12rem] gap-5">
      <Asked request={request} what="reversal" />
      {note && <p className="text-xs text-ink-3">Reason given: {note}</p>}
      {!request.mine && (
        <form action={reverseFee}>
          {hidden("confirm")}
          <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
            Confirm reversal (2 of 2)
          </SubmitButton>
        </form>
      )}
      <form action={reverseFee}>
        {hidden("cancel")}
        <SubmitButton pending="Recording…" className="btn btn-ghost btn-sm">
          Withdraw the request
        </SubmitButton>
      </form>
    </div>
  );
}

/** An open request to charge a fee by hand: confirmed by a second person, or withdrawn. */
export function ChargeRequestControl({ request }: { request: OpenRequest }) {
  const hidden = (decision: string) => (
    <>
      <input type="hidden" name="id" value={request.id} />
      <input type="hidden" name="decision" value={decision} />
    </>
  );
  return (
    <div className="grid min-w-[12rem] gap-5">
      <Asked request={request} what="charge" />
      {!request.mine && (
        <form action={chargeFeeByHand}>
          {hidden("confirm")}
          <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
            Confirm and charge (2 of 2)
          </SubmitButton>
        </form>
      )}
      <form action={chargeFeeByHand}>
        {hidden("cancel")}
        <SubmitButton pending="Recording…" className="btn btn-ghost btn-sm">
          Withdraw the request
        </SubmitButton>
      </form>
    </div>
  );
}

const DONE: Record<string, string> = {
  material_saved: "Material saved. The change is recorded in the audit log.",
  material_retired: "Material retired. It is switched off and stays on record.",
  link_created: "Campaign link created for this IB. The portal made its code; it is in the list below.",
  status: "Account status changed. The change is recorded in the audit log.",
  waived: "Charge waived. The change is recorded in the audit log.",
  requested: "Requested. A second person must confirm it before anything changes; nothing has moved yet.",
  cancelled: "The request was withdrawn. Nothing was changed.",
  charged: "Fee charged to the client’s main USD wallet. The audit log has both names.",
  charged_unreviewed: "Fee charged to the client’s main USD wallet without a second person, because nobody else on staff can charge fees. The audit log records it as unreviewed.",
  reversed: "Fee reversed and credited back to the client. The audit log has both names.",
  reversed_unreviewed: "Fee reversed and credited back to the client without a second person, because nobody else on staff can charge fees. The audit log records it as unreviewed.",
};

// the codes every portal action redirects with; a page that already draws another notice for them passes generic={false}
const GENERIC: Record<string, { title: string; body: string }> = {
  forbidden: { title: "Your role does not include this", body: "Nothing was changed." },
  unconfigured: { title: "The portal’s database is not connected", body: "Nothing was changed." },
  invalid: { title: "That request was not understood", body: "Nothing was changed. Reload the page and try again." },
  audit: { title: "The change could not be recorded, so it was not made", body: "Nothing was changed in the portal. Try again in a moment." },
  portal: { title: "The portal did not accept the change", body: "The attempt is recorded in the audit log. Check the records below before trying again." },
};

const REFUSED: Record<string, { title: string; body: string }> = {
  field: {
    title: "A value was not accepted",
    body: "Nothing was changed. An address starts with https:// and has no spaces; a language is two to eight lower-case letters; an amount is greater than zero with at most two decimal places; a note is at least five characters.",
  },
  reason: { title: "This needs a reason", body: "Nothing was changed. Say in a few words why: at least five characters." },
  gone: { title: "That record no longer exists in the portal", body: "Nothing was changed." },
  not_ib: { title: "This person is not an introducing broker or an affiliate", body: "No link was created. Make them an IB first." },
  staffprofile: { title: "A portal staff or admin profile is not changed from here", body: "Nothing was changed." },
  done: { title: "Somebody had already dealt with this one", body: "Nothing was changed. The table below shows its current status." },
  notfee: { title: "Only a fee of more than zero can be reversed", body: "Nothing was changed." },
  own: { title: "You asked for this, so somebody else must confirm it", body: "Nothing was changed." },
  requested: { title: "This has already been requested", body: "Nothing was changed. A second person can confirm it." },
  norequest: { title: "There is no open request to act on", body: "Nothing was changed." },
  nowallet: { title: "The client has no main USD wallet", body: "Nothing was charged. A fee by hand is taken from that wallet only." },
  wallet: { title: "The client’s main USD wallet is not active", body: "Nothing was charged." },
  balance: { title: "The wallet does not hold enough for this fee", body: "Nothing was charged. The attempt is recorded in the audit log, and the request is spent: ask again when the balance allows." },
};

/**
 * What the last change did, from the fixed codes the server actions redirect
 * with. An unknown code draws nothing. A page that also draws another notice
 * passes generic={false} (the other one says the generic refusals), or `only`
 * with the few codes that are this one's to say.
 */
export function MoreNotice({ notice, error, generic = true, only }: { notice: string; error: string; generic?: boolean; only?: readonly string[] }) {
  if (only && !only.includes(error) && (error !== "" || !only.includes(notice))) return null;
  const refused = REFUSED[error] ?? (generic && !only ? GENERIC[error] : undefined);
  if (refused) {
    return (
      <div className="mt-21">
        <Notice tone="error" title={refused.title}>
          {refused.body}
        </Notice>
      </div>
    );
  }
  // a generic refusal is drawn by the page's other notice: say nothing about a notice code beside it
  if (GENERIC[error]) return null;
  const done = DONE[notice];
  return done ? (
    <div className="mt-21">
      <Notice tone="ok" title={done} />
    </div>
  ) : null;
}

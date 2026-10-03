import { runPortalOp } from "@/app/control/actions-portal";
import { Notice } from "@/components/control/bits";
import { Section, label } from "@/components/control/portal/kit";
import { SubmitButton } from "@/components/control/SubmitButton";

/**
 * The forms for the changes Control makes through control_ops in the portal's
 * database (0026_portal_ops.sql): the status of a signal provider or a fund,
 * ledger accounts and manual journal entries, legal documents, and running
 * the event queue. Each form posts to runPortalOp, which checks the caller,
 * writes the audit entry and only then asks the portal. The page decides
 * whether to draw a form at all; nothing here grants anything.
 */

const LEDGER_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "USDT", "BTC", "ETH", "USC"] as const;

function Op({ op, fields, children, className }: { op: string; fields?: Record<string, string>; children: React.ReactNode; className?: string }) {
  return (
    <form action={runPortalOp} className={className}>
      <input type="hidden" name="op" value={op} />
      {Object.entries(fields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
    </form>
  );
}

/** Approve, pause, resume or close a signal provider or a managed fund. Closed is final. */
export function StatusManager({ kind, rows }: { kind: "provider" | "fund"; rows: { id: string; title: string; status: string }[] }) {
  const op = kind === "provider" ? "provider_status" : "fund_status";
  const noun = kind === "provider" ? "signal provider" : "fund";
  const open = rows.filter((r) => r.status !== "closed");
  const button = (id: string, status: string, text: string, primary = false) => (
    <Op op={op} fields={{ id, status }}>
      <SubmitButton pending="Recording…" className={`btn btn-sm ${primary ? "btn-primary" : "btn-ghost"}`}>
        {text}
      </SubmitButton>
    </Op>
  );
  return (
    <Section title={`Change the status of a ${noun}`} aside="Recorded in the audit log with your name">
      {open.length === 0 ? (
        <p className="text-sm text-ink-2">There is no open {noun} on this page to change.</p>
      ) : (
        <ul>
          {open.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-13 border-b border-line py-8 last:border-b-0">
              <span className="text-sm text-ink">
                <span className="font-semibold">{row.title}</span> <span className="text-ink-3">· now {label(row.status).toLowerCase()}</span>
              </span>
              <span className="flex flex-wrap gap-8">
                {row.status === "pending" && button(row.id, "active", "Approve", true)}
                {row.status === "paused" && button(row.id, "active", "Resume", true)}
                {row.status === "active" && button(row.id, "paused", "Pause")}
                {button(row.id, "closed", "Close for good")}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-xs text-ink-3">
        {kind === "provider" ? "A provider with active followers cannot be closed: pause it, and close it when the followers have stopped." : "A fund with units outstanding cannot be closed: pause it, and close it when investors have redeemed."} A closed {noun} is not reopened.
      </p>
    </Section>
  );
}

type Account = { id: string; code: string; name: string | null; currency: string | null; is_system: boolean | null; active: boolean | null };

/** Add a ledger account, switch one off or on, and post a manual journal entry. */
export function LedgerManager({ accounts }: { accounts: Account[] }) {
  const active = accounts.filter((a) => a.active !== false);
  const own = accounts.filter((a) => !a.is_system);
  const option = (a: Account) => (
    <option key={a.id} value={a.id}>
      {a.code} · {a.name ?? ""} ({a.currency})
    </option>
  );
  return (
    <Section title="Post a manual journal entry, or change the accounts" aside="Recorded in the audit log with your name">
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-ink">Post a manual journal entry</summary>
        <Op op="journal_post" className="mt-13 grid gap-13 sm:grid-cols-2 xl:grid-cols-3">
          <div className="field">
            <label htmlFor="jr-debit">Debit</label>
            <select id="jr-debit" name="debit" className="select" required defaultValue="">
              <option value="" disabled>
                Choose an account
              </option>
              {active.map(option)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="jr-credit">Credit</label>
            <select id="jr-credit" name="credit" className="select" required defaultValue="">
              <option value="" disabled>
                Choose an account
              </option>
              {active.map(option)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="jr-amount">Amount</label>
            <input id="jr-amount" name="amount" type="text" inputMode="decimal" pattern="[0-9]{1,12}([.][0-9]{1,8})?" className="input" required autoComplete="off" aria-describedby="jr-amount-hint" />
            <p id="jr-amount-hint" className="field-hint">
              In the accounts’ currency; both accounts must share one.
            </p>
          </div>
          <div className="field sm:col-span-2">
            <label htmlFor="jr-description">What it is for</label>
            <input id="jr-description" name="description" type="text" className="input" required minLength={5} maxLength={300} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="jr-reference">Reference (optional)</label>
            <input id="jr-reference" name="reference" type="text" className="input" maxLength={120} autoComplete="off" />
          </div>
          <div className="sm:col-span-2 xl:col-span-3">
            <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
              Post the entry
            </SubmitButton>
            <span className="ml-13 text-xs text-ink-3">One debit and one credit of the same amount. It corrects the books; no wallet changes. A posted entry is not edited: a mistake is corrected by a second entry the other way.</span>
          </div>
        </Op>
      </details>

      <details className="mt-13 border-t border-line pt-13">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Add a ledger account</summary>
        <Op op="ledger_account_create" className="mt-13 grid gap-13 sm:grid-cols-2 xl:grid-cols-4">
          <div className="field">
            <label htmlFor="la-code">Code</label>
            <input id="la-code" name="code" type="text" className="input" required pattern="[A-Za-z][A-Za-z0-9_]{2,39}" maxLength={40} autoComplete="off" spellCheck={false} aria-describedby="la-code-hint" />
            <p id="la-code-hint" className="field-hint">
              Capitals, digits and underscores, for example BANK_FEES
            </p>
          </div>
          <div className="field">
            <label htmlFor="la-name">Name</label>
            <input id="la-name" name="name" type="text" className="input" required maxLength={120} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="la-type">Type</label>
            <select id="la-type" name="type" className="select" required defaultValue="expense">
              {LEDGER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="la-currency">Currency</label>
            <select id="la-currency" name="currency" className="select" required defaultValue="USD">
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
              Add the account
            </SubmitButton>
          </div>
        </Op>
      </details>

      {own.length > 0 && (
        <details className="mt-13 border-t border-line pt-13">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Switch an account off or on</summary>
          <ul className="mt-8">
            {own.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-13 border-b border-line py-8 last:border-b-0">
                <span className="text-sm text-ink">
                  <span className="num font-semibold">{a.code}</span> {a.name} <span className="text-ink-3">· {a.active !== false ? "active" : "switched off"}</span>
                </span>
                <Op op="ledger_account_active" fields={{ id: a.id, active: a.active !== false ? "false" : "true" }}>
                  <SubmitButton pending="Recording…" className="btn btn-ghost btn-sm">
                    {a.active !== false ? "Switch off" : "Switch on"}
                  </SubmitButton>
                </Op>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xs text-ink-3">The portal’s own system accounts are not listed: they stay on. An account that is switched off keeps its entries.</p>
        </details>
      )}
    </Section>
  );
}

type Legal = { id: string; key: string; title: string | null; body: string | null; version: number | null; published: boolean | null };

/** Edit a legal document, publish it to clients or take it down, and add a new one. */
export function LegalManager({ docs }: { docs: Legal[] }) {
  return (
    <Section title="Edit and publish" aside="Recorded in the audit log with your name">
      {docs.map((d) => (
        <details key={d.id} className="border-b border-line py-13 first:pt-0">
          <summary className="cursor-pointer text-sm text-ink">
            Edit <span className="font-semibold">{d.title || d.key}</span>{" "}
            <span className="text-ink-3">
              · version {d.version ?? 1} · {d.published ? "published" : "not published"}
            </span>
          </summary>
          <Op op="legal_save" fields={{ id: d.id }} className="mt-13 grid gap-13">
            <div className="field">
              <label htmlFor={`lg-title-${d.id}`}>Title</label>
              <input id={`lg-title-${d.id}`} name="title" type="text" className="input" required maxLength={160} defaultValue={d.title ?? ""} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor={`lg-body-${d.id}`}>Text</label>
              <textarea id={`lg-body-${d.id}`} name="body" className="textarea" rows={14} maxLength={200000} defaultValue={d.body ?? ""} aria-describedby={`lg-hint-${d.id}`} />
              <p id={`lg-hint-${d.id}`} className="field-hint">
                Plain text. Clients read it at /portal/legal/{d.key} once it is published. Saving a change raises the version by one.
              </p>
            </div>
            <div>
              <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
                Save the text
              </SubmitButton>
            </div>
          </Op>
          <Op op="legal_publish" fields={{ id: d.id, published: d.published ? "false" : "true" }} className="mt-13">
            <SubmitButton pending="Recording…" className="btn btn-ghost btn-sm">
              {d.published ? "Take it down" : "Publish to clients"}
            </SubmitButton>
            {!d.published && <span className="ml-13 text-xs text-ink-3">Only a real text is published: a placeholder of a line or two is refused. Have it reviewed by a lawyer first.</span>}
          </Op>
        </details>
      ))}
      <details className="pt-13">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Add a document</summary>
        <Op op="legal_save" className="mt-13 grid gap-13">
          <div className="grid gap-13 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="lg-new-key">Key</label>
              <input id="lg-new-key" name="key" type="text" className="input" required pattern="[a-z][a-z0-9_]{1,39}" maxLength={40} autoComplete="off" spellCheck={false} aria-describedby="lg-new-key-hint" />
              <p id="lg-new-key-hint" className="field-hint">
                Lower case, digits and underscores: it becomes the address, /portal/legal/&lt;key&gt;
              </p>
            </div>
            <div className="field">
              <label htmlFor="lg-new-title">Title</label>
              <input id="lg-new-title" name="title" type="text" className="input" required maxLength={160} autoComplete="off" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="lg-new-body">Text</label>
            <textarea id="lg-new-body" name="body" className="textarea" rows={10} maxLength={200000} />
          </div>
          <div>
            <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
              Add as a draft
            </SubmitButton>
          </div>
        </Op>
      </details>
    </Section>
  );
}

/** Run the portal's event queue now. */
export function DispatchButton({ waiting }: { waiting: number | null }) {
  return (
    <Op op="events_dispatch" className="mt-21 flex flex-wrap items-center gap-13">
      <SubmitButton pending="Running…" className="btn btn-primary btn-sm">
        Process waiting events now
      </SubmitButton>
      <span className="text-xs text-ink-3">
        Up to 100 at a time, oldest first{waiting === null ? "" : `; ${waiting} waiting`}. It sends the notifications those events call for; an event that fails stays waiting.
      </span>
    </Op>
  );
}

const DONE: Record<string, string> = {
  status: "Status changed. The change is recorded in the audit log.",
  account: "Ledger account saved. The change is recorded in the audit log.",
  journal: "Journal entry posted. It is recorded in the audit log.",
  legal: "Document saved. The change is recorded in the audit log.",
  published: "Published state changed. The change is recorded in the audit log.",
  dispatched: "The event queue was run. Reload to see what is still waiting.",
};

const REFUSED: Record<string, { title: string; body: string }> = {
  forbidden: { title: "Your role does not include this", body: "Nothing was changed." },
  unconfigured: { title: "The portal’s database is not connected", body: "Nothing was changed." },
  invalid: { title: "That request was not understood", body: "Nothing was changed. Reload the page and try again." },
  value: { title: "A value was not accepted", body: "Nothing was changed. Check the code, the amount (greater than zero), and that required fields are filled in." },
  audit: { title: "The change could not be recorded, so it was not made", body: "Nothing was changed in the portal. Try again in a moment." },
  missing: { title: "That record no longer exists in the portal", body: "Nothing was changed." },
  closed: { title: "It is closed, and a closed one is not reopened", body: "Nothing was changed." },
  inuse: { title: "It cannot be closed while clients are still in it", body: "Nothing was changed. Pause it; close it when followers have stopped or investors have redeemed." },
  duplicate: { title: "That code or key is already used", body: "Nothing was changed." },
  system: { title: "A system account stays on", body: "Nothing was changed." },
  same: { title: "Debit and credit are the same account", body: "Nothing was posted." },
  inactive: { title: "One of the accounts is switched off", body: "Nothing was posted." },
  currency: { title: "The two accounts are in different currencies", body: "Nothing was posted." },
  short: { title: "That text is too short to publish", body: "Nothing was changed. A placeholder is not published to clients: save the full text first." },
  portal: { title: "The portal did not accept the change", body: "The attempt is recorded in the audit log. Check the tables above before trying again." },
};

/** What the last change did, from the fixed codes runPortalOp redirects with. */
export function OpsNotice({ notice, error }: { notice: string; error: string }) {
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

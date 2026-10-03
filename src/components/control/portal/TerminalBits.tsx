import { addTradingBlock, endTradingBlock, recordTrade, sendServiceEmail, updateInstrument } from "@/app/control/actions-terminal";
import { Empty, Notice } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { Section, fmtNum, label } from "@/components/control/portal/kit";
import { SubmitButton } from "@/components/control/SubmitButton";
import { INSTRUMENT_FIELDS, ROUTING_MODES, type Instrument, type InstrumentField, type TerminalAudit, type TradingBlock } from "@/lib/server/terminal-db";

/**
 * Screens for the trading terminal's settings, the hand-entered trade and the
 * service e-mail (src/app/control/actions-terminal.ts). Presentation and forms
 * only: each form posts to a server action that checks the caller again.
 */

const FIELDS = Object.keys(INSTRUMENT_FIELDS) as InstrumentField[];

function FieldForm({ symbol, field, value }: { symbol: string; field: InstrumentField; value: Instrument[InstrumentField] }) {
  const rule = INSTRUMENT_FIELDS[field];
  const id = `ti-${symbol}-${field}`;
  return (
    <form action={updateInstrument} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-8">
      <input type="hidden" name="symbol" value={symbol} />
      <input type="hidden" name="field" value={field} />
      <div className="field">
        <label htmlFor={id}>{rule.label}</label>
        {rule.kind === "flag" ? (
          <select id={id} name="value" className="select" defaultValue={value ? "true" : "false"}>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        ) : rule.kind === "routing" ? (
          <select id={id} name="value" className="select" defaultValue={String(value)}>
            {ROUTING_MODES.map((m) => (
              <option key={m} value={m}>
                {label(m)}
              </option>
            ))}
          </select>
        ) : (
          <input id={id} name="value" type="text" inputMode="decimal" className="input" defaultValue={String(value ?? "")} autoComplete="off" aria-describedby={`${id}-hint`} />
        )}
        {rule.kind === "number" && (
          <p id={`${id}-hint`} className="field-hint">
            {rule.min} to {rule.max}
          </p>
        )}
      </div>
      <SubmitButton pending="…" className="btn btn-ghost btn-sm">
        Set
      </SubmitButton>
    </form>
  );
}

/** Every symbol on the terminal with its conditions; a person who may change them opens a symbol to do so, one field at a time. */
export function InstrumentsSection({ instruments, manages, focus }: { instruments: Instrument[] | null; manages: boolean; focus?: string }) {
  return (
    <Section title="Symbols on the trading terminal" aside={instruments ? `${fmtNum(instruments.length)} symbols` : undefined}>
      {!instruments ? (
        <Empty title="The terminal did not answer" />
      ) : instruments.length === 0 ? (
        <Empty title="The terminal lists no symbols" />
      ) : (
        <>
          <div className="scroll-x">
            <table className="table-gx min-w-[64rem] text-sm">
              <caption className="sr-only">Trading conditions per symbol, as the terminal holds them</caption>
              <thead>
                <tr>
                  <th scope="col">Symbol</th>
                  <th scope="col">Group</th>
                  <th scope="col">Trading</th>
                  <th scope="col">Markup</th>
                  <th scope="col">Commission / lot</th>
                  <th scope="col">Swap long</th>
                  <th scope="col">Swap short</th>
                  <th scope="col">Lots</th>
                  <th scope="col">Routing</th>
                  <th scope="col">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {instruments.map((i) => (
                  <tr key={i.symbol}>
                    <td className="num font-semibold text-ink">{i.symbol}</td>
                    <td className="text-ink-2">{label(i.type)}</td>
                    <td>
                      <span className={`state ${i.is_active ? "state-open" : "state-off"}`}>{i.is_active ? "Allowed" : "Off"}</span>
                    </td>
                    <td className="num text-ink-2">{fmtNum(i.spread_markup)}</td>
                    <td className="num text-ink-2">{fmtNum(i.commission_per_lot)}</td>
                    <td className="num text-ink-2">{fmtNum(i.swap_long)}</td>
                    <td className="num text-ink-2">{fmtNum(i.swap_short)}</td>
                    <td className="num whitespace-nowrap text-ink-2">
                      {fmtNum(i.min_lot)} to {fmtNum(i.max_lot)}
                    </td>
                    <td className="text-ink-2">{label(i.routing_mode)}</td>
                    <td className="text-ink-2">{i.enforce_sessions ? i.session_hours || "Enforced" : "Not enforced"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {manages && (
            <div className="mt-13 border-t border-line pt-13">
              <p className="text-sm font-semibold text-ink">Change a symbol</p>
              <p className="mt-3 text-xs text-ink-3">One value at a time; each change is recorded here and on the terminal. A change applies to orders placed after it.</p>
              {instruments.map((i) => (
                <details key={i.symbol} className="mt-8 border-t border-line pt-8" open={focus === i.symbol}>
                  <summary className="cursor-pointer text-sm text-ink">
                    <span className="num font-semibold">{i.symbol}</span> <span className="text-ink-3">{i.description ?? ""}</span>
                  </summary>
                  <div className="mt-13 grid gap-13 sm:grid-cols-2 xl:grid-cols-3">
                    {FIELDS.map((f) => (
                      <FieldForm key={f} symbol={i.symbol} field={f} value={i[f]} />
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </Section>
  );
}

/** Windows in which a symbol, or everything, cannot be traded. */
export function BlocksSection({ blocks, symbols, manages }: { blocks: TradingBlock[] | null; symbols: string[]; manages: boolean }) {
  return (
    <Section title="Trading blocks" aside="Current and upcoming">
      {!blocks ? (
        <Empty title="The terminal did not answer" />
      ) : blocks.length === 0 ? (
        <p className="text-sm text-ink-2">No block is in force or scheduled.</p>
      ) : (
        <ul>
          {blocks.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-13 border-b border-line py-8 last:border-b-0">
              <span className="text-sm text-ink">
                <span className="num font-semibold">{b.symbol ?? "All symbols"}</span> · {b.reason}
                <span className="block text-xs text-ink-3">
                  <span className="num">{fmtDateTime(b.starts_at)}</span> to <span className="num">{fmtDateTime(b.ends_at)}</span>
                  {b.created_by ? ` · set by ${b.created_by}` : ""}
                </span>
              </span>
              {manages && (
                <form action={endTradingBlock}>
                  <input type="hidden" name="id" value={b.id} />
                  <SubmitButton pending="Recording…" className="btn btn-ghost btn-sm">
                    End it now
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {manages && (
        <details className="mt-13 border-t border-line pt-13">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Add a trading block</summary>
          <form action={addTradingBlock} className="mt-13 grid gap-13 sm:grid-cols-2 xl:grid-cols-4">
            <div className="field">
              <label htmlFor="tb-symbol">Symbol</label>
              <select id="tb-symbol" name="symbol" className="select" defaultValue="">
                <option value="">All symbols</option>
                {symbols.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="tb-starts">Starts (UTC)</label>
              <input id="tb-starts" name="starts" type="datetime-local" className="input" required />
            </div>
            <div className="field">
              <label htmlFor="tb-ends">Ends (UTC)</label>
              <input id="tb-ends" name="ends" type="datetime-local" className="input" required aria-describedby="tb-ends-hint" />
              <p id="tb-ends-hint" className="field-hint">
                At most 14 days after the start
              </p>
            </div>
            <div className="field">
              <label htmlFor="tb-reason">Reason (traders see it)</label>
              <input id="tb-reason" name="reason" type="text" className="input" required minLength={3} maxLength={160} autoComplete="off" />
            </div>
            <div>
              <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
                Add the block
              </SubmitButton>
            </div>
          </form>
        </details>
      )}
    </Section>
  );
}

export function TerminalAuditSection({ rows }: { rows: TerminalAudit[] | null }) {
  if (!rows || rows.length === 0) return null;
  return (
    <Section title="Latest changes on the terminal" aside="Its own record, newest first">
      <ul>
        {rows.map((r, i) => (
          <li key={`${r.changed_at}-${i}`} className="border-b border-line py-8 text-sm last:border-b-0">
            <span className="num font-semibold text-ink">{r.symbol}</span> <span className="text-ink-2">{label(r.field)}</span>: <span className="num text-ink-3">{r.old_value ?? "–"}</span> →{" "}
            <span className="num text-ink">{r.new_value ?? "–"}</span>
            <span className="block text-xs text-ink-3">
              {r.actor} · <span className="num">{fmtDateTime(r.changed_at)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function TerminalUnconfigured() {
  return (
    <div className="mt-21">
      <Notice title="The trading terminal is not connected here">
        Per-symbol settings and trading blocks are held by the terminal. Set <span className="num">RAPTOR_BRIDGE_URL</span> and <span className="num">RAPTOR_BRIDGE_SERVICE_KEY</span> in the hosting environment (the same two values the
        portal’s deployment has), then redeploy.
      </Notice>
    </div>
  );
}

/** Enter a closed trade by hand. */
export function RecordTradeForm({ accounts }: { accounts: { id: string; label: string }[] }) {
  return (
    <Section title="Enter a trade by hand" aside="Recorded in the audit log with your name">
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-ink">Enter a closed trade</summary>
        <p className="mt-8 max-w-measure text-xs text-ink-3">
          For a correction, or a trade the platform did not deliver. It is written as a closed trade marked “manual”: the portal then charges the per-lot commission and pays IB rebates on it as it does for any trade. It cannot be edited or removed
          afterwards.
        </p>
        <form action={recordTrade} className="mt-13 grid gap-13 sm:grid-cols-2 xl:grid-cols-4">
          <div className="field sm:col-span-2">
            <label htmlFor="rt-account">Trading account</label>
            <select id="rt-account" name="account" className="select" required defaultValue="">
              <option value="" disabled>
                Choose an account
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rt-symbol">Symbol</label>
            <input id="rt-symbol" name="symbol" type="text" className="input" required pattern="[A-Za-z0-9._]{3,20}" maxLength={20} autoComplete="off" spellCheck={false} />
          </div>
          <div className="field">
            <label htmlFor="rt-side">Side</label>
            <select id="rt-side" name="side" className="select" required defaultValue="buy">
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
          {(
            [
              ["lots", "Lots"],
              ["open", "Open price"],
              ["close", "Close price"],
              ["pnl", "Profit or loss (minus for a loss)"],
            ] as const
          ).map(([name, text]) => (
            <div key={name} className="field">
              <label htmlFor={`rt-${name}`}>{text}</label>
              <input id={`rt-${name}`} name={name} type="text" inputMode="decimal" className="input" required autoComplete="off" />
            </div>
          ))}
          <div className="field">
            <label htmlFor="rt-ticket">Ticket (optional)</label>
            <input id="rt-ticket" name="ticket" type="text" inputMode="numeric" pattern="[0-9]{1,15}" className="input" autoComplete="off" />
          </div>
          <div className="sm:col-span-2 xl:col-span-4">
            <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
              Record the trade
            </SubmitButton>
          </div>
        </form>
      </details>
    </Section>
  );
}

const AUDIENCE_LABEL: Record<string, string> = {
  clients_active: "Every active client",
  ibs_active: "Every active introducing broker and affiliate",
  kyc_incomplete: "Active clients whose verification is not approved",
};

/** Compose one service message to one fixed audience. */
export function EmailComposer({ ready, counts, chosen }: { ready: boolean; counts: Record<string, number | null>; chosen: string }) {
  if (!ready) {
    return (
      <div className="mt-21">
        <Notice title="Sending is not set up yet">
          No e-mail provider is configured, so nothing can be sent and nothing is queued. To switch it on, verify a sending domain with Resend and set <span className="num">RESEND_API_KEY</span> and <span className="num">RESEND_FROM_EMAIL</span> in
          the hosting environment, then redeploy.
        </Notice>
      </div>
    );
  }
  return (
    <Section title="Send a service message" aside="Recorded in the audit log with your name">
      <p className="max-w-measure text-xs text-ink-3">
        For notices clients need because they hold an account: maintenance, a change to conditions, a reminder to finish verification. It is not for promotion: clients have not been asked whether they want marketing e-mail. Each person receives
        their own copy and cannot see anyone else’s address.
      </p>
      <form action={sendServiceEmail} className="mt-13 grid gap-13">
        <div className="field">
          <label htmlFor="em-audience">To</label>
          <select id="em-audience" name="audience" className="select" required defaultValue={chosen || "clients_active"}>
            {Object.entries(AUDIENCE_LABEL).map(([value, text]) => (
              <option key={value} value={value}>
                {text} ({counts[value] === null || counts[value] === undefined ? "count unavailable" : `${counts[value]} now`})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="em-subject">Subject</label>
          <input id="em-subject" name="subject" type="text" className="input" required minLength={5} maxLength={150} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="em-body">Message</label>
          <textarea id="em-body" name="body" className="textarea" rows={10} required minLength={20} maxLength={10000} aria-describedby="em-body-hint" />
          <p id="em-body-hint" className="field-hint">
            Plain text. A blank line starts a new paragraph. Links are sent as you type them.
          </p>
        </div>
        <div className="field">
          <label htmlFor="em-confirm">Type the number of recipients to confirm</label>
          <input id="em-confirm" name="confirm" type="text" inputMode="numeric" pattern="[0-9]{1,5}" className="input" required autoComplete="off" aria-describedby="em-confirm-hint" />
          <p id="em-confirm-hint" className="field-hint">
            The number shown beside the audience you chose. If it has changed since the page loaded, you will be asked again.
          </p>
        </div>
        <div>
          <SubmitButton pending="Sending…" className="btn btn-primary btn-sm">
            Send
          </SubmitButton>
        </div>
      </form>
    </Section>
  );
}

const DONE: Record<string, string> = {
  symbol: "Symbol changed. The change is recorded here and on the terminal.",
  block: "Trading block added.",
  blockended: "Trading block ended.",
  recorded: "Trade recorded. It is in the audit log with your name.",
  sent: "Sent. The audit log has the audience, the subject and the count.",
};

const REFUSED: Record<string, { title: string; body: string }> = {
  forbidden: { title: "Your role does not include this", body: "Nothing was changed." },
  unconfigured: { title: "The portal’s database is not connected", body: "Nothing was changed." },
  terminal: { title: "The trading terminal did not accept that", body: "It is not connected, or it refused the change. Nothing is assumed to have changed: check the table before trying again." },
  invalid: { title: "That request was not understood", body: "Nothing was changed. Reload the page and try again." },
  value: { title: "A value was not accepted", body: "Nothing was changed. Check that numbers are within their limits and required fields are filled in." },
  block: { title: "That block was not accepted", body: "Nothing was changed. It needs a reason, an end after its start and still in the future, and a length of at most 14 days." },
  missing: { title: "That record no longer exists", body: "Nothing was changed." },
  audit: { title: "The change could not be recorded, so it was not made", body: "Nothing was changed. Try again in a moment." },
  account: { title: "That trading account is not active", body: "Nothing was recorded." },
  duplicate: { title: "A trade with that ticket already exists", body: "Nothing was recorded." },
  portal: { title: "The portal did not accept that", body: "The attempt is recorded in the audit log." },
  mailer: { title: "Sending is not set up", body: "Nothing was sent." },
  nobody: { title: "Nobody is in that audience", body: "Nothing was sent." },
  confirm: { title: "The number of recipients did not match", body: "Nothing was sent. Type the number shown beside the audience." },
  partial: { title: "Only some messages were accepted by the provider", body: "The record of the send below shows how many. Do not send again without checking it: the first ones have gone." },
  provider: { title: "The provider refused the send", body: "Nothing was sent. The attempt is recorded." },
};

export function TerminalNotice({ notice, error }: { notice: string; error: string }) {
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

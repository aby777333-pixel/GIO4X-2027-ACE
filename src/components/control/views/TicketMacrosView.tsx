import Link from "next/link";
import { saveMacro, setMacroActive } from "@/app/control/actions-ticket-tools";
import { ControlHead, Empty, Notice } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { SubmitButton } from "@/components/control/SubmitButton";
import { MACRO_BODY_MAX, MACRO_TITLE_MAX } from "@/components/control/ticket-tools";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABEL, TICKET_PRIORITIES, TICKET_PRIORITY_LABEL, TICKET_STATUSES, TICKET_STATUS_LABEL } from "@/lib/server/constants";
import type { TicketMacroRow } from "@/lib/supabase/types";

export type TicketMacrosViewProps = {
  /** active first, then by title */
  macros: TicketMacroRow[];
  failed: boolean;
  /** the canned reply being changed, or null for "add a new one" */
  editing: TicketMacroRow | null;
  names: Map<string, string>;
  me: string;
  notice?: string;
  error?: string;
};

/** What a canned reply offers to set, in words. Empty when it only carries text. */
function offers(macro: Pick<TicketMacroRow, "set_status" | "set_priority" | "set_category">): string[] {
  return [
    macro.set_status ? `status to ${TICKET_STATUS_LABEL[macro.set_status]}` : "",
    macro.set_priority ? `priority to ${TICKET_PRIORITY_LABEL[macro.set_priority]}` : "",
    macro.set_category ? `category to ${TICKET_CATEGORY_LABEL[macro.set_category]}` : "",
  ].filter(Boolean);
}

/**
 * Presentation only: the canned replies, and one form that adds a new one or
 * changes the one chosen with "Edit". The page has already checked
 * tickets.manage; the actions check it again and the database decides.
 */
export function TicketMacrosView({ macros, failed, editing, names, me, notice, error }: TicketMacrosViewProps) {
  const who = (userId: string | null) => (!userId ? "the database" : userId === me ? "you" : (names.get(userId) ?? "a former member of staff"));
  const activeCount = macros.filter((m) => m.active).length;

  return (
    <>
      <p className="text-xs text-ink-3">
        <Link href="/control/tickets" className="link-quiet">
          Tickets
        </Link>
        <span aria-hidden className="mx-8 inline-block h-px w-8 bg-line-strong align-middle" />
        <span className="text-ink-2">Canned replies</span>
      </p>

      <div className="mt-13">
        <ControlHead
          title="Canned replies"
          lead="Starting texts for replies that are written often. On a ticket, “Insert a canned reply” puts one in the reply box for the person replying to read, change and send."
          actions={
            <Link href="/control/tickets/rules" className="btn btn-ghost">
              Assignment rules
            </Link>
          }
        />
      </div>

      <div className="mt-21 grid gap-13">
        {notice && !error && <Notice title={notice} tone="ok" />}
        {error && <Notice title={error} tone="error" />}
        <Notice title="A canned reply is never sent by itself">
          It only fills the reply box. The customer sees what the member of staff sends, after reading it. A change here does not alter replies already sent.
        </Notice>
      </div>

      <div className="mt-21 grid gap-21 lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="macros-list" className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-3">
            <h2 id="macros-list" className="h4">
              All canned replies
            </h2>
            {!failed && macros.length > 0 && (
              <p className="num text-xs text-ink-3">
                {activeCount} in use · {macros.length - activeCount} retired
              </p>
            )}
          </div>

          {failed ? (
            <div className="mt-13">
              <Notice title="The canned replies could not be read" tone="error">
                The database did not answer. Reload the page; if this continues, check that migration 0013 has been applied.
              </Notice>
            </div>
          ) : macros.length ? (
            <ul className="mt-13 grid gap-13">
              {macros.map((macro) => {
                const sets = offers(macro);
                return (
                  <li key={macro.id} className={`gxc-card min-w-0 px-21 py-13 ${macro.active ? "" : "opacity-80"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-x-13 gap-y-5">
                      <h3 className="min-w-0 break-words text-sm font-semibold text-ink">{macro.title}</h3>
                      <span className={`state whitespace-nowrap ${macro.active ? "state-open" : "state-off"}`}>{macro.active ? "In use" : "Retired"}</span>
                    </div>
                    {/* the start of the text, as typed: placeholders are shown as placeholders */}
                    <p className="mt-8 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-2">{macro.body}</p>
                    <p className="mt-8 text-xs text-ink-3">
                      {sets.length ? <>Also offers to set {sets.join(", ")}.</> : <>Text only: it offers no change to the ticket.</>} <span className="num">{macro.body.length}</span> characters.
                    </p>
                    <div className="mt-13 flex flex-wrap items-center justify-between gap-x-13 gap-y-8 border-t border-line pt-8">
                      <p className="text-xs text-ink-3">
                        Last changed <span className="num">{fmtDateTime(macro.updated_at)}</span> by {who(macro.updated_by ?? macro.created_by)}
                      </p>
                      <div className="flex flex-wrap items-center gap-8">
                        <Link href={`/control/tickets/macros?edit=${macro.id}#editor`} className="btn btn-ghost btn-sm">
                          Edit<span className="sr-only"> {macro.title}</span>
                        </Link>
                        <form action={setMacroActive}>
                          <input type="hidden" name="id" value={macro.id} />
                          <input type="hidden" name="active" value={macro.active ? "0" : "1"} />
                          <SubmitButton pending="Saving…" className="btn btn-quiet btn-sm">
                            {macro.active ? "Retire" : "Bring back"}
                            <span className="sr-only"> {macro.title}</span>
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title="No canned replies yet">
              <p>Nothing has been written. Add the first one with the form on this page; it appears in the reply form on every ticket as soon as it is saved.</p>
            </Empty>
          )}
          {!failed && macros.length > 0 && (
            <p className="mt-13 max-w-measure text-xs text-ink-3">
              A retired canned reply is no longer offered on tickets. Nothing is deleted, so it can be brought back. Creating, editing and retiring are recorded in the audit log by title; the text itself is never recorded there.
            </p>
          )}
        </section>

        <section id="editor" aria-labelledby="macro-editor" className="gxc-card min-w-0 scroll-mt-34">
          <div className="gxc-card-head">
            <h2 id="macro-editor" className="gxc-card-title">
              {editing ? "Edit canned reply" : "Add a canned reply"}
            </h2>
            {editing && (
              <Link href="/control/tickets/macros" className="gxc-card-link">
                Add a new one instead
              </Link>
            )}
          </div>
          {/* keyed, so that choosing another one to edit refills the fields */}
          <form key={editing?.id ?? "new"} action={saveMacro} className="gxc-card-body grid gap-13">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="field">
              <label htmlFor="macro-title">Title</label>
              <input id="macro-title" name="title" type="text" className="input" defaultValue={editing?.title ?? ""} maxLength={MACRO_TITLE_MAX} required autoComplete="off" aria-describedby="macro-title-hint" />
              <p id="macro-title-hint" className="field-hint">
                What staff see in the list on a ticket. The customer never sees it. Up to {MACRO_TITLE_MAX} characters.
              </p>
            </div>
            <div className="field">
              <label htmlFor="macro-body">Text</label>
              <textarea id="macro-body" name="body" className="textarea" rows={10} defaultValue={editing?.body ?? ""} maxLength={MACRO_BODY_MAX} required aria-describedby="macro-body-hint" />
              <p id="macro-body-hint" className="field-hint">
                Up to 5,000 characters, the same as a reply. Two placeholders are filled in when it is inserted: <code className="num">{"{{name}}"}</code> becomes the requester’s name and <code className="num">{"{{reference}}"}</code> the
                ticket’s reference. Anything else in braces is left exactly as typed. Never include passwords, card numbers or one-time codes.
              </p>
            </div>

            <fieldset className="grid gap-13 border-t border-line pt-13">
              <legend className="field-label">Changes offered with it (optional)</legend>
              <p className="text-xs text-ink-3">Each one appears on the ticket as a ticked box, “Also set …”, which the person replying can untick. It is applied only when they send the reply.</p>
              <div className="field">
                <label htmlFor="macro-status">Status</label>
                <select id="macro-status" name="set_status" className="select" defaultValue={editing?.set_status ?? ""}>
                  <option value="">Leave the status as it is</option>
                  {TICKET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      Set to {TICKET_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="macro-priority">Priority</label>
                <select id="macro-priority" name="set_priority" className="select" defaultValue={editing?.set_priority ?? ""}>
                  <option value="">Leave the priority as it is</option>
                  {TICKET_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      Set to {TICKET_PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="macro-category">Category</label>
                <select id="macro-category" name="set_category" className="select" defaultValue={editing?.set_category ?? ""}>
                  <option value="">Leave the category as it is</option>
                  {TICKET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      Set to {TICKET_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-8">
              <SubmitButton pending="Saving…">{editing ? "Save changes" : "Add canned reply"}</SubmitButton>
              {editing && (
                <Link href="/control/tickets/macros" className="btn btn-quiet">
                  Cancel
                </Link>
              )}
            </div>
            {editing && !editing.active && <p className="text-xs text-ink-3">This canned reply is retired. Saving changes does not bring it back: use “Bring back” in the list.</p>}
          </form>
        </section>
      </div>
    </>
  );
}

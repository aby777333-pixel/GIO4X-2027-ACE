"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { sendTicketReply } from "@/app/control/actions-ticket-tools";
import { SubmitButton } from "@/components/control/SubmitButton";
import { fillMacro, MACRO_BODY_MAX, type MacroOption } from "@/components/control/ticket-tools";
import { TICKET_CATEGORY_LABEL, TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL } from "@/lib/server/constants";
import type { TicketCategory, TicketPriority, TicketStatus } from "@/lib/supabase/types";

export type TicketReplyFormProps = {
  ticketId: string;
  /** the requester's name and the ticket's reference: what {{name}} and {{reference}} become */
  name: string;
  reference: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  assigned: boolean;
  /** active canned replies; empty when there are none */
  macros: MacroOption[];
  /** the canned replies could not be read (for example, the migration is not applied): the form still works without them */
  macrosFailed: boolean;
  /** may manage canned replies (tickets.manage): shown the way to the management screen */
  manage: boolean;
};

type Offer = { key: number; title: string; status: TicketStatus | null; priority: TicketPriority | null; category: TicketCategory | null };

/**
 * The reply box on a ticket, with "Insert a canned reply".
 *
 * A canned reply is a starting text and nothing more. Choosing one and
 * pressing Insert writes it into the box, with {{name}} and {{reference}}
 * filled in here in the browser; the person then reads it, changes it and
 * sends it with the same button as any other reply. Nothing is sent by
 * inserting. If the canned reply carries changes (status, priority,
 * category), they appear as tick boxes, ticked, and travel with the reply only
 * if they are still ticked when it is sent.
 *
 * The box itself is left uncontrolled, as it was before this component: React
 * clears it once the reply has been sent. The only state kept here is which
 * canned reply is selected and what it offered.
 */
export function TicketReplyForm({ ticketId, name, reference, status, priority, category, assigned, macros, macrosFailed, manage }: TicketReplyFormProps) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [picked, setPicked] = useState("");
  const [offer, setOffer] = useState<Offer | null>(null);
  const [said, setSaid] = useState<{ text: string; bad: boolean } | null>(null);
  const closed = status === "closed";

  function insert() {
    const macro = macros.find((m) => m.id === picked);
    const el = box.current;
    if (!macro || !el) return;

    const text = fillMacro(macro.body, { name, reference });
    // never overwrite what has been typed: a canned reply goes after it
    const before = el.value.replace(/\s+$/, "");
    const next = before ? `${before}\n\n${text}` : text;
    if (next.length > MACRO_BODY_MAX) {
      setSaid({ text: `“${macro.title}” was not inserted: with it the reply would be longer than 5,000 characters.`, bad: true });
      return;
    }
    el.value = next;
    el.focus();
    el.setSelectionRange(next.length, next.length);

    // Offer only what would change something. A reply already moves an open
    // ticket to "waiting for customer", so that is not offered a second time.
    const offerStatus = macro.set_status && macro.set_status !== status && !(macro.set_status === "pending" && status === "open") ? macro.set_status : null;
    const offerPriority = macro.set_priority && macro.set_priority !== priority ? macro.set_priority : null;
    const offerCategory = macro.set_category && macro.set_category !== category ? macro.set_category : null;
    setOffer(offerStatus || offerPriority || offerCategory ? { key: Date.now(), title: macro.title, status: offerStatus, priority: offerPriority, category: offerCategory } : null);
    setSaid({ text: `“${macro.title}” was ${before ? "added after your text" : "put in the reply box"}. Read it and change it before you send it.`, bad: false });
    setPicked("");
  }

  return (
    <form action={sendTicketReply} className="gxc-card-body grid gap-13">
      <input type="hidden" name="id" value={ticketId} />

      {macros.length > 0 ? (
        <div className="field">
          <label htmlFor="reply-macro">Insert a canned reply</label>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-8">
            <select id="reply-macro" className="select" value={picked} onChange={(e) => setPicked(e.target.value)} aria-describedby="reply-macro-hint">
              <option value="">Choose one…</option>
              {macros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-ghost" onClick={insert} disabled={!picked} aria-disabled={!picked}>
              Insert
            </button>
          </div>
          <p id="reply-macro-hint" className="field-hint">
            A starting text, with this customer’s name and reference filled in. It goes into the box below for you to read and change: nothing is sent until you press “Send reply to the customer”.
            {manage && (
              <>
                {" "}
                <Link href="/control/tickets/macros" className="link">
                  Manage canned replies
                </Link>
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="text-xs text-ink-3">
          {macrosFailed ? "The canned replies could not be read just now. You can still write a reply." : "There are no canned replies yet."}
          {manage && !macrosFailed && (
            <>
              {" "}
              <Link href="/control/tickets/macros" className="link">
                Write the first one
              </Link>
            </>
          )}
        </p>
      )}

      {/* what Insert just did, for someone who cannot see the box change */}
      <p role="status" aria-live="polite" className={`text-xs empty:hidden ${said?.bad ? "font-semibold text-neg" : "text-ink-2"}`}>
        {said?.text}
      </p>

      <div className="field">
        <label htmlFor="reply-body">Your reply to {name}</label>
        <textarea ref={box} id="reply-body" name="body" className="textarea" rows={6} maxLength={MACRO_BODY_MAX} required aria-describedby="reply-hint" />
        <p id="reply-hint" className="field-hint">
          Shown on the website without your name. Up to 5,000 characters. Never ask for or include passwords, card numbers or one-time codes.
          {status === "open" && (
            <>
              {" "}
              Sending it moves this ticket to {TICKET_STATUS_LABEL.pending}
              {assigned ? "" : " and assigns it to you"}.
            </>
          )}
          {closed && <> This ticket is closed: the customer can read your reply but cannot answer it. Reopen the ticket first if you expect an answer.</>}
        </p>
      </div>

      {offer && (
        <fieldset key={offer.key} className="grid gap-8 rounded-[12px] border border-line px-13 py-13">
          <legend className="px-5 text-xs font-semibold text-ink-2">“{offer.title}” also offers, when the reply is sent</legend>
          {offer.status && (
            <label className="check">
              <input type="checkbox" name="apply_status" value={offer.status} defaultChecked />
              <span>
                Also set status to <span className="font-medium text-ink">{TICKET_STATUS_LABEL[offer.status]}</span>
              </span>
            </label>
          )}
          {offer.priority && (
            <label className="check">
              <input type="checkbox" name="apply_priority" value={offer.priority} defaultChecked />
              <span>
                Also set priority to <span className="font-medium text-ink">{TICKET_PRIORITY_LABEL[offer.priority]}</span>
              </span>
            </label>
          )}
          {offer.category && (
            <label className="check">
              <input type="checkbox" name="apply_category" value={offer.category} defaultChecked />
              <span>
                Also set category to <span className="font-medium text-ink">{TICKET_CATEGORY_LABEL[offer.category]}</span>
              </span>
            </label>
          )}
          <p className="text-xs text-ink-3">Untick anything you do not want. Each change is recorded with your name, exactly as if you had made it under Triage.</p>
        </fieldset>
      )}

      <div>
        <SubmitButton pending="Sending…">Send reply to the customer</SubmitButton>
      </div>
    </form>
  );
}

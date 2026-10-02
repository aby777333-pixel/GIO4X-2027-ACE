"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Rosette } from "@/components/brand/Rosette";
import { normaliseTicketReference } from "@/lib/support";
import type { TicketPublicView, TicketStatus } from "@/lib/supabase/types";
import { EMAIL_RE, readTicket, replyToTicket } from "./api";
import { useSupportDesk, type CategoryOption } from "./SupportDesk";

/** Customer-facing wording. The shape of the dot differs with the state, so colour is never the only cue. */
const STATUS: Record<TicketStatus, { label: string; tone: string }> = {
  open: { label: "We are working on it", tone: "state-overlap" },
  pending: { label: "We have replied and are waiting for you", tone: "state-pre" },
  solved: { label: "Marked as solved", tone: "state-open" },
  closed: { label: "Closed", tone: "state-off" },
};

const REPLY_MAX = 4000;

type Pair = { reference: string; email: string };
type LookupErrors = Partial<Record<"reference" | "email", string>>;
type Lookup = { kind: "idle" } | { kind: "loading" } | { kind: "failed"; error: string };
type Reply = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "failed"; error: string };

const UNREACHABLE = "The request could not be read just now. Please try again shortly.";

/** The visitor's own clock, with the zone named so the time cannot be misread. */
function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(d);
}

function Entry({ from, at, body }: { from: "customer" | "staff"; at: string; body: string }) {
  const staff = from === "staff";
  return (
    <li className={`border-l-2 pl-13 sm:pl-21 ${staff ? "border-accent" : "border-line-strong"}`}>
      <p className="flex flex-wrap items-baseline gap-x-13 gap-y-3">
        <span className={`label ${staff ? "text-accent" : ""}`}>{staff ? "GIO4X Support" : "You"}</span>
        <time dateTime={at} className="num text-xs text-ink-3">
          {when(at)}
        </time>
      </p>
      <p className="mt-5 max-w-measure whitespace-pre-line text-ink-2 [overflow-wrap:anywhere]">{body}</p>
    </li>
  );
}

/**
 * Reads a support request back to the person who opened it, and lets them
 * answer. The reference and the address are held in component state for the
 * visit and sent in request bodies only: never in the address bar, never in
 * storage. A wrong reference and a wrong address get the same single message.
 */
export function CheckRequest({ categories }: { categories: CategoryOption[] }) {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const { handoff } = useSupportDesk();
  const [v, setV] = useState<Pair>({ reference: "", email: "" });
  const [errors, setErrors] = useState<LookupErrors>({});
  const [lookup, setLookup] = useState<Lookup>({ kind: "idle" });
  /** the pair the shown ticket was read with: what a reply or a refresh sends */
  const [pair, setPair] = useState<Pair | null>(null);
  const [ticket, setTicket] = useState<TicketPublicView | null>(null);
  const [body, setBody] = useState("");
  const [bodyError, setBodyError] = useState("");
  const [reply, setReply] = useState<Reply>({ kind: "idle" });
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  // a request opened a moment ago on this page: fill the two fields, unless a ticket is being read
  useEffect(() => {
    if (handoff && !ticket) {
      setV({ reference: handoff.reference, email: handoff.email });
      setErrors({});
      setLookup({ kind: "idle" });
    }
    // only a new handoff should refill the fields, not every change to the shown ticket
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff]);

  useEffect(() => {
    if (lookup.kind === "failed") alertRef.current?.focus();
  }, [lookup]);

  const shown = ticket?.reference;
  useEffect(() => {
    if (shown) headRef.current?.focus();
  }, [shown]);

  const set = (k: keyof Pair, value: string) => {
    setV((s) => ({ ...s, [k]: value }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function onLookup(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy.current) return;
    const found: LookupErrors = {};
    const reference = normaliseTicketReference(v.reference);
    const email = v.email.trim();
    if (!v.reference.trim()) found.reference = "Please enter the reference you were shown.";
    else if (!reference) found.reference = "A reference is TK- followed by eight letters and digits, for example TK-ABCD2345.";
    if (!email) found.email = "Please enter the email address you gave.";
    else if (!EMAIL_RE.test(email)) found.email = "That does not look like an email address. Check for a missing @ or domain.";
    setErrors(found);
    if (found.reference || found.email || !reference) {
      formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id(found.reference ? "reference" : "email"))}`)?.focus();
      return;
    }

    busy.current = true;
    setLookup({ kind: "loading" });
    const result = await readTicket(reference, email);
    busy.current = false;
    if (result.ok) {
      setPair({ reference, email });
      setTicket(result.ticket);
      setBody("");
      setBodyError("");
      setReply({ kind: "idle" });
      setLookup({ kind: "idle" });
      return;
    }
    if (result.kind === "fields") {
      const mapped: LookupErrors = {};
      if (result.fields.reference) mapped.reference = result.fields.reference;
      if (result.fields.email) mapped.email = result.fields.email;
      if (mapped.reference || mapped.email) {
        setErrors(mapped);
        setLookup({ kind: "idle" });
        return;
      }
    }
    setLookup({ kind: "failed", error: result.error ?? UNREACHABLE });
  }

  async function onRefresh() {
    if (busy.current || !pair) return;
    busy.current = true;
    setRefreshing(true);
    const result = await readTicket(pair.reference, pair.email);
    busy.current = false;
    setRefreshing(false);
    if (result.ok) {
      setTicket(result.ticket);
      setReply({ kind: "idle" });
      return;
    }
    setReply({ kind: "failed", error: result.error ?? UNREACHABLE });
  }

  async function onReply(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy.current || !pair) return;
    const text = body.trim();
    if (!text) {
      setBodyError("Please write your reply.");
      return;
    }
    busy.current = true;
    setBodyError("");
    setReply({ kind: "sending" });
    const result = await replyToTicket(pair.reference, pair.email, text);
    if (result.ok) {
      // the reply is stored: show the thread as it now stands
      let next = result.ticket;
      if (!next) {
        const again = await readTicket(pair.reference, pair.email);
        if (again.ok) next = again.ticket;
      }
      busy.current = false;
      if (next) setTicket(next);
      setBody("");
      setReply({ kind: "sent" });
      return;
    }
    busy.current = false;
    if (result.kind === "fields" && result.fields.body) {
      setBodyError(result.fields.body);
      setReply({ kind: "idle" });
      return;
    }
    if (result.kind === "closed") {
      // closed while this page was open: show it as it is now
      setTicket((t) => (t ? { ...t, status: "closed" } : t));
      setReply({ kind: "idle" });
      return;
    }
    setReply({ kind: "failed", error: result.error ?? "Your reply could not be sent just now. It is still in the box above. Please try again shortly." });
  }

  function leave() {
    setTicket(null);
    setPair(null);
    setBody("");
    setBodyError("");
    setReply({ kind: "idle" });
    setLookup({ kind: "idle" });
    setV({ reference: "", email: "" });
  }

  /* ------------------------------------------------------------------ thread */
  if (ticket) {
    const status = STATUS[ticket.status];
    const about = categories.find((c) => c.key === ticket.category)?.label ?? "";
    const closed = ticket.status === "closed";
    const sending = reply.kind === "sending";

    return (
      <div className="panel p-21 sm:p-34">
        <div className="flex flex-wrap items-start justify-between gap-x-21 gap-y-8">
          <p className="label">
            Request <span className="num text-ink">{ticket.reference}</span>
          </p>
          <p className={`state ${status.tone} whitespace-normal text-left`} role="status">
            {status.label}
          </p>
        </div>
        <h3 ref={headRef} tabIndex={-1} className="h3 mt-13 max-w-measure [overflow-wrap:anywhere] focus:outline-none">
          {ticket.subject}
        </h3>
        <dl className="mt-13 flex flex-wrap gap-x-34 gap-y-8 text-sm">
          <div>
            <dt className="label">Opened</dt>
            <dd className="num mt-3 text-ink-2">
              <time dateTime={ticket.created_at}>{when(ticket.created_at)}</time>
            </dd>
          </div>
          {about && (
            <div>
              <dt className="label">About</dt>
              <dd className="mt-3 text-ink-2">{about}</dd>
            </div>
          )}
        </dl>

        <h4 className="sr-only">Messages</h4>
        <ol className="mt-21 grid gap-21 border-t border-line pt-21" aria-live="polite">
          <Entry from="customer" at={ticket.created_at} body={ticket.message} />
          {ticket.messages.map((m, i) => (
            <Entry key={`${m.at}-${i}`} from={m.from} at={m.at} body={m.body} />
          ))}
        </ol>
        {!ticket.messages.some((m) => m.from === "staff") && <p className="mt-21 text-sm text-ink-3">There is no reply from GIO4X yet. When we answer, it will appear here.</p>}

        <div className="mt-21 border-t border-line pt-21">
          {closed ? (
            <div>
              <p className="h4">This request is closed.</p>
              <p className="mt-5 max-w-measure text-sm text-ink-2">It takes no more replies. If you still need help, you can open a new request and mention this reference.</p>
              <a href="#open" className="btn btn-ghost mt-13">
                Open a new request
              </a>
            </div>
          ) : (
            <form onSubmit={onReply} noValidate aria-busy={sending}>
              <div className="field">
                <label htmlFor={id("body")}>Your reply</label>
                <textarea id={id("body")} className="textarea" rows={5} maxLength={REPLY_MAX} value={body} onChange={(e) => { setBody(e.target.value); if (bodyError) setBodyError(""); }} aria-invalid={!!bodyError} aria-describedby={`${bodyError ? `${id("body-err")} ` : ""}${id("body-hint")}`} disabled={sending} />
                {bodyError && (
                  <p id={id("body-err")} className="field-error">
                    {bodyError}
                  </p>
                )}
                <p id={id("body-hint")} className="field-hint">
                  {ticket.status === "solved" ? "Replying reopens this request. " : ""}Never share your password or one-time security code in a message.
                </p>
              </div>
              {reply.kind === "failed" && (
                <p role="alert" className="mt-13 rounded-sm border border-neg p-13 text-sm text-ink-2">
                  {reply.error}
                </p>
              )}
              <div className="mt-13 flex flex-wrap items-center gap-x-21 gap-y-13">
                <button type="submit" className="btn btn-primary min-w-[10rem]" disabled={sending}>
                  {sending ? (
                    <>
                      <Rosette size={16} spin strokeWidth={1.5} />
                      Sending
                    </>
                  ) : (
                    "Send reply"
                  )}
                </button>
                <p className="text-xs text-ink-3" role="status" aria-live="polite">
                  {sending ? "Sending your reply…" : reply.kind === "sent" ? "Your reply has been added above." : ""}
                </p>
              </div>
            </form>
          )}
        </div>

        <div className="mt-21 flex flex-wrap gap-13 border-t border-line pt-21">
          <button type="button" className="btn btn-quiet btn-sm" onClick={onRefresh} disabled={refreshing || sending}>
            {refreshing ? "Checking…" : "Check for a new reply"}
          </button>
          <button type="button" className="btn btn-quiet btn-sm" onClick={leave} disabled={sending}>
            Look up another request
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ lookup */
  const loading = lookup.kind === "loading";
  return (
    <form ref={formRef} onSubmit={onLookup} noValidate aria-busy={loading} className="panel p-21 sm:p-34">
      <div className="grid gap-21 sm:grid-cols-2">
        <div className="field">
          <label htmlFor={id("reference")}>Reference</label>
          <input id={id("reference")} className="input num uppercase" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={20} placeholder="TK-" value={v.reference} onChange={(e) => set("reference", e.target.value)} aria-required="true" aria-invalid={!!errors.reference} aria-describedby={errors.reference ? id("reference-err") : undefined} disabled={loading} />
          {errors.reference && (
            <p id={id("reference-err")} className="field-error">
              {errors.reference}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor={id("email")}>Email</label>
          <input id={id("email")} className="input" type="email" inputMode="email" autoComplete="email" maxLength={200} value={v.email} onChange={(e) => set("email", e.target.value)} aria-required="true" aria-invalid={!!errors.email} aria-describedby={errors.email ? id("email-err") : undefined} disabled={loading} />
          {errors.email && (
            <p id={id("email-err")} className="field-error">
              {errors.email}
            </p>
          )}
        </div>
      </div>

      {lookup.kind === "failed" && (
        <div ref={alertRef} tabIndex={-1} role="alert" className="mt-21 rounded-sm border border-neg p-13 text-sm text-ink-2 focus:outline-none sm:p-21">
          {lookup.error}
        </div>
      )}

      <div className="mt-21 flex flex-wrap items-center gap-x-21 gap-y-13">
        <button type="submit" className="btn btn-primary btn-lg min-w-[13rem]" disabled={loading}>
          {loading ? (
            <>
              <Rosette size={16} spin strokeWidth={1.5} />
              Looking
            </>
          ) : (
            "Show my request"
          )}
        </button>
        <p className="text-xs text-ink-3" role="status" aria-live="polite">
          {loading ? "Looking for your request…" : "Both must match the request. Neither is kept in your browser."}
        </p>
      </div>
    </form>
  );
}

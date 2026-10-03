"use client";

import { ReplyLoop } from "@/components/figures/extra/SideFigures";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Rosette } from "@/components/brand/Rosette";
import { EMAIL_RE, openTicket } from "./api";
import { SupportHours } from "./SupportHours";
import { useSupportDesk, type CategoryOption } from "./SupportDesk";

type Values = { name: string; email: string; category: string; subject: string; message: string; privacy: boolean; website: string };
type FieldKey = "category" | "name" | "email" | "subject" | "message" | "privacy";
type Errors = Partial<Record<FieldKey, string>>;
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; reference: string } | { kind: "failed"; error?: string };

const EMPTY: Values = { name: "", email: "", category: "", subject: "", message: "", privacy: false, website: "" };
const SUBJECT_MAX = 160;
const MESSAGE_MAX = 4000;
const ORDER: FieldKey[] = ["category", "name", "email", "subject", "message", "privacy"];

/** maps a server-side field name onto one of ours */
const SERVER_FIELD: Record<string, FieldKey> = { name: "name", email: "email", category: "category", subject: "subject", message: "message", privacyAccepted: "privacy" };

/**
 * Opens a support request. Built as the contact form is: client-validated,
 * posts JSON to /api/support, and keeps everything the visitor typed if
 * sending fails. On success the reference is the thing to keep: this website
 * sends no email, so the reply is read on this page.
 */
export function OpenRequest({ categories, email }: { categories: CategoryOption[]; email: string }) {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const { setHandoff } = useSupportDesk();
  const [v, setV] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const startedAt = useRef<number>(0);
  const busy = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (status.kind === "sent" || status.kind === "failed") resultRef.current?.focus();
  }, [status.kind]);

  const set = <K extends keyof Values>(k: K, value: Values[K]) => {
    setV((s) => ({ ...s, [k]: value }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!categories.some((c) => c.key === v.category)) e.category = "Please choose what the request is about.";
    if (v.name.trim().length < 2) e.name = "Please enter your name.";
    if (!v.email.trim()) e.email = "Please enter your email address.";
    else if (!EMAIL_RE.test(v.email.trim())) e.email = "That does not look like an email address. Check for a missing @ or domain.";
    if (v.subject.trim().length < 3) e.subject = "Please give the request a short subject.";
    const len = v.message.trim().length;
    if (len < 10) e.message = len === 0 ? "Please describe what you need help with." : "A little more detail will help us answer: at least ten characters.";
    else if (len > MESSAGE_MAX) e.message = `Please keep the message under ${MESSAGE_MAX.toLocaleString("en-GB")} characters.`;
    if (!v.privacy) e.privacy = "Please confirm that you have read how your message is handled.";
    return e;
  };

  const focusFirst = (e: Errors) => {
    const first = ORDER.find((k) => e[k]);
    if (first) formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id(first))}`)?.focus();
  };

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy.current) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirst(found);
      return;
    }
    busy.current = true;
    setStatus({ kind: "sending" });
    const address = v.email.trim();
    const result = await openTicket({
      name: v.name.trim(),
      email: address,
      category: v.category,
      subject: v.subject.trim(),
      message: v.message.trim(),
      privacyAccepted: true,
      website: v.website,
      startedAt: startedAt.current,
      page: window.location.pathname,
    });
    busy.current = false;
    if (result.ok) {
      setHandoff({ reference: result.reference, email: address });
      setStatus({ kind: "sent", reference: result.reference });
      return;
    }
    if (result.kind === "fields") {
      const mapped: Errors = {};
      for (const [k, msg] of Object.entries(result.fields)) {
        const key = SERVER_FIELD[k];
        if (key) mapped[key] = msg;
      }
      if (Object.keys(mapped).length) {
        setErrors(mapped);
        setStatus({ kind: "idle" });
        // the fields are disabled while sending: focus once they are enabled again
        window.requestAnimationFrame(() => focusFirst(mapped));
        return;
      }
    }
    setStatus({ kind: "failed", error: result.error });
  }

  if (status.kind === "sent") {
    const about = categories.find((c) => c.key === v.category)?.label ?? "";
    return (
      <div ref={resultRef} tabIndex={-1} role="status" className="panel grid justify-items-start gap-13 p-21 focus:outline-none sm:p-34">
        <Rosette size={34} dna />
        <h3 className="h3">Your request has been received.</h3>
        <div className="mt-8 w-full border-y border-line py-21">
          <p className="label">Your reference</p>
          <p className="num mt-5 select-all break-all text-2xl font-medium tracking-[0.04em] text-ink sm:text-3xl">{status.reference}</p>
        </div>
        <p className="max-w-measure font-medium text-ink">Please keep this reference.</p>
        <p className="max-w-measure text-ink-2">
          With it and your email address (<span className="font-medium text-ink [overflow-wrap:anywhere]">{v.email.trim()}</span>) you can read our reply on this page, under “Check a request”. This website does not send email, so no confirmation and no reply will arrive in your inbox.
        </p>
        <dl className="grid w-full gap-px sm:grid-cols-2">
          <div className="py-8">
            <dt className="label">About</dt>
            <dd className="mt-5 text-ink">{about}</dd>
          </div>
          <div className="py-8 sm:border-l sm:border-line sm:pl-21">
            <dt className="label">Subject</dt>
            <dd className="mt-5 text-ink [overflow-wrap:anywhere]">{v.subject.trim()}</dd>
          </div>
        </dl>
        <p className="text-sm text-ink-3">A genuine reply from GIO4X will never ask for your password or a one-time security code.</p>
        <div className="mt-8 flex flex-wrap gap-13">
          <a href="#check" className="btn btn-primary">
            Check this request
          </a>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setV({ ...EMPTY, name: v.name, email: v.email });
              setErrors({});
              startedAt.current = Date.now();
              setStatus({ kind: "idle" });
            }}
          >
            Open another request
          </button>
        </div>
      </div>
    );
  }

  const sending = status.kind === "sending";
  const count = v.message.length;
  const describe = (k: FieldKey, hint?: boolean) => [errors[k] ? id(`${k}-err`) : null, hint ? id(`${k}-hint`) : null].filter(Boolean).join(" ") || undefined;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={sending} className="panel p-21 sm:p-34">
      <div className="grid gap-21 lg:grid-cols-phi-r lg:gap-34">
        {/* what it is about comes first: it decides who reads the request */}
        <div className="grid content-start gap-21">
          <div className="field">
            <label htmlFor={id("category")}>What is it about?</label>
            <select id={id("category")} className="select" value={v.category} onChange={(e) => set("category", e.target.value)} aria-required="true" aria-invalid={!!errors.category} aria-describedby={describe("category")} disabled={sending}>
              <option value="">Choose one</option>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <p id={id("category-err")} className="field-error">
                {errors.category}
              </p>
            )}
          </div>
          <div className="border-l border-accent pl-13">
            <p className="label">What happens next</p>
            <ol className="mt-5 grid gap-5 text-sm text-ink-2">
              <li>You are shown a reference as soon as the request is received.</li>
              <li>Our reply appears on this page. This website does not send email.</li>
              <li>To read it, come back with the reference and the email address you give here.</li>
            </ol>
          </div>
          <SupportHours />
          {/* this column ended well short of the one beside it: a figure that says what the text says */}
          <div className="max-w-[28rem]">
            <div className="flat rounded-[8px] border border-line bg-surface/60 p-13">
              <ReplyLoop />
            </div>
          </div>
        </div>

        <div className="grid gap-21">
          <div className="grid items-start gap-21 sm:grid-cols-2">
            <div className="field">
              <label htmlFor={id("name")}>Name</label>
              <input id={id("name")} className="input" type="text" autoComplete="name" maxLength={120} value={v.name} onChange={(e) => set("name", e.target.value)} aria-required="true" aria-invalid={!!errors.name} aria-describedby={describe("name")} disabled={sending} />
              {errors.name && (
                <p id={id("name-err")} className="field-error">
                  {errors.name}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor={id("email")}>Email</label>
              <input id={id("email")} className="input" type="email" inputMode="email" autoComplete="email" maxLength={200} value={v.email} onChange={(e) => set("email", e.target.value)} aria-required="true" aria-invalid={!!errors.email} aria-describedby={describe("email", true)} disabled={sending} />
              {errors.email && (
                <p id={id("email-err")} className="field-error">
                  {errors.email}
                </p>
              )}
              <p id={id("email-hint")} className="field-hint">
                You will need this address to read our reply.
              </p>
            </div>
          </div>

          <div className="field">
            <label htmlFor={id("subject")}>Subject</label>
            <input id={id("subject")} className="input" type="text" autoComplete="off" maxLength={SUBJECT_MAX} value={v.subject} onChange={(e) => set("subject", e.target.value)} aria-required="true" aria-invalid={!!errors.subject} aria-describedby={describe("subject")} disabled={sending} />
            {errors.subject && (
              <p id={id("subject-err")} className="field-error">
                {errors.subject}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor={id("message")}>Message</label>
            <textarea id={id("message")} className="textarea" rows={7} maxLength={MESSAGE_MAX} placeholder="What happened, what you expected, and anything that helps us find it (a date, a platform, a page)." value={v.message} onChange={(e) => set("message", e.target.value)} aria-required="true" aria-invalid={!!errors.message} aria-describedby={describe("message", true)} disabled={sending} />
            {errors.message && (
              <p id={id("message-err")} className="field-error">
                {errors.message}
              </p>
            )}
            <p id={id("message-hint")} className="field-hint flex flex-wrap justify-between gap-x-13">
              <span>Never share your password or one-time security code in a message.</span>
              <span className="num" aria-hidden>
                {count.toLocaleString("en-GB")} / {MESSAGE_MAX.toLocaleString("en-GB")}
              </span>
            </p>
          </div>

          {/* honeypot: hidden from people and assistive technology; must stay empty */}
          <div aria-hidden className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden opacity-0">
            <label htmlFor={id("website")}>Website</label>
            <input id={id("website")} name="website" type="text" tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => set("website", e.target.value)} />
          </div>

          <div className="border-t border-line pt-21">
            <label className="check min-h-[2.75rem] content-center">
              <input id={id("privacy")} type="checkbox" checked={v.privacy} onChange={(e) => set("privacy", e.target.checked)} aria-required="true" aria-invalid={!!errors.privacy} aria-describedby={describe("privacy")} disabled={sending} />
              <span>
                I have read the{" "}
                <Link href="/legal/privacy" className="link">
                  Privacy Policy
                </Link>{" "}
                and understand that GIO4X will use these details to answer my message. <span className="text-ink-3">(Required)</span>
              </span>
            </label>
            {errors.privacy && (
              <p id={id("privacy-err")} className="field-error mt-5 pl-34">
                {errors.privacy}
              </p>
            )}
          </div>

          {status.kind === "failed" && (
            <div ref={resultRef} tabIndex={-1} role="alert" className="rounded-sm border border-neg p-13 focus:outline-none sm:p-21">
              <p className="h4">Your request was not sent.</p>
              <p className="mt-5 text-sm text-ink-2">
                {status.error ?? "The form could not reach GIO4X just now."} Nothing you wrote has been lost: it is still in the form above. You can try again, or email{" "}
                <a href={`mailto:${email}`} className="link">
                  {email}
                </a>{" "}
                directly.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-21 gap-y-13">
            <button type="submit" className="btn btn-primary btn-lg min-w-[13rem]" disabled={sending}>
              {sending ? (
                <>
                  <Rosette size={16} spin strokeWidth={1.5} />
                  Sending
                </>
              ) : status.kind === "failed" ? (
                "Try again"
              ) : (
                "Send request"
              )}
            </button>
            <p className="text-xs text-ink-3" role="status" aria-live="polite">
              {sending ? "Sending your request…" : "You will be shown a reference once it is received."}
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}

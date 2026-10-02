"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Rosette } from "@/components/brand/Rosette";
import { SortingRack } from "@/components/figures/company/SortingRack";
import { FigureNote } from "@/components/figures/Figure";
import { EMAIL_RE, PHONE_RE, readUtm, submitContact } from "./submit";

type Topic = {
  key: string;
  /** value sent to the API and shown in the menu */
  label: string;
  /** what helps us answer, shown beside the form */
  include: string;
  /** a page that may answer the question without waiting for a reply */
  first?: { label: string; href: string };
  /** an extra caution for this kind of message */
  caution?: string;
  placeholder: string;
};

export const TOPICS: Topic[] = [
  {
    key: "general",
    label: "General",
    include: "Tell us what you would like to know. If it concerns a particular page, mention which one.",
    first: { label: "Help & FAQ", href: "/faq" },
    placeholder: "What would you like to ask?",
  },
  {
    key: "account",
    label: "Account",
    include: "The email address registered on your account and a description of what you are trying to do. Do not send identity documents through this form.",
    first: { label: "Account types", href: "/trading/accounts" },
    caution: "We will never ask for your password or a one-time code.",
    placeholder: "Describe the account question. Leave out passwords and security codes.",
  },
  {
    key: "raptor",
    label: "Platform: 777 Raptor",
    include: "Whether you are on web, desktop or mobile, what you did, what you expected and what happened instead.",
    first: { label: "Explore 777 Raptor", href: "/platforms/raptor" },
    placeholder: "Which Raptor surface, and what happened?",
  },
  {
    key: "mt5",
    label: "Platform: MetaTrader 5",
    include: "Your device and operating system, the MetaTrader 5 build if you know it, and the exact wording of any message shown.",
    first: { label: "Explore MetaTrader 5", href: "/platforms/metatrader-5" },
    placeholder: "Which device, and what does MetaTrader 5 show?",
  },
  {
    key: "technical",
    label: "Technical",
    include: "The page address, your browser and device, and the steps that lead to the problem.",
    first: { label: "System status", href: "/status" },
    placeholder: "Which page, which browser, and what went wrong?",
  },
  {
    key: "partnership",
    label: "Partnership",
    include: "Who you are, where you operate and the kind of arrangement you have in mind.",
    first: { label: "Introducing Brokers", href: "/partners" },
    placeholder: "Tell us about your business and what you propose.",
  },
  {
    key: "press",
    label: "Press",
    include: "Your publication, your deadline and the question. Brand assets and naming are in the Media Centre.",
    first: { label: "Media Centre", href: "/media" },
    placeholder: "Publication, deadline and question.",
  },
  {
    key: "security",
    label: "Security",
    include: "What you saw and where: the full address of a suspicious page, or the sender and subject of a suspicious message.",
    first: { label: "Verify a GIO4X link", href: "/trust/verify" },
    caution: "If you think your account details have been exposed, change your password first, then write to us.",
    placeholder: "Describe what you saw. Paste the address or sender, not your credentials.",
  },
  {
    key: "privacy",
    label: "Privacy",
    include: "The request you are making about your personal data (for example access, correction or deletion) and the email address it relates to.",
    first: { label: "Privacy Policy", href: "/legal/privacy" },
    placeholder: "What would you like to ask or request about your data?",
  },
  {
    key: "complaint",
    label: "Complaint",
    include: "What happened, when, the account it concerns (the registered email is enough) and the outcome you are asking for. Dates and order references help.",
    first: { label: "Legal & documents", href: "/legal" },
    placeholder: "What happened, when, and what outcome are you asking for?",
  },
];

type Values = { name: string; email: string; phone: string; topic: string; message: string; privacy: boolean; marketing: boolean; website: string };
type FieldKey = "name" | "email" | "phone" | "topic" | "message" | "privacy";
type Errors = Partial<Record<FieldKey, string>>;
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; reference: string } | { kind: "failed"; error?: string };

const EMPTY: Values = { name: "", email: "", phone: "", topic: "general", message: "", privacy: false, marketing: false, website: "" };
const MESSAGE_MAX = 4000;
const ORDER: FieldKey[] = ["name", "email", "phone", "topic", "message", "privacy"];

function validate(v: Values): Errors {
  const e: Errors = {};
  if (v.name.trim().length < 2) e.name = "Please enter your name.";
  if (!v.email.trim()) e.email = "Please enter your email address.";
  else if (!EMAIL_RE.test(v.email.trim())) e.email = "That does not look like an email address. Check for a missing @ or domain.";
  if (v.phone.trim() && !PHONE_RE.test(v.phone.trim())) e.phone = "Use digits, spaces and an optional leading +, or leave this empty.";
  if (!TOPICS.some((t) => t.key === v.topic)) e.topic = "Please choose a topic.";
  const len = v.message.trim().length;
  if (len < 10) e.message = len === 0 ? "Please write your message." : "A little more detail will help us answer: at least ten characters.";
  else if (len > MESSAGE_MAX) e.message = `Please keep the message under ${MESSAGE_MAX.toLocaleString("en-GB")} characters.`;
  if (!v.privacy) e.privacy = "Please confirm that you have read how your message is handled.";
  return e;
}

/** maps a server-side field name onto one of ours */
const SERVER_FIELD: Record<string, FieldKey> = { name: "name", email: "email", phone: "phone", topic: "topic", message: "message", privacyAccepted: "privacy", privacy: "privacy" };

/**
 * One contact experience that routes by topic. Client-validated, posts JSON to
 * /api/contact, and keeps everything the visitor typed if sending fails.
 */
export function ContactForm({ email }: { email: string }) {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const [v, setV] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const startedAt = useRef<number>(0);
  const utm = useRef<Record<string, string> | undefined>(undefined);
  const busy = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startedAt.current = Date.now();
    utm.current = readUtm();
    // a link may pre-select a topic: /contact?topic=press
    const wanted = new URLSearchParams(window.location.search).get("topic")?.toLowerCase();
    if (wanted && TOPICS.some((t) => t.key === wanted)) setV((s) => ({ ...s, topic: wanted }));
  }, []);

  useEffect(() => {
    if (status.kind === "sent" || status.kind === "failed") resultRef.current?.focus();
  }, [status.kind]);

  const topic = TOPICS.find((t) => t.key === v.topic) ?? TOPICS[0];
  const set = <K extends keyof Values>(k: K, value: Values[K]) => {
    setV((s) => ({ ...s, [k]: value }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const focusFirst = (e: Errors) => {
    const first = ORDER.find((k) => e[k]);
    if (first) formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id(first))}`)?.focus();
  };

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy.current) return;
    const found = validate(v);
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirst(found);
      return;
    }
    busy.current = true;
    setStatus({ kind: "sending" });
    const result = await submitContact({
      name: v.name.trim(),
      email: v.email.trim(),
      ...(v.phone.trim() ? { phone: v.phone.trim() } : {}),
      topic: topic.label,
      message: v.message.trim(),
      privacyAccepted: true,
      marketingConsent: v.marketing,
      website: v.website,
      startedAt: startedAt.current,
      page: window.location.pathname,
      ...(utm.current ? { utm: utm.current } : {}),
    });
    busy.current = false;
    if (result.ok) {
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
    return (
      <div ref={resultRef} tabIndex={-1} role="status" className="panel grid justify-items-start gap-13 p-21 focus:outline-none sm:p-34">
        <Rosette size={34} dna />
        <h2 className="h3">Your message has been received.</h2>
        <p className="max-w-measure text-ink-2">
          We reply by email to <span className="font-medium text-ink">{v.email.trim()}</span>. Please keep the reference below; quote it if you write to us again about the same matter.
        </p>
        <dl className="mt-8 grid w-full gap-px border-y border-line sm:grid-cols-2">
          <div className="py-13">
            <dt className="label">Reference</dt>
            <dd className="num mt-5 select-all break-all text-lg font-medium text-ink">{status.reference}</dd>
          </div>
          <div className="py-13 sm:border-l sm:border-line sm:pl-21">
            <dt className="label">Topic</dt>
            <dd className="mt-5 text-lg text-ink">{topic.label}</dd>
          </div>
        </dl>
        <p className="text-sm text-ink-3">A genuine reply from GIO4X will never ask for your password or a one-time security code.</p>
        <button
          type="button"
          className="btn btn-ghost mt-8"
          onClick={() => {
            setV({ ...EMPTY, name: v.name, email: v.email, topic: v.topic });
            setErrors({});
            startedAt.current = Date.now();
            setStatus({ kind: "idle" });
          }}
        >
          Write another message
        </button>
      </div>
    );
  }

  const sending = status.kind === "sending";
  const count = v.message.length;
  const describe = (k: FieldKey, hint?: boolean) => [errors[k] ? id(`${k}-err`) : null, hint ? id(`${k}-hint`) : null].filter(Boolean).join(" ") || undefined;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={sending} className="panel p-21 sm:p-34">
      <div className="grid gap-21 lg:grid-cols-phi-r lg:gap-34">
        {/* topic first: it decides what the rest of the form asks for */}
        <div className="grid content-start gap-13">
          <div className="field">
            <label htmlFor={id("topic")}>Topic</label>
            <select id={id("topic")} className="select" value={v.topic} onChange={(e) => set("topic", e.target.value)} aria-invalid={!!errors.topic} aria-describedby={describe("topic")} disabled={sending}>
              {TOPICS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            {errors.topic && (
              <p id={id("topic-err")} className="field-error">
                {errors.topic}
              </p>
            )}
          </div>
          <div aria-live="polite" className="border-l border-accent pl-13">
            <p className="label">Helpful to include</p>
            <p className="mt-5 text-sm text-ink-2">{topic.include}</p>
            {topic.caution && <p className="mt-8 text-sm font-medium text-ink">{topic.caution}</p>}
            {topic.first && (
              <p className="mt-8 text-sm text-ink-3">
                May already be answered:{" "}
                <Link href={topic.first.href} className="link">
                  {topic.first.label}
                </Link>
              </p>
            )}
          </div>
          <FigureNote figure={<SortingRack />} label="How it is routed" className="!mt-21">
            The topic you choose travels with the message. Once it is received you are shown a reference: keep it, and quote it if you write again about the same matter.
          </FigureNote>
        </div>

        <div className="grid gap-21">
          <div className="grid gap-21 sm:grid-cols-2">
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
              <input id={id("email")} className="input" type="email" inputMode="email" autoComplete="email" maxLength={200} value={v.email} onChange={(e) => set("email", e.target.value)} aria-required="true" aria-invalid={!!errors.email} aria-describedby={describe("email")} disabled={sending} />
              {errors.email && (
                <p id={id("email-err")} className="field-error">
                  {errors.email}
                </p>
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor={id("phone")}>
              Phone <span className="font-normal normal-case tracking-normal text-ink-3">(optional)</span>
            </label>
            <input id={id("phone")} className="input" type="tel" inputMode="tel" autoComplete="tel" maxLength={24} value={v.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={!!errors.phone} aria-describedby={describe("phone", true)} disabled={sending} />
            {errors.phone ? (
              <p id={id("phone-err")} className="field-error">
                {errors.phone}
              </p>
            ) : null}
            <p id={id("phone-hint")} className="field-hint">
              Include the country code. We reply by email unless you ask otherwise.
            </p>
          </div>

          <div className="field">
            <label htmlFor={id("message")}>Message</label>
            <textarea id={id("message")} className="textarea" rows={7} maxLength={MESSAGE_MAX} placeholder={topic.placeholder} value={v.message} onChange={(e) => set("message", e.target.value)} aria-required="true" aria-invalid={!!errors.message} aria-describedby={describe("message", true)} disabled={sending} />
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

          <div className="grid gap-13 border-t border-line pt-21">
            <div>
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
            <label className="check min-h-[2.75rem] content-center">
              <input type="checkbox" checked={v.marketing} onChange={(e) => set("marketing", e.target.checked)} disabled={sending} />
              <span>
                GIO4X may also email me occasional updates about its markets, tools and research. <span className="text-ink-3">(Optional. Your message is answered either way.)</span>
              </span>
            </label>
          </div>

          {status.kind === "failed" && (
            <div ref={resultRef} tabIndex={-1} role="alert" className="rounded-sm border border-neg p-13 focus:outline-none sm:p-21">
              <p className="h4">Your message was not sent.</p>
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
                "Send message"
              )}
            </button>
            <p className="text-xs text-ink-3" role="status" aria-live="polite">
              {sending ? "Sending your message…" : "You will be shown a reference once it is received."}
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Rosette } from "@/components/brand/Rosette";
import { EMAIL_RE, readUtm, submitContact } from "./submit";

type Values = { name: string; email: string; country: string; account: string; privacy: boolean; website: string };
type FieldKey = "name" | "email" | "country" | "account" | "privacy";
type Errors = Partial<Record<FieldKey, string>>;
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; reference: string } | { kind: "failed"; error?: string };

const ORDER: FieldKey[] = ["name", "email", "country", "account", "privacy"];
const SERVER_FIELD: Record<string, FieldKey> = { name: "name", email: "email", country: "country", accountInterest: "account", privacyAccepted: "privacy", privacy: "privacy" };

/**
 * "Register your interest": shown on /open-account while the online
 * application is not connected. Posts to /api/contact with the topic
 * "Account opening"; the structured answers travel in the message body.
 */
export function InterestForm({ email, accountNames, restricted }: { email: string; accountNames: string[]; restricted: string[] }) {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const options = [...accountNames, "Not sure yet"];
  const [v, setV] = useState<Values>({ name: "", email: "", country: "", account: "", privacy: false, website: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const startedAt = useRef(0);
  const utm = useRef<Record<string, string> | undefined>(undefined);
  const busy = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startedAt.current = Date.now();
    utm.current = readUtm();
    const wanted = new URLSearchParams(window.location.search).get("account")?.toLowerCase();
    const match = accountNames.find((a) => a.toLowerCase() === wanted);
    if (match) setV((s) => ({ ...s, account: match }));
  }, [accountNames]);

  useEffect(() => {
    if (status.kind === "sent" || status.kind === "failed") resultRef.current?.focus();
  }, [status.kind]);

  const set = <K extends keyof Values>(k: K, value: Values[K]) => {
    setV((s) => ({ ...s, [k]: value }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const restrictedMatch = (country: string) => {
    const c = country.trim().toLowerCase();
    return c ? restricted.find((r) => r.toLowerCase() === c) : undefined;
  };

  function validate(): Errors {
    const e: Errors = {};
    if (v.name.trim().length < 2) e.name = "Please enter your name.";
    if (!v.email.trim()) e.email = "Please enter your email address.";
    else if (!EMAIL_RE.test(v.email.trim())) e.email = "That does not look like an email address. Check for a missing @ or domain.";
    const hit = restrictedMatch(v.country);
    if (v.country.trim().length < 2) e.country = "Please enter your country of residence.";
    else if (hit) e.country = `GIO4X services are not available to residents of ${hit}, so we cannot register interest from there.`;
    if (!options.includes(v.account)) e.account = "Please choose an option. “Not sure yet” is a perfectly good answer.";
    if (!v.privacy) e.privacy = "Please confirm that you have read how your details are handled.";
    return e;
  }

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
    const result = await submitContact({
      name: v.name.trim(),
      email: v.email.trim(),
      country: v.country.trim(),
      accountInterest: v.account,
      topic: "Account opening",
      message: `Registration of interest in opening an account.\nCountry of residence: ${v.country.trim()}\nPreferred account type: ${v.account}`,
      privacyAccepted: true,
      marketingConsent: false,
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
      <div ref={resultRef} tabIndex={-1} role="status" className="grid justify-items-start gap-13 focus:outline-none">
        <Rosette size={34} dna />
        <h3 className="h3">Your interest is registered.</h3>
        <p className="text-ink-2">
          We will write to <span className="font-medium text-ink">{v.email.trim()}</span> about opening an account. Nothing has been opened and no commitment has been made on either side.
        </p>
        <dl className="w-full border-y border-line py-13">
          <dt className="label">Reference</dt>
          <dd className="num mt-5 select-all break-all text-lg font-medium text-ink">{status.reference}</dd>
        </dl>
        <p className="text-sm text-ink-3">A genuine message from GIO4X will never ask for your password or a one-time security code.</p>
      </div>
    );
  }

  const sending = status.kind === "sending";
  const describe = (k: FieldKey, hint?: boolean) => [errors[k] ? id(`${k}-err`) : null, hint ? id(`${k}-hint`) : null].filter(Boolean).join(" ") || undefined;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={sending} className="relative grid gap-21">
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
      <div className="grid gap-21 sm:grid-cols-2">
        <div className="field content-start">
          <label htmlFor={id("country")}>Country of residence</label>
          <input id={id("country")} className="input" type="text" autoComplete="country-name" maxLength={80} value={v.country} onChange={(e) => set("country", e.target.value)} aria-required="true" aria-invalid={!!errors.country} aria-describedby={describe("country")} disabled={sending} />
          {errors.country && (
            <p id={id("country-err")} className="field-error">
              {errors.country}
            </p>
          )}
        </div>
        <div className="field content-start">
          <label htmlFor={id("account")}>Preferred account</label>
          <select id={id("account")} className="select" value={v.account} onChange={(e) => set("account", e.target.value)} aria-required="true" aria-invalid={!!errors.account} aria-describedby={describe("account")} disabled={sending}>
            <option value="" disabled>
              Choose
            </option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {errors.account && (
            <p id={id("account-err")} className="field-error">
              {errors.account}
            </p>
          )}
        </div>
      </div>

      {/* honeypot: hidden from people and assistive technology; must stay empty */}
      <div aria-hidden className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden opacity-0">
        <label htmlFor={id("website")}>Website</label>
        <input id={id("website")} name="website" type="text" tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => set("website", e.target.value)} />
      </div>

      <div>
        <label className="check min-h-[2.75rem] content-center">
          <input id={id("privacy")} type="checkbox" checked={v.privacy} onChange={(e) => set("privacy", e.target.checked)} aria-required="true" aria-invalid={!!errors.privacy} aria-describedby={describe("privacy")} disabled={sending} />
          <span>
            I have read the{" "}
            <Link href="/legal/privacy" className="link">
              Privacy Policy
            </Link>{" "}
            and understand that GIO4X will use these details only to contact me about opening an account.
          </span>
        </label>
        {errors.privacy && (
          <p id={id("privacy-err")} className="field-error mt-5 pl-34">
            {errors.privacy}
          </p>
        )}
      </div>

      {status.kind === "failed" && (
        <div ref={resultRef} tabIndex={-1} role="alert" className="rounded-sm border border-neg p-13 focus:outline-none">
          <p className="h4">Your details were not sent.</p>
          <p className="mt-5 text-sm text-ink-2">
            {status.error ?? "The form could not reach GIO4X just now."} What you entered is still above. You can try again, or email{" "}
            <a href={`mailto:${email}`} className="link">
              {email}
            </a>{" "}
            and say you would like to open an account.
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
            "Register interest"
          )}
        </button>
        <p className="text-xs text-ink-3" role="status" aria-live="polite">
          {sending ? "Sending your details…" : "No documents are requested at this stage."}
        </p>
      </div>
    </form>
  );
}

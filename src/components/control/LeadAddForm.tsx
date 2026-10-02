"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addLeadManual, type AddLeadError, type AddLeadField, type AddLeadState } from "@/app/control/actions-leads";
import { Notice } from "@/components/control/bits";
import { SubmitButton } from "@/components/control/SubmitButton";
import { CONTACT_TOPICS, MANUAL_LEAD_SOURCE_LABEL, MANUAL_LEAD_SOURCES } from "@/lib/server/constants";

const ERRORS: Record<AddLeadError, { title: string; text: string }> = {
  invalid: { title: "Some details need correcting", text: "Nothing was saved. Check the fields marked below; what you typed is still here." },
  forbidden: { title: "Your role does not allow this", text: "Nothing was saved. Adding an enquiry needs a role that can change leads." },
  throttled: { title: "Too many enquiries for this address", text: "Nothing was saved. The database accepts three enquiries per e-mail address per hour. Open the person's existing enquiry and add a note there, or try again later." },
  save: { title: "The enquiry could not be saved", text: "Nothing was saved. What you typed is still here; please try again." },
};

const EMPTY = { name: "", email: "", phone: "", country: "", topic: "", how: "", message: "" } satisfies Record<AddLeadField, string>;

/**
 * The form for an enquiry entered by hand. It holds what is typed in its own
 * state, so a refusal from the server (returned by the action, not a redirect)
 * loses nothing and no personal data ever travels in a URL. The limits repeat
 * the server's as a courtesy; the action and the database decide.
 */
export function LeadAddForm({ initial }: { initial?: AddLeadState }) {
  const [state, action] = useActionState(addLeadManual, initial ?? {});
  const [values, setValues] = useState<Record<AddLeadField, string>>(EMPTY);
  const set = (key: AddLeadField) => (event: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: event.target.value }));
  const errors = state.fields ?? {};
  const problem = state.error ? ERRORS[state.error] : null;
  // wires a control to its hint and, when there is one, its error
  const described = (key: AddLeadField, hint?: boolean) => {
    const ids = [hint ? `add-${key}-hint` : "", errors[key] ? `add-${key}-error` : ""].filter(Boolean).join(" ");
    return { "aria-describedby": ids || undefined, "aria-invalid": errors[key] ? (true as const) : undefined };
  };
  const errorLine = (key: AddLeadField) =>
    errors[key] ? (
      <p id={`add-${key}-error`} className="field-error">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form action={action} noValidate className="grid gap-21">
      {problem && (
        <Notice title={problem.title} tone="error">
          {problem.text}
        </Notice>
      )}

      {/* each field keeps to the top of its row, so an error under one does not push its neighbour's box down */}
      <div className="grid gap-21 sm:grid-cols-2 [&>.field]:content-start">
        <div className="field">
          <label htmlFor="add-name">Name</label>
          <input id="add-name" name="name" type="text" className="input" value={values.name} onChange={set("name")} maxLength={120} required autoComplete="off" {...described("name")} />
          {errorLine("name")}
        </div>
        <div className="field">
          <label htmlFor="add-email">E-mail address</label>
          <input id="add-email" name="email" type="email" className="input" value={values.email} onChange={set("email")} maxLength={254} required autoComplete="off" autoCapitalize="none" spellCheck={false} inputMode="email" {...described("email")} />
          {errorLine("email")}
        </div>
        <div className="field">
          <label htmlFor="add-phone">Phone (optional)</label>
          <input id="add-phone" name="phone" type="tel" className="input num" value={values.phone} onChange={set("phone")} maxLength={40} autoComplete="off" inputMode="tel" {...described("phone")} />
          {errorLine("phone")}
        </div>
        <div className="field">
          <label htmlFor="add-country">Country (optional)</label>
          <input id="add-country" name="country" type="text" className="input" value={values.country} onChange={set("country")} maxLength={80} autoComplete="off" {...described("country")} />
          {errorLine("country")}
        </div>
        <div className="field">
          <label htmlFor="add-topic">Topic</label>
          <select id="add-topic" name="topic" className="select" value={values.topic} onChange={set("topic")} required {...described("topic")}>
            <option value="">Choose a topic</option>
            {CONTACT_TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {errorLine("topic")}
        </div>
        <div className="field">
          <label htmlFor="add-how">How the enquiry came about</label>
          <select id="add-how" name="how" className="select" value={values.how} onChange={set("how")} required {...described("how")}>
            <option value="">Choose one</option>
            {MANUAL_LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {MANUAL_LEAD_SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
          {errorLine("how")}
        </div>
      </div>

      <div className="field">
        <label htmlFor="add-message">What was said</label>
        <textarea id="add-message" name="message" className="textarea" rows={6} value={values.message} onChange={set("message")} maxLength={5000} required {...described("message", true)} />
        <p id="add-message-hint" className="field-hint">
          Your note of the conversation: what the person asked for and what they were told. Up to 5,000 characters. Do not record passwords, card numbers or one-time codes.
        </p>
        {errorLine("message")}
      </div>

      <div className="flex flex-wrap items-center gap-13">
        <SubmitButton pending="Saving…">Add enquiry</SubmitButton>
        <Link href="/control/leads" className="btn btn-quiet">
          Cancel
        </Link>
      </div>
    </form>
  );
}

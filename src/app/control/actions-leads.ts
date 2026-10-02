"use server";

/**
 * Server action for an enquiry a member of staff enters by hand (somebody they
 * spoke to by telephone, at an event, by referral).
 *
 * The same rules as src/app/control/actions.ts: who is calling is established
 * again, the capability is checked here and again in the database, the input is
 * validated against allow-lists, and the write runs AS THE SIGNED-IN USER
 * through lead_add_manual() (supabase/migrations/0012_manual_leads.sql), which
 * generates the reference, marks the row as staff-entered with NO consent
 * evidence, and writes the audit row.
 *
 * Unlike the other actions this one answers the form instead of redirecting on
 * failure, so that what was typed is not lost: a name, an address and a note of
 * a conversation must never travel in a URL. The form keeps its own field
 * state; this returns a fixed code and fixed field messages, and nothing the
 * caller typed. Success redirects to the new enquiry.
 */
import { redirect } from "next/navigation";
import { CONTACT_TOPICS, MANUAL_LEAD_SOURCES } from "@/lib/server/constants";
import { can, getAccess, SIGN_IN_PATH } from "@/lib/server/staff";
import { cleanLine, cleanText, isUuid, MESSAGE_MAX, NAME_MAX, normaliseEmail } from "@/lib/server/validate";

export type AddLeadField = "name" | "email" | "phone" | "country" | "topic" | "how" | "message";
export type AddLeadError = "invalid" | "forbidden" | "throttled" | "save";
export type AddLeadState = { error?: AddLeadError; fields?: Partial<Record<AddLeadField, string>> };

// the same pattern as the public contact form and `leads_phone_valid`
const PHONE = /^[0-9+() ./-]{5,40}$/;
const COUNTRY_MAX = 80;

const line = (value: FormDataEntryValue | null) => (typeof value === "string" ? cleanLine(value) : "");

export async function addLeadManual(_previous: AddLeadState, formData: FormData): Promise<AddLeadState> {
  const access = await getAccess();
  if (access.state === "anonymous") redirect(SIGN_IN_PATH);
  if (access.state !== "staff") redirect("/control");
  if (!can(access, "leads.write")) return { error: "forbidden" };

  const fields: Partial<Record<AddLeadField, string>> = {};

  const name = line(formData.get("name"));
  if (!name) fields.name = "Enter the person's name.";
  else if (name.length > NAME_MAX) fields.name = `The name must be ${NAME_MAX} characters or fewer.`;

  const email = normaliseEmail(formData.get("email"));
  if (!email) fields.email = "Enter a valid e-mail address, in plain letters and digits (for example name@example.com).";

  const phone = line(formData.get("phone"));
  if (phone && !PHONE.test(phone)) fields.phone = "Use 5 to 40 digits, spaces and + ( ) . / - only, or leave it empty.";

  const country = line(formData.get("country"));
  if (country.length > COUNTRY_MAX) fields.country = `The country must be ${COUNTRY_MAX} characters or fewer.`;

  const topic = formData.get("topic");
  if (typeof topic !== "string" || !(CONTACT_TOPICS as readonly string[]).includes(topic)) fields.topic = "Choose a topic.";

  const how = formData.get("how");
  if (typeof how !== "string" || !(MANUAL_LEAD_SOURCES as readonly string[]).includes(how)) fields.how = "Choose how the enquiry came about.";

  const rawMessage = formData.get("message");
  const message = typeof rawMessage === "string" ? cleanText(rawMessage) : "";
  if (!message) fields.message = "Write a note of what was said.";
  else if (message.length > MESSAGE_MAX) fields.message = `The note must be ${MESSAGE_MAX.toLocaleString("en-GB")} characters or fewer.`;

  if (Object.keys(fields).length || !email || typeof topic !== "string" || typeof how !== "string") return { error: "invalid", fields };

  const { data, error } = await access.supabase.rpc("lead_add_manual", {
    p_name: name,
    p_email: email,
    p_phone: phone || null,
    p_country: country || null,
    p_topic: topic,
    p_message: message,
    p_how: how,
  });

  if (error) {
    // The database's refusals as fixed codes; nothing the database said is shown.
    if (error.code === "42501") return { error: "forbidden" };
    // three enquiries per address per hour, the same throttle as the website's forms
    if (error.code === "PT429") return { error: "throttled" };
    // a CHECK constraint or the source pattern disagreed with the validation above
    if (error.code === "23514" || error.code === "22023") return { error: "invalid" };
    return { error: "save" };
  }
  if (!isUuid(data)) return { error: "save" };

  redirect(`/control/leads/${data}?notice=added`);
}

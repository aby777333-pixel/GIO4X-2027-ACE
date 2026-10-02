"use server";

/**
 * Server action for an internal note about a person who has written in
 * (table person_notes, supabase/migrations/0019_timeline.sql).
 *
 * The same rules as src/app/control/actions.ts: who is calling is established
 * again, the capability (customers.note) is checked here and again by the
 * database, the input is validated, and the write runs AS THE SIGNED-IN USER,
 * so row-level security, the column grants and the audit trigger apply. A note
 * can only be added: there is no action that changes or removes one, and the
 * database grants neither.
 *
 * Mentions. The browser sends the note's text and nothing else. The names
 * after "@" are looked up here against staff_mentionable() (active staff who
 * can open a customer record), read as the caller; an id never comes from the
 * browser. The database then checks the ids once more and keeps only the
 * people who may be mentioned and whose name really is in the text.
 *
 * Like the manual-enquiry form this action answers the form instead of
 * redirecting on failure, so that what was typed is not lost and never
 * travels in a URL. It returns a fixed code and nothing the caller typed.
 * Success redirects back to the person with a fixed notice.
 */
import { redirect } from "next/navigation";
import { findMentions, NOTE_MAX, NOTE_MENTIONS_MAX, PERSON_KEY } from "@/components/control/timeline";
import { can, getAccess, SIGN_IN_PATH } from "@/lib/server/staff";
import { cleanText } from "@/lib/server/validate";

export type PersonNoteError = "invalid" | "empty" | "long" | "mentions" | "forbidden" | "missing" | "save";
export type PersonNoteState = { error?: PersonNoteError };

export async function addPersonNote(_previous: PersonNoteState, formData: FormData): Promise<PersonNoteState> {
  const access = await getAccess();
  if (access.state === "anonymous") redirect(SIGN_IN_PATH);
  if (access.state !== "staff") redirect("/control");
  if (!can(access, "customers.note")) return { error: "forbidden" };

  const key = formData.get("key");
  if (typeof key !== "string" || !PERSON_KEY.test(key)) return { error: "invalid" };

  const raw = formData.get("body");
  const body = typeof raw === "string" ? cleanText(raw) : "";
  if (!body) return { error: "empty" };
  if (body.length > NOTE_MAX) return { error: "long" };

  // Who is mentioned: names in the text, resolved against the people the
  // caller may mention. No "@", no lookup.
  const mentions = new Set<string>();
  if (body.includes("@")) {
    const directory = await access.supabase.rpc("staff_mentionable");
    // not being able to tell who was mentioned is not a reason to save a note that tells nobody
    if (directory.error) return { error: directory.error.code === "42501" ? "forbidden" : "save" };
    const people = directory.data ?? [];
    for (const span of findMentions(
      body,
      people.map((p) => p.display_name),
    )) {
      // two colleagues with the same display name cannot be told apart in a text: both are told
      for (const person of people) if (person.display_name === span.name) mentions.add(person.user_id);
    }
    if (mentions.size > NOTE_MENTIONS_MAX) return { error: "mentions" };
  }

  const { data, error } = await access.supabase
    .from("person_notes")
    .insert({ person_key: key, body, mentions: [...mentions] })
    .select("id");

  if (error) {
    // The database's refusals as fixed codes; nothing the database said is shown.
    if (error.code === "42501") return { error: "forbidden" };
    // nobody has that key (any more)
    if (error.code === "P0002") return { error: "missing" };
    // a CHECK constraint disagreed with the validation above
    if (error.code === "23514") return { error: "invalid" };
    return { error: "save" };
  }
  if (!data || data.length !== 1) return { error: "save" };

  redirect(`/control/customers/${key}?notice=note#notes`);
}

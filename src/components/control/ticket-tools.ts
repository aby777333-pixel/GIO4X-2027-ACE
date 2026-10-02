import type { TicketMacroRow } from "@/lib/supabase/types";

/**
 * Pieces shared by the ticket page, the queue and the two management screens
 * for canned replies, assignment rules and escalation (0013_ticket_tools.sql).
 * No "use client" and nothing from the server: plain values and functions, so
 * both sides may import it.
 */

/** Must equal `ticket_macros_body_valid` and `ticket_messages_body_valid`: a canned reply is never longer than a reply may be. */
export const MACRO_BODY_MAX = 5000;
/** Must equal `ticket_macros_title_valid` and `ticket_rules_name_valid`. */
export const MACRO_TITLE_MAX = 80;
export const RULE_NAME_MAX = 80;

/** What the reply form needs of a canned reply. Only active ones are handed to it. */
export type MacroOption = Pick<TicketMacroRow, "id" | "title" | "body" | "set_status" | "set_priority" | "set_category">;

export const MACRO_OPTION_COLUMNS = "id, title, body, set_status, set_priority, set_category";

/**
 * The two placeholders a canned reply may carry, filled in when it is put in
 * the reply box. Exactly `{{name}}` and `{{reference}}`: anything else in
 * braces is left as typed, so a mistyped placeholder is visible to the person
 * about to send it rather than silently removed.
 */
export function fillMacro(body: string, values: { name: string; reference: string }): string {
  return body.replace(/\{\{(name|reference)\}\}/g, (_match, key: string) => (key === "name" ? values.name : values.reference));
}

/** How far past its target a ticket is, in words. `hours` comes from the database (one decimal). */
export function overdueText(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return "";
  if (hours < 1) return "under 1 hour";
  if (hours < 48) {
    const h = Math.floor(hours);
    return `${h} ${h === 1 ? "hour" : "hours"}`;
  }
  const days = Math.floor(hours / 24);
  const rest = Math.floor(hours - days * 24);
  return `${days} days${rest ? ` ${rest} ${rest === 1 ? "hour" : "hours"}` : ""}`;
}

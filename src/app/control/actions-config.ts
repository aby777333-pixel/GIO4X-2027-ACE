"use server";

/**
 * Server actions for Configuration: the three values the public website reads
 * (announcement, live chat, support hours) and the notices on the Status page.
 *
 * As in actions.ts, every action re-establishes who is calling, checks the
 * capability (config.manage; the database checks it again), validates against
 * allow-lists and writes AS THE SIGNED-IN USER. The settings table cannot be
 * written directly by any API role: site_setting_set() is the only way in, and
 * it fixes the shape of each value and writes the audit entry.
 *
 * Outcomes travel back as fixed codes. Nothing typed into a form, and nothing
 * the database said, is ever placed in a URL.
 */
import { redirect } from "next/navigation";
import { INCIDENT_COMPONENTS, INCIDENT_SEVERITIES, INCIDENT_STATUSES } from "@/lib/server/constants";
import { can, getAccess, SIGN_IN_PATH, type StaffContext } from "@/lib/server/staff";
import { cleanLine, cleanText, isUuid } from "@/lib/server/validate";
import type { IncidentComponent, IncidentSeverity, IncidentStatus } from "@/lib/supabase/types";

const CONFIG = "/control/config";

/** An incident opens in any state but "resolved": the database refuses a notice that is born resolved. */
const STARTING_STATUSES: readonly IncidentStatus[] = ["scheduled", "investigating", "identified", "monitoring"];

/** The same rule site_setting_set() applies: a path on this site, never another origin. */
const SAME_SITE_PATH = /^\/([^/\\\s][^\\\s]*)?$/;

function isComponent(value: unknown): value is IncidentComponent {
  return typeof value === "string" && (INCIDENT_COMPONENTS as readonly string[]).includes(value);
}

function isSeverity(value: unknown): value is IncidentSeverity {
  return typeof value === "string" && (INCIDENT_SEVERITIES as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is IncidentStatus {
  return typeof value === "string" && (INCIDENT_STATUSES as readonly string[]).includes(value);
}

/** The caller, holding config.manage, or a redirect. */
async function manager(): Promise<StaffContext> {
  const access = await getAccess();
  if (access.state === "anonymous") redirect(SIGN_IN_PATH);
  if (access.state !== "staff") redirect("/control");
  if (!can(access, "config.manage")) redirect(`${CONFIG}?error=forbidden`);
  return access;
}

/** The database's refusals, as fixed codes. Nothing the database said is shown to the caller. */
function refusal(code: string | undefined): string {
  if (code === "42501") return "forbidden";
  if (code === "22023") return "invalid";
  if (code === "23514") return "refused";
  // the incident an update was written for no longer exists
  if (code === "23503") return "gone";
  return "save";
}

/* -------------------------------------------------------------------------- */
/* what the website reads                                                     */
/* -------------------------------------------------------------------------- */

export async function saveAnnouncement(formData: FormData): Promise<void> {
  const ctx = await manager();

  const enabled = formData.get("enabled") === "1";
  const rawText = formData.get("text");
  const rawHref = formData.get("href");
  const tone = formData.get("tone");
  const text = typeof rawText === "string" ? cleanLine(rawText) : "";
  // control and invisible characters become spaces or vanish, and a space fails the path rule below
  const href = typeof rawHref === "string" ? cleanLine(rawHref) : "";

  if (text.length > 200) redirect(`${CONFIG}?error=announcement-long#announcement`);
  if (href && (href.length > 200 || !SAME_SITE_PATH.test(href))) redirect(`${CONFIG}?error=announcement-link#announcement`);
  if (tone !== "info" && tone !== "notice") redirect(`${CONFIG}?error=invalid#announcement`);
  // The database would quietly store "off" for a line with no text. Say so
  // instead: someone who ticked "on" expects to see it on the website.
  if (enabled && !text) redirect(`${CONFIG}?error=announcement-empty#announcement`);

  const { error } = await ctx.supabase.rpc("site_setting_set", { p_key: "announcement", p_value: { enabled, text, href, tone } });
  if (error) redirect(`${CONFIG}?error=${refusal(error.code)}#announcement`);
  redirect(`${CONFIG}?notice=${enabled ? "announcement-on" : "announcement-off"}#announcement`);
}

export async function saveChat(formData: FormData): Promise<void> {
  const ctx = await manager();
  const enabled = formData.get("enabled") === "1";

  const { error } = await ctx.supabase.rpc("site_setting_set", { p_key: "chat", p_value: { enabled } });
  if (error) redirect(`${CONFIG}?error=${refusal(error.code)}#chat`);
  redirect(`${CONFIG}?notice=${enabled ? "chat-on" : "chat-off"}#chat`);
}

export async function saveSupportHours(formData: FormData): Promise<void> {
  const ctx = await manager();
  const raw = formData.get("hours");
  const hours = typeof raw === "string" ? cleanLine(raw) : "";
  if (hours.length > 120) redirect(`${CONFIG}?error=hours-long#support`);

  const { error } = await ctx.supabase.rpc("site_setting_set", { p_key: "support", p_value: { hours } });
  if (error) redirect(`${CONFIG}?error=${refusal(error.code)}#support`);
  redirect(`${CONFIG}?notice=${hours ? "hours" : "hours-cleared"}#support`);
}

/* -------------------------------------------------------------------------- */
/* notices on the Status page                                                 */
/* -------------------------------------------------------------------------- */

export async function createIncident(formData: FormData): Promise<void> {
  const ctx = await manager();

  const rawTitle = formData.get("title");
  const component = formData.get("component");
  const severity = formData.get("severity");
  const status = formData.get("status");
  const publish = formData.get("publish");
  const title = typeof rawTitle === "string" ? cleanLine(rawTitle) : "";

  if (title.length < 1 || title.length > 140) redirect(`${CONFIG}?error=title#incidents`);
  if (!isComponent(component) || !isSeverity(severity) || !isStatus(status) || !STARTING_STATUSES.includes(status)) redirect(`${CONFIG}?error=invalid#incidents`);
  if (publish !== "1" && publish !== "0") redirect(`${CONFIG}?error=invalid#incidents`);
  const published = publish === "1";

  // `created_by` and `started_at` are not sent: the database sets the author
  // to the caller and the start to now.
  const { data, error } = await ctx.supabase.from("incidents").insert({ title, component, severity, status, published }).select("id");
  if (error) redirect(`${CONFIG}?error=${refusal(error.code)}#incidents`);
  if (!data || data.length !== 1) redirect(`${CONFIG}?error=save#incidents`);
  redirect(`${CONFIG}?notice=${published ? "incident-published" : "incident-draft"}#incidents`);
}

export async function postIncidentUpdate(formData: FormData): Promise<void> {
  const ctx = await manager();

  const id = formData.get("id");
  const status = formData.get("status");
  const raw = formData.get("body");
  if (!isUuid(id) || !isStatus(status)) redirect(`${CONFIG}?error=invalid#incidents`);
  const body = typeof raw === "string" ? cleanText(raw) : "";
  if (body.length < 1 || body.length > 2000) redirect(`${CONFIG}?error=update-text#incidents`);

  // The update is the only thing that moves an incident: a trigger copies its
  // status to the incident and stamps (or clears) the resolved time. `author`
  // is not sent: the column defaults to the caller and the policy requires it.
  const { data, error } = await ctx.supabase.from("incident_updates").insert({ incident_id: id, status, body }).select("id");
  if (error) redirect(`${CONFIG}?error=${refusal(error.code)}#incidents`);
  if (!data || data.length !== 1) redirect(`${CONFIG}?error=save#incidents`);
  redirect(`${CONFIG}?notice=${status === "resolved" ? "incident-resolved" : "incident-updated"}#incidents`);
}

export async function setIncidentPublished(formData: FormData): Promise<void> {
  const ctx = await manager();

  const id = formData.get("id");
  const publish = formData.get("publish");
  if (!isUuid(id) || (publish !== "1" && publish !== "0")) redirect(`${CONFIG}?error=invalid#incidents`);
  const published = publish === "1";

  // .select() makes a refusal visible: a row that row-level security filters
  // out is not an error in Postgres, it is simply "0 rows updated".
  const { data, error } = await ctx.supabase.from("incidents").update({ published }).eq("id", id).select("id");
  if (error) redirect(`${CONFIG}?error=${refusal(error.code)}#incidents`);
  if (!data || data.length !== 1) redirect(`${CONFIG}?error=gone#incidents`);
  redirect(`${CONFIG}?notice=${published ? "incident-published" : "incident-withdrawn"}#incidents`);
}

export async function editIncident(formData: FormData): Promise<void> {
  const ctx = await manager();

  const id = formData.get("id");
  const rawTitle = formData.get("title");
  const component = formData.get("component");
  const severity = formData.get("severity");
  if (!isUuid(id)) redirect(`${CONFIG}?error=invalid#incidents`);
  const title = typeof rawTitle === "string" ? cleanLine(rawTitle) : "";
  if (title.length < 1 || title.length > 140) redirect(`${CONFIG}?error=title#incidents`);
  if (!isComponent(component) || !isSeverity(severity)) redirect(`${CONFIG}?error=invalid#incidents`);

  const { data, error } = await ctx.supabase.from("incidents").update({ title, component, severity }).eq("id", id).select("id");
  if (error) redirect(`${CONFIG}?error=${refusal(error.code)}#incidents`);
  if (!data || data.length !== 1) redirect(`${CONFIG}?error=gone#incidents`);
  redirect(`${CONFIG}?notice=incident-edited#incidents`);
}

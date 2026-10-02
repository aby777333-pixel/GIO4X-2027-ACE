"use server";

/**
 * Server actions for what belongs to one member of staff: their saved views
 * and their notifications (0018_personal.sql).
 *
 * Each action re-establishes who is calling, validates its input against an
 * allow-list, and writes AS THE SIGNED-IN USER. Row-level security lets a
 * person touch only their own rows, so "is this view mine?" is never asked
 * here: an id that belongs to a colleague simply matches no row, and that is
 * reported as "no longer exists".
 *
 * A view holds filter choices and nothing else. The filters arrive as hidden
 * fields named `f.<key>`; cleanViewParams() keeps a pair only when the screen
 * has that filter and accepts that value. The search box is never among them.
 * The address the action answers on is rebuilt from those validated values
 * plus a fixed outcome code: nothing a caller typed is echoed back.
 */
import { redirect } from "next/navigation";
import { cleanViewParams, isViewScreen, VIEW_NAME_MAX, VIEW_OUTCOME_PARAM, VIEW_SCREENS, viewHref, type ViewScreen } from "@/components/control/views-shared";
import { can, getAccess, SIGN_IN_PATH } from "@/lib/server/staff";
import { cleanLine, isUuid } from "@/lib/server/validate";

const HOME = "/control";

async function staff() {
  const access = await getAccess();
  if (access.state === "anonymous") redirect(SIGN_IN_PATH);
  if (access.state !== "staff") redirect(HOME);
  return access;
}

/** The screen the form was on and the filters it was showing, both from allow-lists. */
function place(formData: FormData): { screen: ViewScreen; back: (outcome: string) => string; params: Record<string, string> } {
  const screen = formData.get("screen");
  if (!isViewScreen(screen)) redirect(HOME);
  const params = cleanViewParams(screen, (key) => formData.get(`f.${key}`));
  return { screen, params, back: (outcome) => viewHref(screen, params, { [VIEW_OUTCOME_PARAM]: outcome }) };
}

/** A view's name: one line, 1 to 60 characters, and no "@" (a name describes filters, not a person). */
function viewName(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const name = cleanLine(value);
  return name.length >= 1 && name.length <= VIEW_NAME_MAX && !name.includes("@") ? name : null;
}

function refusal(code: string | undefined): string {
  if (code === "54000") return "full"; // the cap of 30, from staff_views_before_write()
  if (code === "23514") return "invalid";
  if (code === "42501") return "forbidden";
  return "save";
}

/** Saves the filters the screen is showing, under a name. */
export async function saveView(formData: FormData): Promise<void> {
  const ctx = await staff();
  const { screen, params, back } = place(formData);
  if (!can(ctx, VIEW_SCREENS[screen].cap)) redirect(back("forbidden"));
  const name = viewName(formData.get("name"));
  if (!name) redirect(back("name"));

  const { data, error } = await ctx.supabase
    .from("staff_views")
    .insert({ screen, name, params, pinned: formData.get("pinned") === "1" })
    .select("id");
  if (error || !data || data.length !== 1) redirect(back(refusal(error?.code)));
  redirect(back("saved"));
}

export async function renameView(formData: FormData): Promise<void> {
  const ctx = await staff();
  const { back } = place(formData);
  const id = formData.get("id");
  if (!isUuid(id)) redirect(back("invalid"));
  const name = viewName(formData.get("name"));
  if (!name) redirect(back("name"));

  // .select() makes a refusal visible: a row that row-level security hides is simply "0 rows updated"
  const { data, error } = await ctx.supabase.from("staff_views").update({ name }).eq("id", id).select("id");
  if (error) redirect(back(refusal(error.code)));
  if (!data || data.length !== 1) redirect(back("gone"));
  redirect(back("renamed"));
}

/** Pins a view to the dashboard, or takes it off. `from=desk` is the dashboard's own "Unpin". */
export async function pinView(formData: FormData): Promise<void> {
  const ctx = await staff();
  const fromDesk = formData.get("from") === "desk";
  const back = fromDesk ? (outcome: string) => `${HOME}?${VIEW_OUTCOME_PARAM}=${outcome}` : place(formData).back;
  const id = formData.get("id");
  const pin = formData.get("pinned");
  if (!isUuid(id) || (pin !== "1" && pin !== "0")) redirect(back("invalid"));

  const { data, error } = await ctx.supabase
    .from("staff_views")
    .update({ pinned: pin === "1" })
    .eq("id", id)
    .select("id");
  if (error) redirect(back(refusal(error.code)));
  if (!data || data.length !== 1) redirect(back("gone"));
  redirect(back(pin === "1" ? "pinned" : "unpinned"));
}

export async function deleteView(formData: FormData): Promise<void> {
  const ctx = await staff();
  const { back } = place(formData);
  const id = formData.get("id");
  if (!isUuid(id)) redirect(back("invalid"));

  const { data, error } = await ctx.supabase.from("staff_views").delete().eq("id", id).select("id");
  if (error) redirect(back(refusal(error.code)));
  if (!data || data.length !== 1) redirect(back("gone"));
  redirect(back("deleted"));
}

/** "Mark all read" on the Notifications page. The bell does the same through POST /control/notifications/read. */
export async function markAllNotificationsRead(): Promise<void> {
  const ctx = await staff();
  const { error } = await ctx.supabase.rpc("notifications_mark_read", {});
  redirect(error ? "/control/notifications?error=save" : "/control/notifications?notice=read");
}

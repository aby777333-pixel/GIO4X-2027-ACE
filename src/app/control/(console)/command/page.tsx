import { NoAccess } from "@/components/control/bits";
import { controlMeta } from "@/components/control/format";
import { CommandView } from "@/components/control/views/CommandView";
import { can, requireStaff } from "@/lib/server/staff";
import type { CommandSummary } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Command Centre", "/control/command");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Every named field of `group` is a finite number. */
function hasCounts(group: unknown, keys: readonly string[]): group is Record<string, unknown> {
  return isRecord(group) && keys.every((key) => typeof group[key] === "number" && Number.isFinite(group[key]));
}

/**
 * command_summary() returns JSON, which the client types as `Json`. The view
 * prints these fields as figures, so the shape is checked here before it is
 * believed: anything else is treated as "could not be read", never as zeros.
 */
function isCommandSummary(value: unknown): value is CommandSummary {
  return (
    isRecord(value) &&
    typeof value.at === "string" &&
    hasCounts(value.leads, ["new", "unassigned", "open", "last_24h"]) &&
    hasCounts(value.follow_ups, ["open", "overdue"]) &&
    hasCounts(value.tickets, ["open", "pending", "unassigned", "unanswered", "late", "complaints_open"]) &&
    hasCounts(value.chats, ["waiting", "active", "staff_online"]) &&
    typeof value.chats.enabled === "boolean" &&
    hasCounts(value.staff, ["active", "pending_changes"]) &&
    hasCounts(value.site, ["incidents_open", "incidents_published"]) &&
    typeof value.site.announcement_on === "boolean" &&
    hasCounts(value.audience, ["subscribers"]) &&
    typeof value.audit_24h === "number" &&
    Number.isFinite(value.audit_24h)
  );
}

export default async function CommandPage() {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "command.read")) return <NoAccess title="Command Centre" />;

  // counted by the database, as the signed-in member of staff; it refuses anyone without command.read
  const { data, error } = await ctx.supabase.rpc("command_summary");
  const summary = !error && isCommandSummary(data) ? data : null;

  return <CommandView summary={summary} />;
}

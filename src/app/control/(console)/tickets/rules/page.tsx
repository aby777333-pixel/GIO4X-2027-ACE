import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { TicketRulesView } from "@/components/control/views/TicketRulesView";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";
import type { TicketRuleRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Assignment rules", "/control/tickets/rules");

/** Shown on the screen. An ordered list a person can reason about is far shorter than this. */
const LIMIT = 200;

const NOTICES: Record<string, string> = {
  created: "Rule added at the end of the list. It applies to tickets that arrive from now on.",
  saved: "Rule changed. It applies to tickets that arrive from now on.",
  on: "Rule switched on. It applies to tickets that arrive from now on.",
  off: "Rule switched off. It no longer applies to new tickets.",
  moved: "Rule moved.",
};
const ERRORS: Record<string, string> = {
  invalid: "That value was not accepted. Nothing was changed.",
  forbidden: "Your role does not allow that change. Nothing was changed.",
  save: "The change could not be saved. Nothing was changed; please try again.",
  name: "A rule needs a name of 1 to 80 characters. Nothing was saved.",
  nothing: "A rule must do something: choose who gets the ticket, a priority to set, or both. Nothing was saved.",
  assignee: "The person chosen cannot be given tickets (they are switched off, or their role does not work tickets). Nothing was changed.",
  edge: "That rule is already at that end of the list. Nothing was changed.",
};

/** The fixed message for a code from the query string; anything else is ignored. */
const message = (table: Record<string, string>, code: string): string | undefined => (Object.prototype.hasOwnProperty.call(table, code) ? table[code] : undefined);

/**
 * Assignment rules: the ordered list and the form that adds or changes one.
 * The database applies the rules (a trigger in 0013_ticket_tools.sql); this
 * screen only maintains the list, as the signed-in member of staff.
 */
export default async function TicketRulesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "tickets.manage")) return <NoAccess title="Assignment rules" />;
  const { supabase } = ctx;

  const params = await searchParams;
  const editId = firstParam(params.edit);

  const [result, assignees, names] = await Promise.all([
    // the order the database tries them in (the same three keys as the trigger)
    supabase.from("ticket_rules").select("*").order("position", { ascending: true }).order("created_at", { ascending: true }).order("id", { ascending: true }).limit(LIMIT),
    supabase.rpc("ticket_assignees"),
    staffDirectory(supabase),
  ]);
  const rules = (result.data ?? []) as TicketRuleRow[];

  return (
    <TicketRulesView
      rules={rules}
      failed={!!result.error}
      assignees={assignees.data ?? []}
      assigneesFailed={!!assignees.error}
      editing={isUuid(editId) ? (rules.find((r) => r.id === editId) ?? null) : null}
      names={names}
      me={ctx.userId}
      notice={message(NOTICES, firstParam(params.notice))}
      error={message(ERRORS, firstParam(params.error))}
    />
  );
}

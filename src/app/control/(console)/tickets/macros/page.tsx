import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { TicketMacrosView } from "@/components/control/views/TicketMacrosView";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";
import type { TicketMacroRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Canned replies", "/control/tickets/macros");

/** Shown on the screen. Far more than a team keeps; the list says so if it is ever reached. */
const LIMIT = 500;

const NOTICES: Record<string, string> = {
  created: "Canned reply added. It is offered in the reply form on every ticket.",
  saved: "Canned reply changed. Replies already sent are not altered.",
  retired: "Canned reply retired. It is no longer offered on tickets.",
  restored: "Canned reply brought back. It is offered on tickets again.",
};
const ERRORS: Record<string, string> = {
  invalid: "That value was not accepted. Nothing was changed.",
  forbidden: "Your role does not allow that change. Nothing was changed.",
  save: "The change could not be saved. Nothing was changed; please try again.",
  title: "A canned reply needs a title of 1 to 80 characters. Nothing was saved.",
  body: "A canned reply needs text, up to 5,000 characters. Nothing was saved.",
};

/** The fixed message for a code from the query string; anything else is ignored. */
const message = (table: Record<string, string>, code: string): string | undefined => (Object.prototype.hasOwnProperty.call(table, code) ? table[code] : undefined);

/**
 * Canned replies: the list and the form that adds or changes one. Read and
 * written as the signed-in member of staff; only tickets.manage sees retired
 * ones or may write (0013_ticket_tools.sql decides both).
 */
export default async function TicketMacrosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "tickets.manage")) return <NoAccess title="Canned replies" />;
  const { supabase } = ctx;

  const params = await searchParams;
  const editId = firstParam(params.edit);

  const [result, names] = await Promise.all([
    // in use first, then by title
    supabase.from("ticket_macros").select("*").order("active", { ascending: false }).order("title", { ascending: true }).limit(LIMIT),
    staffDirectory(supabase),
  ]);
  const macros = (result.data ?? []) as TicketMacroRow[];

  return (
    <TicketMacrosView
      macros={macros}
      failed={!!result.error}
      editing={isUuid(editId) ? (macros.find((m) => m.id === editId) ?? null) : null}
      names={names}
      me={ctx.userId}
      notice={message(NOTICES, firstParam(params.notice))}
      error={message(ERRORS, firstParam(params.error))}
    />
  );
}

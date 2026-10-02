import Link from "next/link";
import { notFound } from "next/navigation";
import { ControlHead, NoAccess, Notice } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { PERSON_KEY } from "@/components/control/timeline";
import { CustomerView, type CustomerTab } from "@/components/control/views/CustomerView";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import { readTimeline, timelineCursor, timelineFilter } from "@/lib/server/timeline";
import type { Json, PersonView } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Customer", "/control/customers");

const NOTICES: Record<string, string> = {
  note: "Note added.",
};

/** person_view() answers with JSON; make sure it has the shape the view reads before trusting it. */
function asPersonView(value: Json | null): PersonView | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const ok = typeof value.key === "string" && typeof value.email === "string" && Array.isArray(value.leads) && Array.isArray(value.tickets) && typeof value.marketing_consent === "boolean";
  return ok ? (value as unknown as PersonView) : null;
}

/**
 * Everything held under one e-mail address: person_view() for who they are and
 * the two lists, person_timeline() for the history on one line, person_notes
 * for the internal notes (0009, 0010, 0019). The address never appears in the
 * URL: the person is addressed by a hash of it. Every query parameter is
 * checked against an allow-list; the paging cursor is a timestamp and nothing
 * else.
 */
export default async function CustomerPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "customers.read")) return <NoAccess title="Customer" />;
  const { supabase } = ctx;

  const { key } = await params;
  if (!PERSON_KEY.test(key)) notFound();

  const sp = await searchParams;
  const tab: CustomerTab = firstParam(sp.tab) === "records" ? "records" : "timeline";
  const show = timelineFilter(ctx, firstParam(sp.show));
  const before = timelineCursor(firstParam(sp.before));
  const notice = NOTICES[firstParam(sp.notice)];
  const canNote = can(ctx, "customers.note");
  const onTimeline = tab === "timeline";

  // The timeline, the notes and the people who can be mentioned are read only
  // for the tab that shows them. Each is read as the signed-in user; a failure
  // of one (for example, 0019 not applied yet) leaves the rest of the page standing.
  const [result, names, timeline, notesResult, mentionable] = await Promise.all([
    supabase.rpc("person_view", { p_key: key }),
    staffDirectory(supabase),
    onTimeline ? readTimeline(ctx, key, show, before) : Promise.resolve({ events: [], hasOlder: false, failed: false }),
    onTimeline ? supabase.from("person_notes").select("id, author, body, mentions, created_at").eq("person_key", key).order("created_at", { ascending: false }).order("id", { ascending: true }).limit(200) : null,
    onTimeline && canNote ? supabase.rpc("staff_mentionable") : null,
  ]);

  if (result.error) {
    return (
      <>
        <ControlHead title="This person could not be read" />
        <div className="mt-21">
          <Notice title="The database did not answer" tone="error">
            Reload the page, or go back to{" "}
            <Link href="/control/customers" className="link">
              all customers
            </Link>
            .
          </Notice>
        </div>
      </>
    );
  }
  // null: nobody has that key
  const person = asPersonView(result.data);
  if (!person) notFound();

  // person_view() and person_timeline() leave out what the role does not
  // include; a block is also handed to the view only when the role includes
  // that kind of record, so what this page shows never exceeds what Leads and
  // Tickets would show.
  return (
    <CustomerView
      person={{ key: person.key, email: person.email, name: person.name, subscription: person.subscription, marketing_consent: person.marketing_consent }}
      leads={can(ctx, "leads.read") ? person.leads : null}
      tickets={can(ctx, "tickets.read") ? person.tickets : null}
      names={names}
      me={ctx.userId}
      tab={tab}
      timeline={{ show, before, events: timeline.events, hasOlder: timeline.hasOlder, failed: timeline.failed }}
      seesAudit={can(ctx, "audit.read")}
      notes={notesResult && !notesResult.error ? (notesResult.data ?? []) : onTimeline ? null : []}
      canNote={canNote}
      // names only: who is told is worked out on the server from the note's text, never from an id the browser sends
      mentionable={mentionable && !mentionable.error ? [...new Set((mentionable.data ?? []).map((p) => p.display_name))] : []}
      notice={notice}
    />
  );
}

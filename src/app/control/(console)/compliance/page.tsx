import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { ComplianceView, type ComplianceGroup, type GroupCount, type Matter } from "@/components/control/views/ComplianceView";
import { COMPLIANCE_CATEGORIES, COMPLIANCE_TOPICS } from "@/lib/server/constants";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import type { LeadRow, TicketRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Compliance", "/control/compliance");

/** At most this many open rows are read from each source; the page says so when the register is longer. */
const OPEN_LIMIT = 200;
const CLOSED_LIMIT = 25;

const TICKET_OPEN = ["open", "pending"] as const;
const TICKET_CLOSED = ["solved", "closed"] as const;
const LEAD_OPEN = ["new", "open", "waiting"] as const;

// a ticket category and the enquiry topic that belongs beside it
const TOPIC_OF: Record<ComplianceGroup, (typeof COMPLIANCE_TOPICS)[number]> = { complaint: "Complaint", privacy: "Privacy", security: "Security" };
const GROUP_OF_TOPIC: Record<string, ComplianceGroup> = { Complaint: "complaint", Privacy: "privacy", Security: "security" };

const TICKET_COLUMNS = "id, reference, created_at, name, email, category, status, priority, assigned_to, first_response_at, solved_at, updated_at";
const LEAD_COLUMNS = "id, reference, created_at, updated_at, name, email, topic, status, assigned_to";

type TicketPick = Pick<TicketRow, "id" | "reference" | "created_at" | "name" | "email" | "category" | "status" | "priority" | "assigned_to" | "first_response_at" | "solved_at" | "updated_at">;
type LeadPick = Pick<LeadRow, "id" | "reference" | "created_at" | "updated_at" | "name" | "email" | "topic" | "status" | "assigned_to">;

const isGroup = (value: string): value is ComplianceGroup => (COMPLIANCE_CATEGORIES as readonly string[]).includes(value);

function ticketMatter(t: TicketPick, closed: boolean): Matter | null {
  if (!isGroup(t.category)) return null;
  return {
    kind: "ticket",
    id: t.id,
    reference: t.reference,
    group: t.category,
    name: t.name,
    email: t.email,
    created_at: t.created_at,
    assigned_to: t.assigned_to,
    closed_at: closed ? (t.solved_at ?? t.updated_at) : null,
    status: t.status,
    priority: t.priority,
    first_response_at: t.first_response_at,
  };
}

function enquiryMatter(l: LeadPick, closed: boolean): Matter | null {
  const group = GROUP_OF_TOPIC[l.topic];
  if (!group) return null;
  return {
    kind: "enquiry",
    id: l.id,
    reference: l.reference,
    group,
    name: l.name,
    email: l.email,
    created_at: l.created_at,
    assigned_to: l.assigned_to,
    // an enquiry has no closing time of its own; its last change is normally the moment it was resolved
    closed_at: closed ? l.updated_at : null,
    status: l.status,
    topic: l.topic,
  };
}

const isMatter = (m: Matter | null): m is Matter => m !== null;

/**
 * The compliance register: tickets and enquiries in the careful-handling
 * categories, read with the caller's own access. Row-level security decides
 * what comes back (tickets.read, leads.read); a source the role does not
 * include is not asked for at all and the page says it is missing.
 */
export default async function CompliancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "compliance.read")) return <NoAccess title="Compliance" />;
  const { supabase } = ctx;

  const params = await searchParams;
  const categoryParam = firstParam(params.category);
  const filter = isGroup(categoryParam) ? categoryParam : "";
  const groups: readonly ComplianceGroup[] = filter ? [filter] : COMPLIANCE_CATEGORIES;
  const topics = groups.map((g) => TOPIC_OF[g]);

  const withTickets = can(ctx, "tickets.read");
  const withEnquiries = can(ctx, "leads.read");

  const ticketCount = (group: ComplianceGroup) => supabase.from("tickets").select("id", { count: "exact", head: true }).eq("category", group).in("status", TICKET_OPEN);
  const leadCount = (group: ComplianceGroup) => supabase.from("leads").select("id", { count: "exact", head: true }).eq("topic", TOPIC_OF[group]).in("status", LEAD_OPEN);

  const [ticketCounts, leadCounts, ticketsOpen, leadsOpen, ticketsClosed, leadsClosed, names] = await Promise.all([
    withTickets ? Promise.all(COMPLIANCE_CATEGORIES.map(ticketCount)) : null,
    withEnquiries ? Promise.all(COMPLIANCE_CATEGORIES.map(leadCount)) : null,
    withTickets ? supabase.from("tickets").select(TICKET_COLUMNS).in("category", groups).in("status", TICKET_OPEN).order("created_at", { ascending: true }).limit(OPEN_LIMIT) : null,
    withEnquiries ? supabase.from("leads").select(LEAD_COLUMNS).in("topic", topics).in("status", LEAD_OPEN).order("created_at", { ascending: true }).limit(OPEN_LIMIT) : null,
    withTickets
      ? supabase.from("tickets").select(TICKET_COLUMNS).in("category", groups).in("status", TICKET_CLOSED).order("solved_at", { ascending: false, nullsFirst: false }).limit(CLOSED_LIMIT)
      : null,
    withEnquiries ? supabase.from("leads").select(LEAD_COLUMNS).in("topic", topics).eq("status", "resolved").order("updated_at", { ascending: false }).limit(CLOSED_LIMIT) : null,
    staffDirectory(supabase),
  ]);

  const failed =
    !!ticketCounts?.some((r) => r.error) || !!leadCounts?.some((r) => r.error) || !!ticketsOpen?.error || !!leadsOpen?.error || !!ticketsClosed?.error || !!leadsClosed?.error;

  const counts = Object.fromEntries(
    COMPLIANCE_CATEGORIES.map((group, i): [ComplianceGroup, GroupCount] => [group, { tickets: ticketCounts ? (ticketCounts[i]?.count ?? 0) : null, enquiries: leadCounts ? (leadCounts[i]?.count ?? 0) : null }]),
  ) as Record<ComplianceGroup, GroupCount>;
  const openTotal = groups.reduce((sum, g) => sum + (counts[g].tickets ?? 0) + (counts[g].enquiries ?? 0), 0);

  const openTickets = ((ticketsOpen?.data ?? []) as TicketPick[]).map((t) => ticketMatter(t, false)).filter(isMatter);
  const openEnquiries = ((leadsOpen?.data ?? []) as LeadPick[]).map((l) => enquiryMatter(l, false)).filter(isMatter);
  // Oldest first across both sources. When a source was cut at the limit, the
  // merged list is only complete up to that source's last row: stop there, so
  // that nothing older is ever missing from what is shown.
  const cutoffs = [openTickets, openEnquiries].filter((list) => list.length >= OPEN_LIMIT).map((list) => list[list.length - 1]?.created_at ?? "");
  const cutoff = cutoffs.length ? cutoffs.reduce((a, b) => (a < b ? a : b)) : null;
  const open = [...openTickets, ...openEnquiries]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .filter((m) => cutoff === null || new Date(m.created_at).getTime() <= new Date(cutoff).getTime());

  const closed = [
    ...((ticketsClosed?.data ?? []) as TicketPick[]).map((t) => ticketMatter(t, true)).filter(isMatter),
    ...((leadsClosed?.data ?? []) as LeadPick[]).map((l) => enquiryMatter(l, true)).filter(isMatter),
  ]
    .sort((a, b) => new Date(b.closed_at ?? 0).getTime() - new Date(a.closed_at ?? 0).getTime())
    .slice(0, CLOSED_LIMIT);

  return (
    <ComplianceView
      filter={filter}
      counts={counts}
      open={open}
      openTotal={openTotal}
      closed={closed}
      sources={{ tickets: withTickets, enquiries: withEnquiries }}
      names={names}
      me={ctx.userId}
      now={Date.now()}
      failed={failed}
    />
  );
}

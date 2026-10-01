import { controlMeta, ROLE_LABEL } from "@/components/control/format";
import { LEAD_LIST_COLUMNS, type LeadListItem } from "@/components/control/LeadsTable";
import { OverviewView } from "@/components/control/views/OverviewView";
import { LEAD_STATUSES } from "@/lib/server/constants";
import { requireStaff, staffDirectory } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Overview", "/control");

/**
 * What needs attention now. Every figure is a count of real rows read as the
 * signed-in member of staff; there are no targets, scores or estimates.
 */
export default async function OverviewPage() {
  const ctx = await requireStaff();
  if (!ctx) return null;
  const { supabase } = ctx;

  const [byStatus, unassigned, newest, subscribers, names] = await Promise.all([
    Promise.all(LEAD_STATUSES.map((status) => supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", status))),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new").is("assigned_to", null),
    supabase.from("leads").select(LEAD_LIST_COLUMNS).order("created_at", { ascending: false }).limit(8),
    supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).is("unsubscribed_at", null),
    staffDirectory(supabase),
  ]);

  const failed = byStatus.some((r) => r.error) || !!unassigned.error || !!newest.error || !!subscribers.error;
  const counts = LEAD_STATUSES.map((status, i) => ({ status, count: byStatus[i]?.count ?? 0 }));
  const leads = (newest.data ?? []) as LeadListItem[];
  const waitingForPickup = unassigned.count ?? 0;

  return (
    <OverviewView
      signedInAs={`Signed in as ${ctx.displayName} · ${ROLE_LABEL[ctx.role]}`}
      failed={failed}
      counts={counts}
      waitingForPickup={waitingForPickup}
      leads={leads}
      names={names}
      me={ctx.userId}
      subscriberCount={subscribers.count ?? 0}
    />
  );
}

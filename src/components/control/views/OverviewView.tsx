import Link from "next/link";
import type { ReactNode } from "react";
import { ControlHead, Notice, Score, StageBadge, StatusBadge } from "@/components/control/bits";
import { Icon, type IconName } from "@/components/control/icons";
import type { LeadListItem } from "@/components/control/LeadsTable";
import { TaskList, type TaskItem } from "@/components/control/TaskList";
import type { LeadStage, LeadStatus } from "@/lib/supabase/types";

export type OverviewProps = {
  signedInAs: string;
  failed: boolean;
  notice?: string;
  error?: string;
  /** null when the person's role does not include enquiries */
  leads: {
    counts: { status: LeadStatus; count: number }[];
    stages: { stage: LeadStage; count: number }[];
    waitingForPickup: number;
    newest: LeadListItem[];
    /** my open follow-ups that are overdue or due within a day */
    tasks: TaskItem[];
    taskTotal: number;
    taskLeads: Map<string, { reference: string; name: string }>;
    canTask: boolean;
  } | null;
  /** null when the person's role does not include subscribers */
  subscriberCount: number | null;
  /** staff requests this person could decide; null when they do not manage staff */
  staffToDecide: number | null;
  names: Map<string, string>;
  me: string;
  now: number;
};

function Stat({ href, icon, label, value }: { href: string; icon: IconName; label: string; value: number }) {
  return (
    <Link href={href} className="gxc-stat">
      <span className="gxc-stat-icon">
        <Icon name={icon} size={16} />
      </span>
      <span className="gxc-stat-label">{label}</span>
      <span className="gxc-stat-value">{value}</span>
    </Link>
  );
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="gxc-card min-w-0">
      <div className="gxc-card-head">
        <h2 className="gxc-card-title">{title}</h2>
        {action}
      </div>
      <div className="gxc-card-body">{children}</div>
    </section>
  );
}

/**
 * The dashboard, laid out as the Service Console's was: four figures, then
 * cards. Presentation only: every figure arrives as a prop, already read from
 * real rows as the signed-in member of staff.
 */
export function OverviewView({ signedInAs, failed, notice, error, leads, subscriberCount, staffToDecide, names, me, now }: OverviewProps) {
  const nothing = !leads && subscriberCount === null && staffToDecide === null;
  const count = (status: LeadStatus) => leads?.counts.find((c) => c.status === status)?.count ?? 0;
  const total = leads ? leads.counts.reduce((sum, c) => sum + c.count, 0) : 0;

  return (
    <>
      <ControlHead title="Service Console" lead={<>Enquiries, follow-ups and the pipeline at a glance. {signedInAs}.</>} />

      <div className="mt-21 grid gap-13">
        {notice && !error && <Notice title={notice} tone="ok" />}
        {error && <Notice title={error} tone="error" />}
        {failed && (
          <Notice title="Some figures could not be read" tone="error">
            The database did not answer every query. Reload the page; if this continues, check that the migrations have been applied and that the project is running.
          </Notice>
        )}
        {!failed && nothing && <Notice title="Nothing for your role yet">The sections for your role have not been built. The audit log is open to you in the meantime.</Notice>}
        {!failed && staffToDecide !== null && staffToDecide > 0 && (
          <Notice title={staffToDecide === 1 ? "1 staff change is waiting for your decision" : `${staffToDecide} staff changes are waiting for your decision`}>
            <Link href="/control/staff" className="link">
              Review in Team &amp; Access
            </Link>
          </Notice>
        )}
      </div>

      {!failed && leads && (
        <>
          <div className="mt-13 grid grid-cols-2 gap-13 lg:grid-cols-4">
            <Stat href="/control/leads?status=new" icon="inbox" label="New enquiries" value={count("new")} />
            <Stat href="/control/leads?status=open" icon="leads" label="Open enquiries" value={count("open")} />
            <Stat href="/control/leads?status=new" icon="customers" label="Unassigned" value={leads.waitingForPickup} />
            <Stat href="/control/tasks" icon="clock" label="Your follow-ups due" value={leads.taskTotal} />
          </div>

          <div className="mt-13 grid gap-13 lg:grid-cols-2">
            <Card
              title="Newest enquiries"
              action={
                <Link href="/control/leads" className="gxc-card-link">
                  View all →
                </Link>
              }
            >
              {leads.newest.length ? (
                <ul className="grid gap-8">
                  {leads.newest.slice(0, 6).map((lead) => (
                    <li key={lead.id}>
                      <Link href={`/control/leads/${lead.id}`} className="gxc-row">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">{lead.name}</span>
                          <span className="num block truncate text-[0.6875rem] text-ink-3">
                            {lead.reference} · {lead.topic}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-13">
                          <span className="hidden sm:inline-flex">
                            <Score value={lead.score} />
                          </span>
                          <StatusBadge status={lead.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-21 text-center text-sm text-ink-3">No enquiries yet.</p>
              )}
            </Card>

            <Card
              title="Your follow-ups, due now"
              action={
                <Link href="/control/tasks" className="gxc-card-link">
                  All follow-ups →
                </Link>
              }
            >
              {leads.tasks.length ? (
                <>
                  <TaskList tasks={leads.tasks} leads={leads.taskLeads} names={names} me={me} now={now} from="overview" writable={leads.canTask} label="Your follow-ups that are overdue or due within a day" />
                  {leads.taskTotal > leads.tasks.length && (
                    <p className="num mt-8 text-xs text-ink-3">
                      Showing the first {leads.tasks.length} of {leads.taskTotal}.
                    </p>
                  )}
                </>
              ) : (
                <p className="py-21 text-center text-sm text-ink-3">Nothing of yours is overdue or due in the next 24 hours.</p>
              )}
            </Card>
          </div>

          <div className="mt-13 grid gap-13 lg:grid-cols-2">
            <Card
              title="Pipeline"
              action={
                <Link href="/control/pipeline" className="gxc-card-link">
                  Open the pipeline →
                </Link>
              }
            >
              <ul className="grid grid-cols-2 gap-8 sm:grid-cols-3">
                {leads.stages.map(({ stage, count: n }) => (
                  <li key={stage}>
                    <Link href={`/control/leads?stage=${stage}&sort=score`} className="gxc-row">
                      <StageBadge stage={stage} />
                      <span className="num text-sm font-semibold text-ink">{n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Enquiries by status" action={<span className="num text-xs text-ink-3">{total} in total</span>}>
              <ul className="grid grid-cols-2 gap-8 sm:grid-cols-3">
                {leads.counts.map(({ status, count: n }) => (
                  <li key={status}>
                    <Link href={`/control/leads?status=${status}`} className="gxc-row">
                      <StatusBadge status={status} />
                      <span className="num text-sm font-semibold text-ink">{n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}

      {!failed && subscriberCount !== null && (
        <div className="mt-13">
          <Card
            title="Newsletter"
            action={
              <Link href="/control/subscribers" className="gxc-card-link">
                Subscribers →
              </Link>
            }
          >
            <p className="text-sm text-ink-2">
              <span className="num font-semibold text-ink">{subscriberCount}</span> active {subscriberCount === 1 ? "subscription" : "subscriptions"}
            </p>
          </Card>
        </div>
      )}
    </>
  );
}

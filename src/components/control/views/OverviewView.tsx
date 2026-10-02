import Link from "next/link";
import { ControlHead, Empty, Notice, StageBadge, StatusBadge } from "@/components/control/bits";
import { STATUS_NOTE } from "@/components/control/format";
import { LeadsTable, type LeadListItem } from "@/components/control/LeadsTable";
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

/** Presentation only: every figure arrives as a prop, already read from real rows. */
export function OverviewView({ signedInAs, failed, notice, error, leads, subscriberCount, staffToDecide, names, me, now }: OverviewProps) {
  const total = leads ? leads.counts.reduce((sum, c) => sum + c.count, 0) : 0;
  const nothing = !leads && subscriberCount === null && staffToDecide === null;
  return (
    <>
      <ControlHead eyebrow="GIO4X Control" title="Overview" lead={signedInAs} />

      <div className="mt-21 grid gap-13">
        {notice && !error && <Notice title={notice} tone="ok" />}
        {error && <Notice title={error} tone="error" />}
      </div>

      {failed ? (
        <div className="mt-13">
          <Notice title="Some figures could not be read" tone="error">
            The database did not answer every query. Reload the page; if this continues, check that the migrations have been applied and that the project is running.
          </Notice>
        </div>
      ) : nothing ? (
        <div className="mt-13">
          <Notice title="Nothing for your role yet">The sections for your role have not been built. The audit log is open to you in the meantime.</Notice>
        </div>
      ) : (
        <>
          {staffToDecide !== null && staffToDecide > 0 && (
            <div className="mt-13">
              <Notice title={staffToDecide === 1 ? "1 staff change is waiting for your decision" : `${staffToDecide} staff changes are waiting for your decision`}>
                <Link href="/control/staff" className="link">
                  Review on the Staff page
                </Link>
              </Notice>
            </div>
          )}

          {leads && (
            <>
              <section aria-labelledby="ov-tasks" className="mt-21">
                <div className="flex flex-wrap items-end justify-between gap-13">
                  <h2 id="ov-tasks" className="h4">
                    Your follow-ups, due now
                  </h2>
                  <Link href="/control/tasks" className="go">
                    All follow-ups
                  </Link>
                </div>
                <div className="mt-13">
                  {leads.tasks.length ? (
                    <>
                      <TaskList tasks={leads.tasks} leads={leads.taskLeads} names={names} me={me} now={now} from="overview" writable={leads.canTask} label="Your follow-ups that are overdue or due within a day" />
                      {leads.taskTotal > leads.tasks.length && <p className="num mt-8 text-xs text-ink-3">Showing the first {leads.tasks.length} of {leads.taskTotal}.</p>}
                    </>
                  ) : (
                    <p className="border-y border-line py-13 text-sm text-ink-3">Nothing of yours is overdue or due in the next 24 hours.</p>
                  )}
                </div>
              </section>

              <section aria-labelledby="ov-stage" className="mt-55">
                <div className="flex flex-wrap items-baseline justify-between gap-13">
                  <h2 id="ov-stage" className="label">
                    Pipeline
                  </h2>
                  <Link href="/control/pipeline" className="go">
                    Open the pipeline
                  </Link>
                </div>
                <ul className="mt-13 grid grid-cols-2 border-l border-t border-line sm:grid-cols-3 lg:grid-cols-6">
                  {leads.stages.map(({ stage, count }) => (
                    <li key={stage} className="border-b border-r border-line">
                      <Link href={`/control/leads?stage=${stage}&sort=score`} className="block p-13 transition-colors duration-fast hover:bg-brand-soft">
                        <span className="num block font-display text-xl font-light text-ink">{count}</span>
                        <span className="mt-5 block">
                          <StageBadge stage={stage} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="ov-status" className="mt-55">
                <div className="flex flex-wrap items-baseline justify-between gap-13">
                  <h2 id="ov-status" className="label">
                    Enquiries by status
                  </h2>
                  <p className="num text-xs text-ink-3">{total} in total</p>
                </div>
                <ul className="mt-13 grid grid-cols-2 border-l border-t border-line sm:grid-cols-3 lg:grid-cols-5">
                  {leads.counts.map(({ status, count }) => (
                    <li key={status} className="border-b border-r border-line">
                      <Link href={`/control/leads?status=${status}`} className="block p-21 transition-colors duration-fast hover:bg-brand-soft">
                        <span className="num block font-display text-2xl font-light text-ink">{count}</span>
                        <span className="mt-8 block">
                          <StatusBadge status={status} />
                        </span>
                        <span className="mt-5 block text-xs text-ink-3">{STATUS_NOTE[status]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              {leads.waitingForPickup > 0 && (
                <div className="mt-21">
                  <Notice title={leads.waitingForPickup === 1 ? "1 new enquiry has no owner yet" : `${leads.waitingForPickup} new enquiries have no owner yet`}>
                    <Link href="/control/leads?status=new" className="link">
                      Review new enquiries
                    </Link>
                  </Notice>
                </div>
              )}

              <section aria-labelledby="ov-newest" className="mt-55">
                <div className="flex flex-wrap items-end justify-between gap-13">
                  <h2 id="ov-newest" className="h4">
                    Newest enquiries
                  </h2>
                  <Link href="/control/leads" className="go">
                    All leads
                  </Link>
                </div>
                <div className="mt-13">
                  {leads.newest.length ? (
                    <LeadsTable leads={leads.newest} names={names} me={me} caption="The eight most recent enquiries" />
                  ) : (
                    <Empty title="No enquiries yet">
                      <p>When someone sends the contact form or registers interest in an account, the enquiry appears here with its reference.</p>
                    </Empty>
                  )}
                </div>
              </section>
            </>
          )}

          {subscriberCount !== null && (
            <section aria-labelledby="ov-subs" className="mt-55 flex flex-wrap items-baseline justify-between gap-13 border-t border-line pt-21">
              <div>
                <h2 id="ov-subs" className="label">
                  Newsletter
                </h2>
                <p className="mt-8 text-sm text-ink-2">
                  <span className="num font-medium text-ink">{subscriberCount}</span> active {subscriberCount === 1 ? "subscription" : "subscriptions"}
                </p>
              </div>
              <Link href="/control/subscribers" className="go">
                Subscribers
              </Link>
            </section>
          )}
        </>
      )}
    </>
  );
}

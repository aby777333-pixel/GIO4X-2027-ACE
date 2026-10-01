import Link from "next/link";
import { ControlHead, Empty, Notice, StatusBadge } from "@/components/control/bits";
import { STATUS_NOTE } from "@/components/control/format";
import { LeadsTable, type LeadListItem } from "@/components/control/LeadsTable";
import type { LeadStatus } from "@/lib/supabase/types";

export type OverviewProps = {
  signedInAs: string;
  failed: boolean;
  counts: { status: LeadStatus; count: number }[];
  waitingForPickup: number;
  leads: LeadListItem[];
  names: Map<string, string>;
  me: string;
  subscriberCount: number;
};

/** Presentation only: every figure arrives as a prop, already read from real rows. */
export function OverviewView({ signedInAs, failed, counts, waitingForPickup, leads, names, me, subscriberCount }: OverviewProps) {
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  return (
    <>
      <ControlHead eyebrow="GIO4X Control" title="Overview" lead={signedInAs} />

      {failed ? (
        <div className="mt-34">
          <Notice title="Some figures could not be read" tone="error">
            The database did not answer every query. Reload the page; if this continues, check that the migrations have been applied and that the project is running.
          </Notice>
        </div>
      ) : (
        <>
          <section aria-labelledby="ov-status" className="mt-34">
            <div className="flex flex-wrap items-baseline justify-between gap-13">
              <h2 id="ov-status" className="label">
                Enquiries by status
              </h2>
              <p className="num text-xs text-ink-3">{total} in total</p>
            </div>
            <ul className="mt-13 grid grid-cols-2 border-l border-t border-line sm:grid-cols-3 lg:grid-cols-5">
              {counts.map(({ status, count }) => (
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

          {waitingForPickup > 0 && (
            <div className="mt-21">
              <Notice title={waitingForPickup === 1 ? "1 new enquiry has no owner yet" : `${waitingForPickup} new enquiries have no owner yet`}>
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
              {leads.length ? (
                <LeadsTable leads={leads} names={names} me={me} caption="The eight most recent enquiries" />
              ) : (
                <Empty title="No enquiries yet">
                  <p>When someone sends the contact form or registers interest in an account, the enquiry appears here with its reference.</p>
                </Empty>
              )}
            </div>
          </section>

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
        </>
      )}
    </>
  );
}

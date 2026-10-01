import { ControlHead, Empty, Notice, Pager } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import type { SubscriberRow } from "@/lib/supabase/types";

export type SubscribersViewProps = {
  rows: SubscriberRow[];
  total: number;
  page: number;
  pageCount: number;
  failed: boolean;
  pastEnd: boolean;
  isAdmin: boolean;
};

/** Presentation only. The export button is a courtesy for admins; the export route checks the role itself. */
export function SubscribersView({ rows, total, page, pageCount, failed, pastEnd, isAdmin }: SubscribersViewProps) {
  return (
    <>
      <ControlHead
        eyebrow="Growth"
        title="Subscribers"
        lead="Newsletter subscriptions with the consent recorded for each: when it was given and against which version of the privacy notice."
        actions={
          isAdmin && total > 0 ? (
            // POST, not a link: an export is an audited action and must not be
            // triggerable by a page elsewhere navigating the browser here.
            <form method="post" action="/control/subscribers/export">
              <button type="submit" className="btn btn-ghost">
                Export CSV
              </button>
            </form>
          ) : undefined
        }
      />

      {isAdmin && total > 0 && <p className="mt-8 text-xs text-ink-3">Each export is recorded in the audit log with your name and the number of rows. The file contains personal data: store and share it accordingly.</p>}

      <div className="mt-21">
        {failed ? (
          <Notice title="The subscribers could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        ) : rows.length ? (
          <div className="scroll-x">
            <table className="table-gx min-w-[44rem] text-sm">
              <caption className="sr-only">Newsletter subscribers, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Consent given</th>
                  <th scope="col">Policy version</th>
                  <th scope="col">Source</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[18rem] truncate text-ink">{row.email}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.consent_at)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{row.consent_version}</td>
                    <td className="num max-w-[12rem] truncate text-ink-2">{row.source}</td>
                    <td className="whitespace-nowrap">
                      {row.unsubscribed_at ? (
                        <span className="state state-off">Unsubscribed · {fmtDateTime(row.unsubscribed_at)}</span>
                      ) : (
                        <span className="state state-open">Subscribed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : pastEnd ? (
          <Empty title="There is no such page" />
        ) : (
          <Empty title="No subscribers yet">
            <p>When someone subscribes to the newsletter on the website, the address appears here with the consent that was recorded.</p>
          </Empty>
        )}
      </div>

      {!failed && !pastEnd && total > 0 && (
        <Pager page={page} pageCount={pageCount} total={total} noun={total === 1 ? "subscriber" : "subscribers"} href={(p) => (p > 1 ? `/control/subscribers?page=${p}` : "/control/subscribers")} />
      )}
    </>
  );
}

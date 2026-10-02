import Link from "next/link";
import { ControlHead, Empty, Notice, Pager } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import type { PersonListRow } from "@/lib/supabase/types";

export type CustomersViewProps = {
  /** one row per e-mail address, newest contact first */
  people: PersonListRow[];
  /** the search text after it was reduced to safe characters */
  q: string;
  total: number;
  page: number;
  pageCount: number;
  failed: boolean;
  pastEnd: boolean;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** How many tickets, and how many of them still need somebody. Said in words. */
function ticketCount(row: PersonListRow): string {
  if (!row.tickets) return "None";
  return row.open_tickets ? `${row.tickets}, ${row.open_tickets} open` : `${row.tickets}, none open`;
}

function Subscribed({ on }: { on: boolean }) {
  return on ? <span className="state state-open whitespace-nowrap">Subscribed</span> : <span className="state state-off whitespace-nowrap">Not subscribed</span>;
}

/**
 * Presentation only. A person is linked by `key`, a hash of the address, so
 * that an address never appears in a link this page generates.
 */
export function CustomersView({ people, q, total, page, pageCount, failed, pastEnd }: CustomersViewProps) {
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/control/customers?${s}` : "/control/customers";
  };

  return (
    <>
      <ControlHead title="Customers" lead="Everyone who has contacted GIO4X, one record per e-mail address, put together from enquiries, support tickets and newsletter subscriptions. Newest contact first." />

      <div className="mt-21">
        <Notice title="These are people who have written in, not client accounts">
          There are no client accounts in this database yet. Account, verification and trading details will appear here when clients can register.
        </Notice>
      </div>

      <form method="get" action="/control/customers" role="search" aria-label="Search people" className="mt-21 grid gap-13 border-b border-line pb-21 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="field">
          <label htmlFor="customers-q">Name or e-mail</label>
          <input id="customers-q" name="q" type="search" className="input" defaultValue={q} maxLength={100} placeholder="Part of a name or an address" autoComplete="off" spellCheck={false} aria-describedby="customers-q-hint" />
          <p id="customers-q-hint" className="field-hint">
            Letters, digits and @ . _ + - only; anything else, including spaces, is removed. For a full name, search one word of it.
          </p>
        </div>
        <div className="flex gap-8 sm:pb-[1.625rem]">
          <button type="submit" className="btn btn-primary">
            Search
          </button>
          {q && (
            <Link href="/control/customers" className="btn btn-quiet">
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="mt-13">
        {failed ? (
          <Notice title="The people could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        ) : people.length ? (
          <>
            <div className="scroll-x hidden md:block">
              <table className="table-gx min-w-[56rem] text-sm">
                <caption className="sr-only">{q ? "People matching the search, newest contact first" : "Everyone who has contacted GIO4X, newest contact first"}</caption>
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col">First contact</th>
                    <th scope="col">Last contact</th>
                    <th scope="col">Enquiries</th>
                    <th scope="col">Tickets</th>
                    <th scope="col">Newsletter</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((row) => (
                    <tr key={row.key}>
                      <td className="max-w-[18rem] py-8">
                        <Link href={`/control/customers/${row.key}`} className="link block truncate text-sm font-medium">
                          {row.name ?? "No name given"}
                        </Link>
                        <span className="block truncate text-xs text-ink-3">{row.email}</span>
                      </td>
                      <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.first_seen)}</td>
                      <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.last_seen)}</td>
                      <td className="num text-ink-2">{row.enquiries || "None"}</td>
                      <td className={`num whitespace-nowrap ${row.open_tickets ? "font-medium text-ink" : "text-ink-2"}`}>{ticketCount(row)}</td>
                      <td>
                        <Subscribed on={row.subscribed} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden" aria-label={q ? "People matching the search" : "Everyone who has contacted GIO4X"}>
              {people.map((row) => (
                <li key={row.key} className="border-b border-line">
                  <Link href={`/control/customers/${row.key}`} className="block py-13">
                    <span className="flex items-center justify-between gap-13">
                      <span className="min-w-0 truncate text-sm font-medium text-accent">{row.name ?? "No name given"}</span>
                      <Subscribed on={row.subscribed} />
                    </span>
                    <span className="block truncate text-xs text-ink-3">{row.email}</span>
                    <span className="mt-8 flex flex-wrap gap-x-13 gap-y-3 text-xs text-ink-2">
                      <span>{plural(row.enquiries, "enquiry", "enquiries")}</span>
                      <span className={row.open_tickets ? "font-medium text-ink" : ""}>
                        {plural(row.tickets, "ticket", "tickets")}
                        {row.tickets ? (row.open_tickets ? `, ${row.open_tickets} open` : ", none open") : ""}
                      </span>
                    </span>
                    <span className="num mt-5 block text-xs text-ink-3">Last contact {fmtDateTime(row.last_seen)}</span>
                    <span className="num block text-xs text-ink-3">First contact {fmtDateTime(row.first_seen)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : pastEnd ? (
          <Empty title="There is no such page">
            <p>
              <Link href={href(1)} className="link">
                Go to the first page
              </Link>
            </p>
          </Empty>
        ) : q ? (
          <Empty title="Nobody matches this search">
            <p>
              The search looks for the text anywhere in a name or an address. Try a shorter part of it, or{" "}
              <Link href="/control/customers" className="link">
                clear the search
              </Link>
              .
            </p>
          </Empty>
        ) : (
          <Empty title="Nobody has written in yet">
            <p>When someone sends the contact form, opens a support ticket or subscribes to the newsletter on the website, they appear here once, under their e-mail address.</p>
          </Empty>
        )}
      </div>

      {!failed && !pastEnd && total > 0 && <Pager page={page} pageCount={pageCount} total={total} noun={total === 1 ? "person" : "people"} href={href} />}
    </>
  );
}

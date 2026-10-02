import Link from "next/link";
import {
  ACTIVITY_GROUPS,
  ACTIVITY_PERIODS,
  ACTIVITY_SORTS,
  DEFAULT_ACTIVITY_PERIOD,
  LAST_ACTIVITY_DEFINITION,
  activityHref,
  defaultDir,
  shortDuration,
  sortLabel,
  type ActivityColumn,
  type ActivityDir,
  type ActivityPeriod,
  type ActivitySort,
} from "@/components/control/activity";
import { ControlHead, Empty, Notice } from "@/components/control/bits";
import { fmtDateTime, ROLE_LABEL } from "@/components/control/format";
import type { StaffActivityRow } from "@/lib/supabase/types";

export type ActivityViewProps = {
  /** "team": everyone, for a holder of activity.read. "own": the caller's own row and nothing else. */
  scope: "team" | "own";
  days: ActivityPeriod;
  /** the start of the period, as the page worked it out when it asked the database */
  since: string;
  /** already in the chosen order; null when the database did not answer, or answered with something that is not activity */
  rows: StaffActivityRow[] | null;
  me: string;
  sort: ActivitySort;
  dir: ActivityDir;
};

/** An order in words: a name runs A to Z, a time runs earliest to latest, a figure smallest to largest. */
function dirWords(sort: ActivitySort, dir: ActivityDir): string {
  if (sort === "name") return dir === "asc" ? "A to Z" : "Z to A";
  if (sort === "last_activity") return dir === "asc" ? "earliest first" : "latest first";
  return dir === "asc" ? "smallest first" : "largest first";
}

const roleLabel = (role: string) => (Object.prototype.hasOwnProperty.call(ROLE_LABEL, role) ? ROLE_LABEL[role as keyof typeof ROLE_LABEL] : role);

/** One figure as it is printed: a count, or a duration, or a dash that a screen reader hears as "none". */
function Figure({ row, column }: { row: StaffActivityRow; column: ActivityColumn }) {
  if (column.key === "first_reply_median_minutes") {
    const minutes = row.first_reply_median_minutes;
    return minutes === null ? (
      <>
        <span aria-hidden>–</span>
        <span className="sr-only">none to measure</span>
      </>
    ) : (
      <>{shortDuration(minutes)}</>
    );
  }
  return <>{row[column.key]}</>;
}

function LastActivity({ iso }: { iso: string | null }) {
  return iso ? <>{fmtDateTime(iso)}</> : <>No audit entry yet</>;
}

function Who({ row, me }: { row: StaffActivityRow; me: string }) {
  return (
    <>
      <span className="block break-words text-sm font-medium text-ink">
        {row.display_name}
        {row.user_id === me && <span className="font-normal text-ink-3"> (you)</span>}
      </span>
      <span className="mt-3 block text-xs font-normal text-ink-3">
        {roleLabel(row.role)}
        {!row.active && " · access off"}
      </span>
    </>
  );
}

/**
 * One person as a card: the layout for a phone, and the whole of the screen
 * for somebody who may see only their own figures. Each figure keeps its
 * label, so nothing depends on a column position.
 */
function PersonCard({ row, me, named }: { row: StaffActivityRow; me: string; named: boolean }) {
  return (
    <section className="gxc-card min-w-0" aria-label={named ? row.display_name : "Your figures"}>
      <div className="gxc-card-head">
        {named ? (
          <h2 className="min-w-0">
            <Who row={row} me={me} />
          </h2>
        ) : (
          <h2 className="gxc-card-title">Your figures</h2>
        )}
        <p className="text-xs text-ink-3">
          Last activity{" "}
          <span className="num text-ink-2">
            <LastActivity iso={row.last_activity} />
          </span>
        </p>
      </div>
      <div className="gxc-card-body grid gap-13">
        {ACTIVITY_GROUPS.map((group) => (
          <div key={group.key} className="min-w-0">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-3">{group.label}</h3>
            {named ? (
              // one of several people on a phone: label and figure on one line, so a person is one screen and not three
              <dl className="mt-3">
                {group.columns.map((column) => (
                  <div key={column.key} className="flex items-baseline justify-between gap-13 border-b border-line py-5">
                    <dt className="text-sm text-ink-2">{column.label}</dt>
                    <dd className="num text-sm font-semibold text-ink">
                      <Figure row={row} column={column} />
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <dl className="mt-5 grid grid-cols-2 gap-8 sm:grid-cols-3">
                {group.columns.map((column) => (
                  <div key={column.key} className="gxc-stat">
                    <dt className="gxc-stat-label">{column.label}</dt>
                    <dd className="gxc-stat-value">
                      <Figure row={row} column={column} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** A column heading that orders the table by its column. The arrow repeats what aria-sort already says. */
function SortHead({ sort, label, title, current, dir, days, numeric = true }: { sort: ActivitySort; label: string; title: string; current: ActivitySort; dir: ActivityDir; days: ActivityPeriod; numeric?: boolean }) {
  const active = sort === current;
  // a second press on the column in use reverses it; a new column starts in its natural order
  const next: ActivityDir = active ? (dir === "asc" ? "desc" : "asc") : defaultDir(sort);
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined} className={`!whitespace-normal !pr-8 align-bottom !text-[0.625rem] !tracking-[0.05em] ${numeric ? "num" : ""}`}>
      <Link
        href={activityHref(days, sort, next)}
        title={`Order by ${title}, ${dirWords(sort, next)}`}
        className={`inline-flex min-h-[1.75rem] items-end gap-3 leading-tight hover:text-ink ${numeric ? "justify-end text-right" : ""} ${active ? "text-ink" : ""}`}
      >
        <span className={numeric ? "max-w-[5rem]" : ""}>{label}</span>
        {active && <span aria-hidden>{dir === "asc" ? "↑" : "↓"}</span>}
      </Link>
    </th>
  );
}

/**
 * Presentation only. Every figure arrives in `rows`, counted by the database
 * (staff_activity or my_activity) from real rows when the page was opened.
 * Nothing is scored, ranked or compared with a target: the table can be put in
 * order by a column, and that is all.
 */
export function ActivityView({ scope, days, since, rows, me, sort, dir }: ActivityViewProps) {
  const team = scope === "team";
  const tab = (current: boolean) =>
    `flex h-[2.75rem] items-center border-b-2 px-13 text-sm transition-colors duration-fast ${current ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"}`;
  const quiet =
    !!rows && rows.length > 0 && rows.every((row) => ACTIVITY_GROUPS.every((g) => g.columns.every((c) => (c.key === "first_reply_median_minutes" ? row.first_reply_median_minutes === null : row[c.key] === 0))));

  return (
    <>
      <ControlHead
        title={team ? "Team activity" : "Your activity"}
        lead={
          team
            ? "What this console recorded about each member of staff’s work on tickets, live chat and enquiries. Counted from the database when this page was opened."
            : "What this console recorded about your own work on tickets, live chat and enquiries. Counted from the database when this page was opened."
        }
      />

      <div className="mt-21 border-b border-line">
        <nav aria-label="Period" className="flex flex-wrap">
          {ACTIVITY_PERIODS.map((p) => (
            <Link key={p} href={activityHref(p, sort, dir)} aria-current={p === days ? "page" : undefined} className={tab(p === days)}>
              {p} days
            </Link>
          ))}
        </nav>
      </div>

      {!rows ? (
        <div className="mt-13">
          <Notice title="The activity could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        </div>
      ) : (
        <>
          <p className="mt-13 text-sm text-ink-2">
            The last {days} days: everything recorded since <span className="num font-medium text-ink">{fmtDateTime(since)}</span>.
            {quiet && " Nothing was recorded in this period: every figure is zero."}
          </p>

          <div className="mt-13">
            <Notice title="What these figures are not">
              <p>
                They count events recorded in this console. They are not a measure of the quality of anybody’s work: a careful answer and a hurried one each count once, and work done outside the console, such as a telephone call or an e-mail from a
                mailbox, is not counted at all.
              </p>
              <p className="mt-5">Small numbers over a short period mean little. One busy afternoon, a day of leave or a different shift moves them, and neither role nor hours worked is taken into account.</p>
            </Notice>
          </div>

          {!team && (
            <div className="mt-13">
              <Notice title="Only your own figures are shown">Administrators and compliance can see the same figures for everyone on staff. No other role can see yours in this console.</Notice>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="mt-13">
              <Empty title={team ? "Nobody is on staff yet" : "There is no record for you yet"}>
                <p>{team ? "People appear here once they have been given access on the Team & Access screen." : "Your figures appear here once your staff record exists."}</p>
              </Empty>
            </div>
          ) : !team ? (
            <div className="mt-13 grid gap-13">
              {rows.map((row) => (
                <PersonCard key={row.user_id} row={row} me={me} named={false} />
              ))}
            </div>
          ) : (
            <>
              {/* from `md` up: one table, scrolled sideways inside its card when the window is narrower than its columns */}
              <div className="scroll-x mt-13 hidden md:block">
                <table className="table-gx min-w-[64rem] text-sm">
                  <caption className="sr-only">
                    Team activity over the last {days} days, ordered by {sortLabel(sort).toLowerCase()}, {dirWords(sort, dir)}. Each column heading is a link that orders the table by that column.
                  </caption>
                  <colgroup>
                    <col />
                  </colgroup>
                  {ACTIVITY_GROUPS.map((group) => (
                    <colgroup key={group.key} span={group.columns.length} />
                  ))}
                  <colgroup>
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <td className="!h-auto !border-b-0" />
                      {ACTIVITY_GROUPS.map((group) => (
                        <th key={group.key} scope="colgroup" colSpan={group.columns.length} className="!border-b-0 !pb-0 !text-center !text-ink-2">
                          <span className="block border-b border-line pb-5">{group.label}</span>
                        </th>
                      ))}
                      <td className="!h-auto !border-b-0" />
                    </tr>
                    <tr>
                      <SortHead sort="name" label="Person" title="name" current={sort} dir={dir} days={days} numeric={false} />
                      {ACTIVITY_GROUPS.flatMap((group) => group.columns.map((column) => <SortHead key={column.key} sort={column.key} label={column.label} title={column.full.toLowerCase()} current={sort} dir={dir} days={days} />))}
                      <SortHead sort="last_activity" label="Last activity" title="last activity" current={sort} dir={dir} days={days} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.user_id}>
                        <th scope="row" className="min-w-[9.5rem] max-w-[13rem] !whitespace-normal !border-b-line !py-8 !pr-8 !normal-case !tracking-normal">
                          <Who row={row} me={me} />
                        </th>
                        {ACTIVITY_GROUPS.flatMap((group) =>
                          group.columns.map((column) => (
                            <td key={column.key} className="num num-right whitespace-nowrap !pr-8 text-ink">
                              <Figure row={row} column={column} />
                            </td>
                          )),
                        )}
                        {/* the date and the time may sit on two lines: the column stays narrow enough for the table to fit a desktop window */}
                        <td className="num num-right min-w-[6.5rem] !pr-0 text-xs text-ink-2">
                          <LastActivity iso={row.last_activity} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* a phone: the same people in the same order, one card each, with the order chosen from a list */}
              <div className="mt-13 md:hidden">
                <form method="get" action="/control/activity" className="gxc-card grid gap-8 p-13">
                  {days !== DEFAULT_ACTIVITY_PERIOD && <input type="hidden" name="days" value={days} />}
                  <div className="field">
                    <label htmlFor="activity-sort">Order by</label>
                    <select id="activity-sort" name="sort" className="select" defaultValue={sort}>
                      {ACTIVITY_SORTS.map((key) => (
                        <option key={key} value={key}>
                          {sortLabel(key)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="activity-dir">Direction</label>
                    <select id="activity-dir" name="dir" className="select" defaultValue={dir}>
                      <option value="desc">Largest, latest or Z first</option>
                      <option value="asc">Smallest, earliest or A first</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-ghost">
                    Apply
                  </button>
                </form>
                <div className="mt-13 grid gap-13">
                  {rows.map((row) => (
                    <PersonCard key={row.user_id} row={row} me={me} named />
                  ))}
                </div>
              </div>
            </>
          )}

          <section className="gxc-card mt-13" aria-labelledby="activity-definitions">
            <div className="gxc-card-head">
              <h2 id="activity-definitions" className="gxc-card-title">
                What each figure counts
              </h2>
            </div>
            <div className="gxc-card-body">
              <p className="max-w-measure text-sm text-ink-2">“The period” is the last {days} days up to the moment this page was opened. Times are UTC.</p>
              <div className="mt-13 grid gap-x-34 gap-y-13 lg:grid-cols-3">
                {ACTIVITY_GROUPS.map((group) => (
                  <div key={group.key} className="min-w-0">
                    <h3 className="text-sm font-semibold text-ink">{group.label}</h3>
                    <dl className="mt-5 grid gap-8">
                      {group.columns.map((column) => (
                        <div key={column.key}>
                          <dt className="inline text-sm font-medium text-ink">{column.label}: </dt>
                          <dd className="inline text-sm text-ink-2">{column.definition}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
              <dl className="mt-13 border-t border-line pt-13">
                <div className="max-w-measure">
                  <dt className="inline text-sm font-medium text-ink">Last activity: </dt>
                  <dd className="inline text-sm text-ink-2">{LAST_ACTIVITY_DEFINITION}</dd>
                </div>
              </dl>
            </div>
          </section>
        </>
      )}
    </>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { ControlHead, Notice, StatusBadge } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { Icon, type IconName } from "@/components/control/icons";
import { ReplyDue, TicketStatusBadge } from "@/components/control/ticket-bits";
import { COMPLIANCE_CATEGORIES, TICKET_CATEGORY_LABEL } from "@/lib/server/constants";
import type { LeadStatus, TicketPriority, TicketStatus } from "@/lib/supabase/types";

export type ComplianceGroup = (typeof COMPLIANCE_CATEGORIES)[number];

type MatterBase = {
  id: string;
  reference: string;
  group: ComplianceGroup;
  name: string;
  email: string;
  created_at: string;
  assigned_to: string | null;
  /** when it left the open register; null while it is open */
  closed_at: string | null;
};

/** One line of the register: a support ticket or an enquiry, reduced to what the register shows. */
export type Matter =
  | (MatterBase & { kind: "ticket"; status: TicketStatus; priority: TicketPriority; first_response_at: string | null })
  | (MatterBase & { kind: "enquiry"; topic: string; status: LeadStatus });

/** How many are open in one group, by source. A source is null when the person's role does not include it. */
export type GroupCount = { tickets: number | null; enquiries: number | null };

export type ComplianceViewProps = {
  filter: ComplianceGroup | "";
  counts: Record<ComplianceGroup, GroupCount>;
  /** open matters for the current filter, oldest first */
  open: Matter[];
  /** how many are open for the current filter; more than `open.length` when the list was cut */
  openTotal: number;
  /** the most recently closed matters for the current filter */
  closed: Matter[];
  /** which sources this person's role includes */
  sources: { tickets: boolean; enquiries: boolean };
  names: Map<string, string>;
  me: string;
  /** rendered-at time, for ages and for "late" */
  now: number;
  failed: boolean;
};

const GROUP: Record<ComplianceGroup, { tab: string; noun: string; stat: string; icon: IconName }> = {
  complaint: { tab: "Complaints", noun: "complaints", stat: "Open complaints", icon: "inbox" },
  privacy: { tab: "Privacy", noun: "privacy requests", stat: "Open privacy requests", icon: "kyc" },
  security: { tab: "Security", noun: "security reports", stat: "Open security reports", icon: "compliance" },
};

const DAY = 24 * 60 * 60 * 1000;

/** Whole days between two moments, in words. */
function days(from: string, to: number): string {
  const start = new Date(from).getTime();
  if (Number.isNaN(start) || Number.isNaN(to)) return "–";
  const n = Math.max(0, Math.floor((to - start) / DAY));
  return n === 0 ? "Under a day" : n === 1 ? "1 day" : `${n} days`;
}

const matterHref = (m: Matter) => (m.kind === "ticket" ? `/control/tickets/${m.id}` : `/control/leads/${m.id}`);
const matterLabel = (m: Matter) => (m.kind === "ticket" ? TICKET_CATEGORY_LABEL[m.group] : m.topic);
const matterKey = (m: Matter) => `${m.kind}-${m.id}`;

function Kind({ kind }: { kind: Matter["kind"] }) {
  return <span className="whitespace-nowrap text-xs font-semibold text-ink">{kind === "ticket" ? "Ticket" : "Enquiry"}</span>;
}

function MatterStatus({ matter }: { matter: Matter }) {
  return matter.kind === "ticket" ? <TicketStatusBadge status={matter.status} /> : <StatusBadge status={matter.status} />;
}

/** Whether the person has had a first reply. Recorded for tickets only: enquiries are answered from staff mailboxes. */
function FirstReply({ matter, now }: { matter: Matter; now: number }) {
  if (matter.kind === "enquiry") return <span className="text-xs text-ink-3">Not recorded for enquiries</span>;
  if (matter.first_response_at) {
    return (
      <span className="text-xs">
        <span className="block font-semibold text-ink">Sent</span>
        <span className="num block whitespace-nowrap text-ink-3">{fmtDateTime(matter.first_response_at)}</span>
      </span>
    );
  }
  return (
    <span className="text-xs">
      <span className="block font-semibold text-ink">Not sent</span>
      <ReplyDue ticket={matter} now={now} />
    </span>
  );
}

function Card({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="gxc-card min-w-0">
      <div className="gxc-card-head">
        <h2 id={id} className="gxc-card-title">
          {title}
        </h2>
        {aside}
      </div>
      <div className="gxc-card-body">{children}</div>
    </section>
  );
}

/** The register as a table from `xl` up (it is wide) and as stacked rows below it. `mode` decides the time columns. */
function Matters({ matters, mode, caption, names, me, now }: { matters: Matter[]; mode: "open" | "closed"; caption: string; names: Map<string, string>; me: string; now: number }) {
  const assignee = (userId: string | null) => (!userId ? "Unassigned" : userId === me ? "You" : (names.get(userId) ?? "Assigned"));
  const span = (m: Matter) => (mode === "open" ? days(m.created_at, now) : m.closed_at ? days(m.created_at, new Date(m.closed_at).getTime()) : "–");

  return (
    <>
      {/* the card already frames the table: drop the frame the console gives a bare table */}
      <div className="scroll-x hidden !rounded-none !border-0 !p-0 !shadow-none xl:block">
        <table className="table-gx min-w-[58rem] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Type and category</th>
              <th scope="col">Reference</th>
              <th scope="col">Who</th>
              {mode === "open" ? (
                <th scope="col">Age and opened</th>
              ) : (
                <>
                  <th scope="col">Opened</th>
                  <th scope="col">Closed</th>
                  <th scope="col">Open for</th>
                </>
              )}
              <th scope="col">Status</th>
              <th scope="col">Assigned</th>
              {mode === "open" && <th scope="col">First reply</th>}
            </tr>
          </thead>
          <tbody>
            {matters.map((m) => (
              <tr key={matterKey(m)}>
                <td className="py-8">
                  <span className="block">
                    <Kind kind={m.kind} />
                  </span>
                  <span className="block text-xs text-ink-2">{matterLabel(m)}</span>
                </td>
                <td>
                  <Link href={matterHref(m)} className="link num whitespace-nowrap text-sm font-medium">
                    {m.reference}
                  </Link>
                </td>
                <td className="max-w-[11rem] py-8">
                  <span className="block truncate text-ink">{m.name}</span>
                  <span className="block truncate text-xs text-ink-3">{m.email}</span>
                </td>
                {mode === "open" ? (
                  <td className="py-8">
                    <span className="num block whitespace-nowrap font-semibold text-ink">{span(m)}</span>
                    <span className="num block whitespace-nowrap text-xs text-ink-3">{fmtDateTime(m.created_at)}</span>
                  </td>
                ) : (
                  <>
                    <td className="num whitespace-nowrap text-xs text-ink-2">{fmtDateTime(m.created_at)}</td>
                    <td className="num whitespace-nowrap text-xs text-ink-2">{fmtDateTime(m.closed_at)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{span(m)}</td>
                  </>
                )}
                <td>
                  <MatterStatus matter={m} />
                </td>
                <td className="text-ink-2">{assignee(m.assigned_to)}</td>
                {mode === "open" && (
                  <td className="py-8">
                    <FirstReply matter={m} now={now} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="xl:hidden" aria-label={caption}>
        {matters.map((m) => (
          <li key={matterKey(m)} className="border-b border-line last:border-b-0">
            <Link href={matterHref(m)} className="block py-13">
              <span className="flex items-center justify-between gap-13">
                <span className="num text-sm font-medium text-accent">{m.reference}</span>
                <MatterStatus matter={m} />
              </span>
              <span className="mt-5 flex flex-wrap items-baseline gap-x-8 text-sm">
                <Kind kind={m.kind} />
                <span className="text-ink-2">{matterLabel(m)}</span>
              </span>
              <span className="mt-5 block truncate text-sm text-ink">{m.name}</span>
              <span className="block truncate text-xs text-ink-3">{m.email}</span>
              <span className="mt-8 flex flex-wrap gap-x-13 gap-y-3 text-xs text-ink-3">
                <span className={mode === "open" ? "font-semibold text-ink" : ""}>{mode === "open" ? `Age: ${span(m)}` : `Open for: ${span(m)}`}</span>
                <span className="num">Opened {fmtDateTime(m.created_at)}</span>
                {mode === "closed" && <span className="num">Closed {fmtDateTime(m.closed_at)}</span>}
                <span>{assignee(m.assigned_to)}</span>
              </span>
              {mode === "open" && (
                <span className="mt-8 block">
                  <span className="sr-only">First reply: </span>
                  <FirstReply matter={m} now={now} />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Presentation only: the register of matters that need careful handling.
 * Every figure arrives as a prop, counted from real rows as the signed-in
 * member of staff. Nothing is changed here; a matter is worked on its own page.
 */
export function ComplianceView({ filter, counts, open, openTotal, closed, sources, names, me, now, failed }: ComplianceViewProps) {
  const href = (group: ComplianceGroup | "") => (group ? `/control/compliance?category=${group}` : "/control/compliance");
  const tab = (current: boolean) =>
    `flex h-[2.75rem] items-center whitespace-nowrap border-b-2 px-13 text-sm transition-colors duration-fast ${current ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"}`;
  const sum = (c: GroupCount) => (c.tickets ?? 0) + (c.enquiries ?? 0);
  const breakdown = (c: GroupCount) =>
    [c.tickets === null ? null : `${c.tickets} ${c.tickets === 1 ? "ticket" : "tickets"}`, c.enquiries === null ? null : `${c.enquiries} ${c.enquiries === 1 ? "enquiry" : "enquiries"}`].filter(Boolean).join(" · ");
  const what = filter ? GROUP[filter].noun : "matters";

  return (
    <>
      <ControlHead
        title="Compliance"
        lead="A register of the matters that need careful handling, drawn from two places: support tickets in the categories complaint, privacy and security, and enquiries whose topic is Complaint, Privacy or Security. Read-only: open a matter to work it."
      />

      <div className="mt-21 grid gap-13">
        <Notice title="What this page is not yet">
          There is no risk scoring, no sanctions screening and there are no case files. Those need client records and a screening provider, and are listed in <span className="num">docs/BACKOFFICE-PLAN.md</span>.
        </Notice>
        {failed && (
          <Notice title="The register could not be read" tone="error">
            The database did not answer every query, so no figures are shown. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        )}
        {!failed && !sources.tickets && <Notice title="Your role does not include tickets">Only enquiries are counted and listed below.</Notice>}
        {!failed && !sources.enquiries && <Notice title="Your role does not include enquiries">Only support tickets are counted and listed below.</Notice>}
      </div>

      {!failed && (
        <>
          <div className="mt-13 grid gap-13 sm:grid-cols-3">
            {COMPLIANCE_CATEGORIES.map((group) => (
              <Link key={group} href={href(group)} className="gxc-stat" aria-current={filter === group ? "page" : undefined}>
                <span className="gxc-stat-icon">
                  <Icon name={GROUP[group].icon} size={16} />
                </span>
                <span className="gxc-stat-label">{GROUP[group].stat}</span>
                <span className="gxc-stat-value">{sum(counts[group])}</span>
                <span className="num text-xs text-ink-3">{breakdown(counts[group])}</span>
              </Link>
            ))}
          </div>
          <p className="mt-8 text-xs text-ink-3">Open means a ticket that is open or waiting for the customer, and an enquiry that is new, open or waiting. Enquiries marked as spam are left out.</p>

          <nav aria-label="Category" className="scroll-x mt-13 flex border-b border-line">
            <Link href={href("")} aria-current={filter === "" ? "page" : undefined} className={tab(filter === "")}>
              All
            </Link>
            {COMPLIANCE_CATEGORIES.map((group) => (
              <Link key={group} href={href(group)} aria-current={filter === group ? "page" : undefined} className={tab(filter === group)}>
                {GROUP[group].tab}
              </Link>
            ))}
          </nav>

          <div className="mt-13 grid gap-13">
            <Card id="compliance-open" title={`Open ${what}, oldest first`} aside={<span className="num text-xs text-ink-3">{openTotal} open</span>}>
              {open.length ? (
                <>
                  <Matters matters={open} mode="open" caption={`Open ${what}, oldest first`} names={names} me={me} now={now} />
                  {openTotal > open.length && (
                    <p className="num mt-13 text-xs text-ink-3">
                      Showing the oldest {open.length} of {openTotal}.
                    </p>
                  )}
                  <p className="mt-13 text-xs text-ink-3">
                    Age is counted in whole days from the moment the matter was opened. A first reply is recorded for tickets only; &ldquo;Reply due&rdquo; and &ldquo;Late&rdquo; measure against an internal target for staff, not a promise
                    made to the customer.
                  </p>
                </>
              ) : (
                <p className="py-13 text-sm text-ink-3">{filter ? `No open ${what}.` : "Nothing is open: no complaints, privacy requests or security reports are waiting."}</p>
              )}
            </Card>

            <Card id="compliance-closed" title={`Recently closed ${what}`} aside={<span className="text-xs text-ink-3">The 25 most recent</span>}>
              {closed.length ? (
                <>
                  <Matters matters={closed} mode="closed" caption={`The most recently closed ${what}, newest first`} names={names} me={me} now={now} />
                  <p className="mt-13 text-xs text-ink-3">A ticket is closed when it is solved or closed. An enquiry has no closing time of its own: the time shown is its last change, which is normally the moment it was resolved.</p>
                </>
              ) : (
                <p className="py-13 text-sm text-ink-3">{filter ? `No ${what} have been closed yet.` : "Nothing has been closed yet."}</p>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}

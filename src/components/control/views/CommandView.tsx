import Link from "next/link";
import type { ReactNode } from "react";
import { ControlHead, Notice } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { Icon, type IconName } from "@/components/control/icons";
import type { CommandSummary } from "@/lib/supabase/types";

export type CommandViewProps = {
  /** null when the database did not answer, or answered with something that is not a summary */
  summary: CommandSummary | null;
};

function Stat({ href, icon, label, value }: { href: string; icon: IconName; label: string; value: number | string }) {
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

function Area({ title, four = false, children }: { title: string; four?: boolean; children: ReactNode }) {
  return (
    <section className="gxc-card min-w-0">
      <div className="gxc-card-head">
        <h2 className="gxc-card-title">{title}</h2>
      </div>
      <div className="gxc-card-body">
        <div className={`grid grid-cols-2 gap-8 ${four ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>{children}</div>
      </div>
    </section>
  );
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** What needs somebody now, and where it is dealt with. Only the items whose count is above zero. */
function attention(s: CommandSummary): { key: string; href: string; text: string; detail?: string }[] {
  const items: { key: string; href: string; text: string; detail?: string }[] = [];
  if (s.leads.unassigned > 0) {
    items.push({ key: "leads", href: "/control/leads?status=new", text: plural(s.leads.unassigned, "new enquiry has no owner", "new enquiries have no owner") });
  }
  if (s.follow_ups.overdue > 0) {
    items.push({ key: "tasks", href: "/control/tasks?who=all", text: plural(s.follow_ups.overdue, "follow-up is overdue", "follow-ups are overdue") });
  }
  if (s.tickets.unanswered > 0) {
    items.push({
      key: "tickets",
      href: "/control/tickets",
      text: plural(s.tickets.unanswered, "ticket is awaiting a first reply", "tickets are awaiting a first reply"),
      // the target is the team's own, by priority; it is never a promise made to the customer
      detail: s.tickets.late > 0 ? `${s.tickets.late} of them late against the internal target` : "None of them late against the internal target",
    });
  }
  if (s.tickets.complaints_open > 0) {
    items.push({ key: "complaints", href: "/control/compliance", text: plural(s.tickets.complaints_open, "complaint is open", "complaints are open") });
  }
  if (s.chats.waiting > 0) {
    items.push({ key: "chats", href: "/control/chats", text: plural(s.chats.waiting, "chat is waiting for a member of staff", "chats are waiting for a member of staff") });
  }
  if (s.staff.pending_changes > 0) {
    items.push({ key: "staff", href: "/control/staff", text: plural(s.staff.pending_changes, "staff change is waiting for approval", "staff changes are waiting for approval") });
  }
  // open incidents the public status page does not show yet
  const unpublished = s.site.incidents_open - s.site.incidents_published;
  if (unpublished > 0) {
    items.push({ key: "incidents", href: "/control/config", text: plural(unpublished, "open incident is not yet published", "open incidents are not yet published") });
  }
  return items;
}

/** The parts of the business this screen cannot report on yet, and the menu items that say so. */
const NOT_YET: { title: string; text: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Client accounts",
    text: "Accounts opened and identity checks waiting for review will appear here once client records exist. The people listed under Customers have written in; they are not client accounts.",
    links: [{ href: "/control/kyc", label: "KYC" }],
  },
  {
    title: "Money in and out",
    text: "Deposits and withdrawals waiting for approval will appear here once the general ledger and the payment routes are in place.",
    links: [
      { href: "/control/funds", label: "Funds & Settlement" },
      { href: "/control/ledger", label: "General Ledger" },
    ],
  },
  {
    title: "Trading exposure",
    text: "Open positions and exposure by instrument will appear here once a trading platform is connected.",
    links: [
      { href: "/control/trades", label: "Trade Log" },
      { href: "/control/broker", label: "Broker Controls" },
    ],
  },
];

/**
 * Presentation only: one screen of what needs attention now. Every figure
 * arrives in `summary`, counted by the database (command_summary) from real
 * rows at the time shown; nothing is estimated and zero is shown as zero.
 */
export function CommandView({ summary }: CommandViewProps) {
  const items = summary ? attention(summary) : [];

  return (
    <>
      <ControlHead
        title="Command Centre"
        lead="What needs attention now, across every section that exists."
        actions={summary ? <p className="num text-xs text-ink-3">As of {fmtDateTime(summary.at)}</p> : undefined}
      />

      {!summary ? (
        <div className="mt-21">
          <Notice title="The summary could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        </div>
      ) : (
        <>
          <section className="gxc-card mt-21" aria-labelledby="command-attention">
            <div className="gxc-card-head">
              <h2 id="command-attention" className="gxc-card-title">
                Needs attention
              </h2>
              {items.length > 0 && <span className="num text-xs text-ink-3">{plural(items.length, "item", "items")}</span>}
            </div>
            <div className="gxc-card-body">
              {items.length ? (
                <ul className="grid gap-8 md:grid-cols-2">
                  {items.map((item) => (
                    <li key={item.key}>
                      <Link href={item.href} className="gxc-row h-full">
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink">{item.text}</span>
                          {item.detail && <span className="block text-xs text-ink-3">{item.detail}</span>}
                        </span>
                        <span aria-hidden className="shrink-0 text-sm text-accent">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-2">Nothing needs attention right now: no enquiry without an owner, nothing overdue, no ticket or chat waiting, no staff change to approve, no unpublished incident.</p>
              )}
            </div>
          </section>

          <div className="mt-13 grid gap-13 lg:grid-cols-2">
            <Area title="Enquiries">
              <Stat href="/control/leads?status=new" icon="inbox" label="New" value={summary.leads.new} />
              <Stat href="/control/leads?status=open" icon="leads" label="Open or waiting" value={summary.leads.open} />
              <Stat href="/control/leads" icon="clock" label="Last 24 hours" value={summary.leads.last_24h} />
            </Area>
            <Area title="Follow-ups">
              <Stat href="/control/tasks?who=all" icon="tasks" label="Open" value={summary.follow_ups.open} />
              <Stat href="/control/tasks?who=all" icon="clock" label="Overdue" value={summary.follow_ups.overdue} />
            </Area>
            <Area title="Tickets">
              <Stat href="/control/tickets" icon="tickets" label="Open" value={summary.tickets.open} />
              <Stat href="/control/tickets" icon="clock" label="Waiting for customer" value={summary.tickets.pending} />
              <Stat href="/control/tickets" icon="customers" label="Unassigned" value={summary.tickets.unassigned} />
            </Area>
            <Area title="Live chat" four>
              <Stat href="/control/config" icon="config" label="Website chat" value={summary.chats.enabled ? "On" : "Off"} />
              <Stat href="/control/chats" icon="team" label="Staff present now" value={summary.chats.staff_online} />
              <Stat href="/control/chats" icon="clock" label="Waiting" value={summary.chats.waiting} />
              <Stat href="/control/chats" icon="chats" label="Active" value={summary.chats.active} />
            </Area>
            <Area title="Team">
              <Stat href="/control/staff" icon="team" label="Active staff" value={summary.staff.active} />
              <Stat href="/control/staff" icon="clock" label="Pending changes" value={summary.staff.pending_changes} />
            </Area>
            <Area title="Website">
              <Stat href="/control/config" icon="config" label="Announcement" value={summary.site.announcement_on ? "On" : "Off"} />
              <Stat href="/control/config" icon="compliance" label="Open incidents" value={summary.site.incidents_open} />
              <Stat href="/control/config" icon="dashboard" label="Published incidents" value={summary.site.incidents_published} />
            </Area>
            <Area title="Audience">
              <Stat href="/control/subscribers" icon="subscribers" label="Active subscribers" value={summary.audience.subscribers} />
            </Area>
            <Area title="Audit">
              <Stat href="/control/audit" icon="audit" label="Entries, last 24 hours" value={summary.audit_24h} />
            </Area>
          </div>

          <section className="gxc-card mt-13" aria-labelledby="command-not-yet">
            <div className="gxc-card-head">
              <h2 id="command-not-yet" className="gxc-card-title">
                Not on this screen yet
              </h2>
              <span className="state state-pre">Not built</span>
            </div>
            <div className="gxc-card-body">
              <p className="max-w-measure text-sm text-ink-2">These parts of the business are not connected to the console, so there is nothing to count and no figure is shown for them.</p>
              <ul className="mt-13 grid gap-13 md:grid-cols-3">
                {NOT_YET.map((part) => (
                  <li key={part.title} className="min-w-0">
                    <h3 className="text-sm font-semibold text-ink">{part.title}</h3>
                    <p className="mt-3 text-sm text-ink-2">{part.text}</p>
                    <p className="mt-5 flex flex-wrap gap-x-13 gap-y-3 text-xs">
                      {part.links.map((link) => (
                        <Link key={link.href} href={link.href} className="link">
                          {link.label} (Soon)
                        </Link>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </>
  );
}

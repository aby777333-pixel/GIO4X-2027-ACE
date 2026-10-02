import Link from "next/link";
import type { ReactNode } from "react";
import { ControlHead, Facts, Notice, Score, StageBadge, StatusBadge } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/control/ticket-bits";
import { TICKET_CATEGORY_LABEL } from "@/lib/server/constants";
import type { PersonView } from "@/lib/supabase/types";

export type CustomerViewProps = {
  person: Pick<PersonView, "key" | "email" | "name" | "subscription" | "marketing_consent">;
  /** null when the person's role does not include enquiries (leads.read) */
  leads: PersonView["leads"] | null;
  /** null when the person's role does not include tickets (tickets.read) */
  tickets: PersonView["tickets"] | null;
  names: Map<string, string>;
  me: string;
};

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

const Quiet = ({ children }: { children: ReactNode }) => <p className="py-13 text-sm text-ink-3">{children}</p>;

/**
 * Presentation only: everything GIO4X holds under one e-mail address. Nothing
 * here can be changed; an enquiry or a ticket is worked on its own page.
 */
export function CustomerView({ person, leads, tickets, names, me }: CustomerViewProps) {
  const assignee = (userId: string | null) => (!userId ? "Unassigned" : userId === me ? "You" : (names.get(userId) ?? "Assigned"));
  const sub = person.subscription;
  const openTickets = tickets ? tickets.filter((t) => t.status === "open" || t.status === "pending").length : 0;

  return (
    <>
      <p className="text-xs text-ink-3">
        <Link href="/control/customers" className="link-quiet">
          Customers
        </Link>
        <span aria-hidden className="mx-8 inline-block h-px w-8 bg-line-strong align-middle" />
        <span className="text-ink-2">{person.name ?? "No name given"}</span>
      </p>

      <div className="mt-13">
        <ControlHead
          title={<span className="break-words">{person.name ?? "No name given"}</span>}
          lead="A person who has contacted GIO4X, not a client account: there are no client accounts in this database yet. This page is read-only."
        />
      </div>

      <div className="mt-21 grid gap-13 lg:grid-cols-2">
        <Card id="person-contact" title="Contact">
          <Facts
            rows={[
              { label: "Name", value: person.name ?? "No name given" },
              {
                label: "E-mail",
                value: (
                  <a href={`mailto:${person.email}`} className="link">
                    {person.email}
                  </a>
                ),
              },
              ...(leads ? [{ label: "Enquiries", value: <span className="num">{leads.length}</span> }] : []),
              ...(tickets
                ? [
                    {
                      label: "Tickets",
                      value: (
                        <span className="num">
                          {tickets.length}
                          {tickets.length ? (openTickets ? `, ${openTickets} open` : ", none open") : ""}
                        </span>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          <p className="mt-13 text-xs text-ink-3">The name is the one given on the most recent enquiry or ticket. The console sends no e-mail: reply from your own mailbox.</p>
        </Card>

        <Card
          id="person-consent"
          title="Marketing and newsletter"
          aside={person.marketing_consent ? <span className="state state-open">Marketing: opted in</span> : <span className="state state-off">Marketing: not given</span>}
        >
          <Facts
            rows={[
              {
                label: "Marketing consent",
                value: person.marketing_consent ? "Opted in on at least one enquiry. The enquiry shows when." : "Not given on any enquiry. Do not send marketing to this address.",
              },
              {
                label: "Newsletter",
                value: !sub ? "Never subscribed" : sub.unsubscribed_at ? "Unsubscribed" : "Subscribed",
              },
              ...(sub
                ? [
                    { label: "Subscribed at", value: <span className="num">{fmtDateTime(sub.since)}</span> },
                    { label: "Policy version", value: <span className="num">{sub.consent_version}</span> },
                    ...(sub.unsubscribed_at ? [{ label: "Unsubscribed at", value: <span className="num">{fmtDateTime(sub.unsubscribed_at)}</span> }] : []),
                  ]
                : []),
            ]}
          />
          <p className="mt-13 text-xs text-ink-2">
            <strong className="font-semibold text-ink">Standing rule.</strong> Do not add an address to any mailing unless marketing consent is shown. A newsletter subscription covers the newsletter only, and ends when the person
            unsubscribes.
          </p>
        </Card>
      </div>

      <div className="mt-13 grid gap-13">
        <Card id="person-leads" title="Enquiries" aside={leads ? <span className="num text-xs text-ink-3">{leads.length} in total</span> : undefined}>
          {!leads ? (
            <Notice title="Your role does not include enquiries">Enquiries from this address are not shown. If you need them for your work, ask an administrator to change your role on the Staff page.</Notice>
          ) : leads.length ? (
            <>
              {/* the card already frames the table: drop the frame the console gives a bare table */}
              <div className="scroll-x hidden !rounded-none !border-0 !p-0 !shadow-none md:block">
                <table className="table-gx min-w-[52rem] text-sm">
                  <caption className="sr-only">Enquiries from this address, newest first</caption>
                  <thead>
                    <tr>
                      <th scope="col">Reference</th>
                      <th scope="col">Received</th>
                      <th scope="col">Topic</th>
                      <th scope="col">Stage</th>
                      <th scope="col">Status</th>
                      <th scope="col">Score</th>
                      <th scope="col">Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id}>
                        <td>
                          <Link href={`/control/leads/${lead.id}`} className="link num text-sm font-medium">
                            {lead.reference}
                          </Link>
                        </td>
                        <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(lead.created_at)}</td>
                        <td className="whitespace-nowrap text-ink-2">{lead.topic}</td>
                        <td>
                          <StageBadge stage={lead.stage} />
                        </td>
                        <td>
                          <StatusBadge status={lead.status} />
                        </td>
                        <td>
                          <Score value={lead.score} />
                        </td>
                        <td className="whitespace-nowrap text-ink-2">{assignee(lead.assigned_to)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="md:hidden" aria-label="Enquiries from this address, newest first">
                {leads.map((lead) => (
                  <li key={lead.id} className="border-b border-line last:border-b-0">
                    <Link href={`/control/leads/${lead.id}`} className="block py-13">
                      <span className="flex items-center justify-between gap-13">
                        <span className="num text-sm font-medium text-accent">{lead.reference}</span>
                        <StatusBadge status={lead.status} />
                      </span>
                      <span className="mt-5 block text-sm text-ink">{lead.topic}</span>
                      <span className="mt-8 flex items-center justify-between gap-13">
                        <StageBadge stage={lead.stage} />
                        <Score value={lead.score} />
                      </span>
                      <span className="mt-5 flex flex-wrap gap-x-13 text-xs text-ink-3">
                        <span className="num">{fmtDateTime(lead.created_at)}</span>
                        <span>{assignee(lead.assigned_to)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Quiet>No enquiries from this address.</Quiet>
          )}
        </Card>

        <Card id="person-tickets" title="Support tickets" aside={tickets ? <span className="num text-xs text-ink-3">{tickets.length} in total</span> : undefined}>
          {!tickets ? (
            <Notice title="Your role does not include tickets">Support tickets from this address are not shown. If you need them for your work, ask an administrator to change your role on the Staff page.</Notice>
          ) : tickets.length ? (
            <>
              <div className="scroll-x hidden !rounded-none !border-0 !p-0 !shadow-none md:block">
                <table className="table-gx min-w-[52rem] text-sm">
                  <caption className="sr-only">Support tickets from this address, newest first</caption>
                  <thead>
                    <tr>
                      <th scope="col">Reference</th>
                      <th scope="col">Opened</th>
                      <th scope="col">Subject</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Status</th>
                      <th scope="col">Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <td>
                          <Link href={`/control/tickets/${ticket.id}`} className="link num text-sm font-medium">
                            {ticket.reference}
                          </Link>
                        </td>
                        <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(ticket.created_at)}</td>
                        <td className="max-w-[20rem] py-8">
                          <span className="block truncate text-ink">{ticket.subject}</span>
                          <span className="block truncate text-xs text-ink-3">{TICKET_CATEGORY_LABEL[ticket.category]}</span>
                        </td>
                        <td>
                          <TicketPriorityBadge priority={ticket.priority} />
                        </td>
                        <td>
                          <TicketStatusBadge status={ticket.status} />
                        </td>
                        <td className="whitespace-nowrap text-ink-2">{assignee(ticket.assigned_to)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="md:hidden" aria-label="Support tickets from this address, newest first">
                {tickets.map((ticket) => (
                  <li key={ticket.id} className="border-b border-line last:border-b-0">
                    <Link href={`/control/tickets/${ticket.id}`} className="block py-13">
                      <span className="flex items-center justify-between gap-13">
                        <span className="num text-sm font-medium text-accent">{ticket.reference}</span>
                        <TicketStatusBadge status={ticket.status} />
                      </span>
                      <span className="mt-5 block break-words text-sm text-ink">{ticket.subject}</span>
                      <span className="mt-8 flex items-center justify-between gap-13 text-xs text-ink-3">
                        <span>{TICKET_CATEGORY_LABEL[ticket.category]}</span>
                        <TicketPriorityBadge priority={ticket.priority} />
                      </span>
                      <span className="mt-5 flex flex-wrap gap-x-13 text-xs text-ink-3">
                        <span className="num">{fmtDateTime(ticket.created_at)}</span>
                        <span>{assignee(ticket.assigned_to)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Quiet>No support tickets from this address.</Quiet>
          )}
        </Card>
      </div>
    </>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { ControlHead, Facts, Notice, Score, StageBadge, StatusBadge } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/control/ticket-bits";
import { splitMentions, TIMELINE_FILTER_LABEL, TIMELINE_FILTERS, type TimelineEvent, type TimelineFilter } from "@/components/control/timeline";
import { CustomerNoteForm } from "@/components/control/views/CustomerNoteForm";
import { CustomerTimeline } from "@/components/control/views/CustomerTimeline";
import { TICKET_CATEGORY_LABEL } from "@/lib/server/constants";
import type { PersonNoteRow, PersonView } from "@/lib/supabase/types";

export type CustomerTab = "timeline" | "records";

export type CustomerViewProps = {
  person: Pick<PersonView, "key" | "email" | "name" | "subscription" | "marketing_consent">;
  /** null when the person's role does not include enquiries (leads.read) */
  leads: PersonView["leads"] | null;
  /** null when the person's role does not include tickets (tickets.read) */
  tickets: PersonView["tickets"] | null;
  names: Map<string, string>;
  me: string;
  tab: CustomerTab;
  timeline: {
    show: TimelineFilter;
    /** set when the page was opened one step back in time (the "Load older" link without scripts) */
    before: string | null;
    events: TimelineEvent[];
    hasOlder: boolean;
    failed: boolean;
  };
  /** the role includes the audit log (audit.read): status, stage and escalation changes are audit entries */
  seesAudit: boolean;
  /** newest first; null when they could not be read */
  notes: Pick<PersonNoteRow, "id" | "author" | "body" | "mentions" | "created_at">[] | null;
  /** may write a note (customers.note) */
  canNote: boolean;
  /** display names of the colleagues who can be mentioned; names only, no ids */
  mentionable: string[];
  notice?: string;
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

const tabClass = (current: boolean) =>
  `flex h-[2.75rem] items-center border-b-2 px-13 text-sm transition-colors duration-fast ${current ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"}`;

/**
 * Presentation only: everything GIO4X holds under one e-mail address. The
 * timeline (the default) puts it on one line; "Enquiries and tickets" keeps the
 * two lists. Nothing about an enquiry or a ticket can be changed here: each is
 * worked on its own page. The one thing that can be written here is an
 * internal note about the person.
 */
export function CustomerView({ person, leads, tickets, names, me, tab, timeline, seesAudit, notes, canNote, mentionable, notice }: CustomerViewProps) {
  const assignee = (userId: string | null) => (!userId ? "Unassigned" : userId === me ? "You" : (names.get(userId) ?? "Assigned"));
  const author = (userId: string | null) => (!userId ? "A former member of staff" : userId === me ? "You" : (names.get(userId) ?? "A former member of staff"));
  const sub = person.subscription;
  const openTickets = tickets ? tickets.filter((t) => t.status === "open" || t.status === "pending").length : 0;
  const base = `/control/customers/${person.key}`;

  // a filter is offered only when the role could see something under it
  const filters = TIMELINE_FILTERS.filter((f) => (f === "enquiries" ? !!leads : f === "tickets" ? !!tickets : true));
  // what the database left out of this person's timeline for this role, in words
  const hidden = [
    ...(leads ? [] : ["enquiries, the notes written on them and their follow-ups (your role does not include enquiries)"]),
    ...(tickets ? [] : ["support tickets and the messages on them (your role does not include tickets)"]),
    ...(!seesAudit && (leads || tickets) ? ["changes of status and stage, and escalations (your role does not include the audit log, where they are recorded)"] : []),
  ];

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
          lead="A person who has contacted GIO4X, not a client account: there are no client accounts in this database yet. An enquiry or a ticket is worked on its own page; this page shows the whole history and holds the internal notes about the person."
          actions={
            canNote && tab === "timeline" ? (
              <a href="#notes" className="btn btn-ghost">
                Add a note
              </a>
            ) : undefined
          }
        />
      </div>

      {notice && (
        <div className="mt-21">
          <Notice title={notice} tone="ok" />
        </div>
      )}

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

      <div className="mt-21 border-b border-line">
        <nav aria-label="This person’s record" className="flex flex-wrap">
          <Link href={base} aria-current={tab === "timeline" ? "page" : undefined} className={tabClass(tab === "timeline")}>
            Timeline
          </Link>
          <Link href={`${base}?tab=records`} aria-current={tab === "records" ? "page" : undefined} className={tabClass(tab === "records")}>
            Enquiries and tickets
          </Link>
        </nav>
      </div>

      {tab === "timeline" ? (
        <div className="mt-13 grid items-start gap-13 lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)]">
          <section id="timeline" aria-labelledby="person-timeline" className="gxc-card min-w-0 scroll-mt-21">
            <div className="gxc-card-head">
              <h2 id="person-timeline" className="gxc-card-title">
                Timeline
              </h2>
              <span className="text-xs text-ink-3">Newest first, times in UTC</span>
            </div>
            <div className="gxc-card-body">
              <nav aria-label="Which events" className="flex flex-wrap gap-8">
                {filters.map((f) => (
                  <Link key={f} href={f === "all" ? `${base}#timeline` : `${base}?show=${f}#timeline`} aria-current={timeline.show === f ? "true" : undefined} className="chip">
                    {TIMELINE_FILTER_LABEL[f]}
                  </Link>
                ))}
              </nav>

              {timeline.before && (
                <p className="mt-13 text-sm text-ink-2">
                  Showing what happened before <span className="num">{fmtDateTime(timeline.before)}</span>.{" "}
                  <Link href={timeline.show === "all" ? `${base}#timeline` : `${base}?show=${timeline.show}#timeline`} className="link">
                    Back to the newest
                  </Link>
                </p>
              )}

              <div className="mt-13">
                {timeline.failed ? (
                  <Notice title="The timeline could not be read" tone="error">
                    The database did not answer. Reload the page; if this continues, check that the migrations have been applied. The lists under{" "}
                    <Link href={`${base}?tab=records`} className="link">
                      Enquiries and tickets
                    </Link>{" "}
                    are read separately.
                  </Notice>
                ) : timeline.events.length ? (
                  <CustomerTimeline
                    // a new list whenever the filter, the starting point or the newest event changes
                    key={`${timeline.show}|${timeline.before ?? ""}|${timeline.events[0]?.id ?? ""}|${timeline.events.length}`}
                    personKey={person.key}
                    show={timeline.show}
                    events={timeline.events}
                    hasOlder={timeline.hasOlder}
                    me={me}
                  />
                ) : (
                  <Quiet>
                    {timeline.before
                      ? "Nothing older is recorded."
                      : timeline.show === "all"
                        ? "Nothing is recorded for this person that your role includes."
                        : `Nothing under “${TIMELINE_FILTER_LABEL[timeline.show]}” for this person.`}
                  </Quiet>
                )}
              </div>

              <div className="mt-13 grid gap-5 border-t border-line pt-13 text-xs text-ink-3">
                {hidden.length > 0 && (
                  <p>
                    <strong className="font-semibold text-ink-2">Left out for your role:</strong> {hidden.join("; ")}. If you need them for your work, ask an administrator to change your role on the Staff page.
                  </p>
                )}
                <p>
                  <strong className="font-semibold text-ink-2">Live chats are not in the timeline.</strong> A chat records the visitor’s name and no e-mail address, so it cannot be tied to this person without guessing. Chats
                  are on the Live Chats screen.
                </p>
                <p>Text from a message or a note is shown as one line. The whole text is on the ticket or the enquiry.</p>
              </div>
            </div>
          </section>

          <section id="notes" aria-labelledby="person-notes" className="gxc-card min-w-0 scroll-mt-21">
            <div className="gxc-card-head">
              <h2 id="person-notes" className="gxc-card-title">
                Notes
              </h2>
              {notes && <span className="num text-xs text-ink-3">{notes.length} in total</span>}
            </div>
            <div className="gxc-card-body">
              <p className="text-xs text-ink-2">
                <strong className="font-semibold text-ink">Internal, and about a real person.</strong> Only staff see these notes, but the person can ask for a copy of what GIO4X holds about them, and a note may have to be
                disclosed to them. Write accordingly: facts, in words you would be content for them to read.
              </p>

              <div className="mt-13">
                {canNote ? (
                  // a new box after each saved note: the page changes the key, which empties it
                  <CustomerNoteForm key={notes?.[0]?.id ?? "first"} personKey={person.key} names={mentionable} />
                ) : (
                  <p className="text-xs text-ink-3">Your role can read these notes and cannot write one.</p>
                )}
              </div>

              <div className="mt-21">
                {!notes ? (
                  <Notice title="The notes could not be read" tone="error">
                    The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
                  </Notice>
                ) : notes.length ? (
                  <ol className="border-t border-line" aria-label="Notes about this person, newest first">
                    {notes.map((note) => {
                      // only the people the database kept as mentioned are highlighted: a name typed by hand that told nobody stays plain
                      const mentioned = note.mentions.map((id) => names.get(id)).filter((n): n is string => !!n);
                      return (
                        <li key={note.id} id={`note-${note.id}`} className="scroll-mt-21 border-b border-line py-13 target:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]">
                          <p className="text-xs text-ink-3">
                            <span className="font-medium text-ink-2">{author(note.author)}</span> · <span className="num">{fmtDateTime(note.created_at)}</span>
                          </p>
                          <p className="mt-5 whitespace-pre-wrap break-words text-sm text-ink">
                            {splitMentions(note.body, mentioned).map((part, i) =>
                              part.mention ? (
                                <span key={i} data-mention className="rounded-[3px] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-3 font-semibold text-accent">
                                  {part.text}
                                </span>
                              ) : (
                                <span key={i}>{part.text}</span>
                              ),
                            )}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="border-y border-line py-13 text-sm text-ink-3">No notes about this person yet.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : (
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
      )}
    </>
  );
}

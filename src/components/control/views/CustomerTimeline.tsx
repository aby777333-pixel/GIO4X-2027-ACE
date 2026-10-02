"use client";

import Link from "next/link";
import { useState, type MouseEvent, type ReactNode } from "react";
import { fmtDate } from "@/components/control/format";
import { Icon } from "@/components/control/icons";
import { asTimelinePage, TIMELINE_KIND_ICON, TIMELINE_KIND_LABEL, type TimelineEvent, type TimelineFilter } from "@/components/control/timeline";
import {
  LEAD_STAGE_LABEL,
  LEAD_STATUS_LABEL,
  LOST_REASON_LABEL,
  MANUAL_LEAD_SOURCE_LABEL,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
} from "@/lib/server/constants";

export type CustomerTimelineProps = {
  /** the person's key: a hash, never an address */
  personKey: string;
  show: TimelineFilter;
  /** newest first, exactly as person_timeline() returned them */
  events: TimelineEvent[];
  hasOlder: boolean;
  me: string;
};

const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false });

/** A stored value as its label, when it is one this console knows; otherwise the value itself. */
const labelIn = (labels: Record<string, string>, value: string | undefined) => (value && value in labels ? (labels[value] ?? value) : (value ?? ""));

/** The one line under an event's title. Text from a message or a note arrives already cut to a line by the database. */
function summaryOf(event: TimelineEvent): string {
  const d = event.detail;
  switch (event.kind) {
    case "enquiry_received":
      return `${event.summary}, from the website`;
    case "enquiry_entered":
      return d.how ? `${event.summary}, by ${labelIn(MANUAL_LEAD_SOURCE_LABEL, d.how).toLowerCase()}` : event.summary;
    case "enquiry_status":
      return `${labelIn(LEAD_STATUS_LABEL, d.from)} to ${labelIn(LEAD_STATUS_LABEL, d.to)}`;
    case "enquiry_stage": {
      const reason = d.reason ? ` (${labelIn(LOST_REASON_LABEL, d.reason).toLowerCase()})` : "";
      // the stage is recorded again when only the reason for a loss changes
      return d.from === d.to ? `${labelIn(LEAD_STAGE_LABEL, d.to)}: the reason was changed${reason}` : `${labelIn(LEAD_STAGE_LABEL, d.from)} to ${labelIn(LEAD_STAGE_LABEL, d.to)}${reason}`;
    }
    case "ticket_opened":
      return d.category ? `${event.summary} · ${labelIn(TICKET_CATEGORY_LABEL, d.category)}` : event.summary;
    case "ticket_status":
      return `${labelIn(TICKET_STATUS_LABEL, d.from)} to ${labelIn(TICKET_STATUS_LABEL, d.to)}`;
    case "ticket_escalated":
      // an urgent ticket cannot go higher: it is marked and recorded, and its priority stays
      return d.from === d.to ? `Past its reply target; priority stays ${labelIn(TICKET_PRIORITY_LABEL, d.to)}` : `Past its reply target; priority ${labelIn(TICKET_PRIORITY_LABEL, d.from)} to ${labelIn(TICKET_PRIORITY_LABEL, d.to)}`;
    case "newsletter_joined":
      return d.consent_version ? `Policy version ${d.consent_version}` : "";
    case "newsletter_left":
      return "";
    default:
      return event.summary;
  }
}

/** Where an event leads: the enquiry, the ticket, or the note further down this page. */
function linkOf(event: TimelineEvent): { href: string; label: ReactNode } | null {
  if (!event.entity_id) return null;
  if (event.entity === "lead") {
    return {
      href: `/control/leads/${event.entity_id}`,
      label: (
        <>
          Open the enquiry <span className="num">{event.reference}</span>
        </>
      ),
    };
  }
  if (event.entity === "ticket") {
    return {
      href: `/control/tickets/${event.entity_id}`,
      label: (
        <>
          Open the ticket <span className="num">{event.reference}</span>
        </>
      ),
    };
  }
  if (event.entity === "person") return { href: `#note-${event.entity_id}`, label: "Read the whole note" };
  return null;
}

const dayOf = (iso: string) => new Date(iso).toISOString().slice(0, 10);

/**
 * One person's history on one line: days as headings, an icon per kind of
 * event, newest first. Read-only.
 *
 * "Load older" is a real link to the same page one step further back, so it
 * works without scripts. With scripts it asks the console's own route for the
 * next page (the same reader, the same checks, as the signed-in user) and adds
 * the events under the ones already shown. If that fails, the link is still
 * there to follow.
 *
 * The page gives this component a new key whenever the filter, the starting
 * point or the newest event changes, so the list it keeps never goes stale.
 */
export function CustomerTimeline({ personKey, show, events, hasOlder, me }: CustomerTimelineProps) {
  const [items, setItems] = useState(events);
  const [more, setMore] = useState(hasOlder);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [said, setSaid] = useState("");

  const last = items[items.length - 1];
  const query = new URLSearchParams();
  if (show !== "all") query.set("show", show);
  if (last) query.set("before", last.at);
  const olderHref = `/control/customers/${personKey}?${query.toString()}#timeline`;
  const olderApi = `/control/customers/${personKey}/timeline?${query.toString()}`;

  async function loadOlder(event: MouseEvent<HTMLAnchorElement>) {
    // a modified click (new tab, new window) is the browser's business
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(olderApi, { headers: { Accept: "application/json" }, credentials: "same-origin", cache: "no-store" });
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || !type.includes("application/json")) throw new Error("unavailable");
      const body = (await response.json()) as { ok?: unknown; events?: unknown; hasOlder?: unknown };
      if (body.ok !== true) throw new Error("refused");
      const page = asTimelinePage(body.events);
      const known = new Set(items.map((e) => e.id));
      const fresh = page.events.filter((e) => !known.has(e.id));
      setItems([...items, ...fresh]);
      setMore(body.hasOlder === true && fresh.length > 0);
      setSaid(fresh.length ? `${fresh.length} older ${fresh.length === 1 ? "event" : "events"} added below.` : "There is nothing older.");
    } catch {
      setFailed(true);
      setSaid("The older events could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  // consecutive events of one UTC day share a heading
  const days: { day: string; at: string; events: TimelineEvent[] }[] = [];
  for (const event of items) {
    const day = dayOf(event.at);
    const open = days[days.length - 1];
    if (open && open.day === day) open.events.push(event);
    else days.push({ day, at: event.at, events: [event] });
  }

  const who = (event: TimelineEvent) => (!event.actor ? null : event.actor === me ? "You" : (event.actor_name ?? "A former member of staff"));

  return (
    <div>
      <ol className="grid gap-21" aria-label="Events, newest first">
        {days.map((group) => (
          <li key={group.day}>
            <h3 className="label num">{fmtDate(group.at)}</h3>
            {/* the line: a hairline behind the icons, from the first event of the day to the last */}
            <ol className="relative mt-8 before:absolute before:bottom-13 before:left-[calc(1rem-0.5px)] before:top-13 before:w-px before:bg-line-strong">
              {group.events.map((event) => {
                const summary = summaryOf(event);
                const link = linkOf(event);
                const by = who(event);
                const internal = event.kind === "ticket_internal_note";
                return (
                  <li key={event.id} data-kind={event.kind} className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-13 py-8">
                    {/* a solid tile under the tinted one, so the line does not show through the icon */}
                    <span className="relative z-1 h-[2rem] w-[2rem] rounded-[8px] bg-surface">
                      <span className="gxc-stat-icon">
                        <Icon name={TIMELINE_KIND_ICON[event.kind]} size={15} />
                      </span>
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-baseline justify-between gap-x-13 gap-y-3">
                        <span className="min-w-0 text-sm font-medium text-ink">
                          {TIMELINE_KIND_LABEL[event.kind]}
                          {internal && <span className="state state-off ml-8 align-middle">Staff only</span>}
                        </span>
                        <time dateTime={event.at} className="num shrink-0 text-xs text-ink-3">
                          {clock.format(new Date(event.at))} UTC
                        </time>
                      </p>
                      {summary && <p className="mt-3 truncate text-sm text-ink-2">{summary}</p>}
                      {(by || link) && (
                        <p className="mt-3 flex flex-wrap gap-x-13 gap-y-3 text-xs text-ink-3">
                          {by && <span>{by}</span>}
                          {link &&
                            (link.href.startsWith("#") ? (
                              <a href={link.href} className="link">
                                {link.label}
                              </a>
                            ) : (
                              <Link href={link.href} className="link">
                                {link.label}
                              </Link>
                            ))}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>

      <p role="status" aria-live="polite" className="sr-only">
        {said}
      </p>

      {failed && (
        <p role="alert" className="mt-13 text-sm font-medium text-neg">
          The older events could not be loaded here. Try again, or follow the link to open them on their own page.
        </p>
      )}

      <div className="mt-13 border-t border-line pt-13">
        {more && last ? (
          <a href={olderHref} onClick={loadOlder} className="btn btn-ghost" aria-disabled={busy}>
            {busy ? "Loading…" : "Load older"}
          </a>
        ) : (
          <p className="text-xs text-ink-3">There is nothing older to show.</p>
        )}
      </div>
    </div>
  );
}

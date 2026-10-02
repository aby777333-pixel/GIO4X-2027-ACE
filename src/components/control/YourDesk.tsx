import Link from "next/link";
import type { ReactNode } from "react";
import { pinView } from "@/app/control/actions-personal";
import { Notice } from "@/components/control/bits";
import { Icon, type IconName } from "@/components/control/icons";
import { SubmitButton } from "@/components/control/SubmitButton";
import { VIEW_OUTCOMES, VIEW_SCREENS } from "@/components/control/views-shared";
import type { DeskData } from "@/lib/server/personal";

type Action = (formData: FormData) => Promise<void>;

/** A figure that could not be counted is said to be so; it is never shown as zero. */
function Figure({ value }: { value: number | null }) {
  return value === null ? (
    <span title="Could not be counted just now">
      <span aria-hidden>–</span>
      <span className="sr-only">could not be counted just now</span>
    </span>
  ) : (
    <>{value}</>
  );
}

function Tile({ href, icon, label, children }: { href: string; icon: IconName; label: string; children: ReactNode }) {
  return (
    <li className="grid">
      <Link href={href} className="gxc-stat">
        <span className="gxc-stat-icon">
          <Icon name={icon} size={16} />
        </span>
        <span className="gxc-stat-label">{label}</span>
        <span className="gxc-stat-value">{children}</span>
      </Link>
    </li>
  );
}

/**
 * "Your desk", at the top of the dashboard: what is the signed-in person's
 * own. First the fixed figures (their tickets, their enquiries, their
 * follow-ups, chats waiting), each shown only if their role includes it; then
 * the views they pinned on the list screens, each with the number of rows it
 * matches now. Presentation only: every figure arrives as a prop, counted
 * from real rows as that person when the page was rendered.
 */
export function YourDesk({ desk, outcome, unpin = pinView }: { desk: DeskData; /** the fixed code the "Unpin" here answered with */ outcome?: string; unpin?: Action }) {
  const said = outcome ? VIEW_OUTCOMES[outcome] : undefined;
  const personal = desk.myTickets || desk.myLeads || desk.followUps || desk.chatsWaiting;

  return (
    <section aria-labelledby="desk-heading" className="mt-13 border-b border-line pb-21" data-desk>
      <div className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-3">
        <h2 id="desk-heading" className="h4">
          Your desk
        </h2>
        <p className="text-xs text-ink-3">What is yours, counted when this page was loaded.</p>
      </div>

      {said && (
        <div className="mt-13" data-views-outcome={outcome}>
          <Notice title={said.text} tone={said.tone} />
        </div>
      )}

      {personal && (
        <ul className="mt-13 grid grid-cols-2 gap-13 lg:grid-cols-4" aria-label="Your own work">
          {desk.myTickets && (
            <Tile href="/control/tickets?who=mine" icon="tickets" label="Your open tickets">
              <Figure value={desk.myTickets.count} />
            </Tile>
          )}
          {desk.myLeads && (
            <Tile href="/control/leads?who=mine" icon="leads" label="Your enquiries in progress">
              <Figure value={desk.myLeads.count} />
            </Tile>
          )}
          {desk.followUps && (
            <Tile href="/control/tasks" icon="clock" label="Your follow-ups (UTC day)">
              <span className="flex flex-wrap gap-x-13 text-sm">
                <span>
                  <Figure value={desk.followUps.overdue} /> <span className="font-normal text-ink-3">overdue</span>
                </span>
                <span>
                  <Figure value={desk.followUps.today} /> <span className="font-normal text-ink-3">due today</span>
                </span>
              </span>
            </Tile>
          )}
          {desk.chatsWaiting && (
            <Tile href="/control/chats" icon="chats" label="Chats waiting">
              <Figure value={desk.chatsWaiting.count} />
            </Tile>
          )}
        </ul>
      )}

      <h3 className="mt-21 text-sm font-semibold text-ink">Your pinned views</h3>
      {desk.pinsFailed ? (
        <p className="mt-8 text-sm text-ink-2">Your pinned views could not be read just now. Reload the page to try again.</p>
      ) : desk.pins.length ? (
        <ul className="mt-8 grid gap-13 sm:grid-cols-2 lg:grid-cols-4">
          {desk.pins.map((pin) => {
            const spec = VIEW_SCREENS[pin.screen];
            return (
              <li key={pin.id} className="gxc-stat min-w-0 !gap-5" data-pin={pin.id}>
                <span className="gxc-stat-label">{spec.label}</span>
                <Link href={pin.href} className="gxc-card-link max-w-full break-words !text-sm !font-semibold">
                  {pin.name}
                </Link>
                {pin.noAccess ? (
                  <span className="text-xs text-ink-2">Your role no longer includes {spec.label}.</span>
                ) : pin.count === null ? (
                  <span className="text-xs text-ink-2">Could not be counted just now.</span>
                ) : (
                  <span className="text-sm text-ink-2">
                    <span className="gxc-stat-value" data-pin-count>
                      {pin.count}
                    </span>{" "}
                    {pin.count === 1 ? spec.noun[0] : spec.noun[1]}
                  </span>
                )}
                <form action={unpin} className="mt-3">
                  <input type="hidden" name="from" value="desk" />
                  <input type="hidden" name="id" value={pin.id} />
                  <input type="hidden" name="pinned" value="0" />
                  <SubmitButton pending="Unpinning…" className="btn btn-quiet btn-sm">
                    Unpin
                    <span className="sr-only">: {pin.name}</span>
                  </SubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="gxc-card mt-8 px-21 py-13">
          <p className="text-sm font-semibold text-ink">No pinned views yet</p>
          <p className="mt-3 max-w-measure text-sm text-ink-2">
            On Leads, Tickets, Follow-ups or Blog, set the filters you use most, choose “Save this view”, and tick “Pin it to my dashboard”. The view then appears here with the number of rows it matches, counted each time this page
            loads.
          </p>
        </div>
      )}
    </section>
  );
}

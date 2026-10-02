import Link from "next/link";
import type { ReactNode } from "react";
import { createIncident, editIncident, postIncidentUpdate, saveChat, saveSupportHours, setIncidentPublished } from "@/app/control/actions-config";
import { ControlHead, Empty, Notice } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { SubmitButton } from "@/components/control/SubmitButton";
import { ConfigAnnouncement, type AnnouncementValue } from "@/components/control/views/ConfigAnnouncement";
import {
  INCIDENT_COMPONENT_LABEL,
  INCIDENT_COMPONENTS,
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_STATUS_LABEL,
  INCIDENT_STATUSES,
} from "@/lib/server/constants";
import type { IncidentRow, IncidentSeverity, IncidentStatus, IncidentUpdateRow, SiteSettingKey } from "@/lib/supabase/types";

export type ConfigViewProps = {
  /** the settings or the incidents could not be read */
  failed: boolean;
  announcement: AnnouncementValue;
  chat: { enabled: boolean };
  support: { hours: string };
  /** when each setting was last changed, and the name of who changed it (null: nobody yet, or no longer on staff) */
  changed: Partial<Record<SiteSettingKey, { at: string; by: string | null }>>;
  /** in any order: the view puts the open ones above the resolved ones, newest first within each */
  incidents: IncidentRow[];
  updates: IncidentUpdateRow[];
  /** how many incidents exist; more than `incidents.length` when the list was cut */
  incidentTotal: number;
  names: Map<string, string>;
  me: string;
  notice?: string;
  error?: string;
};

/** An incident opens in any state but "resolved". */
const STARTING_STATUSES: IncidentStatus[] = ["scheduled", "investigating", "identified", "monitoring"];

// shape + word, never colour alone
const SEVERITY_CLASS: Record<IncidentSeverity, string> = {
  notice: "state-off",
  maintenance: "state-overlap",
  degraded: "state-pre",
  outage: "state-open text-neg",
};
const STATUS_CLASS: Record<IncidentStatus, string> = {
  scheduled: "state-off",
  investigating: "state-pre",
  identified: "state-pre",
  monitoring: "state-overlap",
  resolved: "state-open",
};

function Card({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="gxc-card min-w-0 scroll-mt-[5rem]">
      <div className="gxc-card-head">
        <h2 id={`${id}-h`} className="gxc-card-title">
          {title}
        </h2>
        {aside}
      </div>
      <div className="gxc-card-body">{children}</div>
    </section>
  );
}

function OnOff({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return <span className={`state ${on ? "state-open" : "state-off"}`}>{on ? yes : no}</span>;
}

/**
 * Presentation only. Everything staff publish to the public website from one
 * screen: the announcement line, whether live chat may be offered, the support
 * hours, and the notices on the Status page. The page reads; the actions write.
 */
export function ConfigView({ failed, announcement, chat, support, changed, incidents, updates, incidentTotal, names, me, notice, error }: ConfigViewProps) {
  const who = (userId: string | null) => (!userId ? "Database (SQL)" : userId === me ? "You" : (names.get(userId) ?? "Former member of staff"));
  const lastChanged = (key: SiteSettingKey) => {
    const c = changed[key];
    if (!c) return null;
    return (
      <p className="mt-13 text-xs text-ink-3">
        Last changed <span className="num">{fmtDateTime(c.at)}</span>
        {c.by ? ` by ${c.by}` : ""}
      </p>
    );
  };

  const newestFirst = (a: IncidentRow, b: IncidentRow) => b.started_at.localeCompare(a.started_at);
  const open = incidents.filter((i) => i.status !== "resolved").sort(newestFirst);
  const resolved = incidents.filter((i) => i.status === "resolved").sort(newestFirst);
  const ordered = [...open, ...resolved];
  const announcementShowing = announcement.enabled && announcement.text.trim() !== "";

  return (
    <>
      <ControlHead
        title="Configuration"
        lead="What the public website shows on your say: the announcement line, live chat, the support hours, and the notices on the Status page. Every change is recorded in the audit log."
      />

      <div className="mt-21 grid gap-13">
        {notice && !error && <Notice title={notice} tone="ok" />}
        {error && <Notice title={error} tone="error" />}
      </div>

      {failed ? (
        <div className="mt-13">
          <Notice title="The configuration could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that the migrations have been applied. Nothing is offered for editing until the saved values can be shown.
          </Notice>
        </div>
      ) : (
        <>
          <div className="mt-13 grid gap-13">
            <Card id="announcement" title="Announcement" aside={<OnOff on={announcementShowing} yes="Showing on the website" no="Not showing" />}>
              <p className="max-w-measure text-sm text-ink-2">
                One line above the page on every page of the public website, directly under the header. It shows only while it is switched on and the line is not empty.
              </p>
              <div className="mt-21">
                <ConfigAnnouncement value={announcement} />
              </div>
              {lastChanged("announcement")}
            </Card>

            <div className="grid gap-13 lg:grid-cols-2">
              <Card id="chat" title="Live chat" aside={<OnOff on={chat.enabled} yes="Switched on" no="Switched off" />}>
                <p className="text-sm text-ink-2">
                  The website offers chat only while this is switched on <span className="font-semibold text-ink">and</span> a member of staff has the{" "}
                  <Link href="/control/chats" className="link">
                    Live Chats
                  </Link>{" "}
                  screen open. With nobody there, a visitor is not offered a chat that nobody would answer.
                </p>
                <form action={saveChat} className="mt-21">
                  <input type="hidden" name="enabled" value={chat.enabled ? "0" : "1"} />
                  <SubmitButton pending="Saving…" className={chat.enabled ? "btn btn-ghost" : "btn btn-primary"}>
                    {chat.enabled ? "Switch live chat off" : "Switch live chat on"}
                  </SubmitButton>
                </form>
                {lastChanged("chat")}
              </Card>

              <Card id="support" title="Support hours" aside={<OnOff on={support.hours !== ""} yes="Shown on the website" no="Nothing shown" />}>
                <form action={saveSupportHours} className="grid gap-13">
                  <div className="field">
                    <label htmlFor="support-hours">Support hours</label>
                    <input id="support-hours" name="hours" type="text" className="input" defaultValue={support.hours} maxLength={120} autoComplete="off" aria-describedby="support-hours-hint" />
                    <p id="support-hours-hint" className="text-xs text-ink-3">
                      One line, up to 120 characters, shown on the public support page exactly as typed. It may be left empty: then no hours are shown.
                    </p>
                  </div>
                  <div>
                    <SubmitButton pending="Saving…">Save support hours</SubmitButton>
                  </div>
                </form>
                {lastChanged("support")}
              </Card>
            </div>
          </div>

          <section id="incidents" aria-labelledby="incidents-h" className="mt-34 scroll-mt-[5rem]">
            <h2 id="incidents-h" className="h4">
              Incidents
            </h2>
            <div className="mt-13">
              <Notice title="These notices are written by staff. Nothing here measures uptime.">
                A published notice appears on the public{" "}
                <Link href="/status" className="link">
                  Status page
                </Link>{" "}
                under “Notices from GIO4X”; a draft is seen only by staff. A notice exists because someone wrote it, and its status moves only when someone posts an update, so the trail the public reads and the headline can never disagree.
              </Notice>
            </div>

            <div className="mt-13">
              <Card id="incident-new" title="Write a notice">
                <form action={createIncident} className="grid gap-13 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="field sm:col-span-2 lg:col-span-4">
                    <label htmlFor="incident-title">Title</label>
                    <input id="incident-title" name="title" type="text" className="input" maxLength={140} required autoComplete="off" aria-describedby="incident-title-hint" />
                    <p id="incident-title-hint" className="text-xs text-ink-3">
                      What a visitor reads first, up to 140 characters. Say what is affected in plain words.
                    </p>
                  </div>
                  <div className="field">
                    <label htmlFor="incident-component">Service</label>
                    <select id="incident-component" name="component" className="select" defaultValue="website">
                      {INCIDENT_COMPONENTS.map((c) => (
                        <option key={c} value={c}>
                          {INCIDENT_COMPONENT_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="incident-severity">Severity</label>
                    <select id="incident-severity" name="severity" className="select" defaultValue="notice">
                      {INCIDENT_SEVERITIES.map((s) => (
                        <option key={s} value={s}>
                          {INCIDENT_SEVERITY_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="incident-status">Starting status</label>
                    <select id="incident-status" name="status" className="select" defaultValue="investigating">
                      {STARTING_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {INCIDENT_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="incident-publish">Visibility</label>
                    <select id="incident-publish" name="publish" className="select" defaultValue="0">
                      <option value="0">Keep as a draft</option>
                      <option value="1">Publish now</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <SubmitButton pending="Saving…">Create notice</SubmitButton>
                    <p className="mt-8 text-xs text-ink-3">The start time is recorded as now. What happened, and what is being done, goes in the updates you post afterwards.</p>
                  </div>
                </form>
              </Card>
            </div>

            {ordered.length ? (
              <>
                <p className="num mt-21 text-xs text-ink-3">
                  {open.length} open · {resolved.length} resolved
                  {incidentTotal > incidents.length ? ` · showing ${incidents.length} of ${incidentTotal}, every open one included` : ""}
                </p>
                <ul className="mt-8 grid gap-13" aria-label="Incidents: open first, then resolved, newest first">
                  {ordered.map((incident) => {
                    const trail = updates.filter((u) => u.incident_id === incident.id);
                    return (
                      <li key={incident.id} className="gxc-card min-w-0">
                        <div className="gxc-card-head">
                          <h3 className="min-w-0 break-words text-sm font-semibold text-ink">{incident.title}</h3>
                          <p className="flex flex-wrap items-center gap-8">
                            <span className={`state ${SEVERITY_CLASS[incident.severity]}`}>{INCIDENT_SEVERITY_LABEL[incident.severity]}</span>
                            <span className={`state ${STATUS_CLASS[incident.status]}`}>{INCIDENT_STATUS_LABEL[incident.status]}</span>
                            <span className={`state ${incident.published ? "state-overlap" : "state-off"}`}>{incident.published ? "Published" : "Draft"}</span>
                          </p>
                        </div>
                        <div className="gxc-card-body">
                          <dl className="flex flex-wrap gap-x-21 gap-y-3 text-xs text-ink-3">
                            <div className="flex gap-5">
                              <dt>Service</dt>
                              <dd className="font-medium text-ink-2">{INCIDENT_COMPONENT_LABEL[incident.component]}</dd>
                            </div>
                            <div className="flex gap-5">
                              <dt>Started</dt>
                              <dd className="num text-ink-2">{fmtDateTime(incident.started_at)}</dd>
                            </div>
                            {incident.resolved_at && (
                              <div className="flex gap-5">
                                <dt>Resolved</dt>
                                <dd className="num text-ink-2">{fmtDateTime(incident.resolved_at)}</dd>
                              </div>
                            )}
                            <div className="flex gap-5">
                              <dt>Written by</dt>
                              <dd className="text-ink-2">{who(incident.created_by)}</dd>
                            </div>
                          </dl>

                          {trail.length ? (
                            <ol className="mt-13 grid gap-8 border-l-2 border-line pl-13" aria-label="Updates, oldest first">
                              {trail.map((u) => (
                                <li key={u.id}>
                                  <p className="flex flex-wrap items-baseline gap-x-8 gap-y-3 text-xs text-ink-3">
                                    <span className="font-semibold text-ink-2">{INCIDENT_STATUS_LABEL[u.status]}</span>
                                    <span className="num">{fmtDateTime(u.created_at)}</span>
                                    <span>{who(u.author)}</span>
                                  </p>
                                  <p className="mt-3 max-w-measure whitespace-pre-line text-sm text-ink-2 [overflow-wrap:anywhere]">{u.body}</p>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="mt-13 text-sm text-ink-3">No update has been posted yet{incident.published ? ": the public sees the title and status only." : "."}</p>
                          )}

                          <div className="mt-13 grid gap-8 border-t border-line pt-13">
                            <details>
                              <summary className="cursor-pointer py-5 text-sm font-medium text-accent">Post an update</summary>
                              <form action={postIncidentUpdate} className="mt-13 grid gap-13">
                                <input type="hidden" name="id" value={incident.id} />
                                <div className="field max-w-[16rem]">
                                  <label htmlFor={`update-status-${incident.id}`}>New status</label>
                                  <select id={`update-status-${incident.id}`} name="status" className="select" defaultValue={incident.status}>
                                    {INCIDENT_STATUSES.map((s) => (
                                      <option key={s} value={s}>
                                        {INCIDENT_STATUS_LABEL[s]}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="field">
                                  <label htmlFor={`update-body-${incident.id}`}>What to tell the public</label>
                                  <textarea id={`update-body-${incident.id}`} name="body" className="textarea" style={{ minHeight: "5.5rem" }} maxLength={2000} required aria-describedby={`update-hint-${incident.id}`} />
                                  <p id={`update-hint-${incident.id}`} className="text-xs text-ink-3">
                                    Plain text, up to 2,000 characters. It cannot be edited or removed afterwards.{" "}
                                    {incident.status === "resolved" ? "This incident is resolved: an update with any other status reopens it." : "Choosing Resolved closes the incident and records the time."}
                                  </p>
                                </div>
                                <div>
                                  <SubmitButton pending="Saving…">Post update</SubmitButton>
                                </div>
                              </form>
                            </details>

                            <details>
                              <summary className="cursor-pointer py-5 text-sm font-medium text-accent">Edit title, service or severity</summary>
                              <form action={editIncident} className="mt-13 grid gap-13 sm:grid-cols-2">
                                <input type="hidden" name="id" value={incident.id} />
                                <div className="field sm:col-span-2">
                                  <label htmlFor={`edit-title-${incident.id}`}>Title</label>
                                  <input id={`edit-title-${incident.id}`} name="title" type="text" className="input" defaultValue={incident.title} maxLength={140} required autoComplete="off" />
                                </div>
                                <div className="field">
                                  <label htmlFor={`edit-component-${incident.id}`}>Service</label>
                                  <select id={`edit-component-${incident.id}`} name="component" className="select" defaultValue={incident.component}>
                                    {INCIDENT_COMPONENTS.map((c) => (
                                      <option key={c} value={c}>
                                        {INCIDENT_COMPONENT_LABEL[c]}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="field">
                                  <label htmlFor={`edit-severity-${incident.id}`}>Severity</label>
                                  <select id={`edit-severity-${incident.id}`} name="severity" className="select" defaultValue={incident.severity}>
                                    {INCIDENT_SEVERITIES.map((s) => (
                                      <option key={s} value={s}>
                                        {INCIDENT_SEVERITY_LABEL[s]}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="sm:col-span-2">
                                  <SubmitButton pending="Saving…" className="btn btn-ghost">
                                    Save changes
                                  </SubmitButton>
                                </div>
                              </form>
                            </details>

                            <form action={setIncidentPublished} className="flex flex-wrap items-center gap-x-13 gap-y-5">
                              <input type="hidden" name="id" value={incident.id} />
                              <input type="hidden" name="publish" value={incident.published ? "0" : "1"} />
                              <SubmitButton pending="Saving…" className="btn btn-ghost btn-sm">
                                {incident.published ? "Withdraw from the Status page" : "Publish on the Status page"}
                              </SubmitButton>
                              <span className="text-xs text-ink-3">{incident.published ? "Visitors can read this notice and its updates now." : "Only staff can see this notice."}</span>
                            </form>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <div className="mt-8">
                <Empty title="No incident has been written">
                  <p>The public Status page says that no notices have been posted.</p>
                </Empty>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { offsetLabel, zoneOffset } from "@/components/markets/time";
import { usePrefs } from "@/hooks/usePrefs";
import { INCIDENT_COMPONENT_LABEL, INCIDENT_SEVERITY_LABEL, INCIDENT_STATUS_LABEL } from "@/lib/server/constants";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { IncidentRow, IncidentUpdateRow } from "@/lib/supabase/types";

/**
 * "Notices from GIO4X" on the Status page: what staff have written and
 * published from GIO4X Control. A list written by people, not a measurement.
 *
 * Read with the anonymous browser client. Row-level security lets a visitor
 * see published incidents and their updates and nothing else, so the filter
 * below is a courtesy and the database is the control.
 *
 * The server renders the "loading" sentence and so does the first client
 * render; the notices arrive after mount. Times are shown in the visitor's
 * zone (the one chosen in preferences, otherwise the device's) with its offset
 * from UTC stated, as the clocks elsewhere on the site do.
 */

export type PublicIncident = Pick<IncidentRow, "id" | "title" | "component" | "severity" | "status" | "started_at" | "resolved_at">;
export type PublicIncidentUpdate = Pick<IncidentUpdateRow, "id" | "incident_id" | "created_at" | "status" | "body">;

const INCIDENT_COLUMNS = "id, title, component, severity, status, started_at, resolved_at";
const UPDATE_COLUMNS = "id, incident_id, created_at, status, body";
const DAYS = 90;
const MOST = 20;

// shape + word, never colour alone
const SEVERITY_CLASS: Record<IncidentRow["severity"], string> = {
  notice: "state-off",
  maintenance: "state-overlap",
  degraded: "state-pre",
  outage: "state-open text-neg",
};
const STATUS_CLASS: Record<IncidentRow["status"], string> = {
  scheduled: "state-off",
  investigating: "state-pre",
  identified: "state-pre",
  monitoring: "state-overlap",
  resolved: "state-open",
};

function validZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** "2 Oct 2026, 14:05 UTC+1": the moment in the given zone, with the zone's offset stated. */
function stamp(iso: string, zone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const text = new Intl.DateTimeFormat("en-GB", { timeZone: zone, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return `${text} ${offsetLabel(zoneOffset(d, zone))}`;
}

function When({ iso, zone }: { iso: string; zone: string }) {
  return (
    <time dateTime={iso} className="num whitespace-nowrap">
      {stamp(iso, zone)}
    </time>
  );
}

/**
 * Presentation only: the notices and their updates as props. An unresolved
 * notice stands above the resolved ones; within each, the newest first.
 * Updates read in the order they were written.
 */
export function IncidentList({ incidents, updates, zone }: { incidents: PublicIncident[]; updates: PublicIncidentUpdate[]; zone: string }) {
  const tz = validZone(zone) ? zone : "UTC";
  const byStart = (a: PublicIncident, b: PublicIncident) => b.started_at.localeCompare(a.started_at);
  const ordered = [...incidents.filter((i) => i.status !== "resolved").sort(byStart), ...incidents.filter((i) => i.status === "resolved").sort(byStart)];

  if (!ordered.length) {
    return (
      <p className="max-w-measure text-ink-2">
        No notices have been posted. This is a list written by GIO4X staff when there is something to tell you. It is not a measurement of uptime.
      </p>
    );
  }

  return (
    <>
      <ul className="border-t border-line-strong">
        {ordered.map((incident) => {
          const trail = updates.filter((u) => u.incident_id === incident.id).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
          return (
            <li key={incident.id} className="border-b border-line py-21">
              <article aria-labelledby={`notice-${incident.id}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-5">
                  <h3 id={`notice-${incident.id}`} className="h4 min-w-0 break-words">
                    {incident.title}
                  </h3>
                  <p className="flex flex-wrap items-center gap-x-13 gap-y-3">
                    <span className={`state ${SEVERITY_CLASS[incident.severity]}`}>
                      <span className="sr-only">Severity: </span>
                      {INCIDENT_SEVERITY_LABEL[incident.severity]}
                    </span>
                    <span className={`state ${STATUS_CLASS[incident.status]}`}>
                      <span className="sr-only">Status: </span>
                      {INCIDENT_STATUS_LABEL[incident.status]}
                    </span>
                  </p>
                </div>
                <dl className="mt-8 flex flex-wrap gap-x-21 gap-y-3 text-sm text-ink-2">
                  <div className="flex gap-5">
                    <dt className="text-ink-3">Concerns</dt>
                    <dd className="font-medium text-ink">{INCIDENT_COMPONENT_LABEL[incident.component]}</dd>
                  </div>
                  <div className="flex gap-5">
                    <dt className="text-ink-3">Started</dt>
                    <dd>
                      <When iso={incident.started_at} zone={tz} />
                    </dd>
                  </div>
                  {incident.resolved_at && (
                    <div className="flex gap-5">
                      <dt className="text-ink-3">Resolved</dt>
                      <dd>
                        <When iso={incident.resolved_at} zone={tz} />
                      </dd>
                    </div>
                  )}
                </dl>
                {trail.length ? (
                  <ol className="mt-13 grid gap-13 border-l border-line-strong pl-13" aria-label="Updates, oldest first">
                    {trail.map((u) => (
                      <li key={u.id}>
                        <p className="flex flex-wrap items-baseline gap-x-13 gap-y-3 text-xs text-ink-3">
                          <When iso={u.created_at} zone={tz} />
                          <span className="font-semibold uppercase tracking-[0.1em] text-ink-2">{INCIDENT_STATUS_LABEL[u.status]}</span>
                        </p>
                        <p className="mt-3 max-w-measure whitespace-pre-line text-sm text-ink-2 [overflow-wrap:anywhere]">{u.body}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-13 text-sm text-ink-3">No update has been written for this notice yet.</p>
                )}
              </article>
            </li>
          );
        })}
      </ul>
      <p className="mt-13 text-xs text-ink-3">
        Times are shown in your time zone ({tz.replace(/_/g, " ")}). Notices are written by GIO4X staff. They are not produced by a monitor and are not a measurement of uptime.
      </p>
    </>
  );
}

type Feed = { state: "loading" } | { state: "failed" } | { state: "ready"; incidents: PublicIncident[]; updates: PublicIncidentUpdate[] };

export function IncidentFeed() {
  const [prefs, , ready] = usePrefs();
  const [feed, setFeed] = useState<Feed>({ state: "loading" });
  const [device, setDevice] = useState("UTC");

  useEffect(() => {
    setDevice(deviceZone());
    let alive = true;
    void (async () => {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        if (alive) setFeed({ state: "failed" });
        return;
      }
      try {
        // The last 90 days, and anything still open however old, newest first, 20 at most.
        const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
        const incidents = await supabase
          .from("incidents")
          .select(INCIDENT_COLUMNS)
          .eq("published", true)
          .or(`started_at.gte.${since},resolved_at.is.null`)
          .order("started_at", { ascending: false })
          .limit(MOST);
        if (incidents.error) throw new Error("incidents");
        const rows = (incidents.data ?? []) as PublicIncident[];
        let updates: PublicIncidentUpdate[] = [];
        if (rows.length) {
          const result = await supabase
            .from("incident_updates")
            .select(UPDATE_COLUMNS)
            .in(
              "incident_id",
              rows.map((r) => r.id),
            )
            .order("created_at", { ascending: true })
            .limit(500);
          if (result.error) throw new Error("updates");
          updates = (result.data ?? []) as PublicIncidentUpdate[];
        }
        if (alive) setFeed({ state: "ready", incidents: rows, updates });
      } catch {
        if (alive) setFeed({ state: "failed" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (feed.state === "loading") return <p className="text-ink-3">Loading notices…</p>;
  if (feed.state === "failed") {
    return (
      <p className="max-w-measure text-ink-2" role="status">
        Notices could not be loaded just now. That says nothing about the services themselves. Please reload the page in a moment.
      </p>
    );
  }
  const zone = ready && prefs.tz !== "local" && validZone(prefs.tz) ? prefs.tz : device;
  return <IncidentList incidents={feed.incidents} updates={feed.updates} zone={zone} />;
}

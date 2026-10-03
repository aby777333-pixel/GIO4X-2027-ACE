"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { DEG, inDaylight, sunAt, unit } from "@/components/labs/market-day/earth";
import { GLOBE_SESSIONS } from "@/components/labs/session-globe/sessions";
import type { GlobeLabel, SessionGlobe as Scene } from "@/components/labs/session-globe/scene";
import { calmNow, useScene } from "@/components/labs/three/useScene";
import { hhmm } from "@/components/markets/time";
import { DataNote } from "@/components/ui/Page";
import { useNow } from "@/hooks/useNow";
import { fxSessionOpen, fxWeekOpen, localTime } from "@/lib/sessions";

/**
 * The session globe and its list.
 *
 * The list is the instrument; the globe is a picture of it. Everything in both
 * comes from the visitor's clock: which of the four FX sessions are inside
 * their conventional windows, where the sun is overhead, and so where day
 * ends. Nothing is fetched and nothing claims to be market data.
 *
 * `still` is the server-drawn map that stands in the frame until, and unless,
 * the WebGL scene runs. Three.js is fetched by a dynamic import when the frame
 * comes near the viewport.
 */

const coord = (lat: number, lon: number) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;

function reading(now: Date) {
  const week = fxWeekOpen(now);
  const sun = sunAt(now.getTime());
  const rows = GLOBE_SESSIONS.map((s) => ({
    ...s,
    isOpen: week && fxSessionOpen(s, now),
    local: localTime(now, s.tz).label,
    day: inDaylight(unit(s.lat, s.lon), sun),
  }));
  const open = rows.filter((r) => r.isOpen);
  const summary = !week
    ? "The FX week is closed. It reopens on Monday morning in Sydney."
    : open.length >= 2
      ? `${open.map((r) => r.name).join(" and ")} overlap: ${open.length} sessions are open.`
      : open.length === 1
        ? `${open[0].name} is the only session open.`
        : "Between sessions: none of the four windows is open.";
  return { rows, summary, sun, utc: `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}` };
}

export function SessionGlobe({ still }: { still: ReactNode }) {
  const now = useNow(30_000);
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const r = now ? reading(now) : null;

  const { scene, state } = useScene<Scene>(hostRef, async (host) => {
    const { createSessionGlobe } = await import("@/components/labs/session-globe/scene");
    // open on the first session that is open now, or on London
    const t = new Date();
    const first = GLOBE_SESSIONS.find((s) => fxWeekOpen(t) && fxSessionOpen(s, t)) ?? GLOBE_SESSIONS.find((s) => s.key === "london") ?? GLOBE_SESSIONS[0];
    const place = (labels: GlobeLabel[]) => {
      for (const l of labels) {
        const el = labelRefs.current[l.key];
        if (!el) continue;
        if (l.show) {
          el.style.transform = `translate3d(${(l.x + 10).toFixed(1)}px,${(l.y - 9).toFixed(1)}px,0)`;
          el.dataset.show = "";
        } else delete el.dataset.show;
      }
    };
    return createSessionGlobe(
      host,
      GLOBE_SESSIONS.map((s) => ({ key: s.key, name: s.name, lat: s.lat, lon: s.lon })),
      first,
      calmNow,
      place,
    );
  });

  // the clock moved, or the scene has just arrived: give it the instant and what is open
  const stamp = now?.getTime() ?? 0;
  const openKeys = r
    ? r.rows
        .filter((x) => x.isOpen)
        .map((x) => x.key)
        .join(",")
    : "";
  useEffect(() => {
    if (state !== "live" || !stamp) return;
    scene.current?.set(stamp, new Set(openKeys ? openKeys.split(",") : []));
  }, [state, stamp, openKeys, scene]);

  return (
    <div className="grid gap-34 lg:grid-cols-phi lg:items-start lg:gap-55">
      <figure className="min-w-0">
        <div ref={hostRef} className="gx3d gx3d-globe" tabIndex={0} role="group" aria-label="Globe of the four FX sessions. Arrow keys turn it and Home returns it. The list after it gives the same information.">
          <div className="gx3d-still">{still}</div>
          <div className="gx3d-labels" aria-hidden>
            {GLOBE_SESSIONS.map((s) => {
              const row = r?.rows.find((x) => x.key === s.key);
              return (
                <span
                  key={s.key}
                  ref={(el) => {
                    labelRefs.current[s.key] = el;
                  }}
                  className="gx3d-label"
                  data-tone={row?.isOpen ? "open" : undefined}
                >
                  {s.name}
                  <small>{row ? (row.isOpen ? "Open" : "Closed") : ""}</small>
                </span>
              );
            })}
            <span
              ref={(el) => {
                labelRefs.current.sun = el;
              }}
              className="gx3d-label"
              data-tone="gold"
            >
              Sun overhead
            </span>
          </div>
          <p className="gx3d-hint" aria-hidden>
            Drag to turn · arrow keys when focused
          </p>
        </div>
        <figcaption className="mt-8 text-xs text-ink-3">
          {state === "none"
            ? "This browser could not start the 3D view, so the flat map stands in for it. The list carries everything the globe would show."
            : "A filled lamp with a ring is a session inside its window; a hollow ring is one outside it. The champagne line is where day meets night, and the small ring is where the sun is overhead. The land is schematic."}
        </figcaption>
      </figure>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-5">
          <h2 className="h3">The four sessions, now</h2>
          <p className="num text-sm text-ink-3">{r ? `${r.utc} UTC, from your clock` : "Reading your clock…"}</p>
        </div>
        <p className="mt-8 text-ink-2" aria-live="polite">
          {r ? r.summary : "The reading appears once your clock has been read."}
        </p>

        <ul className="mt-21 border-t border-line-strong">
          {GLOBE_SESSIONS.map((s) => {
            const row = r?.rows.find((x) => x.key === s.key);
            return (
              <li key={s.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-21 gap-y-3 border-b border-line py-13">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-13 gap-y-3">
                    <span className="h4">{s.name}</span>
                    <span className={`state ${row?.isOpen ? "state-open" : "state-off"}`}>{row ? (row.isOpen ? "Open" : "Closed") : "Not read yet"}</span>
                  </p>
                  <p className="num mt-3 text-sm text-ink-3">
                    Window {hhmm(s.open)}–{hhmm(s.close)} {s.name} time, Monday to Friday
                    {row && (
                      <>
                        {" "}
                        · now {row.local} there, {row.day ? "daylight" : "night"}
                      </>
                    )}
                  </p>
                  <p className="num text-xs text-ink-3">{coord(s.lat, s.lon)}</p>
                </div>
                {state === "live" && (
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => scene.current?.face(s.lat, s.lon)}>
                    Show<span className="sr-only"> {s.name} on the globe</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {r && <p className="num mt-13 text-sm text-ink-2">The sun is overhead near {coord(r.sun.decl / DEG, r.sun.lon)}. Day and night on the globe follow from that.</p>}

        <DataNote status="schedule" source="Your device clock" className="mt-21">
          Computed from the clock and the conventional session windows. Not a data feed: public holidays are not reflected, and a session being open says nothing about prices or activity.
        </DataNote>
      </div>
    </div>
  );
}

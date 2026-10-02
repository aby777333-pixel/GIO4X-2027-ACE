"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { P, TAU, clamp, drawEarth, inDaylight, label, project, rgba, smooth, sunAt, sunTimes, unit, wrap180, type Colour, type EarthPalette, type Globe } from "@/components/labs/market-day/earth";
import { useGlobeCanvas, useStillMotion, type GlobePaint } from "@/components/labs/market-day/useGlobeCanvas";
import { stateClass } from "@/components/markets/Now";
import { hhmm, isZoneKey, offsetLabel, zoneId, zoneMeta, zoneOffset } from "@/components/markets/time";
import { DataNote } from "@/components/ui/Page";
import { getCurrency } from "@/data/knowledge";
import { useNow } from "@/hooks/useNow";
import { usePrefs } from "@/hooks/usePrefs";
import { centreStatus, formatDuration, localTime, stateLabel, type CentreState } from "@/lib/sessions";
import { LAYERS, layerOf, type LayerKey, type Place } from "./places";

/**
 * GIO4X ON THE MAP
 *
 * One globe, three layers (the two published offices, the nine financial
 * centres, the central banks the site covers), each a real list from the
 * site's own data. The globe turns under a drag (pointer or touch), the arrow
 * keys turn it and + and - zoom it; a place can be chosen on the globe or from
 * the list beside it, and the list reaches every one of them by keyboard.
 * Choosing a place turns the globe to it and opens a card of its facts.
 *
 * Day and night are drawn from the sun's real position at the present minute.
 * The visitor's location is never asked for: nothing here uses geolocation.
 * The time-zone preference the site already keeps (/preferences, the World
 * Market Clock) is read, only to phrase a centre's hours in the visitor's zone.
 */

const ZOOM_MIN = 1;
const ZOOM_MAX = 2.8;
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type View = { lon: number; lat: number; zoom: number };

/** the unit vector of every place, by id */
const VEC = new Map<string, [number, number, number]>(LAYERS.flatMap((l) => l.places.map((p): [string, [number, number, number]] => [p.id, unit(p.lat, p.lon)])));

function drawMarker(ctx: CanvasRenderingContext2D, pal: EarthPalette, place: Place, x: number, y: number, near: number, picked: boolean, hot: boolean, state: CentreState | null): void {
  const r = picked ? 5 : 4;
  const tone: Colour = pal.gold;
  if (picked || hot) {
    ctx.strokeStyle = rgba(pal.ink, (picked ? 0.95 : 0.6) * near);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, TAU);
    ctx.stroke();
  }
  ctx.beginPath();
  if (place.layer === "offices") {
    // an office is a diamond
    ctx.moveTo(x, y - r - 1.5);
    ctx.lineTo(x + r + 1.5, y);
    ctx.lineTo(x, y + r + 1.5);
    ctx.lineTo(x - r - 1.5, y);
    ctx.closePath();
    ctx.fillStyle = rgba(tone, near);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.bg, 0.9 * near);
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (place.layer === "banks") {
    // a bank is a ring with a point in it
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = rgba(pal.bg, 0.9 * near);
    ctx.fill();
    ctx.strokeStyle = rgba(tone, near);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, TAU);
    ctx.fillStyle = rgba(tone, near);
    ctx.fill();
  } else {
    // a centre carries the lamp of its regular session, as on the film: filled open, half in the break, a ring before the open, a dot closed
    ctx.arc(x, y, state === "closed" ? r * 0.75 : r, 0, TAU);
    ctx.fillStyle = rgba(state === "open" ? tone : pal.bg, (state === "open" ? 1 : 0.9) * near);
    ctx.fill();
    if (state === "lunch") {
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI / 2, Math.PI * 1.5);
      ctx.fillStyle = rgba(tone, near);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.strokeStyle = state === "closed" ? rgba(pal.ink2, 0.9 * near) : state === "open" ? rgba(pal.bg, 0.9 * near) : rgba(tone, near);
    ctx.lineWidth = state === "closed" || state === "open" ? 1 : 1.5;
    ctx.stroke();
  }
}

export function WorldMap({ bankHrefs }: { bankHrefs: Record<string, string> }) {
  const id = useId();
  const still = useStillMotion();
  const now = useNow(30_000);
  const [prefs, , prefsReady] = usePrefs();
  const [layer, setLayer] = useState<LayerKey>("offices");
  const [picked, setPicked] = useState<string | null>(null);
  const [zoomShown, setZoomShown] = useState(1);

  const current = layerOf(layer);
  const place = current.places.find((p) => p.id === picked) ?? null;

  /** where the globe is, and where it is going */
  const view = useRef<View>({ ...LAYERS[0].view, zoom: 1 });
  const goal = useRef<View>({ ...LAYERS[0].view, zoom: 1 });
  const drag = useRef<{ id: number; x: number; y: number; lon: number; lat: number; moved: number } | null>(null);
  /** where each place of the layer was last drawn: x, y, and whether it faces the viewer */
  const spots = useRef<{ id: string; x: number; y: number }[]>([]);
  const radius = useRef(1);
  const hot = useRef<string | null>(null);
  const live = useRef({ layer, picked, now });
  live.current = { layer, picked, now };

  const paint: GlobePaint = (f) => {
    const v = view.current;
    const g = goal.current;
    const dl = wrap180(g.lon - v.lon);
    const settled = Math.abs(dl) < 0.05 && Math.abs(g.lat - v.lat) < 0.05 && Math.abs(g.zoom - v.zoom) < 0.002;
    if (f.still || drag.current || settled) {
      v.lon = g.lon;
      v.lat = g.lat;
      v.zoom = g.zoom;
    } else {
      const k = Math.min(1, f.dt * 5);
      v.lon += dl * k;
      v.lat += (g.lat - v.lat) * k;
      v.zoom += (g.zoom - v.zoom) * k;
    }
    const { ctx, w, h, pal } = f;
    const R = (Math.min(w, h) / 2) * 0.86 * v.zoom;
    radius.current = R;
    const at = live.current.now ?? new Date();
    const sun = sunAt(at.getTime());
    const globe: Globe = { cx: w / 2, cy: h / 2, r: R, lon: v.lon, lat: v.lat };
    drawEarth(ctx, globe, sun, pal, pal.blue);

    const places = layerOf(live.current.layer).places;
    const out: { id: string; x: number; y: number }[] = [];
    const size = w < 420 ? 10.5 : 12;
    // the chosen place is drawn last, over its neighbours
    const order = [...places].sort((a, b) => Number(a.id === live.current.picked) - Number(b.id === live.current.picked));
    for (const p of order) {
      const e = VEC.get(p.id);
      if (!e) continue;
      project(e[0], e[1], e[2]);
      if (P.z < 0.04) continue;
      const x = P.x;
      const y = P.y;
      const near = smooth((P.z - 0.04) / 0.2);
      const isPicked = p.id === live.current.picked;
      const state = p.layer === "centres" && live.current.now ? centreStatus(p.centre, live.current.now).state : p.layer === "centres" ? "closed" : null;
      drawMarker(ctx, pal, p, x, y, near, isPicked, hot.current === p.id, state);
      const gap = (isPicked ? 12 : 9) * (p.left ? -1 : 1);
      label(ctx, pal, p.mark, x + gap, y + (p.dy ?? 0), size, pal.ink, (isPicked ? 1 : 0.88) * near, p.left ? "right" : "left", isPicked ? 700 : 600);
      out.push({ id: p.id, x, y });
    }
    spots.current = out;
    return !f.still && !drag.current && !settled;
  };
  const { ref: canvasRef, request } = useGlobeCanvas(paint);

  // the sun moves, a layer or a choice changes, motion is switched: one new frame
  useEffect(() => {
    request();
  }, [now, layer, picked, still, request]);

  const aim = useCallback(
    (next: Partial<View>) => {
      const g = goal.current;
      goal.current = { lon: next.lon ?? g.lon, lat: clamp(next.lat ?? g.lat, -70, 70), zoom: clamp(next.zoom ?? g.zoom, ZOOM_MIN, ZOOM_MAX) };
      setZoomShown(goal.current.zoom);
      request();
    },
    [request],
  );

  const choose = (p: Place | null) => {
    setPicked(p ? p.id : null);
    // the globe turns to the place, and comes a little closer if it was far off
    // (the banks of Europe stand close together, so that layer comes closer still)
    if (p) aim({ lon: p.lon, lat: clamp(p.lat, -55, 55), zoom: Math.max(goal.current.zoom, p.layer === "banks" ? 1.6 : 1.25) });
  };
  const switchLayer = (key: LayerKey) => {
    setLayer(key);
    setPicked(null);
    aim({ ...layerOf(key).view, zoom: 1 });
  };
  const reset = () => aim({ ...current.view, zoom: 1 });
  const zoomBy = (k: number) => aim({ zoom: goal.current.zoom * k });

  /** the place under a point of the canvas, if one is near enough */
  const hit = (e: React.PointerEvent<HTMLCanvasElement>): string | null => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const reach = e.pointerType === "touch" ? 24 : 15;
    let best: string | null = null;
    let bestD = reach;
    for (const s of spots.current) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestD) {
        bestD = d;
        best = s.id;
      }
    }
    return best;
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, lon: view.current.lon, lat: view.current.lat, moved: 0 };
    goal.current = { ...view.current };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // a pointer that has already gone cannot be captured: the drag simply ends on the next event
    }
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) {
      // not dragging: a place under the pointer lights, and the cursor says it can be chosen
      const over = e.pointerType === "touch" ? null : hit(e);
      if (over !== hot.current) {
        hot.current = over;
        e.currentTarget.style.cursor = over ? "pointer" : "grab";
        request();
      }
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.moved = Math.max(d.moved, Math.hypot(dx, dy));
    // one radius of drag turns the globe one radian
    const k = 180 / (Math.PI * radius.current);
    view.current.lon = wrap180(d.lon - dx * k);
    view.current.lat = clamp(d.lat + dy * k, -70, 70);
    goal.current = { ...view.current };
    e.currentTarget.style.cursor = "grabbing";
    request();
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    e.currentTarget.style.cursor = "grab";
    // a press that did not travel is a choice
    if (e.type === "pointerup" && d.moved < 6) {
      const over = hit(e);
      if (over) choose(current.places.find((p) => p.id === over) ?? null);
    }
    request();
  };
  const onKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const g = goal.current;
    const turn = 15 / g.zoom;
    if (e.key === "ArrowLeft") aim({ lon: wrap180(g.lon - turn) });
    else if (e.key === "ArrowRight") aim({ lon: wrap180(g.lon + turn) });
    else if (e.key === "ArrowUp") aim({ lat: g.lat + turn });
    else if (e.key === "ArrowDown") aim({ lat: g.lat - turn });
    else if (e.key === "+" || e.key === "=") zoomBy(1.25);
    else if (e.key === "-" || e.key === "_") zoomBy(1 / 1.25);
    else if (e.key === "0" || e.key === "Home") reset();
    else return;
    e.preventDefault();
  };

  // the zone the visitor chose on the World Market Clock (or their own), to phrase a centre's hours
  const zone = prefsReady && isZoneKey(prefs.tz) ? prefs.tz : "local";
  const zoneTz = prefsReady ? zoneId(zone) : null;
  const zoneName = zone === "local" ? "your time" : zoneMeta(zone).label;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-34 gap-y-13">
        <fieldset>
          <legend className="label mb-8">Show on the globe</legend>
          <div className="seg flex w-full sm:inline-flex sm:w-auto">
            {LAYERS.map((l) => (
              <button key={l.key} type="button" aria-pressed={layer === l.key} aria-label={`${l.label}, ${l.places.length}`} onClick={() => switchLayer(l.key)} className="!h-[2.75rem] flex-1 justify-center whitespace-nowrap !px-5 sm:!px-13" data-world-layer={l.key}>
                {/* three long names do not fit a phone: the short one is shown there, the full one is the button's name */}
                <span className="sm:hidden">{l.short}</span>
                <span className="hidden sm:inline">{l.label}</span>
                <span className="num ml-5 opacity-70">{l.places.length}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <p className="max-w-[30rem] text-sm text-ink-2">{current.blurb}</p>
      </div>

      <div className="mt-21 grid gap-21 lg:grid-cols-phi lg:items-start lg:gap-34">
        {/* ── the globe ── */}
        <figure className="min-w-0">
          <div className="on-night relative overflow-hidden rounded-md border border-line" style={{ ["--bg" as string]: "var(--night)" }}>
            <div className="relative aspect-square w-full sm:aspect-[1.25]">
              <canvas
                ref={canvasRef}
                tabIndex={0}
                role="application"
                aria-roledescription="globe"
                aria-label={`Globe showing ${current.label.toLowerCase()}`}
                aria-describedby={`${id}-hint`}
                className="absolute inset-0 h-full w-full cursor-grab touch-pan-y"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onPointerLeave={() => {
                  if (hot.current) {
                    hot.current = null;
                    request();
                  }
                }}
                onKeyDown={onKey}
                data-world-globe
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-13 gap-y-8 border-t border-line p-13">
              <div className="seg" role="group" aria-label="Zoom">
                <button type="button" onClick={() => zoomBy(1 / 1.25)} disabled={zoomShown <= ZOOM_MIN + 0.001} aria-label="Zoom out" className="!h-[2.75rem] !px-13 !text-base disabled:opacity-40" data-world-zoom="out">
                  −
                </button>
                <button type="button" onClick={() => zoomBy(1.25)} disabled={zoomShown >= ZOOM_MAX - 0.001} aria-label="Zoom in" className="!h-[2.75rem] !px-13 !text-base disabled:opacity-40" data-world-zoom="in">
                  +
                </button>
              </div>
              <button type="button" className="btn btn-ghost btn-sm !h-[2.75rem]" onClick={reset} data-world-reset>
                Reset view
              </button>
              <p id={`${id}-hint`} className="min-w-[12rem] flex-1 text-xs text-ink-3">
                Drag to turn the globe (on a touch screen, drag sideways). With the globe in focus, the arrow keys turn it, + and − zoom, and 0 resets. Every place is also in the list.
              </p>
            </div>
          </div>
          <figcaption className="mt-8 text-xs text-ink-3">
            A schematic: the land is a coarse field of points, with no coastlines in detail and no borders. Positions are real. Day and night are where the sun puts them
            {now ? ` at ${hhmm(now.getUTCHours() * 60 + now.getUTCMinutes())} UTC` : " now"}.
          </figcaption>
        </figure>

        {/* ── the list and the card ── */}
        <div className="min-w-0">
          <h2 className="label" id={`${id}-list`}>
            {current.label} · {current.places.length}
          </h2>
          <ul className="mt-8 border-t border-line-strong" aria-labelledby={`${id}-list`}>
            {current.places.map((p) => {
              const s = p.layer === "centres" && now ? centreStatus(p.centre, now) : null;
              return (
                <li key={p.id} className="border-b border-line">
                  <button
                    type="button"
                    aria-pressed={picked === p.id}
                    onClick={() => choose(p)}
                    className={`group flex min-h-[2.75rem] w-full items-center justify-between gap-13 px-8 py-5 text-left transition-colors duration-fast hover:bg-surface ${picked === p.id ? "bg-surface" : ""}`}
                    data-world-place={p.id}
                  >
                    <span className="min-w-0">
                      <span className={`block truncate text-[0.9375rem] font-medium ${picked === p.id ? "text-accent" : "text-ink group-hover:text-accent"}`}>{p.name}</span>
                      <span className="block truncate text-xs text-ink-3">{p.sub}</span>
                    </span>
                    {p.layer === "centres" ? (
                      <span className={`state shrink-0 ${s ? stateClass[s.state] : "state-off"}`}>{s ? stateLabel[s.state] : "…"}</span>
                    ) : (
                      <span className="num shrink-0 text-xs text-ink-3">{now ? localTime(now, p.tz).label : "--:--"}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-21" aria-live="polite" data-world-card>
            {place ? <Card place={place} now={now} zoneTz={zoneTz} zoneName={zoneName} bankHrefs={bankHrefs} onClose={() => choose(null)} /> : <p className="panel-quiet p-21 text-sm text-ink-2">Choose a place from the list or on the globe. The globe turns to it and its details open here.</p>}
          </div>
        </div>
      </div>

      <DataNote className="mt-21" status="schedule">
        Local times, session states and the line between day and night are computed from your device clock, your browser’s time-zone data and the sun’s position. Sunrise and sunset are good to a few minutes. Public holidays and early closes are not reflected.
      </DataNote>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-13 border-b border-line py-8">
      <dt className="text-sm text-ink-3">{k}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

function Card({ place, now, zoneTz, zoneName, bankHrefs, onClose }: { place: Place; now: Date | null; zoneTz: string | null; zoneName: string; bankHrefs: Record<string, string>; onClose: () => void }) {
  const local = now ? localTime(now, place.tz) : null;
  const off = now ? zoneOffset(now, place.tz) : null;
  // the sun at this place: is it up, and when it rises and sets today, in the place's own time
  let sunLine = "";
  if (now && off !== null) {
    const sun = sunAt(now.getTime());
    const t = sunTimes(place.lat, place.lon, sun);
    sunLine = `${inDaylight(unit(place.lat, place.lon), sun) ? "Daylight now" : "After dark now"}. Sunrise about ${hhmm(t.rise + off)}, sunset about ${hhmm(t.set + off)} local time.`;
  }
  const clock = (
    <>
      <span className="num">{local ? local.label : "--:--"}</span>
      {local && <span className="text-ink-3"> · {WEEKDAY[local.weekday]}</span>}
      {off !== null && <span className="text-ink-3"> · {offsetLabel(off)}</span>}
    </>
  );

  return (
    <article className="panel p-21" aria-labelledby="world-card-title">
      <div className="flex items-start justify-between gap-13">
        <div>
          <p className="eyebrow">{place.layer === "offices" ? "Office" : place.layer === "centres" ? "Financial centre" : "Central bank"}</p>
          <h3 id="world-card-title" className="h3 mt-8">
            {place.name}
          </h3>
        </div>
        <button type="button" className="btn btn-quiet btn-sm shrink-0" onClick={onClose}>
          Close
        </button>
      </div>

      {place.layer === "offices" && (
        <>
          <address className="mt-13 text-[0.9375rem] not-italic leading-[1.618] text-ink-2">
            {place.office.entity && <span className="block font-medium text-ink">{place.office.entity}</span>}
            {place.office.lines.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
            <span className="block">{place.office.country}</span>
          </address>
          <dl className="mt-13 border-t border-line">
            <Row k="Local time">{clock}</Row>
            <Row k="The sun there">{sunLine || "…"}</Row>
            <Row k="On the globe">Placed at {place.office.town}, the town in the published address, not at the building.</Row>
          </dl>
          <p className="mt-13 flex flex-wrap gap-x-21 gap-y-8">
            <Link href="/about#company" className="go">
              Company details
            </Link>
            <Link href="/contact" className="go">
              Contact
            </Link>
          </p>
        </>
      )}

      {place.layer === "centres" &&
        (() => {
          const c = place.centre;
          const s = now ? centreStatus(c, now) : null;
          const zoneOff = now && zoneTz ? zoneOffset(now, zoneTz) : null;
          const inZone = off !== null && zoneOff !== null ? `${hhmm(c.open - off + zoneOff)}–${hhmm(c.close - off + zoneOff)} ${zoneName}` : "";
          return (
            <>
              <dl className="mt-13 border-t border-line">
                <Row k="Exchange">{c.venue}</Row>
                <Row k="Now">
                  <span className={`state ${s ? stateClass[s.state] : "state-off"}`}>{s ? stateLabel[s.state] : "…"}</span>
                  {s && (
                    <span className="num ml-8 text-ink-3">
                      {formatDuration(s.nextChangeIn)} {s.nextLabel}
                    </span>
                  )}
                </Row>
                <Row k="Local time">{clock}</Row>
                <Row k="Regular hours">
                  <span className="num">
                    {hhmm(c.open)}–{hhmm(c.close)}
                  </span>{" "}
                  local, Monday to Friday
                  {c.lunch ? (
                    <>
                      , break{" "}
                      <span className="num">
                        {hhmm(c.lunch[0])}–{hhmm(c.lunch[1])}
                      </span>
                    </>
                  ) : null}
                  {inZone && <span className="num block text-ink-3">{inZone}</span>}
                </Row>
                <Row k="The sun there">{sunLine || "…"}</Row>
              </dl>
              <p className="mt-13 flex flex-wrap gap-x-21 gap-y-8">
                <Link href="/markets/clock" className="go">
                  World Market Clock
                </Link>
                <Link href="/labs/market-day" className="go">
                  One day of markets
                </Link>
              </p>
            </>
          );
        })()}

      {place.layer === "banks" &&
        (() => {
          const b = place.bank;
          const ccy = getCurrency(b.currency);
          const href = bankHrefs[b.slug];
          return (
            <>
              <dl className="mt-13 border-t border-line">
                <Row k="Known as">{b.short}</Row>
                <Row k="Currency">
                  <span className="num font-semibold tracking-[0.04em]">{b.currency}</span>
                  {ccy ? ` · ${ccy.name}` : ""}
                </Row>
                <Row k="Where">
                  {b.city}
                  <span className="text-ink-3"> · {b.area}</span>
                </Row>
                <Row k="Policy body">{b.committee}</Row>
                <Row k="Instrument">{b.instrument}</Row>
                <Row k="Local time">{clock}</Row>
              </dl>
              <p className="mt-13 flex flex-wrap gap-x-21 gap-y-8">
                {href && (
                  <Link href={href} className="go">
                    {b.short}: the bank’s page
                  </Link>
                )}
                <Link href="/markets/central-banks" className="go">
                  Central Bank Watch
                </Link>
              </p>
            </>
          );
        })()}
    </article>
  );
}

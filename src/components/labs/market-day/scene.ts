/**
 * One frame of the market-day film.
 *
 * The globe at a simulated minute of the day: the line between night and day
 * where the sun puts it, the nine centres marked by the state of their regular
 * session (a filled lamp when open, a half lamp in the midday break, a ring in
 * the hour before the open, a small dot when closed: shape, not colour, carries
 * it), arcs between the centres that are open together, and about the globe a
 * dial of 24 hours of UTC carrying the four FX windows in two lanes and a hand
 * at the simulated minute. A small half sun stands over a centre while sunrise
 * or sunset passes it.
 *
 * Nothing here is a price or a measure of activity, and the canvas is
 * decorative: the panel beside it says all of it in words.
 */
import { centres, fxSessions } from "@/lib/sessions";
import { P, TAU, arcPath, arcPoint, clamp, drawEarth, label, project, rgba, smooth, sunAt, unit, wrapDay, type Colour, type EarthPalette, type Globe } from "./earth";
import { CLOSED, FX_SHORT, LAST, LUNCH, NC, OPEN, PRE, STEP, type DayTable } from "./film";
import type { GlobeFrame } from "./useGlobeCanvas";

/** the centres as unit vectors */
const CV = centres.map((c) => unit(c.lat, c.lon));

/** which side of its marker a centre's name stands on, so that neighbours never collide */
const LEFT = new Set(["london", "dubai", "singapore"]);

const fxTone = (pal: EarthPalette, k: number): Colour => [pal.teal, pal.gold, pal.blue, pal.emerald][k % 4];

/** an arc of the dial: minutes of the day to canvas angles (the dial runs clockwise from the top) */
function dialArc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, from: number, to: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, (from / 1440) * TAU - Math.PI / 2, (to / 1440) * TAU - Math.PI / 2);
}

/** half a sun on a horizon line, with a small chevron: up for sunrise, down for sunset */
function horizonSun(ctx: CanvasRenderingContext2D, x: number, y: number, colour: Colour, alpha: number, rising: boolean): void {
  ctx.strokeStyle = rgba(colour, alpha);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(x, y, 4, Math.PI, TAU);
  ctx.moveTo(x - 8, y);
  ctx.lineTo(x + 8, y);
  const tip = rising ? y - 10.5 : y - 6.5;
  const base = rising ? y - 7.5 : y - 9.5;
  ctx.moveTo(x - 3, base);
  ctx.lineTo(x, tip);
  ctx.lineTo(x + 3, base);
  ctx.stroke();
}

/**
 * Draw the day at `sim` minutes (0..1440, not necessarily whole), with the
 * globe facing longitude `lon`.
 */
export function drawDay(f: GlobeFrame, table: DayTable, sim: number, lon: number): void {
  const { ctx, w, h, pal } = f;
  const i = clamp(Math.floor(sim / STEP), 0, LAST);
  const cx = w / 2;
  const cy = h / 2;
  // the dial, its lanes and their letters all stand outside the globe
  const R = Math.max(40, Math.min(w, h) / 2 / 1.54);
  const small = R < 150;
  const text = small ? 10 : 11.5;
  const RD = R * 1.2;
  const lane = (k: number) => R * (1.27 + (k % 2) * 0.055);

  ctx.lineCap = "round";

  // ── the dial: 24 hours of UTC
  ctx.strokeStyle = rgba(pal.ink, 0.22);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, RD, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  for (let hr = 0; hr < 24; hr++) {
    const a = (hr / 24) * TAU;
    const len = hr % 6 === 0 ? 0.05 : 0.025;
    ctx.moveTo(cx + Math.sin(a) * RD, cy - Math.cos(a) * RD);
    ctx.lineTo(cx + Math.sin(a) * (RD - R * len), cy - Math.cos(a) * (RD - R * len));
  }
  ctx.strokeStyle = rgba(pal.ink, 0.5);
  ctx.stroke();
  for (let hr = 0; hr < 24; hr += 6) {
    const a = (hr / 24) * TAU;
    label(ctx, pal, String(hr).padStart(2, "0"), cx + Math.sin(a) * R * 1.095, cy - Math.cos(a) * R * 1.095, small ? 8.5 : 10, pal.ink2, 0.85, "center", 500);
  }

  // ── the four FX windows: the convention as a hairline, the stretch that is really open on this day drawn over it
  fxSessions.forEach((s, k) => {
    const tone = fxTone(pal, k);
    const [from, span] = table.windows[k];
    const on = (table.fx[i] & (1 << k)) !== 0;
    dialArc(ctx, cx, cy, lane(k), from, from + span);
    ctx.strokeStyle = rgba(tone, 0.3);
    ctx.lineWidth = 1;
    ctx.stroke();
    for (const [a, b] of table.bands[k]) {
      dialArc(ctx, cx, cy, lane(k), a, b);
      if (on) {
        ctx.strokeStyle = rgba(tone, 0.22);
        ctx.lineWidth = 7;
        ctx.stroke();
      }
      ctx.strokeStyle = rgba(tone, on ? 1 : 0.7);
      ctx.lineWidth = on ? 3 : 2;
      ctx.stroke();
    }
    const mid = ((from + span / 2) / 1440) * TAU;
    label(ctx, pal, FX_SHORT[s.key] ?? s.name, cx + Math.sin(mid) * R * 1.43, cy - Math.cos(mid) * R * 1.43, small ? 9 : 10.5, on ? pal.ink : pal.ink2, on ? 1 : 0.7, "center", on ? 700 : 500);
  });

  // ── the earth, lit by the sun of the simulated minute
  const sun = sunAt(table.start + sim * 60_000);
  const globe: Globe = { cx, cy, r: R, lon, lat: 16 };
  drawEarth(ctx, globe, sun, pal, pal.blue);

  // ── arcs between the centres that are open together, each with a courier whose place is read from the clock
  let pair = 0;
  for (let a = 0; a < NC; a++) {
    if (table.states[i * NC + a] !== OPEN) continue;
    for (let b = a + 1; b < NC; b++) {
      if (table.states[i * NC + b] !== OPEN) continue;
      const rise = 0.05 + 0.22 * (1 - (CV[a][0] * CV[b][0] + CV[a][1] * CV[b][1] + CV[a][2] * CV[b][2])) * 0.5;
      ctx.beginPath();
      arcPath(ctx, CV[a], CV[b], rise, 28);
      ctx.strokeStyle = rgba(pal.teal, 0.16);
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = rgba(pal.teal, 0.75);
      ctx.lineWidth = 1.1;
      ctx.stroke();
      const u = (sim / 36 + pair * 0.38) % 1;
      if (arcPoint(CV[a], CV[b], rise, pair % 2 ? 1 - u : u)) {
        ctx.fillStyle = rgba(pal.ink, 0.95);
        ctx.beginPath();
        ctx.arc(P.x, P.y, 1.9, 0, TAU);
        ctx.fill();
      }
      pair++;
    }
  }

  // ── the nine centres
  for (let c = 0; c < NC; c++) {
    project(CV[c][0], CV[c][1], CV[c][2]);
    if (P.z < 0.04) continue;
    const x = P.x;
    const y = P.y;
    const near = smooth((P.z - 0.04) / 0.22);
    const state = table.states[i * NC + c];
    const r = small ? 3.2 : 3.8;
    if (state === OPEN) {
      // the moment of the open leaves a ring that widens for half an hour of the film
      const since = table.since[i * NC + c] + (sim - i * STEP);
      if (since < 30) {
        ctx.strokeStyle = rgba(pal.gold, (1 - since / 30) * 0.9 * near);
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(x, y, r + 2 + since * 0.7, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = rgba(pal.gold, 0.2 * near);
      ctx.beginPath();
      ctx.arc(x, y, r * 2.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(pal.gold, near);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.bg, 0.9 * near);
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (state === LUNCH || state === PRE) {
      ctx.fillStyle = rgba(pal.bg, 0.9 * near);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      if (state === LUNCH) {
        ctx.fillStyle = rgba(pal.gold, near);
        ctx.beginPath();
        ctx.arc(x, y, r, Math.PI / 2, Math.PI * 1.5);
        ctx.fill();
      }
      ctx.strokeStyle = rgba(pal.gold, near);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
    } else {
      ctx.fillStyle = rgba(pal.bg, 0.85 * near);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.75, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.ink2, 0.9 * near);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const left = LEFT.has(centres[c].key);
    const strong = state !== CLOSED;
    label(ctx, pal, centres[c].city, x + (left ? -1 : 1) * (r + 5), y, text, strong ? pal.ink : pal.ink2, (strong ? 1 : 0.72) * near, left ? "right" : "left", state === OPEN ? 700 : 500);

    // sunrise or sunset passing over it
    const dr = Math.abs(wrapDay(sim - table.rise[c]));
    const ds = Math.abs(wrapDay(sim - table.set[c]));
    if (dr <= 20) horizonSun(ctx, x, y - r - 6, pal.gold, (1 - dr / 24) * near, true);
    else if (ds <= 20) horizonSun(ctx, x, y - r - 6, pal.gold, (1 - ds / 24) * near, false);
  }

  // ── the hand: the simulated minute
  const a = (sim / 1440) * TAU;
  const sx = Math.sin(a);
  const sy = -Math.cos(a);
  ctx.strokeStyle = rgba(pal.ink, 0.95);
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  ctx.moveTo(cx + sx * R * 1.035, cy + sy * R * 1.035);
  ctx.lineTo(cx + sx * R * 1.355, cy + sy * R * 1.355);
  ctx.stroke();
  ctx.fillStyle = rgba(pal.ink, 1);
  ctx.beginPath();
  ctx.arc(cx + sx * RD, cy + sy * RD, 2.6, 0, TAU);
  ctx.fill();
}

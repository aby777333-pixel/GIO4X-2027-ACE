"use client";

import { useMemo } from "react";
import { fxSessions, localTime } from "@/lib/sessions";
import { Figure, TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";

/**
 * Four figures for sections whose heading column stood empty beside a long
 * list. Each says, as a drawing, what the list beside it says in words, and
 * each answers the pointer. None shows a price or a statistic.
 */

/* ---------------------------------------------------------------------------
 * Account chooser, "How the match is made": the count, acted out.
 *
 * Three accounts, called A, B and C so that no real account is implied. A
 * first deposit rises and the account whose minimum sits above it goes quiet.
 * Four answers fall one at a time, each leaving a mark on the accounts it
 * agrees with. The one with most marks is ringed, and what counts against it
 * is hung beneath as hollow marks. The pointer picks an account and its count
 * is read out.
 * ------------------------------------------------------------------------- */

/** a rounded box; square where the browser has no roundRect */
function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

const AGREES = [
  [1, 1, 0],
  [0, 1, 1],
  [0, 1, 0],
  [1, 0, 1],
] as const;
const MINIMUM = [0.22, 0.5, 0.86] as const; // each account's minimum deposit, as a height
const DEPOSIT = 0.66; // the example first deposit: C's minimum is above it
const COUNT_CYCLE = 11;

const drawCount: FigureDraw = ({ ctx, w, h, t, hover, mx, pal, still }) => {
  if (w < 120 || h < 160) return;
  const time = still ? 9.4 : t % COUNT_CYCLE;
  const top = 44;
  const base = h - 74;
  const colW = Math.min(64, (w - 60) / 3.6);
  const gap = (w - 40 - colW * 3) / 2;
  const xOf = (c: number) => 20 + colW / 2 + c * (colW + gap);
  const picked = hover > 0.3 ? clamp(Math.round((mx - xOf(0)) / (colW + gap)), 0, 2) : -1;

  ctx.lineCap = "round";
  ctx.textBaseline = "middle";

  // the first deposit: a level that rises across all three
  const dep = smooth(time / 1.6);
  const depY = lerp(base, lerp(base, top + 26, DEPOSIT), dep);
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(12, depY);
  ctx.lineTo(w - 12, depY);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.gold, 0.9);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `600 10px ${pal.font}`;
  ctx.textAlign = "right";
  ctx.fillStyle = rgba(pal.gold, 1);
  ctx.fillText("FIRST DEPOSIT", w - 12, depY - 9);

  const totals = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const x = xOf(c);
    const minY = lerp(base, top + 26, MINIMUM[c]);
    const open = MINIMUM[c] <= DEPOSIT;
    const shut = open ? 0 : smooth((time - 1.4) / 0.8);
    const lit = picked === c ? 1 : 0;

    // the account: a column, with its minimum marked on it
    ctx.beginPath();
    box(ctx, x - colW / 2, top + 26, colW, base - top - 26, 4);
    ctx.lineWidth = 1 + lit * 0.6;
    ctx.strokeStyle = rgba(lit ? pal.accent : pal.ink3, (0.55 + lit * 0.4) * (1 - shut * 0.6));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - colW / 2 - 4, minY);
    ctx.lineTo(x + colW / 2 + 4, minY);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rgba(pal.ink2, 0.9 * (1 - shut * 0.5));
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = `600 13px ${pal.font}`;
    ctx.fillStyle = rgba(pal.ink, 1 - shut * 0.6);
    ctx.fillText(["A", "B", "C"][c], x, top + 8);

    // the marks its agreements have left
    for (let q = 0; q < 4; q++) {
      if (!AGREES[q][c]) continue;
      const landed = smooth((time - (2.6 + q * 1.1)) / 0.5);
      if (landed <= 0) continue;
      totals[c] += landed > 0.5 ? 1 : 0;
      const slot = AGREES.slice(0, q).reduce((n, row) => n + row[c], 0);
      const y = base - 12 - slot * 15;
      ctx.beginPath();
      box(ctx, x - colW / 2 + 7, lerp(top, y, landed) - 4.5, colW - 14, 9, 2);
      ctx.fillStyle = rgba(pal.accent, (0.35 + landed * 0.6) * (1 - shut * 0.7));
      ctx.fill();
    }
    if (shut > 0.02) {
      ctx.font = `600 9px ${pal.font}`;
      ctx.fillStyle = rgba(pal.ink3, shut);
      ctx.fillText("ABOVE IT", x, minY - 9);
    }
    if (lit) {
      ctx.font = `600 11px ${pal.font}`;
      ctx.fillStyle = rgba(pal.accent, 1);
      ctx.fillText(!open ? "not open" : time < 3 ? "open" : `${totals[c]} agree`, x, base + 13);
    }
  }

  // the answers, falling one at a time
  for (let q = 0; q < 4; q++) {
    const fall = (time - (2.1 + q * 1.1)) / 0.6;
    if (fall <= 0 || fall >= 1.4) continue;
    const y = lerp(10, top + 20, smooth(fall));
    ctx.beginPath();
    ctx.arc(w / 2, y, 8, 0, TAU);
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rgba(pal.gold, 1 - clamp(fall - 1) * 2.5);
    ctx.stroke();
    ctx.font = `600 9px ${pal.font}`;
    ctx.textAlign = "center";
    ctx.fillStyle = rgba(pal.ink, 1 - clamp(fall - 1) * 2.5);
    ctx.fillText(String(q + 1), w / 2, y + 0.5);
  }

  // the most agreements, among those open: ringed and named; what counts against it hangs beneath
  const named = smooth((time - 7.2) / 0.7);
  if (named > 0) {
    const x = xOf(1);
    ctx.beginPath();
    box(ctx, x - colW / 2 - 7, top - 6, colW + 14, base - top + 12, 7);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rgba(pal.gold, named);
    ctx.stroke();
    const against = smooth((time - 8.2) / 0.7);
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      box(ctx, x - colW / 2 + 7, base + 24 + i * 13, colW - 14, 8, 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(pal.ink2, against);
      ctx.stroke();
    }
    ctx.font = `600 9px ${pal.font}`;
    ctx.textAlign = "left";
    ctx.fillStyle = rgba(pal.ink3, against);
    if (x + colW / 2 + 12 < w - 60) ctx.fillText("AGAINST", x + colW / 2 + 12, base + 34);
  }

  ctx.font = `500 11px ${pal.font}`;
  ctx.textAlign = "left";
  ctx.fillStyle = rgba(pal.ink2, 0.95);
  ctx.fillText(time < 2.1 ? "The deposit decides which are open" : time < 7.2 ? "Each answer marks what it agrees with" : "Most marks is named; the rest is shown", 12, h - 12);
};

export function MatchCount() {
  return <Figure draw={drawCount} ratio={0.95} />;
}

/* ---------------------------------------------------------------------------
 * One day of markets, "A timetable and the sun": the day as one ring.
 *
 * Twenty-four hours of UTC round a dial, the four conventional FX windows as
 * arcs (read from the same table the film and the clock use, shifted by each
 * city's offset today), and the sun travelling round. An arc lights while the
 * sun is inside it; the centre counts how many are open at that hour. The
 * pointer takes the sun wherever it points.
 * ------------------------------------------------------------------------- */

type Arc = { name: string; from: number; to: number };
let arcs: Arc[] | null = null;
function sessionArcs(): Arc[] {
  if (arcs) return arcs;
  const now = new Date();
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
  arcs = fxSessions.map((s) => {
    const offset = (((localTime(now, s.tz).minutes - utc + 720) % 1440) + 1440) % 1440 - 720; // minutes ahead of UTC
    const wrap = (m: number) => (((m - offset) % 1440) + 1440) % 1440;
    return { name: s.name, from: wrap(s.open) / 60, to: wrap(s.close) / 60 };
  });
  return arcs;
}
const inside = (hour: number, a: Arc) => (a.from <= a.to ? hour >= a.from && hour < a.to : hour >= a.from || hour < a.to);

const drawDay: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal, still }) => {
  if (w < 120 || h < 160) return;
  const list = sessionArcs();
  const cx = w / 2;
  const cy = (h - 26) / 2;
  const R = Math.min(w, h - 26) / 2 - 16;
  const angleOf = (hour: number) => (hour / 24) * TAU - Math.PI / 2; // midnight at the top
  const auto = still ? 13.5 : (t * 1.1) % 24;
  let hour = auto;
  if (hover > 0.3) hour = (((Math.atan2(my - cy, mx - cx) + Math.PI / 2) / TAU) * 24 + 24) % 24;

  ctx.lineCap = "round";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // the dial: a tick each hour, a figure every six
  for (let i = 0; i < 24; i++) {
    const a = angleOf(i);
    const long = i % 6 === 0;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R + 3), cy + Math.sin(a) * (R + 3));
    ctx.lineTo(cx + Math.cos(a) * (R + (long ? 10 : 6)), cy + Math.sin(a) * (R + (long ? 10 : 6)));
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, long ? 0.9 : 0.45);
    ctx.stroke();
  }
  ctx.font = `600 9px ${pal.font}`;
  ctx.fillStyle = rgba(pal.ink3, 0.95);
  for (const i of [0, 6, 12, 18]) {
    const a = angleOf(i);
    ctx.fillText(String(i).padStart(2, "0"), cx + Math.cos(a) * (R - 9), cy + Math.sin(a) * (R - 9));
  }

  // the four windows, one ring each
  let open = 0;
  list.forEach((s, i) => {
    const r = R - 24 - i * 13;
    if (r < 14) return;
    const on = inside(hour, s);
    if (on) open++;
    const a0 = angleOf(s.from);
    const a1 = angleOf(s.to < s.from ? s.to + 24 : s.to);
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.lineWidth = on ? 6 : 4;
    ctx.strokeStyle = on ? rgba(pal.accent, 0.95) : rgba(pal.ink3, 0.35);
    ctx.stroke();
    // its name rides at the middle of the arc
    const mid = (a0 + a1) / 2;
    ctx.font = `600 9px ${pal.font}`;
    ctx.fillStyle = on ? rgba(pal.ink, 1) : rgba(pal.ink3, 0.9);
    const lx = cx + Math.cos(mid) * (r - 0.5);
    const ly = cy + Math.sin(mid) * (r - 0.5);
    const tw = ctx.measureText(s.name.toUpperCase()).width + 8;
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fillRect(lx - tw / 2, ly - 6, tw, 12);
    ctx.fillStyle = on ? rgba(pal.ink, 1) : rgba(pal.ink3, 0.95);
    ctx.fillText(s.name.toUpperCase(), lx, ly);
  });

  // the sun, and the hand it travels on
  const a = angleOf(hour);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.gold, 0.55);
  ctx.stroke();
  const sx = cx + Math.cos(a) * R;
  const sy = cy + Math.sin(a) * R;
  for (let k = 0; k < 8; k++) {
    const ra = (k / 8) * TAU + (still ? 0 : t * 0.5);
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(ra) * 8, sy + Math.sin(ra) * 8);
    ctx.lineTo(sx + Math.cos(ra) * 11.5, sy + Math.sin(ra) * 11.5);
    ctx.strokeStyle = rgba(pal.gold, 0.9);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(sx, sy, 5, 0, TAU);
  ctx.fillStyle = rgba(pal.gold, 1);
  ctx.fill();

  ctx.font = `500 11px ${pal.font}`;
  ctx.textAlign = "left";
  ctx.fillStyle = rgba(pal.ink2, 0.95);
  const hh = String(Math.floor(hour)).padStart(2, "0");
  ctx.fillText(`${hh}:00 UTC: ${open === 0 ? "no window" : open === 1 ? "one window" : `${open} windows`} open`, 12, h - 12);
};

export function DayRing() {
  return <Figure draw={drawDay} ratio={0.92} />;
}

/* ---------------------------------------------------------------------------
 * GIO4X on the map, "Three layers": three plates, one globe.
 *
 * Offices, financial centres and central banks, each on its own plate with as
 * many markers as the site lists. The plates draw together into a single disc
 * (the globe as it is shown) and part again. The pointer lifts the plate it is
 * over and reads out its count.
 * ------------------------------------------------------------------------- */

const spot = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function layersDraw(counts: readonly [number, number, number]): FigureDraw {
  const NAMES = ["Offices", "Financial centres", "Central banks"] as const;
  return ({ ctx, w, h, t, hover, my, pal, still }) => {
    if (w < 120 || h < 160) return;
    const cx = w * 0.42;
    const rx = Math.min(w * 0.36, 150);
    const ry = rx * 0.34;
    const mid = (h - 26) / 2;
    const spread = Math.min(72, (h - 26 - ry * 2 - 20) / 2);
    // apart, then together as one disc, then apart again; the pointer holds them apart
    const together = still ? 0 : smooth(clamp(Math.sin(t * 0.55) * 1.6 - 0.5)) * (1 - smooth(hover));
    const yOf = (i: number) => mid + (i - 1) * spread * (1 - together);
    const picked = hover > 0.3 ? clamp(Math.round((my - mid) / spread + 1), 0, 2) : -1;
    const tones = [pal.gold, pal.accent, pal.teal];

    ctx.textBaseline = "middle";
    for (let i = 2; i >= 0; i--) {
      const lit = picked === i ? 1 : 0;
      const y = yOf(i) - lit * 5;
      ctx.beginPath();
      ctx.ellipse(cx, y, rx, ry, 0, 0, TAU);
      ctx.fillStyle = rgba(pal.surface, 0.82);
      ctx.fill();
      ctx.lineWidth = 1 + lit * 0.7;
      ctx.strokeStyle = rgba(lit ? tones[i] : pal.ink3, 0.6 + lit * 0.4);
      ctx.stroke();
      // a faint meridian and parallel, so the plate reads as a map
      ctx.beginPath();
      ctx.ellipse(cx, y, rx * 0.5, ry, 0, 0, TAU);
      ctx.moveTo(cx - rx, y);
      ctx.lineTo(cx + rx, y);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(pal.ink3, 0.16);
      ctx.stroke();

      // its markers, as many as the site lists
      for (let k = 0; k < counts[i]; k++) {
        const a = spot(k, i + 1) * TAU;
        const d = 0.25 + spot(k, i + 7) * 0.65;
        const px = cx + Math.cos(a) * rx * d;
        const py = y + Math.sin(a) * ry * d;
        const pulse = still ? 0 : (Math.sin(t * 1.4 + k * 1.7 + i) + 1) / 2;
        ctx.beginPath();
        ctx.arc(px, py, 2.6 + lit * 1.2, 0, TAU);
        ctx.fillStyle = rgba(tones[i], 0.85 + lit * 0.15);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, 4 + pulse * 4, 0, TAU);
        ctx.strokeStyle = rgba(tones[i], 0.3 * (1 - pulse));
        ctx.stroke();
      }

      // its name and count, out to the right, fading as the plates meet
      const lx = cx + rx + 12;
      if (lx < w - 30) {
        ctx.textAlign = "left";
        ctx.font = `600 9px ${pal.font}`;
        ctx.fillStyle = rgba(lit ? pal.ink : pal.ink3, 1 - together);
        ctx.fillText(String(counts[i]), lx, y - 6);
        ctx.font = `${lit ? 600 : 500} 10px ${pal.font}`;
        const words = NAMES[i].split(" ");
        words.forEach((word, n) => ctx.fillText(word, lx, y + 6 + n * 11));
      }
    }

    ctx.font = `500 11px ${pal.font}`;
    ctx.textAlign = "left";
    ctx.fillStyle = rgba(pal.ink2, 0.95);
    ctx.fillText(together > 0.6 ? "Together: the one globe above" : "Three lists the site already keeps", 12, h - 12);
  };
}

export function ThreeLayers({ offices, centres, banks }: { offices: number; centres: number; banks: number }) {
  const draw = useMemo(() => layersDraw([offices, centres, banks]), [offices, centres, banks]);
  return <Figure draw={draw} ratio={1.02} />;
}

/* ---------------------------------------------------------------------------
 * Destination checker, "Approved third parties": inside the line, outside it.
 *
 * GIO4X at the centre, its own destinations inside a boundary, the approved
 * third parties outside it. A link leaves the centre; one that stays inside
 * arrives in the accent and is answered "official"; one that crosses the
 * boundary changes colour at the line and is answered "approved third party".
 * The pointer chooses which destination is asked about.
 * ------------------------------------------------------------------------- */

const NODES = [
  { a: -2.5, d: 0.5, out: false },
  { a: -0.6, d: 0.46, out: false },
  { a: 1.45, d: 0.52, out: false },
  { a: -1.55, d: 1, out: true },
  { a: 0.35, d: 1, out: true },
  { a: 2.5, d: 1, out: true },
  { a: -3.4, d: 1, out: true },
] as const;

const drawLine: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal, still }) => {
  if (w < 120 || h < 140) return;
  const cx = w / 2;
  const cy = (h - 26) / 2;
  const R = Math.min(w / 2 - 18, cy - 12);
  const edge = R * 0.72;
  const at = (n: (typeof NODES)[number]) => ({ x: cx + Math.cos(n.a) * R * (n.out ? 0.98 : n.d) * (n.out ? 1 : 1), y: cy + Math.sin(n.a) * R * (n.out ? 0.98 : n.d) * 0.86 });

  // which destination is being asked about: the nearest to the pointer, or each in turn
  let target = still ? 4 : Math.floor(t / 2.4) % NODES.length;
  if (hover > 0.3) {
    let best = Infinity;
    NODES.forEach((n, i) => {
      const p = at(n);
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < best) {
        best = d;
        target = i;
      }
    });
  }
  const run = still || hover > 0.3 ? 1 : smooth(clamp(((t % 2.4) / 2.4) * 1.5));

  ctx.lineCap = "round";
  ctx.textBaseline = "middle";

  // the boundary
  ctx.setLineDash([4, 5]);
  ctx.lineDashOffset = still ? 0 : -t * 5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, edge, edge * 0.86, 0, 0, TAU);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = rgba(pal.ink3, 0.8);
  ctx.stroke();
  ctx.setLineDash([]);

  NODES.forEach((n, i) => {
    const p = at(n);
    const on = i === target;
    const tone = n.out ? pal.gold : pal.accent;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(p.x, p.y);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, 0.22);
    ctx.stroke();
    if (on) {
      // the link being followed: accent as far as the boundary, gold beyond it
      const len = Math.hypot(p.x - cx, p.y - cy);
      const cross = n.out ? (edge * 0.93) / len : 1;
      const head = run;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(lerp(cx, p.x, Math.min(head, cross)), lerp(cy, p.y, Math.min(head, cross)));
      ctx.lineWidth = 1.7;
      ctx.strokeStyle = rgba(pal.accent, 0.95);
      ctx.stroke();
      if (head > cross) {
        ctx.beginPath();
        ctx.moveTo(lerp(cx, p.x, cross), lerp(cy, p.y, cross));
        ctx.lineTo(lerp(cx, p.x, head), lerp(cy, p.y, head));
        ctx.strokeStyle = rgba(pal.gold, 1);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(lerp(cx, p.x, cross), lerp(cy, p.y, cross), 3.2, 0, TAU);
        ctx.fillStyle = rgba(pal.gold, 1);
        ctx.fill();
      }
    }
    const arrived = on && run > 0.95;
    ctx.beginPath();
    ctx.arc(p.x, p.y, n.out ? 6 : 5, 0, TAU);
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.lineWidth = arrived ? 1.8 : 1.1;
    ctx.strokeStyle = rgba(arrived ? tone : pal.ink3, arrived ? 1 : 0.7);
    ctx.stroke();
    if (arrived) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, TAU);
      ctx.fillStyle = rgba(tone, 1);
      ctx.fill();
    }
  });

  // GIO4X, at the centre
  ctx.beginPath();
  ctx.arc(cx, cy, 15, 0, TAU);
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = rgba(pal.accent, 1);
  ctx.stroke();
  ctx.font = `700 8px ${pal.font}`;
  ctx.textAlign = "center";
  ctx.fillStyle = rgba(pal.ink, 1);
  ctx.fillText("GIO4X", cx, cy + 0.5);

  const outside = NODES[target].out;
  ctx.font = `500 11px ${pal.font}`;
  ctx.textAlign = "left";
  ctx.fillStyle = rgba(outside ? pal.gold : pal.accent, 1);
  ctx.fillText(run > 0.95 ? (outside ? "Outside the line: approved third party" : "Inside the line: official GIO4X") : "Checking where the address leads", 12, h - 12);
};

export function OutsideTheLine() {
  return <Figure draw={drawLine} ratio={1.15} />;
}

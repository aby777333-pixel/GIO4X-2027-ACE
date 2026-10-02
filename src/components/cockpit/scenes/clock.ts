/**
 * CLOCK — the 24-hour chronometer.
 *
 * One turn of the dial is one UTC day: 00 at the far edge, 06 to the right,
 * 12 nearest the visitor, 18 to the left. The four foreign-exchange sessions
 * lie on it as arcs, each on its own track, exactly where their local hours
 * fall in UTC today (so they shift with daylight saving, as the market does).
 * The champagne hand is the present moment; a session it stands inside is lit,
 * the others rest. The small dial at the centre carries the minute hand and a
 * smooth seconds sweep.
 *
 * Everything is the visitor's clock and the published timetable: no prices,
 * no feed, nothing that could be mistaken for a quote.
 */
import { TAU, clamp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { callouts, deck, lamp, pool, trace, type Callout } from "../kit";
import { fxSessionOpen, fxSessions, windowInUtc } from "../../../lib/sessions";

/** the dial leans back from the vertical, like a chronometer on a console */
const TILT = 0.62;
const CT = Math.cos(TILT);
const ST = Math.sin(TILT);
const CY = 0.2;
/** case, inner edge of the bezel, depth of the drum, the four session tracks, the seconds dial */
const R = 1.34;
const BEZ = 1.17;
const DEPTH = 0.2;
const TRACK = [1.08, 0.99, 0.9, 0.81];
const SEC = 0.44;
const FLOOR = -1.3;
/** the column stands on the deck a little behind the dial's centre */
const COL: V3[] = [[-0.1, FLOOR, 0.16], [0.1, FLOOR, 0.16], [0.1, -0.1, 0.16], [-0.1, -0.1, 0.16]];

/** dial plane to world: u to the right (06), v to the far edge (00), lift off the glass toward the viewer */
const flat = (u: number, v: number, lift = 0): V3 => [u, CY + v * CT + lift * ST, v * ST - lift * CT];
/** a point on the dial: `turn` of the day clockwise from 00, at radius r */
const at = (turn: number, r: number, lift = 0): V3 => flat(Math.sin(turn * TAU) * r, Math.cos(turn * TAU) * r, lift);
const sweep = (from: number, to: number, r: number, n: number, lift = 0): V3[] => {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) out.push(at(from + ((to - from) * i) / n, r, lift));
  return out;
};
/** a tapered blade from radius r0 to r1 (half-widths w0, w1) pointing at `turn` */
const blade = (turn: number, r0: number, r1: number, w0: number, w1: number, lift: number): V3[] => {
  const sn = Math.sin(turn * TAU);
  const cs = Math.cos(turn * TAU);
  const p = (r: number, w: number): V3 => flat(sn * r + cs * w, cs * r - sn * w, lift);
  return [p(r0, -w0), p(r1, -w1), p(r1, w1), p(r0, w0)];
};
const wrap = (t: number) => ((t % 1) + 1) % 1;

type Tone = "teal" | "blue" | "emerald";
/** each session wears its region's colour, the same three the site uses for the trading day */
const TONE: Record<string, Tone> = { sydney: "teal", tokyo: "teal", london: "blue", "new-york": "emerald" };
type Win = { name: string; tone: Tone; r: number; from: number; span: number; open: boolean; pts: V3[]; tag: number };
type Seg = readonly [V3, V3];
type Stop = readonly [number, string, number];
type State = { stamp: number; wins: Win[]; drum: V3[][]; inner: V3[]; lit: V3[]; edge: V3[]; foot: V3[]; glint: V3[]; tracks: V3[][]; well: V3[]; knurl: Seg[]; hours: Seg[]; halves: Seg[]; secs: Seg[] };

/** Read the timetable once a minute: where each session lies in UTC today, and whether it is inside its hours. */
function timetable(f: Frame, s: State, day: number): void {
  const stamp = Math.floor(f.now.getTime() / 60000);
  if (stamp === s.stamp) return;
  s.stamp = stamp;
  s.wins = fxSessions.map((fx, i) => {
    const w = windowInUtc(fx.tz, fx.open, fx.close, f.now);
    const from = w.start / 1440;
    const span = ((((w.end - w.start) % 1440) + 1440) % 1440) / 1440;
    const r = TRACK[i % TRACK.length];
    const pts = sweep(from, from + span, r, Math.max(10, Math.round(110 * span * f.q)), 0.004);
    return { name: fx.name.toUpperCase(), tone: TONE[fx.key] ?? "blue", r, from, span, open: fxSessionOpen(fx, f.now), pts, tag: wrap(from + span / 2) };
  });
  // Where each name's leader leaves its arc: on a quarter hour (between the graduations), best above
  // and to the right; never under an outer arc, toward the headline, under the case or under the hand.
  s.wins.forEach((w, i) => {
    let best = -99;
    for (let q = Math.floor(w.from * 48 - 0.5) + 1; (q + 0.5) / 48 < w.from + w.span; q++) {
      const t = wrap((q + 0.5) / 48);
      const covered = s.wins.some((o, j) => j < i && (wrap(t - o.from) < o.span + 0.008 || wrap(t - o.from) > 0.992));
      const hand = Math.abs(wrap(t - day + 0.5) - 0.5) < 0.028;
      const score = Math.cos(t * TAU) + 0.5 * Math.sin(t * TAU) - (t > 0.41 && t < 0.74 ? 3 : 0) - (covered ? 6 : 0) - (hand ? 1 : 0);
      if (score > best) {
        best = score;
        w.tag = t;
      }
    }
  });
}

/** add a closed outline to the current path */
function loop(f: Frame, pts: readonly V3[]): void {
  for (let i = 0; i < pts.length; i++) {
    const p = f.P(pts[i][0], pts[i][1], pts[i][2]);
    if (!p) continue;
    if (i) f.ctx.lineTo(p.x, p.y);
    else f.ctx.moveTo(p.x, p.y);
  }
  f.ctx.closePath();
}

/** fill the current path with a wash of light running between two points of the scene */
function wash(f: Frame, a: V3, b: V3, stops: readonly Stop[]): void {
  const p = f.P(...a);
  const q = f.P(...b);
  if (!p || !q) return;
  const g = f.ctx.createLinearGradient(p.x, p.y, q.x, q.y);
  for (const [k, colour, alpha] of stops) g.addColorStop(k, rgba(colour, alpha));
  f.ctx.fillStyle = g;
  f.ctx.fill();
}

/** brushed metal turning through the key light */
const metal = (f: Frame, k: number): Stop[] => [[0, f.pal.ink, 0.02], [0.2, f.pal.ink, 0.17 * k], [0.36, f.pal.ink, 0.05 * k], [0.64, f.pal.key, 0.14 * k], [0.82, f.pal.ink, 0.13 * k], [1, f.pal.ink, 0.02]];

/** many short marks in one stroke: graduations, knurling */
function marks(f: Frame, segs: readonly Seg[], count: number, colour: string, alpha: number, width = 1): void {
  if (alpha <= 0.003) return;
  const { ctx } = f;
  ctx.beginPath();
  for (let i = 0; i < count && i < segs.length; i++) {
    const a = f.P(...segs[i][0]);
    const b = f.P(...segs[i][1]);
    if (!a || !b) continue;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.strokeStyle = rgba(colour, alpha);
  ctx.lineWidth = width;
  ctx.stroke();
}

/** lettering engraved in the dial itself: it lies in the plane of the glass and foreshortens with it */
function engrave(f: Frame, text: string, u: number, v: number, height: number, colour: string, alpha: number): void {
  const o = flat(u, v, 0.004);
  const p0 = f.P(...o);
  const pu = f.P(...flat(u + 0.1, v, 0.004));
  const pv = f.P(...flat(u, v + 0.1, 0.004));
  if (!p0 || !pu || !pv || alpha <= 0.003) return;
  const k = 0.1 * f.u * p0.s;
  f.ctx.save();
  f.ctx.translate(p0.x, p0.y);
  f.ctx.transform((pu.x - p0.x) / k, (pu.y - p0.y) / k, -(pv.x - p0.x) / k, -(pv.y - p0.y) / k, 0, 0);
  f.label(text, o, { dx: -p0.x, dy: -p0.y, align: "center", size: height * f.u * p0.s, colour, alpha });
  f.ctx.restore();
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const n = f.mobile ? 64 : 96;
    // the drum is the dial swept back through its own depth: five outlines, front to back
    const drum = [0, 1, 2, 3, 4].map((k) => sweep(0, 1, R, n, (-DEPTH * k) / 4));
    const hours: Seg[] = [];
    const halves: Seg[] = [];
    const secs: Seg[] = [];
    const foot: V3[] = [];
    for (let i = 0; i < 24; i++) {
      if (i % 6) hours.push([at(i / 24, 1.205), at(i / 24, 1.3)]);
      halves.push([at((i + 0.5) / 24, 1.2), at((i + 0.5) / 24, 1.232)]);
    }
    for (let i = 0; i < 60; i++) secs.push([at(i / 60, SEC), at(i / 60, SEC - (i % 5 ? 0.028 : 0.058))]);
    for (let i = 0; i <= 48; i++) foot.push([Math.cos((i / 48) * TAU) * 0.62, FLOOR, 0.16 + Math.sin((i / 48) * TAU) * 0.62]);
    const tracks = TRACK.map((r) => sweep(0, 1, r, f.mobile ? 48 : 72));
    const knurl = drum[0].slice(0, n).map((p, i): Seg => [p, drum[4][i]]);
    return { stamp: -1, wins: [], drum, inner: sweep(0, 1, BEZ, n), lit: sweep(0.79, 1.21, R, 30), edge: sweep(0.54, 0.72, R, 16), foot, glint: foot.slice(26, 47), tracks, well: sweep(0, 1, SEC, 48), knurl, hours, halves, secs };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const sway = f.still ? 0 : Math.sin(f.t * 0.07) * 0.04;
    // on a narrow stage the instrument draws back so that the names on its right stay inside
    const zoom = f.mobile ? 0.74 : Math.min(0.86, (f.w - f.cx - 64) / (1.465 * f.u));
    f.aim(-0.16 + (f.rnd(3) - 0.5) * 0.05 + sway, 0.16, 6.2, zoom);
    if (f.mobile) {
      f.cx = f.w * 0.52;
      f.cy = f.h * 0.285;
    } else f.cy -= f.u * 0.07;
    deck(f, { y: FLOOR, alpha: 0.12 });
    pool(f, [0, FLOOR, 0.16], 2.5, pal.key, 0.2 * f.boot);

    const d = f.now;
    const day = (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()) / 86400;
    const second = (d.getUTCSeconds() + d.getUTCMilliseconds() / 1000) / 60;
    // a still frame is redrawn once a minute: it shows the minute, and no seconds it could not keep
    const minute = (d.getUTCMinutes() + (f.still ? 0 : second)) / 60;
    timetable(f, s, day);
    const on = f.on(0, 0.45);
    if (on <= 0.003) return;
    const breathe = f.still ? 1 : 0.86 + 0.14 * Math.sin(f.t * 1.1);

    // ── the pedestal: a foot plate on the deck and a column into the back of the case
    if (!f.mobile) {
      ctx.beginPath();
      loop(f, s.foot);
      ctx.fillStyle = rgba(pal.bg, 0.8 * on);
      ctx.fill();
      f.path(s.foot, pal.ink, 0.26 * on, 1);
      f.path(s.glint, pal.key, 0.5 * on, 1.4);
      ctx.beginPath();
      loop(f, COL);
      ctx.fillStyle = rgba(pal.bg, 0.92 * on);
      ctx.fill();
      wash(f, COL[0], COL[1], metal(f, on * 1.3));
      f.line(COL[0], COL[3], pal.ink, 0.3 * on, 1);
      f.line(COL[1], COL[2], pal.ink, 0.3 * on, 1);
    }

    // powering on, the case rises a little into place
    f.cy += (1 - on) * 0.14 * f.u;

    // ── the drum: brushed metal with a knurled wall, its lower edge catching the light off the deck
    ctx.beginPath();
    for (const outline of s.drum) loop(f, outline);
    ctx.fillStyle = rgba(pal.bg, 0.94 * on);
    ctx.fill();
    wash(f, at(0.75, R), at(0.25, R), metal(f, on));
    marks(f, s.knurl, f.mobile ? 0 : s.knurl.length, pal.ink, 0.09 * on);
    f.path(s.drum[4], pal.key, 0.32 * on, 1);

    // ── the dial: smoked glass, brighter where it turns away from the viewer, one band of sheen
    const band = clamp(0.36 + f.px * 0.2 + (f.still ? 0 : Math.sin(f.t * 0.21) * 0.06), 0.1, 0.84);
    ctx.beginPath();
    loop(f, s.drum[0]);
    ctx.fillStyle = rgba(pal.bg, 0.84 * on);
    ctx.fill();
    wash(f, at(0, R), at(0.5, R), [[0, pal.key, 0.17 * on], [0.5, pal.key, 0.035 * on], [1, pal.ink, 0.03 * on]]);
    wash(f, at(0.84, R), at(0.34, R), [[Math.max(0, band - 0.22), pal.ink, 0], [band, pal.ink, 0.08 * on], [Math.min(1, band + 0.12), pal.ink, 0]]);

    // ── the bezel: a machined band carrying the 24 hours
    const grad = f.on(0.12, 0.5);
    ctx.beginPath();
    loop(f, s.drum[0]);
    loop(f, s.inner);
    ctx.fillStyle = rgba(pal.ink, 0.055 * on);
    ctx.fill("evenodd");
    f.path(s.inner, pal.ink, 0.2 * on, 1);
    f.path(s.drum[0], pal.ink, 0.36 * on, 1.25);
    trace(f, s.lit, pal.key, 0.6 * on, 1.4);
    f.path(s.edge, pal.ink, 0.42 * on, 1.5);
    marks(f, s.halves, Math.round(24 * grad), pal.ink, f.mobile ? 0 : 0.26);
    marks(f, s.hours, Math.round(18 * grad), pal.ink, 0.55, 1.4);
    ["00", "06", "12", "18"].forEach((h, i) => {
      const a = (i / 4) * TAU;
      engrave(f, h, Math.sin(a) * 1.255, Math.cos(a) * 1.255, f.mobile ? 0.085 : 0.07, pal.ink, 0.9 * clamp(grad * 4 - i));
    });

    // ── the sessions: four tracks, each arc where its local hours fall in UTC today
    const names: Callout[] = [];
    s.wins.forEach((w, i) => {
      const lit = f.on(0.28 + i * 0.13, 0.4);
      const colour = pal[w.tone];
      f.path(s.tracks[i % s.tracks.length], pal.ink, 0.07 * on, 1);
      if (lit <= 0) return;
      const pts = lit >= 1 ? w.pts : w.pts.slice(0, Math.max(2, Math.round(w.pts.length * lit)));
      if (w.open) trace(f, pts, colour, 0.95 * lit, f.mobile ? 2 : 2.6, lit >= 1 ? f.t / 11 + i * 0.3 : -1);
      else f.path(pts, colour, 0.36 * lit, f.mobile ? 1.25 : 1.6);
      // the open and the close: two small stops across the track
      f.line(at(w.from, w.r - 0.03), at(w.from, w.r + 0.03), colour, (w.open ? 0.9 : 0.5) * lit, 1.25);
      if (lit >= 1) f.line(at(w.from + w.span, w.r - 0.03), at(w.from + w.span, w.r + 0.03), colour, w.open ? 0.9 : 0.5, 1.25);
      // where the hand stands inside an open session, the track is lit under it
      if (w.open && lit >= 1) lamp(f, at(day, w.r, 0.004), colour, breathe, 0.019);
      if (f.mobile) return;
      const tip = at(w.tag, 1.45 + 0.16 * Math.max(0, -Math.cos(w.tag * TAU)));
      const show = f.on(0.8, 0.2) * (w.open ? 1 : 0.76);
      f.line(at(w.tag, w.r + 0.028), tip, pal.ink, 0.19 * show, 1);
      f.dot(at(w.tag, w.r), 0.013, pal.ink, 0.85 * show);
      names.push({ text: w.name, p: tip, colour: pal.ink, alpha: show });
    });
    if (!f.mobile) engrave(f, "UTC", 0, 0.63, 0.06, pal.ink2, 0.62 * grad);

    // ── the seconds dial: a shallow well, sixty graduations and a smooth sweep
    const inner = f.on(0.5, 0.4);
    ctx.beginPath();
    loop(f, s.well);
    ctx.fillStyle = rgba(pal.bg, 0.5 * on);
    ctx.fill();
    f.path(s.well, pal.ink, 0.26 * inner, 1);
    marks(f, s.secs, Math.round(60 * inner), pal.ink, f.mobile ? 0.2 : 0.34);
    if (!f.still) {
      for (let k = 0; k < 4; k++) f.path(sweep(second - 0.13 + k * 0.0325, second - 0.0975 + k * 0.0325, SEC, 5, 0.006), pal.key, (0.12 + k * 0.2) * inner, 1.6);
      lamp(f, at(second, SEC, 0.006), pal.key, inner, 0.017);
    }

    // ── the hands: a white minute hand, and the champagne hand of the day settling onto the hour
    const hand = f.on(0.55, 0.45);
    const now = day - 0.08 * (1 - hand);
    const lift = 0.045;
    f.line(at(now, 0.06), at(now, 1.1), pal.bg, 0.5 * hand, 3);
    f.line(at(minute, -0.07, 0.03), at(minute, SEC - 0.07, 0.03), pal.ink, 0.8 * hand, 1.5);
    f.path([at(now, 0.02, lift), at(now, 1.14, lift)], pal.gold, 0.16 * hand, 6);
    f.fill(blade(now, 0, 1.14, 0.017, 0.004, lift), pal.gold, 0.95 * hand);
    f.fill(blade(now, -0.19, 0, 0.022, 0.017, lift), pal.gold, 0.8 * hand);
    f.glow(at(now, 1.14, lift), 0.17, pal.gold, 0.5 * hand * breathe);
    f.dot(at(now, 1.14, lift), 0.013, pal.ink, 0.95 * hand);
    f.dot(flat(0, 0, lift), 0.05, pal.bg, on);
    f.dot(flat(0, 0, lift), 0.05, pal.gold, 0.3 * on);
    f.dot(flat(0, 0, lift), 0.018, pal.ink, 0.9 * on);

    if (!f.mobile) callouts(f, names, { size: 11, reach: 14 });
  },
};

export default scene;

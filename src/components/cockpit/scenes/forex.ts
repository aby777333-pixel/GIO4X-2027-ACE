/**
 * FOREX — the currency globe.
 *
 * Eight currencies sit at the financial centres that issue them; the ten pairs
 * GIO4X lists are drawn as arcs between their two homes. Nothing here is a
 * price: it is geography and the pair list, lit. On an instrument page the
 * page's own pair is the one picked out in champagne.
 */
import { TAU, clamp, type Frame, type Scene, type V3 } from "../engine";
import { callouts, deck, lamp, orb, pool, ring, trace, type Callout } from "../kit";

const DEG = Math.PI / 180;

const HOMES: Record<string, [number, number]> = {
  USD: [40.7, -74.0],
  EUR: [50.1, 8.7],
  GBP: [51.5, -0.1],
  JPY: [35.7, 139.7],
  CHF: [47.4, 8.5],
  AUD: [-33.9, 151.2],
  CAD: [43.7, -79.4],
  NZD: [-41.3, 174.8],
};

const PAIRS: [string, string][] = [
  ["EUR", "USD"],
  ["GBP", "USD"],
  ["USD", "JPY"],
  ["AUD", "USD"],
  ["USD", "CHF"],
  ["USD", "CAD"],
  ["NZD", "USD"],
  ["EUR", "GBP"],
  ["EUR", "JPY"],
  ["GBP", "JPY"],
];

const R = 1.05;
/** the globe leans its north pole toward the viewer, as a desk globe does */
const LEAN = 30 * DEG;
const CL = Math.cos(LEAN);
const SL = Math.sin(LEAN);

/** position on the globe for a latitude / longitude, with longitude `spin` facing the viewer */
const place = (lat: number, lon: number, spin: number, k = 1): V3 => {
  const a = lat * DEG;
  const b = (lon - spin) * DEG;
  const x = Math.cos(a) * Math.sin(b);
  const y = Math.sin(a);
  const z = -Math.cos(a) * Math.cos(b);
  return [x * R * k, (y * CL + z * SL) * R * k, (-y * SL + z * CL) * R * k];
};

function slerp(a: V3, b: V3, t: number): V3 {
  const la = Math.hypot(a[0], a[1], a[2]);
  const lb = Math.hypot(b[0], b[1], b[2]);
  const dot = clamp((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb), -1, 1);
  const om = Math.acos(dot);
  if (om < 1e-4) return a;
  const s = Math.sin(om);
  const k1 = Math.sin((1 - t) * om) / s;
  const k2 = Math.sin(t * om) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

/** draw a path on the globe in two weights: the near side lit, the far side a suggestion */
function onGlobe(f: Frame, pts: V3[], colour: string, alpha: number, width: number, lit: boolean): void {
  let run: V3[] = [];
  let front = pts.length ? pts[0][2] < 0.12 : true;
  const flush = () => {
    if (run.length > 1) {
      if (front && lit) trace(f, run, colour, alpha, width);
      else f.path(run, colour, alpha * (front ? 1 : 0.22), width);
    }
  };
  for (const p of pts) {
    const isFront = p[2] < 0.12;
    if (isFront !== front) {
      run.push(p);
      flush();
      run = [p];
      front = isFront;
    } else run.push(p);
  }
  flush();
}

const scene: Scene = {
  pose: 14,
  draw(f: Frame) {
    const { pal } = f;
    f.aim(-0.06 + Math.sin(f.t * 0.07) * 0.04, 0.16, 6.2, f.mobile ? 0.9 : 1);

    const floor = -1.3;
    deck(f, { y: floor, alpha: 0.13 });
    pool(f, [0, floor, 0], 2.4, pal.key, 0.22 * f.boot);

    // the globe turns once every few minutes; the page's own pair starts facing the viewer
    const focus = f.tag.toUpperCase().split("-");
    const hasFocus = !!(HOMES[focus[0]] && HOMES[focus[1]]);
    const facing = hasFocus ? (HOMES[focus[0]][1] + HOMES[focus[1]][1]) / 2 : -32;
    const spin = facing + (f.still ? 0 : f.t * 1.6) + f.px * 5;

    orb(f, [0, 0, 0], R, pal.key, f.boot);

    // graticule, engraved in the glass
    const seg = Math.round(44 * f.q);
    for (let lon = 0; lon < 360; lon += 30) {
      const pts: V3[] = [];
      for (let i = 0; i <= seg; i++) pts.push(place(-90 + (180 * i) / seg, lon, spin));
      onGlobe(f, pts, pal.ink, 0.15 * f.boot, 1, false);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: V3[] = [];
      for (let i = 0; i <= seg * 2; i++) pts.push(place(lat, (360 * i) / (seg * 2), spin));
      onGlobe(f, pts, pal.ink, (lat === 0 ? 0.24 : 0.13) * f.boot, 1, false);
    }

    // the bezel: a graduated ring and two lit arcs, like the gimbals of an attitude indicator
    const turn = f.still ? 0 : f.t * 0.02;
    ring(f, [0, 0, 0], R * 1.3, { axis: "y", colour: pal.ink, alpha: 0.24 * f.boot, ticks: 72, major: 6, tickLen: 0.05, rot: turn });
    ring(f, [0, 0, 0], R * 1.45, { axis: "y", colour: pal.key, alpha: 0.5 * f.on(0.3), from: 0.04, to: 0.4, width: 1.5, rot: -turn * 1.5 });
    ring(f, [0, 0, 0], R * 1.45, { axis: "y", colour: pal.emerald, alpha: 0.38 * f.on(0.45), from: 0.56, to: 0.8, width: 1.5, rot: -turn * 1.5 });

    // pairs: arcs lifted off the surface between the two currencies' homes
    PAIRS.forEach(([a, b], i) => {
      const on = f.on(0.2 + (i / PAIRS.length) * 0.8);
      if (on <= 0) return;
      const va = place(HOMES[a][0], HOMES[a][1], spin);
      const vb = place(HOMES[b][0], HOMES[b][1], spin);
      const isFocus = hasFocus && ((focus[0] === a && focus[1] === b) || (focus[0] === b && focus[1] === a));
      const n = Math.round(34 * f.q);
      const pts: V3[] = [];
      for (let k = 0; k <= Math.round(n * on); k++) {
        const t = k / n;
        const v = slerp(va, vb, t);
        const lift = 1 + 0.16 * Math.sin(Math.PI * t);
        pts.push([v[0] * lift, v[1] * lift, v[2] * lift]);
      }
      const colour = isFocus ? pal.gold : i % 3 === 0 ? pal.teal : i % 3 === 1 ? pal.blue : pal.emerald;
      onGlobe(f, pts, colour, isFocus ? 0.95 : hasFocus ? 0.42 : 0.62, isFocus ? 1.75 : 1.15, true);
      // one slow pulse of light per pair, only while it is on the near side
      if (on >= 1 && !f.still) {
        const t = (f.t / (7 + (i % 4)) + f.rnd(i)) % 1;
        const v = slerp(va, vb, t);
        const lift = 1 + 0.16 * Math.sin(Math.PI * t);
        if (v[2] * lift < 0.1) {
          f.glow([v[0] * lift, v[1] * lift, v[2] * lift], 0.1, colour, 0.7);
          f.dot([v[0] * lift, v[1] * lift, v[2] * lift], 0.01, pal.ink, 0.9);
        }
      }
    });

    // currencies: a lamp at each home, named when it faces the viewer
    const names: Callout[] = [];
    for (const code of Object.keys(HOMES)) {
      const v = place(HOMES[code][0], HOMES[code][1], spin);
      const front = v[2] < 0.1;
      const isFocus = hasFocus && focus.includes(code);
      const level = (front ? 1 : 0.2) * f.on(0.1, 0.5);
      const breathe = f.still ? 1 : 0.82 + 0.18 * Math.sin(f.t * 1.3 + HOMES[code][1]);
      lamp(f, v, isFocus ? pal.gold : pal.key, level * breathe, 0.016);
      if (front && v[2] < -0.15) names.push({ text: code, p: v, colour: isFocus ? pal.gold : pal.ink, alpha: level });
    }
    if (!f.mobile) callouts(f, names, { size: 11, reach: 16 });

    // a quiet 24-hour dial on the deck: where in the trading day the visitor's clock is
    const dayTurn = (f.now.getUTCHours() * 60 + f.now.getUTCMinutes()) / 1440;
    ring(f, [0, floor, 0], 1.9, { axis: "y", colour: pal.ink, alpha: 0.2 * f.boot, ticks: 24, major: 6, tickLen: 0.1 });
    const hand = dayTurn * TAU - Math.PI / 2;
    f.line([Math.cos(hand) * 1.7, floor, Math.sin(hand) * 1.7], [Math.cos(hand) * 2.02, floor, Math.sin(hand) * 2.02], pal.key, 0.9 * f.boot, 2);
  },
};

export default scene;

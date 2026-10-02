/**
 * SWITCHBOARD — the panel where the visitor sets the house lights.
 *
 * A machined control panel leaning back on its stand, laid out like the page it
 * opens: a rotary selector with a graduated ring and seven coloured marks
 * (ACCENT), a row of five bat-handle toggles under their indicator lamps
 * (COMFORT), and two faders in their slots (THEME, DENSITY). Left alone it idles
 * the way real switchgear is tested: one lamp at a time walks along the row,
 * the faders drift, the selector wanders across its marks.
 *
 * The pointer is a hand on the panel. The switch under the cursor is thrown
 * with a short eased snap and its lamp comes on in champagne; the cap of the
 * nearer fader follows the cursor's height along its slot; and the selector
 * turns its index to point at the cursor, lighting the mark it passes.
 *
 * It shows controls, not their settings: no lamp here reports what the visitor
 * has actually chosen, and nothing on it is a level or a figure.
 */
import { TAU, clamp, easeInOut, lerp, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, panel, pool } from "../kit";

const FLOOR = -1.1;
/** the panel: width, height, how far it leans back, how thick the plate is */
const W = 3.1;
const H = 1.72;
const TILT = 0.38;
const THICK = 0.07;
/** panel coordinates, from its centre: the toggles and their lamps, the fader slots, the selector */
const SX = [-0.3, -0.05, 0.2, 0.45, 0.7];
const SY = -0.1;
const LY = 0.4;
const FX = [1.07, 1.35];
const F0 = -0.4;
const F1 = 0.58;
const KX = -0.98;
const KY = 0.06;
const RING = 0.46;
const KNOB = 0.27;
const MARKS = 7;

type At = (x: number, y: number, lift?: number) => V3;
type State = { throw: number[]; hot: number[]; pos: number[]; follow: number[]; turn: number };

/** a circle lying on the panel (or standing `lift` proud of it) */
function loop(A: At, x: number, y: number, r: number, lift: number, n: number): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < n; i++) out.push(A(x + Math.cos((i / n) * TAU) * r, y + Math.sin((i / n) * TAU) * r, lift));
  return out;
}

/** a rectangle on the panel */
const rect = (A: At, x0: number, y0: number, x1: number, y1: number, lift = 0): V3[] => [A(x0, y0, lift), A(x1, y0, lift), A(x1, y1, lift), A(x0, y1, lift)];

/** a machined face: a dark body under a tint of metal, with its edge */
function plate(f: Frame, q: readonly V3[], tone: number, edge: number, on: number): void {
  f.fill(q, f.pal.bg, 0.95 * on);
  f.fill(q, f.pal.ink, tone * on);
  if (edge > 0) f.path(q, f.pal.ink, edge * on, 1, true);
}

/** a bat-handle toggle and the lamp it answers to: `thrown` 0 is down and dark, 1 is up and lit */
function toggle(f: Frame, A: At, x: number, thrown: number, hot: number, test: number, on: number): void {
  if (on <= 0.003) return;
  const { pal } = f;
  const s = lerp(-1, 1, easeInOut(thrown));
  plate(f, rect(A, x - 0.075, SY - 0.15, x + 0.075, SY + 0.15), 0.05, 0.2, on);
  f.path(loop(A, x, SY, 0.055, 0.012, 14), pal.ink, 0.55 * on, 1.25, true);
  f.fill(loop(A, x, SY, 0.034, 0.012, 10), pal.bg, on);
  // the lever leans out of the panel, down when off and up when on, and catches the light along one side
  const foot = A(x, SY, 0.015);
  const tip = A(x, SY + s * 0.15, 0.17);
  const wide = Math.max(2.4, f.u * 0.03);
  f.line(foot, tip, pal.bg, on, wide + 2);
  f.line(foot, tip, pal.ink, 0.62 * on, wide);
  f.line(A(x - 0.008, SY, 0.02), A(x - 0.008, SY + s * 0.146, 0.17), pal.ink, 0.9 * on, 1);
  f.dot(tip, 0.024, pal.ink, 0.85 * on);
  f.dot(tip, 0.024, pal.gold, 0.8 * hot * on);
  // the lamp: a bezel, a dark lens with an ember in it, and light once the lever is over centre
  const lens = A(x, LY, 0.015);
  const lit = Math.max(clamp((thrown - 0.45) * 2.4), test);
  f.path(loop(A, x, LY, 0.05, 0.01, 14), pal.ink, 0.5 * on, 1.25, true);
  f.dot(lens, 0.034, pal.bg, on);
  f.dot(lens, 0.034, pal.key, 0.14 * on);
  lamp(f, lens, pal.key, lit * (1 - hot) * on, 0.027);
  lamp(f, lens, pal.gold, lit * hot * on, 0.03);
}

/** a fader: a graduated slot, lit up to the cap, and the cap standing proud of the panel */
function fader(f: Frame, A: At, x: number, pos: number, held: number, on: number): void {
  if (on <= 0.003) return;
  const { pal } = f;
  const y = lerp(F0, F1, pos);
  plate(f, rect(A, x - 0.024, F0 - 0.07, x + 0.024, F1 + 0.07), 0.02, 0.24, on);
  const n = f.mobile ? 6 : 10;
  for (let i = 0; i <= n; i++) f.line(A(x - 0.058, lerp(F0, F1, i / n)), A(x - (i % 5 ? 0.085 : 0.105), lerp(F0, F1, i / n)), pal.ink, (i % 5 ? 0.26 : 0.5) * on, 1);
  f.line(A(x, F0 - 0.05), A(x, y), pal.key, 0.75 * on * (1 - held), 2);
  f.line(A(x, F0 - 0.05), A(x, y), pal.gold, 0.9 * on * held, 2);
  // the cap: the two flanks the viewer can see, then its face with the index line across it
  const hx = 0.105;
  const hy = 0.06;
  const up = 0.12;
  plate(f, [A(x - hx, y - hy), A(x + hx, y - hy), A(x + hx, y - hy, up), A(x - hx, y - hy, up)], 0.1, 0.3, on);
  plate(f, [A(x + hx, y - hy), A(x + hx, y + hy), A(x + hx, y + hy, up), A(x + hx, y - hy, up)], 0.16, 0.3, on);
  plate(f, rect(A, x - hx, y - hy, x + hx, y + hy, up), 0.24, 0.6, on);
  f.line(A(x - hx, y + hy * 0.5, up), A(x + hx, y + hy * 0.5, up), pal.ink, 0.2 * on, 1);
  f.line(A(x - hx, y - hy * 0.5, up), A(x + hx, y - hy * 0.5, up), pal.ink, 0.2 * on, 1);
  f.line(A(x - hx, y, up), A(x + hx, y, up), held > 0.3 ? pal.gold : pal.key, 0.95 * on, 1.75);
  if (held > 0.01) f.glow(A(x, y, up), 0.3, pal.gold, 0.3 * held * on);
}

const scene: Scene<State> = {
  pose: 12,
  setup() {
    return { throw: SX.map(() => 0), hot: SX.map(() => 0), pos: FX.map((_, i) => 0.4 + i * 0.25), follow: FX.map(() => 0), turn: TAU / 4 };
  },
  draw(f, s) {
    const { pal } = f;
    f.aim(0.2 + (f.still ? 0 : Math.sin(f.t * 0.08) * 0.04), 0.07, 6.4, f.mobile ? 1 : 1.04);
    const colours = [pal.blue, pal.teal, pal.emerald, pal.gold, pal.indigo, pal.crimson, pal.accent];

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [0, FLOOR, 0.2], 2.6, pal.key, 0.2 * f.boot);

    // ── the stand: two struts behind the plate and a foot rail on the deck
    const up = f.on(0, 0.4);
    const cy = 0.1;
    const back = (x: number, y: number): V3 => [x, cy + y * Math.cos(TILT), y * Math.sin(TILT) + THICK];
    for (const x of [-1.15, 1.15]) {
      f.line(back(x, 0.5), [x, FLOOR, 0.85], pal.ink, 0.3 * up, 2);
      f.line(back(x, -0.8), [x, FLOOR, -0.05], pal.ink, 0.36 * up, 2);
      f.line([x, FLOOR, -0.05], [x, FLOOR, 0.85], pal.ink, 0.3 * up, 2);
    }
    f.line([-1.15, FLOOR, -0.05], [1.15, FLOOR, -0.05], pal.key, 0.4 * up, 1.25);

    // ── the plate itself: smoked and machined, with the thickness the viewer can see
    const pane = panel(f, [0, cy, 0], W, H, { tilt: TILT, on: up, colour: pal.key, alpha: 0.6, glass: 0.06 });
    const A: At = (x, y, lift = 0) => pane.at(0.5 + x / W, 0.5 + y / H, lift);
    const hw = W / 2;
    const hh = H / 2;
    plate(f, [A(hw, -hh), A(hw, hh), A(hw, hh, -THICK), A(hw, -hh, -THICK)], 0.14, 0.2, up);
    plate(f, [A(-hw, -hh), A(hw, -hh), A(hw, -hh, -THICK), A(-hw, -hh, -THICK)], 0.08, 0.2, up);
    f.path(rect(A, -hw + 0.04, -hh + 0.04, hw - 0.04, hh - 0.04), pal.ink, 0.08 * up, 1, true);
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      f.dot(A(x * (hw - 0.1), y * (hh - 0.1)), 0.022, pal.ink, 0.32 * up);
      f.dot(A(x * (hw - 0.1), y * (hh - 0.1)), 0.009, pal.bg, 0.9 * up);
    }
    // engraved bays and their names
    const cut = f.on(0.3, 0.3);
    f.path(rect(A, SX[0] - 0.2, -0.36, SX[4] + 0.2, 0.6), pal.ink, 0.11 * cut, 1, true);
    f.path(rect(A, FX[0] - 0.2, F0 - 0.14, FX[1] + 0.16, F1 + 0.14), pal.ink, 0.11 * cut, 1, true);
    const name = { align: "center" as const, size: f.mobile ? 8 : 10, colour: pal.ink2, alpha: 0.8 * cut };
    f.label("ACCENT", A(KX, -0.7), name);
    f.label("COMFORT", A(SX[2], -0.7), { ...name, colour: pal.gold, alpha: 0.9 * cut });
    if (!f.mobile) {
      f.label("THEME", A(FX[0], -0.7), { ...name, size: 9, dx: -5 });
      f.label("DENSITY", A(FX[1], -0.7), { ...name, size: 9, dx: 5 });
    }

    // ── where the hand is, in the panel's own terms
    const ease = (rate: number) => (f.still ? 1 : 1 - Math.exp(-f.dt * rate));
    const live = f.hover > 0.02;
    let picked = -1;
    let best = 0.1;
    SX.forEach((x, i) => {
      const k = Math.max(f.near(A(x, SY + 0.02, 0.12), f.u * 0.3), f.near(A(x, LY, 0.02), f.u * 0.3));
      if (k > best) {
        best = k;
        picked = i;
      }
    });
    // left alone, one lamp at a time walks along the row
    const walk = Math.floor(f.t / 5 + f.rnd(2) * 5) % SX.length;
    const test = f.still ? 0 : Math.sin(Math.PI * clamp((f.boot - 0.5) / 0.5)) * 0.8;
    SX.forEach((x, i) => {
      s.throw[i] += ((i === picked || i === walk ? 1 : 0) - s.throw[i]) * ease(11);
      s.hot[i] += ((i === picked ? 1 : 0) - s.hot[i]) * ease(8);
      toggle(f, A, x, s.throw[i], s.hot[i], test, f.on(0.35 + i * 0.07, 0.3));
    });

    // ── the faders: the nearer one's cap goes to the cursor's height, the other keeps its slow drift
    const ends = FX.map((x) => [f.P(...A(x, F0, 0.12)), f.P(...A(x, F1, 0.12))]);
    const gap = ends.map(([a, b]) => (a && b ? Math.abs((a.x + b.x) / 2 - f.mx) : 1e6));
    FX.forEach((x, i) => {
      const [a, b] = ends[i];
      let want = 0.5 + 0.3 * Math.sin((f.still ? 0 : f.t * 0.21) + i * 2.3 + f.rnd(5 + i) * TAU);
      const mine = live && gap[i] <= gap[1 - i];
      s.follow[i] += ((mine ? f.hover : 0) - s.follow[i]) * ease(6);
      if (a && b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        want = lerp(want, clamp(((f.mx - a.x) * dx + (f.my - a.y) * dy) / (dx * dx + dy * dy || 1)), s.follow[i]);
      }
      s.pos[i] += (want - s.pos[i]) * ease(9);
      fader(f, A, x, s.pos[i], s.follow[i], f.on(0.62 + i * 0.08, 0.3));
    });

    // ── the selector: its index turns to the cursor; left alone it wanders across the upper marks
    const dial = f.on(0.8, 0.3);
    const o = f.P(...A(KX, KY, 0.2));
    const ex = f.P(...A(KX + 0.3, KY, 0.2));
    const ey = f.P(...A(KX, KY + 0.3, 0.2));
    let aim = TAU / 4 + (f.still ? 0.45 : Math.sin(f.t * 0.13 + f.rnd(9) * TAU) * 1.1);
    if (live && o && ex && ey) {
      const ax = ex.x - o.x;
      const ay = ex.y - o.y;
      const bx = ey.x - o.x;
      const by = ey.y - o.y;
      const det = ax * by - ay * bx || 1;
      const mx = f.mx - o.x;
      const my = f.my - o.y;
      aim = Math.atan2((ax * my - ay * mx) / det, (mx * by - my * bx) / det);
    }
    s.turn += Math.atan2(Math.sin(aim - s.turn), Math.cos(aim - s.turn)) * ease(live ? 7 : 2.5);
    if (dial > 0.003) {
      const n = f.mobile ? 22 : 36;
      // the graduated ring, and seven marks in the palette's colours; the one the index points at lights
      f.path(loop(A, KX, KY, RING, 0, n), pal.ink, 0.3 * dial, 1, true);
      f.path(loop(A, KX, KY, RING + 0.075, 0, n), pal.ink, 0.1 * dial, 1, true);
      const ticks = MARKS * (f.mobile ? 4 : 8);
      for (let i = 0; i < ticks; i++) {
        const a = TAU / 4 + (i / ticks) * TAU;
        const major = i % (ticks / MARKS) === 0;
        const r1 = RING - (major ? 0.075 : 0.04);
        f.line(A(KX + Math.cos(a) * RING, KY + Math.sin(a) * RING), A(KX + Math.cos(a) * r1, KY + Math.sin(a) * r1), pal.ink, (major ? 0.6 : 0.26) * dial, 1);
      }
      for (let i = 0; i < MARKS; i++) {
        const a = TAU / 4 + (i / MARKS) * TAU;
        const at = A(KX + Math.cos(a) * (RING + 0.075), KY + Math.sin(a) * (RING + 0.075), 0.012);
        const off = Math.abs(Math.atan2(Math.sin(a - s.turn), Math.cos(a - s.turn)));
        f.dot(at, 0.026, pal.bg, dial);
        f.dot(at, 0.026, colours[i], 0.6 * dial);
        lamp(f, at, colours[i], clamp(1 - off / 0.5) * dial, 0.024);
      }
      // the knob: a knurled skirt tapering to a turned face, and the index cut across it
      const base = loop(A, KX, KY, KNOB, 0.01, n);
      const crown = loop(A, KX, KY, KNOB * 0.88, 0.2, n);
      plate(f, base, 0.06, 0.3, dial);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const shade = Math.pow(clamp(Math.cos((i / n) * TAU + 0.5)), 2);
        plate(f, [base[i], base[j], crown[j], crown[i]], 0.05 + 0.22 * shade, 0, dial);
      }
      const knurl = f.mobile ? 12 : 24;
      for (let i = 0; i < knurl; i++) {
        const a = s.turn + (i / knurl) * TAU;
        f.line(A(KX + Math.cos(a) * KNOB, KY + Math.sin(a) * KNOB, 0.01), A(KX + Math.cos(a) * KNOB * 0.88, KY + Math.sin(a) * KNOB * 0.88, 0.2), pal.ink, 0.2 * dial, 1);
      }
      plate(f, crown, 0.13, 0.6, dial);
      f.path(loop(A, KX, KY, KNOB * 0.6, 0.2, n), pal.ink, 0.16 * dial, 1, true);
      f.path(crown.slice(Math.round(n * 0.12), Math.round(n * 0.4)), pal.key, 0.6 * dial, 1.5);
      const ix = Math.cos(s.turn);
      const iy = Math.sin(s.turn);
      f.line(A(KX + ix * KNOB * 0.3, KY + iy * KNOB * 0.3, 0.2), A(KX + ix * KNOB * 0.86, KY + iy * KNOB * 0.86, 0.2), pal.gold, 0.95 * dial, 2.25);
      f.line(A(KX + ix * KNOB, KY + iy * KNOB, 0.01), A(KX + ix * KNOB * 0.88, KY + iy * KNOB * 0.88, 0.2), pal.gold, 0.9 * dial, 2);
      lamp(f, A(KX + ix * (RING - 0.13), KY + iy * (RING - 0.13), 0.01), pal.gold, (0.5 + 0.5 * f.hover) * dial, 0.016);
    }
  },
};

export default scene;

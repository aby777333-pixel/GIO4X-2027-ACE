/**
 * CONVERT — an amount passing through a rate.
 *
 * Two balls of glass stand apart, one for the currency an amount is held in and
 * one for the currency it is converted to. Between them is a graduated ring,
 * the reference rate. A stream leaves the first ball, narrows to pass through
 * the ring and opens again into the second. What goes in is not what comes out:
 * past the ring every grain of the stream is larger or smaller, by the rate,
 * and the second ball is larger or smaller with it. A lamp on the ring marks
 * where the rate stands, and the ring turns as the rate changes.
 *
 * The ring carries tick marks only and the balls no currency: the rates on the
 * page below are the published reference rates, and none of them is drawn here.
 *
 * The pointer: moving it across the frame sets the rate, from the lowest at the
 * left to the highest at the right.
 */
import { TAU, clamp, lerp, type Scene, type V3 } from "../engine";
import { deck, lamp, orb, pool, ring, ringPoint } from "../kit";

const FLOOR = -1.05;
/** the first ball: where it stands and its radius; the second: where it stands, its radius at the lowest rate and at the highest */
const [AX, AR, BX, BMIN, BMAX] = [-1.14, 0.46, 1.14, 0.3, 0.6];
/** the ring's radius, the lanes of the stream, and how narrow the stream is at the ring */
const [GATE, LANES, WAIST] = [0.42, 6, 0.07];

type State = { k: number; phase: number };

const scene: Scene<State> = {
  pose: 11,
  setup(f) {
    return { k: 0.6, phase: f.rnd(2) * 6 };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const m = f.mobile;
    const t = f.t;
    // turned a little, so the ring shows as a ring and not as a line
    f.aim(0.36 + (f.still ? 0 : Math.sin(t * 0.08 + s.phase) * 0.04), -0.1, 6.3, 1.05);

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [0, FLOOR, 0], 2.6, pal.key, 0.2 * f.boot);

    // ── the rate: it drifts slowly on its own; under the pointer it is set by hand
    const auto = f.still ? 0.72 : 0.5 + 0.5 * Math.sin(t * 0.27 + s.phase);
    const held = clamp((f.mx - f.box.x) / f.box.w);
    const want = lerp(auto, held, f.hover);
    s.k = f.still ? want : s.k + (want - s.k) * (1 - Math.exp(-f.dt * 3));
    const k = s.k;
    const br = lerp(BMIN, BMAX, k);
    /** how much larger or smaller a grain is once it has passed the ring */
    const scale = br / AR;

    // ── the two balls, each on its own stem
    const aOn = f.on(0, 0.4);
    const bOn = f.on(0.3, 0.4);
    f.line([AX, -AR, 0], [AX, FLOOR, 0], pal.ink, 0.25 * aOn, 1);
    f.line([BX, -br, 0], [BX, FLOOR, 0], pal.ink, 0.25 * bOn, 1);
    pool(f, [AX, FLOOR, 0], 0.7, pal.key, 0.2 * aOn);
    pool(f, [BX, FLOOR, 0], 0.5 + br, pal.gold, 0.2 * bOn);
    orb(f, [AX, 0, 0], AR, pal.key, aOn);
    orb(f, [BX, 0, 0], br, pal.gold, bOn);

    // ── the stream: lanes that leave the first ball, narrow to the ring and open into the second
    const flow = f.on(0.5, 0.4);
    const from = AX + AR * 0.82;
    const to = BX - br * 0.82;
    const lane = (j: number, u: number): V3 => {
      const a = (j / LANES) * TAU + 0.4;
      const wide = (u < 0.5 ? AR : br) * 0.5;
      const off = lerp(WAIST, wide, Math.pow(Math.cos(Math.PI * u), 2));
      return [lerp(from, to, u), Math.sin(a) * off, Math.cos(a) * off];
    };
    const seg = Math.max(8, Math.round(16 * f.q));
    for (let j = 0; j < LANES; j++) {
      const before: V3[] = [];
      const after: V3[] = [];
      for (let i = 0; i <= seg; i++) {
        before.push(lane(j, (i / seg) * 0.5));
        after.push(lane(j, 0.5 + (i / seg) * 0.5));
      }
      f.path(before, pal.key, 0.3 * flow, 1);
      f.path(after, pal.gold, 0.3 * flow, 1);
    }

    // ── the ring: graduated, turning with the rate, a lamp where the rate stands
    const gate = f.on(0.4, 0.4);
    const c: V3 = [0, 0, 0];
    f.line([0, -GATE, 0], [0, FLOOR, 0], pal.ink, 0.3 * gate, 1);
    ring(f, c, GATE, { axis: "x", colour: pal.ink, alpha: 0.5 * gate, ticks: m ? 12 : 24, major: 6, tickLen: 0.05, rot: k * Math.PI });
    ring(f, c, GATE * 0.42, { axis: "x", colour: pal.gold, alpha: 0.8 * gate, width: 1.4 });
    f.glow(c, 0.3, pal.gold, (0.2 + 0.15 * f.hover) * gate);
    lamp(f, ringPoint(c, GATE, 0.125 + k * 0.25, "x"), pal.gold, gate, 0.014);

    // ── the grains: one size before the ring, another after it
    const grains = Math.round((m ? 12 : 20) * f.q);
    for (let i = 0; i < grains; i++) {
      const u = (t * 0.06 + i / grains + f.rnd(i) * 0.03) % 1;
      const past = u >= 0.5;
      const p = lane(i % LANES, u);
      const a = Math.sqrt(Math.sin(Math.PI * u)) * flow;
      const r = 0.017 * (past ? scale : 1);
      f.glow(p, r * 5, past ? pal.gold : pal.key, 0.35 * a);
      f.dot(p, r, past ? pal.gold : pal.key, 0.95 * a);
    }

    const named = f.on(0.85, 0.15);
    const size = m ? 9 : 10;
    ctx.save();
    ctx.letterSpacing = "1.5px";
    f.label("FROM", [AX, AR, 0], { align: "center", size, colour: pal.key, alpha: 0.95 * named, dy: -13 });
    f.label("TO", [BX, br, 0], { align: "center", size, colour: pal.gold, alpha: 0.95 * named, dy: -13 });
    f.label("REFERENCE RATE", [0, GATE, 0], { align: "center", size, colour: pal.ink, alpha: 0.85 * named, dy: -14 });
    ctx.restore();
  },
};

export default scene;

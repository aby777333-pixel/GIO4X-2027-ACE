/**
 * DRAWDOWN — the fall, and the longer climb back.
 *
 * A pane of glass carries one curve: a balance that reaches a peak, falls into
 * a trough and climbs back to where it was. Two uprights stand at the trough,
 * the fall and the climb, and they are the same height: the distance down is
 * the distance back up.
 *
 * Under the curve lie two rules of equal length, and they are the subject. The
 * first measures the fall as a share of the peak it fell from. The second
 * measures the same climb as a share of the trough it has to start from, which
 * is smaller, so its lit part is always the longer: loss / (1 - loss), the
 * formula the page shows. The part by which it is longer is in champagne. As
 * the trough deepens the second rule runs away from the first.
 *
 * The curve is a drawing of the idea, not an account's history: no figures, no
 * scale, no symbol.
 *
 * The pointer: holding it lower on the pane makes the trough deeper.
 */
import { clamp, lerp, type Scene, type V3 } from "../engine";
import { deck, lamp, panel, pool, trace } from "../kit";

const FLOOR = -1.3;
const [PW, PH, TILT] = [3.2, 2.0, 0.07];
/** the curve's zero line, and the height of the peak above it (shares of the pane's height) */
const [BASE, RISE] = [0.39, 0.49];
/** across the pane: where the curve starts, peaks, bottoms, is whole again, and ends */
const [UA, UP, UT, UR, UB] = [0.07, 0.25, 0.52, 0.8, 0.93];
/** the loss, as a share of the peak, at its shallowest and its deepest */
const [XMIN, XMAX] = [0.2, 0.5];
/** the two rules: where they start and end, and their heights on the pane */
const [R0, R1, VLOSS, VGAIN] = [0.3, 0.93, 0.25, 0.115];
const L = 0.02;

type State = { x: number; phase: number };

const smooth = (k: number) => {
  const v = clamp(k);
  return v * v * (3 - 2 * v);
};

const scene: Scene<State> = {
  pose: 11,
  setup(f) {
    return { x: 0.36, phase: f.rnd(2) * 6 };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const m = f.mobile;
    const t = f.t;
    f.aim(-0.15 + (f.still ? 0 : Math.sin(t * 0.08 + s.phase) * 0.04), 0.1, 6.2, 1.07);

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [0, FLOOR, -0.1], 2.6, pal.key, 0.22 * f.boot);

    const pane = panel(f, [0, -0.06, 0], PW, PH, { tilt: TILT, on: f.on(0, 0.4), colour: pal.key, alpha: 0.55, glass: 0.04 });
    if (pane.on <= 0.003) return;
    const P = (u: number, v: number): V3 => pane.at(u, v, L);

    // ── the depth of the fall: it deepens and recovers slowly; under the pointer it is set by hand
    const auto = lerp(XMIN, XMAX, f.still ? 0.7 : 0.5 + 0.5 * Math.sin(t * 0.36 + s.phase));
    const o = f.P(...pane.at(0.5, 0));
    const y = f.P(...pane.at(0.5, 1));
    const pv = o && y && Math.abs(y.y - o.y) > 1 ? (f.my - o.y) / (y.y - o.y) : 0.6;
    const held = clamp(1 - (pv - BASE) / RISE, XMIN, XMAX);
    const want = lerp(auto, held, f.hover);
    s.x = f.still ? want : s.x + (want - s.x) * (1 - Math.exp(-f.dt * 4));
    const x = s.x;
    const peak = BASE + RISE;
    const trough = BASE + RISE * (1 - x);
    const curve = (u: number): number => {
      if (u < UP) return lerp(BASE + RISE * 0.52, peak, smooth((u - UA) / (UP - UA)));
      if (u < UT) return lerp(peak, trough, smooth((u - UP) / (UT - UP)));
      if (u < UR) return lerp(trough, peak, smooth((u - UT) / (UR - UT)));
      return peak + RISE * 0.07 * smooth((u - UR) / (UB - UR));
    };

    // ── the ground the curve stands on, and the level of the peak carried across the fall
    const ruled = f.on(0.2, 0.4) * pane.on;
    f.line(P(UA - 0.02, BASE), P(UB + 0.02, BASE), pal.ink, 0.3 * ruled, 1);
    const dashes = m ? 14 : 22;
    for (let i = 0; i < dashes; i++) {
      const u0 = lerp(UP, UR, i / dashes);
      f.line(P(u0, peak), P(u0 + ((UR - UP) / dashes) * 0.5, peak), pal.gold, 0.55 * ruled, 1);
    }

    // ── the curve, drawn across the pane at power-on; what was lost is the shaded part under the peak's level
    const drawn = f.on(0.3, 0.5) * pane.on;
    if (drawn <= 0.003) return;
    const n = Math.max(16, Math.round((m ? 36 : 64) * f.q));
    const end = lerp(UA, UB, drawn);
    const pts: V3[] = [];
    const dip: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const u = lerp(UA, end, i / n);
      pts.push(P(u, curve(u)));
      if (u >= UP && u <= UR) dip.push(P(u, curve(u)));
    }
    if (dip.length > 2) f.fill(dip, pal.crimson, 0.1 * drawn);
    trace(f, pts, pal.key, 0.92 * drawn, 1.6, f.still ? -1 : t / 12);

    // ── the two uprights at the trough: the fall and the climb, one height
    const lit = f.on(0.72, 0.28) * pane.on;
    const off = m ? 0.035 : 0.028;
    const cap = 0.014;
    for (const [du, colour] of [[-off, pal.crimson], [off, pal.emerald]] as const) {
      const u = UT + du;
      trace(f, [P(u, trough), P(u, peak)], colour, 0.9 * lit, 1.4);
      for (const v of [trough, peak]) f.line(P(u - cap, v), P(u + cap, v), colour, 0.9 * lit, 1.4);
    }
    lamp(f, P(UP, peak), pal.gold, lit, 0.013);
    lamp(f, P(UT, trough), pal.crimson, lit, 0.013);
    lamp(f, P(UR, peak), pal.emerald, lit, 0.013);

    const size = m ? 8 : 10;
    ctx.save();
    ctx.letterSpacing = "1.5px";
    f.label("PEAK", P(UP, peak), { align: "center", size, colour: pal.gold, alpha: 0.9 * lit, dy: -13 });
    f.label("TROUGH", P(UT, trough), { align: "center", size, colour: pal.ink2, alpha: 0.9 * lit, dy: 13 });

    // ── the two rules. Equal lengths, graduated in tenths: the fall as a share of the peak, the climb as a share of the trough
    const loss = x;
    const gain = x / (1 - x);
    const at = (k: number) => lerp(R0, R1, k);
    const rule = (v: number, name: string, colour: string, upTo: number, from = 0) => {
      if (name) f.line(P(R0, v), P(R1, v), pal.ink, 0.26 * lit, 1);
      for (let i = 0; name && i <= 10; i++) f.line(P(at(i / 10), v), P(at(i / 10), v - (i % 5 === 0 ? 0.03 : 0.018)), pal.ink, (i % 5 === 0 ? 0.6 : 0.34) * lit, 1);
      if (upTo > from) trace(f, [P(at(from), v + 0.012), P(at(upTo), v + 0.012)], colour, 0.95 * lit, 2.5);
      if (name) f.label(name, P(R0, v), { align: "right", size, colour, alpha: 0.9 * lit, dx: -9 });
    };
    rule(VLOSS, "LOSS", pal.crimson, loss);
    rule(VGAIN, "RECOVERY", pal.emerald, loss);
    // by how much the climb is the larger: the same loss carried down, and the excess beyond it
    rule(VGAIN, "", pal.gold, gain, loss);
    f.line(P(at(loss), VLOSS + 0.012), P(at(loss), VGAIN + 0.012), pal.ink, 0.3 * lit, 1);
    lamp(f, P(at(gain), VGAIN + 0.012), pal.gold, lit, 0.011);
    ctx.restore();
  },
};

export default scene;

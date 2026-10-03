/**
 * RATIO — a stop, a target, and how often the trade has to work.
 *
 * On the left one column stands on its entry: a short leg below it, the risk,
 * and a longer leg above it, the reward. The risk stays as it is; the reward
 * grows and shrinks. On the right is a dial. The lit part of its rim is the
 * share of trades that must win for the two legs to cancel out, the page's
 * break-even win rate: 1 / (1 + reward / risk). As the reward leg grows the lit
 * part of the rim draws back; as it shrinks the rim fills. A fine line joins
 * the top of the reward to the end of the lit rim, because one sets the other.
 *
 * The dial is graduated in tick marks, with no figures, and says nothing about
 * how often any trade does win.
 *
 * The pointer: holding it higher in the frame makes the reward longer.
 */
import { TAU, clamp, lerp, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, ring, slab, trace } from "../kit";

const FLOOR = -1.05;
/** the column: where it stands, half its width, the entry's height, the length of the risk leg */
const [BX, BW, ENTRY, RISK] = [-1.2, 0.12, -0.32, 0.42];
/** reward / risk at its least and its most */
const [QMIN, QMAX] = [0.6, 2.9];
/** the dial: centre, radius, and the inner edge of its rim as a share of the radius */
const [DX, DY, DR, INNER] = [0.6, -0.02, 0.84, 0.66];

type State = { q: number; phase: number };

const scene: Scene<State> = {
  pose: 11,
  setup(f) {
    return { q: 2, phase: f.rnd(2) * 6 };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const m = f.mobile;
    const t = f.t;
    f.aim(-0.13 + (f.still ? 0 : Math.sin(t * 0.08 + s.phase) * 0.04), -0.07, 6.3, 1.06);

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [0, FLOOR, 0], 2.6, pal.key, 0.22 * f.boot);

    // ── the reward: it lengthens and shortens slowly; under the pointer it is set by hand
    const auto = lerp(QMIN, QMAX, f.still ? 0.62 : 0.5 + 0.5 * Math.sin(t * 0.29 + s.phase));
    const held = lerp(QMIN, QMAX, clamp(1 - (f.my - f.box.y) / f.box.h));
    const want = lerp(auto, held, f.hover);
    s.q = f.still ? want : s.q + (want - s.q) * (1 - Math.exp(-f.dt * 3.5));
    const q = s.q;
    const top = ENTRY + q * RISK;
    /** the share of the rim that is lit: the wins needed to break even */
    const share = 1 / (1 + q);

    // ── the column: the risk below the entry, the reward above it
    const legs = f.on(0.1, 0.4);
    slab(f, [BX - BW, ENTRY - RISK * legs, -BW], [BX + BW, ENTRY, BW], pal.crimson, 0.17, legs);
    slab(f, [BX - BW, ENTRY, -BW], [BX + BW, lerp(ENTRY, top, legs), BW], pal.emerald, 0.17 + 0.05 * f.hover, legs);
    f.line([BX - BW - 0.14, ENTRY, -BW], [BX + BW + 0.14, ENTRY, -BW], pal.gold, 0.9 * legs, 1.4);
    lamp(f, [BX - BW - 0.14, ENTRY, -BW], pal.gold, legs, 0.012);

    // ── the dial: a graduated rim, and the part of it that has to be won
    const dial = f.on(0.4, 0.4);
    const c: V3 = [DX, DY, 0];
    const on = (r: number, turn: number): V3 => [DX + Math.sin(turn * TAU) * r, DY + Math.cos(turn * TAU) * r, 0];
    ring(f, c, DR, { axis: "z", colour: pal.ink, alpha: 0.34 * dial, ticks: m ? 20 : 40, major: 5, tickLen: 0.05, rot: Math.PI / 2 });
    ring(f, c, DR * INNER, { axis: "z", colour: pal.ink, alpha: 0.16 * dial });
    const n = Math.max(10, Math.round(48 * f.q * share));
    const outer: V3[] = [];
    const inner: V3[] = [];
    for (let i = 0; i <= n; i++) {
      outer.push(on(DR, (share * dial * i) / n));
      inner.push(on(DR * INNER, (share * dial * i) / n));
    }
    f.fill([...outer, ...inner.slice().reverse()], pal.gold, (0.16 + 0.06 * f.hover) * dial);
    trace(f, outer, pal.gold, 0.95 * dial, 1.6, f.still ? -1 : t / 8);
    // where the rim starts, and the needle at the end of the lit part
    f.line(on(DR * INNER, 0), on(DR + 0.06, 0), pal.ink, 0.7 * dial, 1);
    const tip = on(DR, share * dial);
    f.line(on(DR * INNER, share * dial), tip, pal.gold, 0.95 * dial, 1.5);
    lamp(f, tip, pal.gold, dial, 0.015);

    // ── one sets the other: a fine line from the top of the reward to the end of the lit rim
    const tied = f.on(0.75, 0.25);
    f.line([BX + BW, top, 0], tip, pal.ink, 0.2 * tied, 1);

    const named = f.on(0.85, 0.15);
    const size = m ? 8 : 10;
    ctx.save();
    ctx.letterSpacing = "1.5px";
    f.label("REWARD", [BX, top, 0], { align: "center", size, colour: pal.emerald, alpha: 0.95 * named, dy: -13 });
    f.label("RISK", [BX, ENTRY - RISK, 0], { align: "center", size, colour: pal.crimson, alpha: 0.95 * named, dy: 13 });
    f.label("ENTRY", [BX + BW + 0.14, ENTRY, -BW], { size, colour: pal.gold, alpha: 0.9 * named, dx: 8 });
    f.label("BREAK-EVEN", c, { align: "center", size, colour: pal.gold, alpha: 0.95 * named, dy: -7 });
    f.label("WIN RATE", c, { align: "center", size, colour: pal.ink2, alpha: 0.9 * named, dy: 8 });
    ctx.restore();
  },
};

export default scene;

/**
 * OUTCOME — one move, seen from both sides of a trade.
 *
 * A graduated post stands in the middle: the exit travels up and down it. From
 * the same entry level two arms reach the exit, one from the left for a buy,
 * one from the right for a sell. The wedge under each arm is the outcome, the
 * distance between entry and exit, and the two are always opposite: when the
 * exit stands above the entry the buy's wedge is the profit and the sell's the
 * loss, and when it falls below, the two change places. The same distance, the
 * sign reversed: that is the page's formula.
 *
 * The post carries tick marks only and the exit follows a fixed, slow swing:
 * this is a diagram of how a result is counted, not a market and not a result.
 *
 * The pointer: the exit follows it up and down the post.
 */
import { clamp, lerp, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, slab, trace } from "../kit";

const FLOOR = -1.05;
/** how far out the two entries stand, how far the exit may travel, and the post's top */
const [SPAN, REACH, TOP] = [1.42, 0.74, 0.9];
/** half the post's width and depth */
const PW = 0.035;

type State = { v: number; phase: number };

const scene: Scene<State> = {
  pose: 11,
  setup(f) {
    return { v: 0.4, phase: f.rnd(2) * 6 };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const m = f.mobile;
    const t = f.t;
    f.aim(0.12 + (f.still ? 0 : Math.sin(t * 0.08 + s.phase) * 0.04), -0.05, 6.2, 1.06);

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [0, FLOOR, 0], 2.6, pal.key, 0.22 * f.boot);

    // ── the exit: it swings above and below the entry on its own; under the pointer it is set by hand
    const auto = f.still ? REACH * 0.62 : REACH * (0.8 * Math.sin(t * 0.31 + s.phase) + 0.2 * Math.sin(t * 0.83));
    const o = f.P(0, 0, 0);
    const y = f.P(0, REACH, 0);
    const held = clamp(o && y && Math.abs(y.y - o.y) > 1 ? ((f.my - o.y) / (y.y - o.y)) * REACH : 0, -REACH, REACH);
    const want = lerp(auto, held, f.hover);
    s.v = f.still ? want : s.v + (want - s.v) * (1 - Math.exp(-f.dt * 5));
    const v = s.v;
    const up = v >= 0;
    /** how far the exit stands from the entry, 0 to 1: nothing is named while the two coincide */
    const far = clamp(Math.abs(v) / 0.16);
    const P = (px: number, py: number): V3 => [px, py, 0];

    // ── the post, graduated on both edges
    const postOn = f.on(0, 0.35);
    slab(f, [-PW, FLOOR, -PW], [PW, FLOOR + (TOP - FLOOR) * postOn, PW], pal.ink, 0.1, postOn);
    const step = m ? 0.14 : 0.07;
    for (let i = 0; -REACH - 0.07 + i * step <= REACH + 0.071; i++) {
      const ty = -REACH - 0.07 + i * step;
      const major = i % (m ? 3 : 6) === 0;
      const len = major ? 0.09 : 0.05;
      f.line(P(-PW - 0.02, ty), P(-PW - 0.02 - len, ty), pal.ink, (major ? 0.5 : 0.27) * postOn, 1);
      f.line(P(PW + 0.02, ty), P(PW + 0.02 + len, ty), pal.ink, (major ? 0.5 : 0.27) * postOn, 1);
    }

    // ── the entry level: one line through both entries
    const level = f.on(0.25, 0.35);
    f.line(P(-SPAN - 0.08, 0), P(SPAN + 0.08, 0), pal.gold, 0.5 * level, 1);

    // ── the two arms and the wedge under each: the same distance, opposite outcomes
    const arms = f.on(0.5, 0.35);
    const sides = [
      { name: "BUY", dir: -1, win: up },
      { name: "SELL", dir: 1, win: !up },
    ];
    const size = m ? 9 : 10;
    ctx.save();
    ctx.letterSpacing = "1.5px";
    for (const side of sides) {
      const colour = side.win ? pal.emerald : pal.crimson;
      const ex = side.dir * SPAN;
      f.fill([P(ex, 0), P(0, 0), P(0, v)], colour, (0.11 + 0.05 * f.hover) * arms);
      // the wedge is ruled, so it reads as a measured distance and not as a surface
      const rules = m ? 6 : 10;
      for (let i = 1; i < rules; i++) f.line(P(ex * (1 - i / rules), 0), P(ex * (1 - i / rules), (v * i) / rules), colour, 0.3 * arms, 1);
      trace(f, [P(ex, 0), P(0, v)], colour, 0.9 * arms, 1.5, f.still ? -1 : t / 6 + (side.dir > 0 ? 0.5 : 0));
      lamp(f, P(ex, 0), pal.gold, level, 0.014);
      f.label("ENTRY", P(ex, 0), { align: "center", size, colour: pal.gold, alpha: 0.9 * level, dy: up ? 15 : -15 });
      f.label(side.name, P(ex / 2, TOP + 0.08), { align: "center", size, colour: pal.ink, alpha: 0.85 * arms });
      f.label(side.win ? "PROFIT" : "LOSS", P(ex / 2, v / 2 + (up ? 0.15 : -0.15)), { align: "center", size, colour, alpha: 0.95 * arms * far });
    }

    // ── the exit itself: a hairline across the post and a lamp where the arms meet
    f.line(P(-0.2, v), P(0.2, v), pal.ink, 0.6 * arms, 1);
    lamp(f, P(0, v), pal.ink, arms, 0.016);
    f.label("EXIT", P(0, v), { align: "center", size, colour: pal.ink, alpha: 0.9 * arms, dy: up ? -15 : 15 });
    ctx.restore();
  },
};

export default scene;

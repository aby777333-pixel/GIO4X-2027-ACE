/**
 * PIP — one step on the scale, and what it is worth.
 *
 * A graduated scale lies along the deck. One of its steps, a single pip, is
 * lit in champagne: it is small, and it is the same size wherever on the scale
 * it is read, so it wanders slowly from step to step. From that one step two
 * rays open upward to a bar made of equal blocks, the lots. The bar is what the
 * step is worth: add a lot and it grows by one block, take one away and it
 * shrinks, while the step below never changes.
 *
 * The scale carries tick marks only, no price, and the bar no amount: the page
 * below does the arithmetic with the visitor's own inputs.
 *
 * The pointer: moving it across the frame sets the size, from one lot at the
 * left to the most at the right.
 */
import { clamp, lerp, type Scene, type V3 } from "../engine";
import { deck, eyeX, lamp, pool, slab, trace } from "../kit";

const FLOOR = -0.95;
/** the scale: half its length, its top, half its depth, one step */
const [HALF, TOP, RD, STEP] = [1.55, FLOOR + 0.12, 0.2, 0.1];
/** the bar of value: its foot, its height, half its depth, the width one lot adds */
const [BY, BH, BD, LOT] = [0.4, 0.2, 0.12, 0.44];
/** lots, the fewest and the most */
const [KMIN, KMAX] = [1, 6];

type State = { k: number; a: number; phase: number };

const scene: Scene<State> = {
  pose: 11,
  setup(f) {
    return { k: 3.6, a: 0, phase: f.rnd(2) * 6 };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const m = f.mobile;
    const t = f.t;
    f.aim(0.17 + (f.still ? 0 : Math.sin(t * 0.08 + s.phase) * 0.035), -0.15, 6.3, 1.08);

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [0, FLOOR, 0], 2.7, pal.key, 0.22 * f.boot);

    // ── the size: it rises and falls slowly on its own; under the pointer it is set by hand
    const auto = lerp(KMIN, KMAX, f.still ? 0.55 : 0.5 + 0.5 * Math.sin(t * 0.3 + s.phase));
    const held = lerp(KMIN, KMAX, clamp((f.mx - f.box.x) / f.box.w));
    const want = lerp(auto, held, f.hover);
    s.k = f.still ? want : s.k + (want - s.k) * (1 - Math.exp(-f.dt * 3));
    const k = s.k;

    // ── the scale, graduated along its front edge: tick marks, never figures
    const railOn = f.on(0, 0.35);
    slab(f, [-HALF, FLOOR, -RD], [HALF, TOP, RD], pal.ink, 0.07, railOn);
    const steps = Math.round((2 * HALF) / STEP);
    for (let i = 0; i <= steps; i++) {
      const major = i % 5 === 0;
      if (m && !major && i % 2) continue;
      const x = -HALF + i * STEP;
      f.line([x, TOP, -RD], [x, TOP - (major ? 0.065 : 0.035), -RD], pal.ink, (major ? 0.55 : 0.3) * railOn, 1);
    }

    // ── the one step: it moves from step to step along the scale and is the same size on each
    const at = Math.round(lerp(9, 20, f.still ? 0.4 : 0.5 + 0.5 * Math.sin(t * 0.13 + s.phase * 2)));
    const home = -HALF + at * STEP;
    s.a = f.still || !s.a ? home : s.a + (home - s.a) * (1 - Math.exp(-f.dt * 2.2));
    const [x0, x1] = [s.a, s.a + STEP];
    const lit = f.on(0.3, 0.3);
    f.fill([[x0, TOP, -RD], [x1, TOP, -RD], [x1, TOP, RD], [x0, TOP, RD]], pal.gold, 0.55 * lit);
    f.fill([[x0, FLOOR, -RD], [x1, FLOOR, -RD], [x1, TOP, -RD], [x0, TOP, -RD]], pal.gold, 0.3 * lit);
    f.glow([x0 + STEP / 2, TOP, 0], 0.3, pal.gold, 0.3 * lit);

    // ── the rays: the step below, opened out to the width of the bar above
    const w = k * LOT;
    const fan = f.on(0.5, 0.3);
    const corners: V3[] = [[x0, TOP, 0], [x1, TOP, 0], [w / 2, BY, 0], [-w / 2, BY, 0]];
    f.fill(corners, pal.gold, (0.06 + 0.04 * f.hover) * fan);
    for (const v of [0.33, 0.66]) {
      f.line([lerp(x0, -w / 2, v), lerp(TOP, BY, v), 0], [lerp(x1, w / 2, v), lerp(TOP, BY, v), 0], pal.gold, 0.22 * fan, 1);
    }
    trace(f, [corners[0], corners[3]], pal.gold, 0.7 * fan, 1.2, f.still ? -1 : t / 5);
    trace(f, [corners[1], corners[2]], pal.gold, 0.7 * fan, 1.2, f.still ? -1 : t / 5);

    // ── the bar: one block for each lot, the last of them still arriving
    const barOn = f.on(0.65, 0.3);
    const count = Math.ceil(k - 0.001);
    const eye = eyeX(f);
    const order = Array.from({ length: count }, (_, i) => i).sort((p, q) => Math.abs(-w / 2 + (q + 0.5) * LOT - eye) - Math.abs(-w / 2 + (p + 0.5) * LOT - eye));
    for (const i of order) {
      const a0 = -w / 2 + i * LOT;
      const a1 = Math.min(a0 + LOT, w / 2) - 0.03;
      if (a1 - a0 < 0.012) continue;
      slab(f, [a0, BY, -BD], [a1, BY + BH, BD], i === count - 1 ? pal.gold : pal.key, 0.17 + 0.05 * f.hover, barOn);
    }
    lamp(f, [-w / 2, BY, 0], pal.gold, fan, 0.012);
    lamp(f, [w / 2, BY, 0], pal.gold, fan, 0.012);

    const named = f.on(0.85, 0.15);
    const size = m ? 9 : 10;
    ctx.save();
    ctx.letterSpacing = "1.5px";
    f.label("ONE PIP", [x0 + STEP / 2, FLOOR, -RD], { align: "center", size, colour: pal.gold, alpha: 0.95 * named, dy: 14 });
    f.label("ITS VALUE", [0, BY + BH, 0], { align: "center", size, colour: pal.ink, alpha: 0.85 * named, dy: -15 });
    f.label("LOTS", [w / 2, BY + BH / 2, -BD], { size, colour: pal.key, alpha: 0.9 * named, dx: 10 });
    ctx.restore();
  },
};

export default scene;

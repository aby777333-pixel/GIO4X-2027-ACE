/**
 * LEVERAGE — the lever itself.
 *
 * A graduated beam rests on a fulcrum that slides along a rail. On the long arm
 * sits a small block, the margin; on the short arm a large one, the position it
 * holds up. As the ratio changes the fulcrum travels toward the large block,
 * the large block grows to stay in balance, and the beam tips while the two
 * settle. Beside each end of the beam a short gauge shows how far that end can
 * swing: a small movement at the position's end is a large one at the margin's.
 * That is the whole of leverage, and it is drawn without a single figure.
 *
 * The block's face grows in proportion to the ratio of the two arms, so the
 * beam really is in balance wherever the fulcrum stands. Nothing here states a
 * leverage that GIO4X offers.
 *
 * The pointer: moving it across the frame slides the fulcrum, from a low ratio
 * at the left to a high one at the right.
 */
import { clamp, lerp, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, trace } from "../kit";

const FLOOR = -0.92;
/** the rail the fulcrum slides on: its top */
const RAIL = FLOOR + 0.1;
/** half the beam's length, the pivot's height, the beam's thickness and half its depth */
const [HALF, PIVOT, BT, BD] = [1.5, -0.04, 0.07, 0.13];
/** the ratio of the long arm to the short one, at its lowest and its highest */
const [RMIN, RMAX] = [1.5, 5];
/** the margin block's side, and the most the beam may tip (radians) */
const [SIDE, TIP] = [0.2, 0.13];

type State = { r: number; phase: number };
type At = (a: number, b: number, z: number) => V3;

/** a machined block between two corners of a local frame: smoked body, tinted faces, bright arrises */
function block(f: Frame, at: At, a0: number, a1: number, b0: number, b1: number, z0: number, z1: number, colour: string, tint: number, on: number): void {
  if (on <= 0.003) return;
  const v: V3[] = [at(a0, b0, z0), at(a1, b0, z0), at(a1, b1, z0), at(a0, b1, z0), at(a0, b0, z1), at(a1, b0, z1), at(a1, b1, z1), at(a0, b1, z1)];
  const face = (q: V3[], k: number) => {
    f.fill(q, f.pal.bg, 0.95 * on);
    f.fill(q, colour, tint * k * on);
    f.path(q, colour, 0.5 * on, 1, true);
  };
  // an end face shows only while the camera stands on its side of the block
  const rf = f.P(...v[1]);
  const rb = f.P(...v[5]);
  const lf = f.P(...v[0]);
  const lb = f.P(...v[4]);
  if (lf && lb && lb.x < lf.x - 0.5) face([v[4], v[0], v[3], v[7]], 0.5);
  if (rf && rb && rb.x > rf.x + 0.5) face([v[1], v[5], v[6], v[2]], 0.6);
  face([v[3], v[2], v[6], v[7]], 1.5);
  face([v[0], v[1], v[2], v[3]], 1);
}

const scene: Scene<State> = {
  pose: 11,
  setup(f) {
    return { r: 3, phase: f.rnd(2) * 6 };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const m = f.mobile;
    const t = f.t;
    // seen from a little above and to one side, so the beam shows its top and the blocks their depth
    f.aim(0.2 + (f.still ? 0 : Math.sin(t * 0.08 + s.phase) * 0.035), -0.16, 6.3, 1.1);

    // ── the ratio: it rises and falls slowly on its own; under the pointer it is set by hand
    const auto = lerp(RMIN, RMAX, f.still ? 0.62 : 0.5 + 0.5 * Math.sin(t * 0.28 + s.phase));
    const held = lerp(RMIN, RMAX, clamp((f.mx - f.box.x) / f.box.w));
    const want = lerp(auto, held, f.hover);
    s.r = f.still ? want : s.r + (want - s.r) * (1 - Math.exp(-f.dt * 1.6));
    const r = s.r;
    // the beam tips while the fulcrum is still catching up, and comes level when it has
    const th = f.still ? 0 : clamp((want - r) * 0.22, -TIP, TIP);
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const fx = -HALF + (2 * HALF * r) / (1 + r);
    const long = HALF + fx;
    const short = HALF - fx;
    /** the beam's own frame: along it from the pivot, up off it, and depth */
    const B: At = (a, b, z) => [fx + a * c + b * sn, PIVOT - a * sn + b * c, z];
    const W: At = (a, b, z) => [a, b, z];
    const second = pal.key === pal.teal ? pal.blue : pal.teal;

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [0, FLOOR, 0], 2.7, pal.key, 0.22 * f.boot);

    // ── the rail, graduated along its front edge, and the light the fulcrum throws on it
    const railOn = f.on(0, 0.35);
    block(f, W, -HALF - 0.14, HALF + 0.14, FLOOR, RAIL, -0.2, 0.2, pal.ink, 0.07, railOn);
    const pitch = m ? 0.2 : 0.1;
    for (let i = 0; i * pitch <= 2 * HALF + 0.001; i++) {
      const x = -HALF + i * pitch;
      const major = i % 5 === 0;
      f.line([x, RAIL, -0.2], [x, RAIL - (major ? 0.06 : 0.035), -0.2], pal.ink, (major ? 0.5 : 0.28) * railOn, 1);
    }
    pool(f, [fx, RAIL, 0], 0.5, pal.gold, 0.26 * f.on(0.25, 0.3));

    // ── how far each end can swing: the long arm's end travels further than the short arm's
    const gOn = f.on(0.7, 0.3);
    for (const side of [-1, 1]) {
      const arm = side < 0 ? long : short;
      const colour = side < 0 ? pal.gold : second;
      const x = side * (HALF + 0.15);
      const reach = arm * Math.sin(TIP);
      f.line([x, PIVOT - reach, 0], [x, PIVOT + reach, 0], colour, 0.5 * gOn, 1);
      for (const y of [PIVOT - reach, PIVOT, PIVOT + reach]) f.line([x - (y === PIVOT ? 0.025 : 0.045), y, 0], [x + (y === PIVOT ? 0.025 : 0.045), y, 0], colour, 0.75 * gOn, 1);
      f.dot([x, PIVOT + (side < 0 ? 1 : -1) * arm * sn, 0], 0.016, colour, 0.95 * gOn);
    }

    // ── the fulcrum: a wedge on the rail, its edge under the beam
    const wOn = f.on(0.2, 0.3);
    const apex = PIVOT - BT / 2 - 0.006;
    const wz = 0.16;
    const wedge = (z: number): V3[] => [[fx - 0.2, RAIL, z], [fx + 0.2, RAIL, z], [fx, apex, z]];
    const near = wedge(-wz);
    const far = wedge(wz);
    for (const i of [0, 1]) {
      const q: V3[] = [near[i], far[i], far[2], near[2]];
      f.fill(q, pal.bg, 0.95 * wOn);
      f.fill(q, pal.gold, (i ? 0.1 : 0.05) * wOn);
      f.path(q, pal.gold, 0.4 * wOn, 1, true);
    }
    f.fill(near, pal.bg, 0.95 * wOn);
    f.fill(near, pal.gold, 0.16 * wOn);
    f.path(near, pal.gold, 0.7 * wOn, 1.25, true);

    // ── the beam: graduated from the margin's end, its two arms lit apart
    const bOn = f.on(0.35, 0.35);
    block(f, B, -long, short, -BT / 2, BT / 2, -BD, BD, pal.ink, 0.1, bOn);
    const every = m ? 0.2 : 0.1;
    for (let i = 1; i * every < 2 * HALF - 0.01; i++) {
      const a = -long + i * every;
      const major = i % 5 === 0;
      f.line(B(a, BT / 2, -BD), B(a, BT / 2 - (major ? 0.05 : 0.03), -BD), pal.ink, (major ? 0.6 : 0.32) * bOn, 1);
    }
    trace(f, [B(-long, BT / 2, -BD), B(0, BT / 2, -BD)], pal.gold, 0.8 * bOn, 1.4, f.still ? -1 : t / 7);
    trace(f, [B(0, BT / 2, -BD), B(short, BT / 2, -BD)], second, 0.85 * bOn, 1.4);
    lamp(f, B(0, 0, -BD), pal.gold, wOn, 0.016);

    // ── the two blocks. The position's face grows with the ratio, so the beam is in balance where it stands
    const kOn = f.on(0.6, 0.3);
    const drop = (1 - kOn) * 0.16;
    const big = SIDE * Math.sqrt(r);
    block(f, B, -long, -long + SIDE, BT / 2 + drop, BT / 2 + SIDE + drop, -SIDE / 2, SIDE / 2, pal.gold, 0.2, kOn);
    block(f, B, short - big, short, BT / 2 + drop, BT / 2 + big + drop, -SIDE / 2, SIDE / 2, second, 0.14 + 0.05 * f.hover, kOn);

    const named = f.on(0.85, 0.15);
    const size = m ? 9 : 10;
    ctx.save();
    ctx.letterSpacing = "1.5px";
    f.label("MARGIN", B(-long + SIDE / 2, BT / 2 + SIDE, 0), { align: "center", size, colour: pal.gold, alpha: 0.95 * named, dy: -13 });
    f.label("POSITION", B(short - big / 2, BT / 2 + big, 0), { align: "center", size, colour: pal.ink, alpha: 0.85 * named, dy: -13 });
    ctx.restore();
  },
};

export default scene;

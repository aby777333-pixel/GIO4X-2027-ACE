/**
 * SIZING — the risk is fixed; the size follows the stop.
 *
 * Two posts stand on a rail: the entry, which stays where it is, and the stop,
 * which travels. Between them lies a stack of plates, the lots. The stack is as
 * wide as the distance to the stop and as tall as the size of the trade, and
 * its face is the risk: width times height. The risk is held, so the stack can
 * only change shape. Move the stop away and plates come off the top; bring it
 * close and they pile up. The stack's upper corner rides a dashed curve, the
 * line of every shape with that same face.
 *
 * That is the page's formula, size = risk / stop distance, drawn without a
 * figure. Nothing here is a recommended size.
 *
 * The pointer: the stop follows it along the rail.
 */
import { clamp, lerp, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, slab, trace } from "../kit";

const FLOOR = -0.95;
const RAIL = FLOOR + 0.1;
/** where the entry stands, and the stop's distance from it at its nearest and its farthest */
const [EX, DMIN, DMAX] = [-1.08, 0.6, 2.3];
/** the face of the stack, which never changes */
const AREA = 0.78;
/** one plate's thickness, the gap between plates, half the stack's depth, the posts' height */
const [PLATE, GAP, ZD, POST] = [0.11, 0.014, 0.2, 1.42];

type State = { d: number; phase: number };

const scene: Scene<State> = {
  pose: 11,
  setup(f) {
    return { d: 1.3, phase: f.rnd(2) * 6 };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const m = f.mobile;
    const t = f.t;
    f.aim(-0.15 + (f.still ? 0 : Math.sin(t * 0.08 + s.phase) * 0.035), -0.13, 6.3, 1.08);

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [0, FLOOR, 0], 2.7, pal.key, 0.22 * f.boot);

    // ── the stop's distance: it travels out and back slowly; under the pointer it is set by hand
    const auto = lerp(DMIN, DMAX, f.still ? 0.42 : 0.5 + 0.5 * Math.sin(t * 0.27 + s.phase));
    const o = f.P(EX, RAIL, -ZD);
    const x = f.P(EX + DMAX, RAIL, -ZD);
    const held = clamp(o && x && Math.abs(x.x - o.x) > 1 ? ((f.mx - o.x) / (x.x - o.x)) * DMAX : 1.3, DMIN, DMAX);
    const want = lerp(auto, held, f.hover);
    s.d = f.still ? want : s.d + (want - s.d) * (1 - Math.exp(-f.dt * 3.5));
    const d = s.d;
    const h = AREA / d;
    const front = (px: number, py: number): V3 => [px, py, -ZD];

    // ── the rail, graduated along its front edge
    const railOn = f.on(0, 0.35);
    slab(f, [-1.6, FLOOR, -ZD - 0.06], [1.6, RAIL, ZD + 0.06], pal.ink, 0.07, railOn);
    const pitch = m ? 0.2 : 0.1;
    for (let i = 0; i * pitch <= 3.2001; i++) {
      const major = i % 5 === 0;
      f.line([-1.6 + i * pitch, RAIL, -ZD - 0.06], [-1.6 + i * pitch, RAIL - (major ? 0.06 : 0.035), -ZD - 0.06], pal.ink, (major ? 0.5 : 0.28) * railOn, 1);
    }

    // ── the stack: whole plates, and the one on top that is being added or taken away
    const stackOn = f.on(0.35, 0.35);
    const plates = Math.ceil(h / PLATE - 0.001);
    for (let i = 0; i < plates; i++) {
      const y0 = RAIL + i * PLATE;
      const y1 = Math.min(y0 + PLATE, RAIL + h) - GAP;
      if (y1 - y0 < 0.006) continue;
      slab(f, [EX, y0, -ZD], [EX + d, y1, ZD], pal.key, 0.13 + 0.04 * f.hover, stackOn);
    }
    f.fill([front(EX, RAIL), front(EX + d, RAIL), front(EX + d, RAIL + h), front(EX, RAIL + h)], pal.gold, 0.07 * stackOn);
    trace(f, [front(EX, RAIL + h), front(EX + d, RAIL + h)], pal.gold, 0.9 * stackOn, 1.5, f.still ? -1 : t / 7);

    // ── every shape with the same face: the curve the stack's corner rides
    const lit = f.on(0.6, 0.3);
    const n = m ? 22 : 36;
    for (let i = 0; i < n; i += 2) {
      const d0 = lerp(DMIN, DMAX, i / n);
      const d1 = lerp(DMIN, DMAX, (i + 1) / n);
      f.line(front(EX + d0, RAIL + AREA / d0), front(EX + d1, RAIL + AREA / d1), pal.gold, 0.6 * lit, 1);
    }
    lamp(f, front(EX + d, RAIL + h), pal.gold, lit, 0.015);

    // ── the two posts: the entry stays, the stop travels
    const postOn = f.on(0.2, 0.3);
    trace(f, [front(EX, RAIL), front(EX, RAIL + POST * postOn)], pal.gold, 0.8 * postOn, 1.3);
    trace(f, [front(EX + d, RAIL), front(EX + d, RAIL + POST * postOn)], pal.crimson, 0.85 * postOn, 1.3);
    lamp(f, front(EX, RAIL + POST), pal.gold, postOn, 0.012);
    lamp(f, front(EX + d, RAIL + POST), pal.crimson, postOn, 0.012);

    // ── how tall the stack stands: a bracket beside it
    const bx = EX - 0.13;
    f.line(front(bx, RAIL), front(bx, RAIL + h), pal.key, 0.7 * lit, 1);
    for (const y of [RAIL, RAIL + h]) f.line(front(bx - 0.035, y), front(bx + 0.035, y), pal.key, 0.8 * lit, 1);

    const named = f.on(0.85, 0.15);
    const size = m ? 9 : 10;
    ctx.save();
    ctx.letterSpacing = "1.5px";
    f.label("ENTRY", front(EX, RAIL + POST), { align: "center", size, colour: pal.gold, alpha: 0.95 * named, dy: -13 });
    f.label("STOP", front(EX + d, RAIL + POST), { align: "center", size, colour: pal.crimson, alpha: 0.95 * named, dy: -13 });
    f.label("SIZE", front(bx, RAIL + h / 2), { align: "right", size, colour: pal.key, alpha: 0.9 * named, dx: -9 });
    f.label("RISK", front(EX + d / 2, RAIL + h / 2), { align: "center", size, colour: pal.gold, alpha: 0.95 * named });
    ctx.restore();
  },
};

export default scene;

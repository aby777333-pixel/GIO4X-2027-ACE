/**
 * COSTS — one trade, and the three things cut from it.
 *
 * A single bar lies across the frame: the trade. Three slices have been cut
 * from its end and stand a little apart from it, so each can be seen for what
 * it is: the spread, the commission and the swap. The first two are cut once.
 * The swap is cut again for every night the trade is held, so that slice is
 * ruled into nights and thickens one night at a time, and the bar it is cut
 * from is shorter by as much. A bracket over the three is their sum, the cost.
 *
 * The slices have no amounts and their widths are not GIO4X's charges: the page
 * below adds up the real arithmetic from the visitor's own inputs.
 *
 * The pointer: the slices draw further apart under it, and moving it across the
 * frame sets the number of nights.
 */
import { clamp, lerp, type Scene, type V3 } from "../engine";
import { deck, eyeX, pool, slab, trace } from "../kit";

const FLOOR = -0.95;
/** the bar: its whole length, its foot, its height, half its depth */
const [LEN, Y0, H, ZD] = [2.7, -0.28, 0.5, 0.24];
/** the width of the spread's slice, of the commission's, of one night of swap, and the most nights */
const [SPREAD, FEE, NIGHT, NIGHTS] = [0.3, 0.2, 0.085, 5];
/** seconds a night lasts */
const TICK = 3.4;

type State = { n: number; open: number; phase: number };

const scene: Scene<State> = {
  pose: 11,
  setup(f) {
    return { n: 2, open: 0.6, phase: Math.floor(f.rnd(2) * NIGHTS) };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const m = f.mobile;
    const t = f.t;
    f.aim(0.18 + (f.still ? 0 : Math.sin(t * 0.08 + s.phase) * 0.035), -0.2, 6.3, 1.06);

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [0, FLOOR, 0], 2.7, pal.key, 0.22 * f.boot);

    // ── the nights: one more every few seconds, then back to the first; under the pointer they are set by hand
    const auto = f.still ? 3 : 1 + (Math.floor(t / TICK + s.phase) % NIGHTS);
    const held = 1 + Math.round(clamp((f.mx - f.box.x) / f.box.w) * (NIGHTS - 1));
    const want = f.hover > 0.5 ? held : auto;
    s.n = f.still ? want : s.n + (want - s.n) * (1 - Math.exp(-f.dt * 2.6));
    const swap = s.n * NIGHT;
    // ── how far apart the slices stand: they breathe a little, and open fully under the pointer
    const apart = lerp(f.still ? 0.7 : 0.5 + 0.2 * Math.sin(t * 0.3), 1, f.hover);
    s.open = f.still ? apart : s.open + (apart - s.open) * (1 - Math.exp(-f.dt * 4));
    const gap = lerp(0.03, 0.15, s.open);

    const second = pal.key === pal.teal ? pal.blue : pal.teal;
    const body = LEN - SPREAD - FEE - swap;
    const parts = [
      { name: "", w: body, colour: pal.key, tint: 0.1, order: 0.1 },
      { name: "SPREAD", w: SPREAD, colour: pal.gold, tint: 0.24, order: 0.4 },
      { name: "COMMISSION", w: FEE, colour: second, tint: 0.24, order: 0.52 },
      { name: "SWAP", w: swap, colour: pal.indigo, tint: 0.24, order: 0.64 },
    ];
    // where each piece starts: the whole row is kept in the middle of the frame
    let x = -(LEN + 3 * gap) / 2;
    const at = parts.map((p) => {
      const x0 = x;
      x += p.w + gap;
      return x0;
    });

    // ── the plinth the bar lies over
    const base = f.on(0, 0.35);
    slab(f, [-LEN / 2 - 0.3, FLOOR, -ZD - 0.06], [LEN / 2 + 0.3, FLOOR + 0.07, ZD + 0.06], pal.ink, 0.07, base);
    for (const px of [-LEN / 2, LEN / 2]) f.line([px, FLOOR + 0.07, 0], [px, Y0, 0], pal.ink, 0.25 * base, 1);

    // ── the pieces, from the one farthest from the camera to the nearest
    const eye = eyeX(f);
    const order = parts.map((_, i) => i).sort((p, q) => Math.abs(at[q] + parts[q].w / 2 - eye) - Math.abs(at[p] + parts[p].w / 2 - eye));
    for (const i of order) {
      const p = parts[i];
      const on = f.on(p.order, 0.3);
      // a slice arrives from above its place
      const lift = (1 - on) * 0.2;
      slab(f, [at[i], Y0 + lift, -ZD], [at[i] + p.w, Y0 + H + lift, ZD], p.colour, p.tint + (i ? 0.06 * f.hover : 0), on);
    }
    // the swap's slice is ruled into its nights
    const cut = f.on(0.7, 0.3);
    for (let i = 1; i < Math.ceil(s.n - 0.02); i++) {
      const nx = at[3] + i * NIGHT;
      f.path([[nx, Y0, -ZD], [nx, Y0 + H, -ZD], [nx, Y0 + H, ZD]], pal.ink, 0.5 * cut, 1);
    }

    // ── the three named, each on its own leader, and the bracket over them: their sum
    const named = f.on(0.85, 0.15);
    const size = m ? 8 : 10;
    const front = (px: number, py: number): V3 => [px, py, -ZD];
    ctx.save();
    ctx.letterSpacing = "1.5px";
    parts.forEach((p, i) => {
      if (!i) return;
      const mid = at[i] + p.w / 2;
      const drop = Y0 - (i === 2 ? 0.36 : 0.18);
      f.line(front(mid, Y0 - 0.03), front(mid, drop), p.colour, 0.6 * named, 1);
      f.label(p.name, front(mid, drop), { align: "center", size, colour: p.colour, alpha: 0.95 * named, dy: 10 });
    });
    const [b0, b1, by] = [at[1], at[3] + swap, Y0 + H + 0.17];
    trace(f, [front(b0, by), front(b1, by)], pal.gold, 0.9 * named, 1.4, f.still ? -1 : t / 6);
    for (const bx of [b0, b1]) f.line(front(bx, by - 0.06), front(bx, by), pal.gold, 0.9 * named, 1.4);
    f.label("COST", front((b0 + b1) / 2, by), { align: "center", size, colour: pal.gold, alpha: 0.95 * named, dy: -13 });
    f.label("THE TRADE", front(at[0] + body / 2, Y0 + H / 2), { align: "center", size, colour: pal.ink, alpha: 0.8 * named });
    ctx.restore();
  },
};

export default scene;

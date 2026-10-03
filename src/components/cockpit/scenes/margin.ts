/**
 * MARGIN — the part of a balance a position ties up.
 *
 * A tray of tiles lies on the deck, seen from above: the whole tray is the
 * balance. Opening a position locks some of it. The locked tiles rise out of
 * the tray and turn champagne, column by column from the left, and a wall of
 * glass stands where the locked part ends. What lies beyond the wall is free.
 * As the position grows the wall advances and the free part shrinks; as it is
 * reduced the tiles sink back and are free again.
 *
 * The tray has no scale and the tiles no value: this is the idea of required
 * margin, not a requirement GIO4X sets.
 *
 * The pointer: the wall follows it across the tray.
 */
import { clamp, lerp, type Scene, type V3 } from "../engine";
import { deck, eyeX, pool, slab, trace } from "../kit";

/** the tray's floor, and the deck under it */
const BASE = -0.3;
const FLOOR = BASE - 0.07;
/** the tray: tiles across and deep, its width and depth */
const [COLS, ROWS, TW, TD] = [10, 5, 3.0, 1.5];
/** a tile's height when it is free and when it is locked, and the clearance round it */
const [LOW, HIGH, PAD] = [0.04, 0.32, 0.03];
/** the locked share of the tray at its least and its most */
const [KMIN, KMAX] = [0.14, 0.72];

type State = { k: number; phase: number };

const smooth = (v: number) => {
  const c = clamp(v);
  return c * c * (3 - 2 * c);
};

const scene: Scene<State> = {
  pose: 11,
  setup(f) {
    return { k: 0.4, phase: f.rnd(2) * 6 };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const m = f.mobile;
    const t = f.t;
    // from well above, so the tray shows its whole floor
    f.aim(0.2 + (f.still ? 0 : Math.sin(t * 0.08 + s.phase) * 0.04), -0.46, 6.4, 1.05);

    deck(f, { y: FLOOR, alpha: 0.1 });
    pool(f, [0, FLOOR, 0], 2.8, pal.key, 0.2 * f.boot);

    // ── the locked share: it grows and shrinks slowly on its own; under the pointer it is set by hand
    const auto = lerp(KMIN, KMAX, f.still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.26 + s.phase));
    const o = f.P(-TW / 2, BASE, -TD / 2);
    const x = f.P(TW / 2, BASE, -TD / 2);
    const held = clamp(o && x && Math.abs(x.x - o.x) > 1 ? (f.mx - o.x) / (x.x - o.x) : 0.4, KMIN, KMAX);
    const want = lerp(auto, held, f.hover);
    s.k = f.still ? want : s.k + (want - s.k) * (1 - Math.exp(-f.dt * 3));
    const k = s.k;

    // ── the tray
    const trayOn = f.on(0, 0.35);
    slab(f, [-TW / 2 - 0.07, FLOOR, -TD / 2 - 0.07], [TW / 2 + 0.07, BASE, TD / 2 + 0.07], pal.ink, 0.06, trayOn);

    // ── the tiles, from the far row to the near one. A tile is locked once the wall has passed its column
    const cw = TW / COLS;
    const cd = TD / ROWS;
    const eye = eyeX(f);
    const cols = Array.from({ length: COLS }, (_, c) => c).sort((p, q) => Math.abs(-TW / 2 + (q + 0.5) * cw - eye) - Math.abs(-TW / 2 + (p + 0.5) * cw - eye));
    for (let r = ROWS - 1; r >= 0; r--) {
      for (const c of cols) {
        const on = f.on(0.15 + 0.5 * (c / COLS), 0.3);
        // within a column the near tiles lock first, so the wall's foot is never ahead of the tiles behind it
        const level = smooth(k * COLS * ROWS - (c * ROWS + r));
        const x0 = -TW / 2 + c * cw + PAD;
        const z0 = -TD / 2 + r * cd + PAD;
        const colour = level > 0.5 ? pal.gold : pal.key;
        slab(f, [x0, BASE, z0], [x0 + cw - 2 * PAD, BASE + lerp(LOW, HIGH, level) * on, z0 + cd - 2 * PAD], colour, lerp(0.07, 0.2, level) + 0.03 * f.hover, on);
      }
    }

    // ── the wall: a sheet of glass where the locked part ends
    const lit = f.on(0.7, 0.3);
    const wx = -TW / 2 + k * TW;
    const top = BASE + HIGH + 0.14;
    const wall: V3[] = [[wx, BASE, -TD / 2], [wx, BASE, TD / 2], [wx, top, TD / 2], [wx, top, -TD / 2]];
    f.fill(wall, pal.gold, (0.07 + 0.05 * f.hover) * lit);
    f.path(wall, pal.gold, 0.45 * lit, 1, true);
    trace(f, [wall[3], wall[2]], pal.gold, 0.9 * lit, 1.4, f.still ? -1 : t / 6);

    // ── the whole tray, measured along its near edge
    const z = -TD / 2 - 0.2;
    f.line([-TW / 2, BASE, z], [TW / 2, BASE, z], pal.ink, 0.4 * lit, 1);
    for (const ex of [-TW / 2, wx, TW / 2]) f.line([ex, BASE, z - 0.05], [ex, BASE, z + 0.05], ex === wx ? pal.gold : pal.ink, 0.7 * lit, 1);
    trace(f, [[-TW / 2, BASE, z], [wx, BASE, z]], pal.gold, 0.85 * lit, 1.4);

    const named = f.on(0.85, 0.15);
    const size = m ? 9 : 10;
    ctx.save();
    ctx.letterSpacing = "1.5px";
    f.label("MARGIN", [(-TW / 2 + wx) / 2, top, TD / 2], { align: "center", size, colour: pal.gold, alpha: 0.95 * named, dy: -14 });
    f.label("FREE", [(wx + TW / 2) / 2, BASE + LOW, TD / 2], { align: "center", size, colour: pal.key, alpha: 0.9 * named, dy: -16 });
    f.label("BALANCE", [0, BASE, z], { align: "center", size, colour: pal.ink2, alpha: 0.85 * named, dy: 14 });
    ctx.restore();
  },
};

export default scene;

/**
 * ACCORD — the terms, as an agreement on a signing desk.
 *
 * Seen from above, as one stands over a desk: a bound document lying at an
 * angle on a desk pad, tied through its spine with a champagne ribbon, and
 * beside it a stand with two pens, one for each party. The page carries eight
 * clauses, as the Terms of Service do, and each clause has a blank index tab
 * on the edge of the document. Below them are two rules to sign on: YOU and
 * GIO4X. Nothing is written: a clause is drawn as rules, a tab as a blank band.
 *
 * The pointer reads the agreement. The tab under the cursor slides out of the
 * edge and the lines of its clause light on the page; its neighbours stir. And
 * both pens incline toward the cursor, as if offered.
 */
import { clamp, easeInOut, lerp, type Frame, type Scene, type V3 } from "../engine";
import { deck, pool, ring } from "../kit";

/** the desk surface, and the document: thickness, width, length, where it lies and how far it is turned */
const FY = -0.3;
const T = 0.075;
const W = 1.36;
const L = 2.1;
const DX = -0.5;
const DZ = 0.04;
const RHO = 0.3;
const CR = Math.cos(RHO);
const SR = Math.sin(RHO);
/** the clauses of the Terms of Service: eight, each with a tab */
const CLAUSES = 8;
const B0 = 0.7;
const STEP = 0.183;
/** left margin of the text, and its right edge */
const A0 = -W / 2 + 0.3;
const A1 = W / 2 - 0.14;
/** the pen stand: centre, half width, half depth, height; and a pen's length */
const SX = 1.3;
const SZ = 0.5;
const SHX = 0.33;
const SHZ = 0.15;
const SH = 0.11;
const PEN = 0.94;
/** the desk pad's half width and half depth */
const PX = 1.66;
const PZ = 1.06;

type State = { ends: number[]; out: number[]; raw: number[]; tails: V3[][]; loops: V3[][] };

/** document-local to world: a across the page, b up the page, y the height */
const doc = (a: number, b: number, y = FY + T): V3 => [DX + a * CR + b * SR, y, DZ - a * SR + b * CR];
const unit = (v: V3): V3 => {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
};

/** a thin slab seen from above: its flanks, then its top */
function slab(f: Frame, top: readonly V3[], y0: number, tone: number, level: number): void {
  if (level <= 0.003) return;
  const { pal } = f;
  for (let i = 0; i < top.length; i++) {
    const a = top[i];
    const b = top[(i + 1) % top.length];
    const flank: V3[] = [[a[0], y0, a[2]], [b[0], y0, b[2]], b, a];
    f.fill(flank, pal.bg, 0.95 * level);
    f.fill(flank, pal.ink, tone * 0.55 * level);
    f.path(flank, pal.ink, 0.3 * level, 1, true);
  }
  f.fill(top, pal.bg, 0.95 * level);
  f.fill(top, pal.ink, tone * level);
  f.path(top, pal.ink, 0.42 * level, 1, true);
}

/** lettering that lies on the page: it runs along the page's own lines */
function engrave(f: Frame, text: string, at: V3, toward: V3, size: number, colour: string, alpha: number): void {
  const p = f.P(at[0], at[1], at[2]);
  const q = f.P(toward[0], toward[1], toward[2]);
  if (!p || !q) return;
  const { ctx } = f;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(q.y - p.y, q.x - p.x));
  ctx.translate(-p.x, -p.y);
  f.label(text, at, { size, colour, alpha });
  ctx.restore();
}

/** a flat ribbon lying along a path: the path is widened to both sides in the plane it lies in; a tail ends in a swallowtail */
function ribbon(f: Frame, pts: readonly V3[], half: number, level: number, tail = false): void {
  if (level <= 0.003) return;
  const { pal } = f;
  const n = pts.length;
  const left: V3[] = [];
  const right: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const m = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
    const nx = (-(b[2] - a[2]) / m) * half;
    const nz = ((b[0] - a[0]) / m) * half;
    left.push([pts[i][0] + nx, pts[i][1], pts[i][2] + nz]);
    right.push([pts[i][0] - nx, pts[i][1], pts[i][2] - nz]);
  }
  const band: V3[] = tail ? [...left, pts[Math.max(0, n - 3)], ...right.reverse()] : [...left, ...right.reverse()];
  f.fill(band, pal.bg, 0.85 * level);
  f.fill(band, pal.gold, 0.62 * level);
  f.path(band, pal.gold, 0.95 * level, 1, true);
  f.path(pts.slice(0, tail ? n - 3 : n), pal.ink, 0.28 * level, 1);
}

/** a pen standing in its socket: lacquered barrel, champagne band, cap and finial */
function pen(f: Frame, base: V3, d: V3, level: number): void {
  if (level <= 0.003) return;
  const { pal, ctx } = f;
  const at = (k: number): V3 => [base[0] + d[0] * PEN * k, base[1] + d[1] * PEN * k, base[2] + d[2] * PEN * k];
  const w = Math.max(3, 0.06 * f.u);
  ctx.lineCap = "butt";
  f.line(at(0), at(0.55), pal.bg, level, w);
  f.line(at(0), at(0.55), pal.ink, 0.2 * level, w);
  f.line(at(0.55), at(0.6), pal.gold, 0.95 * level, w * 1.1);
  f.line(at(0.6), at(0.97), pal.bg, level, w * 1.12);
  f.line(at(0.6), at(0.97), pal.ink, 0.3 * level, w * 1.12);
  f.line(at(0.66), at(0.9), pal.gold, 0.8 * level, 1.25);
  ctx.lineCap = "round";
  f.line(at(0.03), at(0.53), pal.ink, 0.4 * level, 1);
  f.dot(at(0.985), 0.028, pal.gold, 0.95 * level);
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    // how far the short last line of each clause runs
    const ends: number[] = [];
    for (let i = 0; i < CLAUSES; i++) ends.push(0.3 + f.rnd(10 + i) * 0.5);
    // the ribbon: tied in a bow on the spine, its two tails falling over the edge onto the desk
    const knot: [number, number] = [-W / 2 + 0.1, 0.04];
    const steps = f.mobile ? 8 : 14;
    const tails: V3[][] = [[-0.42, -0.46, -0.1], [-0.36, 0.38, 0.12]].map(([da, db, bend]) => {
      const pts: V3[] = [doc(knot[0], knot[1], FY + T + 0.012), doc(-W / 2 - 0.015, knot[1] + db * 0.12, FY + T), doc(-W / 2 - 0.05, knot[1] + db * 0.2, FY + 0.004)];
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        pts.push(doc(-W / 2 - 0.05 + (da + 0.05) * k + Math.sin(Math.PI * k) * bend, knot[1] + db * (0.2 + 0.8 * k * k), FY + 0.004));
      }
      return pts;
    });
    // the bow's two loops lie on the page, opening away from the spine like wings
    const loops: V3[][] = [-1, 1].map((side) => {
      const pts: V3[] = [];
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const along = (1 - Math.cos(a)) * 0.085;
        const across = Math.sin(a) * Math.sin(a / 2) * 0.05;
        pts.push(doc(knot[0] + along * 0.62 - side * across * 0.78, knot[1] + side * along * 0.78 + across * 0.62, FY + T + 0.012));
      }
      return pts;
    });
    return { ends, out: new Array<number>(CLAUSES).fill(0), raw: new Array<number>(CLAUSES).fill(0), tails, loops };
  },
  draw(f, s) {
    const { pal } = f;
    const sway = f.still ? 0 : Math.sin(f.t * 0.08) * 0.035;
    // a desk should lie still: the pointer may only lean the view a little
    f.cam.parallax = 0.45;
    f.aim(0.08 + sway + (f.rnd(1) - 0.5) * 0.05, -0.68, 6.4, 1.04);
    const top = FY + T;

    const laid = f.on(0.1, 0.35);
    const written = f.on(0.5, 0.4);
    const tied = f.on(0.75, 0.3);

    // ── the desk: a pad with a champagne edge under one pool of light
    deck(f, { y: FY, half: 3.6, alpha: 0.08, drift: 0 });
    pool(f, [DX + 0.3, FY, 0], 2.6, pal.key, 0.2 * f.boot);
    const pad: V3[] = [[-PX, FY, -PZ], [PX, FY, -PZ], [PX, FY, PZ], [-PX, FY, PZ]];
    f.fill(pad, pal.ink, 0.04 * f.boot);
    f.path(pad, pal.gold, 0.36 * f.boot, 1, true);
    f.path([[-PX + 0.07, FY, -PZ + 0.07], [PX - 0.07, FY, -PZ + 0.07], [PX - 0.07, FY, PZ - 0.07], [-PX + 0.07, FY, PZ - 0.07]], pal.ink, 0.1 * f.boot, 1, true);

    // ── which clause the pointer is on: the nearest answers fully, its neighbours a little
    let most = 0;
    for (let i = 0; i < CLAUSES; i++) {
      const b = B0 - i * STEP;
      let k = 0;
      if (f.hover > 0) {
        k = f.near(doc(W / 2 + 0.08, b), f.u * 0.36);
        for (let j = 0; j <= 4; j++) k = Math.max(k, f.near(doc(lerp(A0, A1, j / 4), b), f.u * 0.36));
      }
      s.raw[i] = k;
      most = Math.max(most, k);
    }
    for (let i = 0; i < CLAUSES; i++) {
      const want = most > 0.001 ? clamp(Math.pow(s.raw[i] / most, 6) * most * 1.4) : 0;
      s.out[i] = f.still ? 0 : s.out[i] + (want - s.out[i]) * (1 - Math.exp(-f.dt * 9));
    }

    // ── the document: its shadow, the index tabs under the cover, then the bound block
    f.fill([doc(-W / 2 - 0.03, -L / 2 - 0.07, FY + 0.002), doc(W / 2 + 0.05, -L / 2 - 0.07, FY + 0.002), doc(W / 2 + 0.05, L / 2 - 0.02, FY + 0.002), doc(-W / 2 - 0.03, L / 2 - 0.02, FY + 0.002)], pal.bg, 0.6 * laid);
    for (let i = 0; i < CLAUSES; i++) {
      const b = B0 - i * STEP;
      const k = easeInOut(s.out[i]);
      const shown = f.on(0.3 + i * 0.05, 0.25);
      const y = top - 0.006 - i * 0.004;
      const a1 = W / 2 + (0.085 + 0.13 * k) * shown;
      const h = STEP * 0.4;
      const tab: V3[] = [doc(W / 2 - 0.04, b + h, y), doc(a1 - 0.03, b + h, y), doc(a1, b + h - 0.03, y), doc(a1, b - h + 0.03, y), doc(a1 - 0.03, b - h, y), doc(W / 2 - 0.04, b - h, y)];
      f.fill(tab, pal.bg, 0.95 * shown);
      f.fill(tab, pal.ink, 0.16 * shown);
      f.fill(tab, pal.gold, 0.5 * k * shown);
      f.path(tab, pal.ink, 0.5 * shown, 1, true);
      f.path(tab, pal.gold, 0.95 * k * shown, 1.25, true);
      if (k > 0.02) f.glow(doc(a1 - 0.05, b, y), 0.24, pal.gold, 0.3 * k);
    }
    const sheet: V3[] = [doc(-W / 2, -L / 2), doc(W / 2, -L / 2), doc(W / 2, L / 2), doc(-W / 2, L / 2)];
    slab(f, sheet, FY, 0.13, laid);
    // the leaves show at the near edges
    for (const y of [FY + T * 0.34, FY + T * 0.67]) f.path([doc(-W / 2, -L / 2, y), doc(W / 2, -L / 2, y), doc(W / 2, L / 2, y)], pal.ink, 0.16 * laid, 1);
    f.line(sheet[0], sheet[1], pal.key, 0.6 * laid, 1.25);
    f.line(doc(A0 - 0.07, L / 2 - 0.08), doc(A0 - 0.07, -L / 2 + 0.08), pal.key, 0.22 * laid, 1);

    // ── what the page carries: a title rule, eight clauses, two rules to sign on
    f.line(doc(A0, 0.865), doc(lerp(A0, A1, 0.62 * written), 0.865), pal.ink, 0.8 * written, 2);
    engrave(f, "T E R M S", doc(A0, 0.94), doc(A1, 0.94), f.mobile ? 8 : 10, pal.gold, 0.95 * written);
    for (let i = 0; i < CLAUSES; i++) {
      const b = B0 - i * STEP;
      const k = easeInOut(s.out[i]);
      const on = f.on(0.5 + i * 0.045, 0.3);
      if (on <= 0) continue;
      if (k > 0.01) f.fill([doc(A0 - 0.04, b - STEP * 0.46), doc(W / 2, b - STEP * 0.46), doc(W / 2, b + STEP * 0.46), doc(A0 - 0.04, b + STEP * 0.46)], pal.gold, 0.13 * k);
      const from = A0 + 0.19;
      const rows: [number, number][] = [[b + 0.038, lerp(from, A1, on)], [b - 0.038, lerp(from, lerp(from, A1, s.ends[i]), on)]];
      for (const [v, to] of rows) {
        f.line(doc(from, v), doc(to, v), pal.ink, (0.4 + 0.3 * k) * on, f.mobile ? 1 : 1.25);
        f.line(doc(from, v), doc(to, v), pal.gold, 0.9 * k * on, 1.5);
      }
      f.line(doc(A0, b + 0.038), doc(A0 + 0.11, b + 0.038), k > 0.5 ? pal.gold : pal.key, (0.75 + 0.25 * k) * on, 2);
    }
    const signed = f.on(0.9, 0.3);
    const sb = -L / 2 + 0.2;
    const sides: [string, number, number][] = [["YOU", A0, -0.07], ["GIO4X", 0.07, A1]];
    for (const [name, from, to] of sides) {
      f.line(doc(from, sb), doc(lerp(from, to, signed), sb), pal.ink, 0.7 * signed, 1);
      engrave(f, name, doc(from, sb - 0.085), doc(to, sb - 0.085), f.mobile ? 7 : 8.5, pal.ink2, 0.85 * signed);
    }

    // ── the ribbon binding: through two eyelets in the spine, tied, the tails lying on the desk
    const spine = -W / 2 + 0.1;
    for (const tail of s.tails) ribbon(f, tail, 0.024, tied, true);
    for (const b of [-0.62, 0.7]) {
      ribbon(f, [doc(spine, b, top + 0.004), doc(-W / 2, b, top + 0.004), doc(-W / 2 - 0.001, b, FY)], 0.024, tied);
      f.dot(doc(spine, b, top + 0.004), 0.034, pal.bg, 0.9 * tied);
      ring(f, doc(spine, b, top + 0.004), 0.034, { colour: pal.gold, alpha: 0.9 * tied, seg: 16 });
    }
    ribbon(f, [doc(spine, -0.62, top + 0.004), doc(spine, 0.7, top + 0.004)], 0.024, tied);
    for (const loop of s.loops) {
      f.fill(loop, pal.bg, 0.8 * tied);
      f.fill(loop, pal.gold, 0.4 * tied);
      f.path(loop, pal.gold, 0.95 * tied, 1.5, true);
    }
    f.dot(doc(spine, 0.04, top + 0.014), 0.03, pal.gold, tied);
    f.dot(doc(spine, 0.04, top + 0.014), 0.012, pal.ink, 0.5 * tied);

    // ── the pen stand, and two pens that incline toward the pointer
    const stood = f.on(0.6, 0.35);
    const sy = FY + SH;
    slab(f, [[SX - SHX, sy, SZ - SHZ], [SX + SHX, sy, SZ - SHZ], [SX + SHX, sy, SZ + SHZ], [SX - SHX, sy, SZ + SHZ]], FY, 0.16, stood);
    f.line([SX - SHX, sy, SZ - SHZ], [SX + SHX, sy, SZ - SHZ], pal.key, 0.65 * stood, 1.25);
    const cy = Math.cos(f.cam.yaw);
    const sn = Math.sin(f.cam.yaw);
    [-1, 1].forEach((side, i) => {
      const base: V3 = [SX + side * 0.16, sy, SZ];
      ring(f, base, 0.05, { colour: pal.ink, alpha: 0.6 * stood, seg: 18 });
      f.dot(base, 0.04, pal.bg, 0.9 * stood);
      const rest = unit([side * 0.2 - 0.04, 1, 0.42 + i * 0.1]);
      let d = rest;
      const p = f.P(base[0], base[1], base[2]);
      if (p && f.hover > 0) {
        // the pointer's direction on the screen, laid back onto the desk: right is across, up is away
        const dx = f.mx - p.x;
        const dy = f.my - p.y;
        const m = Math.max(Math.hypot(dx, dy), f.u * 0.8);
        const nx = dx / m;
        const ny = -dy / m;
        const aim = unit([(nx * cy - ny * sn) * 0.95, 1, (nx * sn + ny * cy) * 0.95]);
        const k = f.hover * 0.92;
        d = unit([lerp(rest[0], aim[0], k), lerp(rest[1], aim[1], k), lerp(rest[2], aim[2], k)]);
      }
      // each pen is set down into its socket at power-on
      pen(f, [base[0], base[1] + (1 - stood) * 0.3, base[2]], d, stood);
    });
  },
};

export default scene;

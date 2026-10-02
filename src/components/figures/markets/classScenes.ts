import { TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "../Figure";
import { GOLDEN_ANGLE, P, PHI, ball, camera, caps, corners, discPath, glow, hash, lamp, pr, ring, seg } from "./kit";

/**
 * The six drawings behind ClassFigure, one for each asset class: what the
 * market's own text says a unit of it is. A pair, an ounce, a basket, a
 * barrel, a share and its mirror, a public record. None of them carries a
 * quantity: no price, no level, no rate.
 */

/* ---- forex: the pair -------------------------------------------------- */

/**
 * Two glass balls turn about a common centre, joined by a bar: a quote is one
 * currency priced in units of the other. Light runs along the bar from the
 * base to the quote. The pointer tilts the orbit and lights the bar.
 */
export const drawPair: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal }) => {
  if (w < 150 || h < 70) return;
  const on = smooth(hover);
  const s = Math.min(w * 0.17, h * 0.42);
  const c = camera(w / 2, h * 0.53, s, (mx / w - 0.5) * 0.5 * on, 0.24 + (my / h - 0.5) * 0.16 * on, 18);
  const R = 2.2;
  const r = 0.4;
  const th = t * 0.3;
  ctx.lineCap = "round";
  corners(ctx, w, h, pal.gold, 0.4);

  // the orbit, and inside it at the golden section its echo
  ring(ctx, c, 0, 0, 0, 1, 0, 0, 0, 0, 1, R, pal.ink3, 0.6, 0.26, 1, 72);
  ring(ctx, c, 0, 0, 0, 1, 0, 0, 0, 0, 1, R / PHI, pal.ink3, 0.26, 0.12, 1, 60);
  pr(c, 0, 0, 0);
  const ox = P.x;
  const oy = P.y;
  glow(ctx, ox, oy, s * 1.1, pal.accent, 0.1 + on * 0.06);

  const ax = Math.cos(th) * R;
  const az = Math.sin(th) * R;
  pr(c, ax, 0, az);
  const sax = P.x;
  const say = P.y;
  const za = P.z;
  const ra = r * P.k * s;
  pr(c, -ax, 0, -az);
  const sbx = P.x;
  const sby = P.y;
  const rb = r * P.k * s;
  const aFar = za > P.z;

  const body = (isA: boolean) => {
    const sign = isA ? 1 : -1;
    ball(ctx, c, ax * sign, 0, az * sign, r, t * 0.5 * sign, isA ? pal.accent : pal.teal, pal.surface, 0.85 + on * 0.15);
    caps(ctx, isA ? "base" : "quote", isA ? sax : sbx, (isA ? say - ra : sby - rb) - 10, pal.font, rgba(pal.ink2, 0.9), 9);
  };

  body(aFar);

  // the bar between them, from surface to surface
  const dx = sbx - sax;
  const dy = sby - say;
  const len = Math.hypot(dx, dy) || 1;
  const x1 = sax + (dx / len) * ra;
  const y1 = say + (dy / len) * ra;
  const x2 = sbx - (dx / len) * rb;
  const y2 = sby - (dy / len) * rb;
  if (len > ra + rb + 4) {
    ctx.lineWidth = 1 + on * 0.5;
    ctx.strokeStyle = rgba(pal.gold, 0.5 + on * 0.45);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    // the base, priced in the quote: light runs one way along the bar
    for (let j = 0; j < 3; j++) {
      const p = (t * 0.2 + j / 3) % 1;
      lamp(ctx, lerp(x1, x2, p), lerp(y1, y2, p), 1.3 + on * 0.5, pal.gold, Math.sin(p * Math.PI) * (0.6 + on * 0.4));
    }
  }
  // the stroke of the quote itself, at the centre: base / quote
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(pal.gold, 0.9);
  ctx.beginPath();
  ctx.moveTo(ox - 3.5, oy + 8);
  ctx.lineTo(ox + 3.5, oy - 8);
  ctx.stroke();

  body(!aFar);
};

/* ---- metals: the rounds ------------------------------------------------ */

/**
 * One round for each metal the site lists, standing on edge on a pane of glass
 * and turning slowly, each catching the light as its face comes round: they
 * are priced by the troy ounce. The pointer turns the nearest one to face the
 * viewer and lights it.
 */
export function makeRounds(symbols: string[]): FigureDraw {
  const n = Math.max(1, symbols.length);
  return ({ ctx, w, h, t, hover, mx, pal }) => {
    if (w < 150 || h < 70) return;
    const on = smooth(hover);
    const gap = 1.34;
    const s = Math.min(w / (n * gap + 0.5), h * 0.5);
    const c = camera(w / 2, h * 0.43, s, 0, 0.1, 12);
    const r = 0.58;
    const half = 0.055;
    const fy = -0.68;
    ctx.lineCap = "round";
    corners(ctx, w, h, pal.gold, 0.4);

    // the glass they stand on: one hairline, fading at both ends
    pr(c, -(n * gap) / 2, fy, 0);
    const fx0 = P.x;
    const fy0 = P.y;
    pr(c, (n * gap) / 2, fy, 0);
    const line = ctx.createLinearGradient(fx0, 0, P.x, 0);
    line.addColorStop(0, rgba(pal.ink3, 0));
    line.addColorStop(0.2, rgba(pal.ink3, 0.55));
    line.addColorStop(0.8, rgba(pal.ink3, 0.55));
    line.addColorStop(1, rgba(pal.ink3, 0));
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(fx0, fy0);
    ctx.lineTo(P.x, P.y);
    ctx.stroke();

    let pick = -1;
    if (hover > 0.02) {
      let best = Infinity;
      for (let i = 0; i < n; i++) {
        const d = Math.abs(pr(c, (i - (n - 1) / 2) * gap, 0, 0).x - mx);
        if (d < best) {
          best = d;
          pick = i;
        }
      }
    }
    // a lamp passing along the row
    const xs = -(n * gap) / 2 - 1.2 + ((t * 0.55) % (n * gap + 2.4));

    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * gap;
      const sel = i === pick ? on : 0;
      let phi = t * 0.42 + i * 1.15;
      if (sel > 0) phi = lerp(phi, Math.round(phi / Math.PI) * Math.PI, sel);
      const cph = Math.cos(phi);
      const nx = Math.sin(phi);
      const nz = -cph;
      const ux = cph;
      const uz = Math.sin(phi);
      const glint = Math.abs(cph) ** 6;
      const sheen = Math.exp(-(((xs - x) / 0.8) ** 2));
      const level = clamp(0.6 + glint * 0.3 + sheen * 0.3 + sel * 0.3);
      const sg = cph >= 0 ? 1 : -1;

      // its light on the glass
      pr(c, x, fy, 0);
      ctx.save();
      ctx.translate(P.x, P.y);
      ctx.scale(1, 0.2);
      glow(ctx, 0, 0, r * s * 1.5, pal.gold, 0.3 * level);
      ctx.restore();

      // the far face, the milled edge, then the near face
      ring(ctx, c, x - nx * half * sg, 0, -nz * half * sg, ux, 0, uz, 0, 1, 0, r, pal.gold, 0.4 * level, 0.4 * level, 1, 44);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(pal.gold, 0.32 * level);
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * TAU;
        const px = ux * Math.cos(a) * r;
        const py = Math.sin(a) * r;
        const pz = uz * Math.cos(a) * r;
        seg(ctx, c, x + px - nx * half, py, pz - nz * half, x + px + nx * half, py, pz + nz * half);
      }
      const fxc = x + nx * half * sg;
      const fzc = nz * half * sg;
      discPath(ctx, c, fxc, 0, fzc, ux, 0, uz, 0, 1, 0, r, 44);
      ctx.fillStyle = rgba(pal.surface, 0.94);
      ctx.fill();
      pr(c, fxc, 0, fzc);
      const R = r * P.k * s;
      const g = ctx.createLinearGradient(P.x - R, P.y - R, P.x + R, P.y + R);
      g.addColorStop(0, rgba(pal.gold, 0.1 + glint * 0.36 + sheen * 0.2 + sel * 0.1));
      g.addColorStop(0.55, rgba(pal.gold, 0.05 + glint * 0.08));
      g.addColorStop(1, rgba(pal.gold, 0.03));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = rgba(pal.gold, 0.95 * level);
      ctx.stroke();
      ring(ctx, c, fxc, 0, fzc, ux, 0, uz, 0, 1, 0, r * 0.8, pal.gold, 0.45 * level, 0.45 * level, 1, 40);
      ring(ctx, c, fxc, 0, fzc, ux, 0, uz, 0, 1, 0, r * 0.17, pal.gold, 0.7 * level, 0.7 * level, 1, 16);

      pr(c, x, fy - 0.3, 0);
      caps(ctx, symbols[i] ?? "", P.x, P.y, pal.font, sel > 0.02 ? rgba(pal.gold, 0.6 + sel * 0.4) : rgba(pal.ink3, 0.95), 9);
    }
  };
}

/* ---- indices: the basket ----------------------------------------------- */

const BN = 170;
const BASKET = (() => {
  const out = new Float32Array(BN * 3);
  for (let i = 0; i < BN; i++) {
    const y = 1 - (2 * (i + 0.5)) / BN;
    const rr = Math.sqrt(1 - y * y);
    const a = i * GOLDEN_ANGLE;
    out[i * 3] = Math.cos(a) * rr;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = Math.sin(a) * rr;
  }
  return out;
})();
const STREAMS = 34;

/**
 * Many points, one body: shares drift in from the left and take their places
 * on a slowly turning sphere of points (set out by the golden angle), which a
 * single outline holds as one instrument. The pointer turns the sphere and
 * opens it where it rests, so the parts can be seen.
 */
export const drawBasket: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal }) => {
  if (w < 150 || h < 70) return;
  const on = smooth(hover);
  const s = Math.min(h * 0.35, w * 0.17);
  const c = camera(w * 0.618, h * 0.46, s, 0, 0.18, 6);
  const spin = t * 0.16 + (mx / w - 0.5) * 1.4 * on;
  const cs = Math.cos(spin);
  const sn = Math.sin(spin);
  corners(ctx, w, h, pal.gold, 0.4);

  pr(c, 0, 0, 0);
  const cx = P.x;
  const cy = P.y;
  const R = s * P.k;
  glow(ctx, cx, cy, R * 1.28, pal.teal, 0.2);

  // the shares arriving
  const startX = -(c.ox - 14) / s;
  const spread = (h * 0.4) / s;
  ctx.lineCap = "round";
  for (let j = 0; j < STREAMS; j++) {
    const ti = Math.floor(hash(j * 3 + 1) * BN) * 3;
    const tx = BASKET[ti] * cs + BASKET[ti + 2] * sn;
    const ty = BASKET[ti + 1];
    const tz = -BASKET[ti] * sn + BASKET[ti + 2] * cs;
    const sy = (hash(j * 7 + 2) - 0.5) * 2 * spread;
    const p = (t * 0.1 + hash(j * 5 + 3)) % 1;
    const e = p * p * (3 - 2 * p);
    const q = Math.max(0, p - 0.06);
    const e2 = q * q * (3 - 2 * q);
    const a = Math.min(1, p * 7) * (1 - clamp((p - 0.86) / 0.14));
    pr(c, lerp(startX, tx, e2), lerp(sy, ty, e2), lerp(0, tz, e2));
    const qx = P.x;
    const qy = P.y;
    pr(c, lerp(startX, tx, e), lerp(sy, ty, e), lerp(0, tz, e));
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink2, 0.3 * a);
    ctx.beginPath();
    ctx.moveTo(qx, qy);
    ctx.lineTo(P.x, P.y);
    ctx.stroke();
    ctx.fillStyle = rgba(pal.ink, 0.8 * a);
    ctx.beginPath();
    ctx.arc(P.x, P.y, 1.2, 0, TAU);
    ctx.fill();
  }

  // the basket: far points first, by drawing the far half in one pass and the near half in the next
  const reach = R * 0.6;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < BN; i++) {
      const x0 = BASKET[i * 3];
      const y0 = BASKET[i * 3 + 1];
      const z0 = BASKET[i * 3 + 2];
      const x = x0 * cs + z0 * sn;
      const z = -x0 * sn + z0 * cs;
      if (z > 0 !== (pass === 0)) continue;
      pr(c, x, y0, z);
      let k = 1;
      if (on > 0.01) {
        const d = Math.hypot(P.x - mx, P.y - my);
        k = 1 + on * 0.42 * Math.exp(-((d / reach) ** 2));
        if (k > 1.004) pr(c, x * k, y0 * k, z * k);
      }
      const nearness = 1 - (z + 1) / 2;
      const tw = 0.82 + 0.18 * Math.sin(t * 1.1 + i * 2.4);
      ctx.fillStyle = rgba(k > 1.05 ? pal.gold : pal.teal, (0.22 + nearness * 0.74) * tw);
      ctx.beginPath();
      ctx.arc(P.x, P.y, 0.9 + nearness * 1.0 + (k - 1) * 2, 0, TAU);
      ctx.fill();
    }
  }

  // one outline holds them: the instrument
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.gold, 0.55 - on * 0.25);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.17, 0, TAU);
  ctx.stroke();
  ring(ctx, c, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1.17, pal.gold, 0.4, 0.14, 1, 60);

  caps(ctx, "shares", 16, cy + R * 1.17 + 13, pal.font, rgba(pal.ink3, 0.95), 9, "left");
  caps(ctx, "one index", cx, cy + R * 1.17 + 13, pal.font, rgba(pal.ink2, 0.95), 9);
};

/* ---- energy: the barrel ------------------------------------------------ */

const BY = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
const barrelR = (y: number) => 0.6 + 0.13 * Math.cos((y * Math.PI) / 2);

/**
 * A barrel standing on the deck, turning slowly, its two hoops in champagne
 * and a soft light down its side: the crude benchmarks are quoted by the
 * barrel. The pointer carries the light round the barrel and turns it.
 */
export const drawBarrel: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal }) => {
  if (w < 110 || h < 80) return;
  const on = smooth(hover);
  const s = Math.min(h * 0.35, w * 0.3);
  const c = camera(w / 2, h * 0.5, s, 0, 0.3 + (my / h - 0.5) * 0.16 * on, 8);
  const spin = t * 0.3 + (mx / w - 0.5) * 2.2 * on;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  corners(ctx, w, h, pal.gold, 0.4);

  // its light on the deck
  pr(c, 0, -1, 0);
  ctx.save();
  ctx.translate(P.x, P.y);
  ctx.scale(1, 0.3);
  glow(ctx, 0, 0, Math.min(s * 1.9, w * 0.46), pal.gold, 0.26 + on * 0.1);
  ctx.restore();

  // the body: the foot, the sides and a light down its length
  pr(c, -barrelR(0), 0, 0);
  const xl = P.x;
  pr(c, barrelR(0), 0, 0);
  const xr = P.x;
  let hl = 0.32 + 0.07 * Math.sin(t * 0.5);
  hl = lerp(hl, clamp((mx - xl) / (xr - xl), 0.08, 0.92), on);
  const shade = ctx.createLinearGradient(xl, 0, xr, 0);
  shade.addColorStop(0, rgba(pal.gold, 0.03));
  shade.addColorStop(clamp(hl - 0.18, 0.01, 0.98), rgba(pal.gold, 0.1));
  shade.addColorStop(hl, rgba(pal.gold, 0.36 + on * 0.1));
  shade.addColorStop(clamp(hl + 0.26, 0.02, 0.99), rgba(pal.gold, 0.07));
  shade.addColorStop(1, rgba(pal.gold, 0.02));
  const bodyPath = () => {
    ctx.beginPath();
    for (let i = 0; i < BY.length; i++) {
      pr(c, -barrelR(BY[i]), BY[i], 0);
      if (i === 0) ctx.moveTo(P.x, P.y);
      else ctx.lineTo(P.x, P.y);
    }
    for (let i = BY.length - 1; i >= 0; i--) {
      pr(c, barrelR(BY[i]), BY[i], 0);
      ctx.lineTo(P.x, P.y);
    }
    ctx.closePath();
  };
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass === 0 ? rgba(pal.surface, 0.96) : shade;
    discPath(ctx, c, 0, -1, 0, 1, 0, 0, 0, 0, 1, barrelR(-1), 40);
    ctx.fill();
    bodyPath();
    ctx.fill();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink2, 0.55);
  bodyPath();
  ctx.stroke();

  // the staves on the near side, turning
  for (let k = 0; k < 16; k++) {
    const a = spin + (k / 16) * TAU;
    const facing = -Math.sin(a);
    if (facing <= 0.05) continue;
    ctx.strokeStyle = rgba(pal.ink3, 0.5 * facing);
    ctx.beginPath();
    for (let i = 0; i < BY.length; i++) {
      const rr = barrelR(BY[i]);
      pr(c, Math.cos(a) * rr, BY[i], Math.sin(a) * rr);
      if (i === 0) ctx.moveTo(P.x, P.y);
      else ctx.lineTo(P.x, P.y);
    }
    ctx.stroke();
  }
  // the hoops and the foot
  ring(ctx, c, 0, -1, 0, 1, 0, 0, 0, 0, 1, barrelR(-1), pal.ink2, 0.7, 0, 1, 44);
  for (const y of [-0.6, 0.6]) ring(ctx, c, 0, y, 0, 1, 0, 0, 0, 0, 1, barrelR(y) + 0.012, pal.gold, 0.95, 0, 2.2, 48);

  // the head, with its bung
  const top = barrelR(1);
  discPath(ctx, c, 0, 1, 0, 1, 0, 0, 0, 0, 1, top, 44);
  ctx.fillStyle = rgba(pal.surface, 0.97);
  ctx.fill();
  ctx.fillStyle = rgba(pal.gold, 0.1 + on * 0.06);
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = rgba(pal.ink, 0.8);
  ctx.stroke();
  ring(ctx, c, 0, 1, 0, 1, 0, 0, 0, 0, 1, top * 0.84, pal.ink3, 0.6, 0.6, 1, 40);
  const bx = Math.cos(spin) * top * 0.45;
  const bz = Math.sin(spin) * top * 0.45;
  ring(ctx, c, bx, 1, bz, 1, 0, 0, 0, 0, 1, 0.07, pal.gold, 0.95, 0.95, 1.25, 14);
};

/* ---- equities: the share and its mirror --------------------------------- */

const CX = new Float32Array(16);
const CY = new Float32Array(16);
const CZ = new Float32Array(16);
/** radius of the pane of glass between the block and its image */
const GLASS = 1.72;
const CUBE_EDGES: [number, number][] = [];
for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) CUBE_EDGES.push([i, i | bit]);
const CUBE_FACES: number[][] = [
  [0, 4, 6, 2],
  [1, 3, 7, 5],
  [0, 1, 5, 4],
  [2, 6, 7, 3],
  [0, 2, 3, 1],
  [4, 5, 7, 6],
];

/**
 * A lit block floats over a pane of glass and its image stands below it,
 * drawn in outline only: a share CFD mirrors the share without being it.
 * Whatever the block does, the outline does. The pointer moves the block
 * (across, and up and down) and the outline follows exactly.
 */
export const drawMirror: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal }) => {
  if (w < 110 || h < 80) return;
  const on = smooth(hover);
  const s = Math.min(h * 0.27, w * 0.2);
  const c = camera(w * 0.42, h * 0.5, s, 0, 0.2, 8);
  const a = 0.5;
  const yc = 0.96 + Math.sin(t * 0.7) * 0.06 + (0.5 - my / h) * 0.3 * on;
  const xc = (mx / w - 0.5) * 1.1 * on;
  const yaw = t * 0.38;
  const cyw = Math.cos(yaw);
  const syw = Math.sin(yaw);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  corners(ctx, w, h, pal.gold, 0.4);

  for (let i = 0; i < 8; i++) {
    const sx = i & 1 ? a : -a;
    const sy = i & 2 ? a : -a;
    const sz = i & 4 ? a : -a;
    const x = xc + sx * cyw + sz * syw;
    const z = -sx * syw + sz * cyw;
    pr(c, x, yc + sy, z);
    CX[i] = P.x;
    CY[i] = P.y;
    CZ[i] = P.z;
    pr(c, x, -(yc + sy), z);
    CX[i + 8] = P.x;
    CY[i + 8] = P.y;
    CZ[i + 8] = P.z;
  }
  const zTop = pr(c, xc, yc, 0).z;
  const topX = P.x;
  const topY = P.y;
  const zLow = pr(c, xc, -yc, 0).z;
  const lowY = P.y;

  // the image below the glass: outline only
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  for (const [p, q] of CUBE_EDGES) {
    const nearer = (CZ[p + 8] + CZ[q + 8]) / 2 <= zLow + 0.02;
    ctx.strokeStyle = rgba(pal.gold, (nearer ? 0.8 : 0.3) + on * 0.15);
    ctx.beginPath();
    ctx.moveTo(CX[p + 8], CY[p + 8]);
    ctx.lineTo(CX[q + 8], CY[q + 8]);
    ctx.stroke();
  }
  // each corner tied to its image
  ctx.setLineDash([1, 4]);
  ctx.strokeStyle = rgba(pal.ink3, 0.3 + on * 0.5);
  for (let i = 0; i < 8; i++) {
    if (i & 2) continue;
    ctx.beginPath();
    ctx.moveTo(CX[i], CY[i]);
    ctx.lineTo(CX[i + 8], CY[i + 8]);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // the glass between them
  discPath(ctx, c, 0, 0, 0, 1, 0, 0, 0, 0, 1, GLASS, 56);
  ctx.fillStyle = rgba(pal.accent, 0.06);
  ctx.fill();
  ring(ctx, c, 0, 0, 0, 1, 0, 0, 0, 0, 1, GLASS, pal.ink2, 0.75, 0.3, 1, 56);
  ring(ctx, c, 0, 0, 0, 1, 0, 0, 0, 0, 1, GLASS / PHI, pal.ink3, 0.3, 0.14, 1, 48);

  // the share itself: lit faces, then its edges
  glow(ctx, topX, topY, Math.min(s * 1.5, topY - 2), pal.accent, 0.2 + on * 0.08);
  for (let f = 0; f < CUBE_FACES.length; f++) {
    const q = CUBE_FACES[f];
    const zf = (CZ[q[0]] + CZ[q[1]] + CZ[q[2]] + CZ[q[3]]) / 4;
    if (zf > zTop - 0.02) continue;
    ctx.beginPath();
    ctx.moveTo(CX[q[0]], CY[q[0]]);
    for (let k = 1; k < 4; k++) ctx.lineTo(CX[q[k]], CY[q[k]]);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.surface, 0.94);
    ctx.fill();
    ctx.fillStyle = rgba(pal.accent, f === 3 ? 0.42 : 0.14 + ((zTop - zf) / a) * 0.16);
    ctx.fill();
  }
  ctx.lineWidth = 1.25;
  for (const [p, q] of CUBE_EDGES) {
    const nearer = (CZ[p] + CZ[q]) / 2 <= zTop + 0.02;
    if (!nearer) continue;
    ctx.strokeStyle = rgba(pal.ink, 0.9);
    ctx.beginPath();
    ctx.moveTo(CX[p], CY[p]);
    ctx.lineTo(CX[q], CY[q]);
    ctx.stroke();
  }

  const lx = pr(c, GLASS, 0, 0).x + 7;
  caps(ctx, "share", lx, topY, pal.font, rgba(pal.ink2, 0.95), 9, "left");
  caps(ctx, "cfd", lx, lowY, pal.font, rgba(pal.gold, 0.95), 9, "left");
};

/* ---- crypto: the public record ------------------------------------------ */

const ICO: number[][] = (() => {
  const v: number[][] = [];
  const n = Math.hypot(1, PHI);
  for (const a of [-1, 1])
    for (const b of [-PHI, PHI]) {
      v.push([0, a / n, b / n]);
      v.push([a / n, b / n, 0]);
      v.push([b / n, 0, a / n]);
    }
  return v;
})();
const ICO_EDGES: [number, number][] = (() => {
  const e: [number, number][] = [];
  const want = 2 / Math.hypot(1, PHI);
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++) {
      const d = Math.hypot(ICO[i][0] - ICO[j][0], ICO[i][1] - ICO[j][1], ICO[i][2] - ICO[j][2]);
      if (Math.abs(d - want) < 0.01) e.push([i, j]);
    }
  return e;
})();
/** steps along the edges from each node to each other node */
const ICO_DIST: number[][] = ICO.map((_, src) => {
  const d = new Array<number>(12).fill(9);
  d[src] = 0;
  for (let step = 0; step < 3; step++) for (const [p, q] of ICO_EDGES) {
    if (d[p] === step && d[q] > step + 1) d[q] = step + 1;
    if (d[q] === step && d[p] > step + 1) d[p] = step + 1;
  }
  return d;
});
const IX = new Float32Array(12);
const IY = new Float32Array(12);
const IZ = new Float32Array(12);

/**
 * A ring of nodes that all keep the same record: an entry appears at one node
 * (champagne) and passes along the links until every node holds it (emerald),
 * then the next entry begins somewhere else. The pointer makes the nearest
 * node the one the entry starts from.
 */
export const drawLedger: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal }) => {
  if (w < 110 || h < 80) return;
  const on = smooth(hover);
  const s = Math.min(h * 0.37, w * 0.34);
  const c = camera(w / 2, h * 0.5, s, t * 0.15, 0.3 + Math.sin(t * 0.21) * 0.08, 5);
  ctx.lineCap = "round";
  corners(ctx, w, h, pal.gold, 0.4);

  for (let i = 0; i < 12; i++) {
    pr(c, ICO[i][0], ICO[i][1], ICO[i][2]);
    IX[i] = P.x;
    IY[i] = P.y;
    IZ[i] = P.z;
  }
  const period = 4.4;
  const ph = (t / period) % 1;
  let src = Math.floor(hash(Math.floor(t / period) + 4) * 12) % 12;
  if (hover > 0.02) {
    let best = Infinity;
    for (let i = 0; i < 12; i++) {
      const d = (IX[i] - mx) ** 2 + (IY[i] - my) ** 2;
      if (d < best) {
        best = d;
        src = i;
      }
    }
  }
  const front = ph * 5;
  const fade = ph > 0.86 ? 1 - (ph - 0.86) / 0.14 : 1;
  const dist = ICO_DIST[src];

  glow(ctx, w / 2, h / 2, s * 1.25, pal.emerald, 0.1);

  for (const [p, q] of ICO_EDGES) {
    const nearness = 1 - ((IZ[p] + IZ[q]) / 2 + 1) / 2;
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, 0.16 + nearness * 0.42);
    ctx.beginPath();
    ctx.moveTo(IX[p], IY[p]);
    ctx.lineTo(IX[q], IY[q]);
    ctx.stroke();
    const lo = Math.min(dist[p], dist[q]);
    const hi = Math.max(dist[p], dist[q]);
    const from = dist[p] <= dist[q] ? p : q;
    const to = from === p ? q : p;
    const run = hi > lo ? clamp(front - lo) : front > lo + 0.6 ? 1 : 0;
    if (run > 0) {
      const ex = lerp(IX[from], IX[to], run);
      const ey = lerp(IY[from], IY[to], run);
      ctx.strokeStyle = rgba(pal.emerald, (0.25 + nearness * 0.6) * fade);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(IX[from], IY[from]);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      if (run < 1 && hi > lo) lamp(ctx, ex, ey, 1.4, pal.emerald, 0.9 * fade);
    }
  }
  for (let i = 0; i < 12; i++) {
    const nearness = 1 - (IZ[i] + 1) / 2;
    const reached = clamp(front - dist[i] + 0.15, 0, 1) * fade;
    const size = 1.6 + nearness * 1.6;
    if (i === src) lamp(ctx, IX[i], IY[i], size + 0.8, pal.gold, 0.5 + 0.5 * Math.max(fade, on));
    else if (reached > 0.02) lamp(ctx, IX[i], IY[i], size, pal.emerald, (0.4 + nearness * 0.6) * reached);
    ctx.fillStyle = rgba(pal.surface, 1);
    if (i !== src && reached <= 0.02) {
      ctx.beginPath();
      ctx.arc(IX[i], IY[i], size, 0, TAU);
      ctx.fill();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(i === src ? pal.gold : pal.ink2, 0.35 + nearness * 0.55);
    ctx.beginPath();
    ctx.arc(IX[i], IY[i], size + 1.2, 0, TAU);
    ctx.stroke();
  }
  if (on > 0.02) {
    ctx.strokeStyle = rgba(pal.gold, 0.7 * on);
    ctx.beginPath();
    ctx.arc(IX[src], IY[src], 9 + Math.sin(t * 3) * 1.2, 0, TAU);
    ctx.stroke();
  }
};

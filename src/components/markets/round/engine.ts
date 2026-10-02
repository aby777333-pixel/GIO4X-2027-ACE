import type { Colour } from "@/components/figures/Figure";

/**
 * A very small solid renderer for Canvas 2D: the six objects of "in the round"
 * are built once as flat-shaded polygon meshes and painted each frame with real
 * perspective, a key light, a fill and a rim light, back-face culling and a
 * depth sort (far faces first).
 *
 * World space is the one the figure kits use: x to the right, y up, z away from
 * the viewer. The camera stands on the negative z axis; yaw turns the object
 * about the vertical, pitch looks down on it.
 *
 * Nothing here allocates while painting: meshes carry their own scratch
 * arrays, and a face's colour is picked from a ramp of strings made once for
 * each material when the palette is read.
 */

/* ── colour ─────────────────────────────────────────────────────────────── */

export type Tone = "accent" | "teal" | "emerald" | "gold" | "ink" | "ink2" | "ink3" | "platinum" | "surface";

export type RoundPalette = Record<Tone, Colour> & {
  /** the panel the object stands on */
  bg: Colour;
  line: Colour;
  font: string;
};

/**
 * A material is a token colour (optionally mixed with a second token and sunk
 * towards the panel), with how strongly and how tightly it throws a highlight.
 */
export type Material = { tone: Tone; with?: Tone; mix?: number; dim?: number; spec: number; gloss: number };

/** how many steps of light a material has, from its shadow to its highlight */
export const SHADES = 48;
/** the share of the ramp that runs from shadow to the material's own colour */
const BODY = 0.66;

const mixc = (a: Colour, b: Colour, t: number): Colour => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1];

/** The colours of one material under every level of light, as canvas colours. */
export function ramp(m: Material, pal: RoundPalette): string[] {
  let base: Colour = pal[m.tone];
  if (m.with) base = mixc(base, pal[m.with], m.mix ?? 0.5);
  if (m.dim) base = mixc(base, pal.bg, m.dim);
  const dark = mixc(base, pal.bg, 0.84);
  const light = mixc(base, pal.ink, 0.8);
  const out: string[] = [];
  for (let i = 0; i < SHADES; i++) {
    const t = i / (SHADES - 1);
    const c = t < BODY ? mixc(dark, base, t / BODY) : mixc(base, light, (t - BODY) / (1 - BODY));
    out.push(`rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`);
  }
  return out;
}

/* ── the mesh ───────────────────────────────────────────────────────────── */

export const SOLID = 0;
/** a pane: every face is drawn, thinly, so what stands behind shows through */
export const GLASS = 1;
/** an outline of a solid: its edges, dashed, and the faintest fill */
export const GHOST = 2;

/** something drawn on a face, in the face's own plane, so it turns with it */
export type Decal =
  | {
      kind: "poly";
      /** x, y, z of each corner */
      pts: Float32Array;
      n: readonly [number, number, number];
      mat: number;
      /** steps of light added to (or taken from) the face's own: a recess is darker, a raised mark lighter */
      lift: number;
      /** 0 fills the shape; otherwise the width of its outline in world units */
      stroke: number;
      alpha: number;
    }
  | {
      kind: "text";
      text: string;
      /** centre of the lettering, its reading direction and its downward direction (unit vectors) */
      o: readonly [number, number, number];
      u: readonly [number, number, number];
      v: readonly [number, number, number];
      n: readonly [number, number, number];
      /** letter height in world units */
      size: number;
      mat: number;
      lift: number;
      alpha: number;
    };

export type Part = {
  v: Float32Array;
  idx: Uint16Array;
  /** where each face's indices begin in `idx` (one more entry than there are faces) */
  start: Uint16Array;
  mat: Uint8Array;
  nrm: Float32Array;
  cen: Float32Array;
  cx: number;
  cy: number;
  cz: number;
  /** added to the part's depth when the parts are ordered: positive draws it earlier */
  bias: number;
  mode: number;
  decals: Decal[];
  // scratch, written each frame
  px: Float32Array;
  py: Float32Array;
  fz: Float32Array;
  fs: Uint8Array;
  ff: Uint8Array;
  ord: Uint16Array;
  z: number;
};

/** Collects vertices and faces, then freezes them into a Part. */
export class Builder {
  private v: number[] = [];
  private idx: number[] = [];
  private start: number[] = [0];
  private mat: number[] = [];
  private nrm: number[] = [];
  private decals: Decal[] = [];

  vert(x: number, y: number, z: number): number {
    this.v.push(x, y, z);
    return this.v.length / 3 - 1;
  }

  /** A face with a known outward normal. */
  face(ids: readonly number[], mat: number, nx: number, ny: number, nz: number) {
    const l = Math.hypot(nx, ny, nz) || 1;
    for (const i of ids) this.idx.push(i);
    this.start.push(this.idx.length);
    this.mat.push(mat);
    this.nrm.push(nx / l, ny / l, nz / l);
  }

  /** A face of a convex solid: its normal is worked out and turned away from the solid's centre. */
  auto(ids: readonly number[], mat: number, cx: number, cy: number, cz: number) {
    const v = this.v;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    let mx = 0;
    let my = 0;
    let mz = 0;
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i] * 3;
      const b = ids[(i + 1) % ids.length] * 3;
      nx += (v[a + 1] - v[b + 1]) * (v[a + 2] + v[b + 2]);
      ny += (v[a + 2] - v[b + 2]) * (v[a] + v[b]);
      nz += (v[a] - v[b]) * (v[a + 1] + v[b + 1]);
      mx += v[a];
      my += v[a + 1];
      mz += v[a + 2];
    }
    const k = 1 / ids.length;
    const out = nx * (mx * k - cx) + ny * (my * k - cy) + nz * (mz * k - cz) >= 0 ? 1 : -1;
    this.face(ids, mat, nx * out, ny * out, nz * out);
  }

  decal(d: Decal) {
    this.decals.push(d);
  }

  part(mode = SOLID, bias = 0): Part {
    const nV = this.v.length / 3;
    const nF = this.mat.length;
    const v = new Float32Array(this.v);
    const idx = new Uint16Array(this.idx);
    const start = new Uint16Array(this.start);
    const cen = new Float32Array(nF * 3);
    let lx = Infinity;
    let ly = Infinity;
    let lz = Infinity;
    let hx = -Infinity;
    let hy = -Infinity;
    let hz = -Infinity;
    for (let i = 0; i < nV; i++) {
      lx = Math.min(lx, v[i * 3]);
      hx = Math.max(hx, v[i * 3]);
      ly = Math.min(ly, v[i * 3 + 1]);
      hy = Math.max(hy, v[i * 3 + 1]);
      lz = Math.min(lz, v[i * 3 + 2]);
      hz = Math.max(hz, v[i * 3 + 2]);
    }
    for (let f = 0; f < nF; f++) {
      const n = start[f + 1] - start[f];
      for (let j = start[f]; j < start[f + 1]; j++) {
        cen[f * 3] += v[idx[j] * 3] / n;
        cen[f * 3 + 1] += v[idx[j] * 3 + 1] / n;
        cen[f * 3 + 2] += v[idx[j] * 3 + 2] / n;
      }
    }
    return {
      v,
      idx,
      start,
      mat: new Uint8Array(this.mat),
      nrm: new Float32Array(this.nrm),
      cen,
      cx: (lx + hx) / 2,
      cy: (ly + hy) / 2,
      cz: (lz + hz) / 2,
      bias,
      mode,
      decals: this.decals,
      px: new Float32Array(nV),
      py: new Float32Array(nV),
      fz: new Float32Array(nF),
      fs: new Uint8Array(nF),
      ff: new Uint8Array(nF),
      ord: new Uint16Array(nF),
      z: 0,
    };
  }
}

/* ── solids ─────────────────────────────────────────────────────────────── */

const SIGNS = [-1, 1] as const;

/**
 * A box with every edge and corner cut off (a chamfer of `bev`), centred on
 * (cx, cy, cz) and turned by `rot` about the vertical. `taper` narrows the top
 * (1 leaves the sides upright). Faces take `mat`, the cut edges `edge`.
 */
export function bevelBox(
  b: Builder,
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  d: number,
  bev: number,
  mat: number,
  edge = mat,
  rot = 0,
  taper = 1,
) {
  const W = w / 2;
  const H = h / 2;
  const D = d / 2;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const put = (x: number, y: number, z: number) => {
    const k = 1 + (taper - 1) * ((y + H) / (2 * H));
    const xx = x * k;
    const zz = z * k;
    return b.vert(cx + xx * cr + zz * sr, cy + y, cz - xx * sr + zz * cr);
  };
  // three vertices at each corner: one on each of the faces that meet there
  const vx: number[] = [];
  const vy: number[] = [];
  const vz: number[] = [];
  const at = (sx: number, sy: number, sz: number) => (sx > 0 ? 4 : 0) + (sy > 0 ? 2 : 0) + (sz > 0 ? 1 : 0);
  for (const sx of SIGNS)
    for (const sy of SIGNS)
      for (const sz of SIGNS) {
        const i = at(sx, sy, sz);
        vx[i] = put(sx * W, sy * (H - bev), sz * (D - bev));
        vy[i] = put(sx * (W - bev), sy * H, sz * (D - bev));
        vz[i] = put(sx * (W - bev), sy * (H - bev), sz * D);
      }
  for (const s of SIGNS) {
    b.auto([vx[at(s, -1, -1)], vx[at(s, 1, -1)], vx[at(s, 1, 1)], vx[at(s, -1, 1)]], mat, cx, cy, cz);
    b.auto([vy[at(-1, s, -1)], vy[at(1, s, -1)], vy[at(1, s, 1)], vy[at(-1, s, 1)]], mat, cx, cy, cz);
    b.auto([vz[at(-1, -1, s)], vz[at(1, -1, s)], vz[at(1, 1, s)], vz[at(-1, 1, s)]], mat, cx, cy, cz);
    for (const t of SIGNS) {
      // the cut edges: along z (between an x face and a y face), along x, along y
      b.auto([vx[at(s, t, -1)], vx[at(s, t, 1)], vy[at(s, t, 1)], vy[at(s, t, -1)]], edge, cx, cy, cz);
      b.auto([vy[at(-1, s, t)], vy[at(1, s, t)], vz[at(1, s, t)], vz[at(-1, s, t)]], edge, cx, cy, cz);
      b.auto([vx[at(s, -1, t)], vx[at(s, 1, t)], vz[at(s, 1, t)], vz[at(s, -1, t)]], edge, cx, cy, cz);
      for (const r of SIGNS) b.auto([vx[at(s, t, r)], vy[at(s, t, r)], vz[at(s, t, r)]], edge, cx, cy, cz);
    }
  }
}

/**
 * A solid of revolution. `profile` is its outline as (radius, height) pairs,
 * traced from the axis at one end, round the outside, to the axis at the other,
 * so that the solid is always on the same side of the line: that is what gives
 * every band its outward normal without any guessing. `axis` "x" lays it on
 * its side (heights run along x). `mat(band, segment)` picks the material.
 */
export function lathe(
  b: Builder,
  axis: "x" | "y",
  cx: number,
  cy: number,
  cz: number,
  n: number,
  profile: readonly number[],
  mat: (band: number, seg: number) => number,
) {
  const m = profile.length / 2;
  const EPS = 1e-4;
  const rings: number[][] = [];
  const place = (r: number, a: number, th: number) =>
    axis === "y" ? b.vert(cx + r * Math.cos(th), cy + a, cz + r * Math.sin(th)) : b.vert(cx + a, cy + r * Math.cos(th), cz + r * Math.sin(th));
  for (let i = 0; i < m; i++) {
    const r = profile[i * 2];
    const a = profile[i * 2 + 1];
    const ring: number[] = [];
    if (r < EPS) ring.push(place(0, a, 0));
    else for (let j = 0; j < n; j++) ring.push(place(r, a, (j / n) * Math.PI * 2));
    rings.push(ring);
  }
  const normal = (nr: number, na: number, th: number): [number, number, number] =>
    axis === "y" ? [nr * Math.cos(th), na, nr * Math.sin(th)] : [na, nr * Math.cos(th), nr * Math.sin(th)];
  for (let i = 0; i < m - 1; i++) {
    const r0 = profile[i * 2];
    const r1 = profile[i * 2 + 2];
    const dr = r1 - r0;
    const da = profile[i * 2 + 3] - profile[i * 2 + 1];
    const l = Math.hypot(dr, da) || 1;
    const nr = -da / l;
    const na = dr / l;
    const A = rings[i];
    const B = rings[i + 1];
    if (r0 < EPS && r1 < EPS) continue;
    if ((r0 < EPS || r1 < EPS) && Math.abs(da) < EPS) {
      // a flat end: one polygon
      const [x, y, z] = normal(0, na, 0);
      b.face(r0 < EPS ? B : A, mat(i, 0), x, y, z);
      continue;
    }
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      const [x, y, z] = normal(nr, na, ((j + 0.5) / n) * Math.PI * 2);
      if (r0 < EPS) b.face([A[0], B[k], B[j]], mat(i, j), x, y, z);
      else if (r1 < EPS) b.face([A[j], A[k], B[0]], mat(i, j), x, y, z);
      else b.face([A[j], A[k], B[k], B[j]], mat(i, j), x, y, z);
    }
  }
}

/** The corners of a rectangle on a face: centre o, half-extents a along u and c along v. */
export function rectPts(o: readonly number[], u: readonly number[], v: readonly number[], a: number, c: number): Float32Array {
  const out = new Float32Array(12);
  const s = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) out[i * 3 + k] = o[k] + u[k] * a * s[i][0] + v[k] * c * s[i][1];
  return out;
}

/** The points of a circle on a face: centre o, radius r, in the plane of u and v. */
export function circlePts(o: readonly number[], u: readonly number[], v: readonly number[], r: number, n = 28): Float32Array {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    for (let k = 0; k < 3; k++) out[i * 3 + k] = o[k] + (u[k] * Math.cos(a) + v[k] * Math.sin(a)) * r;
  }
  return out;
}

/* ── the camera ─────────────────────────────────────────────────────────── */

export type View = { cyw: number; syw: number; cp: number; sp: number; ox: number; oy: number; s: number; d: number };

export const makeView = (): View => ({ cyw: 1, syw: 0, cp: 1, sp: 0, ox: 0, oy: 0, s: 1, d: 8 });

export function aimView(V: View, ox: number, oy: number, s: number, d: number, yaw: number, pitch: number) {
  V.ox = ox;
  V.oy = oy;
  V.s = s;
  V.d = d;
  V.cyw = Math.cos(yaw);
  V.syw = Math.sin(yaw);
  V.cp = Math.cos(pitch);
  V.sp = Math.sin(pitch);
}

/** the last projected point: screen x and y, depth (larger is farther) and the perspective factor there */
export const P = { x: 0, y: 0, z: 0, k: 1 };

export function project(V: View, x: number, y: number, z: number) {
  const x1 = x * V.cyw + z * V.syw;
  const z1 = -x * V.syw + z * V.cyw;
  const y2 = y * V.cp + z1 * V.sp;
  const z2 = -y * V.sp + z1 * V.cp;
  const k = V.d / Math.max(0.5, V.d + z2);
  P.x = V.ox + x1 * k * V.s;
  P.y = V.oy - y2 * k * V.s;
  P.z = z2;
  P.k = k;
}

/**
 * A point on the floor, moved in the viewer's own frame (dx to the right, dz
 * away) after the object's turn: where a shadow falls does not turn with the
 * thing that casts it.
 */
export function projectFloor(V: View, x: number, y: number, z: number, dx: number, dz: number) {
  const x1 = x * V.cyw + z * V.syw + dx;
  const z1 = -x * V.syw + z * V.cyw + dz;
  const y2 = y * V.cp + z1 * V.sp;
  const z2 = -y * V.sp + z1 * V.cp;
  const k = V.d / Math.max(0.5, V.d + z2);
  P.x = V.ox + x1 * k * V.s;
  P.y = V.oy - y2 * k * V.s;
  P.z = z2;
  P.k = k;
}

/** How much a direction faces the viewer once turned: 1 straight at them, -1 straight away. */
export function facing(V: View, nx: number, ny: number, nz: number): number {
  const z1 = -nx * V.syw + nz * V.cyw;
  return ny * V.sp - z1 * V.cp;
}

/* ── light ──────────────────────────────────────────────────────────────── */

const unit = (x: number, y: number, z: number) => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l] as const;
};
// in the viewer's frame, so the object turns under lamps that stay where they are
/** the key: above, to the left, in front */
const KEY = unit(-0.52, 0.74, -0.44);
/** a weak fill from the right, low */
const FILL = unit(0.78, 0.08, -0.62);
/** the rim: behind the object, above and to the right. It only catches faces that are almost edge-on. */
const RIM = unit(0.6, 0.42, 0.68);
/** halfway between the key and the viewer: where a polished face flashes */
const HALF = unit(KEY[0], KEY[1], KEY[2] - 1);

/** The step of a material's ramp for a face whose normal, in the viewer's frame, is (x, y, z). */
function light(x: number, y: number, z: number, m: Material): number {
  const diff = Math.max(0, x * KEY[0] + y * KEY[1] + z * KEY[2]);
  const fill = Math.max(0, x * FILL[0] + y * FILL[1] + z * FILL[2]);
  const rim = Math.max(0, x * RIM[0] + y * RIM[1] + z * RIM[2]);
  const hl = Math.max(0, x * HALF[0] + y * HALF[1] + z * HALF[2]);
  const t = 0.12 + 0.54 * diff + 0.13 * fill + 0.6 * rim * rim + m.spec * Math.pow(hl, m.gloss);
  return t >= 1 ? SHADES - 1 : (t * (SHADES - 1)) | 0;
}

/* ── painting ───────────────────────────────────────────────────────────── */

type Ctx = CanvasRenderingContext2D;

function tracePoly(ctx: Ctx, V: View, pts: Float32Array) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 3) {
    project(V, pts[i], pts[i + 1], pts[i + 2]);
    if (i === 0) ctx.moveTo(P.x, P.y);
    else ctx.lineTo(P.x, P.y);
  }
  ctx.closePath();
}

/** the size lettering is set at before it is laid onto a face */
const TYPE = 40;
const DASH = [5, 4];
const NO_DASH: number[] = [];

function drawDecal(ctx: Ctx, V: View, d: Decal, mats: readonly Material[], ramps: readonly string[][], alpha: number, typeFont: string) {
  // seen from behind, a mark on a face is not there
  const x1 = d.n[0] * V.cyw + d.n[2] * V.syw;
  const z1 = -d.n[0] * V.syw + d.n[2] * V.cyw;
  const y2 = d.n[1] * V.cp + z1 * V.sp;
  const z2 = -d.n[1] * V.sp + z1 * V.cp;
  const o = d.kind === "poly" ? d.pts : d.o;
  const ox1 = o[0] * V.cyw + o[2] * V.syw;
  const oz1 = -o[0] * V.syw + o[2] * V.cyw;
  if (x1 * ox1 + y2 * (o[1] * V.cp + oz1 * V.sp) + z2 * (-o[1] * V.sp + oz1 * V.cp + V.d) >= 0) return;
  project(V, o[0], o[1], o[2]);
  const step = Math.max(0, Math.min(SHADES - 1, light(x1, y2, z2, mats[d.mat]) + d.lift));
  const colour = ramps[d.mat][step];
  ctx.globalAlpha = alpha * d.alpha;
  if (d.kind === "poly") {
    tracePoly(ctx, V, d.pts);
    if (d.stroke > 0) {
      ctx.lineWidth = Math.max(0.75, d.stroke * V.s * P.k);
      ctx.strokeStyle = colour;
      ctx.stroke();
    } else {
      ctx.fillStyle = colour;
      ctx.fill();
    }
  } else {
    // lettering lies in the face: the face's own two directions, as they land on the screen, become the type's axes
    const ox = P.x;
    const oy = P.y;
    project(V, d.o[0] + d.u[0], d.o[1] + d.u[1], d.o[2] + d.u[2]);
    const ux = P.x - ox;
    const uy = P.y - oy;
    project(V, d.o[0] + d.v[0], d.o[1] + d.v[1], d.o[2] + d.v[2]);
    const vx = P.x - ox;
    const vy = P.y - oy;
    const k = d.size / (TYPE * 0.72);
    ctx.save();
    ctx.transform(ux * k, uy * k, vx * k, vy * k, ox, oy);
    ctx.font = typeFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // struck into the metal: a dark edge below, the lit letter above it
    ctx.fillStyle = ramps[d.mat][Math.max(0, step - 20)];
    ctx.fillText(d.text, 0, 2.5);
    ctx.fillStyle = colour;
    ctx.fillText(d.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = alpha;
}

function drawPart(ctx: Ctx, V: View, p: Part, mats: readonly Material[], ramps: readonly string[][], edge: string, typeFont: string) {
  const { v, idx, start, nrm, cen, px, py, fz, fs, ff, ord } = p;
  const nV = px.length;
  for (let i = 0; i < nV; i++) {
    project(V, v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
    px[i] = P.x;
    py[i] = P.y;
  }
  const nF = fz.length;
  let n = 0;
  for (let f = 0; f < nF; f++) {
    const a = f * 3;
    // the face's centre and its normal, in the viewer's frame
    let x1 = cen[a] * V.cyw + cen[a + 2] * V.syw;
    let z1 = -cen[a] * V.syw + cen[a + 2] * V.cyw;
    const cy2 = cen[a + 1] * V.cp + z1 * V.sp;
    const cz2 = -cen[a + 1] * V.sp + z1 * V.cp;
    const cx1 = x1;
    x1 = nrm[a] * V.cyw + nrm[a + 2] * V.syw;
    z1 = -nrm[a] * V.syw + nrm[a + 2] * V.cyw;
    const ny2 = nrm[a + 1] * V.cp + z1 * V.sp;
    const nz2 = -nrm[a + 1] * V.sp + z1 * V.cp;
    // it faces the eye when its normal points back along the line from the eye to it
    const front = x1 * cx1 + ny2 * cy2 + nz2 * (cz2 + V.d) < 0;
    if (!front && p.mode === SOLID) continue;
    ff[f] = front ? 1 : 0;
    // a face seen from behind is lit as its other side
    fs[f] = front ? light(x1, ny2, nz2, mats[p.mat[f]]) : light(-x1, -ny2, -nz2, mats[p.mat[f]]);
    fz[f] = cz2;
    ord[n++] = f;
  }
  // far faces first (an insertion sort: a few hundred faces at most, and nothing to allocate)
  for (let i = 1; i < n; i++) {
    const f = ord[i];
    const key = fz[f];
    let j = i - 1;
    while (j >= 0 && fz[ord[j]] < key) {
      ord[j + 1] = ord[j];
      j--;
    }
    ord[j + 1] = f;
  }
  const solid = p.mode === SOLID;
  ctx.lineJoin = "round";
  if (p.mode === GHOST) ctx.setLineDash(DASH);
  for (let i = 0; i < n; i++) {
    const f = ord[i];
    ctx.beginPath();
    for (let j = start[f]; j < start[f + 1]; j++) {
      const q = idx[j];
      if (j === start[f]) ctx.moveTo(px[q], py[q]);
      else ctx.lineTo(px[q], py[q]);
    }
    ctx.closePath();
    const colour = ramps[p.mat[f]][fs[f]];
    if (solid) {
      ctx.fillStyle = colour;
      ctx.fill();
      // the same colour along the edges closes the hairline the antialiasing leaves between neighbours
      ctx.strokeStyle = colour;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    } else if (p.mode === GLASS) {
      ctx.globalAlpha = ff[f] ? 0.2 : 0.1;
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.globalAlpha = ff[f] ? 0.5 : 0.2;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 0.75;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = ff[f] ? 0.1 : 0.04;
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.globalAlpha = ff[f] ? 0.95 : 0.3;
      ctx.strokeStyle = ramps[p.mat[f]][SHADES - 14];
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  if (p.mode === GHOST) ctx.setLineDash(NO_DASH);
  for (let i = 0; i < p.decals.length; i++) drawDecal(ctx, V, p.decals[i], mats, ramps, 1, typeFont);
}

/**
 * Paint the parts, farthest first. `order` is scratch the caller keeps (one
 * entry for each part). Parts are convex or nearly so and do not pass through
 * each other, so ordering them by the depth of their centres is enough.
 */
export function drawParts(
  ctx: Ctx,
  V: View,
  parts: readonly Part[],
  order: Uint8Array,
  mats: readonly Material[],
  ramps: readonly string[][],
  edge: string,
  typeFont: string,
) {
  const n = parts.length;
  for (let i = 0; i < n; i++) {
    const p = parts[i];
    project(V, p.cx, p.cy, p.cz);
    p.z = P.z + p.bias;
    order[i] = i;
  }
  for (let i = 1; i < n; i++) {
    const q = order[i];
    const key = parts[q].z;
    let j = i - 1;
    while (j >= 0 && parts[order[j]].z < key) {
      order[j + 1] = order[j];
      j--;
    }
    order[j + 1] = q;
  }
  for (let i = 0; i < n; i++) drawPart(ctx, V, parts[order[i]], mats, ramps, edge, typeFont);
}

/** the font string lettering on a face is set in */
export const typeFont = (family: string) => `700 ${TYPE}px ${family}`;

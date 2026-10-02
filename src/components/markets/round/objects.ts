import { Builder, GHOST, GLASS, bevelBox, circlePts, lathe, rectPts, type Material, type Part } from "./engine";

/**
 * The six objects of "in the round", one for each asset class, as meshes:
 *
 *   forex     two coins on one axle: the base currency and the quote currency
 *   metals    a cast bar with bevelled edges and a hallmark panel
 *   indices   blocks of different sizes stacked on one axis: a basket as one body
 *   energy    a steel barrel with its hoops, rims and bungs
 *   equities  a share certificate as a plaque, a pane of glass, and the plaque's outline beyond it
 *   crypto    three blocks joined in a chain
 *
 * Each also names the points its facts are pinned to (`anchors`): a point on
 * the surface and the direction the pin stands out in. Lettering on an object
 * is limited to words this site already uses for it. Nothing here is a
 * quantity: no price, no level, no weight.
 */

export type RoundKind = "forex" | "metals" | "indices" | "energy" | "equities" | "crypto";

export type Anchor = {
  /** the point on the object */
  p: readonly [number, number, number];
  /** the direction the pin stands out in */
  n: readonly [number, number, number];
  /** how far the pin's head stands from the surface, in world units */
  len: number;
};

export type Scene = {
  parts: Part[];
  mats: Material[];
  /** the height of the floor the object stands on */
  floor: number;
  /** the object's outline on the floor, as x, z pairs: what casts the shadow */
  footprint: Float32Array;
  /** the radius of the turntable ring drawn on the floor */
  ring: number;
  /** how far the object and its pins reach sideways (at any turn) and up or down: what the picture is fitted to */
  rx: number;
  ry: number;
  /** the view it starts from, and returns to */
  yaw: number;
  pitch: number;
  anchors: Record<string, Anchor>;
};

const X = [1, 0, 0] as const;
const Y = [0, 1, 0] as const;
const Z = [0, 0, 1] as const;
const NX = [-1, 0, 0] as const;
const NY = [0, -1, 0] as const;
const NZ = [0, 0, -1] as const;

const rect = (x0: number, x1: number, z0: number, z1: number) => new Float32Array([x0, z0, x1, z0, x1, z1, x0, z1]);

const disc = (r: number, n = 20) => {
  const out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    out[i * 2] = Math.cos((i / n) * Math.PI * 2) * r;
    out[i * 2 + 1] = Math.sin((i / n) * Math.PI * 2) * r;
  }
  return out;
};

/* ── forex: two coins on one axle ───────────────────────────────────────── */

function forex(): Scene {
  const T = 0.11; // half the thickness of a coin
  const F = T; // its faces are flat: the rim and the field are struck onto them
  const AT = 0.58; // how far each coin stands from the middle of the axle
  const coin = [0, T, 0.95, T, 1, T - 0.04, 1, -(T - 0.04), 0.95, -T, 0, -T];
  const parts: Part[] = [];
  for (const side of [-1, 1]) {
    const b = new Builder();
    const body = side < 0 ? 0 : 2;
    // band 2 is the edge: every other segment is a little darker, which reads as milling
    lathe(b, "x", side * AT, 0, 0, 64, coin, (band, seg) => (band === 2 && seg % 2 ? body + 1 : body));
    for (const face of [-1, 1]) {
      const o = [side * AT + face * (F + 0.002), 0, 0];
      const n = face < 0 ? NX : X;
      // reading direction on a face: to the reader's right when they stand in front of it
      const u = face < 0 ? NZ : Z;
      // the field, a shade below the rim that is left standing round it
      b.decal({ kind: "poly", pts: circlePts(o, u, Y, 0.8, 48), n, mat: body, lift: -5, stroke: 0, alpha: 1 });
      b.decal({ kind: "poly", pts: circlePts(o, u, Y, 0.8, 48), n, mat: body, lift: 10, stroke: 0.014, alpha: 0.9 });
      b.decal({ kind: "poly", pts: circlePts(o, u, Y, 0.66, 36), n, mat: body, lift: 12, stroke: 0.014, alpha: 0.9 });
      if (face === side) {
        b.decal({ kind: "text", text: side < 0 ? "BASE" : "QUOTE", o: [o[0], 0.02, 0], u, v: NY, n, size: side < 0 ? 0.25 : 0.215, mat: body, lift: 16, alpha: 1 });
        b.decal({ kind: "poly", pts: circlePts(o, u, Y, 0.56, 36), n, mat: body, lift: -8, stroke: 0.01, alpha: 0.8 });
      } else {
        b.decal({ kind: "poly", pts: circlePts(o, u, Y, 0.4, 30), n, mat: body, lift: -8, stroke: 0.012, alpha: 0.8 });
      }
    }
    parts.push(b.part());
  }
  // the axle, with a collar where it meets each coin
  const L = AT - F;
  const b = new Builder();
  lathe(b, "x", 0, 0, 0, 14, [0, L, 0.2, L, 0.2, L - 0.06, 0.085, L - 0.06, 0.085, -(L - 0.06), 0.2, -(L - 0.06), 0.2, -L, 0, -L], () => 4);
  parts.push(b.part());
  return {
    parts,
    mats: [
      { tone: "accent", spec: 0.42, gloss: 16 },
      { tone: "accent", dim: 0.24, spec: 0.3, gloss: 8 },
      { tone: "teal", spec: 0.42, gloss: 16 },
      { tone: "teal", dim: 0.24, spec: 0.3, gloss: 8 },
      { tone: "ink3", with: "platinum", mix: 0.5, spec: 0.4, gloss: 10 },
    ],
    floor: -1,
    footprint: rect(-0.72, 0.72, -0.62, 0.62),
    ring: 1.5,
    rx: 2.05,
    ry: 1.6,
    yaw: -0.72,
    pitch: 0.3,
    anchors: {
      base: { p: [-(AT + F), 0.42, -0.34], n: [-1, 0.45, -0.25], len: 0.78 },
      quote: { p: [AT + F, 0.42, 0.34], n: [1, 0.45, 0.25], len: 0.78 },
      axle: { p: [0, 0.03, -0.085], n: [0, 0.5, -1], len: 1.34 },
      "base-rim": { p: [-AT, 0.92, 0.39], n: [-0.3, 1, 0.42], len: 0.5 },
      "quote-rim": { p: [AT, 0.92, -0.39], n: [0.3, 1, -0.42], len: 0.5 },
      "axle-back": { p: [0, 0.03, 0.085], n: [0, 0.5, 1], len: 1.34 },
    },
  };
}

/* ── metals: a cast bar ─────────────────────────────────────────────────── */

function metals(): Scene {
  const H = 0.62;
  const b = new Builder();
  bevelBox(b, 0, 0, 0, 2.5, H, 1.14, 0.06, 0, 1, 0, 0.8);
  // the hallmark panel, struck into the top: a recess, its edge, and two lines of lettering
  const top = H / 2 + 0.003;
  b.decal({ kind: "poly", pts: rectPts([0, top, 0], X, NZ, 0.66, 0.27), n: Y, mat: 0, lift: -7, stroke: 0, alpha: 1 });
  b.decal({ kind: "poly", pts: rectPts([0, top, 0], X, NZ, 0.66, 0.27), n: Y, mat: 0, lift: 12, stroke: 0.012, alpha: 0.9 });
  b.decal({ kind: "text", text: "XAU", o: [0, top, 0.06], u: X, v: NZ, n: Y, size: 0.2, mat: 0, lift: 14, alpha: 1 });
  b.decal({ kind: "text", text: "TROY OUNCE", o: [0, top, -0.14], u: X, v: NZ, n: Y, size: 0.062, mat: 0, lift: 12, alpha: 0.95 });
  return {
    parts: [b.part()],
    mats: [
      { tone: "gold", spec: 0.5, gloss: 12 },
      { tone: "gold", with: "ink", mix: 0.28, spec: 0.6, gloss: 8 },
    ],
    floor: -H / 2,
    footprint: rect(-1.25, 1.25, -0.57, 0.57),
    ring: 1.75,
    rx: 2.05,
    ry: 1.25,
    yaw: -0.55,
    pitch: 0.5,
    anchors: {
      hallmark: { p: [0.42, H / 2, 0.02], n: [0.25, 1, 0.1], len: 0.8 },
      front: { p: [-0.45, 0, -0.51], n: [-0.15, 0.55, -1], len: 0.74 },
      end: { p: [1.12, 0, 0], n: [1, 0.55, 0], len: 0.62 },
      back: { p: [0.45, 0, 0.51], n: [0.15, 0.55, 1], len: 0.74 },
      "far-end": { p: [-1.12, 0, 0], n: [-1, 0.55, 0], len: 0.62 },
      corner: { p: [-0.72, H / 2, -0.18], n: [-0.3, 1, -0.15], len: 0.6 },
    },
  };
}

/* ── indices: a column of blocks ────────────────────────────────────────── */

function indices(): Scene {
  // width, height, depth, turn about the axis, material: bottom to top
  const blocks = [
    [1.9, 0.3, 1.9, 0, 2],
    [1.3, 0.5, 1.5, 0.35, 0],
    [1.66, 0.24, 1.1, 0.12, 4],
    [1.0, 0.56, 1.0, 0.6, 0],
    [1.3, 0.26, 1.3, 0.25, 2],
    [0.66, 0.44, 0.66, 0, 0],
  ] as const;
  const total = blocks.reduce((s, k) => s + k[1], 0);
  const parts: Part[] = [];
  const mid: number[] = [];
  let y = -total / 2;
  for (const [w, h, d, rot, mat] of blocks) {
    const b = new Builder();
    bevelBox(b, 0, y + h / 2, 0, w, h, d, 0.035, mat, mat + 1, rot);
    parts.push(b.part());
    mid.push(y + h / 2);
    y += h;
  }
  /** a point in the middle of one side of a block, and the way out from it */
  const side = (i: number, lx: number, lz: number, up: number, len: number): Anchor => {
    const [w, , d, rot] = blocks[i];
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const x = (lx * w) / 2;
    const z = (lz * d) / 2;
    return { p: [x * cr + z * sr, mid[i], -x * sr + z * cr], n: [lx * cr + lz * sr, up, -lx * sr + lz * cr], len };
  };
  return {
    parts,
    mats: [
      { tone: "teal", spec: 0.34, gloss: 12 },
      { tone: "teal", with: "ink", mix: 0.32, spec: 0.5, gloss: 8 },
      { tone: "ink3", with: "teal", mix: 0.2, dim: 0.2, spec: 0.3, gloss: 10 },
      { tone: "ink3", with: "ink", mix: 0.3, spec: 0.5, gloss: 8 },
      { tone: "teal", dim: 0.36, spec: 0.3, gloss: 12 },
      { tone: "teal", with: "ink", mix: 0.15, spec: 0.5, gloss: 8 },
    ],
    floor: -total / 2,
    footprint: rect(-0.95, 0.95, -0.95, 0.95),
    ring: 1.75,
    rx: 1.95,
    ry: 1.95,
    yaw: -0.62,
    pitch: 0.34,
    anchors: {
      top: { p: [0.05, total / 2, 0], n: [0.3, 1, -0.1], len: 0.55 },
      "block-2": side(1, 0, -1, 0.3, 0.78),
      "block-4": side(3, 1, 0, 0.35, 0.8),
      "block-1": side(0, 0, 1, 0.5, 0.6),
      "block-3": side(2, -1, 0, 0.3, 0.62),
      "block-5": side(4, 0, 1, 0.45, 0.72),
    },
  };
}

/* ── energy: a barrel ───────────────────────────────────────────────────── */

function energy(): Scene {
  const R = 0.8;
  const HH = 1.1;
  const LID = HH - 0.08;
  // rim, body, hoop, body, hoop, body, rim: traced from the middle of the lid to the middle of the base
  const profile = [
    0, LID, 0.7, LID, 0.7, HH, R, HH, 0.83, HH - 0.03, 0.83, HH - 0.1, R, HH - 0.13,
    R, 0.46, 0.84, 0.43, 0.84, 0.35, R, 0.32,
    R, -0.32, 0.84, -0.35, 0.84, -0.43, R, -0.46,
    R, -(HH - 0.13), 0.83, -(HH - 0.1), 0.83, -(HH - 0.03), R, -HH, 0, -HH,
  ];
  const body = new Set([6, 10, 14]);
  const b = new Builder();
  lathe(b, "y", 0, 0, 0, 36, profile, (band) => (band === 0 || band === 18 ? 2 : body.has(band) ? 0 : 1));
  const parts = [b.part()];
  for (const [x, z, r] of [
    [0.4, 0.05, 0.13],
    [-0.42, -0.12, 0.075],
  ]) {
    const g = new Builder();
    lathe(g, "y", x, LID, z, 14, [0, 0.06, r * 0.6, 0.06, r, 0.04, r, 0, 0, 0], () => 3);
    // a bung stands on the lid: it is always painted after the barrel
    parts.push(g.part(0, -10));
  }
  const at = (deg: number, y: number, r: number, up: number, len: number): Anchor => {
    const a = (deg * Math.PI) / 180;
    return { p: [Math.cos(a) * r, y, Math.sin(a) * r], n: [Math.cos(a), up, Math.sin(a)], len };
  };
  return {
    parts,
    mats: [
      { tone: "ink3", with: "accent", mix: 0.34, dim: 0.12, spec: 0.3, gloss: 9 },
      { tone: "platinum", with: "ink", mix: 0.2, spec: 0.5, gloss: 10 },
      { tone: "ink3", with: "accent", mix: 0.3, dim: 0.34, spec: 0.3, gloss: 14 },
      { tone: "gold", spec: 0.5, gloss: 10 },
    ],
    floor: -HH,
    footprint: disc(0.84),
    ring: 1.5,
    rx: 1.7,
    ry: 1.95,
    yaw: -0.4,
    pitch: 0.4,
    anchors: {
      lid: { p: [-0.05, LID, -0.3], n: [-0.12, 1, -0.3], len: 0.72 },
      body: at(-90, 0, R, 0.2, 0.74),
      upper: at(-25, 0.72, R, 0.3, 0.62),
      hoop: at(40, -0.39, 0.84, 0.1, 0.62),
      "body-back": at(115, 0.02, R, 0.25, 0.7),
      lower: at(190, -0.72, R, 0, 0.62),
    },
  };
}

/* ── equities: a share, a pane of glass, and its outline ────────────────── */

function equities(): Scene {
  const W = 1.2;
  const H = 1.56;
  const D = 0.2;
  const AT = 0.88;
  const share = new Builder();
  bevelBox(share, -AT, 0, 0, W, H, D, 0.035, 0, 1);
  const front = -D / 2 - 0.003;
  // the certificate's face: a ruled frame, its title, lines of text and a seal
  share.decal({ kind: "poly", pts: rectPts([-AT, 0, front], X, NY, 0.48, 0.66), n: NZ, mat: 1, lift: 6, stroke: 0.014, alpha: 0.9 });
  share.decal({ kind: "text", text: "SHARE", o: [-AT, 0.43, front], u: X, v: NY, n: NZ, size: 0.13, mat: 1, lift: 14, alpha: 1 });
  for (let i = 0; i < 4; i++) {
    const half = i === 3 ? 0.2 : 0.36;
    share.decal({ kind: "poly", pts: rectPts([-AT - (0.36 - half), 0.2 - i * 0.13, front], X, NY, half, 0.011), n: NZ, mat: 1, lift: 4, stroke: 0, alpha: 0.6 });
  }
  share.decal({ kind: "poly", pts: circlePts([-AT + 0.24, -0.42, front], X, Y, 0.13, 24), n: NZ, mat: 4, lift: 0, stroke: 0, alpha: 1 });
  share.decal({ kind: "poly", pts: circlePts([-AT + 0.24, -0.42, front], X, Y, 0.085, 20), n: NZ, mat: 4, lift: -12, stroke: 0.012, alpha: 0.9 });
  share.decal({ kind: "poly", pts: rectPts([-AT, 0, -front], NX, NY, 0.48, 0.66), n: Z, mat: 1, lift: 6, stroke: 0.014, alpha: 0.9 });

  const glass = new Builder();
  bevelBox(glass, 0, 0.11, 0, 0.05, H + 0.22, 1.36, 0.012, 2, 2);

  // the mirror image: the same shape with nothing inside it, the frame reversed, and the product's name
  const cfd = new Builder();
  bevelBox(cfd, AT, 0, 0, W, H, D, 0.035, 3, 3);
  cfd.decal({ kind: "poly", pts: rectPts([AT, 0, front], X, NY, 0.48, 0.66), n: NZ, mat: 3, lift: 8, stroke: 0.01, alpha: 0.6 });
  cfd.decal({ kind: "text", text: "CFD", o: [AT, 0.43, front], u: X, v: NY, n: NZ, size: 0.13, mat: 3, lift: 14, alpha: 0.95 });
  cfd.decal({ kind: "poly", pts: circlePts([AT - 0.24, -0.42, front], X, Y, 0.13, 24), n: NZ, mat: 3, lift: 8, stroke: 0.01, alpha: 0.6 });

  return {
    parts: [share.part(), glass.part(GLASS), cfd.part(GHOST)],
    mats: [
      { tone: "accent", dim: 0.3, spec: 0.3, gloss: 9 },
      { tone: "accent", with: "ink", mix: 0.42, spec: 0.5, gloss: 8 },
      { tone: "ink", spec: 0.6, gloss: 20 },
      { tone: "accent", with: "ink", mix: 0.3, spec: 0.2, gloss: 8 },
      { tone: "gold", spec: 0.5, gloss: 10 },
    ],
    floor: -H / 2,
    footprint: rect(-AT - W / 2, AT + W / 2, -0.3, 0.3),
    ring: 2.05,
    rx: 2.3,
    ry: 1.55,
    yaw: -0.5,
    pitch: 0.26,
    anchors: {
      share: { p: [-AT - 0.3, 0.56, -D / 2], n: [-0.55, 0.55, -1], len: 0.7 },
      cfd: { p: [AT + 0.3, 0.56, -D / 2], n: [0.55, 0.55, -1], len: 0.7 },
      "share-back": { p: [-AT, -0.1, D / 2], n: [-0.35, 0.3, 1], len: 0.74 },
      glass: { p: [0, H / 2 + 0.22, 0.25], n: [0, 1, 0.35], len: 0.46 },
      "cfd-back": { p: [AT, -0.1, D / 2], n: [0.35, 0.3, 1], len: 0.74 },
      "share-edge": { p: [-AT - W / 2, -0.35, 0], n: [-1, 0.2, -0.2], len: 0.5 },
    },
  };
}

/* ── crypto: a chain of blocks ──────────────────────────────────────────── */

function crypto(): Scene {
  const S = 0.92;
  const GAP = 1.44;
  const parts: Part[] = [];
  const face = S / 2 + 0.003;
  for (let i = -1; i <= 1; i++) {
    const x = i * GAP;
    const b = new Builder();
    bevelBox(b, x, 0, 0, S, S, S, 0.05, 0, 1);
    // what a block holds, without a word of it: a panel struck into each open face, and a few ruled entries
    for (const s of [-1, 1]) {
      const n = s < 0 ? NZ : Z;
      const u = s < 0 ? X : NX;
      b.decal({ kind: "poly", pts: rectPts([x, 0, s * face], u, NY, 0.3, 0.3), n, mat: 0, lift: -8, stroke: 0, alpha: 1 });
      b.decal({ kind: "poly", pts: rectPts([x, 0, s * face], u, NY, 0.3, 0.3), n, mat: 1, lift: 6, stroke: 0.01, alpha: 0.8 });
      for (let k = 0; k < 3; k++) {
        const half = k === 2 ? 0.11 : 0.2;
        const ox = x - (s < 0 ? 1 : -1) * (0.2 - half);
        b.decal({ kind: "poly", pts: rectPts([ox, 0.14 - k * 0.14, s * face], u, NY, half, 0.014), n, mat: 1, lift: 8, stroke: 0, alpha: 0.75 });
      }
    }
    b.decal({ kind: "poly", pts: rectPts([x, face, 0], X, NZ, 0.3, 0.3), n: Y, mat: 0, lift: -8, stroke: 0, alpha: 1 });
    b.decal({ kind: "poly", pts: rectPts([x, face, 0], X, NZ, 0.3, 0.3), n: Y, mat: 1, lift: 6, stroke: 0.01, alpha: 0.8 });
    parts.push(b.part());
  }
  // a link: a bar from each block into a collar. Three convex pieces in a row, so they sort cleanly.
  const bar = (GAP - S) / 2 - 0.07;
  for (const s of [-1, 1]) {
    const mid = (s * GAP) / 2;
    const pieces: [number, number, number, number][] = [
      [mid - 0.07 - bar / 2, bar, 0.2, 2],
      [mid, 0.14, 0.34, 3],
      [mid + 0.07 + bar / 2, bar, 0.2, 2],
      // the chain goes on past the last block
      [s * (GAP + S / 2 + 0.13), 0.26, 0.2, 2],
    ];
    for (const [x, w, t, mat] of pieces) {
      const b = new Builder();
      bevelBox(b, x, 0, 0, w, t, t, 0.03, mat, mat);
      parts.push(b.part());
    }
  }
  const edge = GAP + S / 2;
  return {
    parts,
    mats: [
      { tone: "emerald", spec: 0.36, gloss: 12 },
      { tone: "emerald", with: "ink", mix: 0.34, spec: 0.5, gloss: 8 },
      { tone: "ink3", with: "platinum", mix: 0.4, spec: 0.4, gloss: 10 },
      { tone: "platinum", with: "ink", mix: 0.3, spec: 0.5, gloss: 10 },
    ],
    floor: -S / 2,
    footprint: rect(-edge - 0.26, edge + 0.26, -S / 2, S / 2),
    ring: 2.3,
    rx: 2.55,
    ry: 1.3,
    yaw: -0.5,
    pitch: 0.4,
    anchors: {
      "first-top": { p: [-GAP, S / 2, 0.05], n: [-0.2, 1, 0.1], len: 0.62 },
      "middle-front": { p: [0.1, 0.3, -S / 2], n: [0.1, 0.75, -1], len: 0.7 },
      "last-top": { p: [GAP, S / 2, -0.05], n: [0.2, 1, -0.1], len: 0.62 },
      "last-front": { p: [GAP + 0.2, -0.05, -S / 2], n: [0.45, 0.3, -1], len: 0.66 },
      "middle-back": { p: [-0.1, 0.3, S / 2], n: [-0.1, 0.75, 1], len: 0.7 },
      "first-back": { p: [-GAP - 0.2, -0.05, S / 2], n: [-0.45, 0.3, 1], len: 0.66 },
    },
  };
}

const BUILD: Record<RoundKind, () => Scene> = { forex, metals, indices, energy, equities, crypto };

/** Build the object for a class. Called once, in the browser, when its picture is mounted. */
export const buildScene = (kind: RoundKind): Scene => BUILD[kind]();

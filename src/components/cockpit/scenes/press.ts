/**
 * PRESS — a rotary press, in miniature.
 *
 * The media page is where the house says how it is to be written about, so its
 * instrument is the machine that does the writing. A reel of paper feeds a web
 * under the engraved plate cylinder, through the nip, over the impression
 * cylinder and round a guide roller; a knife cuts it, and the sheets settle on a
 * delivery tray. The web is blank before the nip and carries its lines after
 * it. Every sheet is the same sheet: that is the point of a press, and of an
 * approved description.
 *
 * The pointer is the pressman's hand. While it is over the frame the press runs
 * up to speed; the cylinder nearest the cursor lights, its engraving showing in
 * champagne; and over the tray the top sheets lift off the pile and tip their
 * faces to the viewer.
 *
 * Lines of text are strokes. Nothing here can be read, counted or dated.
 */
import { TAU, clamp, easeInOut, lerp, type Frame, type Scene, type V3 } from "../engine";
import { box, deck, lamp, pool, ring } from "../kit";

const FLOOR = -0.79;
/** half the length of a cylinder, and half the width of the web */
const ZH = 0.5;
const ZW = 0.4;
/** the delivery: height of the run, the knife, one sheet's length, where the pile stands */
const YB = -0.37;
const XC = 0.7;
const LS = 0.6;
const XS = 0.88;
const TRAY = -0.68;
const PILE = 8;
const LEAF = 0.013;
/** the printed lines on a sheet, measured back from its leading edge; the first is the heavier heading stroke */
const LINES = [0.09, 0.17, 0.23, 0.29, 0.35, 0.41, 0.47, 0.53];

type Kind = "reel" | "plate" | "plain";
/** a cylinder: axis position, radius, which way the web turns it (1 anticlockwise), what it is */
type Drum = { x: number; y: number; r: number; turn: number; kind: Kind };
/** a piece of the web in side elevation; `n` is set where it lies on a cylinder (it can only be seen from outside) */
type Seg = { a: [number, number]; b: [number, number]; n: [number, number] | null; d: number; len: number; stage: number };
type State = { segs: Seg[]; cut: number; nip: number; travel: number; speed: number };
type View = { x: number; y: number };

const REEL: Drum = { x: -1.3, y: -0.26, r: 0.4, turn: -1, kind: "reel" };
const PLATE: Drum = { x: -0.45, y: 0.66, r: 0.36, turn: 1, kind: "plate" };
const NIP = -0.73;
const IMPR: Drum = { x: PLATE.x + Math.cos(NIP) * 0.72, y: PLATE.y + Math.sin(NIP) * 0.72, r: 0.36, turn: -1, kind: "plate" };
const GUIDE: Drum = { x: IMPR.x + IMPR.r + 0.11, y: YB + 0.11, r: 0.11, turn: 1, kind: "plain" };

/** thread the web: reel, under the plate cylinder, through the nip, over the impression cylinder, round the guide, out to the knife */
function thread(fine: number): Pick<State, "segs" | "cut" | "nip"> {
  const segs: Seg[] = [];
  let d = 0;
  let nip = 0;
  const add = (a: [number, number], b: [number, number], n: [number, number] | null, stage: number) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, n, d, len, stage });
    d += len;
  };
  const wrap = (c: Drum, from: number, to: number, stage: number) => {
    const steps = Math.max(2, Math.round((Math.abs(to - from) / TAU) * fine));
    for (let i = 0; i < steps; i++) {
      const a0 = lerp(from, to, i / steps);
      const a1 = lerp(from, to, (i + 1) / steps);
      const am = (a0 + a1) / 2;
      add([c.x + Math.cos(a0) * c.r, c.y + Math.sin(a0) * c.r], [c.x + Math.cos(a1) * c.r, c.y + Math.sin(a1) * c.r], [Math.cos(am), Math.sin(am)], stage);
    }
  };
  // the straight run from the top of the reel to the underside of the plate cylinder: a crossed tangent
  const dx = PLATE.x - REEL.x;
  const dy = PLATE.y - REEL.y;
  const th = Math.atan2(dy, dx) + Math.asin(-(PLATE.r + REEL.r) / Math.hypot(dx, dy));
  const lx = -Math.sin(th);
  const ly = Math.cos(th);
  add([REEL.x + lx * REEL.r, REEL.y + ly * REEL.r], [PLATE.x - lx * PLATE.r, PLATE.y - ly * PLATE.r], null, 0);
  wrap(PLATE, Math.atan2(-ly, -lx), NIP, 1);
  nip = d;
  wrap(IMPR, NIP + Math.PI, 0, 2);
  add([IMPR.x + IMPR.r, IMPR.y], [GUIDE.x - GUIDE.r, GUIDE.y], null, 3);
  wrap(GUIDE, Math.PI, Math.PI * 1.5, 4);
  add([GUIDE.x, YB], [XC, YB], null, 5);
  return { segs, cut: d, nip };
}

/** a cylinder on its journals: the part of the barrel that faces the viewer, its engraving, then the near end */
function drum(f: Frame, v: View, d: Drum, rot: number, on: number, lit: number): void {
  if (on <= 0.003) return;
  const { pal } = f;
  const n = f.mobile ? 18 : 28;
  const at = (a: number, z: number, k = 1): V3 => [d.x + Math.cos(a) * d.r * k, d.y + Math.sin(a) * d.r * k, z];
  const faces = (a: number) => Math.cos(a) * (v.x - d.x) + Math.sin(a) * (v.y - d.y) - d.r;
  const paper = d.kind === "reel";
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU;
    const a1 = ((i + 1) / n) * TAU;
    const am = (a0 + a1) / 2;
    if (faces(am) <= 0) continue;
    const quad: V3[] = [at(a0, -ZH), at(a1, -ZH), at(a1, ZH), at(a0, ZH)];
    // turned metal (or wound paper): brightest where the barrel faces the lamp above it
    const shade = Math.pow(clamp(Math.cos(am - 1.2)), 3);
    f.fill(quad, pal.bg, 0.97 * on);
    f.fill(quad, pal.ink, (paper ? 0.2 + 0.34 * shade : 0.05 + 0.24 * shade) * on);
    if (lit > 0.01) f.fill(quad, pal.gold, (0.07 + 0.16 * shade) * lit * on);
  }
  // the engraving: rows of strokes along the barrel, carried round as it turns
  if (d.kind === "plate") {
    const rows = Math.round((f.mobile ? 12 : 20) * f.q);
    for (let j = 0; j < rows; j++) {
      const a = rot + (j / rows) * TAU;
      const facing = clamp(faces(a) / 2.2);
      if (facing <= 0.02) continue;
      const alpha = (0.3 + 0.6 * lit) * facing * on;
      let z = -ZW * 0.9;
      for (let w = 0; w < 3; w++) {
        const len = 0.12 + 0.2 * f.rnd(j * 5 + w);
        if (j % 5 !== 4 || w === 0) f.line(at(a, z, 1.004), at(a, Math.min(ZW * 0.9, z + len), 1.004), pal.gold, alpha, j % 5 === 0 ? 1.75 : 1);
        z += len + 0.05;
      }
    }
  }
  // the near end: a machined face, a bolt circle that shows it turning, and the journal
  const c: V3 = [d.x, d.y, -ZH];
  const face: V3[] = [];
  for (let i = 0; i < n; i++) face.push(at((i / n) * TAU, -ZH));
  f.fill(face, pal.bg, 0.97 * on);
  f.fill(face, pal.ink, (paper ? 0.2 : 0.07) * on);
  if (lit > 0.01) f.fill(face, pal.gold, 0.08 * lit * on);
  ring(f, c, d.r, { axis: "z", colour: pal.ink, alpha: 0.5 * on, width: 1.25, seg: n * 2 });
  ring(f, c, d.r, { axis: "z", colour: pal.gold, alpha: 0.95 * lit * on, width: 1.75, seg: n * 2 });
  ring(f, c, d.r, { axis: "z", colour: pal.key, alpha: 0.6 * on * (1 - lit), from: 0.1, to: 0.36, width: 1.5, seg: n * 2 });
  if (d.r > 0.2) {
    if (paper) for (const k of [0.84, 0.68, 0.52]) ring(f, c, d.r * k, { axis: "z", colour: pal.bg, alpha: 0.5 * on, seg: n });
    else ring(f, c, d.r * 0.56, { axis: "z", colour: pal.ink, alpha: 0.26 * on, seg: n });
    const bolts = paper ? 3 : 6;
    for (let k = 0; k < bolts; k++) {
      const a = rot + (k * TAU) / bolts;
      if (paper) f.line(at(a, -ZH, 0.2), at(a, -ZH, 0.36), pal.ink, 0.4 * on, 1.5);
      else f.dot(at(a, -ZH, 0.78), d.r * 0.05, d.kind === "plate" ? pal.gold : pal.ink, (0.5 + 0.5 * lit) * on);
    }
    f.dot(c, d.r * 0.2, pal.bg, on);
    ring(f, c, d.r * 0.2, { axis: "z", colour: pal.ink, alpha: 0.5 * on, seg: 18 });
  }
  lamp(f, c, lit > 0.3 ? pal.gold : pal.key, on * (0.5 + 0.5 * lit), d.r > 0.2 ? 0.02 : 0.013);
}

/** a cut sheet lying at height y, its far edge raised by `tip`: paper, an edge, and the same lines as every other sheet */
function sheet(f: Frame, x0: number, y: number, tip: number, level: number, printed: boolean): void {
  if (level <= 0.003) return;
  const { pal } = f;
  const p = (x: number, z: number): V3 => [x, y + tip * (0.5 + z / (2 * ZW)), z];
  const quad: V3[] = [p(x0, -ZW), p(x0 + LS, -ZW), p(x0 + LS, ZW), p(x0, ZW)];
  f.fill(quad, pal.bg, 0.95 * level);
  f.fill(quad, pal.ink, 0.5 * level);
  f.path(quad, pal.ink, 0.6 * level, 1, true);
  if (!printed) return;
  LINES.forEach((off, l) => {
    const x = x0 + LS - off;
    f.line(p(x, -ZW * 0.8), p(x, lerp(-ZW * 0.8, ZW * 0.8, l ? 0.55 + 0.45 * f.rnd(40 + l) : 0.5)), pal.bg, 0.8 * level, l ? 1 : 2.25);
  });
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    return { ...thread(f.mobile ? 30 : 44), travel: LS * 0.42, speed: 0 };
  },
  draw(f, s) {
    const { pal } = f;
    // looked down upon a little, so the faces of the web and of the sheets show
    f.aim(0.55 + (f.still ? 0 : Math.sin(f.t * 0.07) * 0.04), -0.24, 6.4, f.mobile ? 0.92 : 0.94);
    const { yaw, pitch, dist } = f.cam;
    const v: View = { x: dist * Math.cos(pitch) * Math.sin(yaw), y: -dist * Math.sin(pitch) };

    // ── the pressman's hand: over the frame the press runs up to speed, and eases back when it leaves
    const threaded = f.on(0.5, 0.4);
    const ease = f.still ? 1 : 1 - Math.exp(-f.dt * 2.2);
    s.speed += (lerp(0.07, 0.62, f.hover) * threaded - s.speed) * ease;
    if (!f.still) s.travel += s.speed * f.dt;
    const ph = (s.travel % LS) / LS;
    const rot = (d: Drum) => (d.turn * s.travel) / d.r;
    const lit = [REEL, PLATE, IMPR, GUIDE].map((d) => f.near([d.x, d.y, -ZH], f.u * (0.55 + d.r)));

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [-0.2, FLOOR, 0], 2.5, pal.key, 0.2 * f.boot);

    // ── the far side frame: the cylinders hang on it; the near one is left off, as in a cutaway
    const built = f.on(0, 0.3);
    const zf = ZH + 0.07;
    const side: V3[] = [[-0.92, FLOOR, zf], [-0.92, 0.78, zf], [-0.7, 1.07, zf], [-0.2, 1.07, zf], [0.68, 0.38, zf], [0.8, -0.12, zf], [0.8, FLOOR, zf]];
    f.fill(side, pal.bg, 0.6 * built);
    f.fill(side, pal.ink, 0.035 * built);
    f.path(side, pal.ink, 0.2 * built, 1, true);
    f.path([side[1], side[2], side[3], side[4]], pal.key, 0.36 * built, 1.25);

    // ── the web, piece by piece between the cylinders it runs on
    const lead = XC + ph * LS;
    const marks: { d: number; l: number }[] = [];
    for (let edge = s.cut + ph * LS; edge > s.nip; edge -= LS) LINES.forEach((off, l) => marks.push({ d: edge - off, l }));
    const web = (stage: number) => {
      for (const g of s.segs) {
        if (g.stage !== stage || g.d / s.cut > threaded) continue;
        const bx = stage === 5 ? lead : g.b[0];
        const len = stage === 5 ? lead - g.a[0] : g.len;
        const mx = (g.a[0] + bx) / 2;
        const my = (g.a[1] + g.b[1]) / 2;
        if (g.n && g.n[0] * (v.x - mx) + g.n[1] * (v.y - my) <= 0) continue;
        const quad: V3[] = [[g.a[0], g.a[1], -ZW], [bx, g.b[1], -ZW], [bx, g.b[1], ZW], [g.a[0], g.a[1], ZW]];
        const shade = g.n ? Math.pow(clamp(g.n[0] * 0.36 + g.n[1] * 0.93), 2) : 0.7;
        f.fill(quad, pal.bg, 0.95);
        f.fill(quad, pal.ink, 0.3 + 0.26 * shade);
        f.line(quad[0], quad[1], pal.ink, 0.75, 1);
        f.line(quad[3], quad[2], pal.ink, 0.4, 1);
        if (g.d < s.nip) continue;
        // what the plate has left on it
        for (const { d, l } of marks) {
          const at = d - g.d;
          if (at < 0 || at >= len) continue;
          const x = lerp(g.a[0], bx, at / len);
          const y = lerp(g.a[1], g.b[1], at / len);
          f.line([x, y, -ZW * 0.8], [x, y, lerp(-ZW * 0.8, ZW * 0.8, l ? 0.55 + 0.45 * f.rnd(40 + l) : 0.5)], pal.bg, 0.8, l ? 1 : 2.25);
        }
      }
    };

    // the reel on its stand
    const reelOn = f.on(0.1, 0.3);
    for (const z of [ZH + 0.05, -ZH - 0.05]) {
      if (z < 0) {
        drum(f, v, REEL, rot(REEL), reelOn, lit[0]);
        web(0);
      }
      f.line([REEL.x, REEL.y, z], [REEL.x - 0.26, FLOOR, z], pal.ink, 0.4 * reelOn, 1.5);
      f.line([REEL.x, REEL.y, z], [REEL.x + 0.26, FLOOR, z], pal.ink, 0.4 * reelOn, 1.5);
    }
    drum(f, v, PLATE, rot(PLATE), f.on(0.22, 0.3), lit[1]);
    web(1);
    drum(f, v, IMPR, rot(IMPR), f.on(0.34, 0.3), lit[2]);
    web(2);
    web(3);
    drum(f, v, GUIDE, rot(GUIDE), f.on(0.46, 0.3), lit[3]);

    // ── the knife: a bar over the run; it catches the light each time a sheet is parted
    const out = f.on(0.85, 0.3);
    const zk = ZW + 0.09;
    const bar = YB + 0.1;
    f.line([XC, FLOOR, zk], [XC, bar, zk], pal.ink, 0.36 * out, 1.5);
    web(5);
    f.line([XC, bar, zk], [XC, bar, -zk], pal.ink, 0.6 * out, 2.5);
    f.line([XC, bar - 0.035, ZW], [XC, bar - 0.035, -ZW], pal.gold, (0.3 + 0.7 * Math.pow(1 - ph, 4)) * out, 1.25);
    f.line([XC, FLOOR, -zk], [XC, bar, -zk], pal.ink, 0.5 * out, 1.5);

    // ── the delivery tray and its pile; under the pointer the top sheets lift and tip their faces up
    box(f, [XS - 0.07, TRAY - 0.05, -zk], [XS + LS + 0.07, TRAY, zk], pal.ink, 0.42 * out, 0.1 * out);
    for (const x of [XS, XS + LS]) for (const z of [zk - 0.06, 0.06 - zk]) f.line([x, TRAY - 0.05, z], [x, FLOOR, z], pal.ink, 0.3 * out, 1.5);
    f.line([XS - 0.07, TRAY, -zk], [XS + LS + 0.07, TRAY, -zk], pal.key, 0.6 * out, 1.25);
    const top = TRAY + PILE * LEAF;
    const pick = f.near([XS + LS / 2, top, 0], f.u * 0.95);
    const fall = easeInOut(ph);
    for (let i = 0; i < PILE; i++) {
      const j = PILE - 1 - i;
      const k = j < 3 ? pick * (1 - j * 0.3) : 0;
      const jog = (f.rnd(60 + i) - 0.5) * 0.03;
      // the sheet just cut settles onto the pile beneath any that are held up
      if (j === 2 && pick > 0.01) sheet(f, lerp(XC, XS, fall), lerp(YB, top, fall), 0, out, true);
      sheet(f, XS + (j ? jog : 0), TRAY + (i + 1) * LEAF + k * (0.2 + (2 - j) * 0.13), k * 0.2, out, j < 3);
    }
    if (pick <= 0.01) sheet(f, lerp(XC, XS, fall), lerp(YB, top, fall), 0, out, true);
    if (pick > 0.01) pool(f, [XS + LS / 2, top, 0], 0.6, pal.gold, 0.3 * pick);
  },
};

export default scene;

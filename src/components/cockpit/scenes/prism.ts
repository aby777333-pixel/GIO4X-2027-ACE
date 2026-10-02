/**
 * PRISM — what we disclose.
 *
 * An optical bench: a prism of clear glass on a pedestal, a graduated circle
 * behind it, a small lamp to the left and a ruled board to the right. One
 * beam goes in. It comes out as an ordered fan of separate bands, and each
 * band lands on a row of the board of its own and lights it. That is the page:
 * one firm, taken apart into every item a client would look for, each on its
 * own line where it can be read.
 *
 * The rows carry strokes, never figures, and the scene does not say which
 * items are published: the table under the stage does that.
 *
 * The pointer holds the lamp. The beam starts at the cursor, so moving it
 * changes the angle at which the light enters the glass; the fan swings the
 * other way, as it would, and sweeps down or up the board, lighting the rows
 * it lands on. With the pointer away the lamp rocks slowly by itself.
 */
import { TAU, clamp, lerp, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, panel, pool, ring, trace } from "../kit";

const FLOOR = -1.2;
/** the prism: where its base stands, its half-width, height and half-depth */
const PX = -0.14;
const PY = -0.52;
const HW = 0.57;
const HT = 0.96;
const HD = 0.26;
/** the three corners of its section, the point the beam enters at and the lamp's own place */
const A: readonly [number, number] = [PX - HW, PY];
const B: readonly [number, number] = [PX + HW, PY];
const C: readonly [number, number] = [PX, PY + HT];
const E: readonly [number, number] = [lerp(A[0], C[0], 0.44), lerp(A[1], C[1], 0.44)];
const LAMP_X = -1.68;
/** the angle of entry the bench is set up for */
const REST = 0.28;

type State = { width: number[]; c: number; placed: boolean };

/** where the pointer's line of sight meets the plane of the beam (z = 0), as [x, y] */
function pick(f: Frame): readonly [number, number] | null {
  const { yaw, pitch, dist, zoom } = f.cam;
  const a = (f.mx - f.cx) / (f.u * dist * zoom);
  const b = (f.cy - f.my) / (f.u * dist * zoom);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  // the sight line is origin + depth * direction, both turned from the camera's axes into the world's
  const oz = -dist * cp * cy;
  const dz = a * sy + (cp - b * sp) * cy;
  if (Math.abs(dz) < 1e-4) return null;
  const depth = -oz / dz;
  if (depth < 0.35) return null;
  const z1 = -b * depth * sp + (depth - dist) * cp;
  return [a * depth * cy - z1 * sy, b * depth * cp + (depth - dist) * sp];
}

/** a machined block on the bench: the side turned to the viewer, the front and the top */
function block(f: Frame, x0: number, x1: number, y0: number, y1: number, hz: number, on: number): void {
  if (on <= 0.003) return;
  const { pal } = f;
  const faces: [V3[], number][] = [
    [[[x0, y0, hz], [x0, y0, -hz], [x0, y1, -hz], [x0, y1, hz]], 0.05],
    [[[x0, y0, -hz], [x1, y0, -hz], [x1, y1, -hz], [x0, y1, -hz]], 0.13],
    [[[x0, y1, -hz], [x1, y1, -hz], [x1, y1, hz], [x0, y1, hz]], 0.075],
  ];
  for (const [quad, tone] of faces) {
    f.fill(quad, pal.bg, 0.94 * on);
    f.fill(quad, pal.ink, tone * on);
    f.path(quad, pal.ink, 0.26 * on, 1, true);
  }
}

const scene: Scene<State> = {
  pose: 11,
  setup(f) {
    const rows = f.mobile ? 7 : 9;
    const width: number[] = [];
    for (let r = 0; r < rows; r++) width.push(0.26 + 0.34 * f.rnd(r + 4));
    return { width, c: (rows - 1) / 2, placed: false };
  },
  draw(f, s) {
    const { pal } = f;
    const rows = s.width.length;
    // the bench is seen from a little to the left and a little above: the face the beam enters by is in view
    f.aim(-0.17 + (f.still ? 0 : Math.sin(f.t * 0.06) * 0.03), -0.13, 6.4, 0.95);
    const bands = [pal.gold, pal.emerald, pal.teal, pal.blue, pal.indigo];
    const half = (bands.length - 1) / 2;

    // ── the lamp: rocking slowly on its stand, or carried by the pointer
    const restY = E[1] - 0.37 + (f.still ? 0 : 0.3 * Math.sin(f.t * 0.1));
    const hit = f.hover > 0 ? pick(f) : null;
    // the light can only enter by the face turned to it: right of that face the lamp keeps the pointer's height
    const hy = hit ? clamp(hit[1], FLOOR + 0.12, 1.28) : restY;
    const face = lerp(A[0], C[0], clamp((hy - A[1]) / HT));
    const sx = hit ? lerp(LAMP_X, clamp(hit[0], -2.2, Math.min(face - 0.26, E[0] - 0.12)), f.hover) : LAMP_X;
    const sy = lerp(restY, hy, f.hover);
    const S: V3 = [sx, sy, 0];
    const angle = Math.atan2(E[1] - sy, E[0] - sx);

    // ── the fan: it turns with the beam, so a beam that climbs more steeply lands higher on the board
    const swing = Math.tanh((angle - REST) * 1.5);
    const raw = (rows - 1) / 2 - (rows - 1 - 2 * half) * 0.5 * swing;
    // each band settles on a row of its own: a detent at every line, taken twice so the fan rests between steps
    const detent = (x: number) => x - (0.9 / TAU) * Math.sin(TAU * x);
    const want = detent(detent(raw));
    s.c += (want - s.c) * (s.placed && !f.still ? 1 - Math.exp(-f.dt * 7) : 1);
    s.placed = true;
    const beamOn = f.on(0.5, 0.25);
    const fanOn = f.on(0.72, 0.25);
    const rowOn = f.on(0.95, 0.25);

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [PX, FLOOR, 0], 2.2, pal.key, 0.2 * f.boot);

    // ── the graduated circle behind the glass: an angle can be read off it, and no figure is written on it
    const centre: V3 = [PX, PY + HT * 0.36, HD + 0.26];
    const dialOn = f.on(0.3, 0.4);
    ring(f, centre, 1.08, { axis: "z", colour: pal.ink, alpha: 0.2 * dialOn, ticks: Math.round((f.mobile ? 36 : 72) * f.q), major: 6, tickLen: 0.05, from: 0.02, to: 0.98, rot: Math.PI * 1.5 });
    ring(f, centre, 0.95, { axis: "z", colour: pal.ink, alpha: 0.09 * dialOn, from: 0.02, to: 0.98, rot: Math.PI * 1.5 });
    // its index follows the beam's angle of entry
    const ia = Math.PI + angle;
    f.line([centre[0] + Math.cos(ia) * 0.97, centre[1] + Math.sin(ia) * 0.97, centre[2]], [centre[0] + Math.cos(ia) * 1.14, centre[1] + Math.sin(ia) * 1.14, centre[2]], pal.gold, 0.9 * dialOn * beamOn, 1.75);

    // ── the board: ruled, turned towards the glass, one line for each thing a client would look for
    const boardOn = f.on(0.25, 0.4);
    const pane = panel(f, [1.5, 0.04, 0.06], 0.98, 2.0, { yaw: 0.46, on: boardOn, colour: pal.key, alpha: 0.6, header: true });
    const top = 0.855;
    const dv = (top - 0.04) / rows;
    const rowV = (r: number) => top - (r + 0.5) * dv;
    if (pane.on > 0.003) {
      for (const u of [0.1, 0.9]) f.line(pane.at(u, 0), [pane.at(u, 0)[0], FLOOR, pane.at(u, 0)[2]], pal.ink, 0.4 * boardOn, 1.5);
      f.label("DISCLOSURES", pane.at(0.5, 0.94), { align: "center", size: f.mobile ? 8 : 10, colour: pal.ink, alpha: 0.9 * boardOn });
      f.line(pane.at(0.2, 0.04), pane.at(0.2, top), pal.ink, 0.12 * boardOn, 1);
      for (let r = 0; r < rows; r++) {
        const on = f.on(0.3 + 0.04 * r, 0.25);
        const v = rowV(r);
        // which band, if any, is on this line, and how squarely
        let lit = 0;
        let colour = pal.ink;
        bands.forEach((tone, j) => {
          const k = clamp(1.6 - 2.2 * Math.abs(s.c + j - half - r)) * rowOn;
          if (k > lit) {
            lit = k;
            colour = tone;
          }
        });
        f.line(pane.at(0.05, v - dv / 2), pane.at(0.05 + 0.9 * on, v - dv / 2), pal.ink, 0.2 * boardOn, 1);
        if (lit > 0.01) {
          f.fill([pane.at(0.03, v - dv * 0.44), pane.at(0.97, v - dv * 0.44), pane.at(0.97, v + dv * 0.44), pane.at(0.03, v + dv * 0.44)], colour, 0.2 * lit);
          f.line(pane.at(0.03, v - dv * 0.44), pane.at(0.03, v + dv * 0.44), colour, lit, 2);
        }
        // the entry itself: a stroke for its name, a shorter one for where to read it
        f.line(pane.at(0.26, v), pane.at(0.26 + s.width[r] * on, v), lit > 0.3 ? colour : pal.ink, (0.42 + 0.58 * lit) * on, f.mobile ? 1.5 : 2);
        f.line(pane.at(0.8, v), pane.at(0.8 + 0.1 * on, v), pal.ink, (0.25 + 0.4 * lit) * on, 1);
        f.dot(pane.at(0.125, v), 0.013, lit > 0.3 ? colour : pal.ink, (0.4 + 0.6 * lit) * on);
      }
    }

    // ── the pedestal
    const base = f.on(0, 0.3);
    block(f, PX - 0.5, PX + 0.5, FLOOR, FLOOR + 0.05, 0.36, base);
    block(f, PX - 0.2, PX + 0.2, FLOOR + 0.05, PY - 0.05, 0.16, base);
    block(f, PX - 0.68, PX + 0.68, PY - 0.05, PY - 0.012, 0.34, base);
    f.line([PX - 0.68, PY - 0.012, -0.34], [PX + 0.68, PY - 0.012, -0.34], pal.key, 0.55 * base, 1.25);

    // ── the lamp on its stand; in the hand it is only its light
    const stand = base * (1 - f.hover);
    if (stand > 0.01) {
      f.line([LAMP_X - 0.05, sy - 0.07, 0], [LAMP_X - 0.05, FLOOR, 0], pal.ink, 0.45 * stand, 2);
      ring(f, [LAMP_X - 0.05, FLOOR, 0], 0.14, { colour: pal.ink, alpha: 0.4 * stand, seg: 28 });
      const back: V3 = [sx - Math.cos(angle) * 0.2, sy - Math.sin(angle) * 0.2, 0];
      f.line(back, S, pal.bg, 0.95 * stand, 11);
      f.line(back, S, pal.ink, 0.42 * stand, 9);
      f.line(back, S, pal.bg, 0.8 * stand, 6);
    }
    lamp(f, S, pal.ink, beamOn, 0.02);

    // ── the glass, far faces first; the light is drawn inside it before the near face closes over it
    const glass = f.on(0.18, 0.35);
    const at = (p: readonly [number, number], z: number): V3 => [p[0], p[1] + (1 - glass) * 0.12, z];
    const rear: V3[] = [at(A, HD), at(B, HD), at(C, HD)];
    const near: V3[] = [at(A, -HD), at(B, -HD), at(C, -HD)];
    const entry: V3[] = [at(A, -HD), at(A, HD), at(C, HD), at(C, -HD)];
    f.fill(rear, pal.bg, 0.5 * glass);
    f.fill(rear, pal.key, 0.07 * glass);
    f.path(rear, pal.ink, 0.3 * glass, 1, true);
    f.line(at(B, -HD), at(B, HD), pal.ink, 0.3 * glass, 1);
    f.fill(entry, pal.ink, 0.07 * glass);
    f.fill(entry, pal.key, 0.08 * glass);

    const In: V3 = [lerp(sx, E[0], beamOn), lerp(sy, E[1], beamOn), 0];
    f.path([S, In], pal.key, 0.14 * beamOn, 9);
    trace(f, [S, In], pal.ink, 0.95 * beamOn, 1.7, beamOn >= 1 ? f.t / 3.2 : -1);

    // inside, the beam has begun to part; each band leaves the far face at its own height
    const exit = 0.4 + 0.13 * swing;
    const outs: V3[] = [];
    bands.forEach((tone, j) => {
      const k = clamp(exit + (j - half) * -0.034, 0.08, 0.9);
      const X: V3 = [lerp(B[0], C[0], k), lerp(B[1], C[1], k), 0];
      outs.push(X);
      f.line([E[0], E[1], 0], X, tone, 0.62 * fanOn * glass, 1.25);
    });
    if (fanOn > 0) f.glow([E[0], E[1], 0], 0.13, pal.ink, 0.45 * fanOn);

    f.fill(near, pal.ink, 0.035 * glass);
    f.fill(near, pal.key, 0.06 * glass);
    f.path(near, pal.ink, 0.62 * glass, 1.25, true);
    f.line(at(C, -HD), at(C, HD), pal.ink, 0.5 * glass, 1);
    f.line(at(A, -HD), at(A, HD), pal.ink, 0.4 * glass, 1);
    f.line(at(A, -HD), at(C, -HD), pal.key, 0.9 * glass, 1.5);
    // a bevel inside the near face gives the glass its thickness
    const cx = (A[0] + B[0] + C[0]) / 3;
    const cy = (A[1] + B[1] + C[1]) / 3;
    f.path([A, B, C].map((p): V3 => at([lerp(p[0], cx, 0.13), lerp(p[1], cy, 0.13)], -HD)), pal.ink, 0.13 * glass, 1, true);

    // ── the fan: five bands across the gap, each to its own line
    if (fanOn > 0 && pane.on > 0.003) {
      bands.forEach((tone, j) => {
        const v = top - (s.c + j - half + 0.5) * dv;
        const land = pane.at(0.03, v);
        const X = outs[j];
        const tip: V3 = [lerp(X[0], land[0], fanOn), lerp(X[1], land[1], fanOn), lerp(X[2], land[2], fanOn)];
        trace(f, [X, tip], tone, 0.9, f.mobile ? 1.2 : 1.5);
        if (fanOn >= 1) lamp(f, land, tone, rowOn, 0.014);
      });
    }
  },
};

export default scene;

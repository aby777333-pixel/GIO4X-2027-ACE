/**
 * GATEWAY — the airlock.
 *
 * Six machined portal frames stand in a row on a gangway, each a little smaller
 * than the one before, each glazed with a pair of smoked-glass leaves. The
 * visitor stands at the first threshold and looks down the corridor to a softly
 * lit doorway: somewhere to arrive.
 *
 * Every few seconds a curtain of light walks the corridor from the near frame
 * to the far one. It is a drawing of a verification pass: the leaves part ahead
 * of it, each frame's edge light answers as it goes by, and the doorway warms
 * when it gets there. Nothing here reports a status; the portals themselves are
 * not connected yet, so the instrument only shows the way in.
 *
 *   open-account: three step lamps on the gangway, 01 02 03, lit in order
 *   sign-in:      one round key beside the first frame
 */
import { clamp, easeInOut, easeOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, ring } from "../kit";

/** the corridor's centre line sits off the camera's pivot, so we look down it slightly from one side */
const AXIS = 1.0;
const FLOOR = -1.1;
const DECK = -1.3;
const NEAR = -1.2;
const FAR = 1.2;
const DOOR = 1.62;
const LANDING = NEAR - 0.42;
const PERIOD = 8.5;

const along = (z: number) => (z - NEAR) / (FAR - NEAR);
/** the corridor narrows and lowers toward the far end */
const halfW = (z: number) => lerp(0.88, 0.58, along(z));
const lintel = (z: number) => lerp(1.0, 0.42, along(z));
const barOf = (z: number) => lerp(0.07, 0.04, along(z));
const walkW = (z: number) => halfW(z) * 0.6;

type Hoop = { z: number; k: number; iw: number; top: number; bar: number; depth: number; outer: V3[]; inner: V3[]; rearOuter: V3[]; rearInner: V3[] };
type State = { hoops: Hoop[]; door: V3[] };

/** a rounded rectangle standing across the corridor at depth z */
function rounded(y0: number, y1: number, hw: number, r: number, z: number, n: number): V3[] {
  const pts: V3[] = [];
  const xs = [AXIS + hw - r, AXIS - hw + r, AXIS - hw + r, AXIS + hw - r];
  const ys = [y1 - r, y1 - r, y0 + r, y0 + r];
  for (let c = 0; c < 4; c++)
    for (let i = 0; i <= n; i++) {
      const a = (c + i / n) * Math.PI * 0.5;
      pts.push([xs[c] + Math.cos(a) * r, ys[c] + Math.sin(a) * r, z]);
    }
  return pts;
}

/** add one closed outline to the current path; false if any point is behind the camera */
function sub(f: Frame, pts: readonly V3[], dy = 0): boolean {
  const { ctx } = f;
  for (let i = 0; i < pts.length; i++) {
    const p = f.P(pts[i][0], pts[i][1] + dy, pts[i][2]);
    if (!p) return false;
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.closePath();
  return true;
}

/** fill one or more outlines (even-odd, so two nested outlines make a frame) with each style in turn */
function paint(f: Frame, loops: readonly (readonly V3[])[], dy: number, styles: readonly (string | CanvasGradient)[]): void {
  const { ctx } = f;
  ctx.beginPath();
  for (const l of loops) if (!sub(f, l, dy)) return;
  for (const s of styles) {
    ctx.fillStyle = s;
    ctx.fill("evenodd");
  }
}

function edge(f: Frame, loop: readonly V3[], dy: number, colour: string, alpha: number, width: number): void {
  if (alpha <= 0.003) return;
  const { ctx } = f;
  ctx.beginPath();
  if (!sub(f, loop, dy)) return;
  ctx.strokeStyle = rgba(colour, alpha);
  ctx.lineWidth = width;
  ctx.stroke();
}

/** one portal frame: the reveal, two glass leaves, the machined face, the edge light */
function hoop(f: Frame, h: Hoop, on: number, lit: number, open: number): void {
  if (on <= 0.003) return;
  const { pal, ctx } = f;
  const dy = (1 - on) * -0.16;
  const far = lerp(1, 0.62, h.k);

  // the reveal: the inside of the frame, lit by the doorway it faces and by its own edge light
  paint(f, [h.rearOuter, h.rearInner], dy, [rgba(pal.bg, 0.94 * on), rgba(pal.key, (0.05 + 0.1 * h.k + 0.14 * lit) * on)]);

  // two leaves of smoked glass; they draw back into the jambs as `open` goes to 1
  if (open < 0.985) {
    const shut = 1 - open;
    const zg = h.z + h.depth * 0.5;
    const lw = h.iw * shut;
    const y0 = FLOOR + dy;
    const y1 = h.top + dy;
    const xl = AXIS - h.iw;
    const xr = AXIS + h.iw;
    const left: V3[] = [[xl, y0, zg], [xl + lw, y0, zg], [xl + lw, y1, zg], [xl, y1, zg]];
    const right: V3[] = [[xr, y0, zg], [xr - lw, y0, zg], [xr - lw, y1, zg], [xr, y1, zg]];
    paint(f, [left, right], 0, [rgba(pal.bg, 0.15 * on), rgba(pal.ink, 0.028 * on)]);
    if (!f.mobile) {
      // a sheen down each leaf
      const sw = lw * 0.2;
      const lean = lw * 0.16;
      f.fill([[xl + lw * 0.34, y0, zg], [xl + lw * 0.34 + sw, y0, zg], [xl + lw * 0.34 + sw + lean, y1, zg], [xl + lw * 0.34 + lean, y1, zg]], pal.ink, 0.035 * on * far * shut);
      f.fill([[xr - lw * 0.7, y0, zg], [xr - lw * 0.7 + sw, y0, zg], [xr - lw * 0.7 + sw + lean, y1, zg], [xr - lw * 0.7 + lean, y1, zg]], pal.ink, 0.028 * on * far * shut);
    }
    const stile = (0.16 + 0.2 * lit) * on * far * Math.min(1, shut * 4);
    f.line(left[1], left[2], pal.ink, stile, 1);
    f.line(right[1], right[2], pal.ink, stile, 1);
  }

  // the face: dark anodised metal with a brushed sheen, a highlight along its top
  const a = f.P(AXIS - h.iw - h.bar, h.top + h.bar + dy, h.z);
  const b = f.P(AXIS + h.iw + h.bar, FLOOR - h.bar + dy, h.z);
  const face: (string | CanvasGradient)[] = [rgba(pal.bg, 0.96 * on)];
  if (a && b && !f.mobile) {
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, rgba(pal.ink, 0.17 * on * far));
    g.addColorStop(0.34, rgba(pal.ink, 0.05 * on * far));
    g.addColorStop(0.62, rgba(pal.ink, 0.11 * on * far));
    g.addColorStop(1, rgba(pal.ink, 0.03 * on * far));
    face.push(g);
  } else face.push(rgba(pal.ink, 0.07 * on * far));
  paint(f, [h.outer, h.inner], dy, face);
  edge(f, h.outer, dy, pal.ink, 0.17 * on * far, 1);
  const crown = h.outer.slice(0, h.outer.length / 2).map((p): V3 => [p[0], p[1] + dy, p[2]]);
  f.path(crown, pal.ink, 0.3 * on * far, 1);
  // the edge light, set into the inner lip: it swells as the curtain goes by
  edge(f, h.inner, dy, pal.key, 0.22 * Math.max(0, lit - 0.5) * on, 5);
  edge(f, h.inner, dy, pal.key, clamp(lit) * on * far, 1.25);
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const n = 5;
    const seg = f.mobile ? 3 : 5;
    const hoops: Hoop[] = [];
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const z = lerp(NEAR, FAR, k);
      const bar = barOf(z);
      const hw = halfW(z);
      const top = lintel(z);
      const depth = lerp(0.2, 0.12, k);
      const r = lerp(0.15, 0.1, k);
      hoops.push({
        z,
        k,
        iw: hw - bar,
        top,
        bar,
        depth,
        outer: rounded(FLOOR - bar, top + bar, hw, r, z, seg),
        inner: rounded(FLOOR, top, hw - bar, r - bar * 0.55, z, seg),
        rearOuter: rounded(FLOOR - bar, top + bar, hw, r, z + depth, seg),
        rearInner: rounded(FLOOR, top, hw - bar, r - bar * 0.55, z + depth, seg),
      });
    }
    return { hoops, door: rounded(FLOOR, lintel(DOOR), halfW(DOOR) - 0.14, 0.07, DOOR, seg) };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const steps = f.tag === "open-account";
    const signIn = f.tag === "sign-in";
    const family = !steps && !signIn;

    f.cam.parallax = 0.6;
    const sway = f.still ? 0 : Math.sin(f.t * 0.09) * 0.022;
    f.aim(0.2 + (f.rnd(2) - 0.5) * 0.04 + sway, -0.03, 6.4, f.mobile ? 0.6 : 0.78);
    // keep the first frame where the engine put the instrument, whatever the camera does
    const mid = f.P(AXIS, 0, NEAR * 0.7);
    if (mid) f.cx += f.cx - mid.x;
    if (!f.mobile) f.cy -= f.u * 0.06;

    deck(f, { y: DECK, alpha: 0.11 });
    pool(f, [AXIS, DECK, -0.3], 2.6, pal.key, 0.24 * f.boot);

    // ── the pass: a curtain of light walks the corridor, then the airlock rests and closes
    const phase = f.still ? 0.33 : f.t < 2.4 ? -1 : ((f.t - 2.4) / PERIOD + f.rnd(1)) % 1;
    const running = phase >= 0;
    const bandZ = lerp(NEAR - 0.6, DOOR, clamp(phase / 0.62));
    const rest = easeInOut((phase - 0.84) / 0.16);
    const bandA = running ? clamp((bandZ - (NEAR - 0.3)) / 0.3) * clamp((0.66 - phase) / 0.07) : 0;
    const arrive = running ? easeInOut((phase - 0.5) / 0.14) * (1 - rest) : 0;

    // ── the doorway at the far end
    const doorOn = f.on(0.8, 0.3);
    const breathe = f.still ? 1 : 0.94 + 0.06 * Math.sin(f.t * 0.5);
    const glowing = doorOn * breathe * (0.78 + 0.22 * arrive);
    const doorMid: V3 = [AXIS, (FLOOR + lintel(DOOR)) * 0.5, DOOR];
    f.glow(doorMid, 1.5, pal.key, 0.2 * glowing);
    const dt = f.P(AXIS, lintel(DOOR), DOOR);
    const db = f.P(AXIS, FLOOR, DOOR);
    if (dt && db) {
      const g = ctx.createLinearGradient(0, dt.y, 0, db.y);
      g.addColorStop(0, rgba(pal.key, 0.2 * glowing));
      g.addColorStop(1, rgba(pal.key, 0.4 * glowing));
      paint(f, [s.door], 0, [g, rgba(pal.ink, 0.1 * glowing)]);
    }
    edge(f, s.door, 0, pal.ink, 0.34 * doorOn, 1);

    // its light lies along the gangway, fading toward the visitor
    const walkOn = f.on(0, 0.3);
    const pn = f.P(AXIS, FLOOR, LANDING);
    let spill: CanvasGradient | null = null;
    if (db && pn) {
      spill = ctx.createLinearGradient(db.x, db.y, pn.x, pn.y);
      spill.addColorStop(0, rgba(pal.key, 0.34 * glowing));
      spill.addColorStop(0.45, rgba(pal.key, 0.1 * glowing));
      spill.addColorStop(1, rgba(pal.key, 0));
    }
    const walk = (za: number, zb: number): void => {
      const wa = walkW(za);
      const wb = walkW(zb);
      const top: V3[] = [[AXIS - wa, FLOOR, za], [AXIS + wa, FLOOR, za], [AXIS + wb, FLOOR, zb], [AXIS - wb, FLOOR, zb]];
      const styles: (string | CanvasGradient)[] = [rgba(pal.bg, 0.9 * walkOn), rgba(pal.ink, 0.035 * walkOn)];
      if (spill) styles.push(spill);
      paint(f, [top], 0, styles);
      // aisle lights along both edges
      for (const side of [-1, 1]) {
        const p: V3 = [AXIS + side * wa * 0.94, FLOOR, za];
        const q: V3 = [AXIS + side * wb * 0.94, FLOOR, zb];
        f.line(p, q, pal.key, 0.07 * walkOn, 4);
        f.line(p, q, pal.key, 0.42 * walkOn, 1);
      }
    };
    const curtain = (): void => {
      if (bandA <= 0.003) return;
      const loop = rounded(FLOOR, lintel(bandZ) - 0.03, halfW(bandZ) - barOf(bandZ) - 0.03, 0.06, bandZ, 3);
      paint(f, [loop], 0, [rgba(pal.key, 0.08 * bandA)]);
      edge(f, loop, 0, pal.key, 0.14 * bandA, 6);
      edge(f, loop, 0, pal.ink, 0.7 * bandA, 1);
      const w = walkW(bandZ);
      f.line([AXIS - w, FLOOR, bandZ], [AXIS + w, FLOOR, bandZ], pal.key, 0.3 * bandA, 5);
    };

    // three step lamps along the gangway: at the entrance, half way, and before the doorway
    const gold = family ? pal.key : pal.gold;
    const stepZ = [0.125, 0.49, 0.875].map((k) => lerp(NEAR, FAR, k));
    const stepOn = (i: number) => easeOut((f.boot - 0.56 - i * 0.13) / 0.16);
    const stepLamps = (za: number, zb: number): void => {
      if (signIn) return;
      for (let i = 2; i >= 0; i--) {
        if (stepZ[i] <= za || stepZ[i] > zb) continue;
        const glint = f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 0.9 - i * 1.3);
        lamp(f, [AXIS, FLOOR + 0.01, stepZ[i]], gold, stepOn(i) * glint * (family ? 0.6 : 1), 0.025 - i * 0.002);
      }
    };

    walk(FAR, DOOR);
    if (bandZ > FAR) curtain();
    for (let i = s.hoops.length - 1; i >= 0; i--) {
      const h = s.hoops[i];
      const on = f.on(0.06 + h.k * 0.5, 0.36);
      const open = running ? easeInOut((bandZ - h.z + 0.55) / 0.45) * (1 - rest) : 0;
      const passed = running ? clamp((bandZ - h.z) / 0.25) * (1 - rest) : 0;
      const d = (bandZ - h.z) / 0.34;
      const lit = 0.4 + 0.16 * passed + 0.44 * Math.exp(-d * d) * bandA;
      hoop(f, h, on, lit, open);
      const before = i ? s.hoops[i - 1].z : LANDING;
      walk(before, h.z);
      // the threshold, lit by the frame above it
      const w = walkW(h.z);
      f.line([AXIS - w, FLOOR, h.z], [AXIS + w, FLOOR, h.z], pal.key, 0.5 * lit * on, 1.25);
      stepLamps(before, h.z);
      if (bandZ > before && bandZ <= h.z) curtain();
    }
    // the landing's front edge
    const lw = walkW(LANDING);
    f.fill([[AXIS - lw, FLOOR, LANDING], [AXIS + lw, FLOOR, LANDING], [AXIS + lw, FLOOR - 0.04, LANDING], [AXIS - lw, FLOOR - 0.04, LANDING]], pal.ink, 0.045 * walkOn);
    f.line([AXIS - lw, FLOOR, LANDING], [AXIS + lw, FLOOR, LANDING], pal.ink, 0.28 * walkOn, 1);

    // lettering for the steps
    if (steps)
      for (let i = 0; i < 3; i++) {
        f.label(`0${i + 1}`, [AXIS, FLOOR, stepZ[i]], { dx: 13, size: f.mobile ? 9 : 10, colour: pal.gold, alpha: 0.9 * stepOn(i) });
      }

    // ── sign-in: one round key on a bracket beside the first frame
    if (!steps) {
      const on = f.on(0.9, 0.3) * (family ? 0.7 : 1);
      const y = -0.14;
      const x = AXIS + halfW(NEAR);
      const p: V3 = [x + 0.3, y, NEAR];
      f.line([x, y, NEAR], [p[0] - 0.13, y, NEAR], pal.ink, 0.32 * on, 1);
      f.dot(p, 0.13, pal.bg, 0.9 * on);
      ring(f, p, 0.13, { axis: "z", colour: pal.ink, alpha: 0.4 * on, ticks: 24, major: 6, tickLen: 0.022 });
      ring(f, p, 0.082, { axis: "z", colour: gold, alpha: 0.85 * on, width: 1.5 });
      lamp(f, p, gold, on * (f.still ? 1 : 0.86 + 0.14 * Math.sin(f.t * 0.8)), 0.028);
      if (signIn && !f.mobile) f.label("KEY", p, { dy: 30, align: "center", size: 9, colour: pal.gold, alpha: 0.8 * on });
    }
  },
};

export default scene;

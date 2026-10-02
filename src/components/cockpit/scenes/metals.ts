/**
 * METALS — the vault tray.
 *
 * The four precious metals GIO4X lists, as bullion on a machined tray: a
 * pyramid of gold bars, a cross-laid block of silver, a small pyramid of
 * platinum, a single course of palladium. An assay ring hovers over the tray
 * with one station plumb above each stack, and a band of light crosses the top
 * faces the way a lamp passes over polished metal.
 *
 * Nothing here is a weight, a fineness or a price: it is the list of metals,
 * drawn as objects. On an instrument page the tray is turned so that the
 * page's own metal stands at the front, lit; the other three recede.
 *
 * Unlike the other instruments this one is looked down upon (a negative pitch
 * puts the camera above the pivot), because the sheen lives on the top faces;
 * so the tray stands at the pivot, not on a deck at the foot of the stage.
 */
import { TAU, clamp, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { callouts, deck, lamp, pool, ring, type Callout } from "../kit";

type Bar = { x: number; z: number; hx: number; hz: number; y: number; h: number; layer: number };
type Stack = { code: string; x: number; z: number; top: number; tone: number; gold: boolean; bars: Bar[] };
type State = { stacks: Stack[]; order: number[] };
/** where the camera stands, and how much key light each of the four flanks (-x, +x, -z, +z) receives */
type View = { cam: V3; lit: number[] };
type Metal = { colour: string; face: number; line: string; edge: number; cool: number; gloss: number; glint: number };

/** the tray stands at the pivot and is seen from above: its floor, half-extents, thickness, and the bay centres */
const FY = -0.34;
const TX = 1.12;
const TZ = 1.0;
const TH = 0.06;
const BX = 0.46;
const BZ = 0.48;
const GAP = 0.02;
const FLANKS = [[3, 0], [1, 2], [0, 1], [2, 3]];

/** one course of `n` bars laid side by side; `cross` turns the course a quarter turn */
function course(out: Bar[], n: number, layer: number, len: number, wid: number, h: number, cross = false): void {
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * (wid + GAP);
    out.push({ x: cross ? off : 0, z: cross ? 0 : off, hx: (cross ? wid : len) / 2, hz: (cross ? len : wid) / 2, y: layer * h, h, layer });
  }
}

function stack(code: string, x: number, z: number, tone: number, build: (b: Bar[]) => void): Stack {
  const bars: Bar[] = [];
  build(bars);
  let top = 0;
  for (const b of bars) top = Math.max(top, b.y + b.h);
  return { code, x, z, top, tone, gold: code === "XAU", bars };
}

/**
 * A cast bar: a tapered block, drawn solid. Only the faces turned to the
 * camera are painted, each as a dark body under a tint of the metal, so that
 * near bars hide far ones. Returns the top face (for the sheen).
 */
function ingot(f: Frame, v: View, min: V3, max: V3, taper: number, m: Metal, on: number): V3[] {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const b: V3[] = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]];
  const q: V3[] = [[x0 + taper, y1, z0 + taper], [x1 - taper, y1, z0 + taper], [x1 - taper, y1, z1 - taper], [x0 + taper, y1, z1 - taper]];
  const h = y1 - y0;
  const up = taper * (v.cam[1] - y0);
  const seen = [up - h * (v.cam[0] - x0) > 0, up + h * (v.cam[0] - x1) > 0, up - h * (v.cam[2] - z0) > 0, up + h * (v.cam[2] - z1) > 0];
  for (let k = 0; k < 4; k++) {
    if (!seen[k]) continue;
    const [i, j] = FLANKS[k];
    const tint = m.face * (0.13 + 0.55 * v.lit[k]) * on;
    // the tray is polished: each flank leaves a short reflection in it
    if (m.gloss > 0) {
      const dip = (p: V3, c: V3, r: number): V3 => [lerp(c[0], p[0], r), y0 - h * r, lerp(c[2], p[2], r)];
      f.fill([b[i], b[j], dip(q[j], b[j], 0.62), dip(q[i], b[i], 0.62)], m.colour, tint * m.gloss);
      f.fill([b[i], b[j], dip(q[j], b[j], 0.26), dip(q[i], b[i], 0.26)], m.colour, tint * m.gloss);
    }
    const side: V3[] = [b[i], b[j], q[j], q[i]];
    f.fill(side, f.pal.bg, 0.94 * on);
    f.fill(side, m.colour, tint);
    // white metal mirrors the room: its shaded flank picks up the key light
    if (m.cool > 0) f.fill(side, f.pal.key, m.cool * (1 - v.lit[k]) * on);
    f.path(side, m.line, m.edge * 0.4 * on, 1, true);
  }
  f.fill(q, f.pal.bg, 0.94 * on);
  f.fill(q, m.colour, m.face * on);
  f.path(q, m.line, m.edge * on, 1, true);
  // the catch-light: a cast bar is brightest along the arris that faces the lamp
  if (m.glint > 0) {
    for (let k = 0; k < 4; k++) {
      if (seen[k]) f.line(q[FLANKS[k][0]], q[FLANKS[k][1]], f.pal.ink, m.glint * (0.1 + 0.5 * v.lit[k]) * on, 1.25);
    }
  }
  return q;
}

/** the part of a level face that lies inside a band of light crossing the tray */
function sheen(f: Frame, face: readonly V3[], dx: number, dz: number, lo: number, hi: number, colour: string, alpha: number): void {
  let poly: readonly V3[] = face;
  for (let pass = 0; pass < 2; pass++) {
    const sign = pass ? -1 : 1;
    const lim = pass ? -hi : lo;
    const out: V3[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const c = poly[(i + 1) % poly.length];
      const da = sign * (a[0] * dx + a[2] * dz) - lim;
      const dc = sign * (c[0] * dx + c[2] * dz) - lim;
      if (da >= 0) out.push(a);
      if (da >= 0 !== dc >= 0) {
        const k = da / (da - dc);
        out.push([lerp(a[0], c[0], k), a[1], lerp(a[2], c[2], k)]);
      }
    }
    if (out.length < 3) return;
    poly = out;
  }
  f.fill(poly, colour, alpha);
}

/** the same band where it falls on the tray floor: one soft gradient across it, clipped to the floor */
function wash(f: Frame, floor: readonly V3[], dx: number, dz: number, at: number, w: number, alpha: number): void {
  const y = floor[0][1];
  const o = f.P(at * dx, y, at * dz);
  const along = f.P(at * dx - dz, y, at * dz + dx);
  const lo = f.P((at - w) * dx, y, (at - w) * dz);
  const hi = f.P((at + w) * dx, y, (at + w) * dz);
  const rim = floor.map((p) => f.P(p[0], p[1], p[2]));
  if (!o || !along || !lo || !hi || rim.some((p) => !p)) return;
  // the gradient runs square to the band as it lies on screen
  const len = Math.hypot(along.x - o.x, along.y - o.y) || 1;
  const nx = -(along.y - o.y) / len;
  const ny = (along.x - o.x) / len;
  const a = (lo.x - o.x) * nx + (lo.y - o.y) * ny;
  const b = (hi.x - o.x) * nx + (hi.y - o.y) * ny;
  const { ctx } = f;
  const g = ctx.createLinearGradient(o.x + nx * a, o.y + ny * a, o.x + nx * b, o.y + ny * b);
  g.addColorStop(0, rgba(f.pal.ink, 0));
  g.addColorStop(0.5, rgba(f.pal.ink, alpha));
  g.addColorStop(1, rgba(f.pal.ink, 0));
  ctx.save();
  ctx.beginPath();
  rim.forEach((p, i) => (p && i ? ctx.lineTo(p.x, p.y) : p && ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, f.w, f.h);
  ctx.restore();
}

const scene: Scene<State> = {
  pose: 12,
  setup() {
    return {
      order: [0, 1, 2, 3],
      stacks: [
        stack("XAU", -BX, -BZ, 1, (b) => {
          course(b, 3, 0, 0.56, 0.215, 0.13);
          course(b, 2, 1, 0.56, 0.215, 0.13);
          course(b, 1, 2, 0.56, 0.215, 0.13);
        }),
        stack("XAG", BX, -BZ, 0.8, (b) => {
          course(b, 3, 0, 0.56, 0.215, 0.13);
          course(b, 2, 1, 0.56, 0.215, 0.13, true);
        }),
        stack("XPT", BX, BZ, 0.64, (b) => {
          course(b, 2, 0, 0.44, 0.19, 0.11);
          course(b, 1, 1, 0.44, 0.19, 0.11);
        }),
        stack("XPD", -BX, BZ, 0.5, (b) => {
          course(b, 3, 0, 0.44, 0.19, 0.11);
        }),
      ],
    };
  },
  draw(f, s) {
    const { pal } = f;
    const tag = f.tag.toUpperCase();
    const focus = s.stacks.findIndex((k) => tag.startsWith(k.code));
    const first = focus < 0 ? 0 : focus;
    const lead = s.stacks[first];

    // the tray is turned so that the page's own metal stands nearest the visitor,
    // a little off the square so that the long flanks and the ends of the bars both show
    const front = lead.z < 0;
    const side = Math.sign(lead.x) * (front ? 1 : -1);
    const home = (front ? 0 : Math.PI) + side * (0.27 + f.rnd(1) * 0.08);
    f.aim(home + (f.still ? 0 : Math.sin(f.t * 0.07) * 0.04), -0.44, 6.4, f.mobile ? 0.69 : 0.93);
    // the far corner of the tray swings out to one side: keep the whole instrument in its box
    if (f.mobile) {
      f.cx = f.w * (0.5 + 0.026 * side);
      f.cy -= f.u * 0.36;
    } else f.cx += f.u * (0.07 + 0.06 * side);

    const { yaw, pitch, dist } = f.cam;
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    // key light from just beside the visitor: tops brightest, long flanks next, the ends of the bars in half shadow
    const lx = Math.sin(yaw + 0.06 * side);
    const lz = -Math.cos(yaw + 0.06 * side);
    const view: View = { cam: [dist * Math.cos(pitch) * sy, -dist * Math.sin(pitch), -dist * Math.cos(pitch) * cy], lit: [clamp(-lx), clamp(lx), clamp(-lz), clamp(lz)] };
    const near = (x: number, z: number) => x * sy - z * cy;

    deck(f, { y: FY, half: 3.75, alpha: 0.1, drift: 0 });
    pool(f, [0, FY, 0], 2.7, pal.key, 0.2 * f.boot);

    // the band of light: one slow pass across the tray, feathered at both edges
    const sa = home + 0.5;
    const dx = Math.cos(sa);
    const dz = Math.sin(sa);
    const sweep = f.still ? lead.x * dx + lead.z * dz + 0.05 : lerp(-2.3, 2.3, (f.t / 13 + f.rnd(7)) % 1);
    const steps = Math.max(3, Math.round((f.mobile ? 4 : 7) * f.q));
    const shine = (face: readonly V3[], colour: string, alpha: number) => {
      const c = (face[0][0] + face[2][0]) * 0.5 * dx + (face[0][2] + face[2][2]) * 0.5 * dz;
      if (Math.abs(c - sweep) > 0.75 || alpha <= 0.004) return;
      // nested slices, narrowing to a white core: the falloff of a real highlight
      for (let n = 0; n < steps; n++) {
        const w = 0.36 * (1 - n / steps) ** 1.4 + 0.015;
        sheen(f, face, dx, dz, sweep - w, sweep + w, n * 2 < steps ? colour : pal.ink, (alpha * 0.92) / steps);
      }
    };

    // ── the tray: a bevelled slab with a lit rim and four engraved bays
    const trayOn = f.on(0, 0.35);
    const top = FY + TH;
    const bed = ingot(f, view, [-TX, FY, -TZ], [TX, top, TZ], 0.035, { colour: pal.ink, face: 0.05, line: pal.key, edge: 0.5, cool: 0, gloss: 0, glint: 0 }, trayOn);
    if (Math.abs(sweep) < 2 && trayOn > 0.01) wash(f, bed, dx, dz, sweep, 0.4, 0.085 * trayOn);
    const ix = TX - 0.11;
    const iz = TZ - 0.11;
    f.path([[-ix, top, -iz], [ix, top, -iz], [ix, top, iz], [-ix, top, iz]], pal.ink, 0.16 * trayOn, 1, true);
    f.line([0, top, -iz], [0, top, iz], pal.ink, 0.13 * trayOn);
    f.line([-ix, top, 0], [ix, top, 0], pal.ink, 0.13 * trayOn);
    if (focus >= 0) {
      const ex = Math.sign(lead.x) * ix;
      const ez = Math.sign(lead.z) * iz;
      f.fill([[0, top, 0], [ex, top, 0], [ex, top, ez], [0, top, ez]], pal.gold, 0.06 * trayOn);
      f.path([[ex, top, 0], [ex, top, ez], [0, top, ez]], pal.gold, 0.55 * trayOn, 1.25);
    }

    // ── the bullion: far stacks first, each set down course by course from the tray up
    s.order.sort((a, c) => near(s.stacks[a].x, s.stacks[a].z) - near(s.stacks[c].x, s.stacks[c].z));
    for (const i of s.order) {
      const k = s.stacks[i];
      const level = focus < 0 ? 0.88 : i === focus ? 1 : 0.46;
      const colour = k.gold ? pal.gold : pal.ink;
      const edge = (0.5 + 0.4 * k.tone) * level;
      const metal: Metal = { colour, face: (k.gold ? 0.56 : 0.46) * k.tone * level, line: colour, edge, cool: k.gold ? 0 : 0.09 * level, gloss: 0, glint: edge };
      if (i === focus || focus < 0) pool(f, [k.x, top, k.z], 0.66, colour, (focus < 0 ? 0.12 : 0.28) * k.tone * f.boot);
      k.bars.sort((a, c) => a.layer - c.layer || near(a.x, a.z) - near(c.x, c.z));
      for (const b of k.bars) {
        const on = f.on(0.22 + ((i - first + 4) % 4) * 0.15 + b.layer * 0.1, 0.22);
        if (on <= 0) continue;
        const x = k.x + b.x;
        const z = k.z + b.z;
        const y = top + b.y + (1 - on) * 0.14;
        metal.gloss = b.layer || f.mobile || f.q < 1 ? 0 : 0.34 * on;
        const q = ingot(f, view, [x - b.hx, y, z - b.hz], [x + b.hx, y + b.h, z + b.hz], 0.026, metal, on);
        // the top course carries the refiner's cartouche: an empty frame, no marks claimed
        if (!f.mobile && b.y + b.h > k.top - 0.001) {
          const long = b.hx > b.hz;
          const ax = b.hx * (long ? 0.34 : 0.3);
          const az = b.hz * (long ? 0.3 : 0.34);
          f.path([[x - ax, y + b.h, z - az], [x + ax, y + b.h, z - az], [x + ax, y + b.h, z + az], [x - ax, y + b.h, z + az]], colour, 0.36 * edge * on, 1, true);
        }
        shine(q, colour, level * on);
      }
    }

    // ── the assay ring: a graduated ring over the tray, then one station lamp plumb above each stack
    const ringOn = f.on(0.9, 0.3);
    const lampOn = f.on(1, 0.2);
    const ry = top + 1.06;
    const rr = Math.hypot(BX, BZ);
    const turn = f.still ? 0 : f.t * 0.02;
    ring(f, [0, ry, 0], rr, { colour: pal.ink, alpha: 0.32 * ringOn, ticks: Math.round((f.mobile ? 6 : 12) * f.q) * 6, major: 6, tickLen: 0.045, rot: turn });
    ring(f, [0, ry, 0], rr - 0.05, { colour: pal.ink, alpha: 0.14 * ringOn });
    ring(f, [0, ry, 0], rr + 0.08, { colour: pal.key, alpha: 0.42 * ringOn, from: 0.02, to: 0.3, width: 1.5, rot: -turn * 1.5 });
    const names: Callout[] = [];
    s.stacks.forEach((k, i) => {
      const mine = i === focus;
      const level = (focus < 0 ? 0.8 : mine ? 1 : 0.4) * lampOn;
      const colour = mine || (focus < 0 && k.gold) ? pal.gold : pal.ink;
      const at = Math.atan2(k.z, k.x) / TAU;
      if (mine) ring(f, [0, ry, 0], rr, { colour: pal.gold, alpha: 0.9 * ringOn, from: at - 0.055, to: at + 0.055, width: 1.75 });
      f.line([k.x, ry, k.z], [k.x, top + k.top + 0.02, k.z], colour, (mine ? 0.5 : 0.16) * level);
      const breathe = f.still ? 1 : 0.86 + 0.14 * Math.sin(f.t * 0.9 + i * 1.7);
      lamp(f, [k.x, ry, k.z], colour, level * breathe * (mine ? 1 : 0.7), mine ? 0.02 : 0.014);
      names.push({ text: k.code, p: [Math.sign(k.x) * TX, top, Math.sign(k.z) * TZ], colour: mine ? pal.gold : pal.ink, alpha: (focus < 0 ? 0.85 : mine ? 1 : 0.5) * lampOn });
    });
    callouts(f, names, f.mobile ? { size: 10, reach: 10 } : { size: 11, reach: 16 });
  },
};

export default scene;

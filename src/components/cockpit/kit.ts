/**
 * GIO4X COCKPIT — the parts bin.
 *
 * Scenes are composed from the same few engineered parts (a deck, glass panels,
 * graduated rings, lit traces) so that every page's instrument is unique in
 * subject but unmistakably built by the same hands.
 */
import { TAU, clamp, rgba, type Frame, type V3 } from "./engine";

/** The coordinate floor everything stands on: a perspective grid that fades with distance. */
export function deck(f: Frame, o: { y?: number; half?: number; step?: number; colour?: string; alpha?: number; drift?: number } = {}): void {
  const y = o.y ?? -1.25;
  const half = o.half ?? 6;
  const step = o.step ?? 0.75;
  const colour = o.colour ?? f.pal.ink;
  const a0 = (o.alpha ?? 0.1) * f.boot;
  // the floor slides slowly under the instrument, as if the aircraft were moving
  const slide = f.still ? 0 : ((o.drift ?? 0.06) * f.t) % step;
  const n = Math.round(half / step);
  for (let i = -n; i <= n; i++) {
    const x = i * step;
    const edge = 1 - Math.abs(i) / (n + 1);
    f.line([x, y, -half], [x, y, half], colour, a0 * edge * edge, 1);
  }
  for (let i = -n; i <= n; i++) {
    const z = i * step - slide;
    const edge = 1 - Math.abs(z) / (half + step);
    if (edge <= 0) continue;
    f.line([-half, y, z], [half, y, z], colour, a0 * edge * edge, 1);
  }
}

export type RingOpts = {
  colour?: string;
  alpha?: number;
  width?: number;
  /** normal of the ring's plane */
  axis?: "x" | "y" | "z";
  /** arc, in turns (0..1) */
  from?: number;
  to?: number;
  /** graduated marks around the ring */
  ticks?: number;
  tickLen?: number;
  /** every n-th tick is a major one */
  major?: number;
  rot?: number;
  seg?: number;
};

const onRing = (c: V3, r: number, a: number, axis: "x" | "y" | "z"): V3 => {
  const u = Math.cos(a) * r;
  const v = Math.sin(a) * r;
  if (axis === "y") return [c[0] + u, c[1], c[2] + v];
  if (axis === "x") return [c[0], c[1] + v, c[2] + u];
  return [c[0] + u, c[1] + v, c[2]];
};

/** A machined ring: an arc with optional graduations, in any of the three planes. */
export function ring(f: Frame, c: V3, r: number, o: RingOpts = {}): void {
  const axis = o.axis ?? "y";
  const colour = o.colour ?? f.pal.ink;
  const alpha = o.alpha ?? 0.3;
  const from = (o.from ?? 0) * TAU + (o.rot ?? 0);
  const to = (o.to ?? 1) * TAU + (o.rot ?? 0);
  const seg = Math.max(12, Math.round((o.seg ?? 72) * f.q * Math.abs(to - from) / TAU));
  const pts: V3[] = [];
  for (let i = 0; i <= seg; i++) pts.push(onRing(c, r, from + ((to - from) * i) / seg, axis));
  f.path(pts, colour, alpha, o.width ?? 1);
  if (o.ticks) {
    const len = o.tickLen ?? 0.06;
    for (let i = 0; i < o.ticks; i++) {
      const a = from + ((to - from) * i) / o.ticks;
      const major = o.major ? i % o.major === 0 : false;
      f.line(onRing(c, r, a, axis), onRing(c, r - len * (major ? 1.8 : 1), a, axis), colour, alpha * (major ? 1.2 : 0.7), 1);
    }
  }
}

/** Point on a ring, for placing markers and labels on it. */
export function ringPoint(c: V3, r: number, turn: number, axis: "x" | "y" | "z" = "y", rot = 0): V3 {
  return onRing(c, r, turn * TAU + rot, axis);
}

export type PanelOpts = {
  /** turn the panel about its vertical axis, radians */
  yaw?: number;
  /** lean it back, radians */
  tilt?: number;
  colour?: string;
  /** edge light strength */
  alpha?: number;
  /** glass body opacity */
  glass?: number;
  /** power-on, 0..1: the panel rises into place and lights */
  on?: number;
  /** a header rule across the top, like an instrument's title bar */
  header?: boolean;
};

export type Panel = {
  /** panel-local to world: u, v in 0..1 from the bottom-left corner */
  at(u: number, v: number, lift?: number): V3;
  on: number;
};

/**
 * A pane of display glass standing in the scene. Returns a mapper so the scene
 * can draw its own content on the pane's surface.
 */
export function panel(f: Frame, c: V3, w: number, h: number, o: PanelOpts = {}): Panel {
  const on = clamp(o.on ?? 1);
  const yaw = o.yaw ?? 0;
  const tilt = o.tilt ?? 0;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  // powering on: the pane rises a little into its final position
  const rise = (1 - on) * -0.18;
  const at = (u: number, v: number, lift = 0): V3 => {
    const lx = (u - 0.5) * w;
    const ly = (v - 0.5) * h;
    const lz = -lift;
    const y1 = ly * ct - lz * st;
    const z1 = ly * st + lz * ct;
    return [c[0] + lx * cy + z1 * sy, c[1] + y1 + rise, c[2] - lx * sy + z1 * cy];
  };
  if (on <= 0.003) return { at, on };
  const colour = o.colour ?? f.pal.key;
  const edge = (o.alpha ?? 0.5) * on;
  const quad: V3[] = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)];

  // smoked glass body, then a sheen that follows the pointer across it
  f.fill(quad, f.pal.bg, 0.55 * on);
  f.fill(quad, f.pal.ink, (o.glass ?? 0.035) * on);
  const p0 = f.P(...at(0, 1));
  const p1 = f.P(...at(1, 0));
  if (p0 && p1) {
    const { ctx } = f;
    const band = clamp(0.32 + f.px * 0.22 + (f.still ? 0 : Math.sin(f.t * 0.21) * 0.06), 0.05, 0.9);
    const g = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
    g.addColorStop(Math.max(0, band - 0.2), rgba(f.pal.ink, 0));
    g.addColorStop(band, rgba(f.pal.ink, 0.07 * on));
    g.addColorStop(Math.min(1, band + 0.14), rgba(f.pal.ink, 0));
    ctx.save();
    ctx.beginPath();
    let ok = true;
    for (let i = 0; i < 4; i++) {
      const p = f.P(...quad[i]);
      if (!p) {
        ok = false;
        break;
      }
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    }
    if (ok) {
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, f.w, f.h);
    }
    ctx.restore();
  }

  // machined edge: a hairline all round, a brighter lit edge along the top
  f.path(quad, f.pal.ink, 0.16 * on, 1, true);
  f.line(at(0, 1), at(1, 1), colour, edge, 1.25);
  f.line(at(0, 1), at(0, 0.82), colour, edge * 0.7, 1);
  f.line(at(1, 1), at(1, 0.82), colour, edge * 0.7, 1);
  if (o.header) f.line(at(0.04, 0.88), at(0.96, 0.88), f.pal.ink, 0.12 * on, 1);
  return { at, on };
}

/** A lit trace through space, with one slow pulse of light travelling along it. */
export function trace(f: Frame, pts: readonly V3[], colour: string, alpha = 0.6, width = 1.25, pulseAt = -1): void {
  if (pts.length < 2) return;
  // a soft halo under a fine core: the line reads as light, not as ink
  f.path(pts, colour, alpha * 0.16, width * 4.5);
  f.path(pts, colour, alpha, width);
  if (pulseAt >= 0 && !f.still) {
    const x = (pulseAt % 1) * (pts.length - 1);
    const i = Math.floor(x);
    const k = x - i;
    const a = pts[i];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const p: V3 = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    f.glow(p, 0.11, colour, alpha * 0.9);
    f.dot(p, 0.011, f.pal.ink, alpha);
  }
}

/** Points along a lifted arc between two positions (a flight path, a transfer, a connection). */
export function arc(a: V3, b: V3, lift: number, n = 28): V3[] {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const k = Math.sin(Math.PI * t) * lift;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + k, a[2] + (b[2] - a[2]) * t]);
  }
  return out;
}

/** An indicator lamp: a small lit point with its own spill of light. */
export function lamp(f: Frame, p: V3, colour: string, level = 1, size = 0.018): void {
  if (level <= 0.003) return;
  f.glow(p, size * 7, colour, 0.4 * level);
  f.dot(p, size, colour, 0.5 + 0.5 * level);
  f.dot(p, size * 0.42, f.pal.ink, 0.75 * level);
}

/** A wireframe box (an ingot, a block, a module) between two corners. */
export function box(f: Frame, min: V3, max: V3, colour: string, alpha = 0.4, fillAlpha = 0): void {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const v: V3[] = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y0, z1],
    [x0, y0, z1],
    [x0, y1, z0],
    [x1, y1, z0],
    [x1, y1, z1],
    [x0, y1, z1],
  ];
  if (fillAlpha > 0) {
    f.fill([v[4], v[5], v[6], v[7]], colour, fillAlpha);
    f.fill([v[0], v[1], v[5], v[4]], colour, fillAlpha * 0.6);
    f.fill([v[1], v[2], v[6], v[5]], colour, fillAlpha * 0.35);
  }
  f.path([v[0], v[1], v[2], v[3]], colour, alpha * 0.55, 1, true);
  f.path([v[4], v[5], v[6], v[7]], colour, alpha, 1, true);
  for (let i = 0; i < 4; i++) f.line(v[i], v[i + 4], colour, alpha * 0.7, 1);
}

/**
 * A solid machined block between two corners (the first is the nearer in z):
 * smoked body, tinted faces, lit arrises. Only the faces the camera can see are
 * drawn, so blocks drawn from the farthest to the nearest hide each other.
 */
export function slab(f: Frame, min: V3, max: V3, colour: string, tint = 0.14, on = 1): void {
  if (on <= 0.003) return;
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const a = f.P(x0, y1, z0);
  const b = f.P(x0, y1, z1);
  const c = f.P(x1, y1, z0);
  const d = f.P(x1, y1, z1);
  if (!a || !b || !c || !d) return;
  const face = (q: V3[], k: number) => {
    f.fill(q, f.pal.bg, 0.95 * on);
    f.fill(q, colour, tint * k * on);
    f.path(q, colour, 0.5 * on, 1, true);
  };
  if (b.x < a.x - 0.5) face([[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], 0.5);
  if (d.x > c.x + 0.5) face([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], 0.6);
  if (b.y < a.y - 0.5) face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], 1.5);
  face([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], 1);
}

/** Where the camera stands along x, in world units: a row of blocks is drawn from the one farthest from it to the nearest. */
export const eyeX = (f: Frame): number => f.cam.dist * Math.cos(f.cam.pitch) * Math.sin(f.cam.yaw);

/**
 * A ball of smoked glass: a dark body, a rim that catches the key light and a
 * small specular highlight that moves a little with the pointer. Draw it before
 * whatever is engraved on its surface.
 */
export function orb(f: Frame, c: V3, r: number, colour?: string, level = 1): void {
  const p = f.P(c[0], c[1], c[2]);
  if (!p || level <= 0.003) return;
  const { ctx } = f;
  const R = r * p.s * f.u;
  const key = colour ?? f.pal.key;
  const body = ctx.createRadialGradient(p.x - R * 0.34, p.y - R * 0.42, R * 0.05, p.x, p.y, R);
  body.addColorStop(0, rgba(key, 0.16 * level));
  body.addColorStop(0.5, rgba(f.pal.bg, 0.5 * level));
  body.addColorStop(1, rgba(f.pal.bg, 0.86 * level));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(p.x, p.y, R, 0, TAU);
  ctx.fill();
  // fresnel rim: glass is brightest where it turns away from the viewer
  const rim = ctx.createRadialGradient(p.x, p.y, R * 0.78, p.x, p.y, R);
  rim.addColorStop(0, rgba(key, 0));
  rim.addColorStop(1, rgba(key, 0.22 * level));
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(p.x, p.y, R, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(f.pal.ink, 0.28 * level);
  ctx.lineWidth = 1;
  ctx.stroke();
  // specular highlight
  const hx = p.x - R * (0.4 + f.px * 0.08);
  const hy = p.y - R * (0.46 + f.py * 0.06);
  const spec = ctx.createRadialGradient(hx, hy, 0, hx, hy, R * 0.5);
  spec.addColorStop(0, rgba(f.pal.ink, 0.16 * level));
  spec.addColorStop(1, rgba(f.pal.ink, 0));
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.arc(p.x, p.y, R, 0, TAU);
  ctx.fill();
}

/** Light spilling onto the deck under an instrument: an elliptical pool on the floor plane. */
export function pool(f: Frame, c: V3, r: number, colour?: string, alpha = 0.22): void {
  const p = f.P(c[0], c[1], c[2]);
  const px = f.P(c[0] + r, c[1], c[2]);
  const pz = f.P(c[0], c[1], c[2] - r);
  if (!p || !px || !pz || alpha <= 0.003) return;
  const { ctx } = f;
  const rx = Math.max(1, Math.abs(px.x - p.x));
  const ry = Math.max(1, Math.abs(pz.y - p.y));
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(colour ?? f.pal.key, alpha));
  g.addColorStop(0.55, rgba(colour ?? f.pal.key, alpha * 0.28));
  g.addColorStop(1, rgba(colour ?? f.pal.key, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export type Callout = { text: string; p: V3; colour?: string; alpha?: number };

/**
 * Engraved names for points in the scene. Labels are laid out in screen space
 * so that two never collide: each sits beside its point, and a crowded group
 * fans out vertically with fine leader lines back to the points.
 */
export function callouts(f: Frame, items: readonly Callout[], o: { size?: number; gap?: number; reach?: number } = {}): void {
  const size = o.size ?? 11;
  const gap = o.gap ?? size + 4;
  const reach = o.reach ?? 14;
  const { ctx } = f;
  type Slot = { x: number; y: number; ly: number; right: boolean; it: Callout };
  const slots: Slot[] = [];
  for (const it of items) {
    const p = f.P(it.p[0], it.p[1], it.p[2]);
    if (!p || (it.alpha ?? 1) <= 0.02) continue;
    slots.push({ x: p.x, y: p.y, ly: p.y, right: p.x >= f.cx, it });
  }
  for (const side of [true, false]) {
    const col = slots.filter((s) => s.right === side).sort((a, b) => a.y - b.y);
    // push overlapping labels apart, top to bottom then bottom to top
    for (let i = 1; i < col.length; i++) if (col[i].ly - col[i - 1].ly < gap) col[i].ly = col[i - 1].ly + gap;
    for (let i = col.length - 2; i >= 0; i--) if (col[i + 1].ly - col[i].ly < gap) col[i].ly = col[i + 1].ly - gap;
  }
  ctx.font = `600 ${size}px ${f.pal.font}`;
  ctx.textBaseline = "middle";
  for (const s of slots) {
    const a = s.it.alpha ?? 1;
    const lx = s.x + (s.right ? reach : -reach);
    ctx.beginPath();
    ctx.moveTo(s.x + (s.right ? 4 : -4), s.y);
    ctx.lineTo(lx - (s.right ? 3 : -3), s.ly);
    ctx.strokeStyle = rgba(f.pal.ink, 0.22 * a);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = s.right ? "left" : "right";
    ctx.fillStyle = rgba(s.it.colour ?? f.pal.ink, 0.9 * a);
    ctx.fillText(s.it.text, lx, s.ly);
  }
}

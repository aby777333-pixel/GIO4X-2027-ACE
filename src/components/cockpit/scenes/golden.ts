/**
 * GOLDEN — the spiral, under construction.
 *
 * The figure the design page is built on, taken apart in depth. A golden
 * rectangle stands in space as a plate of glass; take its square away and the
 * same rectangle remains, smaller, on the next plate behind; and so on back.
 * Each plate carries the quarter-arc of its own square, and the arcs join into
 * one champagne spiral that winds away through the stack. A pair of wing
 * dividers stands beside the work, and φ marks the first cut.
 *
 * The pointer picks a plate up: the one whose square is under the cursor comes
 * forward and lights, the dividers leave their place, set one point on the
 * centre of that square's arc and open to its side, and the other point strikes
 * the arc again as a travelling light. Move to another square and they follow.
 *
 * Nothing here is a measurement: it is the one ratio the page talks about.
 */
import { clamp, easeInOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, trace } from "../kit";

const PHI = (1 + Math.sqrt(5)) / 2;
const FLOOR = -1.14;
/** the first rectangle: its width, and where its bottom-left corner stands */
const W = 2.34;
const X0 = -1.64;
const Y0 = -0.6;
/** depth between one plate and the next, and how far a plate comes forward under the pointer */
const DZ = 0.19;
const LIFT = 0.36;
/** the dividers: leg length, and where their two points rest on the deck */
const LEG = 1.02;
const REST: [V3, V3] = [[1.12, FLOOR, -0.3], [1.62, FLOOR, -0.3]];

/** one golden rectangle, the square that is cut from it, and that square's arc: centre, radius, start angle */
type Plate = { x: number; y: number; w: number; h: number; sx: number; sy: number; s: number; cx: number; cy: number; a0: number; cut: [number, number, number, number] };
type State = { plates: Plate[]; order: number[]; lift: number[]; a: number[]; b: number[]; grip: number; sel: number; since: number };

/** cut squares off a golden rectangle, turning a quarter each time: left, top, right, bottom */
function divide(n: number): Plate[] {
  const out: Plate[] = [];
  let x = X0;
  let y = Y0;
  let w = W;
  let h = W / PHI;
  for (let i = 0; i < n; i++) {
    const k = i % 4;
    const s = k % 2 ? w : h;
    const a0 = Math.PI - (k * Math.PI) / 2;
    if (k === 0) out.push({ x, y, w, h, sx: x, sy: y, s, cx: x + s, cy: y, a0, cut: [x + s, y, x + s, y + h] });
    else if (k === 1) out.push({ x, y, w, h, sx: x, sy: y + h - s, s, cx: x, cy: y + h - s, a0, cut: [x, y + h - s, x + w, y + h - s] });
    else if (k === 2) out.push({ x, y, w, h, sx: x + w - s, sy: y, s, cx: x + w - s, cy: y + h, a0, cut: [x + w - s, y, x + w - s, y + h] });
    else out.push({ x, y, w, h, sx: x, sy: y, s, cx: x + w, cy: y + s, a0, cut: [x, y + s, x + w, y + s] });
    if (k === 0) x += s;
    if (k === 3) y += s;
    if (k % 2) h -= s;
    else w -= s;
  }
  return out;
}

/** is the pointer inside a quadrilateral standing at depth z? (tested where the plate rests, so a lifted plate cannot shake itself loose) */
function under(f: Frame, x0: number, y0: number, x1: number, y1: number, z: number): boolean {
  const q = [f.P(x0, y0, z), f.P(x1, y0, z), f.P(x1, y1, z), f.P(x0, y1, z)];
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    if (!a || !b) return false;
    const c = (b.x - a.x) * (f.my - a.y) - (b.y - a.y) * (f.mx - a.x);
    if (c !== 0 && sign !== 0 && Math.sign(c) !== sign) return false;
    if (c !== 0) sign = Math.sign(c);
  }
  return true;
}

/** one leg of the dividers: a blade of steel tapering from the joint to a needle point */
function leg(f: Frame, joint: V3, tip: V3, level: number): void {
  const p = f.P(joint[0], joint[1], joint[2]);
  const q = f.P(tip[0], tip[1], tip[2]);
  if (!p || !q || level <= 0.003) return;
  const { ctx, pal } = f;
  const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  const nx = (-(q.y - p.y) / len) * 0.03 * p.s * f.u;
  const ny = ((q.x - p.x) / len) * 0.03 * p.s * f.u;
  ctx.beginPath();
  ctx.moveTo(p.x + nx, p.y + ny);
  ctx.lineTo(q.x, q.y);
  ctx.lineTo(p.x - nx, p.y - ny);
  ctx.closePath();
  ctx.fillStyle = rgba(pal.bg, 0.94 * level);
  ctx.fill();
  ctx.fillStyle = rgba(pal.ink, 0.3 * level);
  ctx.fill();
  // the lit arris, and the bare needle at the foot
  ctx.beginPath();
  ctx.moveTo(p.x + nx, p.y + ny);
  ctx.lineTo(q.x, q.y);
  ctx.strokeStyle = rgba(pal.ink, 0.78 * level);
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x - nx, p.y - ny);
  ctx.lineTo(q.x, q.y);
  ctx.strokeStyle = rgba(pal.key, 0.5 * level);
  ctx.lineWidth = 1;
  ctx.stroke();
}

const mix = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const plates = divide(f.mobile ? 6 : 8);
    return { plates, order: plates.map((_, i) => i), lift: plates.map(() => 0), a: [...REST[0]], b: [...REST[1]], grip: 0, sel: -1, since: 0 };
  },
  draw(f, s) {
    const { pal } = f;
    const n = s.plates.length;
    f.aim(0.36 + (f.still ? 0 : Math.sin(f.t * 0.08) * 0.05), 0.1, 6.4, 1);

    // ── which square the pointer is on: the nearest plate wins
    let sel = -1;
    if (f.hover > 0.02) {
      for (let i = 0; i < n && sel < 0; i++) {
        const p = s.plates[i];
        if (under(f, p.sx, p.sy, p.sx + p.s, p.sy + p.s, i * DZ)) sel = i;
      }
    }
    if (sel !== s.sel) {
      s.sel = sel;
      s.since = f.t;
    }
    const ease = f.still ? 1 : 1 - Math.exp(-f.dt * 6.5);
    for (let i = 0; i < n; i++) s.lift[i] += ((i === sel ? f.hover : 0) - s.lift[i]) * ease;
    const zOf = (i: number) => i * DZ - (i < n ? s.lift[i] * LIFT : 0);
    /** a point on plate i's arc; the arc leaves its own plate and arrives on the next, so the spiral is one line */
    const onArc = (i: number, u: number): V3 => {
      const p = s.plates[i];
      const a = p.a0 - (u * Math.PI) / 2;
      return [p.cx + Math.cos(a) * p.s, p.cy + Math.sin(a) * p.s, lerp(zOf(i), zOf(i + 1), u)];
    };

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [X0 + W * 0.55, FLOOR, 0.4], 2.3, pal.key, 0.2 * f.boot);

    // ── the stroke that redraws the lifted plate's arc: out along it, a rest while the line cools, back along it, and again
    const beat = sel < 0 ? 0 : (f.t - s.since) % 6;
    const stroke = beat < 3.9 ? easeInOut((beat - 0.35) / 2.1) : 1 - easeInOut((beat - 3.9) / 1.9);
    const struck = beat < 3.9 ? stroke : 1;
    const fade = 1 - clamp((beat - 3.1) / 0.8);

    // ── the plates, far to near; power-on draws the spiral from the outside in
    const drawn = n * (f.still ? 1 : easeInOut((f.boot - 0.25) / 0.75));
    const seg = Math.max(6, Math.round((f.mobile ? 10 : 16) * f.q));
    s.order.sort((i, j) => zOf(j) - zOf(i));
    for (const i of s.order) {
      const p = s.plates[i];
      const on = f.on((i / n) * 0.55, 0.3);
      if (on <= 0.003) continue;
      const k = s.lift[i];
      const z = zOf(i) + (1 - on) * 0.3;
      const quad: V3[] = [[p.x, p.y, z], [p.x + p.w, p.y, z], [p.x + p.w, p.y + p.h, z], [p.x, p.y + p.h, z]];
      // where it stands, ruled on the deck
      f.line([p.x, FLOOR, z], [p.x + p.w, FLOOR, z], k > 0.02 ? pal.gold : pal.ink, (0.14 + 0.5 * k) * on, 1);
      f.fill(quad, pal.bg, 0.07 * on);
      f.fill(quad, pal.ink, 0.04 * on);
      f.path(quad, pal.ink, 0.3 * on, 1, true);
      f.line(quad[3], quad[2], pal.key, 0.6 * on * (1 - k), 1.25);
      f.line([p.cut[0], p.cut[1], z], [p.cut[2], p.cut[3], z], pal.ink, 0.17 * on, 1);
      f.dot([p.cx, p.cy, z], 0.011, pal.ink, 0.4 * on);
      if (k > 0.01) {
        const sq: V3[] = [[p.sx, p.sy, z], [p.sx + p.s, p.sy, z], [p.sx + p.s, p.sy + p.s, z], [p.sx, p.sy + p.s, z]];
        f.fill(sq, pal.gold, 0.09 * k);
        f.path(quad, pal.gold, 0.5 * k, 1, true);
        f.path(sq, pal.gold, 0.95 * k, 1.5, true);
      }
      // the first cut is the ratio itself
      if (i === 0) {
        const top = p.y + p.h;
        f.line([p.cut[0], top, z], [p.cut[0], top + 0.07, z], pal.gold, 0.9 * on, 1.5);
        f.label("φ", [p.cut[0], top + 0.07, z], { align: "center", dy: f.mobile ? -9 : -12, size: f.mobile ? 13 : 17, weight: 500, display: true, colour: pal.gold, alpha: 0.95 * on });
      }

      // its quarter-arc
      const part = clamp(drawn - i);
      if (part <= 0.003) continue;
      const m = Math.max(1, Math.round(seg * part));
      const pts: V3[] = [];
      for (let j = 0; j <= m; j++) pts.push(onArc(i, j / seg));
      trace(f, pts, pal.gold, (0.8 - 0.45 * k) * on, 1.4);
      if (k > 0.01) {
        const upto = Math.floor(seg * struck);
        const lit: V3[] = [];
        for (let j = 0; j <= upto; j++) lit.push(onArc(i, j / seg));
        const at = onArc(i, stroke);
        lit.push(onArc(i, struck));
        f.path(lit, pal.gold, 0.3 * k * fade, 6);
        f.path(lit, pal.ink, 0.95 * k * fade, 2);
        // the radius it is struck with
        f.line([p.cx, p.cy, z], at, pal.gold, 0.3 * k, 1);
        lamp(f, at, pal.gold, k, 0.02);
      }
    }

    // one slow light runs the whole spiral
    if (!f.still && f.boot >= 1) {
      const g = ((f.t / 13 + f.rnd(3)) % 1) * n;
      const at = onArc(Math.min(n - 1, Math.floor(g)), g % 1);
      f.glow(at, 0.12, pal.gold, 0.55 * (1 - f.hover * 0.6));
      f.dot(at, 0.012, pal.ink, 0.9);
    }

    // ── the dividers: at rest on the deck, or set on the lifted square with one point on its arc
    const up = f.on(0.85, 0.3);
    const lead = sel >= 0 ? s.plates[sel] : null;
    const ta: V3 = lead ? [lead.cx, lead.cy, zOf(sel)] : REST[0];
    const tb: V3 = lead ? onArc(sel, stroke) : REST[1];
    const follow = f.still ? 1 : 1 - Math.exp(-f.dt * 5.5);
    for (let j = 0; j < 3; j++) {
      s.a[j] += (ta[j] - s.a[j]) * follow;
      s.b[j] += (tb[j] - s.b[j]) * follow;
    }
    s.grip += ((lead ? 1 : 0) - s.grip) * follow;
    const a: V3 = [s.a[0], s.a[1], s.a[2]];
    const b: V3 = [s.b[0], s.b[1], s.b[2]];
    const span = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 0.001;
    const e: V3 = [(b[0] - a[0]) / span, (b[1] - a[1]) / span, (b[2] - a[2]) / span];
    // the joint stands square to the line between the points: upright on the deck; on a plate it leans out
    // towards the viewer and ahead of the stroke, so the legs open as a V over the square they are measuring
    const lean = mix([0, 1, -0.1], [e[1] * 0.9, -e[0] * 0.9, -0.42], s.grip);
    const along = lean[0] * e[0] + lean[1] * e[1] + lean[2] * e[2];
    const nx = lean[0] - along * e[0];
    const ny = lean[1] - along * e[1];
    const nz = lean[2] - along * e[2];
    const nl = Math.hypot(nx, ny, nz) || 1;
    const rise = Math.sqrt(Math.max(0.02, LEG * LEG - (span * span) / 4)) * (0.6 + 0.4 * up);
    const mid = mix(a, b, 0.5);
    const joint: V3 = [mid[0] + (nx / nl) * rise, mid[1] + (ny / nl) * rise, mid[2] + (nz / nl) * rise];
    const knob: V3 = [joint[0] + (nx / nl) * 0.17, joint[1] + (ny / nl) * 0.17, joint[2] + (nz / nl) * 0.17];
    if (up > 0.003) {
      pool(f, mix(REST[0], REST[1], 0.5), 0.62, pal.gold, 0.16 * up * (1 - s.grip));
      leg(f, joint, a, up);
      leg(f, joint, b, up);
      // the wing: a bar across the legs, with its lock screw
      const wa = mix(joint, a, 0.34);
      const wb = mix(joint, b, 0.42);
      f.line(wa, wb, pal.ink, 0.5 * up, 1.25);
      f.dot(wa, 0.016, pal.ink, 0.8 * up);
      // the joint and its handle
      f.line(joint, knob, pal.ink, 0.62 * up, 3.5);
      f.line(joint, knob, pal.bg, 0.5 * up, 1);
      f.dot(joint, 0.05, pal.bg, up);
      f.dot(joint, 0.05, pal.ink, 0.3 * up);
      lamp(f, joint, pal.gold, up * (0.55 + 0.45 * s.grip), 0.018);
      f.dot(a, 0.012, pal.ink, 0.85 * up);
      f.dot(b, 0.012, pal.ink, 0.85 * up);
    }
  },
};

export default scene;

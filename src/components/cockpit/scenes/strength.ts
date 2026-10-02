/**
 * CURRENCY STRENGTH — the balance.
 *
 * Eight currencies stand as eight glass pillars of exactly the same height, in
 * a ring on a smoked-glass plate. Every pair is joined across the centre: 28
 * chords, the 28 comparisons a strength meter makes, engraved in the pane the
 * pillars carry. One pulse of light walks the web a chord at a time (each pair
 * once per round, nobody favoured), and a spirit level floats above it all,
 * dead level: the instrument measures, it does not predict. There are no
 * values here, and no pillar is ever taller than another.
 */
import { TAU, clamp, easeInOut, easeOut, rgba, type Frame, type Scene, type V3 } from "../engine";
import { callouts, deck, pool, ring, trace, type Callout } from "../kit";

const CODES = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"];
const N = CODES.length;
const FLOOR = -1.3;
/** every pillar ends here: equal height is the whole point */
const CAP = -0.35;
const LEVEL = 0.5;
const RING = 1.2;
const ROD = 0.092;
const HALO = 0.8;
const PLATE = RING + 0.27;
/** seconds one comparison lasts */
const LEG = 7.5;

type Post = { x: number; z: number; code: string; depth: number };
type Hoop = { x: number; y: number; rx: number; ry: number };
type State = { posts: Post[]; back: number[]; front: number[]; chords: [number, number, number][]; route: [number, number][]; start: number; plate: V3[] };

/** a small horizontal circle as the screen ellipse it projects to */
function hoop(f: Frame, x: number, y: number, z: number, r: number): Hoop | null {
  const p = f.P(x, y, z);
  const q = f.P(x, y, z - r);
  if (!p || !q) return null;
  return { x: p.x, y: p.y, rx: Math.max(0.5, r * p.s * f.u), ry: Math.max(0.5, Math.abs(q.y - p.y)) };
}
const oval = (f: Frame, h: Hoop, k = 1, from = 0, to = TAU, ccw = false): void => {
  f.ctx.beginPath();
  f.ctx.ellipse(h.x, h.y, h.rx * k, h.ry * k, 0, from, to, ccw);
};
const tint = (f: Frame, colour: string | CanvasGradient, alpha = 1): void => {
  f.ctx.fillStyle = typeof colour === "string" ? rgba(colour, alpha) : colour;
  f.ctx.fill();
};
const edge = (f: Frame, colour: string, alpha: number, width = 1): void => {
  f.ctx.strokeStyle = rgba(colour, alpha);
  f.ctx.lineWidth = width;
  f.ctx.stroke();
};
function seg(f: Frame, x0: number, y0: number, x1: number, y1: number, colour: string, alpha: number, width = 1): void {
  f.ctx.beginPath();
  f.ctx.moveTo(x0, y0);
  f.ctx.lineTo(x1, y1);
  edge(f, colour, alpha, width);
}

/** a rod of smoked glass with a lit cap: light enters at the top and fades down the glass */
function pillar(f: Frame, p: Post, top: number, lit: number, part: "glass" | "cap" | "all"): void {
  const { ctx, pal } = f;
  const t = hoop(f, p.x, top, p.z, ROD);
  const b = hoop(f, p.x, FLOOR, p.z, ROD);
  if (!t || !b) return;
  const d = p.depth * f.boot;
  if (part !== "cap") {
    // one gradient serves the glass and its reflection in the plate below it
    const m = f.q > 0.8 && !f.mobile ? f.P(p.x, FLOOR - 0.3, p.z) : null;
    const end = m ? m.y : b.y;
    const kb = clamp((b.y - t.y) / Math.max(1, end - t.y), 0.05, 1);
    const g = ctx.createLinearGradient(0, t.y, 0, end);
    g.addColorStop(0, rgba(pal.key, (0.38 + 0.2 * lit) * d));
    g.addColorStop(0.5 * kb, rgba(pal.key, (0.15 + 0.08 * lit) * d));
    g.addColorStop(0.88 * kb, rgba(pal.key, 0.09 * d));
    g.addColorStop(kb, rgba(pal.key, 0.2 * d));
    if (m) {
      g.addColorStop(1, rgba(pal.key, 0));
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(b.x - b.rx, b.y);
      ctx.lineTo(m.x - b.rx * 0.95, m.y);
      ctx.lineTo(m.x + b.rx * 0.95, m.y);
      ctx.lineTo(b.x + b.rx, b.y);
      tint(f, g);
      ctx.globalAlpha = 1;
    }
    // the socket it stands in, then the glass
    oval(f, b, 1.9);
    edge(f, pal.ink, 0.22 * d);
    oval(f, t, 1, 0, Math.PI);
    ctx.lineTo(b.x - b.rx, b.y);
    ctx.ellipse(b.x, b.y, b.rx, b.ry, 0, Math.PI, 0, true);
    ctx.closePath();
    tint(f, pal.bg, 0.5 * f.boot);
    tint(f, g);
    // a shaded flank, fresnel rims and one specular streak: a cylinder, not a strip
    seg(f, t.x + t.rx * 0.45, t.y + t.ry, b.x + b.rx * 0.45, b.y + b.ry * 0.5, pal.bg, 0.22 * f.boot, t.rx * 0.6);
    seg(f, t.x - t.rx, t.y, b.x - b.rx, b.y, pal.ink, 0.42 * d);
    seg(f, t.x + t.rx, t.y, b.x + b.rx, b.y, pal.ink, 0.24 * d);
    seg(f, t.x - t.rx * 0.42, t.y + t.ry * 0.9, b.x - b.rx * 0.42, b.y + b.ry * 0.9, pal.ink, 0.14 * d, Math.max(1, t.rx * 0.3));
    oval(f, b, 1, Math.PI, 0, true);
    edge(f, pal.ink, 0.36 * d);
  }
  if (part === "glass") return;
  // the cap: a machined, illuminated end; while it is being compared its bezel lights
  const c = (0.8 + 0.2 * p.depth) * f.boot;
  if (lit > 0.01) {
    oval(f, t, 1.75);
    edge(f, pal.gold, 0.14 * lit * c, t.rx * 0.9);
    edge(f, pal.gold, 0.6 * lit * c);
  }
  oval(f, t, 1.1);
  tint(f, pal.bg, 0.7 * f.boot);
  tint(f, pal.key, (0.26 + 0.3 * lit) * c);
  edge(f, pal.key, (0.76 + 0.22 * lit) * c, 1.25);
  oval(f, t, 0.42);
  tint(f, pal.ink, (0.6 + 0.35 * lit) * c);
}

/** the spirit level's vial: a glass capsule, two hairlines, and the bubble exactly between them */
function vial(f: Frame, y: number, half: number, r: number, on: number): void {
  const { ctx, pal } = f;
  const c = f.P(0, y, 0);
  const e = f.P(half, y, 0);
  if (!c || !e || on <= 0.003) return;
  const hw = Math.hypot(e.x - c.x, e.y - c.y);
  const hr = r * c.s * f.u;
  const bw = hr * 1.25;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(Math.atan2(e.y - c.y, e.x - c.x));
  ctx.beginPath();
  ctx.moveTo(-hw + hr, -hr);
  ctx.lineTo(hw - hr, -hr);
  ctx.arc(hw - hr, 0, hr, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-hw + hr, hr);
  ctx.arc(-hw + hr, 0, hr, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
  tint(f, pal.bg, 0.85 * on);
  const g = ctx.createLinearGradient(0, -hr, 0, hr);
  g.addColorStop(0, rgba(pal.gold, 0.46 * on));
  g.addColorStop(0.45, rgba(pal.gold, 0.13 * on));
  g.addColorStop(1, rgba(pal.gold, 0.28 * on));
  tint(f, g);
  edge(f, pal.ink, 0.55 * on);
  for (const k of [-1, 1]) seg(f, k * (bw + 2.5), -hr, k * (bw + 2.5), hr, pal.ink, 0.7 * on);
  seg(f, -hw + hr * 1.2, -hr * 0.55, hw - hr * 1.2, -hr * 0.55, pal.ink, 0.24 * on);
  ctx.beginPath();
  ctx.ellipse(0, 0, bw, hr * 0.62, 0, 0, TAU);
  tint(f, pal.bg, 0.6 * on);
  tint(f, pal.ink, 0.1 * on);
  edge(f, pal.gold, 0.95 * on * (f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 0.8)), 1.25);
  ctx.restore();
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    // which currency stands where differs per page; the ring itself never changes
    const lead = Math.floor(f.rnd(3) * N);
    const posts: Post[] = [];
    for (let i = 0; i < N; i++) {
      const a = ((i + 0.5) / N) * TAU;
      const z = -Math.cos(a) * RING;
      posts.push({ x: Math.sin(a) * RING, z, code: CODES[(i + lead) % N], depth: clamp(0.86 - (z / RING) * 0.2, 0.6, 1) });
    }
    const chords: [number, number, number][] = [];
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) chords.push([i, j, Math.min(j - i, N - j + i)]);
    // four zigzag walks cover all 28 pairs exactly once: each pair is compared once a round
    const route: [number, number][] = [];
    for (let j = 0; j < N / 2; j++) {
      let at = j;
      for (let k = 1; k < N; k++) {
        const to = (j + (k % 2 ? (k + 1) / 2 : -k / 2) + N) % N;
        route.push([at, to]);
        at = to;
      }
    }
    const plate: V3[] = [];
    for (let i = 0; i < 56; i++) plate.push([Math.cos((i / 56) * TAU) * PLATE, FLOOR, Math.sin((i / 56) * TAU) * PLATE]);
    const order = posts.map((_, i) => i).sort((a, b) => posts[b].z - posts[a].z);
    return { posts, back: order.filter((i) => posts[i].z > 0), front: order.filter((i) => posts[i].z <= 0), chords, route, start: Math.floor(f.rnd(7) * route.length), plate };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    // the one scene seen from above: the web lies flat, so the camera looks down on it.
    // On a phone the instrument is centred and hung from the top of the stage.
    if (f.mobile) f.cx = f.w * 0.5;
    const zoom = f.mobile ? 0.7 : clamp((f.w - f.cx - 48) / (f.u * 1.62), 0.5, 0.88);
    f.aim(Math.sin(f.t * 0.07) * 0.05, -0.36, 7.2, zoom);
    f.cy += f.mobile ? 22 + f.u * 0.49 - f.h * 0.36 : -f.u * zoom * 0.68;

    deck(f, { y: FLOOR, alpha: 0.08, half: 4.5 });

    // the plate: smoked glass with a graduated rim, one major mark per currency
    f.fill(s.plate, pal.bg, 0.5 * f.boot);
    f.fill(s.plate, pal.key, 0.03 * f.boot);
    pool(f, [0, FLOOR, 0], 2.5, pal.key, 0.2 * f.boot);
    ring(f, [0, FLOOR, 0], RING, { colour: pal.ink, alpha: 0.09 * f.boot });
    ring(f, [0, FLOOR, 0], PLATE, { colour: pal.ink, alpha: 0.28 * f.boot, ticks: f.mobile ? 0 : f.q > 0.8 ? 48 : 24, major: f.q > 0.8 ? 6 : 3, tickLen: 0.055, rot: -TAU * 0.1875 });
    ring(f, [0, FLOOR - 0.05, 0], PLATE, { colour: pal.key, alpha: 0.55 * f.on(0.2), from: 0.57, to: 0.93, width: 1.5 });

    // which pair is being compared: the walk moves on every LEG seconds, once the instrument is up
    const clock = f.still ? 0.5 : Math.max(0, (f.t - 2.2) / LEG);
    const [from, to] = s.route[(Math.floor(clock) + s.start) % s.route.length];
    const k = clock % 1;
    const live = easeInOut(k / 0.14) * easeInOut((1 - k) / 0.14);
    // both ends answer equally while the light is on its way; a still frame keeps all eight caps identical
    const lit = (i: number) => (!f.still && (i === from || i === to) ? live : 0);

    // all eight rise together: at no instant is one taller than another
    const top = FLOOR + (CAP - FLOOR) * easeOut(f.boot / 0.55);
    for (const i of s.back) pillar(f, s.posts[i], top, lit(i), "glass");

    // the pane the pillars carry: optical glass with a slow sheen, its eight edges lit
    const webOn = clamp((f.boot - 0.35) / 0.55);
    const rim: V3[] = s.posts.map((p) => [p.x, top, p.z]);
    const p0 = f.P(-RING, top, RING);
    const p1 = f.P(RING, top, -RING);
    f.fill(rim, pal.bg, 0.34 * webOn);
    if (p0 && p1) {
      const band = clamp(0.4 + f.px * 0.2 + (f.still ? 0 : Math.sin(f.t * 0.21) * 0.06), 0.24, 0.8);
      const g = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
      g.addColorStop(0, rgba(pal.key, 0.05 * webOn));
      g.addColorStop(band - 0.2, rgba(pal.ink, 0.015 * webOn));
      g.addColorStop(band, rgba(pal.ink, 0.085 * webOn));
      g.addColorStop(band + 0.16, rgba(pal.ink, 0.015 * webOn));
      g.addColorStop(1, rgba(pal.key, 0.07 * webOn));
      ctx.beginPath();
      for (const v of rim) {
        const q = f.P(v[0], v[1], v[2]);
        if (q) ctx.lineTo(q.x, q.y);
      }
      ctx.closePath();
      tint(f, g);
    }
    f.path(rim, pal.teal, 0.1 * webOn, 5, true);

    // the web: every pair joined, 28 chords engraved in the pane
    s.chords.forEach(([i, j, span], n) => {
      const on = easeOut(webOn * 1.6 - (n / s.chords.length) * 0.6);
      if (on <= 0) return;
      const a = s.posts[i];
      const b = s.posts[j];
      const far = clamp(0.92 - ((a.z + b.z) / 2 / RING) * 0.3, 0.5, 1.1);
      f.line([a.x, top, a.z], [a.x + (b.x - a.x) * on, top, a.z + (b.z - a.z) * on], span === 1 ? pal.teal : pal.ink, (span === 1 ? 0.62 : span === 4 ? 0.3 : 0.2) * far, span === 1 ? 1.25 : 1);
    });
    f.dot([0, top, 0], 0.016, pal.ink, 0.7 * webOn);

    // the comparison being made: one chord lit, one pulse crossing it
    if (live > 0.01) {
      const a = s.posts[from];
      const b = s.posts[to];
      trace(f, [[a.x, top, a.z], [b.x, top, b.z]], pal.gold, 0.85 * live, 1.5);
      // composed still: the pulse rests at the exact midpoint, favouring neither end
      const u = f.still ? 0.5 : easeInOut((k - 0.08) / 0.84);
      const p: V3 = [a.x + (b.x - a.x) * u, top, a.z + (b.z - a.z) * u];
      f.glow(p, 0.17, pal.gold, 0.85 * live);
      f.dot(p, 0.014, pal.ink, live);
    }
    for (const i of s.back) pillar(f, s.posts[i], top, lit(i), "cap");
    for (const i of s.front) pillar(f, s.posts[i], top, lit(i), "all");

    // the spirit level: a plumb line, a graduated ring, a beam across it, the vial at its centre
    const lv = f.on(0.85, 0.3);
    const y = LEVEL + (1 - lv) * 0.14;
    const w = 0.02;
    f.line([0, y, 0], [0, top, 0], pal.ink, 0.13 * lv, 1);
    ring(f, [0, y, 0], HALO, { colour: pal.ink, alpha: 0.32 * lv, ticks: Math.round((f.mobile ? 24 : 60) * f.q), major: 5, tickLen: 0.045, rot: f.still ? 0 : f.t * 0.015 });
    ring(f, [0, y, 0], HALO + 0.07, { colour: pal.ink, alpha: 0.1 * lv });
    for (const side of [0, 0.5]) ring(f, [0, y, 0], HALO + 0.07, { colour: pal.gold, alpha: 0.75 * lv, from: side - 0.055, to: side + 0.055, width: 1.5 });
    f.fill([[-HALO, y, -w], [HALO, y, -w], [HALO, y, w], [-HALO, y, w]], pal.gold, 0.14 * lv);
    f.line([-HALO, y, w], [HALO, y, w], pal.ink, 0.25 * lv, 1);
    f.line([-HALO, y, -w], [HALO, y, -w], pal.gold, 0.7 * lv, 1.25);
    vial(f, y, 0.25, 0.055, lv);

    // names: outside the ring, beside each pillar (a phone keeps the four nearest; none may reach the headline)
    const out = (RING + ROD + 0.05) / RING;
    const names: Callout[] = [];
    for (const p of s.posts) {
      const at: V3 = [p.x * out, top + (p.z > 0 ? 0.08 : p.z < -RING * 0.7 ? -0.3 : -0.12), p.z * out];
      const q = f.P(at[0], at[1], at[2]);
      if (!q || (f.mobile ? p.z > 0 : q.x - 46 < Math.max(f.w * 0.45, 610))) continue;
      names.push({ text: p.code, p: at, alpha: 0.85 * f.on(0.6, 0.3) });
    }
    callouts(f, names, f.mobile ? { size: 10, reach: 9 } : { size: 11, reach: 14 });
  },
};

export default scene;

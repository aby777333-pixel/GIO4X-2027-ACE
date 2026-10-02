/**
 * COPY TRADING — formation flight.
 *
 * One course through the air, flown first by the provider and then, a little
 * later, by every follower. The camera flies with the formation, so the heads
 * hold their stations while the course streams back past them: the provider's
 * lamp leads, each follower's lamp sits further back along the very same shape,
 * and that distance is the delay. Wherever the provider acts, a small mark is
 * left on the course; each follower lays the same mark when it gets there.
 *
 * A blade of glass hangs from the provider's course, and each follower's
 * station is engraved in it: the gaps between the engravings are the delay.
 * There is no market in this picture: no price, no result, no scale. Only the
 * mechanism, drawn honestly.
 */
import { TAU, clamp, easeOut, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, orb, ring } from "../kit";

/** along-track station of the provider's head, and where the trails have died away */
const HEAD = 1.3;
const TAIL = -1.5;
const FLOOR = -1.3;
/** world units of course flown per second: slow enough to watch the lag */
const SPEED = 0.1;
/** the provider acts once every so far along the course */
const EVERY = 1.0;
/** the formation sits a little to the far side of the deck; depth of the glass blade under the course */
const MID = 0.3;
const BLADE = 0.5;

type Wing = { lag: number; dy: number; lat: number };
type State = { phase: number; wings: Wing[] };

/** formation space (along-track, height, lateral) to world: the formation flies toward the viewer's right */
const W = (a: number, y: number, lat: number): V3 => [lat, y, -a];

/** the course itself: a fixed, gentle shape. Returns [climb, weave] at path distance s */
const course = (s: number, ph: number): [number, number] => [
  0.25 * Math.sin(1.25 * s + ph) + 0.06 * Math.sin(2.6 * s + ph * 1.7),
  0.3 * Math.sin(0.8 * s + ph * 0.6 + 1.1),
];

/** light dies away toward the tail, so nothing reaches the headline */
const fade = (a: number) => {
  const k = clamp((a - TAIL - 0.3) / 1.3);
  return k * k * (3 - 2 * k);
};

/** a screen-space gradient that carries that same fade along every trail */
function along(f: Frame, from: V3, to: V3, colour: string): CanvasGradient | null {
  const a = f.P(from[0], from[1], from[2]);
  const b = f.P(to[0], to[1], to[2]);
  if (!a || !b) return null;
  const g = f.ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  g.addColorStop(0.08, rgba(colour, 0));
  g.addColorStop(0.36, rgba(colour, 0.34));
  g.addColorStop(0.66, rgba(colour, 0.88));
  g.addColorStop(1, rgba(colour, 1));
  return g;
}

/**
 * Draw a trail with a prepared light. width > 0 strokes it (lowered by `drop`,
 * or laid flat at height `flat`: its shadow on the deck); width 0 fills the
 * ribbon of glass between the trail and the same trail `drop` lower.
 */
function run(f: Frame, pts: readonly V3[], light: CanvasGradient, alpha: number, width: number, drop = 0, flat?: number): void {
  const { ctx } = f;
  const n = pts.length;
  const m = width > 0 ? n : n * 2;
  ctx.beginPath();
  for (let i = 0; i < m; i++) {
    const q = pts[i < n ? i : m - 1 - i];
    const p = f.P(q[0], flat ?? (width > 0 || i >= n ? q[1] - drop : q[1]), q[2]);
    if (!p) return;
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.globalAlpha = alpha;
  if (width > 0) {
    ctx.strokeStyle = light;
    ctx.lineWidth = width;
    ctx.stroke();
  } else {
    ctx.fillStyle = light;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** light on the deck under the formation. The kit's pool assumes a head-on camera; this deck is seen abeam */
function spill(f: Frame, c: V3, r: number, colour: string, alpha: number): void {
  const p = f.P(c[0], c[1], c[2]);
  if (!p || alpha <= 0.003) return;
  const { ctx } = f;
  const rx = r * p.s * f.u;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(colour, alpha));
  g.addColorStop(0.55, rgba(colour, alpha * 0.28));
  g.addColorStop(1, rgba(colour, 0));
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1, Math.max(0.12, Math.abs(Math.sin(f.cam.pitch))));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const n = f.mobile ? 4 : 5;
    // which wing the first follower takes differs from page to page
    const flip = f.rnd(3) > 0.5 ? 1 : -1;
    const wings: Wing[] = [];
    for (let i = 0; i < n; i++) {
      const rank = Math.floor(i / 2) + 1;
      const side = (i % 2 ? 1 : -1) * flip;
      // the formation leans toward the viewer: the far wing a little higher, the near wing a little lower
      wings.push({ lag: 0.27 + i * 0.185 + (f.rnd(10 + i) - 0.5) * 0.05, dy: side * 0.045 * rank, lat: side * 0.33 * rank });
    }
    return { phase: f.rnd(1) * TAU, wings };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    // seen from above and abeam: the formation flies past, left to right, a little toward the viewer
    f.aim(-1.33 + Math.sin(f.t * 0.08) * 0.035, -0.34, 6, f.mobile ? 0.66 : 0.92);
    if (f.mobile) f.cx = f.w * 0.48;
    else {
      f.cx -= f.u * 0.1;
      f.cy -= f.u * 0.22;
    }
    const level = f.mobile ? 0.32 : -0.12;

    // the ground passes beneath at exactly the speed the course streams back
    deck(f, { y: FLOOR, alpha: f.mobile ? 0.07 : 0.1, drift: -SPEED });
    spill(f, W(0.5, FLOOR, MID), 1.9, pal.key, (f.mobile ? 0.1 : 0.22) * f.boot);

    const sh = s.phase * 3 + f.t * SPEED;
    const step = f.mobile ? 0.12 : 0.07 / Math.max(0.6, f.q);

    /** a point of the course as flown `dy` higher and `lat` to the side, seen at station a */
    const at = (a: number, dy: number, lat: number): V3 => {
      const c = course(sh - (HEAD - a), s.phase);
      return W(a, level + c[0] + dy, MID + c[1] + lat);
    };
    /** the trail from the tail up to station `head` */
    const trail = (head: number, dy: number, lat: number): V3[] => {
      const pts: V3[] = [];
      for (let a = TAIL; a < head - 0.001; a += step) pts.push(at(a, dy, lat));
      pts.push(at(head, dy, lat));
      return pts;
    };
    /** the marks left where the provider acted, repeated by whoever has reached them */
    const marks = (head: number, dy: number, lat: number, colour: string, lvl: number, r: number) => {
      for (let k = Math.ceil((sh - (HEAD - TAIL)) / EVERY); k * EVERY < sh; k++) {
        const a = HEAD - (sh - k * EVERY);
        const lit = clamp((head - a) / 0.14) * fade(a - 0.3) * lvl;
        if (lit <= 0.01) continue;
        const p = at(a, dy, lat);
        f.dot(p, r * 2.6, colour, 0.2 * lit);
        f.dot(p, r, pal.ink, 0.8 * lit);
      }
    };

    // one fade for every trail: full at the heads, gone before the headline
    // the provider wears the key light, the followers teal (blue in the hours when the key light is itself teal)
    const tone = pal.key === pal.teal ? pal.blue : pal.teal;
    const key = along(f, at(TAIL, 0, 0), at(HEAD, 0, 0), pal.key);
    const teal = along(f, at(TAIL, 0, 0), at(HEAD, 0, 0), tone);
    if (!key || !teal) return;

    const follower = (w: Wing, i: number) => {
      // each follower flies in along the course and takes its station behind the provider
      const on = f.on(0.2 + (i / s.wings.length) * 0.7, 0.5);
      if (on <= 0.003) return;
      const head = TAIL + (HEAD - w.lag - TAIL) * on;
      const depth = clamp(0.86 - w.lat * 0.3, 0.5, 1);
      const pts = trail(head, w.dy, w.lat);
      const hp = pts[pts.length - 1];
      ctx.save();
      if (!f.mobile) run(f, pts, teal, 0.16 * depth, 1, 0, FLOOR);
      // its own narrow ribbon of glass, so the trail reads as a body and not a wire
      for (let k = 1; k <= 3; k++) run(f, pts, teal, 0.03 * depth, 0, 0.05 * k);
      run(f, pts, teal, 0.12 * depth, 6);
      run(f, pts, teal, 0.72 * depth, 1.3);
      ctx.restore();
      marks(head, w.dy, w.lat, tone, depth * on, 0.007);
      ring(f, hp, 0.075, { colour: tone, alpha: 0.5 * on * depth, seg: 26 });
      lamp(f, hp, tone, on * depth, 0.019);
    };

    // far side of the formation first, the farthest of all before the rest
    for (let i = s.wings.length - 1; i >= 0; i--) if (s.wings[i].lat > 0) follower(s.wings[i], i);

    // ── the provider: the course is flown here first
    const lead = f.on(0, 0.8);
    const head = TAIL + (HEAD - TAIL) * lead;
    const pts = trail(head, 0, 0);
    const hp = pts[pts.length - 1];
    const foot: V3 = [hp[0], FLOOR, hp[2]];
    ctx.save();
    // a blade of glass hangs from the course: densest under its lit top edge, clearing toward the lower one
    const bands = Math.round((f.mobile ? 4 : 7) * Math.max(0.7, f.q));
    for (let k = 1; k <= bands; k++) run(f, pts, key, (0.29 / bands) * lead, 0, BLADE * Math.pow(k / bands, 1.5));
    run(f, pts, key, 0.2 * lead, 1, BLADE);
    if (!f.mobile) run(f, pts, key, 0.3 * lead, 1, 0, FLOOR);
    run(f, pts, key, 0.16, 8);
    run(f, pts, key, 0.95, 1.9);
    ctx.restore();
    // the blade's leading edge, and a plumb line down to the provider's place over the deck
    f.line(hp, [hp[0], hp[1] - BLADE, hp[2]], pal.key, 0.55 * lead, 1.25);
    if (!f.mobile) {
      f.line([hp[0], hp[1] - BLADE, hp[2]], foot, pal.key, 0.16 * lead, 1);
      f.dot(foot, 0.04, pal.key, 0.14 * lead);
      f.dot(foot, 0.015, pal.key, 0.9 * lead);
    }
    const cut = easeOut((f.boot - 0.8) / 0.2);
    if (!f.mobile && cut > 0) {
      // each follower's station engraved in the glass: the gaps are the delay
      for (const w of s.wings) {
        const p = at(HEAD - w.lag, 0, 0);
        f.line([p[0], p[1] - 0.03, p[2]], [p[0], p[1] - 0.2, p[2]], pal.ink, 0.3 * cut, 1);
      }
      // and one dimension line, from the provider back to the first follower
      const p0 = at(HEAD - s.wings[0].lag, 0, 0);
      const y = Math.min(p0[1], hp[1]) - 0.3;
      f.line([p0[0], y, p0[2]], [hp[0], y, hp[2]], pal.ink, 0.55 * cut, 1);
      f.line([p0[0], y + 0.04, p0[2]], [p0[0], y - 0.04, p0[2]], pal.ink, 0.55 * cut, 1);
      f.label("DELAY", [(p0[0] + hp[0]) / 2, y, (p0[2] + hp[2]) / 2], { align: "center", dy: 11, size: 9, alpha: 0.62 * cut, colour: pal.ink2 });
    }
    marks(head, 0, 0, pal.key, lead, 0.01);
    // the provider's head: a lamp in a bead of glass, inside a graduated bezel
    const turn = f.still ? 0 : f.t * 0.05;
    ring(f, hp, 0.17, { colour: pal.key, alpha: 0.6 * lead, ticks: 24, major: 6, tickLen: 0.025, seg: 48, rot: turn });
    ring(f, hp, 0.235, { colour: pal.ink, alpha: 0.3 * lead, from: 0.06, to: 0.44, seg: 48, rot: -turn });
    ring(f, hp, 0.235, { colour: pal.ink, alpha: 0.3 * lead, from: 0.56, to: 0.94, seg: 48, rot: -turn });
    orb(f, hp, 0.085, pal.key, lead);
    const breathe = f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 0.9);
    lamp(f, hp, pal.key, lead * breathe, 0.03);

    // near side of the formation last
    s.wings.forEach((w, i) => {
      if (w.lat <= 0) follower(w, i);
    });

    // ── lettering: who is who, said once
    const say = easeOut((f.boot - 0.85) / 0.15);
    const size = f.mobile ? 9 : 10;
    // set a little ahead of the head, clear of the first follower on the far wing
    f.label("PROVIDER", hp, { align: "left", dx: f.mobile ? -2 : -14, dy: f.mobile ? -27 : -34, size, alpha: 0.85 * say, colour: pal.ink });
    // the followers are named above the farthest of them, where the sky is clear
    const far = s.wings.reduce((m, x) => (x.lat > m.lat ? x : m), s.wings[0]);
    f.label("FOLLOWERS", at(HEAD - far.lag, far.dy, far.lat), { align: "center", dy: f.mobile ? -15 : -20, size, alpha: 0.75 * say, colour: tone });
  },
};

export default scene;

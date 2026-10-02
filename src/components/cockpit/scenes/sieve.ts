/**
 * SIEVE — the screening column.
 *
 * The policy as apparatus: a feed cone over three ring sieves of graded mesh,
 * coarse to fine, on three slender posts, with a tray beneath. Small tokens
 * drift down through the column. Most pass every tier and come to rest in the
 * tray; now and then one is stopped on a tier, slid out along a chute and left
 * on that tier's shelf, in champagne, for a closer look. The tiers carry the
 * names of the policy's own steps.
 *
 * The pointer works the column. The tier nearest to it brightens and its mesh
 * draws visibly tighter; and the token the pointer comes upon is lifted out of
 * the stream and held in a small ring of light until the pointer moves on,
 * when it is let fall again from where it was taken.
 *
 * Nothing here is a count, a rate or a finding: how many tokens fall and how
 * many are set aside says nothing about clients.
 */
import { TAU, clamp, easeInOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, pool, ring, trace } from "../kit";

/** the column's axis, the radius of a sieve and the depth of its hoop */
const CX = -0.02;
const R = 0.72;
const HOOP = 0.07;
/** three tiers, top to bottom: height, mesh pitch, and the policy's name for the step */
const TIERS = [0.6, 0.1, -0.4];
const MESH = [0.22, 0.15, 0.1];
const NAMES = ["IDENTITY", "MONITORING", "REPORTING"];
/** where tokens enter, the floor of the tray they end on, and how many are in the stream */
const YIN = 1.04;
const TRAY = -0.94;
const STREAM = 30;
const POSTS = [0, TAU / 3, (2 * TAU) / 3];

type Token = { a: number; r: number; ph: number; T: number; tier: number; slot: number; spin: number };
type Place = { p: V3; alpha: number; gold: number; flat: boolean };
type State = { tokens: Token[]; lag: number[]; circ: [number, number][]; rest: V3[]; held: number; keep: boolean; grip: number; since: number; after: number };

/** where a token is at time t: falling, lying in the tray, or set aside on a shelf */
function place(k: Token, t: number): Place {
  const u = (((t / k.T + k.ph) % 1) + 1) % 1;
  const alpha = clamp(u / 0.05) * clamp((1 - u) / 0.06);
  // tokens leave the cone close together and spread as they fall
  const at = (y: number): V3 => {
    const wide = lerp(0.45, 1, clamp((YIN - y) / 0.5));
    return [CX + Math.cos(k.a) * k.r * wide, y, Math.sin(k.a) * k.r * wide];
  };
  if (k.tier < 0) {
    const e = clamp(u / 0.86);
    return { p: at(lerp(YIN, TRAY + 0.03, e)), alpha, gold: 0, flat: e >= 1 };
  }
  const ty = TIERS[k.tier] + 0.035;
  const fall = (YIN - ty) * 0.172;
  if (u < fall) return { p: at(lerp(YIN, ty, u / fall)), alpha, gold: 0, flat: false };
  // stopped: out along the chute to its place on the shelf
  const out = easeInOut((u - fall) / 0.06);
  const from = at(ty);
  return { p: [lerp(from[0], CX + R + 0.28 + k.slot * 0.18, out), ty + Math.sin(Math.PI * out) * 0.05, lerp(from[2], 0, out)], alpha, gold: out, flat: true };
}

/** many separate strokes of one tone, in a single path */
function strokes(f: Frame, segs: readonly (readonly [V3, V3])[], colour: string, alpha: number, width = 1): void {
  if (alpha <= 0.003) return;
  const { ctx } = f;
  ctx.beginPath();
  for (const [a, b] of segs) {
    const p = f.P(a[0], a[1], a[2]);
    const q = f.P(b[0], b[1], b[2]);
    if (!p || !q) continue;
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
  }
  ctx.strokeStyle = rgba(colour, alpha);
  ctx.lineWidth = width;
  ctx.stroke();
}

/** a token: a small coin seen from above, tumbling while it falls and flat once it lies */
function coin(f: Frame, k: Token, at: Place, level: number, bright = 0): void {
  const p = f.P(at.p[0], at.p[1], at.p[2]);
  const a = at.alpha * level;
  if (!p || a <= 0.01) return;
  const { ctx, pal } = f;
  const rx = Math.max(1.8, 0.041 * p.s * f.u);
  const turn = at.flat || f.still ? 0 : f.t * 0.7 + k.spin;
  const ry = Math.max(1, rx * (at.flat ? 0.4 : 0.4 + 0.42 * Math.abs(Math.sin(turn))));
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx, ry, at.flat ? 0 : Math.sin(turn * 0.6) * 0.5, 0, TAU);
  ctx.fillStyle = rgba(pal.bg, 0.9 * a);
  ctx.fill();
  ctx.fillStyle = rgba(pal.ink, (0.34 + 0.4 * bright) * (1 - at.gold) * a);
  ctx.fill();
  ctx.fillStyle = rgba(pal.gold, 0.7 * at.gold * a);
  ctx.fill();
  ctx.strokeStyle = rgba(at.gold > 0.5 ? pal.gold : pal.ink, (0.75 + 0.25 * bright) * a);
  ctx.lineWidth = 1;
  ctx.stroke();
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const tokens: Token[] = [];
    const n = f.mobile ? 14 : STREAM;
    for (let i = 0; i < n; i++) tokens.push({ a: f.rnd(i * 3 + 1) * TAU, r: 0.08 + 0.46 * Math.sqrt(f.rnd(i * 3 + 2)), ph: (i + f.rnd(i * 3 + 3)) / n, T: 10 + 5 * f.rnd(i + 90), tier: -1, slot: 0, spin: f.rnd(i + 50) * TAU });
    // the few that are stopped: each tier has its own, and they take turns on its shelf
    const per = f.mobile ? 1 : 2;
    for (let c = 0; c < TIERS.length; c++) {
      for (let j = 0; j < per; j++) tokens.push({ a: f.rnd(c * 7 + j + 200) * TAU, r: 0.1 + 0.3 * f.rnd(c * 7 + j + 230), ph: (0.3 + c * 0.11 + j * 0.4) % 1, T: 30, tier: c, slot: j, spin: 0 });
    }
    const seg = f.mobile ? 28 : 44;
    const circ: [number, number][] = [];
    for (let i = 0; i < seg; i++) circ.push([Math.cos((i / seg) * TAU), Math.sin((i / seg) * TAU)]);
    // what already lies in the tray
    const rest: V3[] = [];
    for (let i = 0; i < (f.mobile ? 5 : 9); i++) {
      const a = f.rnd(i + 300) * TAU;
      const r = 0.1 + 0.4 * Math.sqrt(f.rnd(i + 320));
      rest.push([CX + Math.cos(a) * r, TRAY + 0.03, Math.sin(a) * r]);
    }
    return { tokens, lag: tokens.map(() => 0), circ, rest, held: -1, keep: false, grip: 0, since: 0, after: 0 };
  },
  draw(f, s) {
    const { ctx, pal } = f;
    // looked down upon a little, so that every sieve shows its mesh
    f.cam.parallax = 0.7;
    f.aim(0.16 + (f.still ? 0 : Math.sin(f.t * 0.07) * 0.04), -0.26, 6.4, 0.94);
    const yaw = f.cam.yaw;
    const loop = (y: number, r: number): V3[] => s.circ.map(([c, sn]): V3 => [CX + c * r, y, sn * r]);
    // the half of a ring that faces the visitor
    const front = (y: number, r: number, n = 14): V3[] => {
      const o: V3[] = [];
      for (let i = 0; i <= n; i++) o.push([CX + Math.cos(yaw + Math.PI + (i / n) * Math.PI) * r, y, Math.sin(yaw + Math.PI + (i / n) * Math.PI) * r]);
      return o;
    };

    // ── the pointer: how much it is on each tier, and which token it has come upon
    const near = TIERS.map((y) => {
      const p = f.P(CX, y, 0);
      if (!p || f.hover <= 0) return 0;
      const k = clamp(1 - Math.abs(p.y - f.my) / (f.u * 0.4));
      return k * k * (3 - 2 * k) * f.hover;
    });
    const places = s.tokens.map((k, i) => place(k, f.t - s.lag[i]));
    const flow = f.on(1, 0.3);
    const lifted = (i: number): V3 => [places[i].p[0], places[i].p[1] + 0.17 * s.grip, places[i].p[2]];
    if (!f.still) {
      if (s.held >= 0) {
        const p = f.P(...lifted(s.held));
        if (!p || f.hover < 0.4 || f.t - s.since > 8 || Math.hypot(p.x - f.mx, p.y - f.my) > 70) {
          if (s.keep) s.after = f.t + 1.2;
          s.keep = false;
        }
        // its own clock stands still while it is held, so it falls on from where it was taken
        s.lag[s.held] += f.dt * (1 + f.hover * 0.7) * s.grip;
      }
      s.grip += ((s.keep ? 1 : 0) - s.grip) * (1 - Math.exp(-f.dt * 6));
      if (!s.keep && s.grip < 0.03) s.held = -1;
      if (s.held < 0 && f.hover > 0.5 && f.t > s.after && flow >= 1) {
        let most = 0.25;
        s.tokens.forEach((k, i) => {
          if (k.tier >= 0 || places[i].flat || places[i].alpha < 0.9 || i >= STREAM * f.q) return;
          const on = f.near(places[i].p, 40);
          if (on > most) {
            most = on;
            s.held = i;
          }
        });
        if (s.held >= 0) {
          s.keep = true;
          s.since = f.t;
        }
      }
    }

    deck(f, { y: TRAY - 0.12, half: 3.75, alpha: 0.1, drift: 0 });
    pool(f, [CX, TRAY - 0.12, 0], 2.3, pal.key, 0.22 * f.boot);

    // ── the tray: a shallow dish, and what has come through
    const base = f.on(0, 0.35);
    const dish = loop(TRAY, R);
    const lip = loop(TRAY + 0.08, R + 0.12);
    f.fill(lip, pal.bg, 0.9 * base);
    f.fill(lip, pal.ink, 0.05 * base);
    f.fill(dish, pal.key, 0.07 * base);
    f.path(dish, pal.ink, 0.22 * base, 1, true);
    f.path(lip, pal.ink, 0.5 * base, 1.25, true);
    trace(f, front(TRAY + 0.08, R + 0.12), pal.key, 0.55 * base, 1.25);
    for (const p of s.rest) coin(f, s.tokens[0], { p, alpha: 0.6, gold: 0, flat: true }, base * flow);

    // ── the posts: one on the right carries the shelves, two stand behind and before
    const post = (a: number): readonly [V3, V3] => [[CX + Math.cos(a) * (R + 0.03), TRAY + 0.08, Math.sin(a) * (R + 0.03)], [CX + Math.cos(a) * (R + 0.03), TIERS[0] + HOOP + 0.42 * f.on(0.2, 0.5), Math.sin(a) * (R + 0.03)]];
    strokes(f, POSTS.filter((a) => Math.sin(a - yaw) >= 0).map(post), pal.ink, 0.34 * base, 2);

    const layer = (y: number) => (y >= TIERS[0] ? 3 : y >= TIERS[1] ? 2 : y >= TIERS[2] ? 1 : 0);
    const drop = (lv: number) => {
      s.tokens.forEach((k, i) => {
        if (i === s.held || layer(places[i].p[1]) !== lv || (k.tier < 0 && i >= STREAM * f.q)) return;
        coin(f, k, places[i], flow);
        // a token going through a mesh leaves a ring on it for a moment
        if (k.tier < 0 && !f.mobile) {
          for (const y of TIERS) {
            const d = Math.abs(places[i].p[1] - y - 0.02);
            if (d < 0.06) ring(f, [places[i].p[0], y + 0.02, places[i].p[2]], 0.05 + (0.06 - d) * 0.5, { colour: pal.key, alpha: 0.6 * (1 - d / 0.06) * places[i].alpha * flow, seg: 12 });
          }
        }
      });
    };

    // ── the tiers, from the lowest up, each after the tokens that are still beneath it
    drop(0);
    for (let k = TIERS.length - 1; k >= 0; k--) {
      const y = TIERS[k];
      const on = f.on(0.2 + (2 - k) * 0.2, 0.35);
      const w = near[k];
      if (on > 0.003) {
        const lower = loop(y, R);
        // smoked glass under the mesh: what lies below a tier is seen through it
        f.fill(lower, pal.bg, 0.36 * on);
        f.fill(lower, pal.key, (0.035 + 0.1 * w) * on);
        // the mesh: two sets of wires square to one another, which draw tighter under the pointer
        const pitch = MESH[k] * (1 - 0.44 * w);
        const rot = k * 0.5 + (f.still ? 0 : f.t * 0.012 * (k % 2 ? -1 : 1));
        const wires: [V3, V3][] = [];
        for (const a of [rot, rot + Math.PI / 2]) {
          const dx = Math.cos(a);
          const dz = Math.sin(a);
          for (let i = -Math.floor(R / pitch); i * pitch < R; i++) {
            const d = i * pitch;
            const half = Math.sqrt(R * R - d * d);
            wires.push([[CX - dz * d - dx * half, y + 0.02, dx * d - dz * half], [CX - dz * d + dx * half, y + 0.02, dx * d + dz * half]]);
          }
        }
        strokes(f, wires, pal.ink, (0.3 + 0.1 * w) * on);
        strokes(f, wires, pal.key, 0.75 * w * on);
        // the hoop: its far rim, then the wall of it that faces the visitor
        f.path(loop(y + HOOP, R), pal.ink, (0.4 + 0.3 * w) * on, 1.25, true);
        const wall = [...front(y, R), ...front(y + HOOP, R).reverse()];
        f.fill(wall, pal.bg, 0.9 * on);
        f.fill(wall, pal.ink, (0.1 + 0.1 * w) * on);
        f.path(front(y, R), pal.ink, 0.3 * on, 1);
        trace(f, front(y + HOOP, R), pal.key, (0.4 + 0.6 * w) * on, 1.25 + 0.5 * w, k === 0 && on >= 1 ? f.t / 14 : -1);

        // the shelf on the right, at the end of a chute: where a stopped token is left to be looked at
        const x0 = CX + R + 0.15;
        const x1 = CX + R + 0.62;
        const ys = y + 0.02;
        const shelf: V3[] = [[x0, ys, -0.1], [x1, ys, -0.1], [x1, ys, 0.1], [x0, ys, 0.1]];
        strokes(f, [[[CX + R, y + HOOP, -0.05], [x0, ys, -0.05]], [[CX + R, y + HOOP, 0.05], [x0, ys, 0.05]]], pal.ink, 0.34 * on);
        f.fill(shelf, pal.bg, 0.9 * on);
        f.fill(shelf, pal.gold, (0.06 + 0.06 * w) * on);
        f.path(shelf, pal.ink, 0.3 * on, 1, true);
        f.line(shelf[0], shelf[1], pal.gold, (0.6 + 0.4 * w) * on, 1.25);

        // the name of the step, on the left
        f.line([CX - R - 0.02, y + HOOP / 2, 0], [CX - R - 0.1, y + HOOP / 2, 0], pal.ink, 0.3 * on);
        f.label(NAMES[k], [CX - R - 0.14, y + HOOP / 2, 0], { align: "right", size: f.mobile ? 8 : 10, colour: w > 0.4 ? pal.ink : pal.ink2, alpha: (0.62 + 0.38 * w) * f.on(0.7 + (2 - k) * 0.1) });
      }
      drop(3 - k);
    }

    // ── the feed cone over the top tier, and the post that stands in front
    const cone = f.on(0.8, 0.3);
    f.path(loop(YIN - 0.12, 0.32), pal.ink, 0.4 * cone, 1, true);
    f.path(loop(YIN + 0.06, 0.5), pal.ink, 0.5 * cone, 1.25, true);
    strokes(f, s.circ.filter((_, i) => i % (f.mobile ? 7 : 4) === 0).map(([c, sn]): [V3, V3] => [[CX + c * 0.32, YIN - 0.12, sn * 0.32], [CX + c * 0.5, YIN + 0.06, sn * 0.5]]), pal.ink, 0.2 * cone);
    trace(f, front(YIN + 0.06, 0.5), pal.key, 0.5 * cone, 1.25);
    strokes(f, POSTS.filter((a) => Math.sin(a - yaw) < 0).map(post), pal.ink, 0.42 * base, 2);

    // ── the token the pointer has taken: lifted clear of the stream, in a ring of light
    if (s.held >= 0) {
      const at = lifted(s.held);
      const p = f.P(...at);
      if (p) {
        const r = Math.max(9, 0.1 * p.s * f.u);
        f.line(places[s.held].p, at, pal.key, 0.4 * s.grip);
        f.glow(at, 0.3, pal.key, 0.5 * s.grip);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * (1.5 - 0.5 * s.grip), 0, TAU);
        ctx.strokeStyle = rgba(pal.key, 0.95 * s.grip);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        coin(f, s.tokens[s.held], { ...places[s.held], p: at, flat: s.grip > 0.5 }, flow, s.grip);
      }
    }
  },
};

export default scene;

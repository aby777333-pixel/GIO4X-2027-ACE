/**
 * LATTICE — a network of light kept behind glass, and the lamp outside it.
 *
 * The page sets out the limits any AI assistant would keep. So the instrument
 * is a small lattice of nodes and links standing inside a six-sided case of
 * clear glass. Signals travel along the links; where a link meets the glass it
 * ends in a stop, and a signal that reaches one spreads on the pane and goes no
 * further. A limiter ring surrounds the case on three stanchions and carries
 * seven stops, one for each boundary the page states. Outside the glass, on its
 * own post and wired to the ring, stands one champagne lamp: the person.
 *
 * The pointer: signals route through the lattice toward the node nearest the
 * cursor and that region brightens, but they still end at the glass. Bring the
 * pointer to the lamp and it lights, the ring's stops close in and the lattice
 * dims: the person has the last word. Nothing here claims an assistant exists.
 */
import { TAU, clamp, lerp, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, ring, ringPoint, trace } from "../kit";

const FLOOR = -0.68;
/** the case: its axis, corner radius, foot and lid */
const CX = -0.36;
const R = 0.78;
const Y0 = -0.54;
const Y1 = 0.84;
const YM = (Y0 + Y1) / 2;
/** from the axis to the middle of a pane */
const APO = R * Math.cos(TAU / 12);
/** the limiter ring, and the lamp that stands outside it */
const RING = 1.03;
const LAMP: V3 = [1.5, 0.36, -0.12];

type Node = { p: V3; stop: boolean; turn: number };
type Link = { a: number; b: number; phase: number };
type State = { nodes: Node[]; links: Link[]; d: number[]; heat: number[] };

const smooth = (k: number) => {
  const x = clamp(k);
  return x * x * (3 - 2 * x);
};
const mix = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
/** a corner of the case (or of its plinth) at height y */
const corner = (i: number, y: number, r = R): V3 => [CX + Math.cos((i * TAU) / 6) * r, y, Math.sin((i * TAU) / 6) * r];
/** a point on the pane that faces `turn`, `u` along it and `v` up it from the pane's middle */
const onPane = (turn: number, u: number, v: number): V3 => {
  const a = turn * TAU;
  return [CX + Math.cos(a) * APO - Math.sin(a) * u, YM + v, Math.sin(a) * APO + Math.cos(a) * u];
};

/** solid machined metal: a dark body under a tint, with a hairline round it */
function solid(f: Frame, q: readonly V3[], tone: number, on: number): void {
  f.fill(q, f.pal.bg, 0.94 * on);
  f.fill(q, f.pal.ink, tone * on);
  f.path(q, f.pal.ink, 0.2 * on, 1, true);
}

/** one pane of the case; the panes nearest the viewer carry a narrow reflection */
function pane(f: Frame, i: number, front: boolean, on: number): void {
  const q: V3[] = [corner(i, Y0), corner(i + 1, Y0), corner(i + 1, Y1), corner(i, Y1)];
  f.fill(q, f.pal.bg, (front ? 0.14 : 0.3) * on);
  f.fill(q, f.pal.ink, (front ? 0.03 : 0.018) * on);
  if (front) {
    const at = 0.2 + f.px * 0.08;
    f.fill([mix(q[0], q[1], at), mix(q[0], q[1], at + 0.13), mix(q[3], q[2], at + 0.13), mix(q[3], q[2], at)], f.pal.ink, 0.045 * on);
  }
  f.path(q, f.pal.ink, (front ? 0.34 : 0.15) * on, 1, true);
}

const scene: Scene<State> = {
  pose: 14,
  setup(f) {
    // a small crystal: a hub, a ring of six facing the six panes, and three above and three below
    const nodes: Node[] = [{ p: [CX, YM, 0], stop: false, turn: 0 }];
    for (let k = 0; k < 6; k++) {
      const turn = (k + 0.5) / 6;
      nodes.push({ p: [CX + Math.cos(turn * TAU) * 0.5, YM, Math.sin(turn * TAU) * 0.5], stop: false, turn });
    }
    for (let k = 0; k < 6; k++) nodes.push({ p: [CX + Math.cos((k * TAU) / 6) * 0.32, YM + (k % 2 ? -0.47 : 0.47), Math.sin((k * TAU) / 6) * 0.32], stop: false, turn: k / 6 });
    const links: Link[] = [];
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const d = Math.hypot(nodes[a].p[0] - nodes[b].p[0], nodes[a].p[1] - nodes[b].p[1], nodes[a].p[2] - nodes[b].p[2]);
        if (d < 0.6) links.push({ a, b, phase: f.rnd(links.length + 3) });
      }
    }
    // each of the six outer nodes reaches for its pane, and ends on it
    for (let k = 0; k < 6; k++) {
      nodes.push({ p: onPane(nodes[k + 1].turn, 0, 0), stop: true, turn: nodes[k + 1].turn });
      links.push({ a: k + 1, b: nodes.length - 1, phase: f.rnd(40 + k) });
    }
    return { nodes, links, d: nodes.map(() => 0), heat: nodes.map(() => 0) };
  },
  draw(f, s) {
    const { pal } = f;
    // looked down on a little, so the limiter reads as a ring round the case
    f.aim(0.3 + (f.still ? 0 : Math.sin(f.t * 0.06) * 0.05), -0.3, 6.4, f.mobile ? 0.98 : 1.06);
    const yaw = f.cam.yaw;
    const far = (turn: number) => Math.sin(turn * TAU - yaw) > 0;

    const body = f.on(0, 0.3);
    const glass = f.on(0.25, 0.35);
    const net = f.on(0.5, 0.4);
    const post = f.on(0.85, 0.3);
    // the person: the pointer on the lamp or its post
    const person = Math.max(f.near(LAMP, 130), f.near([LAMP[0], lerp(FLOOR, LAMP[1], 0.45), LAMP[2]], 100));
    const live = 1 - 0.68 * person;

    // where the signals are heading: a slow wander of its own, or the pointer
    const w = f.P(CX + 0.42 * Math.cos(f.t * 0.23), YM + 0.32 * Math.sin(f.t * 0.31), 0.36 * Math.sin(f.t * 0.17));
    const ax = w ? lerp(w.x, f.mx, f.hover) : f.mx;
    const ay = w ? lerp(w.y, f.my, f.hover) : f.my;
    const reach = f.u * (0.72 + 0.26 * f.hover);
    s.nodes.forEach((n, i) => {
      const p = f.P(n.p[0], n.p[1], n.p[2]);
      s.d[i] = p ? Math.hypot(p.x - ax, p.y - ay) : 1e4;
      s.heat[i] = smooth(1 - s.d[i] / reach);
    });

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [CX, FLOOR, 0], 2.1, pal.key, 0.2 * f.boot * live);
    pool(f, [LAMP[0], FLOOR, LAMP[2]], 0.8, pal.gold, (0.1 + 0.3 * person) * post);

    // ── the plinth: a six-sided slab, the faces turned to the viewer and then its top
    for (let i = 0; i < 6; i++) {
      if (!far((i + 0.5) / 6)) solid(f, [corner(i, FLOOR, R + 0.1), corner(i + 1, FLOOR, R + 0.1), corner(i + 1, Y0, R + 0.1), corner(i, Y0, R + 0.1)], 0.05 + 0.07 * clamp(-Math.sin(((i + 0.5) / 6) * TAU - yaw - 0.7)), body);
    }
    const top = [0, 1, 2, 3, 4, 5].map((i) => corner(i, Y0, R + 0.1));
    solid(f, top, 0.085, body);
    f.path([0, 1, 2, 3, 4, 5].map((i) => corner(i, Y0)), pal.key, 0.5 * glass * live, 1.25, true);

    // ── the limiter: three stanchions, a graduated ring and seven stops (the page's seven boundaries)
    const ringC: V3 = [CX, YM, 0];
    const tone = person > 0.02 ? pal.gold : pal.ink;
    const limiter = (back: boolean) => {
      const from = yaw / TAU + (back ? 0 : 0.5);
      for (let k = 0; k < 3; k++) {
        const turn = k / 3;
        if (far(turn) !== back) continue;
        const foot = ringPoint([CX, FLOOR, 0], RING, turn);
        f.line(foot, ringPoint(ringC, RING, turn), pal.ink, 0.42 * body, 2);
        f.dot(foot, 0.022, pal.ink, 0.5 * body);
      }
      ring(f, ringC, RING, { colour: pal.ink, alpha: (back ? 0.3 : 0.62) * body, width: back ? 1.25 : 2, from, to: from + 0.5 });
      ring(f, ringC, RING + 0.045, { colour: pal.ink, alpha: (back ? 0.12 : 0.24) * body, from, to: from + 0.5, ticks: f.mobile ? 14 : 28, tickLen: 0.03 });
      if (person > 0.02) ring(f, ringC, RING, { colour: pal.gold, alpha: (back ? 0.5 : 0.95) * person, width: 2, from, to: from + 0.5 });
      for (let k = 0; k < 7; k++) {
        const turn = (k + 0.25) / 7;
        if (far(turn) !== back) continue;
        // a stop is a short bolt pointing at the glass; the person's lamp throws it home
        const tip = ringPoint(ringC, RING - lerp(0.075, 0.17, person), turn);
        f.line(ringPoint(ringC, RING + 0.02, turn), tip, tone, (back ? 0.5 : 0.9) * body, back ? 2.5 : 3.5);
        f.dot(tip, 0.016, tone, (back ? 0.5 : 0.9) * body);
      }
    };
    limiter(true);

    // ── the case, far panes first, then what it holds
    for (let i = 0; i < 6; i++) if (far((i + 0.5) / 6)) pane(f, i, false, glass);

    const lit = net * live;
    s.links.forEach((l, i) => {
      const a = s.nodes[l.a];
      const b = s.nodes[l.b];
      const heat = (s.heat[l.a] + s.heat[l.b]) / 2;
      f.line(a.p, b.p, pal.key, lit * ((b.stop ? 0.16 : 0.24) * (1 - 0.45 * f.hover) + 0.72 * heat), 1 + 1.4 * heat * f.hover + 0.6 * heat);
      if (f.mobile && i % 2) return;
      // a signal runs along the link toward whichever end is nearer the target; it fades where the two are level
      const toB = s.d[l.b] < s.d[l.a];
      const dest = toB ? l.b : l.a;
      const sure = clamp(Math.abs(s.d[l.a] - s.d[l.b]) / (f.u * 0.1));
      const g = (f.t * 0.3 + l.phase) % 1;
      const level = lit * live * sure * (0.3 + 0.7 * s.heat[dest]);
      const p = toB ? mix(a.p, b.p, g) : mix(b.p, a.p, g);
      const env = clamp(g * 5) * clamp((1 - g) * 5);
      f.glow(p, 0.085, pal.key, 0.8 * level * env);
      f.dot(p, 0.011, pal.ink, level * env);
      // at the glass it goes no further: it spreads on the pane and is gone
      if (s.nodes[dest].stop) {
        const k = smooth((g - 0.62) / 0.38);
        const rr = 0.03 + 0.1 * k;
        const loop: V3[] = [];
        for (let n = 0; n < 12; n++) loop.push(onPane(b.turn, Math.cos((n * TAU) / 12) * rr, Math.sin((n * TAU) / 12) * rr));
        f.path(loop, pal.key, 0.85 * level * Math.sin(Math.PI * k), 1.25, true);
      }
    });
    for (let i = 0; i < s.nodes.length; i++) {
      const n = s.nodes[i];
      const heat = s.heat[i];
      if (n.stop) {
        // the stop itself: a small square seat on the pane
        const e = 0.022;
        f.path([onPane(n.turn, -e, -e), onPane(n.turn, e, -e), onPane(n.turn, e, e), onPane(n.turn, -e, e)], pal.ink, (0.34 + 0.5 * heat) * net * live, 1.25, true);
        continue;
      }
      f.glow(n.p, 0.26 + 0.1 * f.hover, pal.key, (0.3 + 0.25 * f.hover) * heat * lit);
      lamp(f, n.p, pal.key, lit * (0.42 - 0.14 * f.hover + (0.58 + 0.14 * f.hover) * heat), (i ? 0.015 : 0.02) + (0.008 + 0.008 * f.hover) * heat);
    }

    for (let i = 0; i < 6; i++) if (!far((i + 0.5) / 6)) pane(f, i, true, glass);
    const lid = [0, 1, 2, 3, 4, 5].map((i) => corner(i, Y1));
    f.fill(lid, pal.ink, 0.03 * glass);
    f.path(lid, pal.ink, 0.3 * glass, 1, true);
    f.path(lid, pal.key, 0.55 * glass * live, 1.25, true);
    limiter(false);

    // ── outside the glass: the person's lamp on its own post, wired along the deck to the limiter
    const foot: V3 = [LAMP[0], FLOOR, LAMP[2]];
    const stanchion = ringPoint([CX, FLOOR, 0], RING, 0);
    const wire: V3[] = [foot, [LAMP[0] - 0.22, FLOOR, LAMP[2]], [stanchion[0] + 0.2, FLOOR, 0], stanchion, ringPoint(ringC, RING, 0)];
    trace(f, wire, pal.gold, (0.3 + 0.65 * person) * post, 1.25, post >= 1 ? f.t / (9 - 6 * person) : -1);
    ring(f, foot, 0.12, { colour: pal.ink, alpha: 0.45 * post, seg: 28 });
    ring(f, foot, 0.07, { colour: pal.gold, alpha: 0.4 * post, seg: 20 });
    f.line(foot, [LAMP[0], LAMP[1] - 0.085, LAMP[2]], pal.ink, 0.6 * post, 2.5);
    ring(f, LAMP, 0.085, { axis: "z", colour: pal.ink, alpha: 0.7 * post, width: 1.5, seg: 28 });
    ring(f, LAMP, 0.115, { axis: "z", colour: pal.gold, alpha: (0.25 + 0.6 * person) * post, from: 0.08, to: 0.42, seg: 28 });
    f.glow(LAMP, 0.62, pal.gold, 0.5 * person);
    lamp(f, LAMP, pal.gold, post * (0.62 + 0.38 * person) * (f.still ? 1 : 0.9 + 0.1 * Math.sin(f.t * 0.8)), 0.03 + 0.012 * person);

    const size = f.mobile ? 9 : 10;
    f.label("A PERSON", LAMP, { align: "center", dy: f.mobile ? -17 : -26, size, colour: pal.gold, alpha: (0.8 + 0.2 * person) * post });
    f.label("LIMITS", ringPoint(ringC, RING + 0.045, yaw / TAU + 0.5), { align: "right", dx: f.mobile ? -6 : -10, size, colour: person > 0.02 ? pal.gold : pal.ink2, alpha: (0.7 + 0.3 * person) * body });
  },
};

export default scene;

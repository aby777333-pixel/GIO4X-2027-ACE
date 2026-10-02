/**
 * HELM — several accounts, steered as one.
 *
 * A ship's wheel on its pedestal, eight spokes and one of them the king spoke
 * in champagne, with a binnacle beside it: a compass card under a glass dome
 * between its two correcting spheres. Astern, four small craft follow on taut
 * lines made fast behind the wheel: the accounts a manager steers from one
 * master account. Now and then a point of light runs down every line at once
 * and reaches all four together: one instruction, allocated.
 *
 * Nothing here is a result, a size or a number of clients; four craft are four
 * shapes, as in the page's own diagram.
 *
 * The pointer takes the wheel. It turns toward the cursor, the compass card
 * swings under its glass, and after a short delay the craft come round in
 * formation, the nearest first and the last one last, their lines taut all
 * the way.
 */
import { TAU, clamp, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, orb, pool, ring } from "../kit";

const FLOOR = -0.8;
const DECK = FLOOR + 0.05;
/** the wheel: its hub, the rim's two edges, the reach of the handles */
const WX = -0.25;
const HY = FLOOR + 1.0;
const RIM = 0.6;
const RIN = 0.5;
const GRIP = 0.8;
const SPOKES = 8;
/** the pedestal stands behind the wheel; the lines are made fast at its head */
const PZ = 0.2;
const TOW: V3 = [WX, HY, PZ];
/** the binnacle */
const BX = -1.38;
const BZ = -0.18;
const BOWL = DECK + 0.68;
/** the fleet: each craft's distance astern and its station to one side, and the bearing they lie on at rest */
const FLEET: readonly (readonly [number, number])[] = [[1.0, 0], [1.48, -0.46], [1.48, 0.46], [1.95, 0]];
const BEARING = 1.13;
/** how far the fleet swings for a given turn of the wheel */
const GAIN = 0.3;

type State = { wheel: number; swing: number[]; order: number[] };

const rim = (r: number, a: number, z = 0): V3 => [WX + Math.cos(a) * r, HY + Math.sin(a) * r, z];

/** a solid face: a dark body under a tone of the metal, with a fine edge */
function face(f: Frame, pts: readonly V3[], tone: number, on: number, edge = 0.24): void {
  if (on <= 0.003) return;
  f.fill(pts, f.pal.bg, 0.95 * on);
  f.fill(pts, f.pal.ink, tone * on);
  f.path(pts, f.pal.ink, edge * on, 1, true);
}

/** a tapered column standing on the deck: the flank the camera can see, then its front */
function column(f: Frame, x: number, z: number, y1: number, wb: number, wt: number, hz: number, on: number): void {
  const side = Math.sin(f.cam.yaw) * f.cam.dist > x ? 1 : -1;
  face(f, [[x + side * wb, DECK, z - hz], [x + side * wb, DECK, z + hz], [x + side * wt, y1, z + hz], [x + side * wt, y1, z - hz]], 0.07, on);
  face(f, [[x - wb, DECK, z - hz], [x + wb, DECK, z - hz], [x + wt, y1, z - hz], [x - wt, y1, z - hz]], 0.13, on, 0.32);
  // a fielded panel, and the key light down one arris
  f.path([[x - wb * 0.5, DECK + 0.1, z - hz], [x + wb * 0.5, DECK + 0.1, z - hz], [x + wt * 0.55, y1 - 0.1, z - hz], [x - wt * 0.55, y1 - 0.1, z - hz]], f.pal.ink, 0.14 * on, 1, true);
  f.line([x - wb, DECK, z - hz], [x - wt, y1, z - hz], f.pal.key, 0.55 * on, 1.25);
}

const scene: Scene<State> = {
  pose: 12,
  setup() {
    return { wheel: 0, swing: FLEET.map(() => 0), order: FLEET.map((_, i) => i) };
  },
  draw(f, s) {
    const { ctx, pal } = f;
    f.cam.parallax = 0.6;
    f.aim(0.1 + (f.still ? 0 : Math.sin(f.t * 0.07) * 0.03), -0.34, 6.4, f.mobile ? 0.9 : 0.96);
    const hub: V3 = [WX, HY, 0];
    const ph = f.P(WX, HY, 0);
    if (!ph) return;

    // ── the helm: at rest the helmsman makes small corrections; under the pointer the wheel turns toward it
    const idle = f.still ? 0.2 : Math.sin(f.t * 0.23) * 0.17 + Math.sin(f.t * 0.11 + 1) * 0.07;
    const aimed = clamp(((f.mx - ph.x) / f.u) * 0.85, -1.25, 1.25);
    const want = lerp(idle, aimed, f.hover);
    if (f.still) {
      s.wheel = want;
      s.swing.fill(want * GAIN);
    } else {
      s.wheel += (want - s.wheel) * (1 - Math.exp(-f.dt * 5));
      // each craft follows the one ahead of it, so the turn runs down the formation
      let lead = s.wheel * GAIN;
      for (let i = 0; i < s.swing.length; i++) {
        s.swing[i] += (lead - s.swing[i]) * (1 - Math.exp(-f.dt * 2.8));
        lead = s.swing[i];
      }
    }

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [WX, FLOOR, 0.2], 2.3, pal.key, 0.2 * f.boot);

    // ── the fleet astern: far craft first, each on its line
    const pulse = f.still || f.boot < 1 ? -1 : (f.t / 6.5) % 1;
    const arrive = pulse < 0 ? 0 : clamp(1 - Math.abs(pulse - 0.97) / 0.12);
    const craft = FLEET.map(([d, l], i) => {
      const a = BEARING + Math.atan2(l, d) + s.swing[i];
      const len = Math.hypot(d, l);
      return { x: TOW[0] + Math.sin(a) * len, z: TOW[2] + Math.cos(a) * len, hx: -Math.sin(a), hz: -Math.cos(a), on: f.on(0.55 + i * 0.1, 0.3) };
    });
    const depth = (i: number) => f.P(craft[i].x, FLOOR, craft[i].z)?.z ?? 0;
    s.order.sort((a, b) => depth(b) - depth(a));
    for (const i of s.order) {
      const c = craft[i];
      if (c.on <= 0.003) continue;
      // the hull's outline: bow toward the helm
      const hull = (y: number, k: number): V3[] => {
        const p = (along: number, across: number): V3 => [c.x + c.hx * along - c.hz * across * k, y, c.z + c.hz * along + c.hx * across * k];
        return [p(0.34, 0), p(0.13, 0.11), p(-0.27, 0.09), p(-0.27, -0.09), p(0.13, -0.11)];
      };
      const keel = hull(FLOOR, 0.8);
      const top = hull(DECK, 1);
      // its wake, opening astern
      for (const side of [-1, 1]) f.line([c.x - c.hx * 0.3 - c.hz * 0.08 * side, FLOOR, c.z - c.hz * 0.3 + c.hx * 0.08 * side], [c.x - c.hx * 0.72 - c.hz * 0.24 * side, FLOOR, c.z - c.hz * 0.72 + c.hx * 0.24 * side], pal.ink, 0.16 * c.on, 1);
      pool(f, [c.x, FLOOR, c.z], 0.5, pal.key, 0.2 * c.on);
      face(f, keel, 0.05, c.on, 0.2);
      face(f, top, 0.15, c.on, 0.55);
      f.line(top[4], top[0], pal.key, 0.6 * c.on, 1.25);
      f.line(top[2], top[0], pal.key, 0.6 * c.on, 1.25);
      // a low coaming amidships gives the hull its second tier
      const house = hull(DECK + 0.045, 0.52).map((v): V3 => [lerp(c.x, v[0], 0.52), v[1], lerp(c.z, v[2], 0.52)]);
      face(f, house, 0.24, c.on, 0.42);
      // the line, taut from the head of the pedestal to the bow, and the instruction running down it
      f.line(TOW, top[0], pal.key, (0.5 + 0.35 * f.hover) * c.on, 1);
      if (pulse >= 0 && c.on >= 1) {
        const at: V3 = [lerp(TOW[0], top[0][0], pulse), lerp(TOW[1], top[0][1], pulse), lerp(TOW[2], top[0][2], pulse)];
        f.glow(at, 0.1, pal.key, 0.8);
        f.dot(at, 0.012, pal.ink, 0.95);
      }
      const mast: V3 = [c.x - c.hx * 0.03, DECK + 0.27, c.z - c.hz * 0.03];
      f.line([mast[0], DECK, mast[2]], mast, pal.ink, 0.55 * c.on, 1.25);
      lamp(f, mast, pal.key, c.on * (0.62 + 0.38 * arrive), 0.021);
    }

    // ── the stern deck the helm stands on
    const base = f.on(0, 0.3);
    const x0 = BX - 0.4;
    const x1 = WX + 0.62;
    const z0 = -0.56;
    const z1 = 0.46;
    face(f, [[x0, FLOOR, z0], [x1, FLOOR, z0], [x1, DECK, z0], [x0, DECK, z0]], 0.12, base);
    face(f, [[x1, FLOOR, z0], [x1, FLOOR, z1], [x1, DECK, z1], [x1, DECK, z0]], 0.07, base);
    face(f, [[x0, DECK, z0], [x1, DECK, z0], [x1, DECK, z1], [x0, DECK, z1]], 0.055, base);
    if (!f.mobile) for (let i = 1; i < 6; i++) f.line([x0, DECK, lerp(z0, z1, i / 6)], [x1, DECK, lerp(z0, z1, i / 6)], pal.ink, 0.07 * base, 1);
    f.line([x0, DECK, z0], [x1, DECK, z0], pal.key, 0.6 * base, 1.25);

    // ── the binnacle: a column, a bowl, the compass card under its dome, a correcting sphere either side
    const bin = f.on(0.45, 0.3);
    const eye: V3 = [BX, BOWL, BZ];
    if (bin > 0.003) {
      pool(f, [BX, DECK, BZ], 0.5, pal.key, 0.16 * bin);
      column(f, BX, BZ, BOWL - 0.1, 0.11, 0.075, 0.08, bin);
      for (const side of [-1, 1]) {
        const ball: V3 = [BX + side * 0.29, BOWL - 0.02, BZ];
        f.line([BX + side * 0.1, BOWL - 0.06, BZ], ball, pal.ink, 0.5 * bin, 2);
        orb(f, ball, 0.066, side < 0 ? pal.emerald : pal.crimson, bin);
        f.glow(ball, 0.16, side < 0 ? pal.emerald : pal.crimson, 0.3 * bin);
      }
      f.glow(eye, 0.42, pal.key, 0.22 * bin);
      orb(f, eye, 0.165, pal.key, bin);
      face(f, [[BX - 0.085, BOWL - 0.1, BZ - 0.08], [BX + 0.085, BOWL - 0.1, BZ - 0.08], [BX + 0.17, BOWL, BZ - 0.08], [BX - 0.17, BOWL, BZ - 0.08]], 0.15, bin, 0.3);
      // the card turns under the lubber line as the heading changes
      const heading = -s.wheel * 0.9 + 0.5;
      ring(f, eye, 0.165, { axis: "y", colour: pal.key, alpha: 0.7 * bin, width: 1.25, seg: 40 });
      ring(f, eye, 0.125, { axis: "y", colour: pal.ink, alpha: 0.62 * bin, ticks: 16, major: 4, tickLen: 0.028, rot: heading, seg: 32 });
      const nx = Math.cos(heading) * 0.11;
      const nz = Math.sin(heading) * 0.11;
      f.line([BX - nx, BOWL, BZ - nz], [BX + nx, BOWL, BZ + nz], pal.ink, 0.6 * bin, 1);
      f.dot([BX + nx, BOWL, BZ + nz], 0.014, pal.gold, 0.95 * bin);
      f.line([BX, BOWL, BZ - 0.165], [BX, BOWL, BZ - 0.115], pal.gold, 0.95 * bin, 1.5);
      lamp(f, eye, pal.key, 0.5 * bin, 0.011);
    }

    // ── the pedestal and the axle
    const ped = f.on(0.15, 0.3);
    column(f, WX, PZ, HY + 0.12 * ped, 0.17, 0.105, 0.1, ped);
    f.line([WX - 0.105, HY + 0.12, PZ - 0.1], [WX + 0.105, HY + 0.12, PZ - 0.1], pal.gold, 0.8 * ped, 1.5);
    const lw = Math.max(1, f.u * ph.s * 0.02);

    // ── the wheel: rear edge of the rim, spokes, the rim itself, the handles, the hub
    const wheel = f.on(0.3, 0.4);
    if (wheel <= 0.003) return;
    const n = f.mobile ? 36 : 56;
    const outer: V3[] = [];
    const inner: V3[] = [];
    const rear: V3[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      outer.push(rim(RIM, a));
      inner.push(rim(RIN, a));
      rear.push(rim(RIM, a, 0.07));
    }
    f.line([WX, HY, PZ - 0.1], hub, pal.ink, 0.4 * wheel, lw * 2.2);
    f.path(rear, pal.ink, 0.22 * wheel, 1, true);
    const king = Math.PI / 2 - s.wheel + (1 - wheel) * 0.9;
    for (let k = 0; k < SPOKES; k++) {
      const a = king + (k * TAU) / SPOKES;
      f.line(rim(0.09, a), rim(RIN * wheel, a), pal.bg, 0.95 * wheel, lw * 1.9);
      f.line(rim(0.09, a), rim(RIN * wheel, a), k ? pal.ink : pal.gold, (k ? 0.5 : 0.85) * wheel, lw * 1.25);
    }
    ctx.beginPath();
    for (const loop of [outer, inner]) {
      loop.forEach((v, i) => {
        const p = f.P(v[0], v[1], v[2]);
        if (!p) return;
        if (i) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      });
      ctx.closePath();
    }
    ctx.fillStyle = rgba(pal.bg, 0.96 * wheel);
    ctx.fill("evenodd");
    ctx.fillStyle = rgba(pal.ink, 0.13 * wheel);
    ctx.fill("evenodd");
    ctx.fillStyle = rgba(pal.gold, 0.07 * wheel);
    ctx.fill("evenodd");
    f.path(outer, pal.ink, 0.6 * wheel, 1.25, true);
    f.path(inner, pal.ink, 0.36 * wheel, 1, true);
    // the key light lies on the rim's shoulder and does not turn with it
    f.path(outer.slice(Math.round(n * 0.27), Math.round(n * 0.47)), pal.key, 0.85 * wheel, 1.75);
    for (let k = 0; k < SPOKES; k++) {
      const a = king + (k * TAU) / SPOKES;
      const colour = k ? pal.ink : pal.gold;
      f.dot(rim((RIM + RIN) / 2, a), 0.017, colour, 0.7 * wheel);
      f.line(rim(RIM, a), rim(GRIP, a), pal.bg, 0.95 * wheel, lw * 2.6);
      f.line(rim(RIM, a), rim(GRIP, a), colour, (k ? 0.62 : 0.95) * wheel, lw * 1.8);
      f.dot(rim(GRIP, a), 0.023, colour, (k ? 0.8 : 1) * wheel);
    }
    lamp(f, rim(GRIP, king), pal.gold, wheel * (0.55 + 0.45 * f.hover), 0.02);
    f.dot(hub, 0.125, pal.bg, 0.96 * wheel);
    f.dot(hub, 0.125, pal.ink, 0.16 * wheel);
    ring(f, hub, 0.125, { axis: "z", colour: pal.ink, alpha: 0.55 * wheel, seg: 28 });
    ring(f, hub, 0.075, { axis: "z", colour: pal.ink, alpha: 0.3 * wheel, seg: 20 });
    lamp(f, hub, pal.gold, wheel * (f.still ? 1 : 0.86 + 0.14 * Math.sin(f.t * 0.9)), 0.028);

    // ── lettering: the master at the helm, the accounts astern
    const size = f.mobile ? 9 : 10;
    f.label("MASTER", [WX, FLOOR, z0], { align: "center", dy: 14, size, colour: pal.gold, alpha: 0.9 * wheel });
    // under the fleet, wherever it has swung to
    let fx = 0;
    let fy = 0;
    for (const c of craft) {
      const p = f.P(c.x, FLOOR, c.z);
      if (!p) return;
      fx += p.x / craft.length;
      fy = Math.max(fy, p.y);
    }
    ctx.font = `600 ${size}px ${pal.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = rgba(pal.ink2, 0.85 * craft[craft.length - 1].on);
    ctx.fillText("ACCOUNTS", fx, fy + 26);
  },
};

export default scene;

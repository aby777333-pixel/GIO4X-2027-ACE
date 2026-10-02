/**
 * VEIL — privacy, as a louvred screen.
 *
 * A tall frame of horizontal louvre slats stands on the deck. Behind it, lit
 * from within, stands one card: a person's record, drawn as a plain rounded
 * card with a few strokes on it (no face, no field, no value). At rest the
 * slats are half open and breathe slowly, so the card is seen in bands and its
 * light falls through the gaps onto the deck in front as bars.
 *
 * The pointer is somebody trying to look: the slats nearest the cursor turn
 * shut, their neighbours follow, the bars of light on the deck go out with
 * them, and the more the pointer looks, the less there is to see. When it
 * leaves, the slats ease open again.
 *
 * Nothing here is a claim about a system: it is the idea of the page, drawn.
 */
import { clamp, easeInOut, lerp, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, pool } from "../kit";

const FLOOR = -1.22;
/** the screen stands a little left of centre; its two names are engraved to the right of it */
const CX = -0.5;
/** half the width between the stiles, the stile's width, half the frame's depth */
const HW = 1.08;
const STILE = 0.1;
const HD = 0.1;
/** the field of slats, bottom and top */
const Y0 = -1.0;
const Y1 = 1.08;
/** the card: how far behind the screen it stands, its centre height and its size */
const ZC = 0.62;
const CY = 0.06;
const CW = 1.24;
const CH = 1.62;
/** a slat at rest stands this far from level, in radians; shut is a quarter turn */
const REST = 0.38;
const SHUT = Math.PI / 2;

type Stroke = { u0: number; u1: number; v: number; head: boolean };
type State = { n: number; pitch: number; card: V3[]; strokes: Stroke[]; shut: number[] };

/** a point on the card, u and v from 0 to 1 */
const onCard = (u: number, v: number): V3 => [CX + (u - 0.5) * CW, CY + (v - 0.5) * CH, ZC];

/** a machined member of the frame: its front, and the flank and the top the viewer can see */
function member(f: Frame, x0: number, x1: number, y0: number, y1: number, level: number, top = false): void {
  if (level <= 0.003) return;
  const { pal } = f;
  const front: V3[] = [[x0, y0, -HD], [x1, y0, -HD], [x1, y1, -HD], [x0, y1, -HD]];
  const flank: V3[] = [[x1, y0, -HD], [x1, y0, HD], [x1, y1, HD], [x1, y1, -HD]];
  if (top) {
    const lid: V3[] = [[x0, y1, -HD], [x1, y1, -HD], [x1, y1, HD], [x0, y1, HD]];
    f.fill(lid, pal.bg, 0.95 * level);
    f.fill(lid, pal.ink, 0.1 * level);
    f.path(lid, pal.ink, 0.2 * level, 1, true);
  }
  f.fill(flank, pal.bg, 0.95 * level);
  f.fill(flank, pal.ink, 0.05 * level);
  f.path(flank, pal.ink, 0.16 * level, 1, true);
  f.fill(front, pal.bg, 0.95 * level);
  f.fill(front, pal.ink, 0.13 * level);
  f.path(front, pal.ink, 0.34 * level, 1, true);
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const n = f.mobile ? 11 : 15;
    // the card's outline: a rectangle with rounded corners
    const card: V3[] = [];
    const r = 0.1;
    const corners: [number, number, number][] = [[CW / 2 - r, CH / 2 - r, 0], [-CW / 2 + r, CH / 2 - r, 1], [-CW / 2 + r, -CH / 2 + r, 2], [CW / 2 - r, -CH / 2 + r, 3]];
    for (const [x, y, q] of corners) {
      for (let i = 0; i <= 4; i++) {
        const a = (q + i / 4) * (Math.PI / 2);
        card.push([CX + x + Math.cos(a) * r, CY + y + Math.sin(a) * r, ZC]);
      }
    }
    // what is written on it: a heading and two short paragraphs, as strokes
    const strokes: Stroke[] = [{ u0: 0.13, u1: 0.56, v: 0.86, head: true }];
    let v = 0.71;
    for (let i = 0; i < 8; i++) {
      const last = i === 3 || i === 7;
      strokes.push({ u0: 0.13, u1: 0.13 + 0.74 * (last ? 0.35 + f.rnd(20 + i) * 0.25 : 0.86 + f.rnd(20 + i) * 0.14), v, head: false });
      v -= last ? 0.125 : 0.075;
    }
    return { n, pitch: (Y1 - Y0) / n, card, strokes, shut: new Array<number>(n).fill(0) };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const sway = f.still ? 0 : Math.sin(f.t * 0.08) * 0.04;
    f.aim(0.34 + sway + (f.rnd(1) - 0.5) * 0.06, -0.13, 6.4, 0.94);

    const body = f.on(0, 0.35);
    const lit = f.on(0.3, 0.4);
    const half = s.pitch * 0.54;
    const xl = CX - HW;
    const xr = CX + HW;

    // ── every slat's angle: opened at power-on, breathing at rest, shut where the pointer looks
    const reach = f.u * 0.8;
    const angle: number[] = [];
    for (let i = 0; i < s.n; i++) {
      const y = Y0 + (i + 0.5) * s.pitch;
      let want = 0;
      if (f.hover > 0) for (let k = 0; k <= 4; k++) want = Math.max(want, f.near([lerp(xl, xr, k / 4), y, 0], reach));
      // the slat has a little weight: it follows the pointer, it does not snap to it
      s.shut[i] = f.still ? 0 : s.shut[i] + (want - s.shut[i]) * (1 - Math.exp(-f.dt * 8));
      const rest = REST + (f.still ? 0 : Math.sin(f.t * 0.45 - i * 0.24) * 0.11) + f.hover * 0.1;
      const opened = lerp(SHUT, rest, f.on(0.3 + (0.5 * i) / s.n, 0.3));
      angle.push(lerp(opened, SHUT, easeInOut(clamp(s.shut[i] * 1.25))));
    }
    /** how much of the gap above slat i is open, 0 to 1 */
    const gap = (i: number): number => {
      const lower = Math.sin(angle[i]) * half;
      const upper = i + 1 < s.n ? Math.sin(angle[i + 1]) * half : 0;
      return clamp((s.pitch - lower - upper) / s.pitch);
    };

    deck(f, { y: FLOOR, alpha: 0.12 });
    pool(f, [CX, FLOOR, 0.2], 2.4, pal.key, 0.18 * f.boot);

    // ── the card's light falls through the gaps onto the deck in front, as bars
    for (let i = 0; i < s.n - 1; i++) {
      const open = gap(i) * lit;
      const ya = Y0 + (i + 0.5) * s.pitch + Math.sin(angle[i]) * half;
      const yb = Y0 + (i + 1.5) * s.pitch - Math.sin(angle[i + 1]) * half;
      if (open <= 0.02 || yb >= CY - 0.12) continue;
      // a ray from the card's centre through each lip of the gap, carried on to the floor
      const ka = (CY - FLOOR) / (CY - ya);
      const kb = (CY - FLOOR) / (CY - yb);
      if (kb > 3) continue;
      const fade = clamp(1.3 - kb / 2.7);
      const wa = HW * (0.8 + ka * 0.14);
      const wb = HW * (0.8 + kb * 0.14);
      f.fill([[CX - wa, FLOOR, ZC * (1 - ka)], [CX + wa, FLOOR, ZC * (1 - ka)], [CX + wb, FLOOR, ZC * (1 - kb)], [CX - wb, FLOOR, ZC * (1 - kb)]], pal.gold, 0.42 * open * fade);
    }

    // ── the card behind: lit from within, a heading and a few lines, nothing that can be read
    const glowAt = onCard(0.5, 0.56);
    f.glow(glowAt, 1.7, pal.gold, 0.34 * lit);
    f.fill(s.card, pal.bg, 0.7 * lit);
    f.fill(s.card, pal.gold, 0.3 * lit);
    f.fill(s.card, pal.ink, 0.06 * lit);
    f.path(s.card, pal.gold, 0.85 * lit, 1.5, true);
    for (const k of s.strokes) f.line(onCard(k.u0, k.v), onCard(k.u1, k.v), k.head ? pal.gold : pal.ink, (k.head ? 0.95 : 0.6) * lit, k.head ? 3 : 2);
    f.path([onCard(0.13, 0.12), onCard(0.4, 0.12)], pal.ink, 0.4 * lit, 1);
    // its foot on the deck
    f.line([CX - CW * 0.3, FLOOR, ZC], [CX + CW * 0.3, FLOOR, ZC], pal.gold, 0.4 * lit, 1.25);
    f.line(onCard(0.5, 0), [CX, FLOOR, ZC], pal.ink, 0.22 * lit, 1);

    // ── the frame: the far stile first, then the slats, then the rails and the near stile
    const yt = Y1 + 0.13;
    member(f, xl - STILE, xl, FLOOR, yt, body);
    const rod: V3[] = [];

    for (let i = 0; i < s.n; i++) {
      const y = Y0 + (i + 0.5) * s.pitch;
      const a = angle[i];
      const dy = Math.sin(a) * half;
      const dz = Math.cos(a) * half;
      // the front lip is the lower one: the face the viewer sees is the one turned to the room
      const blade: V3[] = [[xl, y - dy, -dz], [xr, y - dy, -dz], [xr, y + dy, dz], [xl, y + dy, dz]];
      const turned = Math.sin(a);
      const shut = clamp((turned - Math.sin(REST)) / (1 - Math.sin(REST)));
      f.fill(blade, pal.bg, 0.96 * body);
      f.fill(blade, pal.ink, (0.075 + 0.08 * turned * turned) * body);
      // a shut slat faces the room and takes the key light; an open one is lit from behind, along its far lip
      const p0 = f.P(blade[0][0], blade[0][1], blade[0][2]);
      const p1 = f.P(blade[3][0], blade[3][1], blade[3][2]);
      if (p0 && p1 && shut > 0.02 && Math.abs(p1.y - p0.y) > 0.5) {
        const g = ctx.createLinearGradient(0, p1.y, 0, p0.y);
        g.addColorStop(0, rgba(pal.key, 0.2 * shut * body));
        g.addColorStop(1, rgba(pal.key, 0.03 * shut * body));
        ctx.beginPath();
        blade.forEach((q, j) => {
          const p = f.P(q[0], q[1], q[2]);
          if (!p) return;
          if (j) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = g;
        ctx.fill();
      }
      f.line(blade[0], blade[1], pal.ink, (0.3 + 0.2 * turned) * body, 1);
      f.line(blade[3], blade[2], pal.key, 0.55 * shut * body, 1.25);
      if (Math.abs(y - CY) < CH * 0.5) f.line(blade[3], blade[2], pal.gold, 0.3 * (1 - shut) * lit, 1);
      rod.push([xr - 0.16, y - dy, -dz - 0.012]);
    }
    // the tilt rod: one fine bar stapled to every slat's front lip, so it shows how each one stands
    f.path(rod, pal.bg, 0.9 * body, 3.5);
    f.path(rod, pal.ink, 0.6 * body, 1.5);
    if (!f.mobile) for (const p of rod) f.dot(p, 0.01, pal.key, 0.8 * lit);

    member(f, xl - STILE, xr + STILE, FLOOR, Y0 - 0.02, body, true);
    member(f, xr, xr + STILE, FLOOR, yt, body);
    member(f, xl - STILE, xr + STILE, Y1 + 0.02, yt, body, true);
    f.line([xl - STILE, yt, -HD], [xr + STILE, yt, -HD], pal.key, 0.7 * lit, 1.5);
    f.line([xl - STILE, Y0 - 0.02, -HD], [xr + STILE, Y0 - 0.02, -HD], pal.key, 0.3 * lit, 1);
    // each slat turns on a pin in the near stile
    if (!f.mobile) for (let i = 0; i < s.n; i++) f.dot([xr + STILE / 2, Y0 + (i + 0.5) * s.pitch, -HD], 0.011, pal.ink, 0.45 * body);

    // the lamp on the head rail: it warms as the screen closes
    let closed = 0;
    for (let i = 0; i < s.n; i++) closed = Math.max(closed, s.shut[i]);
    lamp(f, [CX, Y1 + 0.075, -HD], closed > 0.5 ? pal.gold : pal.key, lit * (0.6 + 0.4 * closed), 0.016);

    // ── two names, engraved beside the frame: what is behind it, and what stands in front
    const named = f.on(0.85, 0.3);
    const size = f.mobile ? 9 : 10;
    const lx = xr + STILE;
    const marks: [string, number, string, number][] = [["YOUR DATA", CY + CH * 0.3, pal.gold, 0.95], ["ACCESS CONTROLS", CY - CH * 0.3, pal.ink2, 0.75]];
    for (const [text, y, colour, alpha] of marks) {
      f.line([lx + 0.03, y, -HD], [lx + 0.2, y, -HD], colour, 0.5 * named, 1);
      f.label(text, [lx + 0.2, y, -HD], { dx: 7, size, colour, alpha: alpha * named });
    }
  },
};

export default scene;

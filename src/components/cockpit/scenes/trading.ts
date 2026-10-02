/**
 * TRADING — the console.
 *
 * A low, wide control pedestal carries five glass module keys, one for each
 * page of this section: accounts, conditions, funding, copy trading and PAMM.
 * Behind it stands one tall pane of glass showing only a reticle: the market in
 * front of the trader, deliberately without data. A fine trace runs from every
 * key back to the pane, because each of the five serves that one view.
 *
 * The keys light in turn at power-on; afterwards a slow champagne "attention"
 * moves along the row, one key at a time. Nothing here is a price or a status.
 */
import { TAU, clamp, easeInOut, easeOut, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, panel, pool, trace, type Panel } from "../kit";

const KEYS = ["ACCOUNTS", "CONDITIONS", "FUNDING", "COPY", "PAMM"];

const FLOOR = -1.3;
/** the console top: its width, and the slope from the front lip (FY, FZ) up to the rear lip (BY, BZ) */
const CW = 2.7;
const [FY, FZ, BY, BZ] = [-1.0, -0.8, -0.62, 0.1];
const CD = Math.hypot(BY - FY, BZ - FZ);
const CT = Math.atan2(BZ - FZ, BY - FY);
/** the pane: width, height, lean, thickness of the glass */
const [PW, PH, PT, PD] = [1.3, 1.8, 0.05, 0.07];
/** the reticle: its height on the pane (v) and its radius */
const [RV, R] = [0.58, 0.46];
/** the keys: pitch, half width, near and far edge on the slope (v), height */
const [PITCH, KW, KV0, KV1, KH] = [0.5, 0.19, 0.33, 0.67, 0.06];

/** one route per key as [surface (0 console, 1 pane), u, v], and where each meets the reticle ring */
type State = { routes: V3[][]; ports: V3[] };

/** subdivide a route so that a pulse travels along it at a constant speed */
function even(raw: V3[]): V3[] {
  const out: V3[] = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1];
    const b = raw[i];
    const n = a[0] === b[0] ? Math.max(1, Math.round(Math.hypot((b[1] - a[1]) * (a[0] ? PW : CW), (b[2] - a[2]) * (a[0] ? PH : CD)) / 0.055)) : 1;
    for (let j = 1; j <= n; j++) out.push([b[0], a[1] + ((b[1] - a[1]) * j) / n, a[2] + ((b[2] - a[2]) * j) / n]);
  }
  return out;
}

/** a module key: a bevelled tile of smoked glass, lit along its leading edge */
function tile(f: Frame, p: Panel, u: number, on: number, att: number): void {
  if (on <= 0.003) return;
  const { pal } = f;
  const hw = KW / CW;
  const tw = hw * 0.86;
  const tv = (KV1 - KV0) * 0.09;
  const lo: V3[] = [p.at(u - hw, KV0), p.at(u + hw, KV0), p.at(u + hw, KV1), p.at(u - hw, KV1)];
  const hi: V3[] = [p.at(u - tw, KV0 + tv, KH), p.at(u + tw, KV0 + tv, KH), p.at(u + tw, KV1 - tv, KH), p.at(u - tw, KV1 - tv, KH)];
  const front: V3[] = [lo[0], lo[1], hi[1], hi[0]];
  const cool = on * (1 - att * 0.8);
  const warm = on * att;
  // a smoked body first, so nothing of the console shows through, then the light inside it
  for (const i of [1, 2, 3, 0]) f.fill([lo[i], lo[(i + 1) % 4], hi[(i + 1) % 4], hi[i]], pal.bg, (i ? 0.72 : 0.8) * on);
  f.fill(hi, pal.bg, 0.7 * on);
  f.fill([lo[1], lo[2], hi[2], hi[1]], pal.ink, 0.05 * on);
  f.fill(front, pal.key, 0.13 * cool);
  f.fill(front, pal.gold, 0.26 * warm);
  f.fill(hi, pal.key, 0.085 * cool);
  f.fill(hi, pal.gold, 0.22 * warm);
  // a band of reflection across the back of the cap
  f.fill([p.at(u - tw, KV1 - tv * 4.2, KH), p.at(u + tw, KV1 - tv * 4.2, KH), hi[2], hi[3]], pal.ink, 0.045 * on);
  f.path(lo, pal.ink, 0.13 * on, 1, true);
  for (let i = 0; i < 4; i++) f.line(lo[i], hi[i], pal.ink, 0.16 * on, 1);
  f.path(hi, pal.ink, 0.22 * on, 1, true);
  // the lit edge, and the short light bar set into the cap
  trace(f, [hi[0], hi[1]], pal.key, 0.8 * cool, 1.5);
  trace(f, [hi[0], hi[1]], pal.gold, 0.95 * warm, 1.75);
  const a = p.at(u - hw * 0.42, (KV0 + KV1) / 2, KH);
  const b = p.at(u + hw * 0.42, (KV0 + KV1) / 2, KH);
  f.line(a, b, pal.key, 0.5 * cool, 2);
  f.line(a, b, pal.gold, 0.9 * warm, 2);
  f.line(a, b, pal.ink, 0.55 * warm, 1);
}

const scene: Scene<State> = {
  pose: 12,
  setup() {
    const routes: V3[][] = [];
    const ports: V3[] = [];
    const chamfer = 0.035;
    for (let i = 0; i < KEYS.length; i++) {
      const k = i - 2;
      const a = (k * 22 * Math.PI) / 180;
      const px = Math.sin(a) * R;
      const py = -Math.cos(a) * R;
      ports.push([px, py, 0]);
      const ku = 0.5 + (k * PITCH) / CW;
      const pu = 0.5 + px / CW;
      const raw: V3[] = [[0, ku, KV1]];
      if (k) {
        // the outer keys take the rear lane, so no two traces ever cross
        const lane = Math.abs(k) === 1 ? 0.79 : 0.89;
        const cu = (Math.sign(k) * chamfer) / CW;
        const cv = chamfer / CD;
        raw.push([0, ku, lane - cv], [0, ku - cu, lane], [0, pu + cu, lane], [0, pu, lane + cv]);
      }
      raw.push([0, pu, 1], [1, 0.5 + px / PW, 0], [1, 0.5 + px / PW, RV + py / PH]);
      routes.push(even(raw));
    }
    return { routes, ports };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const m = f.mobile;
    // framing. Wide stages show the console at full size; narrower ones draw it a
    // little smaller and further from the headline. On a phone the statement needs
    // about 380px at the foot of the stage, and the console is fitted above it.
    const wide = clamp((f.w - 760) / 600);
    const tall = 1.585 * f.u;
    const fit = m ? clamp((f.h - 380) / tall, 0.6, 1) : 0.8 + 0.2 * wide;
    // the eye sits above the console, as a trader's does (in this engine a
    // camera raised over the pivot is a negative pitch)
    f.aim((m ? 0.12 : 0.2) + Math.sin(f.t * 0.09) * 0.035, m ? -0.15 : -0.17, 6.2, (m ? 0.58 : 0.75) * fit);
    f.cx = m ? f.w * 0.5 : f.cx + f.w * (0.055 - 0.045 * wide);
    f.cy += m ? 14 + 0.44 * tall * fit + Math.max(0, f.h - 380 - tall * fit) * 0.6 - f.h * 0.36 : -f.h * (f.h > f.w ? 0.23 : 0.035);

    deck(f, { y: FLOOR, alpha: 0.11, half: 5 });
    pool(f, [0, FLOOR, -0.2], 2.8, pal.key, 0.26 * f.boot);

    /** power-on by the clock, so that the five keys are seen to light one after another */
    const seq = (start: number, len: number) => (f.still ? 1 : easeOut((f.t - start) / len));

    // ── attention: one key at a time, about six seconds each, cross-fading slowly.
    // A page about one of the five modules keeps the light on its own key.
    const tag = f.tag.toUpperCase();
    const pinned = KEYS.findIndex((k) => tag === k || tag.indexOf(k + "-") === 0);
    const live = f.still ? 1 : clamp((f.t - 2.3) / 1.1);
    const phase = Math.floor(f.rnd(3) * 5) + 0.5 + (f.still ? 0 : (f.t - 4.3) / 6);
    const away = (i: number) => (pinned >= 0 ? (i === pinned ? 0 : 2) : ((((phase - i - 0.5) % 5) + 7.5) % 5) - 2.5);
    const att = (i: number) => easeInOut((0.62 - Math.abs(away(i))) / 0.3) * live;

    // ── the pane: the market in front of the trader
    const centre: V3 = [0, BY + 0.02 + (PH / 2) * Math.cos(PT), BZ + 0.02 + (PH / 2) * Math.sin(PT)];
    const pane = panel(f, centre, PW, PH, { tilt: PT, on: f.on(0.25, 0.4), colour: pal.key, alpha: 0.6, glass: 0.04 });
    const rp = (x: number, y: number, lift = 0.02): V3 => pane.at(0.5 + x / PW, RV + y / PH, lift);
    if (pane.on > 0) {
      // the glass has thickness: its top and its flank catch a little of the key light
      const flank: V3[] = [pane.at(1, 0), pane.at(1, 1), pane.at(1, 1, -PD), pane.at(1, 0, -PD)];
      f.fill([pane.at(0, 1), flank[1], flank[2], pane.at(0, 1, -PD)], pal.key, 0.3 * pane.on);
      f.fill(flank, pal.key, 0.08 * pane.on);
      f.path([pane.at(0, 1, -PD), flank[2], flank[3]], pal.ink, 0.18 * pane.on, 1);
      // and the light let in along the top edge falls a little way down the pane
      const a = f.P(...pane.at(0.5, 1));
      const b = f.P(...pane.at(0.5, 0.45));
      if (a && b) {
        const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        g.addColorStop(0, rgba(pal.key, 0.13 * pane.on));
        g.addColorStop(1, rgba(pal.key, 0));
        ctx.beginPath();
        for (const v of [pane.at(0, 0.45), pane.at(1, 0.45), pane.at(1, 1), pane.at(0, 1)]) {
          const p = f.P(v[0], v[1], v[2]);
          if (p) ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fillStyle = g;
        ctx.fill();
      }
    }

    // ── the pedestal: a machined wedge with a glass top
    const cOn = f.on(0, 0.3);
    const rise = (1 - cOn) * -0.18;
    const hw = CW / 2;
    const solid = (quad: V3[], tint: number) => {
      f.fill(quad, pal.bg, 0.92 * cOn);
      f.fill(quad, pal.ink, tint * cOn);
      f.path(quad, pal.ink, 0.16 * cOn, 1, true);
    };
    for (const x of [-hw, hw]) solid([[x, FLOOR, FZ], [x, FY + rise, FZ], [x, BY + rise, BZ], [x, FLOOR, BZ]], 0.015);
    solid([[-hw, FLOOR, FZ], [hw, FLOOR, FZ], [hw, FY + rise, FZ], [-hw, FY + rise, FZ]], 0.03);
    // a recessed strip of light under the front lip
    trace(f, [[-hw + 0.1, FY + rise - 0.06, FZ], [hw - 0.1, FY + rise - 0.06, FZ]], pal.key, 0.28 * cOn, 1);
    f.fill([[-hw, FY + rise, FZ], [hw, FY + rise, FZ], [hw, BY + rise, BZ], [-hw, BY + rise, BZ]], pal.bg, 0.6 * cOn);
    const top = panel(f, [0, (FY + BY) / 2, (FZ + BZ) / 2], CW, CD, { tilt: CT, on: cOn, colour: pal.key, alpha: 0.45, glass: 0.045 });
    f.line(top.at(0, 0), top.at(1, 0), pal.ink, 0.36 * cOn, 1.25);

    // ── traces: from every key, across the console and up the glass to the reticle
    s.routes.forEach((nodes, i) => {
      const on = seq(0.5 + i * 0.2, 0.9) * pane.on;
      if (on <= 0) return;
      const pts: V3[] = [];
      const n = Math.ceil(nodes.length * on);
      for (let j = 0; j < n; j++) pts.push(nodes[j][0] ? pane.at(nodes[j][1], nodes[j][2], 0.02) : top.at(nodes[j][1], nodes[j][2]));
      const a = att(i);
      trace(f, pts, pal.teal, 0.42 * (1 - a * 0.6), 1);
      // one pulse of light makes the journey to the pane while its key is attended
      const at = pinned >= 0 ? (f.t / 9) % 1 : (away(i) + 0.45) / 0.9;
      if (a > 0.02) trace(f, pts, pal.gold, 0.7 * a, 1.25, at > 0 && at < 1 ? at : -1);
    });

    // the rail that holds the pane in the rear lip
    const x1 = PW / 2 + 0.06;
    const y0 = BY + rise;
    const face: V3[] = [[-x1, y0, BZ - 0.05], [x1, y0, BZ - 0.05], [x1, y0 + 0.07, BZ - 0.05], [-x1, y0 + 0.07, BZ - 0.05]];
    solid([face[1], face[2], [x1, y0 + 0.07, BZ + 0.1], [x1, y0, BZ + 0.1]], 0.03);
    solid(face, 0.06);
    solid([face[3], face[2], [x1, y0 + 0.07, BZ + 0.1], [-x1, y0 + 0.07, BZ + 0.1]], 0.09);
    f.line(face[3], face[2], pal.ink, 0.42 * cOn, 1.25);

    // ── the reticle: a graduated ring and a crosshair, and nothing else
    const rOn = seq(0.6, 1.2) * pane.on;
    if (rOn > 0) {
      f.glow(rp(0, 0, 0), 0.62, pal.key, 0.1 * rOn * (f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 0.7)));
      const turn = (r: number, t: number): V3 => rp(Math.cos(t * TAU) * r, Math.sin(t * TAU) * r);
      const circle = (r: number, from: number, to: number, n: number): V3[] => Array.from({ length: n + 1 }, (_, i) => turn(r, from + ((to - from) * i) / n));
      f.path(circle(R, 0.25, 0.25 + rOn, Math.round(64 * f.q)), pal.ink, 0.36 * rOn, 1);
      f.path(circle(0.17, 0, 1, Math.round(36 * f.q)), pal.ink, 0.2 * rOn, 1);
      const ticks = m ? 36 : 60;
      const rot = f.still ? 0 : f.t * 0.0016;
      for (let i = 0; i < ticks; i++) {
        const major = i % 5 === 0;
        if (major || f.q > 0.6) f.line(turn(R, i / ticks + rot), turn(R - (major ? 0.07 : 0.035), i / ticks + rot), pal.ink, (major ? 0.42 : 0.22) * rOn, 1);
      }
      // two lit arcs ride outside the ring, turning once every two minutes
      const a0 = 0.07 - (f.still ? 0 : f.t * 0.008);
      trace(f, circle(R + 0.075, a0, a0 + 0.24 * rOn, Math.round(24 * f.q)), pal.key, 0.62 * rOn, 1.5);
      trace(f, circle(R + 0.075, a0 + 0.5, a0 + 0.5 + 0.15 * rOn, Math.round(16 * f.q)), pal.teal, 0.42 * rOn, 1.5);
      // crosshair: four arms that stop short of the centre, finely graduated
      for (let q = 0; q < 4; q++) {
        const cx = Math.cos((q * TAU) / 4);
        const cy = Math.sin((q * TAU) / 4);
        f.line(rp(cx * 0.055, cy * 0.055), rp(cx * 0.39 * rOn, cy * 0.39 * rOn), pal.ink, 0.4 * rOn, 1);
        if (q !== 3) f.line(rp(cx * (R + 0.04), cy * (R + 0.04)), rp(cx * 0.6, cy * 0.6), pal.ink, 0.26 * rOn, 1);
        for (let j = 1; j <= (m ? 0 : 4); j++) {
          const d = 0.17 + j * 0.044;
          f.line(rp(cx * d - cy * 0.012, cy * d + cx * 0.012), rp(cx * d + cy * 0.012, cy * d - cx * 0.012), pal.ink, 0.3 * rOn, 1);
        }
      }
      f.dot(rp(0, 0), 0.012, pal.ink, 0.9 * rOn);
      // viewfinder corners on the glass
      for (const [cu, cv] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const u = cu ? 0.93 : 0.07;
        const v = cv ? 0.95 : 0.05;
        f.path([pane.at(u, v + (cv ? -0.055 : 0.055)), pane.at(u, v), pane.at(u + (cu ? -0.076 : 0.076), v)], pal.ink, 0.3 * rOn, 1);
      }
      // where each trace meets the ring
      s.ports.forEach((p, i) => {
        const a = att(i);
        if (a > 0.02) f.glow(rp(p[0], p[1]), 0.1, pal.gold, 0.5 * a * rOn);
        f.dot(rp(p[0], p[1]), 0.011, pal.teal, 0.8 * rOn * (1 - a));
        f.dot(rp(p[0], p[1]), 0.012, pal.gold, 0.95 * rOn * a);
      });
    }

    // ── the keys: lit one after another at power-on, then attended one at a time
    const p0 = f.P(...top.at(0, 0.16));
    const p1 = f.P(...top.at(1, 0.16));
    const slope = p0 && p1 ? Math.atan2(p1.y - p0.y, p1.x - p0.x) : 0;
    // pixels from one key to the next: when the row is small, only the attended key is named
    const gap = p0 && p1 ? (Math.hypot(p1.x - p0.x, p1.y - p0.y) * PITCH) / CW : 0;
    const ku = (i: number) => 0.5 + ((i - 2) * PITCH) / CW;
    // the attended key spills its light on the console before the tiles are set on it
    KEYS.forEach((_, i) => f.glow(top.at(ku(i), (KV0 + KV1) / 2, KH), 0.46, pal.gold, 0.3 * att(i) * top.on));
    KEYS.forEach((name, i) => {
      const on = seq(0.35 + i * 0.2, 0.5) * top.on;
      const a = att(i);
      tile(f, top, ku(i), on, a);
      // the legend, engraved in front of its key and set along the row
      const show = gap < 68 ? a : on * (0.62 + 0.33 * a);
      const at = top.at(ku(i), 0.16);
      const p = f.P(at[0], at[1], at[2]);
      if (!p || show <= 0.02) return;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(slope);
      ctx.translate(-p.x, -p.y);
      f.label(name, at, { align: "center", size: gap > 90 ? 10 : 9, alpha: show * (1 - a), colour: pal.ink2 });
      f.label(name, at, { align: "center", size: gap > 90 ? 10 : 9, alpha: show * a, colour: pal.gold });
      ctx.restore();
    });
  },
};

export default scene;

/**
 * GALAXY — the market universe, as a spiral.
 *
 * A spiral galaxy seen at a tilt: a few hundred points wound into four
 * logarithmic arms round a bright core, each arm in one palette colour, the
 * whole disc turning once in several minutes inside one thin graduated
 * reference ring. The arms carry the names of four kinds of thing the page's
 * map connects (instruments, currencies, central banks, events); they are
 * names, not measurements, and no point stands for a price or a count.
 *
 * The pointer is a gravitational lens. Stars near it brighten, are drawn a
 * little toward it and trail short streaks back to where they were; the arm
 * with the most stars under the lens is picked out: its spine lights, its
 * bearing mark on the ring swells and its name comes up, while the other
 * three arms fall back.
 */
import { TAU, clamp, lerp, rgba, type Scene, type V3 } from "../engine";

const ARMS = 4;
const NAMES = ["INSTRUMENTS", "CURRENCIES", "CENTRAL BANKS", "EVENTS"];
/** the arms run from R0 to R1; WIND is the growth rate of the logarithmic spiral */
const R0 = 0.2;
const R1 = 1.4;
const WIND = 0.34;
const SWEEP = Math.log(R1 / R0) / WIND;
/** the reference ring, and how far the disc's plane is rolled out of the level */
const RING = 1.58;
const ROLL = 0.3;
/** perspective swells the near half of the disc, so the core stands a little above the pivot */
const LIFT = 0.1;
const CORE = ARMS;
const FIELD = ARMS + 1;

type Star = { kind: number; r: number; a: number; y: number; size: number; lum: number; ph: number };
type State = { stars: Star[]; sx: Float32Array; sy: Float32Array; ss: Float32Array; sk: Float32Array; em: number[]; weight: number[]; cr: number; sr: number; phase: number };

/** disc coordinates (radius, angle, height above the plane) to world: the disc is rolled about the line of sight */
const place = (s: State, r: number, a: number, y: number): V3 => {
  const x = Math.cos(a) * r;
  return [x * s.cr - y * s.sr, x * s.sr + y * s.cr + LIFT, Math.sin(a) * r];
};

const scene: Scene<State> = {
  pose: 14,
  setup(f) {
    const stars: Star[] = [];
    let id = 0;
    const rnd = () => f.rnd(id++);
    const per = f.mobile ? 44 : 92;
    for (let arm = 0; arm < ARMS; arm++)
      for (let i = 0; i < per; i++) {
        const k = (i + rnd()) / per;
        const r = lerp(R0, R1, Math.pow(k, 0.8));
        // scattered about the arm's spine, three draws so most stars keep close to it; the arm tightens outward
        const off = (rnd() + rnd() + rnd() - 1.5) * lerp(0.44, 0.15, k);
        stars.push({ kind: arm, r: r * (1 + (rnd() - 0.5) * 0.07), a: (arm * TAU) / ARMS + Math.log(r / R0) / WIND + off, y: (rnd() - 0.5) * 0.07, size: 0.0075 + 0.012 * rnd() ** 2, lum: 0.45 + 0.55 * rnd(), ph: rnd() * TAU });
      }
    // the bulge: a small swarm round the core, thicker than the disc
    for (let i = 0; i < (f.mobile ? 26 : 46); i++) {
      const r = 0.27 * Math.pow(rnd(), 1.4);
      stars.push({ kind: CORE, r, a: rnd() * TAU, y: (rnd() - 0.5) * 0.2 * (1 - r / 0.3), size: 0.006 + 0.008 * rnd(), lum: 0.6 + 0.4 * rnd(), ph: rnd() * TAU });
    }
    // a thin field between and beyond the arms, so the disc has a body
    for (let i = 0; i < (f.mobile ? 22 : 54); i++) stars.push({ kind: FIELD, r: 0.3 + 1.2 * rnd(), a: rnd() * TAU, y: (rnd() - 0.5) * 0.5, size: 0.0045 + 0.004 * rnd(), lum: 0.25 + 0.3 * rnd(), ph: rnd() * TAU });
    const n = stars.length;
    const roll = ROLL * (f.rnd(901) < 0.5 ? -1 : 1);
    return { stars, sx: new Float32Array(n), sy: new Float32Array(n), ss: new Float32Array(n), sk: new Float32Array(n), em: [0, 0, 0, 0], weight: [0, 0, 0, 0], cr: Math.cos(roll), sr: Math.sin(roll), phase: f.rnd(902) * TAU };
  },
  draw(f, s) {
    const { ctx, pal } = f;
    const tones = [pal.blue, pal.emerald, pal.indigo, pal.crimson];
    f.cam.parallax = 0.7;
    f.aim(f.still ? 0 : Math.sin(f.t * 0.05) * 0.05, -0.6, 6.4, f.mobile ? 0.95 : 1.02);
    // one turn takes several minutes
    const spin = s.phase + f.t * 0.016;
    const at = (r: number, a: number, y = 0): V3 => place(s, r, a + spin, y);

    // ── the lens: project every star, and weigh each arm by what lies under the pointer
    const reach = f.u * 0.95;
    const hov = f.hover;
    s.weight.fill(0);
    s.stars.forEach((st, i) => {
      const w = at(st.r, st.a, st.y);
      const p = f.P(w[0], w[1], w[2]);
      if (!p) {
        s.ss[i] = 0;
        return;
      }
      const k = hov > 0 ? clamp(1 - Math.hypot(p.x - f.mx, p.y - f.my) / reach) : 0;
      const pull = k * k * (3 - 2 * k) * hov;
      s.sx[i] = p.x;
      s.sy[i] = p.y;
      s.ss[i] = p.s;
      s.sk[i] = pull;
      if (st.kind < ARMS) s.weight[st.kind] += pull * st.lum;
    });
    let best = 0;
    for (let a = 1; a < ARMS; a++) if (s.weight[a] > s.weight[best]) best = a;
    const ease = f.still ? 1 : 1 - Math.exp(-f.dt * 6);
    let any = 0;
    for (let a = 0; a < ARMS; a++) {
      s.em[a] += ((a === best && s.weight[best] > 0.5 ? hov : 0) - s.em[a]) * ease;
      any = Math.max(any, s.em[a]);
    }
    const back = (a: number) => 1 - 0.5 * (any - s.em[a]);

    // ── the reference ring: one graduated hairline in the disc's plane, fixed while the disc turns
    const ringOn = f.on(0.85, 0.3);
    const seg = f.mobile ? 56 : 96;
    const loop: V3[] = [];
    for (let i = 0; i <= seg; i++) loop.push(place(s, RING, (i / seg) * TAU, 0));
    f.path(loop, pal.ink, 0.26 * ringOn, 1);
    const ticks = f.mobile ? 48 : 96;
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * TAU;
      const major = i % 8 === 0;
      f.line(place(s, RING, a, 0), place(s, RING - (major ? 0.075 : 0.035), a, 0), pal.ink, (major ? 0.42 : 0.2) * ringOn, 1);
    }
    // a lit arc rides the ring the other way, and two fine cross-wires meet at the core
    const arc: V3[] = [];
    for (let i = 0; i <= 20; i++) arc.push(place(s, RING + 0.05, -spin * 2.4 + (i / 20) * TAU * 0.09, 0));
    f.path(arc, pal.key, 0.5 * ringOn, 1.25);
    for (let q = 0; q < 4; q++) f.line(place(s, 0.42, (q * TAU) / 4, 0), place(s, RING - 0.1, (q * TAU) / 4, 0), pal.ink, 0.055 * ringOn, 1);

    // ── the core, and the haze the arms are wound from
    const coreOn = f.on(0, 0.4);
    const core: V3 = [0, LIFT, 0];
    f.glow(core, 1.25, pal.key, 0.1 * coreOn);
    f.glow(core, 0.62, pal.gold, 0.42 * coreOn);
    const hazes = f.mobile ? 4 : 7;
    for (let a = 0; a < ARMS; a++) {
      const base = (a * TAU) / ARMS;
      for (let j = 0; j < hazes; j++) {
        const r = lerp(0.42, R1 - 0.12, j / (hazes - 1));
        f.glow(at(r, base + Math.log(r / R0) / WIND), 0.3 + 0.1 * (j / hazes), tones[a], (0.12 + 0.14 * s.em[a]) * back(a) * f.on(0.2 + 0.5 * (r / R1), 0.3));
      }
      // the spine: barely there at rest, a lit trace when the arm is picked out
      const spine: V3[] = [];
      const reachOn = f.on(0.5, 0.5);
      for (let j = 0; j <= 30 * reachOn; j++) {
        const r = lerp(R0 * 1.3, R1, j / 30);
        spine.push(at(r, base + Math.log(r / R0) / WIND));
      }
      f.path(spine, tones[a], 0.14 * s.em[a], 7);
      f.path(spine, tones[a], (0.17 + 0.6 * s.em[a]) * back(a), 1 + 0.5 * s.em[a]);
    }

    // ── the stars: each is drawn toward the lens and leaves a streak back to where it stood
    s.stars.forEach((st, i) => {
      const sc = s.ss[i];
      if (sc <= 0) return;
      const on = f.on(0.1 + 0.7 * (st.r / R1), 0.3);
      if (on <= 0.003) return;
      const k = s.sk[i];
      const arm = st.kind < ARMS;
      const e = arm ? s.em[st.kind] : 0;
      const colour = arm ? (st.lum > 0.86 ? pal.ink : tones[st.kind]) : st.kind === CORE ? (st.lum > 0.8 ? pal.ink : pal.gold) : pal.ink2;
      const twinkle = f.still ? 1 : 0.8 + 0.2 * Math.sin(f.t * 0.7 + st.ph);
      const alpha = clamp(st.lum * twinkle * on * (arm ? back(st.kind) : 1) * (1 + 1.5 * k + 0.6 * e));
      const rad = Math.max(0.6, st.size * sc * f.u * (1 + 0.9 * k + 0.4 * e));
      const x = s.sx[i] + (f.mx - s.sx[i]) * 0.3 * k;
      const y = s.sy[i] + (f.my - s.sy[i]) * 0.3 * k;
      if (k > 0.03) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(s.sx[i] + (s.sx[i] - x) * 0.7, s.sy[i] + (s.sy[i] - y) * 0.7);
        ctx.strokeStyle = rgba(colour, alpha * 0.42);
        ctx.lineWidth = rad * 1.2;
        ctx.stroke();
      }
      if ((arm && st.lum > 0.86) || k > 0.3) {
        ctx.beginPath();
        ctx.arc(x, y, rad * 2.3, 0, TAU);
        ctx.fillStyle = rgba(arm ? tones[st.kind] : colour, alpha * 0.2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, TAU);
      ctx.fillStyle = rgba(colour, alpha);
      ctx.fill();
    });
    f.glow(core, 0.17, pal.ink, 0.75 * coreOn);

    // the lens itself: two fine rings of bent light round the pointer
    if (hov > 0.01) {
      ctx.lineWidth = 1;
      for (const [r, a] of [[0.42, 0.26], [0.95, 0.08]]) {
        ctx.beginPath();
        ctx.arc(f.mx, f.my, reach * r, 0, TAU);
        ctx.strokeStyle = rgba(pal.ink, a * hov);
        ctx.stroke();
      }
    }

    // ── bearing marks where the arms end, and their names, kept inside the frame
    const size = f.mobile ? 8 : 10;
    ctx.font = `600 ${size}px ${pal.font}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (let a = 0; a < ARMS; a++) {
      const tip = (a * TAU) / ARMS + SWEEP;
      const e = s.em[a];
      const level = ringOn * back(a);
      f.line(at(RING - 0.1, tip), at(RING + 0.05 + 0.05 * e, tip), tones[a], 0.9 * level, 2 + e);
      f.glow(at(RING, tip), 0.12 + 0.14 * e, tones[a], (0.3 + 0.5 * e) * level);
      const p = f.P(...at(RING + 0.13, tip));
      if (!p) continue;
      const wide = ctx.measureText(NAMES[a]).width;
      const b = f.box;
      const x = clamp(p.x >= f.cx ? p.x + 8 : p.x - 8 - wide, b.x + 12, b.x + b.w - 12 - wide);
      const y = clamp(p.y + (p.y >= f.cy ? 9 : -9), b.y + 14, b.y + b.h - 14);
      ctx.fillStyle = rgba(e > 0.5 ? pal.ink : tones[a], clamp((f.mobile ? 0.62 : 0.5) + 0.5 * e) * level);
      ctx.fillText(NAMES[a], x, y);
    }
  },
};

export default scene;

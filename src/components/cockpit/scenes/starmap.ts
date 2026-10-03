/**
 * STAR MAP — the glossary, as a sky that turns.
 *
 * The page below lays the glossary out flat, as constellations. Its
 * instrument is the same sky on a globe: eight groups of stars on a sphere,
 * one for each topic, each joined into a figure, turning slowly inside rings
 * of latitude and longitude. Stars on the near side are bright; those on the
 * far side show through, dimmer. Now and then one falls.
 *
 * The pointer turns the globe, and the star nearest to it is ringed and its
 * whole figure lights.
 *
 * The stars are placed by a seed. Their number and places mean nothing.
 */
import { TAU, clamp, rgba, type Frame, type Scene } from "../engine";
import { stage } from "./_stage";

const GROUPS = 8;
const PER = 13;

type Star = { v: [number, number, number]; g: number; size: number; tw: number };
type State = { stars: Star[] };

const norm = (v: [number, number, number]): [number, number, number] => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

const scene: Scene<State> = {
  pose: 5.3,
  setup(f) {
    const stars: Star[] = [];
    for (let g = 0; g < GROUPS; g++) {
      // the groups are spread evenly over the sphere
      const y = 1 - ((g + 0.5) / GROUPS) * 2;
      const r = Math.sqrt(1 - y * y);
      const a = g * 2.39996;
      const centre: [number, number, number] = [Math.cos(a) * r, y, Math.sin(a) * r];
      for (let i = 0; i < PER; i++) {
        const n = g * 97 + i * 7;
        const spread = 0.78;
        stars.push({
          v: norm([centre[0] + (f.rnd(n) - 0.5) * spread, centre[1] + (f.rnd(n + 1) - 0.5) * spread, centre[2] + (f.rnd(n + 2) - 0.5) * spread]),
          g,
          size: 1 + f.rnd(n + 3) * 1.8,
          tw: f.rnd(n + 4) * TAU,
        });
      }
    }
    return { stars };
  },
  draw(f: Frame, s: State) {
    const { ctx, pal } = f;
    const R = stage(f);
    const cx = R.x + R.w / 2;
    const cy = R.y + R.h / 2;
    const rad = Math.min(R.w, R.h) * 0.43;
    const yaw = f.t * 0.11 + f.px * 1.1;
    const pitch = 0.38 + f.py * 0.5;
    const cyaw = Math.cos(yaw);
    const syaw = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const tones = [pal.teal, pal.blue, pal.emerald, pal.gold];
    const proj = (v: readonly [number, number, number]) => {
      const x = v[0] * cyaw + v[2] * syaw;
      const z0 = -v[0] * syaw + v[2] * cyaw;
      const y = v[1] * cp - z0 * sp;
      const z = v[1] * sp + z0 * cp;
      return { x: cx + x * rad, y: cy - y * rad, z };
    };

    // the glow of the globe
    const glow = ctx.createRadialGradient(cx - rad * 0.3, cy - rad * 0.3, 0, cx, cy, rad * 1.25);
    glow.addColorStop(0, rgba(pal.blue, 0.2 * f.boot));
    glow.addColorStop(0.7, rgba(pal.teal, 0.05 * f.boot));
    glow.addColorStop(1, rgba(pal.teal, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 1.25, 0, TAU);
    ctx.fill();

    // rings of latitude and longitude, the far half fainter than the near
    const ring = (point: (a: number) => [number, number, number], alpha: number) => {
      let last = proj(point(0));
      for (let i = 1; i <= 72; i++) {
        const p = proj(point((i / 72) * TAU));
        ctx.strokeStyle = rgba(pal.ink3, alpha * (p.z > 0 ? 1 : 0.3) * f.boot);
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last = p;
      }
    };
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const m = (i / 6) * Math.PI;
      ring((a) => [Math.cos(a) * Math.cos(m), Math.sin(a), Math.cos(a) * Math.sin(m)], 0.32);
    }
    for (const lat of [-0.7, -0.35, 0, 0.35, 0.7]) {
      const r = Math.sqrt(1 - lat * lat);
      ring((a) => [Math.cos(a) * r, lat, Math.sin(a) * r], lat === 0 ? 0.6 : 0.3);
    }
    ctx.strokeStyle = rgba(pal.gold, 0.6 * f.boot);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, TAU);
    ctx.stroke();
    // a scale round the rim
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU;
      const r1 = rad + (i % 6 === 0 ? 9 : 4);
      ctx.strokeStyle = rgba(i % 6 === 0 ? pal.gold : pal.ink3, 0.6 * f.boot);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (rad + 2), cy + Math.sin(a) * (rad + 2));
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }

    const pts = s.stars.map((st) => ({ st, p: proj(st.v) }));
    // the star nearest the pointer, on the near side
    let hot = -1;
    if (f.hover > 0.2) {
      let best = 36;
      pts.forEach(({ p }, i) => {
        if (p.z <= 0) return;
        const d = Math.hypot(p.x - f.mx, p.y - f.my);
        if (d < best) {
          best = d;
          hot = i;
        }
      });
    }
    const hotGroup = hot >= 0 ? pts[hot].st.g : -1;

    // each group's figure: its stars joined in a chain, with one cross-tie
    for (let g = 0; g < GROUPS; g++) {
      const lit = g === hotGroup;
      const appear = f.on(0.25 + (g / GROUPS) * 0.5, 0.35);
      const tone = tones[g % tones.length];
      for (let i = 0; i < PER - 1; i++) {
        const a = pts[g * PER + i].p;
        const b = pts[g * PER + (i % 4 === 3 ? Math.max(0, i - 3) : i + 1)].p;
        const depth = (a.z + b.z) / 2;
        ctx.strokeStyle = rgba(lit ? tone : pal.ink2, (depth > 0 ? (lit ? 0.9 : 0.34) : 0.1) * appear);
        ctx.lineWidth = lit ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    // the stars
    pts.forEach(({ st, p }, i) => {
      const near = p.z > 0;
      const twinkle = f.still ? 1 : 0.75 + 0.25 * Math.sin(f.t * 2.2 + st.tw);
      const tone = tones[st.g % tones.length];
      const appear = f.on(0.2 + (st.g / GROUPS) * 0.5, 0.35);
      const r = st.size * (near ? 1 : 0.6) * (st.g === hotGroup ? 1.35 : 1);
      if (near) {
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5);
        halo.addColorStop(0, rgba(tone, 0.4 * twinkle * appear));
        halo.addColorStop(1, rgba(tone, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(p.x - r * 5, p.y - r * 5, r * 10, r * 10);
      }
      ctx.fillStyle = rgba(near ? tone : pal.ink3, (near ? 0.95 : 0.4) * twinkle * appear);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
      if (i === hot) {
        ctx.strokeStyle = rgba(pal.key, 0.95 * f.hover);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9 + Math.sin(f.t * 4) * 1.5, 0, TAU);
        ctx.stroke();
      }
    });

    // a falling star, once in a while
    if (!f.still) {
      const every = 5.5;
      const n = Math.floor(f.t / every);
      const q = (f.t - n * every) / 0.9;
      if (q < 1) {
        const sx = cx + (f.rnd(n * 5 + 900) - 0.5) * R.w * 0.8;
        const sy = R.y + R.h * (0.08 + f.rnd(n * 5 + 901) * 0.25);
        const dx = (f.rnd(n * 5 + 902) > 0.5 ? 1 : -1) * R.w * 0.3;
        const dy = R.h * 0.22;
        const hx = sx + dx * q;
        const hy = sy + dy * q;
        const tail = ctx.createLinearGradient(hx, hy, hx - dx * 0.3, hy - dy * 0.3);
        tail.addColorStop(0, rgba(pal.key, 0.9 * (1 - q)));
        tail.addColorStop(1, rgba(pal.key, 0));
        ctx.strokeStyle = tail;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - dx * 0.3 * clamp(q * 3), hy - dy * 0.3 * clamp(q * 3));
        ctx.stroke();
      }
    }
  },
};

export default scene;

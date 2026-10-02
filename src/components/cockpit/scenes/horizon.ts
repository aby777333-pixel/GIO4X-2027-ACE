/**
 * HORIZON — first light, seen from the flight deck.
 *
 * The limb of the Earth crosses the lower part of the stage: a great orb of
 * smoked glass, only its top cap in view, with the atmosphere as a thin line of
 * light along its edge. The whole day of longitude is engraved across that cap
 * (east to the right, north toward the horizon; longitudes are true in order
 * and proportion, latitude is compressed), so the nine financial centres all
 * stand on it at once.
 *
 * What is lit is read from the visitor's clock, never invented:
 *   - the sub-solar meridian is (12 - UTC hours) x 15 degrees; the day side of
 *     the glass is lit a little, the night side stays dark, and the sun comes up
 *     where the dawn meridian meets the limb (mean sun, equinox simplification)
 *   - a centre's lamp is emerald inside its exchange's regular hours, champagne
 *     in the hour before the open, dim otherwise (src/lib/sessions.ts)
 * The slim arc in the sky is the same day, graduated by the hour.
 */
import { TAU, clamp, easeOut, rgba, type Scene, type V3 } from "../engine";
import { lamp, trace } from "../kit";
import { allCentreStatus, centres } from "../../../lib/sessions";

const DEG = Math.PI / 180;
/** the orb, and how far below the pivot its centre lies */
const R = 2.645;
const YC = 2.66;
/** the longitude that faces the viewer, and the arc one degree of it takes: the whole day spans a quarter of the limb */
const LON0 = 30;
const K = 0.25;
/** where the equator lies on the cap (degrees from the crest, toward the viewer) and the latitude compression */
const B0 = 41;
const KLAT = 0.3;
/** the atmosphere, and the hour scale floating above it (as factors of the radius) */
const AIR = 1.007;
const SCALE = 1.19;
const RANK: Record<string, number> = { open: 0, pre: 1, lunch: 2, closed: 3 };
/** where a name may sit beside its lamp, in order of preference: under, over, right, left */
const SPOTS: [CanvasTextAlign, number, number][] = [["center", 0, 16], ["center", 0, -15], ["left", 12, 0], ["right", -12, 0]];

const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const smooth = (t: number) => clamp(t) * clamp(t) * (3 - 2 * clamp(t));
const aOf = (lon: number) => wrap(lon - LON0) * K * DEG;
/** unit normal of the glass at arc `a` (east-west) and depth `b` (toward the viewer), radians */
const nrm = (a: number, b: number): V3 => [Math.cos(b) * Math.sin(a), Math.cos(b) * Math.cos(a), -Math.sin(b)];
const hit = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

type P2 = { x: number; y: number };
/** a point of an arc of light: its screen position, its arc angle and its strength */
type Lit = P2 & { a: number; k: number };
type Box = [number, number, number, number];
type State = {
  cities: { name: string; n: V3 }[];
  para: { lat: number; pts: V3[] }[];
  minute: number;
  status: { state: string; wait: number }[];
  phase: number;
};

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const cities = centres.map((c) => ({ name: c.city.toUpperCase(), n: nrm(aOf(c.lon), (B0 - c.lat * KLAT) * DEG) }));
    const para = [60, 30, 0, -30].map((lat) => {
      const pts: V3[] = [];
      for (let a = -47.5; a <= 47.5; a += f.mobile ? 4 : 2.5) pts.push(nrm(a * DEG, (B0 - lat * KLAT) * DEG));
      return { lat, pts };
    });
    return { cities, para, minute: -1, status: [], phase: f.rnd(3) * TAU };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    f.aim(f.still ? 0 : Math.sin(f.t * 0.06 + s.phase) * 0.035, 0.2, 6, f.mobile ? 0.74 : 1);
    // the horizon wants the width of the stage: centred on a phone, a touch right of the golden section on a desk
    if (f.mobile) {
      f.cx = f.w * 0.5;
      f.cy -= f.h * 0.045;
    } else f.cx += f.u * 0.1;
    const S = (p: V3) => f.P(p[0], p[1], p[2]);
    const c = S([0, -YC, 0]);
    if (!c) return;
    const Rp = R * c.s * f.u;

    // The orb is drawn as the eye sees a planet: a disc. Surface points are laid
    // on the plane through its centre that faces the camera, so the engraving,
    // the lamps and the limb always agree, and the cap still turns with the camera.
    const cpt = Math.cos(f.cam.pitch);
    const fw: V3 = [-Math.sin(f.cam.yaw) * cpt, Math.sin(f.cam.pitch), Math.cos(f.cam.yaw) * cpt];
    const away = (n: V3) => n[0] * fw[0] + n[1] * fw[1] + n[2] * fw[2];
    const at = (n: V3, k = 1): V3 => {
      const d = away(n);
      return [(n[0] - d * fw[0]) * R * k, -YC + (n[1] - d * fw[1]) * R * k, (n[2] - d * fw[2]) * R * k];
    };
    /** the point where arc `a` meets the limb (k > 1 lifts it into the sky) */
    const limbB = (a: number) => Math.atan2(Math.sin(a) * fw[0] + Math.cos(a) * fw[1], fw[2]);
    const rim = (a: number, k = 1): V3 => at(nrm(a, limbB(a)), k);
    /** a meridian, from the limb down the glass toward the viewer: sampled finely where the surface turns away */
    const down = (a: number): V3[] => {
      const b0 = limbB(a);
      const pts: V3[] = [];
      for (let i = 0; i <= 9; i++) pts.push(at(nrm(a, b0 + (1 - b0) * Math.pow(i / 9, 1.7))));
      return pts;
    };
    /** keep the headline's side dark, and let the limb sink into the dark before the stage ends */
    const fadeX = (x: number) => (f.mobile ? 1 : smooth(((x - f.cx) / f.u + 1.85) / 0.75) * (1 - 0.65 * smooth(((x - f.cx) / f.u - 1.1) / 0.5)));
    /** what floats in the sky ends before the stage does, so nothing looks cut */
    const skyX = (x: number) => (f.mobile ? 1 : fadeX(x) * (1 - smooth(((x - f.cx) / f.u - 1.05) / 0.45)));
    const fade = (p: V3) => {
      const q = S(p);
      return q ? fadeX(q.x) : 0;
    };
    const stroke = (pts: readonly P2[], style: string | CanvasGradient, width: number, alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    };

    // ── the real clock: where the sun is, and which venues are inside regular hours
    const utc = f.now.getUTCHours() + f.now.getUTCMinutes() / 60 + f.now.getUTCSeconds() / 3600;
    const sunLon = wrap((12 - utc) * 15);
    const dawnA = aOf(sunLon - 90);
    const duskA = aOf(sunLon + 90);
    const minute = Math.floor(f.now.getTime() / 60000);
    if (minute !== s.minute) {
      s.minute = minute;
      s.status = allCentreStatus(f.now).map((x) => ({ state: x.state, wait: x.nextChangeIn }));
    }
    const breaking = f.on(1, 0.5); // daylight is the last thing to arrive
    /** how high the sun stands over a longitude, 0 (night) to 1 (noon) */
    const day = (lon: number) => Math.pow(clamp(Math.cos(wrap(lon - sunLon) * DEG)), 0.6) * breaking;
    const breathe = f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 0.5 + s.phase);
    const sun = rim(dawnA, AIR);
    const sunP = S(sun);
    const sunOn = fade(sun) * breaking;

    // ── the sun, still behind the planet: its bloom is drawn first so the glass covers the lower half
    f.glow(sun, 0.75, pal.gold, 0.24 * sunOn * breathe);

    // ── the orb: smoked glass, daylight raking over it from the sub-solar meridian
    ctx.save();
    ctx.beginPath();
    ctx.arc(c.x, c.y, Rp, 0, TAU);
    ctx.clip();
    ctx.fillStyle = rgba(pal.bg, 0.92 * f.boot);
    ctx.fillRect(0, 0, f.w, f.h);
    if (typeof ctx.createConicGradient === "function") {
      const g = ctx.createConicGradient(Math.PI / 2, c.x, c.y);
      g.addColorStop(0, rgba(pal.key, 0));
      for (let i = 0; i <= 24; i++) {
        const p = S(rim((-45 + i * 3.75) * DEG));
        if (p) g.addColorStop(clamp(0.5 + Math.atan2(p.x - c.x, c.y - p.y) / TAU), rgba(pal.key, (0.03 + 0.3 * day(LON0 - 180 + i * 15)) * fadeX(p.x) * f.boot));
      }
      g.addColorStop(1, rgba(pal.key, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, f.w, f.h);
    }
    // a soft sheen on the glass, moving a little with the pointer
    f.glow(at(nrm((-7 + f.px * 4) * DEG, 27 * DEG)), 1, pal.ink, 0.055 * f.boot);
    // graticule, engraved in the glass: a meridian every two hours, four parallels
    const etch = f.on(0.25, 0.5);
    for (let lon = -150; lon <= 180; lon += 30) {
      const line = down(aOf(lon));
      f.path(line, pal.ink, 0.16 * etch * fade(line[0]), 1);
    }
    // the parallels run the width of the cap, so they are veiled toward the headline like everything else
    let veil: string | CanvasGradient = pal.ink;
    if (!f.mobile) {
      const x0 = f.cx - 1.9 * f.u;
      veil = ctx.createLinearGradient(x0, 0, x0 + 3.6 * f.u, 0);
      for (let i = 0; i <= 12; i++) veil.addColorStop(i / 12, rgba(pal.ink, fadeX(x0 + 0.3 * f.u * i)));
    }
    for (const p of s.para) {
      const line: P2[] = [];
      for (const n of p.pts) {
        const q = S(at(n));
        if (q) line.push(q);
      }
      stroke(line, veil, 1, (p.lat === 0 ? 0.22 : 0.12) * etch);
    }
    ctx.globalAlpha = 1;
    // the terminator: dawn as a line of champagne light, dusk as a plain engraved line
    const duskLine = down(duskA);
    const dawnLine = down(dawnA);
    f.path(duskLine, pal.ink, 0.34 * fade(duskLine[0]) * breaking, 1.25);
    trace(f, dawnLine, pal.gold, 0.7 * fade(dawnLine[0]) * breaking, 1.25);
    // the glass darkens away from its edge: light only grazes the cap
    const shade = ctx.createRadialGradient(c.x, c.y, Rp * 0.52, c.x, c.y, Rp);
    shade.addColorStop(0, rgba(pal.bg, 0.97 * f.boot));
    shade.addColorStop(0.45, rgba(pal.bg, 0.8 * f.boot));
    shade.addColorStop(0.82, rgba(pal.bg, 0.24 * f.boot));
    shade.addColorStop(1, rgba(pal.bg, 0));
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, f.w, f.h);
    ctx.restore();

    // ── arcs of light that share one construction: the glass edge, the atmosphere just above it, the hour scale in the sky
    const steps = Math.round((f.mobile ? 28 : 44) * f.q);
    const spread = f.on(0.1, 0.6) * 1.35; // on power-on the arcs draw outward from the crest
    const band = (k: number, fx: (x: number) => number): Lit[] => {
      const out: Lit[] = [];
      for (let i = 0; i <= steps; i++) {
        const a = (-48 + (96 * i) / steps) * DEG;
        const p = S(rim(a, k));
        if (p) out.push({ x: p.x, y: p.y, a, k: fx(p.x) * clamp((spread - Math.abs((2 * i) / steps - 1)) / 0.3) });
      }
      return out;
    };
    /** a gradient along an arc: the `night` colour at rest, the key light where the sun is up */
    const lit = (pts: Lit[], night: string, base: number, gain: number): CanvasGradient => {
      const x0 = pts[0].x;
      const span = pts[pts.length - 1].x - x0 || 1;
      const g = ctx.createLinearGradient(x0, 0, x0 + span, 0);
      for (const p of pts) {
        const d = day(LON0 + p.a / DEG / K);
        g.addColorStop(clamp((p.x - x0) / span), rgba(d > 0.02 ? pal.key : night, (base + gain * d) * p.k));
      }
      return g;
    };
    /** a soft-ended run of colour on an arc, centred on a screen point */
    const spot = (p: P2, r: number, colour: string, alpha: number): CanvasGradient => {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * f.u * c.s);
      g.addColorStop(0, rgba(colour, alpha));
      g.addColorStop(0.45, rgba(colour, alpha * 0.45));
      g.addColorStop(1, rgba(colour, 0));
      return g;
    };
    const edge = band(1, fadeX);
    const air = band(AIR, fadeX);
    const scale = band(SCALE, skyX);
    if (edge.length > 2 && air.length > 2 && scale.length > 2) {
      ctx.save();
      const sky = lit(air, pal.key, 0.26, 0.7);
      stroke(edge, sky, 1, 0.45);
      stroke(air, sky, 12, 0.07);
      stroke(air, sky, 5, 0.2);
      stroke(air, sky, 1.25, 1);
      if (sunP) {
        // first light: the atmosphere turns to champagne around the point of sunrise
        const warm = spot(sunP, 0.7, pal.gold, sunOn);
        stroke(air, warm, 6, 0.3);
        stroke(air, warm, 1.75, 1);
      }
      // the trading day travels west: one slow glint along the atmosphere
      const t = (f.t / 16 + s.phase / TAU) % 1;
      const glint = f.still || f.boot < 1 ? null : S(rim((42 - 84 * t) * DEG, AIR));
      if (glint) stroke(air, spot(glint, 0.3, pal.ink, 0.85 * Math.sin(Math.PI * t) * fadeX(glint.x)), 1.5, 1);
      stroke(scale, lit(scale, pal.ink, 0.2, 0.45), 1.25, 1);
      ctx.restore();
    }
    f.glow(sun, 0.17, pal.gold, 0.55 * sunOn * breathe);
    f.dot(sun, 0.011, pal.ink, 0.9 * sunOn);

    // graduations: one per hour of longitude, a longer one every six, and the half hours on a desk
    const marks = f.on(0.45, 0.4);
    const fine = !f.mobile && f.q >= 1;
    for (let i = 0; i <= (fine ? 48 : 24); i++) {
      const h = fine ? i / 2 : i;
      const a = (-45 + h * 3.75) * DEG;
      const major = h % 6 === 2; // LON0 - 180 + h * 15 is a multiple of 90
      const half = h % 1 !== 0;
      const top = rim(a, SCALE);
      const q = S(top);
      if (q) f.line(top, rim(a, SCALE - (major ? 0.02 : half ? 0.005 : 0.011)), pal.ink, (major ? 0.5 : half ? 0.18 : 0.28) * marks * skyX(q.x), 1);
    }
    // indices on the scale: dawn, noon, dusk, each read from the clock
    const index = (a: number, text: string, colour: string, alpha: number): number => {
      const top = rim(a, SCALE + 0.014);
      const q = S(top);
      if (!q) return 0;
      const k = skyX(q.x) * marks * breaking * alpha;
      f.line(top, rim(a, SCALE - 0.026), colour, k, 1.5);
      // lettering is either legible or absent: never a ghost in the veil beside the headline
      if (!f.mobile && skyX(q.x) > 0.55) f.label(text, top, { dy: -11, align: "center", size: 9, colour, alpha: 0.85 * k });
      return k;
    };
    index(aOf(sunLon), "NOON", pal.ink2, 0.75);
    index(duskA, "DUSK", pal.ink2, 0.75);
    // the dawn index is tied to the point of sunrise by a hairline: the scale is read against the horizon
    f.line(rim(dawnA, SCALE - 0.03), rim(dawnA, AIR + 0.008), pal.gold, 0.24 * sunOn * index(dawnA, "DAWN", pal.gold, 1), 1);

    // ── the centres: a lamp each, lit in the order of the trading day
    const pts = s.cities.map((cty) => at(cty.n, 1.004));
    const scr = pts.map(S);
    pts.forEach((p, i) => {
      const st = s.status[i] ? s.status[i].state : "closed";
      const on = easeOut((f.boot - 0.3 - i * 0.05) / 0.25);
      const pulse = f.still ? 1 : 0.86 + 0.14 * Math.sin(f.t * 1.1 + i * 1.7);
      const size = 0.8 - 0.45 * away(s.cities[i].n); // lamps nearer the horizon are further away: a little smaller
      if (st === "open") lamp(f, p, pal.emerald, on * pulse, 0.021 * size);
      else if (st === "pre") lamp(f, p, pal.gold, on * 0.9, 0.019 * size);
      else if (st === "lunch") lamp(f, p, pal.emerald, on * 0.4, 0.016 * size);
      else {
        // an unlit lens
        f.dot(p, 0.017 * size, pal.ink, 0.34 * on);
        f.dot(p, 0.011 * size, pal.bg, 0.85 * on);
      }
    });

    // ── names: the venues that are open, then those next to open. A name sits beside its own lamp,
    // clear of the other lamps, the limb and the line of dawn, or it is left out.
    if (f.mobile) return;
    const lamps = scr.map((q): Box => (q ? [q.x - 13, q.y - 9, q.x + 13, q.y + 9] : [0, 0, 0, 0]));
    const taken: Box[] = [];
    const dl = dawnLine.map(S);
    for (let i = 1; i < dl.length; i++) {
      const p = dl[i - 1];
      const q = dl[i];
      if (!p || !q) continue;
      for (let j = 0; j < 6; j++) {
        const x = p.x + ((q.x - p.x) * j) / 6;
        const y = p.y + ((q.y - p.y) * j) / 6;
        taken.push([x - 6, y - 6, x + 6, y + 6]);
      }
    }
    const limbY = (x: number) => c.y - Math.sqrt(Math.max(0, Rp * Rp - (x - c.x) * (x - c.x)));
    const rank = (i: number) => (s.status[i] ? RANK[s.status[i].state] * 1e5 + s.status[i].wait : 9e5);
    const named = s.cities.map((_, i) => i).sort((i, j) => rank(i) - rank(j)).slice(0, 5);
    for (const i of named) {
      const p = scr[i];
      if (!p) continue;
      const w = s.cities[i].name.length * 6.7;
      const fit = SPOTS.map(([align, dx, dy]) => {
        const x0 = p.x + dx - (align === "center" ? w / 2 : align === "right" ? w : 0);
        return { align, dx, dy, box: [x0 - 2, p.y + dy - 7, x0 + w + 2, p.y + dy + 7] as Box };
      }).find(({ box }) => {
        const inside = box[2] < f.w - 8 && box[1] > Math.max(limbY(box[0]), limbY(box[2])) + 8;
        return inside && !lamps.some((b, j) => j !== i && hit(box, b)) && !taken.some((b) => hit(box, b));
      });
      if (!fit) continue;
      taken.push(fit.box);
      const on = easeOut((f.boot - 0.55) / 0.35) * fadeX(p.x);
      const live = s.status[i] && s.status[i].state === "open";
      f.label(s.cities[i].name, pts[i], { align: fit.align, dx: fit.dx, dy: fit.dy, size: 10, colour: pal.ink, alpha: (live ? 0.88 : 0.55) * on });
    }
  },
};

export default scene;

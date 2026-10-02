/**
 * EQUITIES — the opening bell.
 *
 * An exchange floor reduced to its essentials. Six glass plinths stand in an
 * arc on the deck, one for each share CFD GIO4X lists; they are all the same
 * height, because height here is not data. Above them hangs a 24-hour dial set
 * to New York time: the regular session is a band on its face, lit only while
 * the visitor's clock says the exchange is inside its regular hours, and a
 * marker rides the dial at the present minute. Nothing here is a price. On an
 * instrument page the page's own share is the plinth lit in champagne.
 */
import { TAU, clamp, easeOut, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, ring, trace } from "../kit";
import { allCentreStatus } from "../../../lib/sessions";

const SHARES = ["AAPL", "AMZN", "GOOGL", "NFLX", "MSFT", "TSLA"];
const FLOOR = -1.3;
/** depth of the arc's centre, which is also the plane the dial hangs in */
const ZC = 0.3;
/** radius of the arc the plinths stand on, the angle between neighbours, and half the rail's sweep */
const RA = 1.34;
const STEP = 0.44;
const HALF = 2.5 * STEP + 0.28;
/** a plinth: width along the arc, depth across it, height */
const PW = 0.42;
const PD = 0.36;
const PH = 0.36;
/** the dial: centre, face radius, and the channel the session band runs in */
const D: V3 = [0, -0.02, ZC];
const R = 0.86;
const RT = R * 0.76;
const BAND = 0.036;

type Clock = { stamp: number; ok: boolean; open: boolean; now: number; from: number; to: number; city: string; time: string; bells: [string, string] };
type State = { stands: { th: number; base: V3 }[]; rail: V3[]; inlay: V3[]; face: V3[]; rim: V3[]; clock: Clock; yaw: number; phase: number; lead: number };

/** a point on the floor, `th` radians round the arc from the place nearest the viewer */
const onFloor = (th: number, r: number): V3 => [Math.sin(th) * r, FLOOR, ZC - Math.cos(th) * r];
/** a point on the dial: one turn is one day, noon at the top, running clockwise */
const dial = (turn: number, r: number): V3 => {
  const a = Math.PI / 2 - (turn - 0.5) * TAU;
  return [D[0] + Math.cos(a) * r, D[1] + Math.sin(a) * r, D[2]];
};
const sweep = (from: number, to: number, r: number, n: number): V3[] => {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) out.push(dial(from + ((to - from) * i) / n, r));
  return out;
};
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** New York's regular session from the real timetable; re-read once a minute, not once a frame */
function readClock(now: Date, c: Clock): void {
  const stamp = Math.floor(now.getTime() / 60000);
  if (stamp === c.stamp) return;
  c.stamp = stamp;
  const ny = allCentreStatus(now).find((s) => s.centre.key === "new-york");
  c.ok = !!ny;
  if (!ny) return;
  c.open = ny.state === "open";
  c.now = ny.local.minutes / 1440;
  c.from = ny.centre.open / 1440;
  c.to = ny.centre.close / 1440;
  c.city = ny.centre.city.toUpperCase();
  c.time = `${DAYS[ny.local.weekday] ?? ""} ${ny.local.label}`.trim();
  c.bells = [hhmm(ny.centre.open), hhmm(ny.centre.close)];
}

/** fill a flat shape with a gradient: the light inside a piece of glass */
function shade(f: Frame, pts: readonly V3[], style: CanvasGradient, alpha: number): void {
  if (alpha <= 0.003) return;
  const { ctx } = f;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = f.P(pts[i][0], pts[i][1], pts[i][2]);
    if (!p) return;
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = style;
  ctx.fill();
  ctx.restore();
}

/**
 * A plinth of edge-lit glass, turned to face out from the arc. The light is in
 * its engraved top and falls away down the sides; `lit` marks the page's own share,
 * `swell` is the passing light of the rail. Returns the centre of the top face.
 */
function plinth(f: Frame, eye: V3, base: V3, th: number, h: number, colour: string, lit: number, swell: number, level: number): V3 {
  const { pal, ctx } = f;
  const tx = Math.cos(th) * PW * 0.5;
  const tz = Math.sin(th) * PW * 0.5;
  const nx = Math.sin(th) * PD * 0.5;
  const nz = -Math.cos(th) * PD * 0.5;
  const at = (a: number, b: number, y: number): V3 => [base[0] + tx * a + nx * b, base[1] + y, base[2] + tz * a + nz * b];
  const lo: V3[] = [at(-1, -1, 0), at(1, -1, 0), at(1, 1, 0), at(-1, 1, 0)];
  const hi: V3[] = [at(-1, -1, h), at(1, -1, h), at(1, 1, h), at(-1, 1, h)];
  const top = at(0, 0, h);
  const p1 = f.P(top[0], top[1], top[2]);
  const p0 = f.P(base[0], base[1], base[2]);
  if (!p0 || !p1) return top;
  const glow = ctx.createLinearGradient(0, p1.y, 0, p0.y + 1);
  glow.addColorStop(0, rgba(colour, 0.42 + 0.22 * lit));
  glow.addColorStop(0.5, rgba(colour, 0.13 + 0.12 * lit));
  glow.addColorStop(1, rgba(colour, 0.045 + 0.04 * lit));

  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const mx = (lo[i][0] + lo[j][0]) / 2;
    const mz = (lo[i][2] + lo[j][2]) / 2;
    const ox = mx - base[0];
    const oz = mz - base[2];
    const vx = eye[0] - mx;
    const vz = eye[2] - mz;
    const facing = (ox * vx + oz * vz) / (Math.hypot(ox, oz) * Math.hypot(vx, vz));
    if (facing <= 0) continue;
    const quad = [lo[i], lo[j], hi[j], hi[i]];
    f.fill(quad, pal.bg, 0.62 * level);
    shade(f, quad, glow, level * (0.35 + 0.65 * facing));
    f.line(lo[i], lo[j], pal.ink, 0.14 * level, 1);
    f.line(lo[i], hi[i], lit ? colour : pal.ink, (0.2 + 0.25 * lit) * level, 1);
    f.line(lo[j], hi[j], lit ? colour : pal.ink, (0.2 + 0.25 * lit) * level, 1);
  }
  // the engraved top: the lit face of the block
  f.fill(hi, pal.bg, 0.6 * level);
  f.fill(hi, colour, (0.2 + 0.1 * lit + 0.12 * swell) * level);
  f.path(hi, colour, (0.14 + 0.1 * swell) * level, 5, true);
  f.path(hi, colour, (0.7 + 0.25 * lit) * level, 1.1 + 0.4 * lit, true);
  return top;
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const n = f.mobile ? 22 : 40;
    const arcOn = (r: number): V3[] => {
      const out: V3[] = [];
      for (let i = 0; i <= n; i++) out.push(onFloor(-HALF + (2 * HALF * i) / n, r));
      return out;
    };
    const rail = arcOn(RA + 0.27);
    const seg = f.mobile ? 40 : 64;
    const face = sweep(0, 1, R, seg);
    return {
      stands: SHARES.map((_, i) => ({ th: (i - 2.5) * STEP, base: onFloor((i - 2.5) * STEP, RA) })),
      rail,
      inlay: rail.concat(arcOn(RA - 0.27).reverse()),
      face,
      rim: sweep(0, 1, R * 1.1, seg).concat(face.slice().reverse()),
      clock: { stamp: -1, ok: false, open: false, now: 0, from: 0, to: 0, city: "NEW YORK", time: "", bells: ["", ""] },
      yaw: -0.13 + (f.rnd(1) - 0.5) * 0.08,
      phase: f.rnd(2) * TAU,
      lead: Math.floor(f.rnd(3) * SHARES.length) % SHARES.length,
    };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    // seen from a little above, so the engraved tops of the plinths face the visitor
    f.aim(s.yaw + (f.still ? 0 : Math.sin(f.t * 0.08 + s.phase) * 0.045), -0.22, 6.4, f.mobile ? 0.66 : 0.9);
    if (f.mobile) {
      f.cx = f.w * 0.5;
      f.cy += Math.max(f.h * 0.18, f.u * 0.72) - f.h * 0.36;
    } else f.cy -= f.u * 0.4;
    const cp = Math.cos(f.cam.pitch);
    const eye: V3 = [f.cam.dist * cp * Math.sin(f.cam.yaw), -f.cam.dist * Math.sin(f.cam.pitch), -f.cam.dist * cp * Math.cos(f.cam.yaw)];
    readClock(f.now, s.clock);
    const k = s.clock;
    const focus = SHARES.indexOf(f.tag.toUpperCase());
    const lead = focus >= 0 ? focus : s.lead;

    // ── the floor: the deck, the light on it, and the inlaid arc the plinths stand on
    // (the deck stands still here: things are standing on it)
    deck(f, { y: FLOOR, half: 3.6, step: 0.6, alpha: 0.09, drift: 0 });
    pool(f, [0, FLOOR, ZC - 0.6], 2.3, pal.key, 0.2 * f.boot);
    f.fill(s.inlay, pal.ink, 0.04 * f.boot);
    f.path(s.inlay, pal.ink, 0.12 * f.boot, 1, true);
    const run = (f.t / 11 + s.phase) % 1;
    trace(f, s.rail, pal.key, 0.34 * f.on(0.2), 1, run);

    // ── the dial: a disc of smoked glass in a machined, graduated bezel
    const dOn = f.on(0.1, 0.45);
    const c0 = f.P(D[0], D[1], D[2]);
    const c1 = f.P(D[0], D[1] + R, D[2]);
    if (c0 && c1) {
      const rr = Math.abs(c0.y - c1.y);
      const body = ctx.createRadialGradient(c0.x - rr * 0.24, c0.y - rr * 0.32, rr * 0.05, c0.x, c0.y, rr * 1.05);
      body.addColorStop(0, rgba(pal.key, 0.16));
      body.addColorStop(0.64, rgba(pal.bg, 0.58));
      body.addColorStop(1, rgba(pal.bg, 0.9));
      shade(f, s.face, body, dOn);
      // the bezel is brushed metal: it catches the light high on the left and again, faintly, opposite
      const metal = ctx.createLinearGradient(c0.x - rr, c0.y - rr, c0.x + rr, c0.y + rr);
      metal.addColorStop(0.1, rgba(pal.ink, 0.26));
      metal.addColorStop(0.5, rgba(pal.ink, 0.05));
      metal.addColorStop(0.9, rgba(pal.ink, 0.14));
      shade(f, s.rim, metal, dOn);
      // and a sheen crosses the glass, following the pointer
      const at = clamp(0.42 + f.px * 0.2 + (f.still ? 0 : Math.sin(f.t * 0.19) * 0.05), 0.2, 0.8);
      const sheen = ctx.createLinearGradient(c0.x - rr, c0.y - rr, c0.x + rr, c0.y + rr);
      sheen.addColorStop(at - 0.2, rgba(pal.ink, 0));
      sheen.addColorStop(at, rgba(pal.ink, 0.045));
      sheen.addColorStop(at + 0.2, rgba(pal.ink, 0));
      shade(f, s.face, sheen, dOn);
    }
    ring(f, D, R * 1.1, { axis: "z", colour: pal.ink, alpha: 0.22 * dOn, seg: 80 });
    ring(f, D, R * 1.1, { axis: "z", colour: pal.ink, alpha: 0.5 * dOn, from: 0.28, to: 0.47, width: 1.5 });
    ring(f, D, R, { axis: "z", colour: pal.ink, alpha: 0.36 * dOn, ticks: f.mobile ? 24 : 48, major: f.mobile ? 1 : 2, tickLen: 0.04, rot: Math.PI / 2, seg: 96 });
    for (let q = 0; q < 4; q++) f.line(dial(q / 4, R), dial(q / 4, R - 0.13), pal.ink, 0.5 * dOn, 1.25);
    ring(f, D, RT + BAND, { axis: "z", colour: pal.ink, alpha: 0.1 * dOn, seg: 72 });
    ring(f, D, RT - BAND, { axis: "z", colour: pal.ink, alpha: 0.1 * dOn, seg: 72 });
    ring(f, D, R * 0.09, { axis: "z", colour: pal.ink, alpha: 0.3 * dOn, seg: 24 });
    f.dot(D, 0.02, pal.ink, 0.55 * dOn);

    if (k.ok) {
      // the regular session: lit while the exchange is inside it, a dim engraving otherwise
      const drawn = f.on(0.5, 0.45);
      const end = k.from + (k.to - k.from) * drawn;
      const n = Math.round((f.mobile ? 18 : 30) * f.q);
      const band = sweep(k.from, end, RT + BAND, n).concat(sweep(end, k.from, RT - BAND, n));
      if (k.open) {
        f.fill(band, pal.emerald, 0.42 * dOn);
        trace(f, sweep(k.from, end, RT, n), pal.emerald, 0.95 * dOn, 1.5);
      } else {
        f.fill(band, pal.ink, 0.11 * dOn);
        f.path(band, pal.ink, 0.34 * dOn, 1, true);
      }
      // the two bells, named on the bezel by their real times
      for (let e = 0; e < 2; e++) {
        const turn = e ? k.to : k.from;
        const on = e ? drawn : dOn;
        f.dot(dial(turn, RT), 0.016, k.open ? pal.emerald : pal.ink, (k.open ? 0.95 : 0.5) * on);
        if (f.mobile) continue;
        const left = dial(turn, 1)[0] < D[0];
        f.line(dial(turn, R * 1.1), dial(turn, R * 1.16), pal.ink, 0.32 * on, 1);
        f.label(k.bells[e], dial(turn, R * 1.19), { align: left ? "right" : "left", dx: left ? -4 : 4, size: 9, alpha: 0.62 * on });
      }
      // now: a lamp riding the channel, a hairline hand, and an index across the bezel
      const mOn = f.on(0.9, 0.3);
      const breathe = f.still ? 1 : 0.86 + 0.14 * Math.sin(f.t * 1.1);
      f.line(dial(k.now, R * 0.09), dial(k.now, RT - 0.08), pal.ink, 0.24 * mOn, 1);
      f.line(dial(k.now, R * 0.93), dial(k.now, R * 1.15), pal.key, 0.9 * mOn, 2);
      lamp(f, dial(k.now, RT), k.open ? pal.ink : pal.key, mOn * breathe, k.open ? 0.028 : 0.024);
    }
    // the city and its wall-clock time, on whichever half of the face the hand is not
    const side = k.ok && (k.now < 0.25 || k.now > 0.75) ? 1 : -1;
    const plate: V3 = [D[0], D[1] + side * R * 0.36, D[2]];
    f.label(k.city, plate, { align: "center", size: f.mobile ? 8 : 9, alpha: 0.66 * dOn, dy: f.mobile ? 0 : -8 });
    if (!f.mobile && k.ok) f.label(k.time, plate, { align: "center", size: 11, colour: pal.ink, alpha: 0.9 * dOn, dy: 7 });

    // ── the six shares, far plinths first; the lead one rises first and the rest follow outward
    for (const i of [0, 5, 1, 4, 2, 3]) {
      const st = s.stands[i];
      const on = easeOut((f.boot - 0.12 - Math.abs(i - lead) * 0.09) / 0.4);
      if (on <= 0) continue;
      const isFocus = i === focus;
      if (isFocus) {
        const breathe = f.still ? 1 : 0.9 + 0.1 * Math.sin(f.t * 0.9);
        pool(f, st.base, 0.66, pal.gold, 0.55 * on * breathe);
      }
      // the far ends of the arc sit a little further into the dark; the rail's light lifts each top as it passes
      const level = on * (isFocus ? 1 : (focus >= 0 ? 0.74 : 1) * (1.03 - 0.07 * Math.abs(i - 2.5)));
      const swell = f.still || isFocus ? 0 : Math.exp(-(((run - (st.th + HALF) / (2 * HALF)) / 0.08) ** 2));
      const top = plinth(f, eye, st.base, st.th, PH * on, isFocus ? pal.gold : pal.key, isFocus ? 1 : 0, swell, level);
      const named = !f.mobile || isFocus || (focus < 0 && i % 2 === s.lead % 2);
      if (named) f.label(SHARES[i], top, { align: "center", size: f.mobile ? 8 : 10, weight: 700, colour: pal.ink, alpha: (isFocus ? 0.98 : focus >= 0 ? 0.55 : 0.85) * on });
    }
  },
};

export default scene;

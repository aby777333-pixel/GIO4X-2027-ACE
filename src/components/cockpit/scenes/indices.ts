/**
 * INDICES — the situation wall.
 *
 * One pane of display glass, bent as an arc around the visitor, carries a
 * dot-matrix map of the world. The nine financial centres of the timetable in
 * src/lib/sessions.ts stand on it at their real latitude and longitude as
 * columns of light: emerald while the venue is inside its regular hours on the
 * visitor's clock, champagne at low level in the hour before the open or over a
 * midday break, a dim engraving when it is closed. The matrix itself is lit by
 * the real position of the sun, so the trading day can be seen moving west, and
 * the scale along the foot of the glass carries an index at local noon.
 *
 * Every column is the same height: height is not data. Nothing here is a price.
 * On an instrument page the home of that index is ringed in champagne.
 */
import { TAU, clamp, easeOut, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, pool, trace } from "../kit";
import { allCentreStatus, type CentreStatus } from "../../../lib/sessions";

/** land, 6 degrees to the dot: 60 columns from 180W, 22 rows from 78N to 54S */
const LAND = [
  "..........##..###...#######............##.....###...........",
  "#..###########.####..#####......############################",
  "..############...##..##...##...#############################",
  "...#....#######..###.........#.######################...#...",
  ".........############.......##########################..#...",
  ".........###########..........#####..#################......",
  ".........#########..........##..##################.#.#......",
  "..........#######...........####....##############..#.......",
  "...........###..#...........######################..........",
  "............##..##.........#########.###..########..........",
  ".............###..#........############...#...##..#.........",
  "................####........##########.....#..##..#.........",
  ".................#####.........#######........##.##.........",
  ".................#######.......######..........####.##......",
  ".................#######........#####...........#....##.....",
  ".................#######........#####.#............###......",
  "..................#####.........####.#...........######.....",
  "..................####..........####.............#######....",
  "..................###............##..............##.###.....",
  "..................##..................................#....#",
  "..................#.......................................#.",
  "..................#.........................................",
];
const CELL = 6;
const NORTH = 78;
const SOUTH = -54;

const DEG = Math.PI / 180;
/** the wall: radius of the bend, half-angle of the glass, half-angle of the map on it */
const RW = 2.25;
const A = 0.7;
const AM = 0.66;
/** world units per degree on the glass, the same along and up the wall */
const K = (RW * AM) / 180;
const Y0 = -0.72;
const Y1 = 0.8;
const MY = -0.6;
/** every column is the same height: height is not data */
const H = 0.36;
const OFF = 0.03;
const THICK = 0.045;
/** brightness of a dot by how high the sun stands over it: night, twilight, low sun, day */
const SEA = [0.03, 0.042, 0.062, 0.085];
const SOIL = [0.19, 0.27, 0.39, 0.52];

/** the page's index, and the city whose exchange it follows */
const HOME: Record<string, string> = { us30: "new-york", us500: "new-york", us100: "new-york", uk100: "london", de40: "frankfurt", jp225: "tokyo" };
/** the six named cities: which side the name sits on, and whether it sits at the foot of the column */
const NAMED: Record<string, [number, boolean]> = { "new-york": [-1, false], london: [-1, false], frankfurt: [1, false], tokyo: [1, false], "hong-kong": [1, true], sydney: [1, false] };

/** a point on the wall: angle along the arc, height, and how far it stands off the glass */
const wall = (a: number, y: number, lift = 0): V3 => [(RW - lift) * Math.sin(a), y, (RW - lift) * Math.cos(a) - RW];
const geo = (lon: number, lat: number, lift = 0, up = 0): V3 => wall((lon / 180) * AM, MY + (lat - SOUTH) * K + up, lift);

type Dot = { p: V3; lon: number; lat: number; u: number; land: boolean };
type State = { glass: V3[]; top: V3[]; slot: V3[]; dots: Dot[]; minute: number; shade: number[][]; cities: CentreStatus[]; open: number; sun: [number, number]; utc: string };

/** the timetable and the sun are read once a minute, not once a frame */
function readClock(f: Frame, s: State): void {
  const minute = Math.floor(f.now.getTime() / 60000);
  if (minute === s.minute) return;
  s.minute = minute;
  s.cities = allCentreStatus(f.now);
  const lit = s.cities.filter((c) => c.state === "open");
  s.open = lit.length ? lit.reduce((sum, c) => sum + c.centre.lon, 0) / lit.length : -999;
  const hh = f.now.getUTCHours();
  const mm = f.now.getUTCMinutes();
  s.utc = `UTC ${hh < 10 ? "0" : ""}${hh}:${mm < 10 ? "0" : ""}${mm}`;
  const day = (Date.UTC(f.now.getUTCFullYear(), f.now.getUTCMonth(), f.now.getUTCDate()) - Date.UTC(f.now.getUTCFullYear(), 0, 0)) / 864e5;
  const decl = -23.44 * DEG * Math.cos((TAU * (day + 10)) / 365);
  const sunLon = 180 - (hh * 60 + mm) / 4;
  s.sun = [sunLon, decl / DEG];
  s.shade = [[], [], [], [], [], [], [], []];
  s.dots.forEach((d, i) => {
    const e = Math.sin(d.lat * DEG) * Math.sin(decl) + Math.cos(d.lat * DEG) * Math.cos(decl) * Math.cos((d.lon - sunLon) * DEG);
    s.shade[(d.land ? 4 : 0) + (e > 0.22 ? 3 : e > 0.03 ? 2 : e > -0.14 ? 1 : 0)].push(i);
  });
}

/** one fill for a whole group of matrix dots */
function matrix(f: Frame, s: State, group: number[], size: number, alpha: number, reveal: number): void {
  if (!group.length) return;
  const { ctx } = f;
  ctx.beginPath();
  for (const i of group) {
    const d = s.dots[i];
    if (d.u > reveal) continue;
    const p = f.P(d.p[0], d.p[1], d.p[2]);
    if (!p) continue;
    const r = Math.max(0.6, size * p.s * f.u);
    ctx.moveTo(p.x + r, p.y);
    ctx.arc(p.x, p.y, r, 0, TAU);
  }
  ctx.fillStyle = rgba(f.pal.ink, alpha);
  ctx.fill();
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    const n = f.mobile ? 18 : 30;
    const top: V3[] = [];
    const bottom: V3[] = [];
    const slot: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const a = -A + (2 * A * i) / n;
      top.push(wall(a, Y1));
      bottom.push(wall(a, Y0));
      slot.push(wall(a, -1.3));
    }
    // the unlit dots of the matrix are part of the display on a desk, and left out on a phone
    const dots: Dot[] = [];
    LAND.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const land = row[i] === "#";
        if (!land && f.mobile) continue;
        const lon = -180 + (i + 0.5) * CELL;
        const lat = NORTH - (j + 0.5) * CELL;
        dots.push({ p: geo(lon, lat), lon, lat, u: 1 - i / row.length, land });
      }
    });
    return { glass: [...top, ...bottom.reverse()], top, slot, dots, minute: -1, shade: [], cities: [], open: -999, sun: [0, 0], utc: "" };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const sway = f.still ? 0 : Math.sin(f.t * 0.08 + f.rnd(3) * TAU) * 0.035;
    f.aim(-0.17 + (f.rnd(1) - 0.5) * 0.05 + sway, 0.1, 6.2, f.mobile ? 0.7 : 0.88);
    if (f.mobile) {
      f.cx = f.w * 0.5;
      f.cy = f.h * 0.3;
    }
    readClock(f, s);

    // ── the floor: the light the wall throws on it, and the slot of light it hangs over
    const floor = -1.3;
    deck(f, { y: floor, alpha: 0.12 });
    pool(f, [0, floor, -0.5], 2.5, pal.key, 0.22 * f.boot);
    if (!f.mobile) trace(f, s.slot, pal.key, 0.5 * f.boot, 1.25);
    // the venues inside their hours tint the floor under them
    if (s.open > -999) pool(f, wall((s.open / 180) * AM, floor, 0.35), 1.1, pal.emerald, 0.1 * f.on(0.8));

    // ── the glass: it rises into place as it powers on
    const on = f.on(0, 0.42);
    const rise = (1 - on) * 0.16 * f.u * f.cam.zoom;
    f.cy += rise;
    // the polished ends of the slab catch the light that runs inside it
    for (const a of [-A, A]) {
      const end = [wall(a, Y0), wall(a, Y1), wall(a, Y1, -THICK), wall(a, Y0, -THICK)];
      f.fill(end, pal.key, 0.2 * on);
      f.path(end, pal.ink, 0.2 * on, 1, true);
    }
    f.fill(s.glass, pal.bg, 0.55 * on);
    f.fill(s.glass, pal.ink, 0.035 * on);
    const pt = f.P(0, Y1, 0);
    const pb = f.P(0, Y0, 0);
    if (pt && pb) {
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < s.glass.length; i++) {
        const p = f.P(s.glass[i][0], s.glass[i][1], s.glass[i][2]);
        if (!p) continue;
        if (i) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.clip();
      // the lit top edge spills a little light down into the pane
      const edge = ctx.createLinearGradient(0, pt.y, 0, pb.y);
      edge.addColorStop(0, rgba(pal.key, 0.15 * on));
      edge.addColorStop(0.42, rgba(pal.key, 0.015 * on));
      edge.addColorStop(0.8, rgba(pal.key, 0.02 * on));
      edge.addColorStop(1, rgba(pal.key, 0.11 * on));
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, f.w, f.h);
      // daylight: a soft wash where the sun stands over the map right now
      for (const wrap of [-360, 0, 360]) if (Math.abs(s.sun[0] + wrap) < 250) f.glow(geo(s.sun[0] + wrap, s.sun[1]), 1.05, pal.key, 0.085 * on);
      // a sheen that follows the pointer across the glass
      const band = clamp(0.3 + f.rnd(5) * 0.12 + f.px * 0.2 + (f.still ? 0 : Math.sin(f.t * 0.19) * 0.06), 0.05, 0.9);
      const sheen = ctx.createLinearGradient(f.cx - 1.5 * f.u, pt.y, f.cx + 1.5 * f.u, pb.y);
      sheen.addColorStop(Math.max(0, band - 0.2), rgba(pal.ink, 0));
      sheen.addColorStop(band, rgba(pal.ink, 0.06 * on));
      sheen.addColorStop(Math.min(1, band + 0.14), rgba(pal.ink, 0));
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, f.w, f.h);
      ctx.restore();
    }

    // ── the map: a dot matrix, every dot lit by the real height of the sun over it
    // it writes itself in from the east, the way the trading day travels
    const sweep = f.boot >= 1 ? 2 : (f.boot - 0.3) / 0.62;
    matrix(f, s, s.shade[7], 0.027, 0.05 * on, sweep);
    for (let lv = 0; lv < 4; lv++) {
      if (f.q >= 1) matrix(f, s, s.shade[lv], 0.0068, SEA[lv] * on, sweep);
      matrix(f, s, s.shade[4 + lv], 0.0125, SOIL[lv] * on, sweep);
    }

    // seams between the three panes, with their clips
    for (const a of [-A / 3, A / 3]) {
      f.line(wall(a, Y0), wall(a, Y1), pal.ink, 0.1 * on, 1);
      f.line(wall(a, Y1), wall(a, Y1 - 0.04), pal.ink, 0.38 * on, 2);
      f.line(wall(a, Y0), wall(a, Y0 + 0.04), pal.ink, 0.4 * on, 2);
    }
    // the scale along the foot of the glass: one mark per hour of longitude, and an index at local noon
    for (let i = 0; i <= 24; i += f.mobile ? 2 : 1) f.line(geo(-180 + i * 15, SOUTH, 0, Y0 - MY), geo(-180 + i * 15, SOUTH, 0, Y0 - MY + (i % 6 ? 0.022 : 0.045)), pal.ink, (i % 6 ? 0.22 : 0.4) * on, 1);
    f.line(geo(s.sun[0], SOUTH, 0, Y0 - MY), geo(s.sun[0], SOUTH, 0, Y0 - MY + 0.07), pal.key, 0.95 * on, 2);

    // machined edge: a hairline all round, the top edge lit
    f.path(s.glass, pal.ink, 0.16 * on, 1, true);
    trace(f, s.top, pal.key, 0.62 * on, 1.4);
    f.line(wall(-A, Y1), wall(-A, Y0), pal.key, 0.4 * on, 1);
    f.line(wall(A, Y1), wall(A, Y0), pal.key, 0.4 * on, 1);
    if (!f.mobile) f.label("NOON", geo(s.sun[0], SOUTH, 0, Y0 - MY), { dy: 13, align: "center", size: 9, colour: pal.ink2, alpha: 0.6 * on });
    if (!f.mobile) f.label(s.utc, wall(-A + 0.035, Y1 - 0.09), { size: 10, colour: pal.ink2, alpha: 0.75 * on });

    // ── the centres: one column of light each, all the same height
    const focus = HOME[f.tag.toLowerCase()] ?? "";
    for (const pass of [0, 1]) {
      s.cities.forEach((c, i) => {
        const open = c.state === "open";
        if ((pass === 1) !== open) return;
        const up = easeOut((sweep - (180 - c.centre.lon) / 360) / 0.12);
        if (up <= 0) return;
        const { lon, lat, key, city } = c.centre;
        const waiting = c.state === "pre" || c.state === "lunch";
        const glows = open || waiting;
        const colour = open ? pal.emerald : waiting ? pal.gold : pal.ink;
        const breathe = f.still ? 1 : 0.85 + 0.15 * Math.sin(f.t * 0.8 + f.rnd(10 + i) * TAU);
        const level = (open ? breathe : waiting ? 0.5 : 0.3) * up;
        const base = geo(lon, lat, OFF);
        const head = geo(lon, lat, OFF, H * up);
        if (key === focus) {
          // the page's own index: its home is ringed in champagne
          const hoop: V3[] = [];
          for (let k = 0; k < 28; k++) hoop.push(geo(lon + (Math.cos((k / 28) * TAU) * 0.048) / K, lat + (Math.sin((k / 28) * TAU) * 0.048) / K, OFF));
          f.path(hoop, pal.gold, 0.18 * up, 6, true);
          f.path(hoop, pal.gold, 0.95 * up, 1.6, true);
        }
        if (glows) f.line(base, head, colour, 0.12 * level, 8);
        for (let k = 0; k < 5; k++) f.line(geo(lon, lat, OFF, (H * up * k) / 5), geo(lon, lat, OFF, (H * up * (k + 1)) / 5), colour, level * (1 - 0.14 * k), glows ? 2 : 1);
        if (glows) lamp(f, base, colour, level, 0.016);
        else f.dot(base, 0.011, pal.ink, 0.5 * up);
        f.dot(head, glows ? 0.009 : 0.007, key === focus ? pal.gold : colour, key === focus ? up : glows ? level : 0.5 * up);
        // a glint of light climbs each open column, slowly
        if (open && up >= 1 && !f.still && !f.mobile) {
          const k = (f.t / (9 + (i % 3)) + f.rnd(30 + i)) % 1;
          f.line(geo(lon, lat, OFF, H * k), geo(lon, lat, OFF, H * Math.min(1, k + 0.1)), pal.ink, 0.5 * Math.sin(Math.PI * k), 2);
        }
        const named = NAMED[key];
        if (named && !f.mobile) {
          const beside = (d: number): V3 => geo(lon + (named[0] * d) / K, lat, OFF, named[1] ? 0 : H * up);
          f.line(beside(0.022), beside(0.05), pal.ink, 0.3 * up, 1);
          f.label(city.toUpperCase(), beside(0.065), { align: named[0] < 0 ? "right" : "left", size: 10, colour: key === focus ? pal.gold : pal.ink, alpha: (key === focus ? 1 : focus ? 0.6 : 0.82) * up });
        }
      });
    }
    f.cy -= rise;
  },
};

export default scene;

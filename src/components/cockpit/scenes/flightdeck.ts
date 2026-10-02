/**
 * FLIGHT DECK — the trading day, seen from the flight deck.
 *
 * The homepage's instrument. One Canvas 2D scene, drawn on the whole stage:
 *   - the globe: a solid ball with the land as a field of points, lit by the real
 *     sun (sub-solar point from the UTC clock and the day of the year), so the
 *     terminator is where day meets night right now; the nine financial centres of
 *     src/lib/sessions.ts stand on it, lit by their regular trading hours
 *   - flows: arcs between centres that are inside their regular sessions at the
 *     same time, with couriers of light travelling them
 *   - the dial: 24 hours of UTC about the globe, carrying the four FX session
 *     windows and the present minute
 *   - three forms that carry no data at all, only the shape of the thing: a tape
 *     of dashes orbiting the globe, a depth ladder standing to its right, a candle
 *     ribbon on the console below it. No prices, no axis, no symbol.
 *
 * It lives by itself. A seeded schedule read from the scene clock (never
 * Math.random) lets things happen at irregular intervals: a pulse leaves an open
 * centre and travels the globe, a burst of couriers crosses an ocean, a sweep
 * passes through the ladder, a comet circles the dial, a scanning light crosses
 * the land, a run of the tape prints bright.
 *
 * Under the pointer it wakes: the instruments power up one after another, the
 * names gain their local times, the globe turns to face the pointer, the nearest
 * centre opens a readout (its real local time and the state of its regular
 * session), and the arcs from that centre light. The dial reads the hour under
 * the pointer and the FX windows that hour falls in; the ladder and the ribbon
 * answer with a level and a hairline. When the pointer leaves it settles again.
 *
 * What is real: clock times, time zones, the sun, which regular sessions are open.
 * Everything else is form, and the caption under the stage says so.
 *
 * Below the desk layout (1080px) the statement fills the lower stage, so the scene
 * is lighter: the globe, the dial, the flows and the tape stand in the sky above
 * the words (the scene measures where they begin) and fade where the words are.
 * The two panes of glass, the names and the readouts belong to the desk layout.
 */
import { TAU, clamp, rgba, type Frame, type Scene } from "../engine";
import { pool } from "../kit";
import { allCentreStatus, centres, formatDuration, fxSessions, windowInUtc, type CentreStatus } from "../../../lib/sessions";

const PI = Math.PI;
const DEG = PI / 180;
/** camera distance (world units) */
const D = 6;
/** the globe, the dial about it, the tape's orbit */
const R = 0.8;
const RD = 1;
const RT = 1.27;
const FLOOR = -1.3;
const NC = centres.length;
/** a point of the globe faces the viewer when its facing is above this (perspective horizon) */
const HOR = R / D + 0.012;
/** the tape's orbit: inclined so its near side dips under the equator, and rolled a little */
const SIN_I = Math.sin(0.36);
const COS_I = Math.cos(0.36);
const SIN_R = Math.sin(-0.2);
const COS_R = Math.cos(-0.2);
const FX_TONE = ["teal", "blue", "blue", "emerald"] as const;
const REGIONS = ["ASIA", "EUROPE", "AMERICAS"] as const;

/* ── the land, as outlines (longitude, latitude). Coarse on purpose: it is sampled into a field of points. */
const LAND: number[][] = [
  // North America
  [-168, 66, -162, 70, -156, 71, -141, 70, -128, 70, -115, 68, -105, 68, -95, 68, -88, 68, -85, 66, -87, 64, -93, 61, -94, 58, -90, 57, -85, 55, -82, 53, -79, 51, -79, 55, -77, 57, -78, 62, -73, 62, -70, 61, -65, 60, -62, 57, -56, 53, -60, 50, -66, 50, -70, 47, -65, 48, -64, 45, -66, 44, -70, 43, -70, 41.5, -74, 40, -76, 37, -76, 35, -78, 34, -81, 31, -80, 27, -80, 25, -82, 26, -83, 29, -84, 30, -88, 30, -90, 29, -94, 29.5, -97, 27.5, -97.5, 22, -96, 19, -94, 18, -91, 19, -90, 21, -87, 21.5, -88, 18, -88, 16, -84, 15.5, -83, 11, -82, 9, -79, 9.5, -77, 8, -80, 7.5, -83, 8.5, -85, 10, -87, 13, -91, 14, -94, 16, -98, 16, -102, 18, -105, 20, -106, 23, -109, 26, -112, 30, -113, 31.5, -114.5, 30, -112, 26, -110, 23, -112, 25, -115, 29, -117, 32.5, -120, 34.5, -122, 37, -124, 40, -124, 46, -123, 49, -127, 51, -131, 55, -135, 58.5, -140, 60, -146, 61, -152, 59, -158, 56.5, -163, 55, -158, 58.5, -162, 60, -165, 62.5, -161, 64.5, -166, 65.5],
  // the Canadian Arctic, Greenland, Cuba
  [-80, 73, -70, 71, -62, 66.5, -66, 62.5, -72, 64, -78, 65, -74, 68, -85, 70, -88, 73],
  [-125, 72, -110, 73, -100, 73, -95, 75, -85, 76, -80, 76, -90, 80, -70, 83, -62, 82, -75, 78.5, -95, 77, -110, 78, -120, 76],
  [-73, 78, -60, 76, -55, 70, -51, 64, -45, 60, -42, 62, -38, 65.5, -25, 69, -21, 72, -20, 77, -18, 80, -30, 83.5, -50, 82.5, -62, 81.5],
  [-85, 22, -80, 23, -75, 20.5, -77, 20, -82, 22],
  // South America
  [-77, 8, -75, 11, -72, 12, -68, 11.5, -62, 10.5, -60, 8.5, -57, 6, -52, 5, -50, 1, -48, -1, -44, -2.5, -40, -3, -37, -5, -35, -7, -35, -9, -39, -14, -39, -18, -41, -22, -45, -23.5, -48.5, -26, -48.5, -28.5, -52, -33, -54.5, -34.8, -57.5, -34.5, -57, -38, -62, -39, -65, -41, -63.5, -42.5, -67, -46, -66, -48, -69, -51, -68.5, -53, -66, -55, -71, -54, -74.5, -52, -75, -47, -73, -42, -73.5, -37, -71.5, -30, -70.5, -23, -70.3, -18.3, -75, -15, -77.5, -11, -81, -6, -80, -3, -80.5, 0, -78.5, 2, -77.5, 5],
  // Africa, Madagascar
  [-17, 14.7, -16.5, 20, -13, 27.5, -9.8, 30, -6, 35.8, -2, 35, 3, 37, 10, 37.3, 11, 34, 15, 32.3, 20, 32.8, 20, 30.5, 25, 32, 29, 31, 32.5, 31.2, 34, 28, 35.5, 24, 37.5, 18.5, 39.5, 15, 43, 11.5, 44.5, 10.5, 51, 12, 50, 8, 47, 4, 42, -1.5, 39.5, -5, 39.5, -10, 40.5, -15, 35, -20, 35.5, -24, 32.7, -26, 32.5, -29, 28.5, -33, 25, -34, 20, -34.8, 18.3, -33.5, 17.5, -30, 15, -26.5, 14.5, -22, 12, -17, 13.8, -11, 12.3, -6, 9, -1, 9.8, 3.5, 7, 4.3, 4, 6.3, -2, 5, -7.5, 4.5, -11, 6.8, -13.5, 9.5, -15, 11, -16.8, 12.5],
  [49.3, -12.2, 50.5, -15.5, 47.5, -24.8, 45, -25.5, 43.5, -22.5, 44.3, -16.5, 47, -14.5],
  // Europe and Asia
  [-9, 37, -9.5, 39, -8.8, 43.2, -1.8, 43.5, -1.2, 46, -4.5, 48.3, -1.5, 48.7, 1.5, 50.5, 4, 52, 5, 53.4, 8.5, 54, 8.2, 57, 10.5, 57.5, 10.2, 55.5, 12, 54.2, 14, 54, 18.5, 54.8, 21, 55.5, 21.5, 57.5, 24, 57.5, 23.5, 59.3, 28, 59.7, 30, 60, 28, 60.6, 23, 60, 21.5, 61, 21.5, 63, 25, 65.2, 24, 66, 21.5, 64.5, 17.5, 62, 17, 60.5, 19, 59.5, 16.5, 56.5, 14.2, 55.5, 12.8, 55.5, 11, 59, 7.5, 58, 5.2, 59.5, 5, 62, 10.5, 64.5, 14, 68, 19, 70, 25, 71, 31, 70.2, 41, 67, 40.5, 66, 35, 66.5, 34.5, 64.5, 38, 64, 40.5, 64.5, 44, 66.2, 47, 67, 54, 68.5, 60, 69, 66.5, 69, 70, 73, 80, 73, 86, 74, 100, 76.5, 105, 77.5, 113, 73.8, 127, 72.5, 131, 71, 140, 72.7, 150, 71, 160, 69.7, 170, 69.5, 179, 68.8, 179, 65, 177, 62.5, 170, 60, 164, 60, 162, 57.5, 163, 56, 161, 54.5, 156.7, 51, 155.5, 56, 156.5, 58, 161, 60.5, 160, 61.8, 155, 59.3, 148, 59.3, 142, 59, 135.2, 54.7, 138, 54, 141, 52.5, 140.5, 48, 138, 46.2, 135, 43.3, 131.5, 42.8, 129.7, 41, 127.5, 39.5, 129.3, 37, 129, 35.2, 126.5, 34.4, 126.3, 37, 124.8, 38.3, 125, 39.7, 122, 39.2, 121.5, 40.8, 118, 39, 119, 37.3, 122.5, 37.3, 119.3, 35, 120.3, 33.5, 121.9, 31, 121.8, 28.5, 119.5, 25.5, 116.8, 23.3, 113.5, 22.3, 110.5, 21.3, 108.5, 21.7, 106.6, 20, 105.7, 18.7, 107.5, 16.3, 109.3, 13, 109, 11.5, 107, 10.4, 105, 8.7, 104.8, 10.3, 103, 11.2, 100.9, 13, 100, 12.5, 99.2, 9.5, 100.5, 7, 102.5, 4.5, 103.4, 1.5, 101.3, 2.8, 100.3, 6, 98.3, 8.3, 98.5, 12, 97.7, 16.5, 95.5, 16, 94.3, 18.5, 92, 21.5, 90.5, 22.5, 88.5, 21.8, 86.8, 20.5, 85, 19.5, 82.3, 16.6, 80.2, 15.5, 80.2, 12.5, 79.8, 10.2, 77.5, 8.1, 76.3, 10, 74.8, 13, 73.5, 16, 72.8, 19.2, 72.6, 21.3, 70.5, 20.8, 69, 22.3, 67.5, 24, 66.7, 25.3, 61.5, 25.2, 57.3, 25.7, 56.5, 27, 54.5, 26.6, 51.5, 27.9, 50.2, 30.1, 48.7, 30.3, 48, 29.5, 50, 26.7, 51.5, 24.3, 54, 24.2, 56.3, 26.2, 56.6, 24.5, 59.8, 22.4, 58.5, 20.4, 57.6, 19, 55.2, 17.5, 52, 16, 45, 12.8, 43.3, 12.7, 42.7, 15.5, 41, 19, 39, 22, 37.5, 25, 35, 28, 34.9, 29.5, 34.3, 31.3, 35.9, 35.5, 36, 36.8, 33, 36.2, 30.5, 36.3, 27.3, 36.8, 26.2, 39.5, 29, 41, 31.5, 41.2, 36, 41.7, 41.5, 41.5, 41.5, 43, 37.5, 45, 39, 47, 35, 46, 33.5, 44.5, 32.5, 46, 30.2, 46.2, 28, 43.5, 28, 42, 26, 40.9, 23.8, 40.3, 24, 38, 22.8, 36.5, 21.2, 37.5, 19.5, 41, 19.5, 42, 15.5, 44, 13.7, 45.6, 12.3, 45.3, 12.5, 44, 15.5, 42, 18.3, 40.3, 17, 39, 16.2, 38, 15.7, 40, 12.5, 41.5, 10.3, 43.2, 8.8, 44.4, 6.5, 43.2, 3.2, 43.2, 3, 41.7, 0, 39.8, -0.5, 38.3, -2, 36.8, -5.3, 36.1, -6.5, 36.9],
  // the British Isles, Iceland, the Arctic islands
  [-5.5, 50, -3, 50.5, 1.3, 51.2, 1.7, 52.7, 0, 53.5, -1.5, 55, -2, 57.5, -3.5, 58.6, -5.2, 58.5, -6, 56.5, -4.8, 54.8, -3, 54, -4.5, 53.2, -4.8, 51.8, -3, 51.4],
  [-10, 51.6, -6.2, 52.2, -6, 54.5, -8, 55.3, -10, 54],
  [-24, 65.5, -22, 66.4, -16, 66.5, -13.6, 65, -18, 63.4, -22.5, 63.8],
  [52, 71, 57, 70.5, 60, 74, 68, 76.8, 62, 76, 55, 73.5],
  [11, 79, 17, 80, 25, 80, 20, 77.5, 15, 77],
  // Japan, Sakhalin, Taiwan, Sri Lanka
  [130, 31.2, 131.8, 33.6, 135, 33.5, 137, 34.6, 140, 35.2, 141, 38, 141.5, 40.5, 140, 41, 139.8, 38.5, 137, 37, 136, 35.7, 132.5, 35.5, 130.9, 34, 129.7, 33],
  [140.2, 42, 141.5, 45.4, 145.3, 44, 145, 43, 143.2, 42, 141, 42.5],
  [142, 46, 143.5, 49.5, 143, 54, 142, 53, 142.2, 49],
  [120.2, 23, 121.5, 25.2, 121.8, 24, 120.8, 22],
  [79.8, 8.5, 81.8, 7.5, 81, 6, 80, 6],
  // the archipelago
  [120.3, 18.5, 122.2, 18.4, 122, 16, 124, 13, 121.8, 13.7, 120.2, 14.5],
  [122, 7, 124, 8.5, 126.5, 9.5, 126.3, 6.3, 124, 6],
  [109, 1.5, 111.5, 2, 113, 3.5, 116.7, 7, 119, 5, 117.8, 1, 116.5, -1.5, 116, -4, 112, -3.3, 110, -1.5],
  [95.3, 5.5, 98, 4, 103.5, -1, 106, -3.5, 105.5, -5.8, 102, -4, 98.8, 1.5, 95.5, 4.5],
  [105.5, -6.5, 108.5, -6.7, 112.7, -6.9, 114.5, -7.8, 113, -8.4, 108, -7.8],
  [119.5, 0.7, 121, 1.2, 125, 1.6, 123.2, 0.4, 120.5, 0.2, 121.5, -1.5, 123.2, -4, 122, -5, 120.4, -5.5, 119.5, -3.5, 118.8, -2.6],
  [131, -0.8, 134, -0.8, 138, -1.6, 141, -2.6, 145, -4.3, 147.5, -6, 150.8, -10.2, 147, -9.5, 143.5, -9, 141, -9.1, 138.5, -8.2, 138, -5.5, 134, -4, 132.5, -2.8],
  // Australia, Tasmania, New Zealand
  [113.7, -22.5, 114.2, -26.5, 115.7, -32, 115, -34.3, 118, -35, 123.5, -34, 126, -32.3, 131, -31.5, 134.5, -33, 137.8, -35.5, 139.5, -37, 141, -38.3, 143.5, -38.8, 146.5, -39, 150, -37.5, 151.3, -33.8, 153.2, -30, 153.2, -25.5, 150.8, -22.8, 149, -20.3, 146.2, -18.9, 145.3, -15, 143.5, -14, 142.5, -10.8, 141.6, -13, 141, -17.3, 139.5, -17.5, 135.5, -15, 136.8, -12.2, 132.7, -11.5, 130, -12.8, 129.5, -15, 127, -14, 125, -15.5, 122.2, -17.5, 122, -18.5, 119, -20, 116, -21],
  [144.7, -40.8, 148.2, -41, 148, -43.2, 146, -43.6, 145.2, -42.3],
  [172.7, -34.5, 174.5, -36.5, 176, -37.6, 178.5, -37.7, 177, -39.5, 175.3, -41.5, 174.7, -39.8, 173.8, -39.3, 174.8, -37.5],
  [172.7, -40.5, 174.2, -41.6, 172.7, -43.6, 171, -45.2, 168.5, -46.6, 166.5, -45.8, 168.5, -44, 171, -42.4],
];
/** the one inland sea large enough to show at this grain */
const CASPIAN = [47, 45, 51, 47, 53.5, 45, 52.8, 41.5, 54, 39.5, 53.8, 37, 50, 37.3, 49, 39.5, 49.5, 42, 47.5, 43];

function inside(poly: readonly number[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const yi = poly[i + 1];
    const yj = poly[j + 1];
    if (yi > y !== yj > y && x < ((poly[j] - poly[i]) * (y - yi)) / (yj - yi) + poly[i]) hit = !hit;
  }
  return hit;
}

let bounds: Float32Array | null = null;
function isLand(lon: number, lat: number): boolean {
  if (lat < -(70 + 3 * Math.cos((lon + 90) * DEG))) return true;
  if (!bounds) {
    bounds = new Float32Array(LAND.length * 4);
    LAND.forEach((p, k) => {
      let x0 = 999;
      let x1 = -999;
      let y0 = 999;
      let y1 = -999;
      for (let i = 0; i < p.length; i += 2) {
        x0 = Math.min(x0, p[i]);
        x1 = Math.max(x1, p[i]);
        y0 = Math.min(y0, p[i + 1]);
        y1 = Math.max(y1, p[i + 1]);
      }
      bounds!.set([x0, x1, y0, y1], k * 4);
    });
  }
  for (let k = 0; k < LAND.length; k++) {
    if (lon < bounds[k * 4] || lon > bounds[k * 4 + 1] || lat < bounds[k * 4 + 2] || lat > bounds[k * 4 + 3]) continue;
    if (inside(LAND[k], lon, lat)) return !inside(CASPIAN, lon, lat);
  }
  return false;
}

/** the land as points on the unit sphere: x, y, z, longitude. Sampled once for each grain. */
const fields = new Map<number, Float32Array>();
function field(step: number): Float32Array {
  let out = fields.get(step);
  if (out) return out;
  const v: number[] = [];
  let row = 0;
  for (let lat = -85; lat <= 85; lat += step, row++) {
    const c = Math.cos(lat * DEG);
    const n = Math.max(1, Math.round((360 * c) / step));
    for (let k = 0; k < n; k++) {
      const lon = -180 + ((k + (row & 1) * 0.5) * 360) / n;
      if (isLand(lon, lat)) v.push(c * Math.sin(lon * DEG), Math.sin(lat * DEG), c * Math.cos(lon * DEG), lon);
    }
  }
  out = new Float32Array(v);
  fields.set(step, out);
  return out;
}

/** the nine centres as unit vectors */
const CV = new Float32Array(NC * 3);
centres.forEach((c, i) => {
  const a = c.lat * DEG;
  const b = c.lon * DEG;
  CV.set([Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)], i * 3);
});

const sm = (x: number) => {
  const k = clamp(x);
  return k * k * (3 - 2 * k);
};
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const pad = (v: number) => (v < 10 ? "0" : "") + v;
/** 0..1 noise for an integer and a salt: the schedule's dice */
const dice = (n: number, salt: number) => {
  const v = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/* ── the schedule. Time is cut into slots; in each slot the event starts at a moment the dice choose, and
   some slots stay quiet. The answer depends on the scene clock alone, so a given moment always looks the same. */
let EVN = 0;
function ev(t: number, period: number, dur: number, salt: number): number {
  const n = Math.floor(t / period);
  EVN = n;
  if (dice(n, salt) < 0.16) return -1;
  const p = (t - n * period - dice(n, salt + 7.3) * (period - dur)) / dur;
  return p >= 0 && p <= 1 ? p : -1;
}

/* ── projection without allocation: the last projected point is left in X, Y (pixels), S (scale) */
let cyw = 1;
let syw = 0;
let cpt = 1;
let spt = 0;
let ZOOM = 1;
let CX = 0;
let CY = 0;
let UU = 1;
let X = 0;
let Y = 0;
let S = 1;
/** how much the last globe point faces the viewer, -1..1 */
let F = 0;

function lens(f: Frame): void {
  cyw = Math.cos(f.cam.yaw);
  syw = Math.sin(f.cam.yaw);
  cpt = Math.cos(f.cam.pitch);
  spt = Math.sin(f.cam.pitch);
  ZOOM = f.cam.zoom;
  CX = f.cx;
  CY = f.cy;
  UU = f.u;
}

function pr(x: number, y: number, z: number): boolean {
  const x1 = x * cyw + z * syw;
  const z1 = -x * syw + z * cyw;
  const z2 = y * spt + z1 * cpt + D;
  if (z2 < 0.35) return false;
  S = (D / z2) * ZOOM;
  X = CX + x1 * S * UU;
  Y = CY - (y * cpt - z1 * spt) * S * UU;
  return true;
}

/* the globe: earth-fixed unit vector to camera space, one matrix for the turn, the tilt and the camera */
let m0 = 1;
let m1 = 0;
let m2 = 0;
let m3 = 0;
let m4 = 1;
let m5 = 0;
let m6 = 0;
let m7 = 0;
let m8 = 1;

function orient(lon0: number, tilt: number): void {
  const cl = Math.cos(lon0);
  const sl = Math.sin(lon0);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  // world x, y, z (z away from the viewer) of the earth axes
  const a0 = cl;
  const a2 = -sl;
  const b0 = -sl * st;
  const b1 = ct;
  const b2 = -cl * st;
  const c0 = -sl * ct;
  const c1 = -st;
  const c2 = -cl * ct;
  m0 = a0 * cyw + c0 * syw;
  m1 = c1 * syw;
  m2 = a2 * cyw + c2 * syw;
  const z0 = -a0 * syw + c0 * cyw;
  const z1 = c1 * cyw;
  const z2 = -a2 * syw + c2 * cyw;
  m3 = b0 * cpt - z0 * spt;
  m4 = b1 * cpt - z1 * spt;
  m5 = b2 * cpt - z2 * spt;
  m6 = b0 * spt + z0 * cpt;
  m7 = b1 * spt + z1 * cpt;
  m8 = b2 * spt + z2 * cpt;
}

/** a point of the globe (earth-fixed unit vector), lifted off the surface by `lift` */
function gp(ex: number, ey: number, ez: number, lift: number): void {
  const zc = m6 * ex + m7 * ey + m8 * ez;
  const r = R * lift;
  S = (D / (zc * r + D)) * ZOOM;
  X = CX + (m0 * ex + m1 * ey + m2 * ez) * r * S * UU;
  Y = CY - (m3 * ex + m4 * ey + m5 * ez) * r * S * UU;
  F = -zc;
}

/** a point of the dial: `a` in radians clockwise from the top, in the plane through the globe's centre */
const dp = (a: number, r: number) => pr(Math.sin(a) * r, Math.cos(a) * r, 0);

/** a point of the tape's orbit */
function tp(a: number): boolean {
  const x0 = Math.cos(a) * RT;
  const z0 = Math.sin(a) * RT;
  const y1 = z0 * SIN_I;
  return pr(x0 * COS_R - y1 * SIN_R, x0 * SIN_R + y1 * COS_R, z0 * COS_I);
}

/* ── a pane of glass: origin (its lower left corner), the two edges and the normal, 12 numbers */
function pane(p: Float64Array, cx: number, cy: number, cz: number, w: number, h: number, yaw: number, tilt: number): void {
  const cyy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  p[3] = cyy * w;
  p[4] = 0;
  p[5] = -sy * w;
  p[6] = st * sy * h;
  p[7] = ct * h;
  p[8] = st * cyy * h;
  p[9] = -ct * sy;
  p[10] = st;
  p[11] = -ct * cyy;
  p[0] = cx - p[3] / 2 - p[6] / 2;
  p[1] = cy - p[4] / 2 - p[7] / 2;
  p[2] = cz - p[5] / 2 - p[8] / 2;
}
const pq = (p: Float64Array, u: number, v: number, lift = 0) =>
  pr(p[0] + p[3] * u + p[6] * v + p[9] * lift, p[1] + p[4] * u + p[7] * v + p[10] * lift, p[2] + p[5] * u + p[8] * v + p[11] * lift);

/** add a rectangle of the pane to the current path */
function quad(ctx: CanvasRenderingContext2D, p: Float64Array, u0: number, v0: number, u1: number, v1: number, lift = 0): void {
  if (!pq(p, u0, v0, lift)) return;
  ctx.moveTo(X, Y);
  pq(p, u1, v0, lift);
  ctx.lineTo(X, Y);
  pq(p, u1, v1, lift);
  ctx.lineTo(X, Y);
  pq(p, u0, v1, lift);
  ctx.lineTo(X, Y);
  ctx.closePath();
}

/** where the pointer is on a pane: its u and v, left in LU and LV */
let LU = -1;
let LV = -1;
function local(p: Float64Array, mx: number, my: number): void {
  pq(p, 0, 0);
  const ax = X;
  const ay = Y;
  pq(p, 1, 0);
  const e1x = X - ax;
  const e1y = Y - ay;
  pq(p, 0, 1);
  const e2x = X - ax;
  const e2y = Y - ay;
  const det = e1x * e2y - e1y * e2x || 1;
  LU = ((mx - ax) * e2y - (my - ay) * e2x) / det;
  LV = (e1x * (my - ay) - e1y * (mx - ax)) / det;
}

/** the glass itself: smoked body, hairline, a lit top edge */
function glass(f: Frame, p: Float64Array, on: number, lit: number): void {
  const { ctx, pal } = f;
  ctx.beginPath();
  quad(ctx, p, 0, 0, 1, 1);
  ctx.fillStyle = rgba(pal.bg, 0.8 * on);
  ctx.fill();
  ctx.fillStyle = rgba(pal.key, (0.035 + 0.03 * lit) * on);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.ink, (0.14 + 0.1 * lit) * on);
  ctx.lineWidth = 1;
  ctx.stroke();
  line(ctx, p, 0, 1, 1, 1);
  ctx.strokeStyle = rgba(pal.key, (0.45 + 0.4 * lit) * on);
  ctx.lineWidth = 1.25;
  ctx.stroke();
  // four machined corners
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const u = k & 1;
    const v = k >> 1;
    pq(p, u ? 1 - 0.07 * (p[7] / Math.hypot(p[3], p[5])) : 0.07 * (p[7] / Math.hypot(p[3], p[5])), v);
    ctx.moveTo(X, Y);
    pq(p, u, v);
    ctx.lineTo(X, Y);
    pq(p, u, v ? 0.93 : 0.07);
    ctx.lineTo(X, Y);
  }
  ctx.strokeStyle = rgba(pal.ink, (0.3 + 0.4 * lit) * on);
  ctx.lineWidth = 1.25;
  ctx.stroke();
}

/** start a path with one segment of a pane */
function line(ctx: CanvasRenderingContext2D, p: Float64Array, u0: number, v0: number, u1: number, v1: number, lift = 0): void {
  ctx.beginPath();
  if (!pq(p, u0, v0, lift)) return;
  ctx.moveTo(X, Y);
  pq(p, u1, v1, lift);
  ctx.lineTo(X, Y);
}

/** the current path as light: two wide soft strokes under a fine core */
function bloom(ctx: CanvasRenderingContext2D, alpha: number, width: number): void {
  ctx.globalAlpha = alpha * 0.07;
  ctx.lineWidth = width * 7;
  ctx.stroke();
  ctx.globalAlpha = alpha * 0.18;
  ctx.lineWidth = width * 3;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** the brightest marks split a little into their colours, as through a lens. Expects additive drawing. */
function spark(f: Frame, x: number, y: number, r: number, a: number, colour: string): void {
  const { ctx, pal } = f;
  ctx.globalAlpha = a * 0.16;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.4, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = a * 0.55;
  ctx.fillStyle = pal.crimson;
  ctx.beginPath();
  ctx.arc(x - r * 0.5, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = pal.blue;
  ctx.beginPath();
  ctx.arc(x + r * 0.5, y, r, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = a;
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, 0, TAU);
  ctx.fill();
}

function text(f: Frame, str: string, x: number, y: number, size: number, colour: string, alpha: number, align: CanvasTextAlign = "left", weight = 600, display = false, halo = false): void {
  if (alpha <= 0.01 || !str) return;
  const { ctx } = f;
  ctx.globalAlpha = 1;
  ctx.font = `${weight} ${size}px ${display ? f.pal.display : f.pal.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (halo) {
    // lettering over the lit globe keeps a little night behind it
    ctx.strokeStyle = rgba(f.pal.bg, 0.7 * alpha);
    ctx.lineWidth = 3;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = rgba(colour, alpha);
  ctx.fillText(str, x, y);
}
/** lettering that resolves: as much of it as `k` allows */
const part = (str: string, k: number) => (k >= 1 ? str : str.slice(0, Math.ceil(str.length * clamp(k))));

type State = {
  /** the land */
  e: Float32Array;
  sx: Float32Array;
  sy: Float32Array;
  sz: Float32Array;
  sb: Uint8Array;
  /** dust in the air: x, y, phase, speed */
  motes: Float32Array;
  /** the tape: start, length, tone */
  dash: Float32Array;
  /** one arc's points on screen: x, y, visible */
  arc: Float32Array;
  seg: number;
  /** the centres on screen */
  px: Float32Array;
  py: Float32Array;
  pf: Float32Array;
  boxes: Float32Array;
  /** the width of each centre's name and of the three region names, measured with the timetable */
  tw: Float32Array;
  /** the timetable, refreshed a few times a minute */
  at: number;
  st: CentreStatus[];
  open: Uint8Array;
  pairs: Uint8Array;
  npair: number;
  nopen: number;
  /** the centre next to open, when none is */
  next: number;
  /** the longitude the globe turns to */
  face: number;
  fx: Float32Array;
  sun: Float32Array;
  /** what moves */
  init: boolean;
  lon: number;
  tilt: number;
  wake: number;
  spin: number;
  sel: number;
  selK: number;
  ladder: Float64Array;
  ribbon: Float64Array;
  /** below the desk layout: where the statement begins (pixels from the top of the stage), and when that was measured */
  sky: number;
  skyFor: number;
  skyAt: number;
};

function refresh(f: Frame, s: State, cap: number): void {
  const now = f.now;
  s.at = now.getTime();
  s.st = allCentreStatus(now);
  // the sun: declination from the day of the year, longitude from the UTC clock (mean sun)
  const day = (s.at - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86_400_000;
  const decl = -23.44 * Math.cos((TAU * (day + 10)) / 365.24) * DEG;
  const sunLon = (12 - (now.getUTCHours() + now.getUTCMinutes() / 60)) * 15;
  s.sun[0] = Math.cos(decl) * Math.sin(sunLon * DEG);
  s.sun[1] = Math.sin(decl);
  s.sun[2] = Math.cos(decl) * Math.cos(sunLon * DEG);
  let sx = 0;
  let sy = 0;
  let any = 0;
  let wait = Infinity;
  s.nopen = 0;
  s.next = -1;
  for (let i = 0; i < NC; i++) {
    const st = s.st[i];
    s.open[i] = st.state === "open" ? 1 : 0;
    s.nopen += s.open[i];
    if (st.state !== "closed") {
      sx += Math.cos(st.centre.lon * DEG);
      sy += Math.sin(st.centre.lon * DEG);
      any++;
    }
    if ((st.state === "closed" || st.state === "pre") && st.nextChangeIn < wait) {
      wait = st.nextChangeIn;
      s.next = i;
    }
  }
  // the globe faces the centres that are trading; with none, the one whose session opens next
  s.face = any ? Math.atan2(sy, sx) / DEG : s.next >= 0 ? centres[s.next].lon : sunLon;
  // flows: every two centres inside their regular sessions together, the widest crossings first
  const list: [number, number, number][] = [];
  for (let i = 0; i < NC; i++) {
    for (let j = i + 1; j < NC; j++) {
      if (s.open[i] && s.open[j]) list.push([i, j, CV[i * 3] * CV[j * 3] + CV[i * 3 + 1] * CV[j * 3 + 1] + CV[i * 3 + 2] * CV[j * 3 + 2]]);
    }
  }
  list.sort((a, b) => a[2] - b[2]);
  s.npair = Math.min(cap, list.length);
  for (let k = 0; k < s.npair; k++) {
    s.pairs[k * 2] = list[k][0];
    s.pairs[k * 2 + 1] = list[k][1];
  }
  f.ctx.font = `600 11px ${f.pal.font}`;
  for (let i = 0; i < NC; i++) s.tw[i] = f.ctx.measureText(centres[i].city).width;
  f.ctx.font = `600 8px ${f.pal.font}`;
  for (let k = 0; k < 3; k++) s.tw[NC + k] = f.ctx.measureText(REGIONS[k]).width;
  fxSessions.forEach((x, k) => {
    const w = windowInUtc(x.tz, x.open, x.close, now);
    s.fx[k * 2] = w.start;
    s.fx[k * 2 + 1] = (((w.end - w.start) % 1440) + 1440) % 1440;
  });
}

/** the deck: a coordinate floor that runs to the horizon and slides slowly toward the viewer */
function deck(f: Frame, a0: number): void {
  const { ctx } = f;
  const step = 0.75;
  const n = f.mobile ? 7 : 11;
  ctx.strokeStyle = f.pal.ink;
  ctx.lineWidth = 1;
  for (let i = -n; i <= n; i++) {
    const edge = Math.pow(1 - Math.abs(i) / (n + 1), 1.5);
    for (let k = 0; k < 3; k++) {
      if (!pr(i * step, FLOOR, k === 0 ? -1.6 : k === 1 ? 1.5 : 8)) continue;
      ctx.beginPath();
      ctx.moveTo(X, Y);
      pr(i * step, FLOOR, k === 0 ? 1.5 : k === 1 ? 8 : 36);
      ctx.lineTo(X, Y);
      ctx.globalAlpha = a0 * edge * (k === 0 ? 1 : k === 1 ? 0.6 : 0.24);
      ctx.stroke();
    }
  }
  const slide = f.still ? 0 : (0.05 * f.t) % step;
  const rows = Math.round((f.mobile ? 12 : 22) * f.q);
  for (let k = 0; k <= rows; k++) {
    const z = -1.5 + k * step - slide;
    const far = clamp(1 - (z + 1.5) / (rows * step));
    if (!pr(-n * step, FLOOR, z)) continue;
    ctx.beginPath();
    ctx.moveTo(X, Y);
    pr(n * step, FLOOR, z);
    ctx.lineTo(X, Y);
    ctx.globalAlpha = a0 * far * far;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** a line of light across the stage whose strength changes along its length (the horizon) */
function beam(f: Frame, x0: number, x1: number, y: number, a0: number, a1: number): void {
  const { ctx } = f;
  const g = ctx.createLinearGradient(x0, y, x1, y);
  g.addColorStop(0, rgba(f.pal.key, a0));
  g.addColorStop(1, rgba(f.pal.key, a1));
  ctx.strokeStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.25;
  ctx.stroke();
}

/** dust in the air, flying past: the far half behind the globe, the near half in front of everything */
function motes(f: Frame, s: State, front: boolean, level: number, clearX: number): void {
  const { ctx } = f;
  const m = s.motes;
  const n = (m.length / 4) * (f.q < 0.75 ? 0.5 : 1);
  ctx.fillStyle = f.pal.ink;
  for (let i = 0; i < n; i++) {
    const z = 13 - ((m[i * 4 + 2] + f.t * m[i * 4 + 3]) % 17);
    if (z <= 0 !== front || !pr(m[i * 4], m[i * 4 + 1], z) || X < clearX + 24) continue;
    const near = clamp((2 - z) / 5);
    // far motes are fine points; the near ones are out of focus, larger and fainter
    ctx.globalAlpha = level * sm((13 - z) / 3) * sm((z + 4) / 2.5) * (0.34 - 0.27 * near);
    ctx.beginPath();
    ctx.arc(X, Y, 0.7 + near * near * 4.2, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** the tape: dashes on an inclined orbit. The far half is drawn before the globe, the near half after it. */
function tape(f: Frame, s: State, front: boolean, level: number, wake: number, print: number, printAt: number, clearX: number): void {
  if (level <= 0.01) return;
  const { ctx, pal } = f;
  const d = s.dash;
  const n = d.length / 3;
  const turn = f.t * 0.05 + s.spin;
  // the orbit itself, a hairline
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i <= 40; i++) {
    const a = (front ? PI : 0) + (i / 40) * PI;
    if (!tp(a) || X < clearX + 30) pen = false;
    else if (pen) ctx.lineTo(X, Y);
    else {
      ctx.moveTo(X, Y);
      pen = true;
    }
  }
  ctx.strokeStyle = pal.ink;
  ctx.globalAlpha = level * (front ? 0.13 : 0.07);
  ctx.lineWidth = 1;
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const a0 = d[i * 3] + turn;
    const a1 = a0 + d[i * 3 + 1];
    const depth = Math.sin((a0 + a1) / 2);
    if (depth < 0 !== front) continue;
    if (!tp(a0)) continue;
    const x0 = X;
    const y0 = Y;
    if (!tp(a1)) continue;
    const near = (1 - depth) / 2;
    const edge = sm((Math.min(x0, X) - clearX) / 60);
    if (edge <= 0.01) continue;
    // a run of the tape prints bright as it passes
    let hot = 0;
    if (print >= 0) {
      const gap = Math.abs(wrap(((a0 - turn - printAt + print * 3.2) / DEG) % 360)) * DEG;
      hot = clamp(1 - gap / 0.55) * Math.sin(PI * print);
    }
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(X, Y);
    ctx.strokeStyle = d[i * 3 + 2] > 0.5 || hot > 0.3 ? pal.key : pal.ink;
    const a = level * edge * (0.2 + 0.6 * near) * (0.72 + 0.28 * wake);
    const w = 0.8 + 1.5 * near;
    if (hot > 0.02) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = hot * 0.22 * edge * level;
      ctx.lineWidth = w * 4;
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = Math.min(1, a + hot * 0.6 * edge);
    ctx.lineWidth = w;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const scene: Scene<State> = {
  pose: 12,
  // composed for the whole stage: the statement keeps the left, the instrument the golden section to the right
  free: true,
  setup(f) {
    const e = field(f.mobile ? 4.5 : 2.7);
    const n = e.length / 4;
    const nm = f.mobile ? 22 : 60;
    const mo = new Float32Array(nm * 4);
    for (let i = 0; i < nm; i++) {
      mo[i * 4] = -2.6 + f.rnd(i * 4 + 11) * 7.4;
      mo[i * 4 + 1] = -1.2 + f.rnd(i * 4 + 12) * 3.5;
      mo[i * 4 + 2] = f.rnd(i * 4 + 13) * 17;
      mo[i * 4 + 3] = 0.22 + f.rnd(i * 4 + 14) * 0.5;
    }
    // the tape: slots round the orbit, most of them carrying a dash of some length, a few left empty
    const slots = f.mobile ? 54 : 120;
    const dash: number[] = [];
    for (let i = 0; i < slots; i++) {
      if (f.rnd(i * 3 + 201) < 0.16) continue;
      dash.push((i / slots) * TAU, (TAU / slots) * (0.2 + 0.62 * f.rnd(i * 3 + 202)), f.rnd(i * 3 + 203));
    }
    const seg = f.mobile ? 16 : 26;
    return {
      e,
      sx: new Float32Array(n),
      sy: new Float32Array(n),
      sz: new Float32Array(n),
      sb: new Uint8Array(n),
      motes: mo,
      dash: new Float32Array(dash),
      arc: new Float32Array((seg + 1) * 3),
      seg,
      px: new Float32Array(NC),
      py: new Float32Array(NC),
      pf: new Float32Array(NC),
      boxes: new Float32Array(NC * 4),
      tw: new Float32Array(NC + 3),
      at: 0,
      st: [],
      open: new Uint8Array(NC),
      pairs: new Uint8Array(24),
      npair: 0,
      nopen: 0,
      next: -1,
      face: 0,
      fx: new Float32Array(8),
      sun: new Float32Array(3),
      init: false,
      lon: 0,
      tilt: 20 * DEG,
      wake: 0,
      spin: 0,
      sel: -1,
      selK: 0,
      ladder: new Float64Array(12),
      ribbon: new Float64Array(12),
      sky: 0,
      skyFor: -1,
      skyAt: 0,
    };
  },
  draw(f, s) {
    const { ctx, pal } = f;
    const still = f.still;
    const t = f.t;
    const desk = f.w >= 1080;
    const lite = f.mobile || f.q < 0.75;

    // ── the layout. On a desk screen the globe stands on the stage's focal point; below that the
    // statement fills the lower stage and the instrument is the sky above it.
    let zoom = 1;
    /** a wide stage below the desk layout: the instrument stands beside the statement instead of above it */
    let beside = false;
    if (!desk) {
      // where the statement begins, measured now and then (it moves when the display face arrives)
      if (s.skyFor !== f.w * 4096 + f.h || t - s.skyAt > 2 || t < s.skyAt) {
        const body = ctx.canvas.closest(".cx-hero")?.querySelector(".cx-statement-body");
        s.sky = body ? body.getBoundingClientRect().top - ctx.canvas.getBoundingClientRect().top : f.h * 0.3;
        s.skyFor = f.w * 4096 + f.h;
        s.skyAt = t;
      }
      const sky = clamp(s.sky, 96, f.h * 0.6);
      let radius = clamp(Math.min(f.w * 0.27, sky * 0.62), 64, 190);
      // the room to the right of the headline, where there is any
      const free = f.mobile || !f.clear ? 0 : f.w - f.clear - 52;
      const wide = Math.min(free / 2.8, f.h * 0.3, 190);
      beside = wide > radius * 1.15;
      if (beside) {
        radius = wide;
        f.cx = f.clear + 28 + free / 2;
        f.cy = radius * 1.3 + 20 + f.scroll * f.h * 0.12;
      } else {
        f.cx = f.w * (f.mobile ? 0.62 : 0.66);
        f.cy = Math.max(radius * 1.27 + 10, sky * 0.5) + f.scroll * f.h * 0.12;
      }
      zoom = radius / (R * f.u * 1.01);
    }
    f.cam.parallax = desk ? 1 : 0.6;
    const live = still ? 0 : 1;
    // the camera drifts by itself, and leans with the pointer (the engine adds that)
    f.aim(Math.sin(t * 0.11 + 1.7) * 0.04 * live, 0.03 + Math.sin(t * 0.073 + 0.4) * 0.012 * live, D, zoom);
    lens(f);
    const U = UU * ZOOM;
    const rpx = (R * U * D) / Math.sqrt(D * D - R * R);
    const room = (f.w - CX) / U;
    const clearX = desk || beside ? f.clear + 16 : -1e6;

    // ── waking. Calm until the pointer enters; up in about a second, down in about two.
    const want = still ? 1 : f.hover > 0.5 ? 1 : 0;
    s.wake = still ? 1 : s.wake + (want - s.wake) * Math.min(1, f.dt * (want > s.wake ? 2.4 : 1.3));
    if (s.wake < 0.002) s.wake = 0;
    /** the instruments come up one after another: `order` 0..1 */
    const stage = (order: number) => sm((s.wake - order * 0.55) / 0.45);
    const wDial = stage(0);
    const wGlobe = stage(0.25);
    const wTape = stage(0.45);
    const wLadder = stage(0.7);
    const wRibbon = stage(1);
    if (!still) s.spin += f.dt * 0.16 * s.wake;

    // ── the timetable
    const nowMs = f.now.getTime();
    if (!s.st.length || Math.abs(nowMs - s.at) > 20_000) refresh(f, s, desk ? 10 : 5);

    // ── the globe's attitude: it faces the trading region, drifts, and turns to face the pointer
    const dxp = clamp((f.mx - CX) / rpx, -1.7, 1.7) * f.hover;
    const dyp = clamp((f.my - CY) / rpx, -1.5, 1.5) * f.hover;
    const wantLon = s.face + (still ? 0 : Math.sin(t / 21) * 11) - dxp * 24;
    const wantTilt = (20 + dyp * 9) * DEG;
    if (!s.init || still) {
      // it opens a little short of the trading region and settles into it
      s.lon = wantLon - (still ? 0 : 26);
      s.tilt = wantTilt;
      s.init = true;
    }
    s.lon += wrap(wantLon - s.lon) * Math.min(1, f.dt * (0.9 + 3.4 * f.hover));
    s.tilt += (wantTilt - s.tilt) * Math.min(1, f.dt * 4);
    orient(s.lon * DEG, s.tilt);
    // the sun in camera space: its direction on screen and how much it shines toward the viewer
    const sux = s.sun[0];
    const suy = s.sun[1];
    const suz = s.sun[2];
    const scx = m0 * sux + m1 * suy + m2 * suz;
    const scy = m3 * sux + m4 * suy + m5 * suz;
    const stv = -(m6 * sux + m7 * suy + m8 * suz);
    const sside = Math.hypot(scx, scy);
    const phi = sside > 1e-4 ? Math.atan2(-scy, scx) : 0;

    // ── the schedule: what happens by itself. A still frame is composed with each event mid-way.
    const pPulse = still ? 0.4 : ev(t, 10, 5.5, 1);
    const nPulse = still ? 3 : EVN;
    const pBurst = still ? 0.5 : ev(t, 8, 3.2, 2);
    const nBurst = still ? 3 : EVN;
    const pSweep = still ? 0.42 : ev(t, 6.5, 2.6, 3);
    const nSweep = still ? 2 : EVN;
    // (the first comet is part of the power-on)
    const pComet = still ? 0.55 : t < 5 ? (t > 0.8 && t < 4.4 ? (t - 0.8) / 3.6 : -1) : ev(t, 12, 4.2, 4);
    const nComet = still ? 5 : t < 5 ? 0 : EVN;
    const pScan = still ? 0.46 : ev(t, 14, 6, 5);
    const pPrint = still ? 0.5 : ev(t, 5.5, 2.4, 6);
    const nPrint = still ? 1 : EVN;

    // where the pointer is, among the instruments
    const dPointer = Math.hypot(f.mx - CX, f.my - CY);
    // the two panes of glass stand nearest the viewer, so the pointer is theirs first
    const L = s.ladder;
    const B = s.ribbon;
    const ladOn = desk ? f.on(0.55, 0.4) : 0;
    // the ribbon keeps clear of the caption at the foot of the stage, and stands down on a stage too short for it
    const foot = Math.min(1.2, (f.h * 0.5 - 72) / U);
    const ribOn = desk ? f.on(0.7, 0.3) * sm((foot - 0.98) / 0.08) : 0;
    let onLad = 0;
    let ladV = 0;
    let onRib = 0;
    let ribU = 0;
    if (desk) {
      pane(L, Math.min(1.52, ((room - 0.07) * (D - 0.55)) / D - 0.2), 0.1 - (1 - ladOn) * 0.12, -0.55, 0.44, 1.2, 0.45, 0);
      local(L, f.mx, f.my);
      onLad = LU > -0.15 && LU < 1.15 && LV > -0.05 && LV < 1.05 ? f.hover * ladOn : 0;
      ladV = LV;
      pane(B, 0.1, -(foot - 0.21) / 1.13 - 0.02 - (1 - ribOn) * 0.1, -0.7, 1.5, 0.34, 0, 0.5);
      local(B, f.mx, f.my);
      onRib = LU > -0.03 && LU < 1.03 && LV > -0.3 && LV < 1.3 ? f.hover * ribOn : 0;
      ribU = LU;
    }
    const onDial = desk && !onLad && !onRib ? f.hover * sm(1 - Math.abs(dPointer - RD * U) / (0.15 * U)) : 0;

    // ══ far field: dust, the deck, the light the globe spills on it, the horizon
    motes(f, s, false, f.boot, clearX);
    deck(f, 0.13 * f.boot);
    pool(f, [0, FLOOR, -0.2], 2.4, pal.key, (desk ? 0.2 : 0.14) * f.boot);
    pool(f, [0, FLOOR, 60], 28, pal.key, 0.26 * f.boot);
    // waking sends one ring of light out across the deck; settling draws it back in
    const ringK = still ? 0 : s.wake * (1 - s.wake) * 4;
    if (ringK > 0.02) {
      const rr = 1.05 + 2.6 * s.wake;
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= 56; i++) {
        const a = (i / 56) * TAU;
        if (!pr(Math.cos(a) * rr, FLOOR, Math.sin(a) * rr) || X < clearX + 20) pen = false;
        else if (pen) ctx.lineTo(X, Y);
        else {
          ctx.moveTo(X, Y);
          pen = true;
        }
      }
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = pal.key;
      bloom(ctx, 0.55 * ringK * f.boot, 1.2);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    if (pr(0, FLOOR, 4000)) {
      const hy = Y;
      const edge = Math.sqrt(Math.max(1, (RD * U) ** 2 - (hy - CY) ** 2));
      const reach = f.on(0.05, 0.5);
      beam(f, CX + edge, CX + edge + (f.w - CX - edge) * reach, hy, 0.6 * reach, 0.1 * reach);
      beam(f, CX - edge, CX - edge - 0.7 * U * reach, hy, (desk ? 0.5 : 0.7) * reach, 0);
    }

    // ══ the tape's far side passes behind the globe
    const tapeOn = f.on(0.4, 0.4);
    tape(f, s, false, tapeOn, wTape, pPrint, dice(nPrint, 9) * TAU, clearX);

    // ══ the dial: 24 hours of UTC, the four FX windows, the present minute
    const dialOn = f.on(0.25, 0.45);
    const hours = f.now.getUTCHours();
    const minutes = f.now.getUTCMinutes();
    const nowA = ((hours * 60 + minutes + f.now.getUTCSeconds() / 60) / 1440) * TAU;
    const scrubA = (Math.atan2(f.mx - CX, -(f.my - CY)) + TAU) % TAU;
    if (dialOn > 0.01) {
      ctx.strokeStyle = pal.ink;
      ctx.beginPath();
      const n = lite ? 48 : 96;
      for (let i = 0; i <= n; i++) {
        dp((i / n) * TAU, RD);
        if (i) ctx.lineTo(X, Y);
        else ctx.moveTo(X, Y);
      }
      ctx.globalAlpha = (0.2 + 0.12 * wDial) * dialOn;
      ctx.lineWidth = 1;
      ctx.stroke();
      // quarter hours resolve as the dial wakes; the hours are always engraved
      const fine = desk ? wDial : 0;
      for (let pass = fine > 0.02 ? 0 : 1; pass < 3; pass++) {
        ctx.beginPath();
        const count = pass === 0 ? 96 : 24;
        for (let i = 0; i < count; i++) {
          if (pass === 0 ? i % 4 === 0 : (i % 6 === 0) !== (pass === 2)) continue;
          const a = (i / count) * TAU;
          // the scale opens under the pointer, like a loupe
          const lens2 = onDial > 0.01 ? onDial * clamp(1 - Math.abs(wrap((a - scrubA) / DEG)) / 22) : 0;
          dp(a, RD);
          ctx.moveTo(X, Y);
          dp(a, RD - (pass === 0 ? 0.018 : pass === 1 ? 0.032 : 0.058) * (1 + lens2 * 1.2));
          ctx.lineTo(X, Y);
        }
        ctx.globalAlpha = (pass === 0 ? 0.26 * fine : pass === 1 ? 0.34 + 0.2 * wDial : 0.62 + 0.3 * wDial) * dialOn;
        ctx.stroke();
      }
      if (desk) {
        for (let hr = 0; hr < 24; hr += 6) {
          dp((hr / 24) * TAU, RD - 0.105);
          if (X > clearX) text(f, pad(hr), X, Y, 9, pal.ink2, (0.5 + 0.35 * wDial) * dialOn, "center");
        }
      }
      // the four FX session windows, in two lanes so that an overlap reads as one
      for (let k = 0; k < 4; k++) {
        const a0 = (s.fx[k * 2] / 1440) * TAU;
        const span = (s.fx[k * 2 + 1] / 1440) * TAU;
        const r = RD + 0.03 + (k % 2) * 0.03;
        const steps = Math.max(4, Math.round(span / 0.09));
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          dp(a0 + (span * i) / steps, r);
          if (i) ctx.lineTo(X, Y);
          else ctx.moveTo(X, Y);
        }
        ctx.strokeStyle = pal[FX_TONE[k]];
        if (wDial > 0.02 && !lite) {
          ctx.globalAlpha = 0.16 * wDial * dialOn;
          ctx.lineWidth = 6;
          ctx.stroke();
        }
        ctx.globalAlpha = (0.62 + 0.33 * wDial) * dialOn;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      // the present minute
      ctx.strokeStyle = pal.ink;
      ctx.beginPath();
      dp(nowA, RD - 0.075);
      ctx.moveTo(X, Y);
      dp(nowA, RD + 0.085);
      ctx.lineTo(X, Y);
      ctx.globalAlpha = 0.95 * dialOn;
      ctx.lineWidth = 1.75;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ══ the globe
    const globeOn = f.on(0, 0.5);
    ctx.globalCompositeOperation = "lighter";
    let g = ctx.createRadialGradient(CX, CY, rpx * 0.94, CX, CY, rpx * 1.2);
    g.addColorStop(0, rgba(pal.key, 0.3 * globeOn));
    g.addColorStop(0.35, rgba(pal.key, 0.09 * globeOn));
    g.addColorStop(1, rgba(pal.key, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(CX, CY, rpx * 1.2, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    // a solid body: what passes behind it is hidden
    ctx.beginPath();
    ctx.arc(CX, CY, rpx, 0, TAU);
    ctx.fillStyle = rgba(pal.bg, 0.96 * globeOn);
    ctx.fill();
    g = ctx.createRadialGradient(CX + scx * rpx * 0.5, CY - scy * rpx * 0.5, rpx * 0.05, CX, CY, rpx);
    g.addColorStop(0, rgba(pal.key, 0.13 * globeOn));
    g.addColorStop(0.7, rgba(pal.key, 0.035 * globeOn));
    g.addColorStop(1, rgba(pal.key, 0.09 * globeOn));
    ctx.fillStyle = g;
    ctx.fill();
    // the day side: from the terminator to the limb that faces the sun
    const cph = Math.cos(phi);
    const sph = Math.sin(phi);
    ctx.beginPath();
    ctx.arc(CX, CY, rpx, phi - PI / 2, phi + PI / 2);
    ctx.ellipse(CX, CY, rpx * Math.abs(stv), rpx, phi, PI / 2, PI * 1.5, stv < 0);
    ctx.closePath();
    g = ctx.createLinearGradient(CX - cph * rpx * stv, CY - sph * rpx * stv, CX + cph * rpx, CY + sph * rpx);
    g.addColorStop(0, rgba(pal.key, 0.09 * globeOn));
    g.addColorStop(0.5, rgba(pal.key, 0.2 * globeOn));
    g.addColorStop(1, rgba(pal.key, 0.36 * globeOn));
    ctx.fillStyle = g;
    ctx.fill();

    // the graticule, on the near side only
    ctx.beginPath();
    for (let lon = 0; lon < 360; lon += 30) {
      let pen = false;
      const cl = Math.cos(lon * DEG);
      const sl = Math.sin(lon * DEG);
      for (let lat = -80; lat <= 80; lat += lite ? 16 : 10) {
        const c = Math.cos(lat * DEG);
        gp(c * sl, Math.sin(lat * DEG), c * cl, 1);
        if (F < HOR) pen = false;
        else if (pen) ctx.lineTo(X, Y);
        else {
          ctx.moveTo(X, Y);
          pen = true;
        }
      }
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      let pen = false;
      const c = Math.cos(lat * DEG);
      const y = Math.sin(lat * DEG);
      for (let lon = 0; lon <= 360; lon += lite ? 15 : 10) {
        gp(c * Math.sin(lon * DEG), y, c * Math.cos(lon * DEG), 1);
        if (F < HOR) pen = false;
        else if (pen) ctx.lineTo(X, Y);
        else {
          ctx.moveTo(X, Y);
          pen = true;
        }
      }
    }
    ctx.strokeStyle = pal.ink;
    ctx.globalAlpha = (0.085 + 0.04 * wGlobe) * globeOn;
    ctx.lineWidth = 1;
    ctx.stroke();

    // the land: points lit by the sun, and by the scanning light as it crosses them
    const scanLon = pScan >= 0 ? s.lon - 105 + pScan * 210 : 0;
    const scanK = pScan >= 0 ? Math.sin(PI * pScan) : 0;
    {
      const e = s.e;
      const n = e.length / 4;
      // (a phone already has the coarser field)
      const stride = !f.mobile && f.q < 0.75 ? 2 : 1;
      const k = D * ZOOM * UU * R;
      const dot = clamp(rpx / 205, 0.72, 1.25) * globeOn;
      for (let i = 0; i < n; i += stride) {
        const ex = e[i * 4];
        const ey = e[i * 4 + 1];
        const ez = e[i * 4 + 2];
        const zc = m6 * ex + m7 * ey + m8 * ez;
        if (-zc < HOR) {
          s.sb[i] = 9;
          continue;
        }
        const sc = k / (zc * R + D);
        s.sx[i] = CX + (m0 * ex + m1 * ey + m2 * ez) * sc;
        s.sy[i] = CY - (m3 * ex + m4 * ey + m5 * ez) * sc;
        s.sz[i] = dot * (0.5 - 0.95 * zc);
        const light = ex * sux + ey * suy + ez * suz;
        let b = light > 0.16 ? 2 : light > -0.1 ? 1 : 0;
        if (scanK > 0) {
          const dl = wrap(e[i * 4 + 3] - scanLon);
          if (dl < 1.5 && dl > -24) b = dl > -5 ? 3 : Math.min(2, b + 1);
        }
        s.sb[i] = b;
      }
      for (let b = 0; b < 4; b++) {
        ctx.beginPath();
        for (let i = 0; i < n; i += stride) {
          if (s.sb[i] !== b) continue;
          const h = s.sz[i];
          ctx.rect(s.sx[i] - h, s.sy[i] - h, h * 2, h * 2);
        }
        ctx.fillStyle = b === 0 ? pal.key : pal.ink;
        ctx.globalAlpha = b === 0 ? 0.36 : b === 1 ? 0.42 : b === 2 ? 0.74 : scanK * 0.25 + 0.75;
        ctx.fill();
      }
    }

    // light on the glass: the scanning meridian, the terminator, the limb
    ctx.globalCompositeOperation = "lighter";
    if (scanK > 0) {
      const cl = Math.cos(scanLon * DEG);
      const sl = Math.sin(scanLon * DEG);
      ctx.beginPath();
      let pen = false;
      for (let lat = -84; lat <= 84; lat += 8) {
        const c = Math.cos(lat * DEG);
        gp(c * sl, Math.sin(lat * DEG), c * cl, 1.004);
        if (F < HOR) pen = false;
        else if (pen) ctx.lineTo(X, Y);
        else {
          ctx.moveTo(X, Y);
          pen = true;
        }
      }
      ctx.strokeStyle = pal.key;
      bloom(ctx, 0.4 * scanK * globeOn, 1);
    }
    ctx.beginPath();
    ctx.ellipse(CX, CY, rpx * Math.abs(stv), rpx, phi, PI / 2, PI * 1.5, stv < 0);
    ctx.strokeStyle = pal.key;
    bloom(ctx, (0.5 + 0.25 * wGlobe) * globeOn, 1.1);
    ctx.beginPath();
    ctx.arc(CX, CY, rpx, phi - 1.15, phi + 1.15);
    bloom(ctx, (0.55 + 0.2 * wGlobe) * sside * globeOn, 1.3);
    // the sun's glint on the glass, at the point where it stands overhead
    gp(sux, suy, suz, 1);
    if (F > HOR + 0.05) {
      const k = sm((F - HOR) / 0.5) * globeOn;
      const gx = X;
      const gy = Y;
      const gr = rpx * 0.6;
      g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, rgba(pal.ink, 0.22 * k));
      g.addColorStop(0.22, rgba(pal.key, 0.13 * k));
      g.addColorStop(1, rgba(pal.key, 0));
      ctx.save();
      ctx.beginPath();
      ctx.arc(CX, CY, rpx, 0, TAU);
      ctx.clip();
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
      ctx.restore();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    ctx.arc(CX, CY, rpx, 0, TAU);
    ctx.strokeStyle = pal.ink;
    ctx.globalAlpha = 0.26 * globeOn;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ── the centres: where each stands on screen, and which one the pointer is nearest
    let cand = -1;
    let best = desk ? rpx * 0.34 : 0;
    for (let i = 0; i < NC; i++) {
      gp(CV[i * 3], CV[i * 3 + 1], CV[i * 3 + 2], 1);
      s.px[i] = X;
      s.py[i] = Y;
      s.pf[i] = F;
      if (F < HOR + 0.04 || f.hover < 0.3 || dPointer > rpx * 1.12 || onLad || onRib) continue;
      const dist = Math.hypot(X - f.mx, Y - f.my);
      if (dist < best) {
        best = dist;
        cand = i;
      }
    }
    if (cand === s.sel && cand >= 0) s.selK = Math.min(1, s.selK + f.dt * 5);
    else {
      s.selK = Math.max(0, s.selK - f.dt * 6);
      if (s.selK === 0) s.sel = cand;
    }
    const sel = s.selK > 0 ? s.sel : -1;

    // ── a pulse leaves a centre and travels the globe: from one that is open, or, when none is,
    // from the one whose session opens next (in champagne)
    let pulseAt = -1;
    let pulseR = 0;
    let pulseK = 0;
    if (pPulse >= 0) {
      if (s.nopen > 0) {
        let pick = Math.floor(dice(nPulse, 11) * s.nopen);
        for (let i = 0; i < NC; i++) if (s.open[i] && pick-- === 0) pulseAt = i;
      } else pulseAt = s.next;
    }
    if (pulseAt >= 0) {
      const tone = s.open[pulseAt] ? pal.emerald : pal.gold;
      const ox = CV[pulseAt * 3];
      const oy = CV[pulseAt * 3 + 1];
      const oz = CV[pulseAt * 3 + 2];
      const hl = Math.hypot(ox, oz);
      const ax = -oz / hl;
      const az = ox / hl;
      const bx = oy * az;
      const by = oz * ax - ox * az;
      const bz = -oy * ax;
      pulseR = pPulse * 2.5;
      pulseK = Math.pow(Math.sin(PI * pPulse), 0.7) * (1 - 0.45 * pPulse);
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = tone;
      const n = lite ? 36 : 60;
      for (let ring = 0; ring < 2; ring++) {
        const rho = pulseR - ring * 0.16;
        if (rho <= 0.02) continue;
        const cr = Math.cos(rho);
        const sr = Math.sin(rho);
        ctx.beginPath();
        let pen = false;
        for (let i = 0; i <= n; i++) {
          const th = (i / n) * TAU;
          const c = Math.cos(th) * sr;
          const d = Math.sin(th) * sr;
          gp(ox * cr + ax * c + bx * d, oy * cr + by * d, oz * cr + az * c + bz * d, 1.004);
          if (F < HOR) pen = false;
          else if (pen) ctx.lineTo(X, Y);
          else {
            ctx.moveTo(X, Y);
            pen = true;
          }
        }
        bloom(ctx, pulseK * (ring ? 0.35 : 0.9) * globeOn, ring ? 1 : 1.4);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    // ── flows between centres that are open together
    const seg = f.q < 0.75 ? Math.round(s.seg * 0.7) : s.seg;
    const burst = pBurst >= 0 && s.npair > 0 ? Math.floor(dice(nBurst, 21) * s.npair) : -1;
    const trail = lite ? 5 : 9;
    /** markers are drawn for a desk-sized globe and shrink with it */
    const mk = clamp(rpx / 190, 0.62, 1);
    for (let p = 0; p < s.npair; p++) {
      const i = s.pairs[p * 2];
      const j = s.pairs[p * 2 + 1];
      if (s.pf[i] < HOR - 0.35 && s.pf[j] < HOR - 0.35) continue;
      const ax = CV[i * 3];
      const ay = CV[i * 3 + 1];
      const az = CV[i * 3 + 2];
      const bx = CV[j * 3];
      const by = CV[j * 3 + 1];
      const bz = CV[j * 3 + 2];
      const om = Math.acos(clamp(ax * bx + ay * by + az * bz, -1, 1));
      const so = Math.sin(om);
      if (so < 1e-3) continue;
      const amp = 0.19 * clamp(om / 1.1, 0.3, 1);
      const A = s.arc;
      ctx.beginPath();
      let pen = false;
      for (let k = 0; k <= seg; k++) {
        const tt = k / seg;
        const k1 = Math.sin((1 - tt) * om) / so;
        const k2 = Math.sin(tt * om) / so;
        gp(ax * k1 + bx * k2, ay * k1 + by * k2, az * k1 + bz * k2, 1 + amp * Math.sin(PI * tt));
        const seen = F >= HOR || Math.hypot(X - CX, Y - CY) > rpx * 0.995;
        A[k * 3] = X;
        A[k * 3 + 1] = Y;
        A[k * 3 + 2] = seen ? 1 : 0;
        if (!seen) pen = false;
        else if (pen) ctx.lineTo(X, Y);
        else {
          ctx.moveTo(X, Y);
          pen = true;
        }
      }
      const mine = sel >= 0 && (i === sel || j === sel) ? s.selK : 0;
      const quiet = sel >= 0 ? 1 - 0.55 * s.selK * (1 - mine) : 1;
      const lit = (0.4 + 0.25 * wGlobe + 0.35 * mine + (p === burst ? 0.25 * Math.sin(PI * pBurst) : 0)) * quiet * globeOn;
      ctx.strokeStyle = pal.key;
      ctx.globalAlpha = lit * 0.2;
      ctx.lineWidth = 4 + 2 * mine;
      ctx.stroke();
      ctx.globalAlpha = Math.min(1, lit);
      ctx.lineWidth = 1.1 + 0.5 * mine;
      ctx.stroke();
      if (mine > 0.02) {
        ctx.strokeStyle = pal.ink;
        ctx.globalAlpha = 0.5 * mine;
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }
      // couriers: light travelling the arc, each with its trail
      ctx.globalCompositeOperation = "lighter";
      const back = p & 1;
      const count = still ? 1 : 1 + (wGlobe > 0.5 || mine > 0.5 ? 1 : 0) + (p === burst ? 5 : 0);
      for (let c = 0; c < count; c++) {
        let h: number;
        let size = 1.5;
        if (c >= count - (p === burst ? 5 : 0)) {
          // the burst: five in close order, quickly
          h = pBurst * 1.45 - (c - (count - 5)) * 0.09;
          size = 2;
        } else {
          const period = 5 + 3 * dice(p, 31);
          h = (t / period + dice(p, 32) + c * 0.5) % 1;
        }
        if (h < 0 || h > 1) continue;
        for (let m = trail; m >= 0; m--) {
          const q = h - m * 0.017;
          if (q < 0) continue;
          const at = (back ? 1 - q : q) * seg;
          const k0 = Math.min(seg - 1, Math.floor(at));
          const fr = at - k0;
          if (A[k0 * 3 + 2] + A[k0 * 3 + 5] < 2) continue;
          const x = A[k0 * 3] + (A[k0 * 3 + 3] - A[k0 * 3]) * fr;
          const y = A[k0 * 3 + 1] + (A[k0 * 3 + 4] - A[k0 * 3 + 1]) * fr;
          const fade = 1 - m / (trail + 1);
          if (m === 0) spark(f, x, y, size, 0.95 * quiet * globeOn, pal.key);
          else {
            ctx.globalAlpha = 0.5 * fade * fade * quiet * globeOn;
            ctx.fillStyle = pal.key;
            ctx.beginPath();
            ctx.arc(x, y, size * (0.35 + 0.6 * fade), 0, TAU);
            ctx.fill();
          }
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = 1;

    // ── the centres themselves
    let nb = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < NC; i++) {
        const st = s.st[i];
        if ((st.state === "open") !== (pass === 0) || s.pf[i] < HOR + 0.02) continue;
        const x = s.px[i];
        const y = s.py[i];
        const depth = (0.45 + 0.55 * sm((s.pf[i] - HOR) / 0.5)) * globeOn;
        const open = st.state === "open";
        const tone = open ? pal.emerald : st.state === "closed" ? pal.ink3 : pal.gold;
        const mine = i === sel ? s.selK : 0;
        // the travelling pulse lights each centre as it passes
        let flash = 0;
        if (pulseAt >= 0 && i !== pulseAt) {
          const ang = Math.acos(clamp(CV[i * 3] * CV[pulseAt * 3] + CV[i * 3 + 1] * CV[pulseAt * 3 + 1] + CV[i * 3 + 2] * CV[pulseAt * 3 + 2], -1, 1));
          flash = clamp(1 - Math.abs(ang - pulseR) / 0.2) * pulseK;
        } else if (i === pulseAt) flash = clamp(1 - pPulse * 4);
        if (open || flash > 0.02 || mine > 0.02) {
          const breathe = still ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.9 + i * 1.7);
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = open ? pal.emerald : pal.gold;
          ctx.globalAlpha = (open ? 0.14 + 0.1 * breathe : 0) * depth + 0.3 * flash + 0.12 * mine;
          ctx.beginPath();
          ctx.arc(x, y, (9 + 5 * flash + 3 * mine) * mk, 0, TAU);
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
          if (open) {
            ctx.strokeStyle = pal.emerald;
            ctx.globalAlpha = depth * (0.4 - 0.3 * breathe);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y, (5 + 6 * breathe) * mk, 0, TAU);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = depth;
        ctx.beginPath();
        ctx.arc(x, y, (3.1 + flash) * mk, 0, TAU);
        if (st.state === "closed") {
          ctx.fillStyle = pal.bg;
          ctx.fill();
          ctx.strokeStyle = flash > 0.05 ? pal.ink : tone;
          ctx.lineWidth = 1.1;
          ctx.stroke();
        } else {
          ctx.fillStyle = tone;
          ctx.fill();
          ctx.fillStyle = pal.ink;
          ctx.globalAlpha = depth * 0.8;
          ctx.beginPath();
          ctx.arc(x, y, 1.1 * mk, 0, TAU);
          ctx.fill();
        }
        // names on a desk screen; their local times resolve as the globe wakes
        if (!desk || s.pf[i] < 0.3 || x < clearX + 40) continue;
        const name = st.centre.city;
        const tw = s.tw[i];
        const right = x >= CX;
        const lx = right ? x + 10 : x - 10 - tw;
        const BX = s.boxes;
        let clash = false;
        for (let k = 0; k < nb; k++) if (lx - 3 < BX[k * 4 + 2] && lx + tw + 3 > BX[k * 4] && y - 13 < BX[k * 4 + 3] && y + 13 > BX[k * 4 + 1]) clash = true;
        if (clash) continue;
        BX[nb * 4] = lx - 3;
        BX[nb * 4 + 1] = y - 13;
        BX[nb * 4 + 2] = lx + tw + 3;
        BX[nb * 4 + 3] = y + 13;
        nb++;
        const show = depth * (1 - mine);
        text(f, name, lx, y - 5, 11, pal.ink, (open ? 0.92 : 0.55 + 0.25 * wGlobe) * show, "left", 600, false, true);
        text(f, part(st.local.label, wGlobe * 1.4), lx, y + 7, 10, pal.ink2, 0.85 * wGlobe * show, "left", 500, false, true);
      }
    }
    ctx.globalAlpha = 1;

    // ── a flare where the terminator meets the limb: first light
    const flare = sside * globeOn * (0.55 + 0.25 * wGlobe + (still ? 0.1 : 0.12 * Math.sin(t * 0.6)));
    if (flare > 0.02) {
      const up = Math.sin(phi - PI / 2) < Math.sin(phi + PI / 2) ? phi - PI / 2 : phi + PI / 2;
      const fx = CX + Math.cos(up) * rpx;
      const fy = CY + Math.sin(up) * rpx;
      const len = U * (lite ? 0.36 : 0.62) * (0.75 + 0.25 * wGlobe);
      ctx.globalCompositeOperation = "lighter";
      g = ctx.createRadialGradient(fx, fy, 0, fx, fy, U * 0.42);
      g.addColorStop(0, rgba(pal.ink, 0.5 * flare));
      g.addColorStop(0.12, rgba(pal.key, 0.36 * flare));
      g.addColorStop(0.4, rgba(pal.key, 0.1 * flare));
      g.addColorStop(1, rgba(pal.key, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(fx, fy, U * 0.42, 0, TAU);
      ctx.fill();
      // the streak, split a little into its colours
      g = ctx.createLinearGradient(fx - len, fy, fx + len, fy);
      g.addColorStop(0, rgba(pal.ink, 0));
      g.addColorStop(0.5, rgba(pal.ink, 0.85 * flare));
      g.addColorStop(1, rgba(pal.ink, 0));
      for (let k = -1; k <= 1; k++) {
        ctx.strokeStyle = k ? (k < 0 ? pal.crimson : pal.blue) : g;
        ctx.globalAlpha = k ? 0.2 * flare : 1;
        ctx.lineWidth = k ? 1 : 1.2;
        ctx.beginPath();
        ctx.moveTo(fx - len * (k ? 0.5 : 1), fy + k * 1.6);
        ctx.lineTo(fx + len * (k ? 0.5 : 1), fy + k * 1.6);
        ctx.stroke();
      }
      ctx.strokeStyle = pal.ink;
      ctx.globalAlpha = 0.5 * flare;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fx, fy - len * 0.2);
      ctx.lineTo(fx, fy + len * 0.2);
      ctx.stroke();
      spark(f, fx, fy, 1.9, Math.min(1, flare * 1.3), pal.key);
      // two ghosts on the line through the centre, as a lens makes them
      ctx.strokeStyle = pal.key;
      ctx.lineWidth = 1;
      for (let k = 0; k < 2; k++) {
        const along = k ? 1.36 : 0.52;
        ctx.globalAlpha = (k ? 0.16 : 0.1) * flare;
        ctx.beginPath();
        ctx.arc(fx + (CX - fx) * along, fy + (CY - fy) * along, k ? 9 : 5, 0, TAU);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    // ══ the tape's near side passes in front of the globe
    tape(f, s, true, tapeOn, wTape, pPrint, dice(nPrint, 9) * TAU, clearX);

    // ══ a comet circles the dial
    if (pComet >= 0 && dialOn > 0.5) {
      const head = dice(nComet, 41) * TAU + pComet * TAU * 1.2;
      const env = Math.pow(Math.sin(PI * pComet), 0.5);
      const n = lite ? 16 : 30;
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = pal.key;
      dp(head, RD);
      let x0 = X;
      let y0 = Y;
      const hx = X;
      const hy = Y;
      for (let k = 1; k <= n; k++) {
        dp(head - k * (1.05 / n), RD);
        const fade = 1 - k / (n + 1);
        if (Math.min(x0, X) > clearX) {
          ctx.globalAlpha = env * fade * fade * 0.2;
          ctx.lineWidth = 2 + 8 * fade;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(X, Y);
          ctx.stroke();
          ctx.globalAlpha = env * Math.pow(fade, 1.5) * 0.95;
          ctx.lineWidth = 0.7 + 2.8 * fade;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(X, Y);
          ctx.stroke();
        }
        x0 = X;
        y0 = Y;
      }
      if (hx > clearX) spark(f, hx, hy, 2.3, env, pal.key);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    // the lamp of the present minute stands over everything on the dial
    if (dialOn > 0.01) {
      dp(nowA, RD);
      if (X > clearX) {
        ctx.globalCompositeOperation = "lighter";
        spark(f, X, Y, 2.1, dialOn, pal.key);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
    }

    if (desk) {
      // ══ the depth ladder: a pane of glass standing to the right, turned toward the globe
      glass(f, L, ladOn, Math.max(wLadder * 0.6, onLad));
      const N = 10;
      const stp = 0.41 / N;
      const side = dice(nSweep, 51) > 0.5 ? 1 : 0;
      // the spine, with a mark for every level
      line(ctx, L, 0.5, 0.06, 0.5, 0.94);
      for (let i = 0; i < N * 2; i++) {
        const v = i < N ? 0.47 - (i + 0.5) * stp : 0.53 + (i - N + 0.5) * stp;
        pq(L, 0.485, v);
        ctx.moveTo(X, Y);
        pq(L, 0.515, v);
        ctx.lineTo(X, Y);
      }
      ctx.strokeStyle = pal.ink;
      ctx.globalAlpha = (0.24 + 0.2 * wLadder) * ladOn;
      ctx.lineWidth = 1;
      ctx.stroke();
      for (let up = 0; up < 2; up++) {
        ctx.fillStyle = up ? pal.ink : pal.key;
        for (let i = 0; i < N; i++) {
          const vc = up ? 0.53 + (i + 0.5) * stp : 0.47 - (i + 0.5) * stp;
          // resting depth grows away from the middle, and breathes
          let len = (0.3 + 0.7 * Math.pow((i + 1) / N, 0.75)) * (still ? 0.7 + 0.3 * f.rnd(i + up * 20 + 300) : 0.74 + 0.26 * Math.sin(t * (0.5 + 0.6 * f.rnd(i + up * 20 + 300)) + f.rnd(i + up * 20 + 340) * TAU));
          let flash = 0;
          if (pSweep >= 0 && up === side) {
            // the sweep takes each level as it passes, and the level refills behind it
            const since = pSweep * 1.5 - i / N;
            if (since > 0) {
              const back = clamp(since / 0.5);
              len *= 0.14 + 0.86 * back * back;
              flash = (1 - back) * (1 - back);
            }
          }
          const near = onLad * clamp(1 - Math.abs(vc - ladV) / (stp * 1.6));
          len = Math.min(1, len * (0.72 + 0.28 * wLadder) * (1 + 0.3 * near)) * ladOn;
          const u0 = up ? 0.54 : 0.46 - len * 0.4;
          ctx.beginPath();
          quad(ctx, L, u0, vc - stp * 0.31, u0 + len * 0.4, vc + stp * 0.31, near * 0.05);
          ctx.globalAlpha = Math.min(1, (0.42 + 0.3 * wLadder + 0.5 * flash + 0.4 * near) * (1 - (i / N) * 0.3) * ladOn);
          ctx.fill();
          if (flash > 0.05) {
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = pal.gold;
            ctx.globalAlpha = 0.5 * flash * ladOn;
            ctx.fill();
            ctx.fillStyle = up ? pal.ink : pal.key;
            ctx.globalCompositeOperation = "source-over";
          }
        }
      }
      // the sweep's own line of light, and the level under the pointer
      if (pSweep >= 0 && pSweep * 1.5 < 1.05) {
        const v = side ? 0.53 + pSweep * 1.5 * 0.41 : 0.47 - pSweep * 1.5 * 0.41;
        ctx.globalCompositeOperation = "lighter";
        line(ctx, L, 0.04, v, 0.96, v);
        ctx.strokeStyle = pal.gold;
        bloom(ctx, 0.9 * ladOn * sm(pSweep * 12), 1.1);
        ctx.globalCompositeOperation = "source-over";
      }
      if (onLad > 0.02 && ladV > 0.05 && ladV < 0.95) {
        line(ctx, L, 0.02, ladV, 0.98, ladV, 0.05);
        ctx.strokeStyle = pal.gold;
        ctx.globalAlpha = 0.8 * onLad;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      pq(L, 0.5, 1);
      text(f, part("DEPTH LADDER", wLadder * 1.3), X, Y - 11, 9, pal.ink2, 0.8 * wLadder * ladOn, "center");
      pq(L, 0.5, 0);
      text(f, part("ILLUSTRATION", wLadder * 1.3), X, Y + 11, 8, pal.ink3, 0.75 * wLadder * ladOn, "center");

      // ══ the candle ribbon: a pane on the console below the globe, leaning back
      glass(f, B, ribOn, Math.max(wRibbon * 0.6, onRib));
      const M = 34;
      const du = 0.92 / M;
      const run = still ? 40.6 : t * 0.42;
      const n0 = Math.floor(run);
      const fr = run - n0;
      /** the ribbon's line: a few slow waves and a little grain. It is a drawing, and it carries no scale. */
      const val = (n: number) => 0.5 + 0.2 * Math.sin(n * 0.23 + 1.3) + 0.13 * Math.sin(n * 0.61 + 4.1) + 0.07 * Math.sin(n * 1.43 + 0.7) + 0.06 * (dice(n, 61) - 0.5);
      const lit = (0.62 + 0.3 * wRibbon) * ribOn;
      // wicks, the rising bodies, the falling bodies; then the candle under the pointer, in champagne
      for (let pass = 0; pass < (onRib > 0.02 ? 4 : 3); pass++) {
        ctx.beginPath();
        for (let j = 0; j <= M; j++) {
          const n = n0 - (M - j);
          const u = 0.04 + (j - fr + 0.5) * du;
          if (u < 0.03 || u > 0.97) continue;
          const o = val(n);
          // the newest candle is still forming
          const grow = j === M ? fr : 1;
          const c = o + (val(n + 1) - o) * grow;
          const rise = c >= o;
          if (pass === 1 ? !rise : pass === 2 ? rise : false) continue;
          const near = onRib * clamp(1 - Math.abs(u - ribU) / (du * 1.5));
          if (pass === 3 && near < 0.34) continue;
          const lift = near * 0.06;
          const v0 = 0.14 + 0.72 * Math.min(o, c);
          const v1 = 0.14 + 0.72 * Math.max(o, c);
          if (pass === 0) {
            const wick = grow * (0.02 + 0.07 * dice(n, 62));
            const wick2 = grow * (0.02 + 0.07 * dice(n, 63));
            if (!pq(B, u, clamp(v0 - wick2, 0.05, 0.95), lift)) continue;
            ctx.moveTo(X, Y);
            pq(B, u, clamp(v1 + wick, 0.05, 0.95), lift);
            ctx.lineTo(X, Y);
          } else quad(ctx, B, u - du * 0.3, v0, u + du * 0.3, Math.max(v1, v0 + 0.03), lift);
        }
        if (pass === 0) {
          ctx.strokeStyle = pal.ink;
          ctx.globalAlpha = 0.55 * lit;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.fillStyle = pass === 1 ? pal.key : pass === 2 ? pal.ink2 : pal.gold;
          ctx.globalAlpha = (pass === 2 ? 0.5 : 0.95) * lit;
          ctx.fill();
        }
      }
      if (onRib > 0.02) {
        // a hairline follows the pointer along the ribbon
        line(ctx, B, clamp(ribU, 0.02, 0.98), 0.04, clamp(ribU, 0.02, 0.98), 0.96, 0.06);
        ctx.strokeStyle = pal.gold;
        ctx.globalAlpha = 0.85 * onRib;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      pq(B, 0, 1);
      text(f, part("CANDLE RIBBON", wRibbon * 1.3), X + 2, Y - 10, 9, pal.ink2, 0.8 * wRibbon * ribOn);
      pq(B, 1, 1);
      text(f, part("ILLUSTRATION", wRibbon * 1.3), X - 2, Y - 10, 8, pal.ink3, 0.75 * wRibbon * ribOn, "right");
    }

    // ══ near field: dust between the viewer and the instruments
    motes(f, s, true, f.boot, clearX);

    if (desk) {
      // ── the hour under the pointer, read off the dial, and the FX windows it falls in
      if (onDial > 0.02) {
        const mins = Math.round(((scrubA / TAU) * 1440) / 5) * 5;
        const a = (mins / 1440) * TAU;
        ctx.strokeStyle = pal.gold;
        ctx.beginPath();
        dp(a, RD - 0.1);
        ctx.moveTo(X, Y);
        dp(a, RD + 0.1);
        ctx.lineTo(X, Y);
        ctx.globalAlpha = 0.9 * onDial;
        ctx.lineWidth = 1.25;
        ctx.stroke();
        let names = "";
        for (let k = 0; k < 4; k++) if ((((mins - s.fx[k * 2]) % 1440) + 1440) % 1440 < s.fx[k * 2 + 1]) names += (names ? " · " : "") + fxSessions[k].name.toUpperCase();
        dp(a, RD + 0.15);
        const right = Math.sin(a) >= 0;
        const tx = clamp(X, clearX + 60, f.w - 12);
        text(f, `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)} UTC`, tx, Y - 6, 11, pal.ink, onDial, right ? "left" : "right");
        text(f, names || "BETWEEN FX WINDOWS", tx, Y + 7, 9, pal.gold, 0.9 * onDial, right ? "left" : "right");
      }

      // ── the clock, and the region that carries the day
      const hud = f.on(0.5, 0.4);
      const hx = CX + Math.min(room - 0.09, 1.56) * U;
      const hy = CY - 1.3 * U;
      text(f, `UTC ${pad(hours)}:${pad(minutes)}`, hx, hy, 11, pal.ink, 0.85 * hud, "right");
      ctx.strokeStyle = pal.ink;
      ctx.globalAlpha = 0.4 * hud;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(hx - 26, hy - 14);
      ctx.lineTo(hx + 7, hy - 14);
      ctx.lineTo(hx + 7, hy + 19);
      ctx.stroke();
      let rx = hx;
      for (let k = 2; k >= 0; k--) {
        const on = f.region === (k === 0 ? "asia" : k === 1 ? "europe" : "americas");
        text(f, REGIONS[k], rx, hy + 17, 8, on ? pal.ink : pal.ink3, (on ? 0.95 : 0.4 + 0.25 * wDial) * hud, "right");
        rx -= s.tw[NC + k] + 6;
        ctx.globalAlpha = (on ? 1 : 0.4) * hud;
        ctx.fillStyle = on ? pal.key : pal.ink3;
        ctx.beginPath();
        ctx.arc(rx, hy + 17, on ? 2.4 : 1.6, 0, TAU);
        ctx.fill();
        rx -= 12;
      }
      ctx.globalAlpha = 1;

      // ── the readout of the centre under the pointer: its real local time and its regular session
      if (sel >= 0 && s.st[sel]) {
        const st = s.st[sel];
        const k = sm(s.selK);
        const x = s.px[sel];
        const y = s.py[sel];
        const tone = st.state === "open" ? pal.emerald : st.state === "closed" ? pal.ink3 : pal.gold;
        const state = st.state === "open" ? "Regular session open" : st.state === "lunch" ? "Midday break" : st.state === "pre" ? "Pre-open" : "Regular session closed";
        const note = `${state} · ${formatDuration(st.nextChangeIn)} ${st.nextLabel}`;
        ctx.font = `500 10px ${pal.font}`;
        const cw = Math.max(176, ctx.measureText(note).width + 36);
        const ch = 68;
        let bx = x + 20;
        if (bx + cw > f.w - 12) bx = x - 20 - cw;
        if (bx < clearX) bx = x + 20;
        let by = y - ch - 16;
        if (by < 10) by = y + 18;
        by += (1 - k) * 8;
        // a reticle on the centre and a leader to the card
        ctx.strokeStyle = pal.gold;
        ctx.globalAlpha = 0.9 * k;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 8, t * 0.8, t * 0.8 + TAU * 0.78);
        ctx.moveTo(x + (bx > x ? 8 : -8), y + (by < y ? -5 : 5));
        ctx.lineTo(bx > x ? bx : bx + cw, by < y ? by + ch : by);
        ctx.stroke();
        ctx.globalAlpha = k;
        ctx.fillStyle = rgba(pal.bg, 0.97);
        ctx.fillRect(bx, by, cw, ch);
        ctx.fillStyle = rgba(pal.key, 0.07);
        ctx.fillRect(bx, by, cw, ch);
        ctx.strokeStyle = rgba(pal.ink, 0.22);
        ctx.strokeRect(bx + 0.5, by + 0.5, cw - 1, ch - 1);
        ctx.fillStyle = tone;
        ctx.fillRect(bx, by, cw, 2);
        text(f, st.centre.city.toUpperCase(), bx + 13, by + 16, 10, pal.ink, 0.95 * k, "left", 700);
        text(f, st.centre.venue, bx + cw - 13, by + 16, 10, pal.ink3, 0.9 * k, "right", 500);
        text(f, part(st.local.label, k * 1.5), bx + 13, by + 36, 19, pal.ink, k, "left", 500, true);
        ctx.font = `500 19px ${pal.display}`;
        const lw = ctx.measureText(st.local.label).width;
        text(f, "LOCAL TIME", bx + 21 + lw, by + 38, 8, pal.ink3, 0.9 * k);
        ctx.globalAlpha = k;
        ctx.fillStyle = tone;
        ctx.beginPath();
        ctx.arc(bx + 16, by + 55, 2.6, 0, TAU);
        ctx.fill();
        text(f, part(note, k * 1.3), bx + 25, by + 55.5, 10, pal.ink2, 0.95 * k, "left", 500);
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalAlpha = 1;
    if (!desk && !beside) {
      // the statement stands in front of the lower part of the instrument: the light gives way to the words
      const y0 = s.sky - 18;
      const y1 = y0 + rpx * 0.7;
      g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.74)");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = g;
      ctx.fillRect(0, y0, f.w, f.h - y0);
    }
    ctx.globalCompositeOperation = "source-over";
  },
};

export default scene;

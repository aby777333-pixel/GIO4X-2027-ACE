/**
 * A schematic earth for Canvas 2D, shared by the market-day film
 * (/labs/market-day) and the map of GIO4X (/about/world).
 *
 * What is real: the positions (latitude and longitude), the sun (its sub-solar
 * point from the UTC clock and the day of the year, so the line between day and
 * night is where it actually is), and sunrise and sunset at a place (from its
 * latitude, the sun's declination and the equation of time; good to a few
 * minutes). What is schematic: the land, which is a coarse field of points
 * sampled from hand-simplified outlines. It is not a coastline dataset and it
 * carries no borders.
 *
 * The land outlines and the sun arithmetic are the homepage scene's
 * (components/cockpit/scenes/flightdeck.ts). They are private to that file,
 * which is being reworked, so they are copied here rather than imported; if
 * that file ever exports them, this copy should go.
 *
 * The projection is orthographic: the point of the globe at (view.lon,
 * view.lat) faces the viewer. Nothing here allocates per frame: the last
 * projected point is left in P.
 */

/** red, green, blue (0 to 255) and the token's own alpha */
export type Colour = readonly [number, number, number, number];

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
/** a token colour as a canvas colour, at this share of its own alpha */
export const rgba = (c: Colour, alpha = 1) => `rgba(${c[0]},${c[1]},${c[2]},${Math.round(clamp(c[3] * alpha) * 1000) / 1000})`;
/** an angle in degrees brought into -180..180 */
export const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
/** a difference in minutes brought into -720..720 */
export const wrapDay = (m: number) => ((((m + 720) % 1440) + 1440) % 1440) - 720;

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
    const b = new Float32Array(LAND.length * 4);
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
      b.set([x0, x1, y0, y1], k * 4);
    });
    bounds = b;
  }
  for (let k = 0; k < LAND.length; k++) {
    if (lon < bounds[k * 4] || lon > bounds[k * 4 + 1] || lat < bounds[k * 4 + 2] || lat > bounds[k * 4 + 3]) continue;
    if (inside(LAND[k], lon, lat)) return !inside(CASPIAN, lon, lat);
  }
  return false;
}

/** the land as points on the unit sphere: x, y, z. Sampled once for each grain (degrees between points). */
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
      if (isLand(lon, lat)) v.push(c * Math.sin(lon * DEG), Math.sin(lat * DEG), c * Math.cos(lon * DEG));
    }
  }
  out = new Float32Array(v);
  fields.set(step, out);
  return out;
}

/** a place as a unit vector: x toward 90°E on the equator, y toward the north pole, z toward 0°E on the equator */
export function unit(lat: number, lon: number): [number, number, number] {
  const a = lat * DEG;
  const b = lon * DEG;
  return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
}

/* ── the sun ─────────────────────────────────────────────────────────────── */

export type Sun = {
  /** unit vector to the sun, earth-fixed */
  x: number;
  y: number;
  z: number;
  /** declination in radians, equation of time in minutes, sub-solar longitude in degrees */
  decl: number;
  eot: number;
  lon: number;
};

/** the sun counts as up when its centre is 0.833 degrees under the horizon (refraction and its own radius) */
const SUN_UP = Math.sin(-0.833 * DEG);

/**
 * Where the sun stands at an instant: declination from the day of the year,
 * longitude from the UTC clock corrected by the equation of time (the usual
 * three-term approximation, good to about a minute).
 */
export function sunAt(ms: number): Sun {
  const d = new Date(ms);
  const day = (ms - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86_400_000;
  const decl = -23.44 * Math.cos((TAU * (day + 10)) / 365.24) * DEG;
  const yr = (TAU * (day - 81)) / 365;
  const eot = 9.87 * Math.sin(2 * yr) - 7.53 * Math.cos(yr) - 1.5 * Math.sin(yr);
  const utc = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  const lon = wrap180((720 - utc - eot) / 4);
  return { x: Math.cos(decl) * Math.sin(lon * DEG), y: Math.sin(decl), z: Math.cos(decl) * Math.cos(lon * DEG), decl, eot, lon };
}

/** Sunrise and sunset at a place on the sun's day, in minutes of UTC (they may fall outside 0..1440). */
export function sunTimes(lat: number, lon: number, sun: Sun): { rise: number; set: number } {
  const a = lat * DEG;
  const half = Math.acos(clamp((SUN_UP - Math.sin(a) * Math.sin(sun.decl)) / (Math.cos(a) * Math.cos(sun.decl)), -1, 1)) / DEG;
  const noon = 720 - 4 * lon - sun.eot;
  return { rise: noon - 4 * half, set: noon + 4 * half };
}

/** Is the sun up at this place (a unit vector)? */
export const inDaylight = (v: readonly number[], sun: Sun) => v[0] * sun.x + v[1] * sun.y + v[2] * sun.z > SUN_UP;

/* ── the projection ──────────────────────────────────────────────────────── */

/** the globe on the canvas: its centre, its radius in pixels, and the place that faces the viewer */
export type Globe = { cx: number; cy: number; r: number; lon: number; lat: number };

/** the last projected point: x, y in pixels; z is how much it faces the viewer (-1..1) */
export const P = { x: 0, y: 0, z: 0 };

let cl = 1;
let sl = 0;
let cp = 1;
let sp = 0;
let GX = 0;
let GY = 0;
let GR = 1;

/** Set the globe every following project() call draws on. */
export function orient(g: Globe): void {
  cl = Math.cos(g.lon * DEG);
  sl = Math.sin(g.lon * DEG);
  cp = Math.cos(g.lat * DEG);
  sp = Math.sin(g.lat * DEG);
  GX = g.cx;
  GY = g.cy;
  GR = g.r;
}

/** An earth-fixed unit vector, lifted off the surface by `lift`, to the canvas. The answer is left in P. */
export function project(ex: number, ey: number, ez: number, lift = 1): void {
  const x1 = ex * cl - ez * sl;
  const z1 = ex * sl + ez * cl;
  P.x = GX + x1 * GR * lift;
  P.y = GY - (ey * cp - z1 * sp) * GR * lift;
  P.z = ey * sp + z1 * cp;
}

/** The last projected point shows when it faces the viewer, or (lifted off the surface) when it stands clear of the limb. */
export const shows = () => P.z > 0 || Math.hypot(P.x - GX, P.y - GY) > GR + 1;

/* ── colours ─────────────────────────────────────────────────────────────── */

export type EarthPalette = {
  ink: Colour;
  ink2: Colour;
  ink3: Colour;
  /** the night material the globe stands on */
  bg: Colour;
  blue: Colour;
  teal: Colour;
  emerald: Colour;
  /** champagne metal */
  gold: Colour;
  warn: Colour;
  /** the page's text face, for the few labels the canvas draws */
  font: string;
};

/**
 * The palette from the design tokens, read on the canvas itself so the night
 * material, the theme and the accent all follow. A token that is too dark to
 * read on night (the light theme's brand colours) is lifted toward the ink.
 */
export function readPalette(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): EarthPalette {
  const cs = getComputedStyle(canvas);
  /** Any CSS colour, through the canvas's own parser, as numbers. */
  const parse = (value: string): Colour | null => {
    if (!value) return null;
    ctx.fillStyle = "rgba(1,2,3,0.004)";
    const before = ctx.fillStyle;
    ctx.fillStyle = value;
    const s = String(ctx.fillStyle);
    if (s === before && value.replace(/\s/g, "") !== "rgba(1,2,3,0.004)") return null;
    if (s[0] === "#") return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
    const m = s.match(/-?[\d.]+(?:e-?\d+)?/g);
    if (!m || m.length < 3) return null;
    const k = s.startsWith("color(") ? 255 : 1;
    return [Math.round(Number(m[0]) * k), Math.round(Number(m[1]) * k), Math.round(Number(m[2]) * k), m.length > 3 ? Number(m[3]) : 1];
  };
  const v = (name: string, fallback: Colour) => parse(cs.getPropertyValue(name).trim()) ?? fallback;
  const ink = v("--ink", parse(cs.color) ?? [238, 240, 241, 1]);
  const lift = (c: Colour): Colour => {
    const lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    if (lum >= 0.42) return c;
    const k = 0.4;
    return [Math.round(c[0] + (ink[0] - c[0]) * k), Math.round(c[1] + (ink[1] - c[1]) * k), Math.round(c[2] + (ink[2] - c[2]) * k), c[3]];
  };
  const blue = lift(v("--accent", v("--brand", ink)));
  return {
    ink,
    ink2: v("--ink-2", ink),
    ink3: v("--ink-3", ink),
    bg: v("--night", [12, 17, 22, 1]),
    blue,
    teal: lift(v("--teal", blue)),
    emerald: lift(v("--emerald", blue)),
    gold: lift(v("--prestige", ink)),
    warn: lift(v("--warn", ink)),
    font: cs.fontFamily || "system-ui, sans-serif",
  };
}

/* ── drawing ─────────────────────────────────────────────────────────────── */

/** the grain of the land field for a globe of this radius: finer as it grows, within a budget of points */
const grainFor = (r: number) => (r < 150 ? 3.6 : r < 250 ? 2.7 : r < 420 ? 2.1 : 1.7);

/**
 * The body of the earth: a halo, the solid ball, the day side from the
 * terminator to the limb that faces the sun, a graticule, and the land as
 * points lit by the sun. Leaves the projection oriented to `g`.
 */
export function drawEarth(ctx: CanvasRenderingContext2D, g: Globe, sun: Sun, pal: EarthPalette, key: Colour): void {
  orient(g);
  const { cx, cy, r } = g;

  // the halo
  let grad = ctx.createRadialGradient(cx, cy, r * 0.95, cx, cy, r * 1.16);
  grad.addColorStop(0, rgba(key, 0.26));
  grad.addColorStop(0.4, rgba(key, 0.07));
  grad.addColorStop(1, rgba(key, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.16, 0, TAU);
  ctx.fill();

  // a solid body
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = rgba(pal.bg, 1);
  ctx.fill();
  ctx.fillStyle = rgba(key, 0.05);
  ctx.fill();

  // the sun as the viewer sees it: its direction on the canvas, and how much it shines toward the viewer
  project(sun.x, sun.y, sun.z);
  const dx = P.x - cx;
  const dy = P.y - cy;
  const toward = P.z;
  const phi = Math.hypot(dx, dy) > r * 1e-4 ? Math.atan2(dy, dx) : 0;

  // the day side: from the terminator (half an ellipse) to the limb that faces the sun (half the circle)
  ctx.beginPath();
  ctx.arc(cx, cy, r, phi - Math.PI / 2, phi + Math.PI / 2);
  ctx.ellipse(cx, cy, r * Math.abs(toward), r, phi, Math.PI / 2, Math.PI * 1.5, toward < 0);
  ctx.closePath();
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  grad = ctx.createLinearGradient(cx - c * r * toward, cy - s * r * toward, cx + c * r, cy + s * r);
  grad.addColorStop(0, rgba(key, 0.1));
  grad.addColorStop(0.5, rgba(key, 0.19));
  grad.addColorStop(1, rgba(key, 0.3));
  ctx.fillStyle = grad;
  ctx.fill();

  // the graticule, on the near side only
  ctx.beginPath();
  for (let lon = 0; lon < 360; lon += 30) {
    let pen = false;
    const cl2 = Math.cos(lon * DEG);
    const sl2 = Math.sin(lon * DEG);
    for (let lat = -80; lat <= 80; lat += 8) {
      const k = Math.cos(lat * DEG);
      project(k * sl2, Math.sin(lat * DEG), k * cl2);
      if (P.z < 0.01) pen = false;
      else if (pen) ctx.lineTo(P.x, P.y);
      else {
        ctx.moveTo(P.x, P.y);
        pen = true;
      }
    }
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    let pen = false;
    const k = Math.cos(lat * DEG);
    const y = Math.sin(lat * DEG);
    for (let lon = 0; lon <= 360; lon += 8) {
      project(k * Math.sin(lon * DEG), y, k * Math.cos(lon * DEG));
      if (P.z < 0.01) pen = false;
      else if (pen) ctx.lineTo(P.x, P.y);
      else {
        ctx.moveTo(P.x, P.y);
        pen = true;
      }
    }
  }
  ctx.strokeStyle = rgba(pal.ink, 0.1);
  ctx.lineWidth = 1;
  ctx.stroke();

  // the land: three batches (night, twilight, day), each one path
  const e = field(grainFor(r));
  const n = e.length / 3;
  const dot = clamp((grainFor(r) * DEG * r) / 2.9, 0.65, 2.3);
  for (let pass = 0; pass < 3; pass++) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ex = e[i * 3];
      const ey = e[i * 3 + 1];
      const ez = e[i * 3 + 2];
      const light = ex * sun.x + ey * sun.y + ez * sun.z;
      if ((light > 0.14 ? 2 : light > -0.1 ? 1 : 0) !== pass) continue;
      project(ex, ey, ez);
      if (P.z < 0.03) continue;
      const size = dot * (0.5 + 0.5 * P.z);
      ctx.moveTo(P.x + size, P.y);
      ctx.arc(P.x, P.y, size, 0, TAU);
    }
    ctx.fillStyle = rgba(pal.ink, pass === 2 ? 0.8 : pass === 1 ? 0.46 : 0.2);
    ctx.fill();
  }

  // the limb
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.strokeStyle = rgba(key, 0.55);
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // the sun itself, where it is overhead: a small rayed ring, when that place faces the viewer
  project(sun.x, sun.y, sun.z);
  if (P.z > 0.08) sunMark(ctx, P.x, P.y, 4.5, pal.gold, 0.9, true);
}

/** A small sun: a ring with eight rays, or (setting) the upper half of one on a horizon line. */
export function sunMark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: Colour, alpha: number, whole: boolean): void {
  ctx.strokeStyle = rgba(colour, alpha);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  if (whole) {
    ctx.arc(x, y, r, 0, TAU);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      ctx.moveTo(x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2));
      ctx.lineTo(x + Math.cos(a) * (r + 4.5), y + Math.sin(a) * (r + 4.5));
    }
  } else {
    ctx.arc(x, y, r, Math.PI, TAU);
    ctx.moveTo(x - r - 3.5, y);
    ctx.lineTo(x + r + 3.5, y);
  }
  ctx.stroke();
}

/**
 * The great circle from a to b (unit vectors), raised off the surface in the
 * middle, added to the current path where it shows. `seg` straight pieces.
 */
export function arcPath(ctx: CanvasRenderingContext2D, a: readonly number[], b: readonly number[], rise: number, seg: number): void {
  const dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
  const om = Math.acos(dot);
  if (om < 1e-3) return;
  const so = Math.sin(om);
  let pen = false;
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const ka = Math.sin((1 - u) * om) / so;
    const kb = Math.sin(u * om) / so;
    const lift = 1 + rise * Math.sin(Math.PI * u);
    project(a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb, lift);
    if (!shows()) pen = false;
    else if (pen) ctx.lineTo(P.x, P.y);
    else {
      ctx.moveTo(P.x, P.y);
      pen = true;
    }
  }
}

/** One point of that arc, at `u` (0..1) along it. The answer is left in P; false when it is hidden. */
export function arcPoint(a: readonly number[], b: readonly number[], rise: number, u: number): boolean {
  const om = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
  if (om < 1e-3) return false;
  const so = Math.sin(om);
  const ka = Math.sin((1 - u) * om) / so;
  const kb = Math.sin(u * om) / so;
  const lift = 1 + rise * Math.sin(Math.PI * u);
  project(a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb, lift);
  return shows();
}

/** Lettering on the globe: it keeps a little night behind it so it reads over lit land. */
export function label(ctx: CanvasRenderingContext2D, pal: EarthPalette, str: string, x: number, y: number, size: number, colour: Colour, alpha: number, align: CanvasTextAlign = "left", weight = 600): void {
  if (alpha <= 0.01 || !str) return;
  ctx.font = `${weight} ${size}px ${pal.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = rgba(pal.bg, 0.78 * alpha);
  ctx.lineWidth = 3;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = rgba(colour, alpha);
  ctx.fillText(str, x, y);
}

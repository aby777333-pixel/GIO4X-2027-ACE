/**
 * FLIGHT DECK — the trading day, seen from the flight deck.
 *
 * The homepage's instrument: one Canvas 2D scene, luminous rather than drawn in
 * hairlines, with the globe as its hero.
 *
 *   - the globe: a solid ball with filled continents, lit by the real sun (the
 *     sub-solar point from the UTC clock, the day of the year and the equation of
 *     time), so the warm terminator is where day meets night right now. It has an
 *     atmosphere, a glint where the sun stands overhead, and, on its night side,
 *     the lights of the nine financial centres of src/lib/sessions.ts. Each
 *     centre is lit by its regular trading hours
 *   - flows: arcs between centres that are inside their regular sessions at the
 *     same time, with couriers of light travelling them
 *   - three forms about the globe that carry no data at all, only the shape of
 *     the thing: a tape of light over it, a depth ladder as two facing fins beside
 *     it, a ribbon of candles under it. No prices, no axis, no symbol
 *   - the words, over the globe: the day and the UTC time, the FX sessions open
 *     now (or how long until the FX week opens), how many centres are open and
 *     how many are in daylight, the next regular open and its countdown
 *   - the timeline, under the globe: the three hours behind and the twenty-one
 *     ahead, with each centre's regular hours as a bar, the four FX session
 *     windows above them, and the present moment passing through
 *
 * It lives by itself. A seeded schedule read from the scene clock (never
 * Math.random) lets things happen at irregular intervals: a pulse leaves an open
 * centre and travels the globe, a burst of couriers crosses an ocean, a sweep
 * passes through a fin of the ladder, a comet circles the globe, a scanning light
 * crosses the land, a run of the tape prints bright, a glint runs the timeline.
 *
 * Under the pointer it wakes: everything brightens and gains detail, the globe
 * turns to face the pointer, and the centre nearest the pointer (on the globe or
 * on its row of the timeline) is read out in words: venue, local time, UTC
 * offset, the state of its regular session and the time to its next change, its
 * regular hours, its sunrise and sunset. The timeline reads the hour under the
 * pointer; the fins and the candles answer with a level and a hairline.
 *
 * The frame. All of it is composed inside one frame and clipped to it; the engine
 * draws the champagne frame round it (Scene.frame). Beside the statement the frame
 * uses the height of the stage: 34px from the top, room for the caption below,
 * its right edge on the content column's and its left edge clear of the headline
 * (never wider than a golden rectangle lying down, never taller than one standing).
 * Its height is cut at golden sections: the words take 1/phi^4 of it, the globe's
 * field 1/phi, the timeline 1/phi^3 (they sum to one). Below 1080px, where there
 * is no room beside the headline, the frame stands above the statement and is
 * wide: the globe in a square at its left, the words and the timeline beside it.
 * Only the faint field behind (deck, dust, horizon) runs on outside the frame.
 *
 * What is real: clock times, time zones, the sun, sunrise and sunset, which
 * regular sessions are open and when. Everything else is form, and the caption
 * under the stage says so. The scene keeps its own hues for the globe, for "open"
 * and for champagne, so that it holds its colour in every accent; the accent's
 * key light tints the glow, the tape and the frame.
 */
import { TAU, clamp, rgba, type Frame, type Scene } from "../engine";
import { pool } from "../kit";
import { allCentreStatus, centres, formatDuration, fxOverview, fxSessions, localTime, type CentreStatus } from "../../../lib/sessions";

const PI = Math.PI;
const DEG = PI / 180;
const PHI = (1 + Math.sqrt(5)) / 2;
/** camera distance (world units) */
const D = 6;
/** the globe (world units) */
const R = 0.8;
const FLOOR = -1.3;
const NC = centres.length;
/** a point of the globe faces the viewer when its facing is above this (perspective horizon) */
const HOR = R / D + 0.012;
const REGIONS = ["ASIA", "EUROPE", "AMERICAS"] as const;
const WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
/** the centres' city codes, for a timeline too narrow for their names */
const CODES = ["SYD", "TYO", "HKG", "SIN", "BOM", "DXB", "FRA", "LON", "NYC"] as const;
/** the sun counts as up when its centre is 0.833 degrees under the horizon (refraction and its own radius) */
const SUN_UP = Math.sin(-0.833 * DEG);
/** the timeline's window, in minutes about the present */
const PAST = 180;
const SPAN = 1440;
/**
 * The scene's own hues. The accent may be grey (Mono) or champagne (Ivory); the
 * globe, "open" and the champagne highlights keep their colour whatever it is.
 */
const HUE = {
  deep: "#04121f",
  ocean: "#0d4a7c",
  air: "#49b6f0",
  mist: "#3fd6c8",
  land: "#a4dccd",
  shade: "#163f4e",
  warm: "#ffae62",
  city: "#ffd79a",
  open: "#3fe394",
  gold: "#e8cf93",
  up: "#93f2d2",
  down: "#5d93e6",
  bid: "#39d2c2",
  ask: "#7aa2ff",
} as const;
const FX_HUE = [HUE.mist, HUE.air, HUE.air, HUE.open] as const;
/** minutes as a clock time, any day */
const clockOf = (m: number) => {
  const v = ((Math.round(m) % 1440) + 1440) % 1440;
  return pad(Math.floor(v / 60)) + ":" + pad(v % 60);
};

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

/** the golden rectangle the instrument was last composed in (canvas pixels), and whether there was room for one */
const BOX = { x: 0, y: 0, w: 0, h: 0 };
let BOXON = false;

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
  ctx.fillStyle = HUE.air;
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

/** two pieces of lettering side by side, the first in one colour and the second in another */
function pair(f: Frame, a: string, c: string, x: number, y: number, size: number, colA: string, colC: string, alpha: number, right = false, weightA = 600): void {
  if (alpha <= 0.01) return;
  const { ctx } = f;
  if (right) {
    text(f, c, x, y, size, colC, alpha, "right", 500);
    ctx.font = `500 ${size}px ${f.pal.font}`;
    text(f, a, x - (c ? ctx.measureText(c).width + 5 : 0), y, size, colA, alpha, "right", weightA);
  } else {
    text(f, a, x, y, size, colA, alpha, "left", weightA);
    ctx.font = `${weightA} ${size}px ${f.pal.font}`;
    text(f, c, x + (a ? ctx.measureText(a).width + 5 : 0), y, size, colC, alpha, "left", 500);
  }
}

/** a point in the globe's own plane: angle `a` (radians, anticlockwise from the right), radius in globe radii, depth `z` */
const fp = (a: number, r: number, z: number) => pr(Math.cos(a) * r * R, Math.sin(a) * r * R, z);

/* ── the land as outlines on the unit sphere, for filling: one array for each land mass, and Antarctica as a cap */
const SHAPES: Float32Array[] = [];
function shapes(): Float32Array[] {
  if (SHAPES.length) return SHAPES;
  const add = (p: readonly number[]) => {
    const v = new Float32Array((p.length / 2) * 3);
    for (let i = 0; i < p.length / 2; i++) {
      const lon = p[i * 2] * DEG;
      const lat = p[i * 2 + 1] * DEG;
      v[i * 3] = Math.cos(lat) * Math.sin(lon);
      v[i * 3 + 1] = Math.sin(lat);
      v[i * 3 + 2] = Math.cos(lat) * Math.cos(lon);
    }
    SHAPES.push(v);
  };
  LAND.forEach(add);
  const cap: number[] = [];
  for (let lon = -180; lon < 180; lon += 10) cap.push(lon, -(70 + 3 * Math.cos((lon + 90) * DEG)));
  add(cap);
  return SHAPES;
}

/**
 * The land that faces the viewer, as one path. A vertex over the horizon is slid out to the limb along
 * its own direction, so a land mass that runs round the edge of the globe is cut by the edge.
 */
function landPath(p: Path2D, rpx: number): void {
  const all = shapes();
  for (let k = 0; k < all.length; k++) {
    const v = all[k];
    const n = v.length / 3;
    let seen = false;
    for (let i = 0; i < n && !seen; i++) seen = -(m6 * v[i * 3] + m7 * v[i * 3 + 1] + m8 * v[i * 3 + 2]) >= HOR;
    if (!seen) continue;
    for (let i = 0; i < n; i++) {
      gp(v[i * 3], v[i * 3 + 1], v[i * 3 + 2], 1);
      let x = X;
      let y = Y;
      if (F < HOR) {
        const dx = X - CX;
        const dy = Y - CY;
        const d = Math.hypot(dx, dy) || 1;
        x = CX + (dx / d) * rpx;
        y = CY + (dy / d) * rpx;
      }
      if (i) p.lineTo(x, y);
      else p.moveTo(x, y);
    }
    p.closePath();
  }
}

type State = {
  /** the land as points, for the scanning light */
  e: Float32Array;
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
  /** the width of each centre's name, measured with the timetable */
  tw: Float32Array;
  /** the timetable, refreshed a few times a minute */
  at: number;
  st: CentreStatus[];
  open: Uint8Array;
  pairs: Uint8Array;
  npair: number;
  nopen: number;
  /** the centre next to open */
  next: number;
  /** the longitude the globe turns to */
  face: number;
  sun: Float32Array;
  /** for each centre: its UTC offset (minutes), sunrise and sunset today (UTC minutes), whether the sun is up there */
  off: Int16Array;
  rise: Float32Array;
  set: Float32Array;
  lit: Uint8Array;
  nlit: number;
  /** the state each centre was last seen in, and the scene time at which it last changed */
  was: Uint8Array;
  turned: Float32Array;
  /** in words: the FX sessions open now, and the centre whose regular session opens next */
  fxWords: string;
  nextWords: string;
  /**
   * The timeline: for each centre up to six stretches of its regular hours inside the window (start and
   * end, in minutes from the reading of the timetable), and how many; the same for the four FX sessions.
   */
  bars: Float32Array;
  nbar: Uint8Array;
  fxb: Float32Array;
  nfx: Uint8Array;
  /** what moves */
  init: boolean;
  lon: number;
  tilt: number;
  wake: number;
  spin: number;
  sel: number;
  selK: number;
  /** below the desk layout: where the statement begins (pixels from the top of the stage), and when that was measured */
  sky: number;
  skyFor: number;
  skyAt: number;
};

/** one local window (a..b, local minutes) on yesterday, today and tomorrow, where those are weekdays, cut to the timeline */
function days(out: Float32Array, base: number, n: number, max: number, weekday: number, minutes: number, a: number, c: number): number {
  for (let d = -1; d <= 1; d++) {
    const wd = (weekday + d + 7) % 7;
    if (wd < 1 || wd > 5 || n >= max) continue;
    const from = a - minutes + d * 1440;
    const to = c - minutes + d * 1440;
    if (to <= -PAST || from >= SPAN - PAST) continue;
    out[base + n * 2] = Math.max(from, -PAST);
    out[base + n * 2 + 1] = Math.min(to, SPAN - PAST);
    n++;
  }
  return n;
}

function refresh(f: Frame, s: State, cap: number): void {
  const now = f.now;
  s.at = now.getTime();
  s.st = allCentreStatus(now);
  // the sun: declination from the day of the year; longitude from the UTC clock, corrected by the
  // equation of time (the usual three-term approximation, good to about a minute)
  const day = (s.at - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86_400_000;
  const decl = -23.44 * Math.cos((TAU * (day + 10)) / 365.24) * DEG;
  const yr = (TAU * (day - 81)) / 365;
  const eot = 9.87 * Math.sin(2 * yr) - 7.53 * Math.cos(yr) - 1.5 * Math.sin(yr);
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
  const sunLon = (720 - utc - now.getUTCSeconds() / 60 - eot) / 4;
  s.sun[0] = Math.cos(decl) * Math.sin(sunLon * DEG);
  s.sun[1] = Math.sin(decl);
  s.sun[2] = Math.cos(decl) * Math.cos(sunLon * DEG);
  let sx = 0;
  let sy = 0;
  let any = 0;
  let wait = Infinity;
  s.nopen = 0;
  s.next = -1;
  s.nlit = 0;
  for (let i = 0; i < NC; i++) {
    const st = s.st[i];
    const c = st.centre;
    s.open[i] = st.state === "open" ? 1 : 0;
    s.nopen += s.open[i];
    // its UTC offset, from its own wall clock; sunrise and sunset from its latitude and the sun's declination
    let off = st.local.minutes - utc;
    if (off > 780) off -= 1440;
    if (off < -660) off += 1440;
    s.off[i] = off;
    const lat = c.lat * DEG;
    const half = Math.acos(clamp((SUN_UP - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl)), -1, 1)) / DEG;
    const noon = 720 - 4 * c.lon - eot;
    s.rise[i] = noon - 4 * half;
    s.set[i] = noon + 4 * half;
    s.lit[i] = CV[i * 3] * s.sun[0] + CV[i * 3 + 1] * s.sun[1] + CV[i * 3 + 2] * s.sun[2] > SUN_UP ? 1 : 0;
    s.nlit += s.lit[i];
    // a real change of state, seen between two readings of the timetable, is marked on the globe
    const code = st.state === "open" ? 1 : st.state === "pre" ? 2 : st.state === "lunch" ? 3 : 0;
    if (s.was[i] !== 255 && s.was[i] !== code && !f.still) s.turned[i] = f.t;
    s.was[i] = code;
    // its regular hours on the timeline (its midday break leaves a gap)
    let n = 0;
    if (c.lunch) {
      n = days(s.bars, i * 12, n, 6, st.local.weekday, st.local.minutes, c.open, c.lunch[0]);
      n = days(s.bars, i * 12, n, 6, st.local.weekday, st.local.minutes, c.lunch[1], c.close);
    } else n = days(s.bars, i * 12, n, 6, st.local.weekday, st.local.minutes, c.open, c.close);
    s.nbar[i] = n;
    if (st.state !== "closed") {
      sx += Math.cos(c.lon * DEG);
      sy += Math.sin(c.lon * DEG);
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
  list.sort((a, c) => a[2] - c[2]);
  s.npair = Math.min(cap, list.length);
  for (let k = 0; k < s.npair; k++) {
    s.pairs[k * 2] = list[k][0];
    s.pairs[k * 2 + 1] = list[k][1];
  }
  f.ctx.font = `600 11px ${f.pal.font}`;
  for (let i = 0; i < NC; i++) s.tw[i] = f.ctx.measureText(centres[i].city).width;
  // in words: the FX sessions open now (or how long until the FX week opens), and the next regular open
  const fx = fxOverview(now);
  if (fx.weekOpen) s.fxWords = fx.open.length ? fx.open.map((x) => x.name.toUpperCase()).join(" × ") : "BETWEEN SESSIONS";
  else {
    const ny = localTime(now, "America/New_York");
    const until = ny.weekday === 0 ? 1020 - ny.minutes : ny.weekday === 6 ? 2460 - ny.minutes : 3900 - ny.minutes;
    s.fxWords = `WEEK CLOSED · OPENS IN ${formatDuration(Math.max(1, until))}`;
  }
  s.nextWords = s.next >= 0 ? `${centres[s.next].city.toUpperCase()} · ${formatDuration(s.st[s.next].nextChangeIn)}` : "";
  // the four FX session windows on the timeline (weekdays in each session's own city)
  fxSessions.forEach((x, k) => {
    const lt = localTime(now, x.tz);
    s.nfx[k] = days(s.fxb, k * 6, 0, 3, lt.weekday, lt.minutes, x.open, x.close);
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

/** dust in the air, flying past: fine points far off, soft discs out of focus near the viewer */
function motes(f: Frame, s: State, front: boolean, level: number, clearX: number): void {
  const { ctx } = f;
  const m = s.motes;
  const n = (m.length / 4) * (f.q < 0.75 ? 0.5 : 1);
  ctx.fillStyle = f.pal.ink;
  for (let i = 0; i < n; i++) {
    const z = 13 - ((m[i * 4 + 2] + f.t * m[i * 4 + 3]) % 17);
    if (z <= 0 !== front || !pr(m[i * 4], m[i * 4 + 1], z) || X < clearX + 24) continue;
    const near = clamp((2 - z) / 5);
    ctx.globalAlpha = level * sm((13 - z) / 3) * sm((z + 4) / 2.5) * (0.34 - 0.27 * near);
    ctx.beginPath();
    ctx.arc(X, Y, 0.7 + near * near * 4.2, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const scene: Scene<State> = {
  pose: 12,
  // the homepage stage is taller than the others, so the scene composes its own frame (see `frame` below)
  free: true,
  setup(f) {
    const e = field(f.mobile ? 5.4 : 3.6);
    const nm = f.mobile ? 22 : 60;
    const mo = new Float32Array(nm * 4);
    for (let i = 0; i < nm; i++) {
      mo[i * 4] = -2.6 + f.rnd(i * 4 + 11) * 7.4;
      mo[i * 4 + 1] = -1.2 + f.rnd(i * 4 + 12) * 3.5;
      mo[i * 4 + 2] = f.rnd(i * 4 + 13) * 17;
      mo[i * 4 + 3] = 0.22 + f.rnd(i * 4 + 14) * 0.5;
    }
    // the tape: slots along its run, most of them carrying a dash of some length, a few left empty
    const slots = f.mobile ? 22 : 46;
    const dash: number[] = [];
    for (let i = 0; i < slots; i++) {
      if (f.rnd(i * 3 + 201) < 0.16) continue;
      dash.push(i / slots, (1 / slots) * (0.2 + 0.62 * f.rnd(i * 3 + 202)), f.rnd(i * 3 + 203));
    }
    const seg = f.mobile ? 16 : 26;
    return {
      e,
      motes: mo,
      dash: new Float32Array(dash),
      arc: new Float32Array((seg + 1) * 3),
      seg,
      px: new Float32Array(NC),
      py: new Float32Array(NC),
      pf: new Float32Array(NC),
      boxes: new Float32Array(NC * 4),
      tw: new Float32Array(NC),
      at: 0,
      st: [],
      open: new Uint8Array(NC),
      pairs: new Uint8Array(24),
      npair: 0,
      nopen: 0,
      next: -1,
      face: 0,
      sun: new Float32Array(3),
      off: new Int16Array(NC),
      rise: new Float32Array(NC),
      set: new Float32Array(NC),
      lit: new Uint8Array(NC),
      nlit: 0,
      was: new Uint8Array(NC).fill(255),
      turned: new Float32Array(NC).fill(-99),
      fxWords: "",
      nextWords: "",
      bars: new Float32Array(NC * 12),
      nbar: new Uint8Array(NC),
      fxb: new Float32Array(24),
      nfx: new Uint8Array(4),
      init: false,
      lon: 0,
      tilt: 20 * DEG,
      wake: 0,
      spin: 0,
      sel: -1,
      selK: 0,
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
    let g: CanvasGradient;

    // ── the frame. It holds the whole instrument and clips it; only the faint field behind it runs on
    // outside. Its right edge is the content column's (the same sums as engine.ts), its left edge keeps
    // clear of the headline, and beside the statement it uses the height of the stage.
    const gutter = clamp(f.w * 0.042, 21, 55);
    const contentW = Math.min(f.w - gutter * 2, 1320);
    const right = (f.w + contentW) / 2;
    const b = BOX;
    if (!desk && (s.skyFor !== f.w * 4096 + f.h || t - s.skyAt > 2 || t < s.skyAt)) {
      // where the statement begins, measured now and then (it moves when the display face arrives)
      const body = ctx.canvas.closest(".cx-hero")?.querySelector(".cx-statement-body");
      s.sky = body ? body.getBoundingClientRect().top - ctx.canvas.getBoundingClientRect().top : f.h * 0.3;
      s.skyFor = f.w * 4096 + f.h;
      s.skyAt = t;
    }
    // beside the statement: 34px from the top, room for the caption below (it shows from 1080px), never
    // wider than a golden rectangle lying down and never taller than one standing
    const foot = desk ? 76 : 34;
    const left = f.clear > 0 ? f.clear + clamp(contentW * 0.026, 22, 34) : desk ? f.w / 2 : f.w;
    let bh = f.h - 34 - foot;
    const bw = Math.min(f.mobile ? 0 : right - left, bh * PHI);
    bh = Math.min(bh, bw * PHI);
    let beside = desk;
    if (!desk) {
      // or above the statement, as on the inner pages, where there is no room beside the headline
      const ah = Math.min(s.sky - 34, contentW / 1.5);
      const aw = Math.min(contentW, 760, ah * 3.4);
      beside = bw >= 260 && bw * bh > aw * ah;
      if (!beside) {
        b.w = aw;
        b.h = ah;
        b.x = (f.w - aw) / 2;
        b.y = 14;
      }
    }
    if (beside) {
      b.w = bw;
      b.h = bh;
      b.x = right - bw;
      b.y = 34 + (f.h - 34 - foot - bh) / 2;
    }
    BOXON = b.w >= 150 && b.h >= 80;
    const W = b.w;
    const H = b.h;
    // A tall frame is cut at golden sections of its height: the words take 1/phi^4 of it, the globe's
    // field 1/phi, the timeline 1/phi^3. A wide one has the globe in a square at its left and the words
    // and the timeline beside it.
    const tower = H >= 400 && W / H < 1.9;
    const band0 = tower ? H / PHI ** 4 : 0;
    const band1 = tower ? H / PHI ** 3 : 0;
    const inset = clamp(H * 0.03, 8, 16);
    let gx: number;
    let gy: number;
    let radius: number;
    /** the column beside the globe in a wide frame */
    let colX = 0;
    let colW = 0;
    if (tower) {
      // the globe may stand a little into the band of words, between the two blocks of them
      const y0 = b.y + (W >= 520 ? inset * 0.6 : band0 + 4);
      const y1 = b.y + H - band1 - 6;
      radius = Math.min((y1 - y0) / 2.6, (W / 2 - 10) / 1.55);
      gx = b.x + W / 2;
      gy = (y0 + y1) / 2 - 0.105 * radius;
    } else {
      const side = Math.min(H, W * 0.5);
      radius = Math.min((side / 2 - 4) / 1.55, (H - 8) / 2.6);
      gx = b.x + side / 2;
      gy = b.y + H / 2 - 0.105 * radius;
      colX = b.x + side + 6;
      colW = b.x + W - colX - inset;
    }
    const named = !f.mobile && radius >= 120;
    const unit = radius / ((R * D) / Math.sqrt(D * D - R * R));
    if (BOXON) {
      f.cx = gx;
      f.cy = gy;
    }
    f.cam.parallax = 0.6;
    const live = still ? 0 : 1;
    // the camera drifts by itself, and leans with the pointer (the engine adds that)
    f.aim(Math.sin(t * 0.11 + 1.7) * 0.04 * live, 0.03 + Math.sin(t * 0.073 + 0.4) * 0.012 * live, D, 1 / (1 + f.scroll * 0.16));
    lens(f);

    // ══ the field behind the frame: dust, the deck, the light spilled on it, the horizon
    motes(f, s, false, f.boot, beside ? f.clear + 16 : -1e6);
    deck(f, 0.085 * f.boot);
    pool(f, [0, FLOOR, -0.2], 2.4, pal.key, (desk ? 0.14 : 0.1) * f.boot);
    pool(f, [0, FLOOR, 60], 28, pal.key, 0.22 * f.boot);
    if (pr(0, FLOOR, 4000)) {
      const reach = f.on(0.05, 0.5);
      beam(f, CX, CX + (f.w - CX) * reach, Y, 0.4 * reach, 0.1 * reach);
      beam(f, CX, CX - 1.7 * UU * reach, Y, 0.4 * reach, 0);
    }
    ctx.globalAlpha = 1;
    // the statement owns its part of the stage: the field gives way to it (to the left where the frame
    // stands beside the statement, downward where it stands above it)
    g = beside ? ctx.createLinearGradient(0, 0, f.w * 0.54, 0) : ctx.createLinearGradient(0, f.h, 0, f.h * 0.38);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(beside ? 0.3 : 0.38, beside ? "rgba(0,0,0,1)" : "rgba(0,0,0,0.86)");
    g.addColorStop(0.63, beside ? "rgba(0,0,0,0.78)" : "rgba(0,0,0,0.5)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = g;
    if (beside) ctx.fillRect(0, 0, f.w * 0.54, f.h);
    else ctx.fillRect(0, f.h * 0.38, f.w, f.h * 0.62);
    ctx.globalCompositeOperation = "source-over";
    if (!BOXON) return;

    // ══ the frame: night glass, and everything of the instrument clipped to it
    const fieldU = UU;
    UU = unit;
    // (the engine sizes the pointer's light from this, as in its own frames)
    f.u = Math.min(W / 3.9, H / 2.75);
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, W, H);
    ctx.clip();
    ctx.fillStyle = "rgba(3, 8, 13, 0.58)";
    ctx.fillRect(b.x, b.y, W, H);
    const U = UU * ZOOM;
    const rpx = (R * U * D) / Math.sqrt(D * D - R * R);

    // ── waking. Calm until the pointer enters; up in about a second, down in about two.
    const want = still ? 1 : f.hover > 0.5 ? 1 : 0;
    s.wake = still ? 1 : s.wake + (want - s.wake) * Math.min(1, f.dt * (want > s.wake ? 2.4 : 1.3));
    if (s.wake < 0.002) s.wake = 0;
    const wake = s.wake;
    // while it wakes, a line of light runs down the frame, and the lettering resolves as the line passes it
    const waking = !still && want === 1 && wake < 0.96;
    const scanY = b.y + H * wake * 1.1;
    const shown = (y: number) => (waking ? sm((scanY - y) / 16 + 0.5) : 1);
    if (!still) s.spin += f.dt * 0.16 * wake;

    // ── the timetable
    const nowMs = f.now.getTime();
    if (!s.st.length || Math.abs(nowMs - s.at) > 20_000) refresh(f, s, lite ? 5 : 10);
    /** minutes since the timetable was read: the timeline slides by this */
    const since = (nowMs - s.at) / 60_000;

    // ── the globe's attitude: it faces the trading region, drifts, and turns to face the pointer
    const dxp = clamp((f.mx - CX) / rpx, -1.7, 1.7) * f.hover;
    const dyp = clamp((f.my - CY) / rpx, -1.5, 1.5) * f.hover;
    const wantLon = s.face + (still ? 0 : Math.sin(t / 21) * 11) - dxp * 20;
    const wantTilt = (20 + dyp * 8) * DEG;
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
    const pGlint = still ? 0.5 : ev(t, 7.5, 2.2, 7);

    // ── the timeline's place, and where the pointer is among the instruments
    const lettering = H < 200 ? 0 : 1;
    const ls = tower ? clamp(band0 / 6.2, 10.5, 15) : clamp(H / 9, 10.5, 14);
    let tlX = 0;
    let tlY = 0;
    let tlW = 0;
    let tlH = 0;
    if (tower) {
      tlX = b.x + inset;
      tlY = b.y + H - band1 + 2;
      tlW = W - inset * 2;
      tlH = band1 - inset - 2;
    } else if (H >= 250 && colW >= 190) {
      tlX = colX;
      tlY = b.y + inset + ls * 8;
      tlW = colW;
      tlH = b.y + H - inset - tlY;
    }
    const tlOn = tlH >= 70;
    /** the timeline's column of names, its axis, the height of a row */
    const tlName = tlW >= 480 ? 68 : 30;
    const axX = tlX + tlName;
    const axW = tlW - tlName - 4;
    const rowY = tlY + 15;
    const rowH = tlOn ? (tlH - 15 - 15) / NC : 0;
    const minuteX = (m: number) => axX + ((m - since + PAST) / SPAN) * axW;
    const inTl = tlOn && f.hover > 0 && f.mx > tlX && f.mx < tlX + tlW && f.my > tlY - 2 && f.my < tlY + tlH ? f.hover : 0;
    const tlRow = inTl ? Math.floor((f.my - rowY) / rowH) : -1;
    const dPointer = Math.hypot(f.mx - CX, f.my - CY);
    const pd = dPointer / rpx;
    const pang = Math.atan2(CY - f.my, f.mx - CX);
    const onFin = !inTl && pd > 1.08 && pd < 1.66 && Math.abs(CY - f.my) < 0.68 * rpx ? f.hover : 0;
    const onCan = !inTl && pd > 1.06 && pd < 1.52 && pang < -32 * DEG && pang > -148 * DEG ? f.hover : 0;

    // ══ light behind the globe: a soft volume of it, so the globe stands in its own air
    const globeOn = f.on(0, 0.5);
    ctx.globalCompositeOperation = "lighter";
    g = ctx.createRadialGradient(CX, CY, rpx * 0.6, CX, CY, rpx * 2.3);
    g.addColorStop(0, rgba(HUE.air, 0.22 * globeOn));
    g.addColorStop(0.4, rgba(pal.key, 0.09 * globeOn * (0.8 + 0.2 * wake)));
    g.addColorStop(1, rgba(pal.key, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(CX, CY, rpx * 2.3, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // ══ the tape: a run of light over the globe, a little behind it and so a little soft
    const formOn = f.on(0.4, 0.45);
    {
      const a0 = 30 * DEG;
      const a1 = 150 * DEG;
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        fp(a1 - ((a1 - a0) * i) / 20, 1.16, 0.25);
        if (i) ctx.lineTo(X, Y);
        else ctx.moveTo(X, Y);
      }
      ctx.strokeStyle = pal.key;
      ctx.globalAlpha = (0.07 + 0.05 * wake) * formOn;
      ctx.lineWidth = Math.max(3, rpx * 0.035);
      ctx.stroke();
      const d = s.dash;
      const turn = t * 0.018 + s.spin * 0.25;
      const at = dice(nPrint, 9) * 0.6 + 0.2;
      ctx.lineWidth = Math.max(1.6, rpx * 0.016);
      for (let i = 0; i < d.length / 3; i++) {
        const u = (((d[i * 3] + turn) % 1) + 1) % 1;
        const edge = sm(u * 7) * sm((1 - u - d[i * 3 + 1]) * 7);
        if (edge <= 0.02) continue;
        fp(a1 - (a1 - a0) * u, 1.16, 0.25);
        const x0 = X;
        const y0 = Y;
        fp(a1 - (a1 - a0) * (u + d[i * 3 + 1]), 1.16, 0.25);
        // a run of the tape prints bright as it passes
        const hot = pPrint >= 0 ? clamp(1 - Math.abs(u - at - (pPrint - 0.5) * 0.5) / 0.1) * Math.sin(PI * pPrint) : 0;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(X, Y);
        ctx.strokeStyle = d[i * 3 + 2] > 0.5 ? pal.key : HUE.air;
        if (hot > 0.02) {
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = hot * 0.3 * edge * formOn;
          ctx.lineWidth *= 4;
          ctx.stroke();
          ctx.lineWidth /= 4;
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = pal.ink;
        }
        ctx.globalAlpha = Math.min(1, (0.7 + 0.25 * wake + hot) * edge * formOn);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ══ the globe
    const cph = Math.cos(phi);
    const sph = Math.sin(phi);
    // its air: a halo that is brightest toward the sun
    ctx.globalCompositeOperation = "lighter";
    g = ctx.createRadialGradient(CX + cph * rpx * 0.1 * sside, CY + sph * rpx * 0.1 * sside, rpx * 0.9, CX, CY, rpx * 1.22);
    g.addColorStop(0, rgba(HUE.air, 0.55 * globeOn));
    g.addColorStop(0.3, rgba(HUE.mist, 0.18 * globeOn));
    g.addColorStop(1, rgba(HUE.mist, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(CX, CY, rpx * 1.22, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    // a solid body: the night ocean, and what passes behind it is hidden
    ctx.beginPath();
    ctx.arc(CX, CY, rpx, 0, TAU);
    ctx.fillStyle = rgba(HUE.deep, globeOn);
    ctx.fill();
    g = ctx.createRadialGradient(CX, CY, rpx * 0.2, CX, CY, rpx);
    g.addColorStop(0, rgba(HUE.ocean, 0.07 * globeOn));
    g.addColorStop(0.8, rgba(HUE.ocean, 0.12 * globeOn));
    g.addColorStop(1, rgba(HUE.air, 0.26 * globeOn));
    ctx.fillStyle = g;
    ctx.fill();
    // the day side: from the terminator to the limb that faces the sun
    const dayShape = new Path2D();
    dayShape.arc(CX, CY, rpx, phi - PI / 2, phi + PI / 2);
    dayShape.ellipse(CX, CY, rpx * Math.abs(stv), rpx, phi, PI / 2, PI * 1.5, stv < 0);
    dayShape.closePath();
    g = ctx.createLinearGradient(CX - cph * rpx * stv, CY - sph * rpx * stv, CX + cph * rpx, CY + sph * rpx);
    g.addColorStop(0, rgba(HUE.ocean, 0.55 * globeOn));
    g.addColorStop(0.55, rgba(HUE.ocean, 0.95 * globeOn));
    g.addColorStop(1, rgba(HUE.air, 0.75 * globeOn));
    ctx.fillStyle = g;
    ctx.fill(dayShape);

    // the graticule, very quietly, on the near side only
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
    ctx.strokeStyle = HUE.air;
    ctx.globalAlpha = (0.1 + 0.06 * wake) * globeOn;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // the land: filled, in shade on the night side and lit on the day side
    const land = new Path2D();
    landPath(land, rpx);
    ctx.fillStyle = rgba(HUE.shade, 0.9 * globeOn);
    ctx.fill(land);
    ctx.save();
    ctx.clip(dayShape);
    g = ctx.createLinearGradient(CX - cph * rpx * stv, CY - sph * rpx * stv, CX + cph * rpx, CY + sph * rpx);
    g.addColorStop(0, rgba(HUE.warm, 0.8 * globeOn));
    g.addColorStop(0.16, rgba(HUE.land, 0.84 * globeOn));
    g.addColorStop(1, rgba(HUE.land, 0.94 * globeOn));
    ctx.fillStyle = g;
    ctx.fill(land);
    ctx.restore();
    ctx.strokeStyle = HUE.air;
    ctx.globalAlpha = 0.3 * globeOn;
    ctx.lineWidth = 1;
    ctx.stroke(land);
    ctx.globalAlpha = 1;

    // the scanning light: a meridian that crosses the globe and lights the land it passes
    ctx.globalCompositeOperation = "lighter";
    if (pScan >= 0) {
      const scanLon = s.lon - 105 + pScan * 210;
      const scanK = Math.sin(PI * pScan) * globeOn;
      const e = s.e;
      const n = e.length / 4;
      const k = D * ZOOM * UU * R;
      const dot = clamp(rpx / 150, 0.7, 1.3);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const dl = wrap(e[i * 4 + 3] - scanLon);
        if (dl > 1.5 || dl < -16) continue;
        const ex = e[i * 4];
        const ey = e[i * 4 + 1];
        const ez = e[i * 4 + 2];
        const zc = m6 * ex + m7 * ey + m8 * ez;
        if (-zc < HOR) continue;
        const sc = k / (zc * R + D);
        const h = dot * (0.5 - 0.9 * zc) * (1 + dl / 18);
        ctx.rect(CX + (m0 * ex + m1 * ey + m2 * ez) * sc - h, CY - (m3 * ex + m4 * ey + m5 * ez) * sc - h, h * 2, h * 2);
      }
      ctx.fillStyle = pal.ink;
      ctx.globalAlpha = 0.7 * scanK;
      ctx.fill();
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
      ctx.strokeStyle = HUE.mist;
      bloom(ctx, 0.5 * scanK, 1);
    }
    // the terminator, warm; and an aurora along it: curtains of light standing off the surface
    ctx.beginPath();
    ctx.ellipse(CX, CY, rpx * Math.abs(stv), rpx, phi, PI / 2, PI * 1.5, stv < 0);
    ctx.strokeStyle = HUE.warm;
    bloom(ctx, (0.55 + 0.25 * wake) * globeOn, Math.max(1.2, rpx * 0.012));
    {
      const hl = Math.hypot(sux, suz) || 1;
      const ax = -suz / hl;
      const az = sux / hl;
      const bx = suy * az;
      const by = suz * ax - sux * az;
      const bz = -suy * ax;
      const n = lite ? 26 : 64;
      ctx.lineWidth = Math.max(1.6, rpx * 0.02);
      for (let i = 0; i < n; i++) {
        const th = (i / n) * TAU;
        const c = Math.cos(th);
        const d = Math.sin(th);
        const ex = ax * c + bx * d;
        const ey = by * d;
        const ez = az * c + bz * d;
        gp(ex, ey, ez, 1);
        if (F < HOR) continue;
        const x0 = X;
        const y0 = Y;
        const shimmer = 0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.7 + 2 * Math.sin(t * 0.4 + i * 0.6));
        gp(ex, ey, ez, 1.025 + 0.075 * shimmer);
        ctx.strokeStyle = i % 3 === 0 ? HUE.mist : i % 3 === 1 ? HUE.open : HUE.ask;
        ctx.globalAlpha = (0.04 + 0.2 * shimmer) * globeOn * (0.6 + 0.4 * wake);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(X, Y);
        ctx.stroke();
      }
    }
    // the rim: glass is brightest where it turns away from the viewer, and most of all toward the sun
    ctx.globalAlpha = 1;
    g = ctx.createRadialGradient(CX, CY, rpx * 0.74, CX, CY, rpx);
    g.addColorStop(0, rgba(HUE.air, 0));
    g.addColorStop(1, rgba(HUE.air, 0.42 * globeOn));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(CX, CY, rpx, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CX, CY, rpx, phi - 1.25, phi + 1.25);
    ctx.strokeStyle = HUE.air;
    bloom(ctx, (0.75 + 0.2 * wake) * (0.35 + 0.65 * sside) * globeOn, Math.max(1.3, rpx * 0.011));
    // the sun's glint on the glass, at the point where it stands overhead
    gp(sux, suy, suz, 1);
    if (F > HOR + 0.05) {
      const k = sm((F - HOR) / 0.5) * globeOn;
      const gx0 = X;
      const gy0 = Y;
      const gr = rpx * 0.62;
      g = ctx.createRadialGradient(gx0, gy0, 0, gx0, gy0, gr);
      g.addColorStop(0, rgba(pal.ink, 0.3 * k));
      g.addColorStop(0.2, rgba(HUE.air, 0.16 * k));
      g.addColorStop(1, rgba(HUE.air, 0));
      ctx.save();
      ctx.beginPath();
      ctx.arc(CX, CY, rpx, 0, TAU);
      ctx.clip();
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(gx0 - gr, gy0 - gr, gr * 2, gr * 2);
      ctx.restore();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // ── the centres: where each stands on screen, and which one the pointer is nearest (on the globe,
    // or on its row of the timeline)
    let cand = tlRow >= 0 && tlRow < NC ? tlRow : -1;
    let best = !f.mobile && lettering ? rpx * 0.36 : 0;
    for (let i = 0; i < NC; i++) {
      gp(CV[i * 3], CV[i * 3 + 1], CV[i * 3 + 2], 1);
      s.px[i] = X;
      s.py[i] = Y;
      s.pf[i] = F;
      if (F < HOR + 0.04 || f.hover < 0.3 || pd > 1.06 || inTl) continue;
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
    /** markers are drawn for a globe of some size and shrink with a small one */
    const mk = clamp(rpx / 170, 0.5, 1.1);

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
      ctx.strokeStyle = s.open[pulseAt] ? HUE.open : HUE.gold;
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
        bloom(ctx, pulseK * (ring ? 0.3 : 0.8) * globeOn, ring ? 1 : 1.4);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    // ── flows between centres that are open together
    const seg = f.q < 0.75 ? Math.round(s.seg * 0.7) : s.seg;
    const burst = pBurst >= 0 && s.npair > 0 ? Math.floor(dice(nBurst, 21) * s.npair) : -1;
    const trail = lite ? 5 : 9;
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
      const lit = (0.5 + 0.25 * wake + 0.3 * mine + (p === burst ? 0.25 * Math.sin(PI * pBurst) : 0)) * quiet * globeOn;
      ctx.strokeStyle = HUE.deep;
      ctx.globalAlpha = 0.3 * lit;
      ctx.lineWidth = (4.5 + 2 * mine) * mk;
      ctx.stroke();
      ctx.strokeStyle = HUE.open;
      ctx.globalAlpha = Math.min(1, lit * 1.15);
      ctx.lineWidth = 1.3 + 0.6 * mine;
      ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = lit * 0.3;
      ctx.stroke();
      // couriers: light travelling the arc, each with its trail
      const back = p & 1;
      const count = still ? 1 : 1 + (wake > 0.5 || mine > 0.5 ? 1 : 0) + (p === burst ? 5 : 0);
      for (let c = 0; c < count; c++) {
        let h: number;
        let size = 1.5 * Math.max(0.7, mk);
        if (c >= count - (p === burst ? 5 : 0)) {
          // the burst: five in close order, quickly
          h = pBurst * 1.45 - (c - (count - 5)) * 0.09;
          size *= 1.35;
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
          if (m === 0) spark(f, x, y, size, 0.95 * quiet * globeOn, HUE.open);
          else {
            ctx.globalAlpha = 0.5 * fade * fade * quiet * globeOn;
            ctx.fillStyle = HUE.up;
            ctx.beginPath();
            ctx.arc(x, y, size * (0.35 + 0.6 * fade), 0, TAU);
            ctx.fill();
          }
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = 1;

    // ── the centres themselves: a lamp for each, and, on the night side, the lights of the city
    let nb = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < NC; i++) {
        const st = s.st[i];
        if ((st.state === "open") !== (pass === 0) || s.pf[i] < HOR + 0.02) continue;
        const x = s.px[i];
        const y = s.py[i];
        const depth = (0.5 + 0.5 * sm((s.pf[i] - HOR) / 0.5)) * globeOn;
        const open = st.state === "open";
        const tone = open ? HUE.open : st.state === "closed" ? pal.ink2 : HUE.gold;
        const mine = i === sel ? s.selK : 0;
        if (!s.lit[i]) {
          // night there: the city's own lights
          const twinkle = still ? 0.8 : 0.72 + 0.28 * Math.sin(t * 2.3 + i * 2.1);
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = HUE.warm;
          ctx.globalAlpha = 0.22 * depth * twinkle;
          ctx.beginPath();
          ctx.arc(x, y, 10 * mk, 0, TAU);
          ctx.fill();
          ctx.fillStyle = HUE.city;
          ctx.globalAlpha = 0.9 * depth;
          ctx.beginPath();
          for (let q = 0; q < 9; q++) {
            const qa = f.rnd(i * 13 + q + 500) * TAU;
            const qr = (2.5 + 8 * f.rnd(i * 13 + q + 520)) * mk;
            const on = still ? 1 : 0.55 + 0.45 * Math.sin(t * (1.3 + q * 0.37) + q * 2.1 + i);
            ctx.moveTo(x + Math.cos(qa) * qr + 1, y + Math.sin(qa) * qr * 0.8);
            ctx.arc(x + Math.cos(qa) * qr, y + Math.sin(qa) * qr * 0.8, (0.6 + 0.7 * on) * Math.max(0.7, mk), 0, TAU);
          }
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
        }
        // its session has just changed state (on the real timetable): a soft bloom opens from it
        const born = (t - s.turned[i]) / 4;
        if (born >= 0 && born < 1) {
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = tone;
          ctx.beginPath();
          ctx.arc(x, y, (6 + 52 * born) * mk, 0, TAU);
          bloom(ctx, (1 - born) * (1 - born) * 0.9 * depth, 1.5);
          ctx.globalCompositeOperation = "source-over";
        }
        // the travelling pulse lights each centre as it passes
        let flash = 0;
        if (pulseAt >= 0 && i !== pulseAt) {
          const ang = Math.acos(clamp(CV[i * 3] * CV[pulseAt * 3] + CV[i * 3 + 1] * CV[pulseAt * 3 + 1] + CV[i * 3 + 2] * CV[pulseAt * 3 + 2], -1, 1));
          flash = clamp(1 - Math.abs(ang - pulseR) / 0.2) * pulseK;
        } else if (i === pulseAt) flash = clamp(1 - pPulse * 4);
        if (open || flash > 0.02 || mine > 0.02) {
          const breathe = still ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.9 + i * 1.7);
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = open ? HUE.open : HUE.gold;
          ctx.globalAlpha = (open ? 0.2 + 0.12 * breathe : 0) * depth + 0.3 * flash + 0.14 * mine;
          ctx.beginPath();
          ctx.arc(x, y, (10 + 5 * flash + 3 * mine) * mk, 0, TAU);
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
          if (open) {
            ctx.strokeStyle = HUE.open;
            ctx.globalAlpha = depth * (0.5 - 0.38 * breathe);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y, (5 + 7 * breathe) * mk, 0, TAU);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = depth;
        ctx.beginPath();
        ctx.arc(x, y, (3.2 + flash) * mk, 0, TAU);
        if (st.state === "closed") {
          ctx.fillStyle = HUE.deep;
          ctx.fill();
          ctx.strokeStyle = flash > 0.05 ? pal.ink : s.lit[i] ? pal.ink : HUE.city;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          ctx.fillStyle = tone;
          ctx.fill();
          ctx.fillStyle = pal.ink;
          ctx.globalAlpha = depth * 0.85;
          ctx.beginPath();
          ctx.arc(x, y, 1.2 * mk, 0, TAU);
          ctx.fill();
        }
        if (mine > 0.02) {
          // a reticle on the centre that is being read out
          ctx.strokeStyle = HUE.gold;
          ctx.globalAlpha = 0.9 * mine;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, 8.5 * Math.max(0.7, mk), t * 0.8, t * 0.8 + TAU * 0.78);
          ctx.stroke();
        }
        // names where the globe is large enough for them; their local times resolve as it wakes
        if (!named || s.pf[i] < 0.3) continue;
        const name = st.centre.city;
        const tw = s.tw[i];
        const lx = x >= CX ? x + 10 : x - 10 - tw;
        const BX = s.boxes;
        let clash = false;
        for (let k = 0; k < nb; k++) if (lx - 3 < BX[k * 4 + 2] && lx + tw + 3 > BX[k * 4] && y - 13 < BX[k * 4 + 3] && y + 13 > BX[k * 4 + 1]) clash = true;
        if (clash) continue;
        BX[nb * 4] = lx - 3;
        BX[nb * 4 + 1] = y - 13;
        BX[nb * 4 + 2] = lx + tw + 3;
        BX[nb * 4 + 3] = y + 13;
        nb++;
        text(f, name, lx, y - 5, 11, pal.ink, (open ? 0.95 : 0.62 + 0.25 * wake) * depth, "left", 600, false, true);
        text(f, part(st.local.label, wake * 1.4), lx, y + 7, 10, pal.ink2, 0.9 * wake * depth * shown(y), "left", 500, false, true);
      }
    }
    ctx.globalAlpha = 1;

    // ── a flare where the terminator meets the limb: first light
    const flare = sside * globeOn * (0.6 + 0.25 * wake + (still ? 0.1 : 0.12 * Math.sin(t * 0.6)));
    if (flare > 0.02) {
      const up = Math.sin(phi - PI / 2) < Math.sin(phi + PI / 2) ? phi - PI / 2 : phi + PI / 2;
      const fx = CX + Math.cos(up) * rpx;
      const fy = CY + Math.sin(up) * rpx;
      const len = rpx * (lite ? 0.4 : 0.6) * (0.75 + 0.25 * wake);
      ctx.globalCompositeOperation = "lighter";
      g = ctx.createRadialGradient(fx, fy, 0, fx, fy, rpx * 0.5);
      g.addColorStop(0, rgba(pal.ink, 0.6 * flare));
      g.addColorStop(0.12, rgba(HUE.warm, 0.4 * flare));
      g.addColorStop(0.4, rgba(HUE.warm, 0.1 * flare));
      g.addColorStop(1, rgba(HUE.warm, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(fx, fy, rpx * 0.5, 0, TAU);
      ctx.fill();
      // the streak, split a little into its colours
      g = ctx.createLinearGradient(fx - len, fy, fx + len, fy);
      g.addColorStop(0, rgba(pal.ink, 0));
      g.addColorStop(0.5, rgba(pal.ink, 0.85 * flare));
      g.addColorStop(1, rgba(pal.ink, 0));
      for (let k = -1; k <= 1; k++) {
        ctx.strokeStyle = k ? (k < 0 ? HUE.warm : HUE.air) : g;
        ctx.globalAlpha = k ? 0.22 * flare : 1;
        ctx.lineWidth = k ? 1 : 1.2;
        ctx.beginPath();
        ctx.moveTo(fx - len * (k ? 0.5 : 1), fy + k * 1.6);
        ctx.lineTo(fx + len * (k ? 0.5 : 1), fy + k * 1.6);
        ctx.stroke();
      }
      spark(f, fx, fy, 1.9 * Math.max(0.7, mk), Math.min(1, flare * 1.3), HUE.warm);
      // two ghosts on the line through the centre, as a lens makes them
      ctx.strokeStyle = HUE.air;
      ctx.lineWidth = 1;
      for (let k = 0; k < 2; k++) {
        const along = k ? 1.36 : 0.52;
        ctx.globalAlpha = (k ? 0.16 : 0.1) * flare;
        ctx.beginPath();
        ctx.arc(fx + (CX - fx) * along, fy + (CY - fy) * along, (k ? 9 : 5) * mk, 0, TAU);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    // ══ a comet circles the globe, just off its air
    if (pComet >= 0 && formOn > 0.5) {
      const head = dice(nComet, 41) * TAU - pComet * TAU * 1.2;
      const env = Math.pow(Math.sin(PI * pComet), 0.5);
      const n = lite ? 16 : 30;
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = pal.key;
      fp(head, 1.075, 0);
      let x0 = X;
      let y0 = Y;
      const hx = X;
      const hy = Y;
      for (let k = 1; k <= n; k++) {
        fp(head + k * (1.05 / n), 1.075, 0);
        const fade = 1 - k / (n + 1);
        ctx.globalAlpha = env * fade * fade * 0.2;
        ctx.lineWidth = (2 + 8 * fade) * mk;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(X, Y);
        ctx.stroke();
        ctx.globalAlpha = env * Math.pow(fade, 1.5) * 0.95;
        ctx.lineWidth = (0.7 + 2.8 * fade) * mk;
        ctx.stroke();
        x0 = X;
        y0 = Y;
      }
      spark(f, hx, hy, 2.3 * Math.max(0.7, mk), env, pal.key);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    // ══ the depth ladder: two fins of light that face each other across the globe, nearer the viewer
    // than it is. Each level is a bar; the levels grow away from the middle, and breathe.
    {
      const NL = lite ? 3 : 4;
      const step = 0.6 / NL;
      const side = dice(nSweep, 51) > 0.5 ? 1 : 0;
      const finLevel = onFin ? Math.round((CY - f.my) / (step * rpx)) : 99;
      const finSide = f.mx > CX ? 1 : 0;
      for (let k2 = 0; k2 < 2; k2++) {
        const sgn = k2 ? 1 : -1;
        fp(k2 ? 0 : PI, 1.17, -0.25);
        const gx0 = X;
        fp(k2 ? 0 : PI, 1.58, -0.25);
        g = ctx.createLinearGradient(gx0, 0, X, 0);
        g.addColorStop(0, rgba(k2 ? HUE.ask : HUE.bid, 0.95));
        g.addColorStop(0.55, rgba(k2 ? HUE.ask : HUE.bid, 0.42));
        g.addColorStop(1, rgba(k2 ? HUE.ask : HUE.bid, 0.02));
        for (let k = -NL; k <= NL; k++) {
          const y = k * step;
          const inner = Math.sqrt(1.17 * 1.17 - y * y);
          const far = Math.abs(k) / NL;
          let len = (0.3 + 0.7 * Math.pow(far, 0.8)) * (still ? 0.72 + 0.28 * f.rnd(k + k2 * 20 + 310) : 0.74 + 0.26 * Math.sin(t * (0.5 + 0.6 * f.rnd(k + k2 * 20 + 310)) + f.rnd(k + k2 * 20 + 350) * TAU));
          let flash = 0;
          if (pSweep >= 0 && k2 === side) {
            // the sweep takes each level as it passes, and the level refills behind it
            const gone = pSweep * 1.5 - far * 0.9;
            if (gone > 0) {
              const back = clamp(gone / 0.5);
              len *= 0.14 + 0.86 * back * back;
              flash = (1 - back) * (1 - back);
            }
          }
          const near = onFin && finSide === k2 && k === finLevel ? onFin : 0;
          len = Math.min(1, len * (0.74 + 0.26 * wake) * (1 + 0.25 * near)) * 0.4 * formOn;
          const z = -0.25 - near * 0.05;
          // a blade: broad where it leaves the globe's air, drawn out to a fine edge
          const h = step * 0.21 * R;
          ctx.beginPath();
          pr(sgn * inner * R, y * R - h, z);
          ctx.moveTo(X, Y);
          pr(sgn * (inner + len) * R, y * R - h * 0.16, z);
          ctx.lineTo(X, Y);
          pr(sgn * (inner + len) * R, y * R + h * 0.16, z);
          ctx.lineTo(X, Y);
          pr(sgn * inner * R, y * R + h, z);
          ctx.lineTo(X, Y);
          ctx.closePath();
          ctx.fillStyle = g;
          ctx.globalAlpha = Math.min(1, (0.6 + 0.3 * wake + 0.4 * near) * formOn);
          ctx.fill();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = (0.22 + 0.2 * wake) * formOn;
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
          if (flash > 0.05 || near > 0.05) {
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = HUE.gold;
            ctx.globalAlpha = Math.min(1, 0.6 * flash + 0.5 * near) * formOn;
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // ══ the candle ribbon: candles standing on an arc under the globe, moving along it
    {
      const a0 = 215 * DEG;
      const a1 = 325 * DEG;
      const M = lite ? 15 : 26;
      const da = (a1 - a0) / M;
      const run = still ? 40.6 : t * 0.42;
      const n0 = Math.floor(run);
      const fr = run - n0;
      /** the ribbon's line: a few slow waves and a little grain. It is a drawing, and it carries no scale. */
      const val = (n: number) => 0.5 + 0.2 * Math.sin(n * 0.23 + 1.3) + 0.13 * Math.sin(n * 0.61 + 4.1) + 0.07 * Math.sin(n * 1.43 + 0.7) + 0.06 * (dice(n, 61) - 0.5);
      const canA = onCan ? pang + TAU : -9;
      const lit = (0.7 + 0.3 * wake) * formOn;
      // the arc they stand on, as a soft light
      ctx.beginPath();
      for (let i = 0; i <= 18; i++) {
        fp(a0 + ((a1 - a0) * i) / 18, 1.13, -0.12);
        if (i) ctx.lineTo(X, Y);
        else ctx.moveTo(X, Y);
      }
      ctx.strokeStyle = pal.key;
      ctx.globalAlpha = 0.1 * lit;
      ctx.lineWidth = Math.max(3, rpx * 0.03);
      ctx.stroke();
      // wicks, the rising bodies, the falling bodies; then the candle under the pointer, in champagne
      for (let pass = 0; pass < (onCan > 0.02 ? 4 : 3); pass++) {
        ctx.beginPath();
        for (let j = 0; j <= M; j++) {
          const n = n0 - (M - j);
          const a = a0 + (j - fr + 0.5) * da;
          if (a < a0 + da * 0.3 || a > a1 - da * 0.3) continue;
          // toward either end of the arc the candles settle onto it
          const ef = sm((a - a0) / (da * 2.6)) * sm((a1 - a) / (da * 1.4));
          const o = val(n);
          const grow = j === M ? fr : 1;
          const c = o + (val(n + 1) - o) * grow;
          const rise = c >= o;
          if (pass === 1 ? !rise : pass === 2 ? rise : false) continue;
          const near = onCan * clamp(1 - Math.abs(a - canA) / (da * 1.2));
          if (pass === 3 && near < 0.34) continue;
          const r0 = 1.16 + (0.5 + (Math.min(o, c) - 0.5) * ef) * 0.27;
          const r1 = Math.max(r0 + 0.014, 1.16 + (0.5 + (Math.max(o, c) - 0.5) * ef) * 0.27);
          const z = -0.12 - near * 0.06;
          if (pass === 0) {
            if (!fp(a, r0 - grow * ef * (0.01 + 0.035 * dice(n, 63)), z)) continue;
            ctx.moveTo(X, Y);
            fp(a, r1 + grow * ef * (0.01 + 0.035 * dice(n, 62)), z);
            ctx.lineTo(X, Y);
          } else {
            fp(a - da * 0.34, r0, z);
            ctx.moveTo(X, Y);
            fp(a + da * 0.34, r0, z);
            ctx.lineTo(X, Y);
            fp(a + da * 0.34, r1, z);
            ctx.lineTo(X, Y);
            fp(a - da * 0.34, r1, z);
            ctx.lineTo(X, Y);
            ctx.closePath();
          }
        }
        if (pass === 0) {
          ctx.strokeStyle = pal.ink;
          ctx.globalAlpha = 0.7 * lit;
          ctx.lineWidth = Math.max(1, rpx * 0.007);
          ctx.stroke();
        } else {
          ctx.fillStyle = pass === 1 ? HUE.up : pass === 2 ? HUE.down : HUE.gold;
          ctx.globalAlpha = (pass === 2 ? 0.85 : 1) * lit;
          ctx.fill();
          if (pass === 1) {
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = 0.3 * lit;
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";
          }
        }
      }
      if (onCan > 0.02 && canA > a0 && canA < a1) {
        // a hairline follows the pointer through the ribbon
        fp(canA, 1.1, -0.18);
        ctx.beginPath();
        ctx.moveTo(X, Y);
        fp(canA, 1.46, -0.18);
        ctx.lineTo(X, Y);
        ctx.strokeStyle = HUE.gold;
        ctx.globalAlpha = 0.85 * onCan;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // what these three are, said once, as the scene wakes
      if (lettering && tower && wake > 0.02) {
        const ny = b.y + H - band1 - 9;
        text(f, part("TAPE · LADDER · CANDLES", wake * 1.3), b.x + inset + 2, ny - 10, 8, pal.ink2, 0.85 * wake * shown(ny));
        text(f, part("ILLUSTRATION", wake * 1.3), b.x + inset + 2, ny, 8, pal.ink3, 0.85 * wake * shown(ny));
      }
    }

    // ══ dust between the viewer and the instrument, in the field's own scale
    UU = fieldU;
    motes(f, s, true, f.boot, -1e6);
    UU = unit;

    // ══ the words. In a tall frame they stand in the band over the globe, the clock to the left and
    // the counts to the right; in a wide one they are a column beside it.
    const hours = f.now.getUTCHours();
    const minutes = f.now.getUTCMinutes();
    const wordsOn = f.on(0.5, 0.4);
    const bright = 0.82 + 0.18 * wake;
    const ax = tower ? b.x + inset + 2 : colX;
    const ay = b.y + inset + (lettering ? 9 : 7);
    const big = tower ? clamp(band0 * 0.24, 15, 22) : lettering ? 18 : 14;
    const small = !lettering ? 8 : tower && W >= 600 ? 10 : 9;
    const k = sm(s.selK);
    // (a frame with no room for words carries the globe alone)
    if (tower || colW >= 96) {
      // the clock, and the FX sessions open now
      text(f, `${WEEK[f.now.getUTCDay()]} ${pad(hours)}:${pad(minutes)}`, ax, ay + 2, big, pal.ink, 0.95 * wordsOn, "left", 500, true);
      ctx.font = `500 ${big}px ${pal.display}`;
      text(f, "UTC", ax + ctx.measureText(`${WEEK[f.now.getUTCDay()]} ${pad(hours)}:${pad(minutes)}`).width + 6, ay + 4, 8, pal.ink3, 0.9 * wordsOn);
      // on the timeline the pointer reads an hour: the reading takes the place of the FX line
      let reading = "";
      let readingNames = "";
      if (inTl > 0.02) {
        const m = clamp(((f.mx - axX) / axW) * SPAN - PAST + since, -PAST, SPAN - PAST);
        const at = Math.round((hours * 60 + minutes + m - since) / 5) * 5;
        reading = `${clockOf(at)} UTC`;
        for (let i = 0; i < 4; i++) for (let j = 0; j < s.nfx[i]; j++) if (m >= s.fxb[i * 6 + j * 2] && m < s.fxb[i * 6 + j * 2 + 1]) readingNames += (readingNames ? " × " : "") + fxSessions[i].name.toUpperCase();
        if (!readingNames) readingNames = "BETWEEN FX SESSIONS";
      }
      const fy = ay + big * 0.62 + ls * 0.75;
      pair(f, inTl > 0.02 ? reading : "FX", inTl > 0.02 ? readingNames : s.fxWords, ax, fy, small, inTl > 0.02 ? pal.ink : pal.ink3, HUE.gold, bright * wordsOn);

      // the counts; or, while a centre is under the pointer, that centre read out
      const rightSide = tower;
      const bx = tower ? b.x + W - inset - 2 : colX;
      let by = tower ? ay : fy + ls * 1.25;
      const idle = (1 - k) * bright * wordsOn;
      if (idle > 0.01) {
        if (H >= 160) {
          // the region that carries the day
          let rx = bx;
          const lit = f.region === "asia" ? 0 : f.region === "europe" ? 1 : f.region === "americas" ? 2 : -1;
          ctx.font = `600 8px ${pal.font}`;
          for (let q = 0; q < 3; q++) {
            const r = rightSide ? 2 - q : q;
            const on = r === lit;
            const w = ctx.measureText(REGIONS[r]).width;
            const dotX = rightSide ? rx - w - 6 : rx + 2;
            ctx.globalAlpha = (on ? 1 : 0.45) * idle;
            ctx.fillStyle = on ? pal.key : pal.ink3;
            ctx.beginPath();
            ctx.arc(dotX, by, on ? 2.4 : 1.6, 0, TAU);
            ctx.fill();
            text(f, REGIONS[r], rightSide ? rx : rx + 8, by, 8, on ? pal.ink : pal.ink3, (on ? 0.95 : 0.55) * idle, rightSide ? "right" : "left");
            rx += (rightSide ? -1 : 1) * (w + 18);
          }
          by += ls;
        }
        pair(f, "OPEN NOW", `${s.nopen} OF ${NC}`, bx, by, small, pal.ink3, s.nopen ? HUE.open : pal.ink, idle, rightSide);
        pair(f, "IN DAYLIGHT", `${s.nlit} OF ${NC}`, bx, by + ls, small, pal.ink3, HUE.city, idle, rightSide);
        if (s.nextWords) pair(f, "NEXT OPEN", s.nextWords, bx, by + ls * 2, small, pal.ink3, pal.ink, idle, rightSide);
      }
      if (sel >= 0 && s.st[sel] && k > 0.01) {
        const st = s.st[sel];
        const c = st.centre;
        const ry = tower ? ay : fy + ls * 1.25;
        const tone = st.state === "open" ? HUE.open : st.state === "closed" ? pal.ink2 : HUE.gold;
        const state = st.state === "open" ? "Regular session open" : st.state === "lunch" ? "Midday break" : st.state === "pre" ? "Pre-open" : "Regular session closed";
        const off = s.off[sel];
        const zone = `UTC${off < 0 ? "-" : "+"}${Math.floor(Math.abs(off) / 60)}${Math.abs(off) % 60 ? ":" + pad(Math.abs(off) % 60) : ""}`;
        const a = k * wordsOn;
        pair(f, c.city.toUpperCase(), `${c.venue} · ${zone}`, bx, ry, 10, pal.ink, pal.ink3, a, rightSide, 700);
        pair(f, part(st.local.label, k * 1.5), "local time", bx, ry + ls * 1.25, 10, pal.ink, pal.ink3, a, rightSide);
        pair(f, part(state, k * 1.3), `${formatDuration(st.nextChangeIn)} ${st.nextLabel}`, bx, ry + ls * 2.35, small, tone, pal.ink2, a, rightSide);
        if (H >= 160) {
          text(f, part(`Hours ${clockOf(c.open)} to ${clockOf(c.close)}${c.lunch ? `, break ${clockOf(c.lunch[0])} to ${clockOf(c.lunch[1])}` : ""}`, k * 1.3), bx, ry + ls * 3.35, small, pal.ink2, 0.92 * a, rightSide ? "right" : "left", 500, false, true);
          text(f, part(`Daylight ${clockOf(s.rise[sel] + off)} to ${clockOf(s.set[sel] + off)}, ${s.lit[sel] ? "sun up" : "sun down"}`, k * 1.3), bx, ry + ls * 4.35, small, HUE.city, 0.85 * a, rightSide ? "right" : "left", 500, false, true);
        }
        // a line of light from the centre to its reading
        if (s.pf[sel] > HOR && tower) {
          const tx = bx - 40;
          const ty = ry + ls * 5.1;
          g = ctx.createLinearGradient(s.px[sel], s.py[sel], tx, ty);
          g.addColorStop(0, rgba(HUE.gold, 0.8 * a));
          g.addColorStop(1, rgba(HUE.gold, 0));
          ctx.strokeStyle = g;
          ctx.globalAlpha = 1;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(s.px[sel], s.py[sel]);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    // ══ the timeline: three hours behind and twenty-one ahead, the centres' regular hours as bars of
    // light, the four FX session windows over them, and the present moment
    if (tlOn) {
      const tlA = f.on(0.65, 0.35);
      const nowX = minuteX(since);
      const thick = clamp(rowH * 0.44, 2, 6);
      // a soft floor of light under it
      g = ctx.createLinearGradient(0, tlY - 6, 0, tlY + tlH);
      g.addColorStop(0, rgba(pal.key, 0));
      g.addColorStop(1, rgba(pal.key, 0.07 * tlA));
      ctx.fillStyle = g;
      ctx.fillRect(b.x, tlY - 6, W, tlH + 6 + inset);
      // the hours, in UTC, every third one named; midnight carries the day
      const first = Math.ceil((hours * 60 + minutes - PAST) / 180) * 180;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 1;
      for (let m = first; m < hours * 60 + minutes - PAST + SPAN; m += 180) {
        const x = axX + ((m - (hours * 60 + minutes) + PAST) / SPAN) * axW;
        if (x < axX + 6 || x > axX + axW - 6) continue;
        const hr = ((m / 60) % 24 + 24) % 24;
        ctx.globalAlpha = 0.3 * tlA;
        ctx.beginPath();
        ctx.moveTo(x, tlY + tlH - 13);
        ctx.lineTo(x, tlY + tlH - 9);
        ctx.stroke();
        text(f, hr === 0 ? WEEK[(f.now.getUTCDay() + Math.floor(m / 1440) + 7) % 7] : pad(hr), x, tlY + tlH - 3, 8, hr === 0 ? pal.ink : pal.ink3, (hr === 0 ? 0.85 : 0.7) * tlA, "center");
      }
      // the FX windows, in two lanes so that an overlap reads as one
      text(f, "FX", tlX, tlY + 5, 8, pal.ink3, 0.8 * tlA);
      ctx.lineCap = "butt";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        for (let j = 0; j < s.nfx[i]; j++) {
          ctx.moveTo(minuteX(s.fxb[i * 6 + j * 2]), tlY + 3 + (i % 2) * 4);
          ctx.lineTo(minuteX(s.fxb[i * 6 + j * 2 + 1]), tlY + 3 + (i % 2) * 4);
        }
        ctx.strokeStyle = FX_HUE[i];
        ctx.globalAlpha = (0.6 + 0.3 * wake) * tlA;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.lineCap = "round";
      // a faint track for every row, so an empty stretch still reads as a timeline
      ctx.beginPath();
      let last = -PAST;
      for (let i = 0; i < NC; i++) {
        ctx.moveTo(axX, rowY + (i + 0.5) * rowH);
        ctx.lineTo(axX + axW, rowY + (i + 0.5) * rowH);
        for (let j = 0; j < s.nbar[i]; j++) last = Math.max(last, s.bars[i * 12 + j * 2 + 1]);
      }
      ctx.strokeStyle = HUE.air;
      ctx.globalAlpha = 0.09 * tlA;
      ctx.lineWidth = 1;
      ctx.stroke();
      // where the window holds no regular session at all (a weekend), it says so, and when the next one opens
      const gapX = minuteX(Math.max(last, since)) + 14;
      if (axX + axW - gapX > 190 && SPAN - PAST - Math.max(last - since, 0) >= 420) {
        const mid = (gapX + axX + axW) / 2;
        text(f, "NO REGULAR SESSIONS IN THESE HOURS", mid, rowY + rowH * 3.6, 8, pal.ink3, 0.85 * tlA, "center");
        if (s.nextWords) pair(f, "NEXT OPEN", s.nextWords, mid - 70, rowY + rowH * 3.6 + Math.max(12, rowH * 1.3), 9, pal.ink3, HUE.gold, 0.95 * tlA);
      }
      // the rows: what is past is dim, what is to come is blue, what is open now is emerald and glows
      for (let pass = 0; pass < 3; pass++) {
        ctx.beginPath();
        for (let i = 0; i < NC; i++) {
          const y = rowY + (i + 0.5) * rowH;
          for (let j = 0; j < s.nbar[i]; j++) {
            const from = s.bars[i * 12 + j * 2];
            const to = s.bars[i * 12 + j * 2 + 1];
            const kind = to <= since ? 0 : from <= since ? 2 : 1;
            if (kind === pass) {
              ctx.moveTo(Math.max(axX, minuteX(from)) + thick / 2, y);
              ctx.lineTo(Math.max(axX + thick, Math.min(axX + axW, minuteX(to)) - thick / 2), y);
            }
          }
        }
        ctx.lineWidth = thick;
        if (pass === 2) {
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = HUE.open;
          ctx.globalAlpha = 0.2 * tlA;
          ctx.lineWidth = thick * 3;
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
          ctx.lineWidth = thick;
          ctx.globalAlpha = 0.95 * tlA;
        } else {
          ctx.strokeStyle = HUE.air;
          ctx.globalAlpha = (pass ? 0.5 + 0.25 * wake : 0.2) * tlA;
        }
        ctx.stroke();
      }
      // a glint runs along the bars that are open now
      if (pGlint >= 0 && s.nopen) {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = thick;
        ctx.beginPath();
        for (let i = 0; i < NC; i++) {
          if (!s.open[i]) continue;
          const y = rowY + (i + 0.5) * rowH;
          for (let j = 0; j < s.nbar[i]; j++) {
            const from = s.bars[i * 12 + j * 2];
            const to = s.bars[i * 12 + j * 2 + 1];
            if (from > since || to <= since) continue;
            const x0 = Math.max(axX, minuteX(from));
            const x1 = Math.min(axX + axW, minuteX(to));
            const x = x0 + (x1 - x0) * pGlint;
            ctx.moveTo(Math.max(x0, x - 9), y);
            ctx.lineTo(Math.min(x1, x + 9), y);
          }
        }
        ctx.globalAlpha = 0.8 * Math.sin(PI * pGlint) * tlA;
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }
      // the names: the city, or its code where the timeline is narrow
      for (let i = 0; i < NC; i++) {
        const y = rowY + (i + 0.5) * rowH;
        const mine = i === sel ? s.selK : 0;
        if (mine > 0.02) {
          ctx.fillStyle = HUE.gold;
          ctx.globalAlpha = 0.1 * mine * tlA;
          ctx.fillRect(tlX - 2, y - rowH / 2, tlW + 4, rowH);
        }
        text(f, tlName > 40 ? centres[i].city : CODES[i], tlX, y + 0.5, Math.min(9, Math.max(7, rowH * 0.82)), mine > 0.5 ? HUE.gold : s.open[i] ? pal.ink : pal.ink3, (s.open[i] ? 0.95 : 0.72) * tlA);
      }
      // the present moment: a line of light through all of it
      g = ctx.createLinearGradient(0, tlY - 4, 0, tlY + tlH - 12);
      g.addColorStop(0, rgba(HUE.gold, 0));
      g.addColorStop(0.2, rgba(HUE.gold, 0.9 * tlA));
      g.addColorStop(1, rgba(HUE.gold, 0.25 * tlA));
      ctx.strokeStyle = g;
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(nowX, tlY - 4);
      ctx.lineTo(nowX, tlY + tlH - 12);
      ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      spark(f, nowX, tlY + 1, 1.8, tlA, HUE.gold);
      ctx.globalCompositeOperation = "source-over";
      text(f, "NOW", nowX, tlY + tlH - 3, 8, HUE.gold, 0.9 * tlA, "center");
      if (inTl > 0.02) {
        // the hour under the pointer
        const x = clamp(f.mx, axX, axX + axW);
        ctx.strokeStyle = pal.ink;
        ctx.globalAlpha = 0.55 * inTl;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, tlY - 2);
        ctx.lineTo(x, tlY + tlH - 12);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (waking && wake > 0.02) {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = pal.key;
      ctx.beginPath();
      ctx.moveTo(b.x, scanY);
      ctx.lineTo(b.x + W, scanY);
      bloom(ctx, 0.7 * Math.sin(PI * clamp(wake * 1.1)), 1);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
    if (tower) {
      // the golden cuts of the frame's height, marked on its sides as the engine marks the cut of its width
      ctx.strokeStyle = rgba(pal.gold, 0.85 * f.boot * (0.5 + f.hover * 0.5));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const y of [b.y + band0, b.y + H - band1]) {
        ctx.moveTo(b.x - 4, y);
        ctx.lineTo(b.x + 5, y);
        ctx.moveTo(b.x + W - 5, y);
        ctx.lineTo(b.x + W + 4, y);
      }
      ctx.stroke();
    }
  },
  /** the engine hit-tests the pointer against this, clips its light to it and draws the champagne frame round it */
  frame: () => (BOXON ? BOX : null),
};

export default scene;

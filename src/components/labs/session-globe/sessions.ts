import { centres, fxSessions } from "@/lib/sessions";

/**
 * The four FX sessions of the session globe, each with the coordinates of the
 * city it is named after. The windows are the conventional ones in
 * lib/sessions (local time of the city, so daylight saving is followed); the
 * coordinates are the ones every other map on this site uses.
 *
 * No Three.js here: the page, the still and the scene all read it.
 */
export const GLOBE_SESSIONS = fxSessions.map((s) => {
  const c = centres.find((x) => x.key === s.key);
  if (!c) throw new Error(`session-globe: no coordinates for ${s.key}`);
  return { ...s, lat: c.lat, lon: c.lon };
});

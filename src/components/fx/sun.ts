/**
 * FOLLOW THE SUN — light by day, dark by night, from the visitor's own clock.
 *
 * An optional fourth choice beside Light, Dark and Auto. Nothing is asked of
 * the visitor and nothing is fetched: there is no location request and no
 * network call. Sunrise and sunset are approximated from three things the
 * browser already knows:
 *
 *   - the date, which gives the sun's declination (how long days are);
 *   - whether the device's time zone keeps daylight-saving time, and in which
 *     half of the year. A zone that puts its clocks forward in July is in the
 *     northern mid-latitudes, one that does so in January is in the southern,
 *     and one that never does is treated as near the equator, where day and
 *     night are about twelve hours all year;
 *   - the clock, with solar noon taken as 12:00 standard time (13:00 while
 *     daylight-saving time is in force).
 *
 * It is an approximation and says so on /preferences: it can be out by an
 * hour or so at the edge of a wide time zone or at a high latitude.
 *
 * Storage: one extra field, `sun`, inside the existing `gx:prefs` entry. No new
 * key, so the privacy list and the reset on /preferences already cover it.
 * `readPrefs` and `writePrefs` carry unknown fields through untouched. The
 * visitor's Light / Dark / Auto choice stays in `theme` and is what applies
 * again the moment "Sun" is switched off. Without the field (every existing
 * visitor) nothing here does anything.
 */
import type { Prefs } from "@/lib/prefs";

/** The preferences, with this module's one extra field. */
export type SunPrefs = Prefs & { sun?: boolean };

/** The mid-latitude assumed for a zone that keeps daylight-saving time, in degrees. */
const MID_LATITUDE = 42;

const RAD = Math.PI / 180;

/** Minutes east of UTC is negative in JavaScript; this is the usual sign: minutes ahead of UTC. */
const ahead = (d: Date) => -d.getTimezoneOffset();

export type SunTimes = {
  /** local clock hours, 0 to 24 */
  rise: number;
  set: number;
  /** the latitude assumed: positive north, negative south, 0 where the zone gives no clue */
  latitude: number;
};

/** Approximate local sunrise and sunset for this moment's date, from the clock and the date alone. */
export function sunTimes(now: Date): SunTimes {
  const year = now.getFullYear();
  const jan = ahead(new Date(year, 0, 1));
  const jul = ahead(new Date(year, 6, 1));
  // clocks forward in July: north; in January: south; never: no seasons assumed
  const latitude = jul > jan ? MID_LATITUDE : jan > jul ? -MID_LATITUDE : 0;
  const dst = (ahead(now) - Math.min(jan, jul)) / 60;

  const day = Math.floor((now.getTime() - new Date(year, 0, 1).getTime()) / 86_400_000) + 1;
  const declination = -23.44 * Math.cos(((2 * Math.PI) / 365) * (day + 10));
  // the hour angle of sunrise: cos H = -tan(latitude) tan(declination)
  const cosH = Math.min(1, Math.max(-1, -Math.tan(latitude * RAD) * Math.tan(declination * RAD)));
  const half = Math.acos(cosH) / RAD / 15;
  const noon = 12 + dst;
  return { rise: noon - half, set: noon + half, latitude };
}

/** Light between the approximate sunrise and sunset, dark otherwise. */
export function sunTheme(now: Date): "light" | "dark" {
  const { rise, set } = sunTimes(now);
  const h = now.getHours() + now.getMinutes() / 60;
  return h >= rise && h < set ? "light" : "dark";
}

/** "06:42" from clock hours. */
export function clockLabel(hours: number): string {
  const total = Math.round((((hours % 24) + 24) % 24) * 60) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Runs before first paint, straight after the preferences script, and only
 * does anything for a visitor who chose "Sun". The same arithmetic as
 * sunTheme(), written out small.
 */
export const SUN_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("gx:prefs")||"{}")||{};if(p.sun!==true)return;var n=new Date(),y=n.getFullYear(),a=-new Date(y,0,1).getTimezoneOffset(),j=-new Date(y,6,1).getTimezoneOffset(),L=j>a?${MID_LATITUDE}:a>j?-${MID_LATITUDE}:0,R=Math.PI/180,D=Math.floor((n-new Date(y,0,1))/864e5)+1,c=-23.44*Math.cos(2*Math.PI/365*(D+10)),H=Math.acos(Math.min(1,Math.max(-1,-Math.tan(L*R)*Math.tan(c*R))))/R/15,N=12+(-n.getTimezoneOffset()-Math.min(a,j))/60,h=n.getHours()+n.getMinutes()/60,s=document.documentElement.dataset;s.theme=h>=N-H&&h<N+H?"light":"dark";s.themePref="sun"}catch(e){}})();`;

import { landField } from "@/components/labs/market-day/earth";
import { GLOBE_SESSIONS } from "@/components/labs/session-globe/sessions";

/**
 * The still that stands where the 3D globe would be: before it has loaded,
 * without JavaScript, and where WebGL is not available. A flat map (all four
 * session cities cannot be seen at once on one side of a globe), drawn on the
 * server from the same land field and the same coordinates. It shows no time
 * and no state: the list beside it carries those.
 */

const W = 720;
const H = 360;
const px = (lon: number) => ((lon + 180) / 360) * W;
const py = (lat: number) => ((90 - lat) / 180) * H;
const n1 = (v: number) => Math.round(v * 10) / 10;

const LAND = (() => {
  const f = landField(5);
  let d = "";
  for (let i = 0; i < f.length; i += 3) {
    const lat = Math.asin(f[i + 1]) * (180 / Math.PI);
    const lon = Math.atan2(f[i], f[i + 2]) * (180 / Math.PI);
    d += `M${n1(px(lon) - 1.6)} ${n1(py(lat) - 1.6)}h3.2v3.2h-3.2z`;
  }
  return d;
})();

const GRID = (() => {
  let d = "";
  for (let lon = -150; lon <= 150; lon += 30) d += `M${px(lon)} 0V${H}`;
  for (let lat = -60; lat <= 60; lat += 30) d += `M0 ${py(lat)}H${W}`;
  return d;
})();

export function SessionGlobeStill() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="A flat map of the world with the four FX session cities marked: Sydney, Tokyo, London and New York." preserveAspectRatio="xMidYMid meet">
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} fill="none" stroke="var(--line-strong)" />
      <path d={GRID} stroke="var(--line)" fill="none" />
      <path d={LAND} fill="var(--ink-3)" opacity="0.55" />
      {GLOBE_SESSIONS.map((s) => {
        const x = px(s.lon);
        const y = py(s.lat);
        const left = x > W * 0.8;
        return (
          <g key={s.key}>
            <circle cx={x} cy={y} r="7" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
            <circle cx={x} cy={y} r="2.2" fill="var(--ink)" />
            <text x={left ? x - 12 : x + 12} y={y + 4} textAnchor={left ? "end" : "start"} fontSize="13" fontWeight="600" fill="var(--ink)" stroke="var(--paper)" strokeWidth="3" paintOrder="stroke">
              {s.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

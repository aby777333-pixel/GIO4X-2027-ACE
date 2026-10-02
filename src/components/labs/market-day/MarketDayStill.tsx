import { centres } from "@/lib/sessions";

/**
 * A still for the film's card on /labs: the globe, the nine centres at their
 * real coordinates, and the 24-hour dial about it. Drawn on the server as SVG,
 * from the same coordinates the film uses. It shows no state and no time: the
 * shaded side is an illustration of day and night, not a reading of the clock,
 * and the caption on the card says what the film itself does.
 */

const W = 520;
const H = 321;
const CX = W / 2;
const CY = H / 2;
const R = 104;
const RD = R * 1.22;
const DEG = Math.PI / 180;
/** the place that faces the viewer */
const LON0 = 62;
const LAT0 = 16;

/** orthographic, as the film: x and y in the picture, z toward the viewer */
function at(lat: number, lon: number): { x: number; y: number; z: number } {
  const a = lat * DEG;
  const b = (lon - LON0) * DEG;
  const x = Math.cos(a) * Math.sin(b);
  const z1 = Math.cos(a) * Math.cos(b);
  const y = Math.sin(a) * Math.cos(LAT0 * DEG) - z1 * Math.sin(LAT0 * DEG);
  const z = Math.sin(a) * Math.sin(LAT0 * DEG) + z1 * Math.cos(LAT0 * DEG);
  return { x: CX + x * R, y: CY - y * R, z };
}
const n1 = (v: number) => Math.round(v * 10) / 10;

/** a line on the globe as an SVG path: only the part that faces the viewer */
function line(points: [number, number][]): string {
  let d = "";
  let pen = false;
  for (const [lat, lon] of points) {
    const p = at(lat, lon);
    if (p.z < 0.02) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${n1(p.x)} ${n1(p.y)}`;
    pen = true;
  }
  return d;
}

const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const GRID = [
  ...range(-180, 150, 30).map((lon) => line(range(-80, 80, 8).map((lat): [number, number] => [lat, lon]))),
  ...range(-60, 60, 30).map((lat) => line(range(-180, 180, 8).map((lon): [number, number] => [lat, lon]))),
].join("");

const DOTS = centres.map((c) => ({ key: c.key, ...at(c.lat, c.lon) })).filter((p) => p.z > 0.05);

const TICKS = range(0, 23, 1)
  .map((hr) => {
    const a = (hr / 24) * Math.PI * 2;
    const len = hr % 6 === 0 ? 9 : 5;
    return `M${n1(CX + Math.sin(a) * RD)} ${n1(CY - Math.cos(a) * RD)}L${n1(CX + Math.sin(a) * (RD - len))} ${n1(CY - Math.cos(a) * (RD - len))}`;
  })
  .join("");

export function MarketDayStill() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full bg-paper" role="presentation" aria-hidden>
      {/* the dial */}
      <circle cx={CX} cy={CY} r={RD} fill="none" stroke="var(--viz-faint)" strokeWidth="1" />
      <path d={TICKS} stroke="var(--viz-stroke)" strokeWidth="1" fill="none" />
      {/* two session windows, as lanes: where they run side by side is an overlap */}
      <path d={`M${n1(CX + Math.sin(1.2) * (RD + 9))} ${n1(CY - Math.cos(1.2) * (RD + 9))}A${RD + 9} ${RD + 9} 0 0 1 ${n1(CX + Math.sin(3.5) * (RD + 9))} ${n1(CY - Math.cos(3.5) * (RD + 9))}`} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
      <path d={`M${n1(CX + Math.sin(2.9) * (RD + 16))} ${n1(CY - Math.cos(2.9) * (RD + 16))}A${RD + 16} ${RD + 16} 0 0 1 ${n1(CX + Math.sin(5.2) * (RD + 16))} ${n1(CY - Math.cos(5.2) * (RD + 16))}`} fill="none" stroke="var(--prestige)" strokeWidth="2.5" strokeLinecap="round" />
      {/* the globe: the whole disc, then the lit side from the terminator to the limb */}
      <circle cx={CX} cy={CY} r={R} fill="var(--surface-2)" />
      <path d={`M${CX} ${CY - R}A${R} ${R} 0 0 1 ${CX} ${CY + R}A${n1(R * 0.38)} ${R} 0 0 1 ${CX} ${CY - R}Z`} fill="var(--accent)" opacity="0.16" />
      <path d={GRID} fill="none" stroke="var(--viz-faint)" strokeWidth="1" />
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--viz-stroke)" strokeWidth="1.25" />
      {DOTS.map((p) => (
        <g key={p.key}>
          <circle cx={n1(p.x)} cy={n1(p.y)} r="6.5" fill="var(--prestige)" opacity="0.22" />
          <circle cx={n1(p.x)} cy={n1(p.y)} r="3" fill="var(--prestige)" stroke="var(--paper)" strokeWidth="1" />
        </g>
      ))}
      {/* the hand */}
      <path d={`M${n1(CX + Math.sin(2.2) * (R + 4))} ${n1(CY - Math.cos(2.2) * (R + 4))}L${n1(CX + Math.sin(2.2) * (RD + 22))} ${n1(CY - Math.cos(2.2) * (RD + 22))}`} stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

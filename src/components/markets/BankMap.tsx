import Link from "next/link";
import type { CentralBank } from "@/data/knowledge";
import { bankHref } from "./graph";

// Equirectangular window: all longitudes, 78°N to 66°S. One SVG unit is one degree.
const LAT_TOP = 78;
const LAT_BOTTOM = -66;
const W = 360;
const H = LAT_TOP - LAT_BOTTOM;
const px = (lon: number) => ((lon + 180) / W) * 100;
const py = (lat: number) => ((LAT_TOP - lat) / H) * 100;

/** Where each label sits relative to its point, chosen by hand so that neighbours never collide. */
const PLACE: Record<string, string> = {
  fed: "right-full top-full mr-5 -mt-3 text-right",
  boc: "left-full bottom-full ml-5 -mb-3",
  boe: "right-full bottom-1/2 mr-8 text-right",
  ecb: "left-full bottom-full ml-5 md:-mb-2",
  snb: "left-full top-full ml-5 md:-mt-2",
  rbi: "left-full top-1/2 ml-8 -translate-y-1/2",
  boj: "right-full top-1/2 mr-8 -translate-y-1/2 text-right",
  rba: "right-full top-1/2 mr-8 -translate-y-1/2 text-right",
  rbnz: "right-0 top-full mt-8 text-right",
};

const MERIDIANS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
const PARALLELS = [60, 30, 0, -30];

/**
 * The nine banks placed by latitude and longitude on a plain graticule.
 * No coastlines and no borders: the grid is the map, and the positions are
 * real. The list beneath carries the same information as text, so the figure
 * is presentational for assistive technology.
 */
export function BankMap({ banks }: { banks: CentralBank[] }) {
  return (
    <figure>
      <div className="relative border border-line bg-paper" style={{ aspectRatio: `${W} / ${H}` }} aria-hidden>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {MERIDIANS.map((m) => (
            <path key={m} d={`M${m + 180} 0V${H}`} stroke={m === 0 ? "var(--viz-stroke)" : "var(--viz-faint)"} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {PARALLELS.map((p) => (
            <path key={p} d={`M0 ${LAT_TOP - p}H${W}`} stroke={p === 0 ? "var(--viz-stroke)" : "var(--viz-faint)"} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {/* graticule labels */}
        {PARALLELS.map((p) => (
          <span key={p} className="num absolute left-3 -translate-y-full text-[0.625rem] text-ink-3" style={{ top: `${py(p)}%` }}>
            {p === 0 ? "Equator" : `${Math.abs(p)}°${p > 0 ? "N" : "S"}`}
          </span>
        ))}
        {[-120, -60, 0, 60, 120].map((m) => (
          <span key={m} className="num absolute top-2 hidden pl-3 text-[0.625rem] text-ink-3 sm:block" style={{ left: `${px(m)}%` }}>
            {m === 0 ? "0°" : `${Math.abs(m)}°${m > 0 ? "E" : "W"}`}
          </span>
        ))}
        {banks.map((b) => (
          <span key={b.slug} className="absolute" style={{ left: `${px(b.lon)}%`, top: `${py(b.lat)}%` }}>
            <span className="absolute -left-[3px] -top-[3px] h-[7px] w-[7px] rounded-full border border-bg bg-accent" />
            <Link href={bankHref(b.slug)} tabIndex={-1} className={`pointer-events-none absolute whitespace-nowrap text-[0.6875rem] font-semibold leading-none tracking-[0.04em] text-ink transition-colors duration-fast hover:text-accent md:pointer-events-auto md:text-xs ${PLACE[b.slug] ?? "left-full ml-5"}`}>
              {b.short}
              <span className="ml-3 hidden font-normal text-ink-3 lg:inline">{b.currency}</span>
            </Link>
          </span>
        ))}
      </div>
      <figcaption className="mt-8 text-xs text-ink-3">The {banks.length} banks at their real coordinates on an equirectangular grid. Positions only: no coastlines, no borders.</figcaption>
    </figure>
  );
}

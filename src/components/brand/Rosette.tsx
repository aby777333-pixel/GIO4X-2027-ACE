/**
 * THE GIO4X ROSETTE — the recurring signature.
 *
 * The logo mark is an eight-fold pinwheel of blades around a single point.
 * This component redraws that geometry procedurally: eight blades, each a
 * pair of arcs whose radii stand in the golden ratio, rotated by 45°. It is
 * NOT a replacement for the logo (the logo is always the supplied asset); it
 * is the motif that appears in loaders, empty states, section openings, the
 * 404 and the AI "thinking" state, so the brand is recognisable without it.
 */
const PHI = 1.618;

type Props = {
  size?: number | string;
  /** number of blades drawn (1–8); fewer blades = "broken" constellation */
  blades?: number;
  /** stroke only (default) or filled blades */
  variant?: "line" | "solid";
  /** slow rotation, used for loading / thinking */
  spin?: boolean;
  /** use the logo gradient instead of currentColor */
  dna?: boolean;
  className?: string;
  title?: string;
  strokeWidth?: number;
};

// One blade in a 100×100 box centred on (50,50), pointing "north".
// Outer edge and inner edge are arcs whose radii relate by φ.
const R_OUT = 46;
const R_IN = R_OUT / PHI / PHI; // ≈ 17.6
const tip = { x: 50, y: 50 - R_OUT };
const base = { x: 50 + R_IN * Math.sin((-58 * Math.PI) / 180), y: 50 - R_IN * Math.cos((-58 * Math.PI) / 180) };
const heel = { x: 50 + (R_IN / PHI) * Math.sin((20 * Math.PI) / 180), y: 50 - (R_IN / PHI) * Math.cos((20 * Math.PI) / 180) };
const f = (n: number) => n.toFixed(2);
const BLADE = `M ${f(base.x)} ${f(base.y)} A ${f(R_OUT)} ${f(R_OUT)} 0 0 1 ${f(tip.x)} ${f(tip.y)} A ${f(R_OUT / PHI)} ${f(R_OUT / PHI)} 0 0 1 ${f(heel.x)} ${f(heel.y)}`;

export function Rosette({ size = 55, blades = 8, variant = "line", spin = false, dna = false, className, title, strokeWidth = 1.25 }: Props) {
  const id = dna ? "gx-dna" : undefined;
  const paint = dna ? `url(#${id})` : "currentColor";
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
    >
      {dna && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--dna-teal)" />
            <stop offset="0.5" stopColor="var(--dna-blue)" />
            <stop offset="1" stopColor="var(--dna-emerald)" />
          </linearGradient>
        </defs>
      )}
      <g style={spin ? { transformOrigin: "50px 50px", animation: "gx-spin 13s linear infinite" } : undefined}>
        {Array.from({ length: 8 }, (_, i) =>
          i < blades ? (
            <path
              key={i}
              d={BLADE}
              transform={`rotate(${i * 45} 50 50)`}
              stroke={paint}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={variant === "solid" ? paint : "none"}
              fillOpacity={variant === "solid" ? 0.12 : undefined}
              vectorEffect="non-scaling-stroke"
            />
          ) : null,
        )}
        <circle cx="50" cy="50" r={R_IN / PHI / PHI} fill={paint} />
      </g>
    </svg>
  );
}

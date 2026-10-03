import type { Mood, Panel, Screen, Who } from "@/data/fun";

/**
 * The cast of the comics, drawn in SVG: the Bull, the Bear and Wick the
 * candle. Flat shapes in the colours of the mark, one expression at a time.
 * `ToonPanel` sets a scene: a screen on the wall, up to two of the cast, and
 * what they say beneath it, as text (so it wraps and can be read aloud).
 */

const NAMES: Record<Who, string> = { bull: "The Bull", bear: "The Bear", wick: "Wick" };

function Face({ mood, x, y, s = 1 }: { mood: Mood; x: number; y: number; s?: number }) {
  // eyes, brows and a mouth, round a centre point
  const e = 9 * s;
  const mouth = {
    happy: `M${x - 9 * s} ${y + 10 * s} Q${x} ${y + 20 * s} ${x + 9 * s} ${y + 10 * s}`,
    smug: `M${x - 8 * s} ${y + 13 * s} Q${x + 2 * s} ${y + 17 * s} ${x + 10 * s} ${y + 9 * s}`,
    worried: `M${x - 8 * s} ${y + 16 * s} Q${x} ${y + 9 * s} ${x + 8 * s} ${y + 16 * s}`,
    flat: `M${x - 7 * s} ${y + 13 * s} L${x + 7 * s} ${y + 13 * s}`,
    shock: "",
  }[mood];
  // worried brows rise toward the middle; the rest are level
  const brow = mood === "worried" ? -3 : 0;
  return (
    <g className="gx-toon-ink">
      <circle cx={x - e} cy={y} r={mood === "shock" ? 4 * s : 2.6 * s} />
      <circle cx={x + e} cy={y} r={mood === "shock" ? 4 * s : 2.6 * s} />
      {mood !== "happy" && mood !== "shock" && (
        <>
          <path d={`M${x - e - 5 * s} ${y - 8 * s - brow} L${x - e + 5 * s} ${y - 8 * s + brow}`} className="gx-toon-line" />
          <path d={`M${x + e - 5 * s} ${y - 8 * s + brow} L${x + e + 5 * s} ${y - 8 * s - brow}`} className="gx-toon-line" />
        </>
      )}
      {mood === "shock" ? <ellipse cx={x} cy={y + 14 * s} rx={4 * s} ry={6 * s} /> : <path d={mouth} className="gx-toon-line" />}
    </g>
  );
}

function Bull({ mood, x }: { mood: Mood; x: number }) {
  return (
    <g>
      <path d={`M${x - 26} 150 Q${x - 30} 104 ${x} 100 Q${x + 30} 104 ${x + 26} 150 Z`} className="gx-toon-bull" />
      <path d={`M${x - 24} 62 Q${x - 44} 54 ${x - 40} 36 Q${x - 32} 52 ${x - 18} 54 Z`} className="gx-toon-horn" />
      <path d={`M${x + 24} 62 Q${x + 44} 54 ${x + 40} 36 Q${x + 32} 52 ${x + 18} 54 Z`} className="gx-toon-horn" />
      <ellipse cx={x} cy={78} rx={30} ry={28} className="gx-toon-bull" />
      <ellipse cx={x} cy={94} rx={17} ry={11} className="gx-toon-muzzle" />
      <Face mood={mood} x={x} y={72} />
      <circle cx={x - 6} cy={93} r={1.8} className="gx-toon-ink" />
      <circle cx={x + 6} cy={93} r={1.8} className="gx-toon-ink" />
    </g>
  );
}

function Bear({ mood, x }: { mood: Mood; x: number }) {
  return (
    <g>
      <path d={`M${x - 30} 150 Q${x - 34} 102 ${x} 98 Q${x + 34} 102 ${x + 30} 150 Z`} className="gx-toon-bear" />
      <circle cx={x - 24} cy={52} r={11} className="gx-toon-bear" />
      <circle cx={x + 24} cy={52} r={11} className="gx-toon-bear" />
      <circle cx={x - 24} cy={52} r={5} className="gx-toon-muzzle" />
      <circle cx={x + 24} cy={52} r={5} className="gx-toon-muzzle" />
      <circle cx={x} cy={76} r={31} className="gx-toon-bear" />
      <ellipse cx={x} cy={90} rx={14} ry={10} className="gx-toon-muzzle" />
      <Face mood={mood} x={x} y={70} />
      <ellipse cx={x} cy={85} rx={4} ry={3} className="gx-toon-ink" />
    </g>
  );
}

function Wick({ mood, x }: { mood: Mood; x: number }) {
  return (
    <g>
      <path d={`M${x} 30 L${x} 150`} className="gx-toon-wickline" />
      <rect x={x - 20} y={52} width={40} height={78} rx={5} className="gx-toon-wick" />
      <Face mood={mood} x={x} y={82} s={0.85} />
      <path d={`M${x - 20} 104 L${x - 34} 114`} className="gx-toon-wickline" />
      <path d={`M${x + 20} 104 L${x + 34} 96`} className="gx-toon-wickline" />
    </g>
  );
}

function Wall({ screen }: { screen: Screen }) {
  if (screen === "none") return null;
  const line = { up: "M96 44 L112 40 L124 46 L140 30 L156 34 L172 18", down: "M96 20 L112 26 L124 22 L140 38 L156 34 L172 48", flat: "M96 34 L112 32 L124 35 L140 33 L156 35 L172 33", clock: "" }[screen];
  return (
    <g>
      {/* the screen hangs between the two heads */}
      <rect x={102} y={8} width={64} height={52} rx={4} className="gx-toon-screen" />
      {screen === "clock" ? (
        <>
          <circle cx={134} cy={34} r={17} className="gx-toon-line" />
          <path d="M134 34 L134 22 M134 34 L143 38" className="gx-toon-line" />
        </>
      ) : (
        <path d={line} transform="translate(44.6 0) scale(0.667 1)" className={`gx-toon-chart gx-toon-chart-${screen}`} />
      )}
    </g>
  );
}

const DRAW: Record<Who, (p: { mood: Mood; x: number }) => React.ReactElement> = { bull: Bull, bear: Bear, wick: Wick };

export function ToonPanel({ panel, caption }: { panel: Pick<Panel, "cast" | "screen"> & { says?: Panel["says"] }; caption?: string }) {
  const xs = panel.cast.length === 1 ? [58] : [70, 198];
  const seen = `${panel.cast.map((c) => NAMES[c.who]).join(" and ")}${panel.screen === "none" ? "" : panel.screen === "clock" ? ", with a clock on the wall" : `, with a chart on the wall going ${panel.screen === "flat" ? "sideways" : panel.screen}`}.`;
  return (
    <figure className="gx-toon">
      <svg viewBox="0 0 268 150" role="img" aria-label={seen} className="gx-toon-art">
        <Wall screen={panel.screen} />
        <path d="M0 149.5 L268 149.5" className="gx-toon-line" />
        {panel.cast.map((c, i) => {
          const C = DRAW[c.who];
          return <C key={i} mood={c.mood} x={xs[i]} />;
        })}
      </svg>
      <figcaption className="gx-toon-says">
        {panel.says?.map((s, i) => (
          <p key={i} className={`gx-toon-bubble gx-toon-by-${panel.cast.findIndex((c) => c.who === s.by) === 1 ? "right" : "left"}`}>
            <span className="sr-only">{NAMES[s.by]}: </span>
            {s.text}
          </p>
        ))}
        {caption && <p className="gx-toon-caption">{caption}</p>}
      </figcaption>
    </figure>
  );
}

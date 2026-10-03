import { punchLines, type PunchKey } from "@/data/punchlines";

/**
 * A section's line to remember, set large, arriving a word at a time as it
 * scrolls into view (styles/fx.css: a view timeline, so there is no script).
 * Without view timelines, under reduced motion, under low visual effects and
 * on paper it is simply the sentence.
 */
export function PunchLine({ k, className = "" }: { k: PunchKey; className?: string }) {
  const line = punchLines[k];
  const a = line.a.split(" ");
  const b = line.b.split(" ");
  return (
    <aside className={`gx-punch ${className}`} aria-label="A line to remember">
      <p className="gx-punch-line font-display">
        {a.map((w, i) => (
          <span key={`a${i}`} style={{ ["--i" as string]: i }}>
            {w}{" "}
          </span>
        ))}
        {b.map((w, i) => (
          <span key={`b${i}`} className="gx-punch-b" style={{ ["--i" as string]: a.length + i }}>
            {w}
            {i < b.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
      <p className="gx-punch-note">A line to remember. Not advice.</p>
    </aside>
  );
}

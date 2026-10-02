import type { ReactNode } from "react";

/**
 * What stands beside a page's pane on the night stage (`companion` on
 * `PageHero`): a figure in its own window, and under it a line or two of
 * related text in the stage's quiet colour. The slot itself is shown only on
 * wide screens, where the pane leaves the space empty.
 *
 * The figure draws its own champagne frame (see `closeStage` in ./kit), so
 * there is no card here: it floats on the stage.
 */
export function HeroCompanion({
  figure,
  label,
  children,
}: {
  figure: ReactNode;
  /** two or three words above the text, in the eyebrow style */
  label?: string;
  /** one or two plain sentences, taken from what the page already states */
  children: ReactNode;
}) {
  return (
    <div>
      {figure}
      {label ? <p className="eyebrow mt-13">{label}</p> : null}
      <p className={`${label ? "mt-5" : "mt-13"} text-sm leading-relaxed text-[color:var(--on-night-2)]`}>{children}</p>
    </div>
  );
}

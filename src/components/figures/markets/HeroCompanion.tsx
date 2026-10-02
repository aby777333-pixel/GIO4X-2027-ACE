import type { ReactNode } from "react";

/**
 * What stands beside a hero pane on the market pages (PageHero's `companion`
 * slot, shown on wide screens only): one figure on the night stage with a line
 * or two of related text in the hero's quiet colour.
 *
 * `stack` puts the text under the figure, for a pane tall enough to stand
 * beside both. `beside` puts the text to the right of a smaller figure, for a
 * short pane: while the slot is still narrow (below 1400px) the figure takes
 * a little under half of it and the text is set a size smaller, so the
 * companion is never taller than the pane next to it.
 */
export function HeroCompanion({
  figure,
  label,
  children,
  layout = "stack",
}: {
  figure: ReactNode;
  /** two or three words above the text, in the eyebrow style */
  label?: string;
  children: ReactNode;
  layout?: "stack" | "beside";
}) {
  if (layout === "beside") {
    return (
      <div className="flex items-center justify-end gap-21">
        <div className="w-[46%] shrink-0 min-[1400px]:w-[14.375rem]">{figure}</div>
        <div className="min-w-0 flex-1">
          {label ? <p className="eyebrow">{label}</p> : null}
          <p className={`${label ? "mt-5" : ""} text-xs leading-relaxed text-[color:var(--on-night-2)] min-[1400px]:text-sm min-[1400px]:leading-relaxed`}>{children}</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      {figure}
      {label ? <p className="eyebrow mt-13">{label}</p> : null}
      <p className={`${label ? "mt-5" : "mt-13"} text-sm leading-relaxed text-[color:var(--on-night-2)]`}>{children}</p>
    </div>
  );
}

import type { ReactNode } from "react";

/**
 * A figure with its text beside it rather than under it, for a heading column
 * that is wide and has only a shallow space under the heading: the drawing in
 * its card on the left, the related sentence on the right. The same parts and
 * classes as `FigureNote` (../Figure), laid out in a row; on a phone the
 * drawing sits above its sentence.
 */
export function SideNote({ figure, label, children, className = "" }: { figure: ReactNode; label?: string; children: ReactNode; className?: string }) {
  return (
    <aside className={`mt-34 flex max-w-[44rem] flex-col gap-13 sm:flex-row sm:items-center sm:gap-21 ${className}`}>
      <div className="flat w-full max-w-[19rem] shrink-0 rounded-[8px] border border-line bg-surface/60 p-13">{figure}</div>
      <div className="min-w-0">
        {label ? <p className="eyebrow">{label}</p> : null}
        <p className={`${label ? "mt-5" : ""} text-sm leading-relaxed text-ink-3`}>{children}</p>
      </div>
    </aside>
  );
}

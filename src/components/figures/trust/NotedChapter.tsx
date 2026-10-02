import type { ReactNode } from "react";

/**
 * A Trust Centre chapter with a note under its heading.
 *
 * `Chapter` (src/components/trust/Parts.tsx) takes a title and has no slot in
 * its narrow column, so this is that component's own markup and classes,
 * written out with one addition: `note` is rendered under the heading, outside
 * the reveal, the way the "Time zones" chapter of the data methodology page
 * places its drawing. Keep the two in step if `Chapter` changes.
 *
 * `stretch` lets the heading column run the full height of the row, which a
 * sticky note needs in order to travel.
 */
export function NotedChapter({
  id,
  eyebrow,
  title,
  lead,
  children,
  paper,
  flip,
  note,
  stretch,
}: {
  id: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  /** alternate the surface for chapter rhythm */
  paper?: boolean;
  /** put the substance on the left (61.8%) and the heading on the right */
  flip?: boolean;
  /** a FigureNote or a ColumnNote: desktop only, under the heading */
  note: ReactNode;
  stretch?: boolean;
}) {
  const column = [flip ? "lg:order-2" : "", stretch ? "lg:self-stretch" : ""].filter(Boolean).join(" ");
  return (
    <section className={`section-quiet hairline ${paper ? "bg-paper" : ""}`} aria-labelledby={id}>
      <div className={`wrap phi ${flip ? "" : "phi-r"} items-start`}>
        <div className={column || undefined}>
          <div data-reveal suppressHydrationWarning>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id={id} className={`h3 ${eyebrow ? "mt-13" : ""} max-w-[20ch] scroll-mt-[calc(var(--header-h)+2.125rem)]`}>
              {title}
            </h2>
            {lead && <p className="mt-13 max-w-narrow text-ink-2">{lead}</p>}
          </div>
          {note}
        </div>
        <div className={flip ? "lg:order-1" : ""}>{children}</div>
      </div>
    </section>
  );
}

/**
 * The text-only form of a FigureNote, for a short column where a drawing
 * would crowd the page. Hidden below lg, where the columns stack.
 */
export function ColumnNote({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <aside className="mt-34 hidden max-w-[28rem] border-t border-line pt-13 lg:block">
      {label ? <p className="eyebrow">{label}</p> : null}
      <p className={`${label ? "mt-5" : ""} text-sm leading-relaxed text-ink-3`}>{children}</p>
    </aside>
  );
}

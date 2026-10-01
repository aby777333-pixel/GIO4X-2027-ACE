import Link from "next/link";
import type { ReactNode } from "react";
import { site } from "@/config/site";

/**
 * A chapter of a Trust Centre page: the heading holds the narrow column, the
 * substance holds the wide one. Typographic, no cards.
 */
export function Chapter({
  id,
  eyebrow,
  title,
  lead,
  children,
  paper,
  flip,
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
}) {
  return (
    <section className={`section-quiet hairline ${paper ? "bg-paper" : ""}`} aria-labelledby={id}>
      <div className={`wrap phi ${flip ? "" : "phi-r"} items-start`}>
        <div className={flip ? "lg:order-2" : ""} data-reveal suppressHydrationWarning>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id={id} className={`h3 ${eyebrow ? "mt-13" : ""} max-w-[20ch] scroll-mt-[calc(var(--header-h)+2.125rem)]`}>
            {title}
          </h2>
          {lead && <p className="mt-13 max-w-narrow text-ink-2">{lead}</p>}
        </div>
        <div className={flip ? "lg:order-1" : ""}>{children}</div>
      </div>
    </section>
  );
}

/** Hairline rows: a short title and a sentence or two. Optionally numbered. */
export function Rows({ items, numbered, className = "" }: { items: { t: string; d: ReactNode }[]; numbered?: boolean; className?: string }) {
  const List = numbered ? "ol" : "ul";
  return (
    <List className={`border-t border-line ${className}`}>
      {items.map((r, i) => (
        <li key={r.t} className={`grid gap-x-13 border-b border-line py-21 ${numbered ? "grid-cols-[2.125rem_1fr]" : ""}`} data-reveal suppressHydrationWarning style={{ ["--i" as string]: Math.min(i, 5) }}>
          {numbered && <span className="num pt-3 text-xs font-semibold tracking-[0.1em] text-ink-3">{String(i + 1).padStart(2, "0")}</span>}
          <div>
            <h3 className="h4">{r.t}</h3>
            <div className="mt-5 max-w-measure text-ink-2">{r.d}</div>
          </div>
        </li>
      ))}
    </List>
  );
}

/** Published / not yet published. Shape and words, never colour alone. */
export function Status({ published, className = "" }: { published: boolean; className?: string }) {
  return <span className={`state ${published ? "state-open" : "state-off"} ${className}`}>{published ? "Published" : "Not yet published"}</span>;
}

/** The standing instruction for anything that is not on the site yet. */
export function AskGio4x({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <div className={`border-l border-line-strong pl-21 ${className}`}>
      <p className="label">Not on this site yet?</p>
      <p className="mt-5 max-w-measure text-ink-2">
        {children ?? "Ask for it in writing and keep the reply."} Write to{" "}
        <a href={`mailto:${site.email}`} className="link">
          {site.email}
        </a>{" "}
        or use the{" "}
        <Link href="/contact" className="link">
          contact page
        </Link>
        .
      </p>
    </div>
  );
}

/** A plain statement set as a quotation, with its provenance underneath. */
export function Statement({ label, children, source }: { label: string; children: ReactNode; source: ReactNode }) {
  return (
    <figure className="border-y border-line-strong py-34" data-reveal suppressHydrationWarning>
      <p className="label">{label}</p>
      <blockquote className="mt-13 max-w-[34ch] font-display text-xl leading-[1.35] text-ink md:text-2xl">{children}</blockquote>
      <figcaption className="mt-21 max-w-measure text-sm text-ink-3">{source}</figcaption>
    </figure>
  );
}

/** External link to a primary source. */
export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="link">
      {children}
    </a>
  );
}

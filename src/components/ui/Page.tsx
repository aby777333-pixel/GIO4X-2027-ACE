import Link from "next/link";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, type Crumb } from "@/lib/schema";
import { Rosette } from "@/components/brand/Rosette";

/** Visible breadcrumbs backed by BreadcrumbList structured data. Humans first. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const all = [{ name: "GIO4X", href: "/" }, ...crumbs];
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-ink-3">
      <ol className="flex flex-wrap items-center gap-x-8 gap-y-3">
        {all.map((c, i) => {
          const last = i === all.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-8">
              {last ? (
                <span aria-current="page" className="text-ink-2">
                  {c.name}
                </span>
              ) : (
                <>
                  <Link href={c.href} className="link-quiet">
                    {c.name}
                  </Link>
                  <span aria-hidden className="h-px w-8 bg-line-strong" />
                </>
              )}
            </li>
          );
        })}
      </ol>
      <JsonLd data={breadcrumbSchema(all)} />
    </nav>
  );
}

type HeroProps = {
  crumbs?: Crumb[];
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  /** actions under the lead */
  children?: ReactNode;
  /** right-hand (38.2%) column: a visual, a data panel, a note */
  aside?: ReactNode;
  /** compact pages (legal, utility) use the quiet variant */
  quiet?: boolean;
  /** dark "engine room" chapter */
  night?: boolean;
};

/**
 * Inner-page opening. 61.8% statement / 38.2% aside on desktop; on mobile the
 * statement leads and the aside follows as its own composition.
 */
export function PageHero({ crumbs, eyebrow, title, lead, children, aside, quiet, night }: HeroProps) {
  return (
    <header className={`relative overflow-hidden ${night ? "on-night" : "dna-light"} hairline-b`}>
      {!aside && (
        <div aria-hidden className="pointer-events-none absolute -right-[6%] top-1/2 hidden -translate-y-1/2 text-ink opacity-[0.05] lg:block">
          <Rosette size={quiet ? 340 : 520} strokeWidth={0.6} />
        </div>
      )}
      <div className={`wrap relative ${quiet ? "pb-34 pt-34 lg:pb-55 lg:pt-55" : "pb-55 pt-34 lg:pb-89 lg:pt-55"}`}>
        {crumbs && <Breadcrumbs crumbs={crumbs} />}
        <div className={`${crumbs ? "mt-34" : ""} ${aside ? "phi items-end" : ""}`}>
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className={`${quiet ? "h2" : "h1"} ${eyebrow ? "mt-21" : ""} max-w-[20ch]`}>{title}</h1>
            {lead && <p className="lead mt-21 max-w-[56ch]">{lead}</p>}
            {children && <div className="mt-34 flex flex-wrap items-center gap-13">{children}</div>}
          </div>
          {aside && <div>{aside}</div>}
        </div>
      </div>
    </header>
  );
}

/** Section opening: eyebrow, heading, optional lead, optional action at the baseline. */
export function SectionHead({
  eyebrow,
  title,
  lead,
  action,
  as = "h2",
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  const H = as;
  return (
    <div className={`flex flex-col gap-21 md:flex-row md:items-end md:justify-between ${className}`}>
      <div data-reveal>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <H className={`${as === "h2" ? "h2" : "h3"} ${eyebrow ? "mt-13" : ""} max-w-[22ch]`}>{title}</H>
        {lead && <p className="lead mt-13 max-w-[58ch]">{lead}</p>}
      </div>
      {action && (
        <div className="shrink-0" data-reveal>
          {action}
        </div>
      )}
    </div>
  );
}

/**
 * Every data module states what it is: source, status and time.
 * `status` uses the GIO4X data-state vocabulary; never "live" unless it is.
 */
export function DataNote({
  status,
  source,
  sourceHref,
  updated,
  children,
  className = "",
}: {
  status: "reference" | "schedule" | "indicative" | "simulation" | "unavailable" | "delayed";
  source?: string;
  sourceHref?: string;
  updated?: string;
  children?: ReactNode;
  className?: string;
}) {
  const label: Record<typeof status, string> = {
    reference: "Reference data",
    schedule: "Schedule",
    indicative: "Indicative",
    simulation: "Simulation",
    unavailable: "Data unavailable",
    delayed: "Delayed",
  };
  return (
    <p className={`flex flex-wrap items-center gap-x-13 gap-y-3 text-xs text-ink-3 ${className}`}>
      <span className="chip">{label[status]}</span>
      {source && (
        <span>
          Source:{" "}
          {sourceHref ? (
            <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="link">
              {source}
            </a>
          ) : (
            source
          )}
        </span>
      )}
      {updated && <span className="num">Updated {updated}</span>}
      {children && <span>{children}</span>}
    </p>
  );
}

/** A deliberate "nothing here yet" state: says why, and where to go instead. */
export function EmptyState({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="panel-quiet grid justify-items-start gap-13 p-34">
      <Rosette size={34} blades={5} className="text-ink-3" />
      <p className="h4">{title}</p>
      {children && <div className="max-w-measure text-sm text-ink-2">{children}</div>}
      {actions && <div className="mt-8 flex flex-wrap gap-13">{actions}</div>}
    </div>
  );
}

/** One to four considered next steps. No dead ends, no link dumps. */
export function NextSteps({ title = "Continue", items }: { title?: string; items: { label: string; href: string; note?: string; kind?: string }[] }) {
  return (
    <section className="section-quiet hairline" aria-labelledby="next-steps">
      <div className="wrap">
        <p id="next-steps" className="eyebrow">
          {title}
        </p>
        <ul className="mt-21 grid gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {items.slice(0, 4).map((i) => (
            <li key={i.href} className="bg-paper">
              <Link href={i.href} className="group flex h-full flex-col justify-between gap-34 p-21 transition-colors duration-fast hover:bg-surface">
                <span>
                  {i.kind && <span className="label">{i.kind}</span>}
                  <span className="h4 mt-5 block">{i.label}</span>
                  {i.note && <span className="mt-5 block text-sm text-ink-3">{i.note}</span>}
                </span>
                <span className="go" aria-hidden>
                  Open
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Definition rows used for specifications: label left, value right, hairline between. */
export function SpecList({ rows, className = "" }: { rows: { label: string; value: ReactNode; note?: string }[]; className?: string }) {
  return (
    <dl className={className}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-21 border-b border-line py-13">
          <dt className="text-sm text-ink-3">{r.label}</dt>
          <dd className="num text-right text-[0.9375rem] font-medium text-ink">
            {r.value}
            {r.note && <span className="block text-xs font-normal text-ink-3">{r.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

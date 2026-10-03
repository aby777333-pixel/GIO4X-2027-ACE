import Link from "next/link";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { PunchLine } from "@/components/ui/PunchLine";
import { riskWarning } from "@/config/legal";
import type { PunchKey } from "@/data/punchlines";
import { webPageSchema } from "@/lib/schema";

/**
 * The shape shared by the pages that are a row of machines: a quiet hero,
 * then one section for each machine (its name and point on the left, the
 * machine on the right), the risk warning, a line to remember and where to go
 * next. A page supplies its words and its machines and nothing else.
 */
export type Machine = { id: string; eyebrow: string; title: string; lead: string; go: { href: string; label: string }; body: ReactNode; wide?: boolean };

export function MachinePage({
  path,
  title,
  description,
  lead,
  eyebrow = "GIO4X Labs · Experiment",
  parent = { name: "Labs", href: "/labs" },
  machines,
  punch,
  next,
  after,
  keys = true,
}: {
  path: string;
  title: string;
  description: string;
  lead: string;
  eyebrow?: string;
  parent?: { name: string; href: string };
  machines: Machine[];
  punch: PunchKey;
  next: { kind: string; label: string; href: string; note: string }[];
  /** anything that belongs between the machines and the risk warning */
  after?: ReactNode;
  /** whether the page has machines with sliders and buttons the keyboard line applies to */
  keys?: boolean;
}) {
  return (
    <>
      <JsonLd data={webPageSchema({ path, name: title, description })} />
      <PageHero quiet crumbs={[parent, { name: title, href: path }]} eyebrow={eyebrow} title={title} lead={lead} />

      {keys && <p className="wrap hidden pt-13 text-xs text-ink-3 lg:block">On a keyboard: with the pointer over a machine, the left and right arrows move its slider and Enter presses its main button.</p>}

      {machines.map((m, i) => (
        <section key={m.id} id={m.id} data-machine className={`section scroll-mt-[var(--header-h)] ${i ? "hairline" : ""} ${i % 2 ? "bg-paper" : ""}`} aria-labelledby={`${m.id}-h`}>
          <div className={m.wide ? "wrap" : "wrap phi phi-r items-start"}>
            <div className={m.wide ? "max-w-[44rem]" : "lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]"}>
              <p className="gx-numeral" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </p>
              <p className="eyebrow mt-8">{m.eyebrow}</p>
              <h2 id={`${m.id}-h`} className="h2 mt-13">
                {m.title}
              </h2>
              <p className="lead mt-13 max-w-[30rem]">{m.lead}</p>
              <Link href={m.go.href} className="go mt-21">
                {m.go.label}
              </Link>
            </div>
            <div className={m.wide ? "mt-34 min-w-0" : "min-w-0"}>{m.body}</div>
          </div>
        </section>
      ))}

      {after}

      <section className="section-quiet hairline" aria-label="Risk warning">
        <div className="wrap">
          <p className="text-sm text-ink-3">{riskWarning}</p>
        </div>
      </section>

      <PunchLine k={punch} />

      <NextSteps items={next} />
    </>
  );
}

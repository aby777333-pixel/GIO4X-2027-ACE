import Link from "next/link";
import { NeedFigure } from "@/components/need/NeedFigure";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { PunchLine } from "@/components/ui/PunchLine";
import { riskWarning } from "@/config/legal";
import { HERE, NEED } from "@/data/nice-and-need";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const DESCRIPTION =
  "Nice & Need: the best free resources on the web for learning finance and trading. Free courses, official economic data, central bank calendars, charts and economic calendars, and the regulators’ scam warnings, each explained in a line. Plus everything free on GIO4X.";

export const metadata = pageMeta({ title: "Nice & Need: free finance and trading resources", description: DESCRIPTION, path: "/nice-and-need" });

const total = NEED.reduce((n, g) => n + g.links.length, 0);

export default function Page() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/nice-and-need", name: "Nice & Need", description: DESCRIPTION, type: "CollectionPage" })} />
      <PageHero quiet crumbs={[{ name: "Nice & Need", href: "/nice-and-need" }]} eyebrow="Free, from the whole web" title="Nice & Need" lead={`${total} free resources elsewhere on the web, sorted by what they are for. Some are nice to have. Some you need. Each is marked.`}>
        <Link href="#safe" className="btn btn-primary">
          Start with what you need
        </Link>
        <Link href="#here" className="btn btn-ghost">
          Free on this site
        </Link>
      </PageHero>

      <section className="section-quiet" aria-label="About these links">
        <div className="wrap">
          <p className="max-w-measure text-sm text-ink-2">
            These are other people’s websites. GIO4X is not connected with them, is not paid for linking to them and does not check or endorse what they publish. They were free to use when this page was written; that can change. A link opens in a new tab.
          </p>
        </div>
      </section>

      {NEED.map((g, i) => (
        <section key={g.id} id={g.id} className={`section hairline scroll-mt-[var(--header-h)] ${i % 2 ? "bg-paper" : ""}`} aria-labelledby={`${g.id}-h`}>
          <div className="wrap phi phi-r items-start">
            <div className="lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]">
              <p className="gx-numeral" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </p>
              <p className="eyebrow mt-8">
                {g.eyebrow} <span className={`gx-need-tag ${g.need ? "is-need" : ""}`}>{g.need ? "Need" : "Nice"}</span>
              </p>
              <h2 id={`${g.id}-h`} className="h2 mt-13">
                {g.title}
              </h2>
              <p className="lead mt-13 max-w-[30rem]">{g.lead}</p>
              <div className="gx-stage mt-21 max-w-[26rem]">
                <NeedFigure kind={g.kind} />
              </div>
            </div>
            <ul className="grid min-w-0 gap-13">
              {g.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer nofollow" className="gx-need-card group">
                    <span className="flex items-baseline justify-between gap-13">
                      <span className="font-display text-lg text-ink transition-colors duration-fast group-hover:text-accent">{l.name}</span>
                      <span className="label shrink-0 text-ink-3" aria-hidden>
                        {new URL(l.href).hostname.replace(/^www\./, "")} ↗
                      </span>
                    </span>
                    <span className="mt-5 block text-sm text-ink-2">{l.what}</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <section id="here" className="section hairline scroll-mt-[var(--header-h)]" aria-labelledby="here-h">
        <div className="wrap">
          <p className="eyebrow">Free on this site</p>
          <h2 id="here-h" className="h2 mt-13 max-w-[22ch]">
            No account needed for any of it.
          </h2>
          <ul className="mt-34 grid gap-13 sm:grid-cols-2 lg:grid-cols-3">
            {HERE.map((x) => (
              <li key={x.href}>
                <Link href={x.href} className="gx-need-card group">
                  <span className="font-display text-lg text-ink transition-colors duration-fast group-hover:text-accent">{x.label}</span>
                  <span className="mt-5 block text-sm text-ink-2">{x.what}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-quiet hairline" aria-label="Risk warning">
        <div className="wrap">
          <p className="text-sm text-ink-3">{riskWarning}</p>
        </div>
      </section>
      <PunchLine k="academy" />
      <NextSteps
        items={[
          { kind: "Academy", label: "The Playbook", href: "/playbook", note: "Patterns and situations, one page each." },
          { kind: "Academy", label: "Reading list", href: "/academy/books", note: "Books worth the time." },
          { kind: "Trust", label: "Verify a GIO4X link", href: "/trust/verify", note: "Check that a message is really from us." },
          { kind: "Academy", label: "The Academy", href: "/academy", note: "Our own lessons, free." },
        ]}
      />
    </>
  );
}

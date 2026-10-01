import Link from "next/link";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { nav, secondaryNav } from "@/config/nav";
import { articles } from "@/data/articles";
import { glossary, glossaryLetters } from "@/data/glossary";
import { assetClasses, instrumentHref, instrumentsByClass } from "@/data/instruments";
import { centralBanks, econEvents } from "@/data/knowledge";
import { tools } from "@/data/tools";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Explore GIO4X",
  description: "The complete directory of GIO4X: every section, market, instrument, tool, glossary term, central bank and economic event, organised for people.",
  path: "/explore",
});

const chapters = [
  { id: "sections", label: "Sections" },
  { id: "instruments", label: "Instruments" },
  { id: "tools", label: "Tools" },
  { id: "banks", label: "Central banks" },
  { id: "events", label: "Economic events" },
  { id: "glossary", label: "Glossary" },
  { id: "more", label: "Support & legal" },
];

const anchor = "scroll-mt-[calc(var(--header-h)+4.25rem)]";

function ChapterHead({ n, title, count, href, go }: { n: string; title: string; count?: string; href?: string; go?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-8 border-b border-line-strong pb-13">
      <h2 className="h3 flex items-baseline gap-13">
        <span className="num text-xs font-semibold tracking-[0.1em] text-ink-3" aria-hidden>
          {n}
        </span>
        {title}
      </h2>
      <span className="flex items-baseline gap-21">
        {count && <span className="num text-xs text-ink-3">{count}</span>}
        {href && go && (
          <Link href={href} className="go">
            {go}
          </Link>
        )}
      </span>
    </div>
  );
}

export default function ExplorePage() {
  const kinds = [...new Set(tools.map((t) => t.kind))];
  return (
    <>
      <PageHero
        crumbs={[{ name: "Explore GIO4X", href: "/explore" }]}
        eyebrow="Site directory"
        title="Explore GIO4X"
        lead="Every section, market, instrument, tool and term on this site, on one page, in the order a person would look for it."
        quiet
      />

      {/* chapter index: sticky on desktop, a scrolling rail on mobile */}
      <nav aria-label="On this page" className="glass sticky top-[var(--header-h)] z-1 border-b border-line">
        <div className="wrap">
          <ul className="scroll-x -mx-8 flex gap-5 py-8">
            {chapters.map((c) => (
              <li key={c.id} className="shrink-0">
                <a href={`#${c.id}`} className="btn btn-quiet btn-sm h-[2.75rem] md:h-[2.125rem]">
                  {c.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* 01 — the six sections, from the same structure the header reads */}
      <section id="sections" className={`section-quiet ${anchor}`}>
        <div className="wrap">
          <ChapterHead n="01" title="Sections" count={`${nav.length} sections`} />
          <div className="divide-y divide-line">
            {nav.map((s) => (
              <div key={s.key} className="grid gap-x-34 gap-y-21 py-34 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.618fr)]" data-reveal>
                <div>
                  <h3 className="h2">
                    <Link href={s.href} className="transition-colors duration-fast hover:text-accent">
                      {s.label}
                    </Link>
                  </h3>
                  <p className="mt-8 max-w-narrow text-sm text-ink-2">{s.blurb}</p>
                </div>
                <div className="grid gap-x-34 gap-y-21 sm:grid-cols-2 md:grid-cols-3">
                  {s.groups.map((g) => (
                    <div key={g.title}>
                      <h4 className="label">{g.title}</h4>
                      <ul className="mt-8">
                        {g.items.map((i) => (
                          <li key={i.href}>
                            <Link href={i.href} className="link-quiet block py-5 text-[0.9375rem]">
                              <span className="font-medium text-ink">{i.label}</span>
                              {i.note && <span className="block text-xs text-ink-3">{i.note}</span>}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 02 — instruments by asset class */}
      <section id="instruments" className={`section-quiet hairline bg-paper ${anchor}`}>
        <div className="wrap">
          <ChapterHead n="02" title="Instruments" count={`${assetClasses.length} asset classes`} href="/markets" go="Market Command" />
          <ul>
            {assetClasses.map((a) => {
              const list = instrumentsByClass(a.key);
              return (
                <li key={a.key} className="grid gap-x-34 gap-y-8 border-b border-line py-21 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.618fr)]" data-reveal>
                  <div>
                    <h3 className="h4">
                      <Link href={`/markets/${a.key}`} className="transition-colors duration-fast hover:text-accent">
                        {a.name}
                      </Link>
                    </h3>
                    <p className="num mt-2 text-xs text-ink-3">
                      {list.length} {list.length === 1 ? "instrument" : "instruments"}
                    </p>
                  </div>
                  <ul className="-mx-5 flex flex-wrap">
                    {list.map((i) => (
                      <li key={i.slug}>
                        <Link href={instrumentHref(i)} title={i.name} className="num inline-flex min-h-[2.125rem] items-center rounded-xs px-5 text-sm text-ink-2 transition-colors duration-fast hover:bg-brand-soft hover:text-ink sm:px-8">
                          {i.symbol}
                          <span className="sr-only">: {i.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 03 — tools */}
      <section id="tools" className={`section-quiet hairline ${anchor}`}>
        <div className="wrap">
          <ChapterHead n="03" title="Trader Toolkit" count={`${tools.length} tools`} href="/tools" go="All tools" />
          <div className="grid gap-x-34 lg:grid-cols-3">
            {kinds.map((k) => (
              <div key={k} className="pt-21" data-reveal>
                <h3 className="label">{k === "Lab" ? "Labs" : `${k}s`}</h3>
                <ul className="mt-8 border-t border-line">
                  {tools
                    .filter((t) => t.kind === k)
                    .map((t) => (
                      <li key={t.slug} className="border-b border-line">
                        <Link href={`/tools/${t.slug}`} className="group block py-13">
                          <span className="font-medium text-ink transition-colors duration-fast group-hover:text-accent">{t.name}</span>
                          <span className="block text-sm text-ink-3">{t.line}</span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 + 05 — central banks and events, side by side */}
      <section className="section-quiet hairline bg-paper">
        <div className="wrap grid gap-55 lg:grid-cols-phi lg:gap-89">
          <div id="banks" className={anchor}>
            <ChapterHead n="04" title="Central banks" count={`${centralBanks.length}`} href="/markets/central-banks" go="Central Bank Watch" />
            <ul className="grid sm:grid-cols-2 sm:gap-x-34">
              {centralBanks.map((b) => (
                <li key={b.slug} className="border-b border-line" data-reveal>
                  <Link href={`/markets/central-banks/${b.slug}`} className="group grid grid-cols-[3.4375rem_1fr] items-baseline gap-x-8 py-13">
                    <span className="num text-xs font-semibold text-ink-3">{b.currency}</span>
                    <span>
                      <span className="font-medium text-ink transition-colors duration-fast group-hover:text-accent">{b.name}</span>
                      <span className="block text-xs text-ink-3">{b.city}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div id="events" className={anchor}>
            <ChapterHead n="05" title="Economic events" count={`${econEvents.length}`} href="/markets/events" go="All events" />
            <ul>
              {econEvents.map((e) => (
                <li key={e.slug} className="border-b border-line" data-reveal>
                  <Link href={`/markets/events/${e.slug}`} className="group flex items-baseline justify-between gap-13 py-13">
                    <span className="font-medium text-ink transition-colors duration-fast group-hover:text-accent">{e.name}</span>
                    <span className="shrink-0 text-xs text-ink-3">{e.kind}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 06 — glossary, by letter */}
      <section id="glossary" className={`section-quiet hairline ${anchor}`}>
        <div className="wrap">
          <ChapterHead n="06" title="Glossary" count={`${glossary.length} terms`} href="/glossary" go="Open the glossary" />
          <dl>
            {glossaryLetters.map((letter) => {
              const terms = glossary.filter((t) => t.letter === letter);
              return (
                <div key={letter} className="grid grid-cols-[2.125rem_1fr] gap-x-13 border-b border-line py-13 sm:grid-cols-[5.5625rem_1fr]">
                  <dt className="font-display text-2xl font-light leading-none text-ink-3">{letter}</dt>
                  <dd>
                    <ul className="-mx-5 flex flex-wrap">
                      {terms.map((t) => (
                        <li key={t.slug}>
                          <Link href={`/glossary/${t.slug}`} className="inline-flex min-h-[2.125rem] items-center rounded-xs px-5 text-sm text-ink-2 transition-colors duration-fast hover:bg-brand-soft hover:text-ink sm:px-8">
                            {t.term}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      {/* 07 — everything that lives outside the primary navigation */}
      <section id="more" className={`section-quiet hairline bg-paper ${anchor}`}>
        <div className="wrap">
          <ChapterHead n="07" title="Support, legal and the rest" />
          <div className="grid gap-x-34 gap-y-21 pt-21 sm:grid-cols-2 lg:grid-cols-4">
            {secondaryNav.map((g) => (
              <div key={g.title}>
                <h3 className="label">{g.title}</h3>
                <ul className="mt-8">
                  {g.items.map((i) => (
                    <li key={i.href}>
                      <Link href={i.href} className="link-quiet block py-5 text-[0.9375rem] font-medium text-ink">
                        {i.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div>
              <h3 className="label">Gateways</h3>
              <ul className="mt-8">
                {[
                  { label: "Sign in", href: "/sign-in" },
                  { label: "Open an account", href: "/open-account" },
                  { label: "Search", href: "/search" },
                ].map((i) => (
                  <li key={i.href}>
                    <Link href={i.href} className="link-quiet block py-5 text-[0.9375rem] font-medium text-ink">
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {articles.length > 0 && (
                <p className="mt-13 text-xs text-ink-3">
                  <span className="num">{articles.length}</span> Intelligence articles are indexed on the{" "}
                  <Link href="/intelligence" className="link">
                    Intelligence
                  </Link>{" "}
                  page.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <NextSteps
        title="Or start here"
        items={[
          { kind: "Search", label: "Search GIO4X", note: "Symbols, terms, tools and pages.", href: "/search" },
          { kind: "Markets", label: "Market Command", note: "Sessions, reference rates, structure.", href: "/markets" },
          { kind: "Academy", label: "Academy", note: "Mechanics and concepts.", href: "/academy" },
          { kind: "Company", label: "What’s new", note: "What changed, and when.", href: "/whats-new" },
        ]}
      />
    </>
  );
}

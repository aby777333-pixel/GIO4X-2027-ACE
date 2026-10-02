import Link from "next/link";
import { AcademyProgress, LessonMark, LessonsCount } from "@/components/academy/Progress";
import { TwoRoutes } from "@/components/figures/academy/TwoRoutes";
import { BoundedScale } from "@/components/figures/company/BoundedScale";
import { RollingMean } from "@/components/figures/company/RollingMean";
import { FigureNote } from "@/components/figures/Figure";
import { HeroCompanion } from "@/components/figures/stage/HeroCompanion";
import { TurningPages } from "@/components/figures/stage/TurningPages";
import { ReadRows } from "@/components/knowledge/Reader";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero, SectionHead } from "@/components/ui/Page";
import { academyLevels, getLesson, lessons, lessonsOf, modules, modulesByLevel, paths, startHere, type LearningPath } from "@/data/academy";
import { articles } from "@/data/articles";
import { books } from "@/data/books";
import { faqs } from "@/data/faqs";
import { glossary } from "@/data/glossary";
import { getTool } from "@/data/tools";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";
import "@/components/knowledge/knowledge.css";

const description = "GIO4X Academy: lessons on how markets, leverage, charts and risk work, organised from beginner to professional concepts. No certificates and no promises of trading success.";

export const metadata = pageMeta({ title: "Academy", description, path: "/academy" });

const VISUAL_TOOLS = [
  { slug: "spread-visualizer", idea: "The bid, the ask and the cost between them." },
  { slug: "leverage-visualizer", idea: "The same move, at different leverage." },
  { slug: "drawdown", idea: "Why a loss needs a larger gain to recover." },
  { slug: "order-anatomy", idea: "Entry, stop and target on one diagram." },
];

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const count = (n: number) => WORDS[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function PathSteps({ path }: { path: LearningPath }) {
  return (
    <ol className="mt-21 border-t border-line-strong">
      {path.steps.map((s, i) => {
        const items = s.lessons.map((slug) => getLesson(slug)).filter((l) => l !== undefined);
        return (
          <li key={s.title} className="grid grid-cols-[2.125rem_1fr] gap-x-13 border-b border-line py-21">
            <span className="num pt-3 text-xs font-semibold tracking-[0.1em] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h4 className="h4">{s.title}</h4>
              <p className="mt-3 text-sm text-ink-3">{s.skills}</p>
              {items.length > 0 ? (
                <ul className="mt-8 flex flex-col">
                  {items.map((l) => (
                    <li key={l.slug}>
                      <Link href={`/academy/${l.slug}`} className="link inline-flex min-h-[2.125rem] items-center text-[0.9375rem]">
                        {l.title}
                      </Link>
                      <LessonMark slug={l.slug} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-8 text-sm text-ink-3">No lesson is published for this step yet.</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * What two paths have in common, for the figure and the sentence under the
 * shorter one. Counted from the published lessons the steps link to, so it
 * stays true when the paths change.
 */
function overlap(a: LearningPath, b: LearningPath) {
  const published = (p: LearningPath) => p.steps.map((s) => s.lessons.filter((slug) => getLesson(slug) !== undefined));
  const [sa, sb] = [published(a), published(b)];
  // the row of lessons: the longer path's order, with the shorter path's own lessons slotted in after the one before them
  const row = [...new Set(sb.flat())];
  let after = -1;
  for (const slug of sa.flat()) {
    const at = row.indexOf(slug);
    if (at >= 0) after = at;
    else row.splice(++after, 0, slug);
  }
  const inA = new Set(sa.flat());
  const inB = new Set(sb.flat());
  return {
    routes: [sa, sb].map((steps) => steps.map((step) => step.map((slug) => row.indexOf(slug)))),
    lessons: row.length,
    shared: row.filter((s) => inA.has(s) && inB.has(s)).length,
    onlyB: row.filter((s) => inB.has(s) && !inA.has(s)).length,
    emptyB: sb.filter((step) => step.length === 0).length,
  };
}

export default function AcademyPage() {
  const first = getLesson(startHere.steps[0].lessons[0]) ?? lessons[0];
  const otherPaths = paths.filter((p) => p.key !== startHere.key);
  // one short path beside one longer path leaves the short column empty under its last step
  const longer = otherPaths.length === 1 && otherPaths[0].steps.length > startHere.steps.length ? otherPaths[0] : null;
  const meet = longer ? overlap(startHere, longer) : null;

  return (
    <>
      <JsonLd data={webPageSchema({ path: "/academy", name: "GIO4X Academy", description, type: "CollectionPage" })} />
      <PageHero
        crumbs={[{ name: "Academy", href: "/academy" }]}
        eyebrow="GIO4X Academy"
        title="Learn how markets work, in order."
        lead="Mechanics and concepts, taught responsibly: from what a currency pair is to how professionals size risk. No certificates, no streaks, and no promise that study leads to profit."
        aside={
          <aside aria-labelledby="start-here" className="border-t-2 border-ink pt-13" data-tour="academy">
            <div className="flex items-baseline justify-between gap-13">
              <h2 id="start-here" className="label text-ink">
                {startHere.title}
              </h2>
              <span className="text-xs text-ink-3">{startHere.steps.length} steps</span>
            </div>
            <ol className="mt-8">
              {startHere.steps.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[2.125rem_1fr] gap-x-8 border-t border-line py-13 first:border-t-0">
                  <span className="num pt-2 text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <span className="block font-medium text-ink">{s.title}</span>
                    <span className="mt-2 block text-sm text-ink-3">{s.skills}</span>
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        }
        companion={
          <HeroCompanion figure={<TurningPages />} label="Beside the lessons">
            The{" "}
            <Link href="/glossary" className="link">
              glossary
            </Link>{" "}
            defines the terms the lessons use, and the{" "}
            <Link href="/tools" className="link">
              visual tools
            </Link>{" "}
            let you watch the mechanics with your own inputs.
          </HeroCompanion>
        }
      >
        <Link href={`/academy/${first.slug}`} className="btn btn-primary">
          Begin with lesson one
        </Link>
        <Link href="#curriculum" className="btn btn-ghost">
          See the curriculum
        </Link>
      </PageHero>

      {/* ── Curriculum by level ─────────────────────────────────────────── */}
      <section id="curriculum" className="section scroll-mt-[var(--header-h)]" aria-labelledby="curriculum-title">
        <div className="wrap">
          {/* set by hand, without the scroll reveal: this heading is in the first viewport */}
          <div>
            <p className="eyebrow">Curriculum</p>
            <h2 id="curriculum-title" className="h2 mt-13 max-w-[22ch]">{`${cap(count(academyLevels.filter((lv) => modulesByLevel(lv.level).length > 0).length))} levels, ${count(modules.length)} modules.`}</h2>
            <p className="lead mt-13 max-w-[58ch]">
              {lessons.length} lessons are published. Where a module has no lesson yet, it says so and shows its outline instead.
            </p>
            {/* rendered only after mount, and only when this browser holds a completed lesson */}
            <AcademyProgress slugs={lessons.map((l) => l.slug)} className="mt-13 max-w-[58ch]" />
          </div>
          <div className="mt-55 border-t border-line-strong">
            {academyLevels.map((lv, i) => {
              const mods = modulesByLevel(lv.level);
              if (!mods.length) return null;
              return (
                <div key={lv.level} className="grid gap-x-55 gap-y-21 border-b border-line py-34 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)] lg:py-55">
                  <div className="lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)] lg:self-start">
                    <p className="num text-xs font-semibold tracking-[0.1em] text-ink-3">Level {String(i + 1).padStart(2, "0")}</p>
                    <h3 className="h3 mt-8">{lv.level}</h3>
                    <p className="mt-13 max-w-[38ch] text-ink-2">{lv.line}</p>
                    <LessonsCount slugs={mods.flatMap((m) => lessonsOf(m).map((l) => l.slug))} className="mt-13" />
                    {lv.level === "Beginner" && (
                      <p className="mt-21 hidden max-w-[38ch] text-sm leading-relaxed text-ink-3 lg:block">
                        New to currency markets? Begin with the{" "}
                        <Link href={`/academy/${first.slug}`} className="link">
                          first lesson
                        </Link>
                        . The{" "}
                        <Link href="/glossary" className="link">
                          glossary
                        </Link>{" "}
                        defines the terms these lessons use.
                      </p>
                    )}
                    {lv.level === "Intermediate" && (
                      <FigureNote figure={<RollingMean />} label="For example">
                        A moving average smooths price by averaging a set number of periods, so it reacts gradually to change. The lessons at this level take one such idea at a time, and the{" "}
                        <Link href="/tools" className="link">
                          visual tools
                        </Link>{" "}
                        let you watch other mechanics with your own inputs.
                      </FigureNote>
                    )}
                    {lv.level === "Advanced" && (
                      <FigureNote figure={<BoundedScale />} label="Where to find them">
                        The indicator lessons (Fibonacci retracement, RSI and MACD, Bollinger Bands) sit in the Technical analysis module above, marked Advanced. Each says what a reading measures and where it misleads.
                      </FigureNote>
                    )}
                    {lv.level === "Professional concepts" && (
                      <p className="mt-21 hidden max-w-[38ch] text-sm leading-relaxed text-ink-3 lg:block">
                        To work the arithmetic yourself: the{" "}
                        <Link href="/tools/position-size" className="link">
                          position size calculator
                        </Link>{" "}
                        goes from the risk you accept to the size you trade, and the{" "}
                        <Link href="/tools/drawdown" className="link">
                          drawdown visualiser
                        </Link>{" "}
                        shows why a loss needs a larger gain to recover.
                      </p>
                    )}
                  </div>
                  <div className="grid gap-34">
                    {mods.map((m) => {
                      const list = lessonsOf(m);
                      return (
                        <article key={m.key} aria-labelledby={`m-${m.key}`}>
                          <div className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-3">
                            <h4 id={`m-${m.key}`} className="h4">
                              {m.title}
                            </h4>
                            {list.length > 0 ? (
                              <span className="num text-xs text-ink-3">
                                {list.length} {list.length === 1 ? "lesson" : "lessons"}
                              </span>
                            ) : (
                              <span className="state state-off">Outline only</span>
                            )}
                          </div>
                          <p className="mt-5 max-w-measure text-sm text-ink-2">{m.summary}</p>
                          {list.length > 0 ? (
                            <ol className="mt-13 border-t border-line">
                              {list.map((l, n) => (
                                <li key={l.slug} className="border-b border-line">
                                  <Link href={`/academy/${l.slug}`} className="group grid min-h-[3.4375rem] grid-cols-[2.125rem_1fr_auto] items-baseline gap-x-8 py-13 transition-colors duration-fast hover:bg-[var(--brand-soft)]">
                                    <span className="num text-xs text-ink-3">{String(n + 1).padStart(2, "0")}</span>
                                    <span>
                                      <span className="block font-medium text-ink transition-colors duration-fast group-hover:text-accent">
                                        {l.title}
                                        <LessonMark slug={l.slug} />
                                      </span>
                                      <span className="mt-2 block text-sm text-ink-3">{l.description}</span>
                                    </span>
                                    <span className="num hidden whitespace-nowrap pl-13 text-xs text-ink-3 sm:block">
                                      {l.level !== m.level ? `${l.level} · ` : ""}
                                      {l.readMinutes} min
                                    </span>
                                  </Link>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <div className="mt-13 border-y border-line py-13">
                              <p className="text-sm text-ink-3">Lessons for this module are not yet published. Its outline:</p>
                              <p className="mt-5 text-sm text-ink-2">{m.topics.join(" · ")}</p>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Learning paths ──────────────────────────────────────────────── */}
      <section className="section hairline bg-paper" aria-labelledby="paths-title">
        <div className="wrap">
          <SectionHead eyebrow="Learning paths" title={<span id="paths-title">Two routes through the same material.</span>} lead="A path is a suggested order, nothing more. There is no enrolment and no timetable. Each lesson ends with three questions; this browser remembers the lessons whose questions you have answered, and nothing is sent anywhere." />
          <div className="mt-34 grid gap-55 lg:grid-cols-2 lg:gap-89">
            {[startHere, ...otherPaths].map((p) => (
              <article key={p.key} aria-labelledby={`p-${p.key}`}>
                <h3 id={`p-${p.key}`} className="h3">
                  {p.title}
                </h3>
                <p className="mt-8 max-w-[52ch] text-ink-2">{p.summary}</p>
                <LessonsCount slugs={[...new Set(p.steps.flatMap((s) => s.lessons))].filter((slug) => getLesson(slug) !== undefined)} className="mt-13" />
                <PathSteps path={p} />
                {p.key === startHere.key && longer && meet && meet.shared > 0 && (
                  <aside className="mt-34 hidden lg:block">
                    <div className="flat rounded-[8px] border border-line bg-surface/60 p-13">
                      <TwoRoutes routes={meet.routes} lessons={meet.lessons} />
                    </div>
                    <p className="eyebrow mt-13">Where they meet</p>
                    <p className="mt-5 max-w-[58ch] text-sm leading-relaxed text-ink-3">
                      {meet.shared === 1 ? "One lesson appears" : `${cap(count(meet.shared))} lessons appear`} in both paths: the ringed dots.
                      {meet.onlyB > 0 && ` ${longer.title} adds ${count(meet.onlyB)} that ${startHere.title} does not include`}
                      {meet.onlyB > 0 && (meet.emptyB > 0 ? `, and ${count(meet.emptyB)} of its steps ${meet.emptyB === 1 ? "has" : "have"} no lesson published yet.` : ".")}
                      {meet.onlyB === 0 && meet.emptyB > 0 && ` ${cap(count(meet.emptyB))} of the steps in ${longer.title} ${meet.emptyB === 1 ? "has" : "have"} no lesson published yet.`}
                    </p>
                  </aside>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── See it move ─────────────────────────────────────────────────── */}
      <section className="section" aria-labelledby="see-title">
        <div className="wrap phi phi-r items-start">
          <div>
            <p className="eyebrow">See it move</p>
            <h2 id="see-title" className="h2 mt-13">
              Some ideas are easier to watch than to read.
            </h2>
            <p className="mt-13 max-w-[40ch] text-ink-2">Four visual tools that take your own inputs and show the mechanics. They simulate; they do not quote prices or suggest trades.</p>
            <Link href="/tools" className="go mt-13 min-h-[2.75rem]">
              All tools
            </Link>
          </div>
          <ul className="grid border-l border-t border-line sm:grid-cols-2">
            {VISUAL_TOOLS.map((v) => {
              const t = getTool(v.slug);
              if (!t) return null;
              return (
                <li key={v.slug} className="border-b border-r border-line">
                  <Link href={`/tools/${t.slug}`} className="group flex h-full min-h-[8.9375rem] flex-col justify-between gap-21 p-21 transition-colors duration-fast hover:bg-surface">
                    <span>
                      <span className="label">{t.kind}</span>
                      <span className="h4 mt-5 block transition-colors duration-fast group-hover:text-accent">{t.name}</span>
                      <span className="mt-5 block text-sm text-ink-3">{v.idea}</span>
                    </span>
                    <span className="go" aria-hidden>
                      Open
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── The reference shelf ─────────────────────────────────────────── */}
      <section className="section-quiet hairline" aria-labelledby="shelf-title">
        <div className="wrap">
          <h2 id="shelf-title" className="eyebrow">
            The reference shelf
          </h2>
          <ReadRows
            className="mt-21"
            items={[
              { href: "/glossary", kicker: "Glossary", title: `${glossary.length} terms, defined plainly`, note: "With examples, formulae and the tools that use them." },
              { href: "/academy/books", kicker: "Reading list", title: `${books.length} books worth the time`, note: "A bibliography by subject. No ratings; each entry links to a bookseller search and a library catalogue." },
              { href: "/faq", kicker: "Help", title: `${faqs.length} questions answered`, note: "Searchable, and honest about what is not yet published." },
              ...(articles.length ? [{ href: "/intelligence", kicker: "Intelligence", title: "Analysis, explainers and guides", note: "The publication: one idea at a time, worked through." }] : []),
            ]}
          />
          <p className="mt-34 max-w-measure text-sm text-ink-3">
            The Academy explains how things work. It does not issue certificates, grade you, or suggest that finishing it makes trading profitable: most of what is here is about cost, mechanics and risk. The questions at the end of a lesson are a self-check, and which lessons you have completed is kept in your browser only. Modules listed: {modules.length}; lessons published: {lessons.length}.
          </p>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Lesson one", label: first.title, href: `/academy/${first.slug}`, note: `${first.readMinutes} min read` },
          { kind: "Reference", label: "Glossary", href: "/glossary", note: "Look a term up." },
          { kind: "Practice", label: "Trader Toolkit", href: "/tools", note: "Work the numbers yourself." },
          { kind: "Read", label: "Intelligence", href: "/intelligence", note: "The publication." },
        ]}
      />
    </>
  );
}

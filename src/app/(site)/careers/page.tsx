import { EmptyState, NextSteps, PageHero, SectionHead } from "@/components/ui/Page";
import { pageMeta } from "@/lib/meta";

const CAREERS_EMAIL = "careers@gio4x.com";

export const metadata = pageMeta({
  title: "Careers",
  description: "How GIO4X works: precision, plain language and respect for the client. No open roles are published at the moment; here is how to introduce yourself.",
  path: "/careers",
});

const craft = [
  {
    t: "Precision",
    d: "A figure is right or it is not published. That holds for a spread in a table, a formula in a calculator and a date under a chart. We would rather ship a page late than ship it approximately.",
    look: "You check the unit before you check the number.",
  },
  {
    t: "Plain language",
    d: "If a client needs a glossary to read our risk disclosure, we have failed. We write short sentences, define terms once, and cut anything that exists to impress rather than to inform.",
    look: "You can explain margin to a careful beginner without a single adjective.",
  },
  {
    t: "Respect for the client",
    d: "The person on the other side is risking their own money. We do not hurry them, flatter them or hide the cost. We tell them what a product is, then leave the decision with them.",
    look: "You would be comfortable if every message you sent a client were read aloud.",
  },
];

const disciplines = ["Client support", "Compliance and operations", "Engineering and design", "Research and editorial", "Partnerships"];

export default function CareersPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: "Careers", href: "/careers" }]}
        eyebrow="Careers"
        title="Work that is meant to be checked."
        lead="GIO4X is built by people who care about getting small things exactly right, and who would rather say less than say something they cannot stand behind."
      />

      <section className="section" aria-labelledby="craft">
        <div className="wrap">
          <SectionHead eyebrow="How we work" title={<span id="craft">Three habits, practised daily.</span>} lead="They are not values for a wall. They are how a page, a reply or a line of code gets judged before it leaves the building." />
          <ol className="mt-55 border-t border-line-strong">
            {craft.map((c, i) => (
              <li key={c.t} className="grid gap-x-34 gap-y-13 border-b border-line py-34 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)]" data-reveal style={{ ["--i" as string]: i }}>
                <h3 className="h2 flex items-baseline gap-13">
                  <span className="num text-xs font-semibold tracking-[0.1em] text-ink-3" aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {c.t}
                </h3>
                <div>
                  <p className="max-w-measure text-md text-ink-2">{c.d}</p>
                  <p className="mt-13 border-l border-accent pl-13 text-sm text-ink">{c.look}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section hairline bg-paper" aria-labelledby="roles">
        <div className="wrap phi items-start">
          <div>
            <p className="eyebrow">Open roles</p>
            <h2 id="roles" className="h2 mt-13">
              Nothing is listed today.
            </h2>
            <div className="mt-34" data-reveal>
              <EmptyState
                title="No open roles are published at the moment."
                actions={
                  <a href={`mailto:${CAREERS_EMAIL}?subject=Introduction`} className="btn btn-primary">
                    Introduce yourself
                  </a>
                }
              >
                <p>
                  A vacancy appears on this page only when it is a real, current opening that someone will be hired into. When there is one it will be listed here with its location, its responsibilities and how to apply. We do not keep placeholder listings.
                </p>
              </EmptyState>
            </div>
          </div>

          <aside aria-labelledby="intro-h" data-reveal>
            <h3 id="intro-h" className="h3">
              Introduce yourself anyway.
            </h3>
            <p className="mt-13 text-ink-2">Good people rarely arrive on schedule. If the way we work sounds like the way you work, write to the careers address.</p>
            <p className="mt-21">
              <span className="label block">Careers contact</span>
              <a href={`mailto:${CAREERS_EMAIL}`} className="link mt-5 inline-block font-display text-xl">
                {CAREERS_EMAIL}
              </a>
            </p>
            <ul className="mt-21 border-t border-line text-sm text-ink-2">
              <li className="border-b border-line py-13">Say what you do and show one piece of work you are proud of.</li>
              <li className="border-b border-line py-13">Tell us which of the three habits above you would hold us to.</li>
              <li className="border-b border-line py-13">Keep it short. A few honest paragraphs are worth more than a long CV.</li>
            </ul>
            <p className="mt-13 text-xs text-ink-3">An introduction is not an application for a vacancy, and we cannot promise a reply to every message. Please do not send identity documents.</p>
          </aside>
        </div>
      </section>

      <section className="section-quiet hairline" aria-labelledby="disciplines">
        <div className="wrap phi phi-r items-baseline">
          <h2 id="disciplines" className="h4">
            The kinds of work a brokerage needs
          </h2>
          <div>
            <ul className="flex flex-wrap gap-8">
              {disciplines.map((d) => (
                <li key={d} className="chip">
                  {d}
                </li>
              ))}
            </ul>
            <p className="mt-13 max-w-measure text-sm text-ink-3">A description of the disciplines involved, not a list of vacancies. Mention the one closest to yours when you write.</p>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Company", label: "About GIO4X", note: "The house philosophy.", href: "/about" },
          { kind: "Company", label: "Designing GIO4X", note: "How this site was put together.", href: "/design" },
          { kind: "Trust", label: "Editorial standards", note: "How we write, and what we will not write.", href: "/trust/editorial-standards" },
          { kind: "Company", label: "Contact", note: "For everything that is not a career question.", href: "/contact" },
        ]}
      />
    </>
  );
}

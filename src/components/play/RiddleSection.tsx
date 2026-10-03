import Link from "next/link";
import { getTerm, glossary } from "@/data/glossary";
import { couplets } from "@/data/glossary-couplets";
import { riddles } from "@/data/riddles";
import { DailyRiddle, type RiddleItem } from "./DailyRiddle";
import { TermOfDay, type DayTerm } from "./Guided";

/**
 * The daily riddle as a section of a page. The terms are resolved here, on
 * the server, so the browser is sent names and addresses and not the glossary.
 * The three options are put in a fixed order (by slug), so the answer's place
 * among them does not give it away.
 */
const items: RiddleItem[] = riddles.flatMap((r) => {
  const answer = getTerm(r.a);
  const others = r.o.map((slug) => getTerm(slug));
  if (!answer || others.some((t) => !t)) return [];
  const options = [answer, ...others].map((t) => ({ slug: t!.slug, term: t!.term })).sort((a, b) => a.slug.localeCompare(b.slug));
  return [{ q: r.q, answer: { slug: answer.slug, term: answer.term }, options }];
});

export function RiddleSection({ tinted = false }: { tinted?: boolean }) {
  return (
    <section id="riddle" className={`section hairline scroll-mt-[var(--header-h)] ${tinted ? "bg-paper" : ""}`} aria-labelledby="riddle-h">
      <div className="wrap phi phi-r items-start">
        <div>
          <p className="eyebrow">The daily riddle</p>
          <h2 id="riddle-h" className="h2 mt-13">
            One a day, in rhyme.
          </h2>
          <p className="lead mt-13 max-w-[30rem]">Four lines that describe one word from the glossary. Name it, and tomorrow there is another.</p>
          <Link href="/glossary" className="go mt-21">
            The glossary
          </Link>
        </div>
        <div className="min-w-0">
          <DailyRiddle items={items} />
        </div>
      </div>
    </section>
  );
}

// the term of the day: each term's name, its first sentence and its couplet
const dayTerms: DayTerm[] = glossary.map((t) => {
  const c = couplets[t.slug];
  const first = t.definition.split(/(?<=[.!?])\s+(?=[A-Z])/)[0];
  return { slug: t.slug, term: t.term, says: first.length > 220 ? `${first.slice(0, 217).trimEnd()}\u2026` : first, ...(c ? { a: c[0], b: c[1] } : {}) };
});

export function TermSection() {
  return (
    <section id="term" className="section hairline scroll-mt-[var(--header-h)]" aria-labelledby="term-h">
      <div className="wrap phi phi-r items-start">
        <div>
          <p className="eyebrow">The term of the day</p>
          <h2 id="term-h" className="h2 mt-13">
            One word, every day.
          </h2>
          <p className="lead mt-13 max-w-[30rem]">A term from the glossary, with its couplet and what it means in a sentence.</p>
          <Link href="/glossary/map" className="go mt-21">
            The glossary, as a star map
          </Link>
        </div>
        <div className="min-w-0">
          <TermOfDay terms={dayTerms} />
        </div>
      </div>
    </section>
  );
}

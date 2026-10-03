import Link from "next/link";
import { getTerm } from "@/data/glossary";
import { riddles } from "@/data/riddles";
import { DailyRiddle, type RiddleItem } from "./DailyRiddle";

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

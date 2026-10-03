import { Bingo, Cartoons, ComicReader, ExcuseMachine, FunRiddles, JokeBox, Limericks } from "@/components/fun/Fun";
import { MachinePage } from "@/components/labs/MachinePage";
import { BINGO, DICTIONARY, JOKES, RIDDLES, STRIPS } from "@/data/fun";
import { pageMeta } from "@/lib/meta";

const DESCRIPTION =
  "Fun@Finance: jokes, comic strips, cartoons, limericks, riddles and a trader’s dictionary, all about markets and the people who watch them, with an excuse machine and a bingo card of trading habits. Written for this page. Jokes, not advice.";

export const metadata = pageMeta({ title: "Fun@Finance", description: DESCRIPTION, path: "/fun" });

export default function Page() {
  return (
    <MachinePage
      path="/fun"
      title="Fun@Finance"
      description={DESCRIPTION}
      eyebrow="Jokes, comics and other serious matters"
      parent={{ name: "Academy", href: "/academy" }}
      lead="The market has no sense of humour, so somebody has to. Jokes, comic strips, cartoons, limericks and riddles about trading and the people who do it. None of it is advice."
      punch="academy"
      keys={false}
      machines={[
        { id: "joke", eyebrow: "The joke box", title: "One a day. More if you insist.", lead: `${JOKES.length} one-liners about charts, spreads and the people who stare at them.`, go: { href: "/#riddle", label: "The daily riddle" }, body: <JokeBox /> },
        {
          id: "comics",
          wide: true,
          eyebrow: "The comic strip",
          title: "The Bull, the Bear and Wick.",
          lead: `${STRIPS.length} strips in three panels. The Bull is sure it is going up, the Bear is sure it is not, and Wick, a candle, has seen both be wrong.`,
          go: { href: "/labs/mind", label: "The Mind Room, where the same habits are games" },
          body: <ComicReader />,
        },
        { id: "cartoons", wide: true, eyebrow: "Cartoons", title: "One drawing, one line.", lead: "The same three, caught at a single moment.", go: { href: "/labs/cinema", label: "The Screening Room" }, body: <Cartoons /> },
        { id: "limericks", eyebrow: "Limericks", title: "Five lines and a moral, more or less.", lead: "Each is about a habit. Some of them end well.", go: { href: "/verse", label: "The Verse Room" }, body: <Limericks /> },
        { id: "riddles", wide: true, eyebrow: "Riddles", title: "What am I?", lead: `${RIDDLES.length} riddles. Turn one over for its answer.`, go: { href: "/verse#weekly", label: "The weekly riddle" }, body: <FunRiddles /> },
        {
          id: "dictionary",
          wide: true,
          eyebrow: "The other dictionary",
          title: "What the words really mean.",
          lead: "The glossary gives the definitions. This gives the ones people use.",
          go: { href: "/glossary", label: "The real glossary" },
          body: (
            <dl className="grid gap-x-34 sm:grid-cols-2">
              {DICTIONARY.map((d) => (
                <div key={d.word} className="border-t border-line py-13">
                  <dt className="font-display text-lg text-ink">{d.word}</dt>
                  <dd className="mt-3 text-ink-2">{d.means}</dd>
                </div>
              ))}
            </dl>
          ),
        },
        { id: "excuses", eyebrow: "The excuse machine", title: "It was never your fault.", lead: "Three reels: who did it, what they did, and what follows. Any resemblance to a real explanation is a coincidence.", go: { href: "/academy/practice#museum", label: "The real mistakes, in the practice room" }, body: <ExcuseMachine /> },
        { id: "bingo", wide: true, eyebrow: "Trader bingo", title: "A card for the week.", lead: `${BINGO.length - 1} habits and one free square. Mark the ones you recognise. Five in a row is nothing to be proud of.`, go: { href: "/labs/mind", label: "The Mind Room" }, body: <Bingo /> },
      ]}
      next={[
        { kind: "Verse", label: "The Verse Room", href: "/verse", note: "Riddles, an alphabet and old sayings." },
        { kind: "Labs", label: "The Mind Room", href: "/labs/mind", note: "The habits in the jokes, as games." },
        { kind: "Academy", label: "The practice room", href: "/academy/practice", note: "Where the serious version lives." },
        { kind: "Glossary", label: "The glossary", href: "/glossary", note: "The definitions that are meant." },
      ]}
    />
  );
}

import { MachinePage } from "@/components/labs/MachinePage";
import { Alphabet, FinishTheRhyme, HuntProgress, ProverbWall, WeeklyRiddle, type Couplet } from "@/components/verse/Verse";
import { glossary } from "@/data/glossary";
import { couplets } from "@/data/glossary-couplets";
import { pageMeta } from "@/lib/meta";

const DESCRIPTION =
  "Rhyme as a way of remembering: a harder riddle each week with three clues, a trader\u2019s alphabet from Ask to Zigzag, a game of finishing glossary couplets, a wall of old market sayings with a verdict on each, and five riddles hidden round the site. Nothing here is advice.";

export const metadata = pageMeta({ title: "The Verse Room", description: DESCRIPTION, path: "/verse" });

const cards: Couplet[] = glossary.flatMap((t) => {
  const c = couplets[t.slug];
  return c ? [{ slug: t.slug, term: t.term, a: c[0], b: c[1] }] : [];
});

export default function Page() {
  return (
    <MachinePage
      path="/verse"
      title="The Verse Room"
      description={DESCRIPTION}
      eyebrow="Rhymes and riddles"
      parent={{ name: "Academy", href: "/academy" }}
      lead="Rhyme as a way of remembering. A riddle a week, an alphabet, couplets to finish, old sayings weighed, and five riddles hidden round the site."
      punch="academy"
      machines={[
        { id: "weekly", eyebrow: "The weekly riddle", title: "Three clues, one a day.", lead: "Harder than the daily one. A clue on Monday, a second on Tuesday, the last on Wednesday. Answer when you dare.", go: { href: "/#riddle", label: "The daily riddle" }, body: <WeeklyRiddle /> },
        { id: "alphabet", eyebrow: "The trader\u2019s alphabet", title: "From Ask to Zigzag.", lead: "Twenty-six words, a couplet for each and a small picture of what it means.", go: { href: "/glossary", label: "The glossary" }, body: <Alphabet /> },
        { id: "finish", eyebrow: "Finish the rhyme", title: "The first line is given.", lead: `One of three lines completes it. All ${cards.length} glossary couplets are in the pack.`, go: { href: "/academy/practice#duel", label: "The flashcard duel" }, body: <FinishTheRhyme cards={cards} /> },
        { id: "proverbs", wide: true, eyebrow: "The proverb wall", title: "Old sayings, turned over.", lead: "Nine things traders have said for generations. Turn each over for a verdict: does it hold?", go: { href: "/academy", label: "The Academy" }, body: <ProverbWall /> },
        { id: "hunt", eyebrow: "The riddle hunt", title: "Five riddles, hidden.", lead: "Each is behind a small question mark near the foot of a page. Find and solve all five and your passport is stamped.", go: { href: "/desk#passport", label: "Your passport" }, body: <HuntProgress /> },
      ]}
      next={[
        { kind: "Glossary", label: "The glossary", href: "/glossary", note: "Every term, each with its couplet." },
        { kind: "Academy", label: "Practice room", href: "/academy/practice", note: "Build an order, fix a ticket, race the glossary." },
        { kind: "Labs", label: "The Mind Room", href: "/labs/mind", note: "Four games about the person at the screen." },
        { kind: "Desk", label: "My desk", href: "/desk", note: "Your milestones, passport and constellation." },
      ]}
    />
  );
}

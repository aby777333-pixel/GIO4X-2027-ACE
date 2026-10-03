import type { SupabaseClient } from "@supabase/supabase-js";
import { MachinePage } from "@/components/labs/MachinePage";
import { ReaderRiddles, RiddleForm, Sonnet, type ReaderRiddle } from "@/components/verse/Readers";
import { Alphabet, FinishTheRhyme, HuntProgress, ProverbWall, WeeklyRiddle, type Couplet } from "@/components/verse/Verse";
import { getTerm, glossary } from "@/data/glossary";
import { couplets } from "@/data/glossary-couplets";
import { pageMeta } from "@/lib/meta";
import { createPublicSupabase } from "@/lib/supabase/server";

const DESCRIPTION =
  "Rhyme as a way of remembering: a harder riddle each week with three clues, a trader\u2019s alphabet from Ask to Zigzag, a game of finishing glossary couplets, a wall of old market sayings with a verdict on each, and five riddles hidden round the site. Nothing here is advice.";

export const metadata = pageMeta({ title: "The Verse Room", description: DESCRIPTION, path: "/verse" });

const cards: Couplet[] = glossary.flatMap((t) => {
  const c = couplets[t.slug];
  return c ? [{ slug: t.slug, term: t.term, a: c[0], b: c[1] }] : [];
});

// the approved riddles are read again every five minutes, and at once when staff decide one
export const revalidate = 300;

const terms = glossary.map((t) => ({ slug: t.slug, term: t.term })).sort((a, b) => a.term.localeCompare(b.term));

/** The riddles staff have approved, newest first, each with two other terms to choose from. Empty if they cannot be read. */
async function readerRiddles(): Promise<ReaderRiddle[]> {
  const supabase = createPublicSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await (supabase as unknown as SupabaseClient).from("reader_riddles").select("id, line_a, line_b, answer_slug, byline").eq("status", "approved").order("decided_at", { ascending: false }).limit(24);
    if (error || !data) return [];
    return (data as { id: string; line_a: string; line_b: string; answer_slug: string; byline: string }[]).flatMap((r, n) => {
      const answer = getTerm(r.answer_slug);
      if (!answer) return [];
      // two other terms, chosen by the riddle's place in the list so that they do not change between visits
      const others = [glossary[(n * 37 + 11) % glossary.length], glossary[(n * 53 + 71) % glossary.length]].filter((t) => t.slug !== answer.slug);
      const options = [answer, ...others].map((t) => ({ slug: t.slug, term: t.term })).sort((a, b) => a.slug.localeCompare(b.slug));
      return [{ id: r.id, a: r.line_a, b: r.line_b, by: r.byline, answer: { slug: answer.slug, term: answer.term }, options }];
    });
  } catch {
    return [];
  }
}

export default async function Page() {
  const readers = await readerRiddles();
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
        { id: "sonnet", eyebrow: "The sonnet of the month", title: "Fourteen lines on one idea.", lead: "A longer poem, a new one each month.", go: { href: "/academy", label: "The Academy" }, body: <Sonnet /> },
        {
          id: "readers",
          eyebrow: "Readers\u2019 riddles",
          title: "Sent by readers. Read by us first.",
          lead: "Riddles that visitors have written. Send your own: a member of staff reads every one before it appears, and not every one is published.",
          go: { href: "/glossary", label: "The glossary" },
          body: (
            <div className="grid gap-34">
              <ReaderRiddles items={readers} />
              <RiddleForm terms={terms} />
            </div>
          ),
        },
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

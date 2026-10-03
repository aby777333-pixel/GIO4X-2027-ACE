import { JsonLd } from "@/components/seo/JsonLd";
import { ScrollStory } from "@/components/play/Guided";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { PunchLine } from "@/components/ui/PunchLine";
import { riskWarning } from "@/config/legal";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const DESCRIPTION =
  "Leverage told in six steps, as a story that scrolls: a stake of 1,000, the position it answers for at 1:100, a 1% move, what that move is on the position and on the stake, and what a smaller position changes. The drawing changes as each step arrives. Examples, not advice.";

export const metadata = pageMeta({ title: "Leverage, told in six steps | Academy", description: DESCRIPTION, path: "/academy/leverage-story" });

export default function Page() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/academy/leverage-story", name: "Leverage, told in six steps", description: DESCRIPTION })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Academy", href: "/academy" },
          { name: "Leverage, told in six steps", href: "/academy/leverage-story" },
        ]}
        eyebrow="Academy · a story that scrolls"
        title="Leverage, told in six steps."
        lead="Scroll, and the drawing beside the words changes as each step arrives. The figures are examples chosen to make the sum easy."
      />
      <section className="section" aria-label="The story">
        <div className="wrap">
          <ScrollStory />
        </div>
      </section>
      <section className="section-quiet hairline" aria-label="Risk warning">
        <div className="wrap">
          <p className="max-w-measure text-sm text-ink-3">{riskWarning}</p>
        </div>
      </section>
      <PunchLine k="risk" />
      <NextSteps
        items={[
          { kind: "Academy", label: "Lesson: leverage and margin", href: "/academy/what-is-leverage-and-margin", note: "The full lesson, with its questions." },
          { kind: "Labs", label: "Leverage on a tightrope", href: "/labs/workshop#tightrope", note: "The same idea, to handle." },
          { kind: "Tool", label: "Leverage visualiser", href: "/tools/leverage-visualizer", note: "In figures you enter." },
          { kind: "Academy", label: "Your first trade", href: "/academy/first-trade", note: "A ten-minute course in three rooms." },
        ]}
      />
    </>
  );
}

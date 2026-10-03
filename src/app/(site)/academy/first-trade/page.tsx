import { JsonLd } from "@/components/seo/JsonLd";
import { FirstTrade } from "@/components/play/Guided";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { PunchLine } from "@/components/ui/PunchLine";
import { riskWarning } from "@/config/legal";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const DESCRIPTION =
  "A ten-minute course in three rooms: build an order by placing its entry, stop and target; check an order ticket before it is sent; then live with a trade for one minute on an invented price. Invented figures only, and none of it is advice.";

export const metadata = pageMeta({ title: "Your first trade | Academy", description: DESCRIPTION, path: "/academy/first-trade" });

export default function Page() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/academy/first-trade", name: "Your first trade", description: DESCRIPTION })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Academy", href: "/academy" },
          { name: "Your first trade", href: "/academy/first-trade" },
        ]}
        eyebrow="Academy · a ten-minute course"
        title="Your first trade, without a market."
        lead="Three rooms, in the order a trade happens: build it, check it, live with it. Everything is invented and nothing is at stake."
      />
      <section className="section" aria-label="The course">
        <div className="wrap">
          <FirstTrade />
        </div>
      </section>
      <section className="section-quiet hairline" aria-label="Risk warning">
        <div className="wrap">
          <p className="max-w-measure text-sm text-ink-3">{riskWarning}</p>
        </div>
      </section>
      <PunchLine k="stop" />
      <NextSteps
        items={[
          { kind: "Academy", label: "Practice room", href: "/academy/practice", note: "The same rooms, and more, in any order." },
          { kind: "Academy", label: "Leverage, told in six steps", href: "/academy/leverage-story", note: "A story that scrolls." },
          { kind: "Academy", label: "Cheat sheets", href: "/academy/cheat-sheets", note: "Three pages to print." },
          { kind: "Academy", label: "All lessons", href: "/academy", note: "The course, by level and by learning path." },
        ]}
      />
    </>
  );
}

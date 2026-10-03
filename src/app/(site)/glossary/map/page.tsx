import { StarMap, type Star } from "@/components/glossary/StarMap";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { PunchLine } from "@/components/ui/PunchLine";
import { glossary, glossaryTopics, relatedTerms } from "@/data/glossary";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const DESCRIPTION = `The glossary as a star map: ${glossary.length} terms gathered into ${glossaryTopics.length} constellations by topic, with a line between each term and the terms it is related to. Every star opens its definition.`;

export const metadata = pageMeta({ title: "The glossary, as a star map", description: DESCRIPTION, path: "/glossary/map" });

// the sky is laid out once, here: each topic has a place, and its terms spiral out from it by the golden angle
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const centres = glossaryTopics.map((_, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  return { x: 135 + col * 243 + (row ? 0 : 0), y: 175 + row * 290 };
});
const stars: Star[] = [];
glossaryTopics.forEach((topic, ti) => {
  const mine = glossary.filter((t) => t.topic === topic);
  const reach = Math.min(108, 30 + Math.sqrt(mine.length) * 16);
  mine.forEach((t, k) => {
    const rad = reach * Math.sqrt((k + 0.5) / mine.length);
    const ang = k * GOLDEN + ti;
    stars.push({ slug: t.slug, term: t.term, topic: ti, x: Math.round(centres[ti].x + Math.cos(ang) * rad), y: Math.round(centres[ti].y + Math.sin(ang) * rad * 0.9), links: relatedTerms(t, 4).map((r) => r.slug) });
  });
});
const index = new Map(stars.map((s, i) => [s.slug, i]));
const seen = new Set<string>();
const lines: [number, number][] = [];
stars.forEach((s, i) => {
  for (const l of s.links.slice(0, 2)) {
    const j = index.get(l);
    if (j === undefined) continue;
    const key = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push([i, j]);
  }
});

export default function Page() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/glossary/map", name: "The glossary, as a star map", description: DESCRIPTION })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Glossary", href: "/glossary" },
          { name: "Star map", href: "/glossary/map" },
        ]}
        eyebrow="Glossary"
        title="The glossary, as a star map."
        lead={`${glossary.length} terms in ${glossaryTopics.length} constellations. A line joins a term to the terms it is related to. Every star opens its definition.`}
      />
      <section className="section" aria-label="The star map">
        <div className="wrap">
          <StarMap stars={stars} topics={[...glossaryTopics]} lines={lines} />
        </div>
      </section>
      <PunchLine k="glossary" />
      <NextSteps
        items={[
          { kind: "Glossary", label: "The glossary, as a list", href: "/glossary", note: "Every term, by letter and by topic." },
          { kind: "Verse", label: "The Verse Room", href: "/verse", note: "Riddles, an alphabet and old sayings." },
          { kind: "Labs", label: "Market Universe", href: "/labs/market-universe", note: "How instruments, banks and events are related." },
          { kind: "Academy", label: "Flashcard duel", href: "/academy/practice#duel", note: "The couplets, against the clock." },
        ]}
      />
    </>
  );
}

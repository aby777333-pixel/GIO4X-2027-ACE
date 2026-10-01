import { GlossaryIndex, type IndexTerm } from "@/components/knowledge/GlossaryIndex";
import { firstSentence } from "@/components/markets/graph";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { absoluteUrl } from "@/config/site";
import { glossary, glossaryTopics } from "@/data/glossary";
import { pageMeta } from "@/lib/meta";
import "@/components/knowledge/knowledge.css";

const description = `The GIO4X Financial Glossary: ${glossary.length} trading and market terms defined in plain language, with examples, formulae and the tools that use them.`;

export const metadata = pageMeta({ title: "Financial Glossary", description, path: "/glossary" });

export default function GlossaryPage() {
  const terms: IndexTerm[] = glossary.map((t) => ({
    slug: t.slug,
    term: t.term,
    first: firstSentence(t.definition, 190),
    // digits and symbols are filed under "#"; none exist today, but the rail must never break
    letter: /^[A-Z]$/.test(t.letter) ? t.letter : (t.term.charAt(0).toUpperCase().match(/[A-Z]/)?.[0] ?? "#"),
    topic: t.topic,
    aliases: (t.aliases ?? []).map((a) => a.toLowerCase()),
  }));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "DefinedTermSet",
          "@id": absoluteUrl("/glossary"),
          name: "GIO4X Financial Glossary",
          description,
          url: absoluteUrl("/glossary"),
          inLanguage: "en",
          hasDefinedTerm: glossary.map((t) => ({ "@type": "DefinedTerm", name: t.term, url: absoluteUrl(`/glossary/${t.slug}`) })),
        }}
      />
      <PageHero
        quiet
        crumbs={[{ name: "Glossary", href: "/glossary" }]}
        eyebrow="Reference"
        title="Financial Glossary"
        lead={`${glossary.length} terms, defined plainly. Many carry a worked example, a formula, and a link to the tool or lesson that puts the idea to work.`}
      />
      <GlossaryIndex terms={terms} topics={glossaryTopics} />
      <NextSteps
        items={[
          { kind: "Learn", label: "Academy", href: "/academy", note: "The same ideas, taught in order." },
          { kind: "Practice", label: "Trader Toolkit", href: "/tools", note: "Calculators that show their formulae." },
          { kind: "Help", label: "FAQ", href: "/faq", note: "Questions about accounts and trading." },
          { kind: "Read", label: "Intelligence", href: "/intelligence", note: "The publication." },
        ]}
      />
    </>
  );
}

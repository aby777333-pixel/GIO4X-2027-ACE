import Link from "next/link";
import { FaqBrowser } from "@/components/knowledge/FaqBrowser";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { site } from "@/config/site";
import { faqCategories, faqs } from "@/data/faqs";
import { pageMeta } from "@/lib/meta";
import { faqSchema } from "@/lib/schema";
import "@/components/knowledge/knowledge.css";

const description = "Help and frequently asked questions about trading with GIO4X: margin and leverage, orders, costs, funding and identity checks. Searchable, and honest about what is not yet published.";

export const metadata = pageMeta({ title: "Help & FAQ", description, path: "/faq" });

export default function FaqPage() {
  // Structured data describes only what is on the page, and only settled answers:
  // an entry that says "not yet published" is not offered to search engines as an answer.
  const settled = faqs.filter((f) => f.kind === "answer");
  const open = faqs.length - settled.length;

  return (
    <>
      <JsonLd data={faqSchema(settled.map((f) => ({ q: f.q, a: f.a })))} />
      <PageHero
        quiet
        crumbs={[{ name: "Help & FAQ", href: "/faq" }]}
        eyebrow="Help"
        title="Questions, answered plainly."
        lead={`${settled.length} answers on how trading works and how an account is opened and funded. ${open} more questions are listed with an honest “not yet published”: where earlier answers disagreed, they were withdrawn instead of guessed.`}
      />

      <FaqBrowser categories={faqCategories} items={faqs} />

      <section className="section-quiet hairline bg-paper" aria-labelledby="not-answered">
        <div className="wrap phi items-end">
          <div>
            <p className="eyebrow">Not answered here?</p>
            <h2 id="not-answered" className="h2 mt-13 max-w-[18ch]">
              Ask a person.
            </h2>
            <p className="lead mt-13 max-w-[52ch]">Account-specific questions, and anything this page marks as not yet published, are best put to us directly.</p>
          </div>
          <div className="border-t border-line pt-21 lg:border-l lg:border-t-0 lg:pl-55 lg:pt-0">
            <div className="flex flex-wrap gap-13">
              <Link href="/contact" className="btn btn-primary">
                Contact GIO4X
              </Link>
              <a href={`mailto:${site.email}`} className="btn btn-ghost normal-case tracking-normal">
                {site.email}
              </a>
            </div>
            <p className="mt-21 max-w-[44ch] text-sm text-ink-3">
              For definitions, the{" "}
              <Link href="/glossary" className="link">
                glossary
              </Link>{" "}
              is quicker. For what GIO4X has and has not disclosed, see{" "}
              <Link href="/trust/transparency" className="link">
                transparency
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Reference", label: "Glossary", href: "/glossary", note: "Terms, defined plainly." },
          { kind: "Learn", label: "Academy", href: "/academy", note: "How it works, in order." },
          { kind: "Accounts", label: "Account types", href: "/trading/accounts", note: "Indicative conditions, in one table." },
          { kind: "Trust", label: "Trust Centre", href: "/trust", note: "What is published, and what is not." },
        ]}
      />
    </>
  );
}

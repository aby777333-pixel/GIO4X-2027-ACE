import Link from "next/link";
import { FaqBrowser } from "@/components/knowledge/FaqBrowser";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { site } from "@/config/site";
import { faqPlainText } from "@/lib/faq";
import { pageMeta } from "@/lib/meta";
import { faqSchema } from "@/lib/schema";
import { publicFaq } from "@/lib/server/faq";
import "@/components/knowledge/knowledge.css";

const description = "Help and frequently asked questions about trading with GIO4X: margin and leverage, orders, costs, funding and identity checks. Searchable, and honest about what is not yet published.";

export const metadata = pageMeta({ title: "Help & FAQ", description, path: "/faq" });

// The questions in the code, with what staff changed in the console (GIO4X
// Control › Content › FAQ) applied on top. The page is rendered ahead of time
// and read again at most once a minute, so a change shows without a deploy.
// Must be a literal for Next.js: it equals FAQ_REVALIDATE.
export const revalidate = 60;

export default async function FaqPage() {
  // never fails and is never empty: without the database it is the code's FAQ as written
  const { items: faqs, categories: faqCategories } = await publicFaq();

  // Structured data describes only what is on the page, and only settled answers:
  // an entry that says "not yet published" is not offered to search engines as an answer.
  const settled = faqs.filter((f) => f.kind === "answer");
  const open = faqs.length - settled.length;

  return (
    <>
      {/* an answer written in the console carries marks (bold, links); structured data carries the words */}
      <JsonLd data={faqSchema(settled.map((f) => ({ q: f.q, a: f.md ? faqPlainText(f.a) : f.a })))} />
      <PageHero
        quiet
        crumbs={[{ name: "Help & FAQ", href: "/faq" }]}
        eyebrow="Help"
        title="Questions, answered plainly."
        lead={
          open > 0
            ? `${settled.length} answers on how trading works and how an account is opened and funded. ${open} more ${open === 1 ? "question is" : "questions are"} listed with an honest “not yet published”: where earlier answers disagreed, they were withdrawn instead of guessed.`
            : `${settled.length} answers on how trading works and how an account is opened and funded.`
        }
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

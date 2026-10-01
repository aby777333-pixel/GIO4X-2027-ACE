import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { authorLastFirst, bookCategories, books } from "@/data/books";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";
import "@/components/knowledge/knowledge.css";

const description = "The GIO4X Academy reading list: books on market analysis, risk, psychology and quantitative trading, set out as a bibliography by subject. No ratings and no purchase links.";

export const metadata = pageMeta({ title: "Reading list | Academy", description, path: "/academy/books" });

const anchor = (category: string) =>
  category
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export default function BooksPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/academy/books", name: "Reading list: GIO4X Academy", description, type: "CollectionPage" })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Academy", href: "/academy" },
          { name: "Reading list", href: "/academy/books" },
        ]}
        eyebrow="Academy · Bibliography"
        title="A reading list, by subject."
        lead={`${books.length} books that explain markets, risk and the people who trade them. Set out as a bibliography: no covers, no star ratings and no links to buy. Any library or bookshop will have them.`}
      />

      <div className="wrap section-quiet">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-89 gap-y-34 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <nav aria-label="Subjects" className="no-print lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)] lg:self-start">
            <p className="label">Subjects</p>
            <ul className="scroll-x -mx-[var(--gutter)] mt-8 flex gap-x-21 px-[var(--gutter)] lg:mx-0 lg:block lg:border-t lg:border-line-strong lg:px-0">
              {bookCategories.map((g) => (
                <li key={g.category} className="shrink-0 lg:border-b lg:border-line">
                  <a href={`#${anchor(g.category)}`} className="flex min-h-[2.75rem] items-center justify-between gap-13 whitespace-nowrap text-sm text-ink-2 transition-colors duration-fast hover:text-accent">
                    <span>{g.category}</span>
                    <span className="num text-xs text-ink-3">{g.books.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="grid gap-55 lg:gap-89">
            {bookCategories.map((g) => (
              <section key={g.category} id={anchor(g.category)} aria-labelledby={`${anchor(g.category)}-title`} className="scroll-mt-[calc(var(--header-h)+1.3125rem)]">
                <div className="flex items-baseline justify-between gap-21 border-b border-line-strong pb-13">
                  <h2 id={`${anchor(g.category)}-title`} className="h3">
                    {g.category}
                  </h2>
                  <span className="num text-xs text-ink-3">
                    {g.books.length} {g.books.length === 1 ? "title" : "titles"}
                  </span>
                </div>
                <ol>
                  {g.books.map((b) => (
                    <li key={b.slug} id={b.slug} className="grid gap-x-34 gap-y-8 border-b border-line py-21 md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)] lg:py-34">
                      <p className="max-w-[34ch]">
                        <span className="text-sm text-ink-3">{authorLastFirst(b.author)}</span>
                        <cite className="h4 mt-3 block not-italic">{b.title}</cite>
                        <span className="num mt-3 block text-sm text-ink-3">{b.year}</span>
                      </p>
                      <div>
                        <p className="max-w-measure text-ink-2">{b.description}</p>
                        {b.lessons.length > 0 && (
                          <details className="disclose mt-13 max-w-measure">
                            <summary className="min-h-[2.75rem] border-t border-line py-13 text-sm font-medium text-ink">What it covers</summary>
                            <ul className="pb-8">
                              {b.lessons.map((l) => (
                                <li key={l} className="relative py-3 pl-21 text-sm text-ink-2 before:absolute before:left-0 before:top-[0.95em] before:h-px before:w-8 before:bg-accent">
                                  {l}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            <p className="max-w-measure text-sm text-ink-3">
              Years are the year of first publication, or of the edition described. Summaries are GIO4X Academy’s own and are not endorsed by the authors or publishers. Inclusion is not a recommendation to trade in any particular way.{" "}
              <Link href="/trust/editorial-standards" className="link">
                Editorial standards
              </Link>
            </p>
          </div>
        </div>
      </div>

      <NextSteps
        items={[
          { kind: "Academy", label: "The curriculum", href: "/academy#curriculum", note: "Lessons in order." },
          { kind: "Reference", label: "Glossary", href: "/glossary", note: "Terms, defined plainly." },
          { kind: "Read", label: "Intelligence", href: "/intelligence", note: "The publication." },
        ]}
      />
    </>
  );
}

import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { site } from "@/config/site";
import { restrictedJurisdictions } from "@/data/accounts";
import { CARRIED_OVER_NOTICE, legalDocs, type LegalBlock, type LegalDoc } from "@/data/legal-docs";
import { webPageSchema } from "@/lib/schema";
import { DocContents } from "./DocContents";
import { PrintButton } from "./PrintButton";

const two = (n: number) => String(n).padStart(2, "0");

/** An editorial note. Deliberately a different voice from the document text. */
function EditorNote({ text, href, linkLabel }: { text: string; href?: string; linkLabel?: string }) {
  return (
    <aside className="border-l border-line-strong bg-paper py-13 pl-21 pr-13 font-sans text-sm leading-relaxed text-ink-2">
      <p className="label">Editor’s note · not part of the document</p>
      <p className="mt-5">{text}</p>
      {href && linkLabel && (
        <p className="mt-8">
          <Link href={href} className="link">
            {linkLabel}
          </Link>
        </p>
      )}
    </aside>
  );
}

function Jurisdictions() {
  return (
    <div className="border-y border-line py-21">
      <p className="label">Restricted jurisdictions</p>
      <p className="mt-5 text-sm text-ink-3">
        The list published on the previous GIO4X websites. Services are not available to residents of these <span className="num">{restrictedJurisdictions.length}</span> countries.
      </p>
      <ul className="mt-13 columns-2 gap-x-21 text-[0.9375rem] text-ink sm:columns-3">
        {restrictedJurisdictions.map((c) => (
          <li key={c} className="break-inside-avoid py-[0.1875rem]">
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "p":
      return <p>{block.text}</p>;
    case "list":
      return (
        <ul className="grid gap-8">
          {block.items.map((i) => (
            <li key={i} className="relative pl-21 before:absolute before:left-0 before:top-[0.85em] before:h-px before:w-8 before:bg-accent">
              {i}
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="scroll-x">
          <table className="table-gx text-[0.9375rem] max-sm:block sm:min-w-[34rem]">
            <caption className="sr-only">{block.caption}</caption>
            <thead className="max-sm:sr-only">
              <tr>
                {block.head.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="max-sm:block max-sm:border-t max-sm:border-line-strong">
              {block.rows.map((r) => (
                <tr key={r[0]} className="max-sm:block max-sm:border-b max-sm:border-line max-sm:py-13">
                  {r.map((c, i) =>
                    i === 0 ? (
                      <th key={i} scope="row" className="max-sm:block max-sm:!border-0 max-sm:!py-0 !whitespace-nowrap !border-line !py-13 !pr-21 !align-top !font-mono !text-[0.8125rem] !font-medium !normal-case !tracking-normal !text-ink">
                        {c}
                      </th>
                    ) : (
                      <td key={i} className="max-sm:block max-sm:!h-auto max-sm:!border-0 max-sm:!pb-0 max-sm:!pt-5 !py-13 !align-top text-ink-2">
                        {c}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "jurisdictions":
      return <Jurisdictions />;
    case "editor":
      return <EditorNote text={block.text} href={block.href} linkLabel={block.linkLabel} />;
    case "link":
      return (
        <p>
          <Link href={block.href} className="go">
            {block.label}
          </Link>
        </p>
      );
  }
}

/**
 * The one layout for every legal document: quiet hero, a document strip
 * (version, date, status, print), sticky contents on desktop and a disclosure
 * on mobile, a 68ch measure, numbered sections with anchor links.
 */
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  const contents = doc.sections.map((s, i) => ({ id: s.id, n: two(i + 1), title: s.title }));
  const others = legalDocs.filter((d) => d.slug !== doc.slug);
  const carried = doc.origin === "carried-over";

  return (
    <>
      <JsonLd data={webPageSchema({ path: doc.path, name: doc.title, description: doc.summary })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Legal & documents", href: "/legal" },
          { name: doc.short, href: doc.path },
        ]}
        eyebrow={`${doc.category} · Legal & Document Centre`}
        title={doc.title}
        lead={doc.summary}
      />

      {/* document strip */}
      <div className="hairline-b bg-paper">
        <div className="wrap flex flex-wrap items-center justify-between gap-x-34 gap-y-13 py-13">
          <dl className="flex flex-wrap gap-x-34 gap-y-8 text-sm">
            <div>
              <dt className="label">Version</dt>
              <dd className="mt-2 text-ink">{doc.version}</dd>
            </div>
            <div>
              <dt className="label">Last updated</dt>
              <dd className="num mt-2 text-ink">{doc.updated}</dd>
            </div>
            <div>
              <dt className="label">Status</dt>
              <dd className="mt-2">
                <span className={`state ${carried ? "state-pre" : "state-open"}`}>{carried ? "Under legal review" : "Current"}</span>
              </dd>
            </div>
          </dl>
          <PrintButton />
        </div>
      </div>

      <p className="print-only wrap pt-21 text-xs">
        {site.name} · {doc.title} · {doc.version} · Last updated {doc.updated} · {site.url}
        {doc.path}
      </p>

      <article className="section-quiet" aria-label={doc.title}>
        <div className="wrap grid gap-34 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-55 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-89">
          <DocContents items={contents} />

          <div className="max-w-measure">
            {carried && (
              <div className="mb-34 border-l-2 border-warn pl-21">
                <p className="label">Under legal review</p>
                <p className="mt-5 text-md text-ink">{CARRIED_OVER_NOTICE}</p>
                <p className="mt-8 text-sm text-ink-3">
                  The wording below is the previous site’s, kept sentence for sentence. Where a sentence made a claim that could not be supported it was removed, and an editor’s note marks the place. Nothing was added to the text.
                </p>
              </div>
            )}

            {doc.opening && (
              <div className="mb-55 border-y border-line-strong py-34">
                <p className="label">Risk warning</p>
                <p className="mt-13 font-display text-lg leading-[1.45] text-ink md:text-xl">{doc.opening}</p>
              </div>
            )}

            <div className="grid gap-55">
              {doc.sections.map((s, i) => (
                <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-[calc(var(--header-h)+2.125rem)] break-inside-avoid">
                  <h2 id={`${s.id}-title`} className="group flex items-baseline gap-13">
                    <span className="num w-21 shrink-0 text-sm font-semibold tracking-[0.06em] text-ink-3">{two(i + 1)}</span>
                    <span className="h3">{s.title}</span>
                    <a
                      href={`#${s.id}`}
                      aria-label={`Link to section ${i + 1}: ${s.title}`}
                      className="no-print -my-8 grid h-[2.75rem] w-[2.125rem] shrink-0 place-items-center self-center text-md text-ink-3 opacity-60 transition-opacity duration-fast hover:text-accent hover:opacity-100 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      #
                    </a>
                  </h2>
                  <div className="mt-13 grid gap-21 text-[1.0625rem] leading-[1.7] text-ink-2 sm:pl-34">
                    {s.body.map((b, j) => (
                      <Block key={j} block={b} />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {doc.closing && (
              <div className="mt-55 border-t border-line-strong pt-34">
                <p className="text-[1.0625rem] leading-[1.7] text-ink">{doc.closing}</p>
              </div>
            )}

            <div className="mt-55 border-t border-line pt-21 text-sm text-ink-3">
              <p>
                Questions about this document can be sent to{" "}
                <a href={`mailto:${site.email}`} className="link">
                  {site.email}
                </a>{" "}
                or through the{" "}
                <Link href="/contact" className="link">
                  contact page
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </article>

      <NextSteps
        title="Other documents"
        items={[
          ...others.slice(0, 3).map((d) => ({ label: d.short, href: d.path, kind: d.category, note: `Updated ${d.updated}` })),
          { label: "All documents", href: "/legal", kind: "Centre", note: "Search and filter the full list" },
        ]}
      />
    </>
  );
}

import { OpenDoor } from "@/components/trust/OpenDoor";
import Link from "next/link";
import { PegBoard } from "@/components/figures/extra/PegBoard";
import { HeroCompanion } from "@/components/figures/markets/HeroCompanion";
import { JsonLd } from "@/components/seo/JsonLd";
import { DISCLOSURE_GROUPS, LEDGER_REVIEWED, disclosures, pendingCount, publishedCount } from "@/components/trust/disclosures";
import { AskGio4x, Chapter, Status } from "@/components/trust/Parts";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const description = "One table of what GIO4X publishes on this site and what it has not published yet: company details, trading conditions, legal documents, data sources and service information.";

export const metadata = pageMeta({ title: "What we disclose", description, path: "/trust/transparency" });

export default function TransparencyPage() {
  const total = disclosures.length;
  const share = (publishedCount / total) * 100;

  return (
    <>
      <JsonLd data={webPageSchema({ path: "/trust/transparency", name: "What we disclose", description })} />
      <PageHero
        crumbs={[
          { name: "Trust Centre", href: "/trust" },
          { name: "What we disclose", href: "/trust/transparency" },
        ]}
        eyebrow="Transparency"
        title="What we disclose."
        lead="Every item a client would reasonably look for, marked as published or not yet published. Nothing is left off the list because the answer is inconvenient."
        aside={
          <div>
            <p className="label">The ledger today</p>
            <div className="mt-13 flex h-[13px] w-full overflow-hidden rounded-xs border border-line-strong" role="img" aria-label={`${publishedCount} of ${total} items published, ${pendingCount} not yet published`}>
              <span className="block h-full bg-ink" style={{ width: `${share}%` }} />
            </div>
            <dl className="mt-13 flex flex-wrap items-baseline justify-between gap-x-21 gap-y-5 text-sm">
              <div className="flex items-baseline gap-8">
                <dd className="num font-display text-2xl font-light text-ink">{publishedCount}</dd>
                <dt>
                  <Status published />
                </dt>
              </div>
              <div className="flex items-baseline gap-8">
                <dd className="num font-display text-2xl font-light text-ink">{pendingCount}</dd>
                <dt>
                  <Status published={false} />
                </dt>
              </div>
            </dl>
            <p className="mt-13 text-xs text-ink-3">
              Last checked against the site on <span className="num">{LEDGER_REVIEWED}</span>.
            </p>
          </div>
        }
        companion={
          <HeroCompanion layout="beside" label="Reading it" figure={<PegBoard rows={DISCLOSURE_GROUPS.map((g) => disclosures.filter((d) => d.group === g).map((d) => d.status === "published"))} />}>
            “Published” means you can read the item on the linked page today. It does not mean a third party has verified it. Anything not yet published can be requested directly.
          </HeroCompanion>
        }
      />

      <OpenDoor published={publishedCount} pending={pendingCount} />

      <section className="section-quiet" aria-labelledby="ledger">
        <div className="wrap">
          <h2 id="ledger" className="sr-only">
            Disclosure table
          </h2>

          <table className="w-full table-fixed">
            <caption className="sr-only">GIO4X disclosures and their publication status, grouped by subject</caption>
            <colgroup>
              <col />
              <col className="w-[7.75rem] md:w-[13rem]" />
              <col className="w-0 lg:w-[16rem]" />
            </colgroup>
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className="label py-13 pr-13 text-left">
                  Disclosure
                </th>
                <th scope="col" className="label py-13 pr-13 text-left">
                  Status
                </th>
                <th scope="col" className="label hidden py-13 text-left lg:table-cell">
                  Where to read it
                </th>
              </tr>
            </thead>
            {DISCLOSURE_GROUPS.map((g) => {
              const rows = disclosures.filter((d) => d.group === g);
              const done = rows.filter((d) => d.status === "published").length;
              return (
                <tbody key={g}>
                  <tr>
                    <th scope="colgroup" colSpan={3} className="border-b border-line bg-paper px-13 py-8 text-left">
                      <span className="flex items-baseline justify-between gap-13">
                        <span className="font-display text-md font-medium text-ink">{g}</span>
                        <span className="num text-xs font-normal text-ink-3">
                          {done} of {rows.length} published
                        </span>
                      </span>
                    </th>
                  </tr>
                  {rows.map((d) => {
                    const published = d.status === "published";
                    return (
                      <tr key={d.item} className="border-b border-line align-top transition-colors duration-fast hover:bg-surface">
                        <th scope="row" className="py-21 pl-0 pr-13 text-left font-normal md:pl-13">
                          <span className={`h4 block ${published ? "" : "text-ink-2"}`}>{d.item}</span>
                          <span className="mt-5 block max-w-measure text-sm text-ink-3">{d.note}</span>
                          {published && (
                            <Link href={d.href} className="go mt-13 lg:hidden">
                              {d.where}
                            </Link>
                          )}
                        </th>
                        <td className="py-21 pr-13 pt-[1.5rem]">
                          <Status published={published} className="!items-start !whitespace-normal [&::before]:mt-[0.3125rem] [&::before]:shrink-0" />
                        </td>
                        <td className="hidden py-21 pt-[1.4rem] lg:table-cell">
                          {published ? (
                            <Link href={d.href} className="go">
                              {d.where}
                            </Link>
                          ) : (
                            <span className="text-sm text-ink-3">Ask GIO4X</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>

          <p className="mt-21 max-w-measure text-sm text-ink-3">
            “Published” means you can read the item on the linked page today. It does not mean a third party has verified it. “Not yet published” means the item is not on this site, either because the previous GIO4X websites never stated it or because they stated it in
            conflicting ways that have not been resolved.
          </p>
        </div>
      </section>

      <Chapter id="why-gaps" eyebrow="Why there are gaps" title="An empty row is more useful than a confident guess." paper>
        <div className="grid max-w-measure gap-21 text-ink-2" data-reveal suppressHydrationWarning>
          <p>
            When this website was rebuilt, everything the two previous GIO4X websites said was compared line by line. Where they agreed, the fact was carried over. Where they contradicted each other, or made a statement with nothing behind it, the statement was left out and the
            subject was added to this table as not yet published.
          </p>
          <p>
            That is why you will not read here that GIO4X is regulated, how fast orders are filled, or what share of clients lose money. Those are precise claims. They need a regulator’s name and a register entry, measured data, and the firm’s own client records. A row
            moves to “Published” when that evidence is on the page, and not before.
          </p>
        </div>
      </Chapter>

      <section className="section-quiet hairline" aria-label="How to ask">
        <div className="wrap">
          <AskGio4x>Anything marked “not yet published” can be requested directly. Ask for the answer in writing and keep it.</AskGio4x>
        </div>
      </section>

      <NextSteps
        items={[
          { label: "Client funds", href: "/trust/client-funds", kind: "Ask", note: "Five questions for any broker" },
          { label: "Data methodology", href: "/trust/data-methodology", kind: "Source", note: "Where the numbers come from" },
          { label: "Legal & documents", href: "/legal", kind: "Documents", note: "Versions, dates and review status" },
          { label: "Trading conditions", href: "/trading/conditions", kind: "Trading", note: "As currently published" },
        ]}
      />
    </>
  );
}

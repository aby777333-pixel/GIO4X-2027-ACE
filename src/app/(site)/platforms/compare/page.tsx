import Link from "next/link";
import { CompareExplorer } from "@/components/platforms/CompareExplorer";
import { MatrixLegend, NotPublished } from "@/components/platforms/FactState";
import { PlatformFinder } from "@/components/platforms/PlatformFinder";
import { NextSteps, PageHero, SectionHead } from "@/components/ui/Page";
import { site } from "@/config/site";
import { accounts } from "@/data/accounts";
import { assetClasses } from "@/data/instruments";
import { metaquotes, mt5Trademark, platformOrder, platforms } from "@/data/platforms";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Compare platforms: MetaTrader 5 and 777 Raptor",
  description: "A neutral comparison of MetaTrader 5 and 777 Raptor at GIO4X. No winner and no scores: what each platform documents, and what has not been published yet.",
  path: "/platforms/compare",
});

function PendingMatrix({ caption, rowHead, rows }: { caption: string; rowHead: string; rows: { key: string; label: string; href?: string }[] }) {
  return (
    <div className="scroll-x">
      <table className="table-gx min-w-[20rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[34%]">
              {rowHead}
            </th>
            {platformOrder.map((k) => (
              <th key={k} scope="col">
                {platforms[k].name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="!border-line !text-[0.875rem] !font-medium !normal-case !tracking-normal !text-ink">
                {r.href ? (
                  <Link href={r.href} className="link-quiet">
                    {r.label}
                  </Link>
                ) : (
                  r.label
                )}
              </th>
              {platformOrder.map((k) => (
                <td key={k}>
                  <NotPublished />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ComparePage() {
  return (
    <>
      <PageHero
        crumbs={[
          { name: "Platforms", href: "/platforms" },
          { name: "Compare", href: "/platforms/compare" },
        ]}
        eyebrow="Compare platforms"
        title="MetaTrader 5 and 777 Raptor, side by side."
        lead="No winner and no scores. Each cell says what is documented for that platform, or says plainly that it has not been published yet. Where the Raptor column is unfinished, that is the honest state of what GIO4X has confirmed, not a verdict on the platform."
      />

      <section className="section" aria-label="Comparison">
        <div className="wrap">
          <CompareExplorer />
          <p className="mt-21 max-w-measure text-xs text-ink-3">
            MetaTrader 5 entries describe the platform as documented by{" "}
            <a href={metaquotes.href} target="_blank" rel="noopener noreferrer" className="link">
              MetaQuotes
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            ; which of them apply to a GIO4X account is not yet published. 777 Raptor entries are limited to what both previous GIO4X websites stated.
          </p>
        </div>
      </section>

      <section id="finder" className="section hairline scroll-mt-[4rem] bg-paper" aria-labelledby="finder-title">
        <div className="wrap">
          <SectionHead eyebrow="Find your platform" title={<span id="finder-title">Two questions. Facts for both.</span>} lead="A short way to read the matrix. It returns what each platform documents for your answers and leaves the decision where it belongs." />
          <div className="mt-34 lg:mt-55">
            <PlatformFinder />
          </div>
        </div>
      </section>

      <section className="section hairline" aria-labelledby="matrices">
        <div className="wrap">
          <SectionHead
            eyebrow="Availability"
            title={<span id="matrices">Which account, which market, on which platform.</span>}
            lead="These two tables are the ones most visitors want, and they are empty on purpose. GIO4X has not yet published which account types and which instruments are offered on each platform, and a guess would be worse than a blank."
          />
          <MatrixLegend className="mt-34" />
          <div className="mt-21 grid grid-cols-1 gap-55 lg:grid-cols-2">
            <div data-reveal>
              <h3 className="h4">Account × platform</h3>
              <div className="mt-13">
                <PendingMatrix caption="Availability of each account type on each platform: not yet published" rowHead="Account" rows={accounts.map((a) => ({ key: a.key, label: a.name, href: "/trading/accounts" }))} />
              </div>
            </div>
            <div data-reveal>
              <h3 className="h4">Market × platform</h3>
              <div className="mt-13">
                <PendingMatrix caption="Availability of each asset class on each platform: not yet published" rowHead="Asset class" rows={assetClasses.map((a) => ({ key: a.key, label: a.name, href: `/markets/${a.key}` }))} />
              </div>
            </div>
          </div>
          <p className="mt-21 max-w-measure text-sm text-ink-2">
            Raptor is described as covering the asset classes GIO4X lists, but no instrument-level list exists for either platform, so every cell stays in the same state until one does. To ask about a specific combination, write to{" "}
            <a href={`mailto:${site.email}`} className="link">
              {site.email}
            </a>{" "}
            or use the{" "}
            <Link href="/contact" className="link">
              contact page
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="section-quiet hairline bg-paper" aria-labelledby="cmp-notice">
        <div className="wrap grid gap-21 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-55">
          <h2 id="cmp-notice" className="label pt-3">
            Trademark and method
          </h2>
          <div className="max-w-measure text-sm text-ink-2">
            <p>{mt5Trademark}</p>
            <p className="mt-13">The order of the columns carries no meaning. A platform with more published rows is not thereby the better platform; it is the one about which more has been published.</p>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Platforms", label: "MetaTrader 5", href: "/platforms/metatrader-5", note: "Global markets. Familiar workflow." },
          { kind: "Platforms", label: "777 Raptor", href: "/platforms/raptor", note: "Built for the market." },
          { kind: "Trading", label: "Account types", href: "/trading/accounts", note: "Classic, Premium and ECN." },
          { kind: "Trust", label: "Verify a GIO4X link", href: "/trust/verify", note: "Check any address before you use it." },
        ]}
      />
    </>
  );
}

import Link from "next/link";
import { Backdrop } from "@/components/figures/Backdrop";
import { FigureNote } from "@/components/figures/Figure";
import { Documents } from "@/components/figures/trading/Documents";
import { Residence } from "@/components/figures/trading/Residence";
import { NotPublished } from "@/components/platforms/FactState";
import { AccountExplorer } from "@/components/trading/AccountExplorer";
import { AskLine, PendingList, RiskNote } from "@/components/trading/Blocks";
import { DataNote, NextSteps, PageHero, SectionHead } from "@/components/ui/Page";
import { indicativeNote, riskWarning } from "@/config/legal";
import { accountRows, accounts, restrictedJurisdictions } from "@/data/accounts";
import { hasTerm } from "@/data/glossary";
import { platformOrder, platforms } from "@/data/platforms";
import { accountDocuments, accountEligibility, accountPending } from "@/data/trading";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Account types: Classic, Premium and ECN",
  description: "The three GIO4X accounts compared plainly: who each suits, how you pay for trading on each, a worked cost example, the full specification and what you need to open one.",
  path: "/trading/accounts",
});

export default function AccountsPage() {
  return (
    <>
      <PageHero
        crumbs={[
          { name: "Trading", href: "/trading" },
          { name: "Account types", href: "/trading/accounts" },
        ]}
        eyebrow="Account types"
        title="Three accounts. One real difference."
        lead="What chiefly separates Classic, Premium and ECN is how you pay for trading: through the spread alone, or through a raw spread with a commission shown as its own line."
      />

      <section className="section" aria-labelledby="explore">
        <div className="wrap">
          {/* no scroll reveal here: this block is in the first viewport */}
          <div>
            <p className="eyebrow">Explore</p>
            <h2 id="explore" className="h2 mt-13 max-w-[22ch]">
              Choose by how you pay.
            </h2>
            <p className="lead mt-13 max-w-[58ch]">Select an account to read its character. The worked example beneath keeps all three in view.</p>
            <Link href="/trading/accounts/choose" className="go mt-13 min-h-[2.75rem]">
              Not sure which? Answer four questions
            </Link>
          </div>
          <div className="mt-34 lg:mt-55" data-tour="accounts">
            <AccountExplorer />
          </div>
          <DataNote status="indicative" source="GIO4X published account conditions" className="mt-21">
            {indicativeNote}
          </DataNote>
        </div>
      </section>

      {/* full specification */}
      <section className="section hairline bg-paper" aria-labelledby="spec">
        <div className="wrap">
          <SectionHead eyebrow="Specification" title={<span id="spec">Everything published, in one table.</span>} lead="Dotted terms open the glossary. Where the two previous GIO4X websites disagreed, the figure is shown as “up to” or left out." />
          <div className="scroll-x mt-34" data-reveal>
            <table className="table-gx min-w-[40rem]">
              <caption className="sr-only">Full specification of the Classic, Premium and ECN accounts</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-[28%]">
                    <span className="sr-only">Specification</span>
                  </th>
                  {accounts.map((a) => (
                    <th key={a.key} scope="col" className={a.key === "premium" ? "!border-b-prestige" : ""}>
                      <span className="block font-display text-xl font-normal normal-case tracking-normal text-ink">{a.name}</span>
                      <span className="mt-2 block font-sans normal-case tracking-normal text-ink-3">{a.suits}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accountRows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row" className="!border-line !py-0 !text-[0.8125rem] !font-normal !normal-case !tracking-normal">
                      {r.term && hasTerm(r.term) ? (
                        <Link href={`/glossary/${r.term}`} className="link-quiet underline decoration-line-strong decoration-dotted underline-offset-4">
                          {r.label}
                        </Link>
                      ) : r.key === "stopOut" && hasTerm("stop-out") ? (
                        <Link href="/glossary/stop-out" className="link-quiet underline decoration-line-strong decoration-dotted underline-offset-4">
                          {r.label}
                        </Link>
                      ) : (
                        r.label
                      )}
                    </th>
                    {accounts.map((a) => (
                      <td key={a.key} className="num text-[0.9375rem] font-medium">
                        {String(a[r.key])}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="!border-line !text-[0.8125rem] !font-normal !normal-case !tracking-normal !py-13 !align-top">
                    Included
                  </th>
                  {accounts.map((a) => (
                    <td key={a.key} className="!h-auto !py-13 !align-top text-sm text-ink-2">
                      {a.extras.length ? (
                        <ul className="grid gap-3">
                          {a.extras.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-ink-3">None listed</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="!border-line !text-[0.8125rem] !font-normal !normal-case !tracking-normal !py-13 !align-top">
                    Platforms
                  </th>
                  {accounts.map((a) => (
                    <td key={a.key} className="!h-auto !py-13 !align-top">
                      <NotPublished />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <DataNote status="indicative" source="GIO4X published account conditions" className="mt-13">
            Spreads are minimums and widen with market conditions. The leverage available to you depends on the instrument and your jurisdiction, and higher leverage increases risk as much as exposure.
          </DataNote>
          <p className="mt-13 max-w-measure text-sm text-ink-2">
            Which accounts are offered on {platforms[platformOrder[0]].name} and which on {platforms[platformOrder[1]].name} has not been published.{" "}
            <Link href="/platforms/compare#matrices" className="link">
              See the platform comparison
            </Link>
            .
          </p>
        </div>
      </section>

      {/* opening an account */}
      <section className="section hairline" aria-labelledby="open">
        <div className="wrap phi phi-r items-start">
          <div data-reveal>
            <p className="eyebrow">Opening an account</p>
            <h2 id="open" className="h2 mt-13">
              What you will need.
            </h2>
            <p className="lead mt-21">{accountEligibility}</p>
            <FigureNote figure={<Documents ratio={2.1} />} label="Worth knowing">
              The same two documents are what verification asks for before a first withdrawal is released, so it is simplest to have them to hand from the start.{" "}
              <Link href="/trading/funding" className="link">
                Funding and withdrawals
              </Link>{" "}
              gives the reasons.
            </FigureNote>
          </div>
          <div className="grid gap-55">
            <div data-reveal>
              <h3 className="label">Documents</h3>
              <dl className="mt-13 border-t border-line-strong">
                {accountDocuments.map((d) => (
                  <div key={d.label} className="grid gap-x-34 gap-y-3 border-b border-line py-21 md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)]">
                    <dt className="h4">{d.label}</dt>
                    <dd className="text-ink-2">{d.detail}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-13 text-sm text-ink-2">Further documents may be requested for compliance purposes.</p>
            </div>

            <div data-reveal>
              <h3 className="label">Not yet published</h3>
              <PendingList items={accountPending} className="mt-13" />
              <AskLine className="mt-13">To ask about any of these:</AskLine>
            </div>
          </div>
        </div>
      </section>

      {/* restricted jurisdictions */}
      <section className="section-quiet hairline bg-paper" aria-labelledby="restricted">
        <div className="wrap grid gap-21 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)] lg:gap-55">
          <div>
            <h2 id="restricted" className="h3">
              Where GIO4X does not offer its services.
            </h2>
            <p className="mt-13 text-sm text-ink-2">Services are not available to residents of the jurisdictions listed. The list is carried over as previously published and may not be complete; your own country’s rules apply as well.</p>
            <FigureNote figure={<Residence ratio={3} />} className="!mt-21">
              Two tests apply, and both turn on where you are resident: this list, and whether trading forex and CFDs is permitted where you live.
            </FigureNote>
          </div>
          <ul className="columns-2 gap-x-34 text-sm text-ink-2 sm:columns-3">
            {restrictedJurisdictions.map((c) => (
              <li key={c} className="break-inside-avoid border-b border-line py-5">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* calm CTA */}
      <section className="section hairline relative" aria-labelledby="ready">
        <Backdrop variant="orbits" />
        <div className="wrap flex flex-col gap-34 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[40rem]">
            <h2 id="ready" className="h2">
              When you are ready, not before.
            </h2>
            <p className="lead mt-13">There is no deadline and no offer that expires. Read the risk disclosure, work a few examples in the tools, and open an account when the decision is yours.</p>
          </div>
          <div className="flex flex-wrap gap-13">
            <Link href="/open-account" className="btn btn-primary btn-lg">
              Open an account
            </Link>
            <Link href="/legal/risk" className="btn btn-ghost btn-lg">
              Risk disclosure
            </Link>
          </div>
        </div>
      </section>

      <RiskNote text={riskWarning} />

      <NextSteps
        items={[
          { kind: "Trading", label: "Trading conditions", href: "/trading/conditions", note: "Indicative spread and leverage by instrument." },
          { kind: "Trading", label: "Funding and withdrawals", href: "/trading/funding", note: "How money moves in and out." },
          { kind: "Tools", label: "Cost Lab", href: "/tools/cost-lab", note: "Price the same trade on each account." },
          { kind: "Platforms", label: "Choose a platform", href: "/platforms", note: "777 Raptor and MetaTrader 5." },
        ]}
      />
    </>
  );
}

import Link from "next/link";
import { MatchCount } from "@/components/figures/extra/ShortColumns";
import { AccountChooser, type SignUp } from "@/components/trading/AccountChooser";
import { RiskNote } from "@/components/trading/Blocks";
import { readAnswers } from "@/components/trading/choose";
import { DataNote, NextSteps, PageHero } from "@/components/ui/Page";
import { destinationAddress, portals } from "@/config/destinations";
import { educationalNote, indicativeNote, riskWarning } from "@/config/legal";
import { accounts, type AccountKey } from "@/data/accounts";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Choose an account: four questions",
  description: "Four plain questions, then the GIO4X account whose published conditions agree with most of your answers, with every fact that counted and every one worth weighing against it. Not advice.",
  path: "/trading/accounts/choose",
});

/**
 * The sign-up destination for each account, from the registry and nowhere
 * else. The portal's own sign-up page reads `plan` (classic | premium | ecn);
 * it is added only when the destination is that page on this site. An address
 * configured by hand is linked as it is, because what it accepts is not known.
 */
function signUp(): SignUp {
  const dest = portals.openAccount;
  if (dest.status !== "CONFIGURED") return { kind: "interest" };
  const sameSite = dest.url.startsWith("/");
  const hrefs = Object.fromEntries(accounts.map((a) => [a.key, sameSite ? `${dest.url}?plan=${a.key}` : dest.url])) as Record<AccountKey, string>;
  return { kind: "portal", hrefs, address: destinationAddress(dest.url) };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ChooseAccountPage({ searchParams }: Props) {
  // the four answer codes, if the plain form was submitted; anything else in the address is ignored
  const initial = readAnswers(await searchParams);

  return (
    <>
      <PageHero
        quiet
        crumbs={[
          { name: "Trading", href: "/trading" },
          { name: "Account types", href: "/trading/accounts" },
          { name: "Choose", href: "/trading/accounts/choose" },
        ]}
        eyebrow="Account types"
        title="Four questions, one match."
        lead="Answer plainly and the account whose published conditions agree with most of your answers is named, with each fact that counted. It reads the same specification as the comparison table and adds nothing to it."
      >
        <a href="#chooser" className="btn btn-primary">
          Begin
        </a>
        <Link href="/trading/accounts" className="btn btn-ghost">
          Compare all three
        </Link>
      </PageHero>

      <section id="chooser" className="section scroll-mt-[var(--header-h)]" aria-label="The account chooser">
        <div className="wrap">
          <AccountChooser initial={initial} signup={signUp()} />
          <DataNote status="indicative" source="GIO4X published account conditions" className="mt-34">
            {indicativeNote} {educationalNote}
          </DataNote>
        </div>
      </section>

      <section className="section-quiet hairline bg-paper" aria-labelledby="how">
        <div className="wrap phi phi-r items-start">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]">
            <p className="eyebrow">How the match is made</p>
            <h2 id="how" className="h3 mt-13 max-w-[18ch]">
              A count of published facts, in the open.
            </h2>
            {/* the short column was empty beneath the heading: a figure that says the same thing as the text beside it */}
            <div className="mt-34 max-w-[28rem]">
              <div className="flat rounded-[8px] border border-line bg-surface/60 p-13">
                <MatchCount />
              </div>
            </div>
          </div>
          <ol className="border-t border-line">
            {[
              { t: "Your first deposit decides which accounts are open to you.", d: `Each account has a published minimum deposit: ${accounts.map((a) => `${a.name} ${a.minDeposit}`).join(", ")}. An account above your first deposit is never named as the match, though it is mentioned if it agreed with more of your answers.` },
              { t: "Each answer is compared with the specification.", d: "Who the account was published as suiting, whether it charges a commission, how its minimum spread compares, whether overnight swap applies and what is included. Every agreement is listed under “Why it matched”." },
              { t: "The account with most agreements is named.", d: "Where two agree equally, the one with the lower minimum deposit is named, because it commits less." },
              { t: "What counts against it is listed too.", d: "The widest spread, a commission, an overnight swap, no account manager, the highest minimum: whichever applies is shown beside the match, not left for later." },
            ].map((p, i) => (
              <li key={p.t} className="grid grid-cols-[2.125rem_minmax(0,1fr)] gap-x-13 border-b border-line py-21">
                <span className="num pt-3 text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="h4">{p.t}</h3>
                  <p className="mt-5 max-w-measure text-ink-2">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <RiskNote text={riskWarning} />

      <NextSteps
        items={[
          { kind: "Trading", label: "Account types", href: "/trading/accounts", note: "The three accounts side by side, with the full specification." },
          { kind: "Tools", label: "Cost Lab", href: "/tools/cost-lab", note: "Price the same trade on each account." },
          { kind: "Labs", label: "Practice desk", href: "/labs/simulator", note: "A practice trade on invented prices, told step by step." },
          { kind: "Legal", label: "Risk disclosure", href: "/legal/risk", note: "Read this before trading with leverage." },
        ]}
      />
    </>
  );
}

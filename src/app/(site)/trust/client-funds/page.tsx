import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { AskGio4x, Chapter, Rows, Statement, Status } from "@/components/trust/Parts";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { companyLine } from "@/config/legal";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const description = "The statement GIO4X has published about where client funds are held, what holding funds separately does and does not protect against, and the questions to ask any broker.";

export const metadata = pageMeta({ title: "Client funds", description, path: "/trust/client-funds" });

type Question = { q: string; why: string; published: boolean; answer: string; href?: string; linkLabel?: string };

const questions: Question[] = [
  {
    q: "Which legal entity holds my account?",
    why: "Your contract, and any claim you might have, is with a specific company in a specific country, not with a brand name.",
    published: true,
    answer: `${companyLine} The carried-over Terms do not yet name the entity that contracts with clients; that point is under legal review.`,
    href: "/legal/terms",
    linkLabel: "Terms of Service",
  },
  {
    q: "Which regulator supervises that entity, if any?",
    why: "A regulator sets the rules for how client money is held and gives you somewhere to complain. A company registration number is not a regulatory authorisation.",
    published: false,
    answer: "No regulator, licence number or register entry for GIO4X is published on this site.",
  },
  {
    q: "Where are client funds held?",
    why: "The name and country of the institution determine which law governs the account and how sound the holder is.",
    published: false,
    answer: "GIO4X’s published statement is on this page. The institutions are not named and their countries are not stated.",
  },
  {
    q: "What happens to my money if the broker becomes insolvent?",
    why: "Whether separately held funds are returned to clients, and how quickly, depends on the law that applies and on whether a compensation scheme exists.",
    published: false,
    answer: "Not published. The carried-over Risk Disclosure states only that there is no guarantee that all funds will be recovered. No compensation scheme or insurance is stated.",
    href: "/legal/risk#insolvency",
    linkLabel: "Risk Disclosure, section 12",
  },
  {
    q: "Is there negative-balance protection in the terms?",
    why: "Without it in the contract, a fast market can leave you owing more than you deposited.",
    published: true,
    answer:
      "The carried-over Terms and Risk Disclosure contain no such clause. They state that you may lose more than your initial deposit. Take that as the position unless GIO4X confirms otherwise to you in writing.",
    href: "/legal/terms#risk-acknowledgement",
    linkLabel: "Terms, section 6",
  },
];

export default function ClientFundsPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/trust/client-funds", name: "Client funds", description })} />
      <PageHero
        crumbs={[
          { name: "Trust Centre", href: "/trust" },
          { name: "Client funds", href: "/trust/client-funds" },
        ]}
        eyebrow="Client funds"
        title="What is published about your money, and what is not."
        lead="One statement about client funds appeared consistently on both previous GIO4X websites. This page sets it out in plain words, explains what it means in general, and lists what remains unanswered."
      />

      <section className="section-quiet" aria-labelledby="statement">
        <div className="wrap phi items-start">
          <div>
            <h2 id="statement" className="sr-only">
              The published statement
            </h2>
            <Statement
              label="GIO4X’s published statement"
              source={
                <>
                  A plain-words rendering of what both previous GIO4X websites said. It is GIO4X’s own statement. It has not been verified by a third party, and it is not accompanied here by the name of any institution.
                </>
              }
            >
              Client funds are held with banking institutions, in accounts separate from the company’s own operating funds.
            </Statement>
          </div>
          <div data-reveal suppressHydrationWarning>
            <p className="eyebrow">What this page leaves out</p>
            <p className="mt-13 text-ink-2">
              The previous websites went further: they graded the banks, quoted a total of funds held, and described insurance and protection schemes. None of that was evidenced and some of it contradicted the sites’ own risk text, so it is not repeated.
            </p>
            <p className="mt-13 text-sm text-ink-3">If any of it is confirmed, it will be published with the name, the document and the date.</p>
          </div>
        </div>
      </section>

      <Chapter id="what-separation-means" eyebrow="In general terms" title="What holding funds separately means" lead="This is a general explanation of the practice. It is not a description of GIO4X’s specific arrangements, which are not yet published in detail." paper>
        <Rows
          items={[
            {
              t: "Two sets of accounts",
              d: "A firm that holds client money separately keeps it in bank accounts that are distinct from the accounts it uses to pay its own salaries, rent and suppliers. The purpose is that client money can be identified as client money.",
            },
            {
              t: "A record of who is owed what",
              d: "Separation is only as good as the firm’s books. The firm has to reconcile the money in the client accounts against its records of each client’s balance, and to do so regularly.",
            },
            {
              t: "The law decides what it is worth",
              d: "Whether separately held money is legally ring-fenced from a firm’s creditors depends on the law of the country, the terms of the bank account and any regulator’s rules. The same words can mean strong protection in one jurisdiction and little in another.",
            },
          ]}
        />
      </Chapter>

      <Chapter id="what-it-does-not-do" eyebrow="The limits" title="What it does not protect against" flip>
        <Rows
          items={[
            { t: "Market losses", d: "Money you lose by trading is lost. Separation concerns where your balance is kept, not what happens to it when a position moves against you." },
            { t: "Losses larger than your deposit", d: "Leveraged positions can lose more than the money in the account. Where the terms allow it, you can owe the difference." },
            { t: "The failure of the bank itself", d: "Money in a client account is a deposit at a bank. If that bank fails, what is recovered depends on that bank and that country’s rules." },
            { t: "A shortfall at the firm", d: "If a firm’s records are wrong or money is missing, separation does not make up the difference. That is what compensation schemes exist for, where there is one." },
            { t: "Delay", d: "Even where client money is fully protected in law, returning it after an insolvency can take a long time." },
          ]}
        />
        <p className="mt-21 max-w-measure text-sm text-ink-3">
          On this last subject the carried-over{" "}
          <Link href="/legal/risk#insolvency" className="link">
            Risk Disclosure
          </Link>{" "}
          says it directly: there is no guarantee that all funds will be recovered.
        </p>
      </Chapter>

      <section className="section hairline bg-paper" aria-labelledby="questions">
        <div className="wrap">
          <div className="phi items-end">
            <div data-reveal suppressHydrationWarning>
              <p className="eyebrow">Due diligence</p>
              <h2 id="questions" className="h2 mt-13 max-w-[18ch]">
                Questions you should ask any broker, including us.
              </h2>
            </div>
            <p className="lead" data-reveal suppressHydrationWarning>
              Five questions, why each one matters, and where GIO4X stands on it today. Where the answer is not published, the entry says so.
            </p>
          </div>

          <ol className="mt-55 border-t border-line-strong">
            {questions.map((x, i) => (
              <li key={x.q} className="grid gap-x-34 gap-y-13 border-b border-line py-34 lg:grid-cols-[3.4375rem_minmax(0,1fr)_minmax(0,1fr)]" data-reveal suppressHydrationWarning>
                <span className="num font-display text-2xl font-light leading-none text-prestige-ink">{i + 1}</span>
                <div>
                  <h3 className="h3 max-w-[22ch]">{x.q}</h3>
                  <p className="mt-13 max-w-narrow text-ink-2">{x.why}</p>
                </div>
                <div className="border-l border-line pl-21 lg:pl-34">
                  <p className="label">GIO4X today</p>
                  <p className="mt-8">
                    <Status published={x.published} />
                  </p>
                  <p className="mt-8 max-w-narrow text-ink">{x.answer}</p>
                  {x.href && x.linkLabel && (
                    <Link href={x.href} className="go mt-13">
                      {x.linkLabel}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-34 grid gap-34 lg:grid-cols-phi lg:items-start">
            <AskGio4x>The regulatory details for GIO4X are not yet published on this site. You can request them, and the answers to any of the questions above, before you open an account. Ask for the reply in writing and keep it.</AskGio4x>
            <p className="text-sm text-ink-3">
              Put the same five questions to every broker you consider. A firm that answers them with names, numbers and documents has told you something. So has a firm that does not.
            </p>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { label: "What we disclose", href: "/trust/transparency", kind: "Disclose", note: "Every item, published or not yet" },
          { label: "Risk Disclosure", href: "/legal/risk", kind: "Risk", note: "Including the section on insolvency" },
          { label: "Funding & withdrawals", href: "/trading/funding", kind: "Trading", note: "How money moves in and out" },
          { label: "Contact GIO4X", href: "/contact", kind: "Ask", note: "Request the details in writing" },
        ]}
      />
    </>
  );
}

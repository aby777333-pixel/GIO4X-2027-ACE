import Link from "next/link";
import { Colonnade } from "@/components/figures/stage/Colonnade";
import { HeroCompanion } from "@/components/figures/stage/HeroCompanion";
import { JsonLd } from "@/components/seo/JsonLd";
import { LEDGER_REVIEWED, pendingCount, publishedCount } from "@/components/trust/disclosures";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const description = "How to check what GIO4X says: verify a link, see what is disclosed and what is not, read where each number comes from, and find the documents.";

export const metadata = pageMeta({ title: "Trust Centre", description, path: "/trust" });

const sections = [
  { href: "/trust/verify", k: "Verify", t: "Official Destination Checker", d: "Paste any address and compare it with the registry of GIO4X domains and approved third parties." },
  { href: "/trust/security", k: "Protect", t: "Online security", d: "What this website does that you can check from your own browser, and what you can do yourself." },
  { href: "/trust/client-funds", k: "Ask", t: "Client funds", d: "The statement GIO4X has published, what it does not cover, and the questions to put to any broker." },
  { href: "/trust/transparency", k: "Disclose", t: "What we disclose", d: "One table of what is published and what is not yet published, item by item." },
  { href: "/trust/data-methodology", k: "Source", t: "Data methodology", d: "Where every number on this site comes from, when it was fixed and how it is calculated." },
  { href: "/trust/ai", k: "Bound", t: "AI at GIO4X", d: "What is and is not a language model on this site today, and the limits any future assistant will keep." },
  { href: "/trust/editorial-standards", k: "Correct", t: "Editorial standards", d: "Sources, bylines, corrections and the conflict of interest a broker has when it publishes research." },
];

const also = [
  { href: "/legal/risk", t: "Risk Disclosure", d: "Leveraged trading can lose money quickly. In readable type." },
  { href: "/legal", t: "Legal documents", d: "Every document, with version, date and review status." },
  { href: "/preferences", t: "Privacy preferences", d: "See and clear what this site stores in your browser." },
  { href: "/status", t: "System status", d: "The state of this website and its data sources." },
];

const principles = [
  { t: "Name what is not known.", d: "Where GIO4X has not yet published a fact, the page says “not yet published” and tells you where to ask. It does not fill the gap with a phrase." },
  { t: "Show the check, not the badge.", d: "There are no seals, scores or shields here. Each page ends in something you can test yourself: an address, a header, a formula, a document." },
  { t: "Keep the risk in ordinary type.", d: "Risk warnings are set at reading size, in the place where the decision is made, and say the same thing on every page." },
];

export default function TrustCentrePage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/trust", name: "GIO4X Trust Centre", description })} />
      <PageHero
        crumbs={[{ name: "Trust Centre", href: "/trust" }]}
        eyebrow="GIO4X Trust Centre"
        title="Trust should never be an assumption."
        lead="Trust is not a claim. It is an architecture. These pages are built so that you can check what GIO4X says, and see plainly what it has not yet said."
        aside={
          <div>
            <p className="label">The disclosure ledger</p>
            <dl className="mt-13 grid grid-cols-2 gap-px border border-line bg-line">
              <div className="bg-bg p-21">
                <dt className="state state-open">Published</dt>
                <dd className="num mt-13 font-display text-3xl font-light leading-none text-ink">{publishedCount}</dd>
              </div>
              <div className="bg-bg p-21">
                <dt className="state state-off whitespace-normal">Not yet published</dt>
                <dd className="num mt-13 font-display text-3xl font-light leading-none text-ink">{pendingCount}</dd>
              </div>
            </dl>
            <p className="mt-13 text-xs text-ink-3">
              Items in the transparency table, counted on <span className="num">{LEDGER_REVIEWED}</span>. Published means you can read it on this site, not that a third party has verified it.
            </p>
            <Link href="/trust/transparency" className="go mt-13">
              Read the table
            </Link>
          </div>
        }
        companion={
          <HeroCompanion figure={<Colonnade />}>
            The Trust Centre has seven sections, and each one ends in something you can test yourself: an address, a header, a formula, a document. There are no seals, scores or shields here.
          </HeroCompanion>
        }
      />

      <section className="section" aria-labelledby="trust-index">
        <div className="wrap">
          <h2 id="trust-index" className="sr-only">
            Sections of the Trust Centre
          </h2>
          <ol className="border-t border-line-strong">
            {sections.map((s, i) => (
              <li key={s.href} className="border-b border-line" data-reveal suppressHydrationWarning style={{ ["--i" as string]: Math.min(i, 5) }}>
                <Link href={s.href} className="group grid items-baseline gap-x-21 gap-y-5 py-21 transition-colors duration-fast hover:bg-surface md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)_5.5rem] md:px-13">
                  <span className="flex items-baseline gap-13">
                    <span className="num w-21 shrink-0 text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="label block">{s.k}</span>
                      <span className="h3 mt-3 block transition-colors duration-fast group-hover:text-accent">{s.t}</span>
                    </span>
                  </span>
                  <span className="pl-34 text-ink-2 md:pl-0">{s.d}</span>
                  <span className="pl-34 md:justify-self-end md:pl-0">
                    <span className="go" aria-hidden>
                      Open
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-quiet hairline bg-paper" aria-labelledby="trust-also">
        <div className="wrap phi phi-r items-start">
          <div data-reveal suppressHydrationWarning>
            <p className="eyebrow">Also part of the record</p>
            <h2 id="trust-also" className="h3 mt-13 max-w-[18ch]">
              Documents, controls and status.
            </h2>
          </div>
          <ul className="grid border-l border-t border-line sm:grid-cols-2">
            {also.map((a, i) => (
              <li key={a.href} className="border-b border-r border-line" data-reveal suppressHydrationWarning style={{ ["--i" as string]: i }}>
                <Link href={a.href} className="group block h-full p-21 transition-colors duration-fast hover:bg-surface">
                  <span className="h4 block transition-colors duration-fast group-hover:text-accent">{a.t}</span>
                  <span className="mt-5 block text-sm text-ink-3">{a.d}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="trust-rules">
        <div className="wrap phi items-start">
          <ol className="border-t border-line">
            {principles.map((p, i) => (
              <li key={p.t} className="grid grid-cols-[3.4375rem_1fr] gap-x-13 border-b border-line py-21" data-reveal suppressHydrationWarning style={{ ["--i" as string]: i }}>
                <span className="num pt-3 text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="h4">{p.t}</h3>
                  <p className="mt-8 max-w-measure text-ink-2">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div data-reveal suppressHydrationWarning>
            <p className="eyebrow">How this centre is written</p>
            <h2 id="trust-rules" className="h2 mt-13 max-w-[14ch]">
              Three rules we hold ourselves to.
            </h2>
            <p className="mt-21 max-w-narrow text-ink-2">
              You will not find the words that brokers usually reach for on these pages. A statement about safety that cannot be checked is not a reason to trust anyone, so it is not made.
            </p>
          </div>
        </div>
      </section>

      <NextSteps
        title="Start with"
        items={[
          { label: "Check a link", href: "/trust/verify", kind: "Verify", note: "Is this address really GIO4X?" },
          { label: "What we disclose", href: "/trust/transparency", kind: "Disclose", note: `${publishedCount} published, ${pendingCount} not yet` },
          { label: "Risk Disclosure", href: "/legal/risk", kind: "Risk", note: "Read this before you trade" },
          { label: "Contact GIO4X", href: "/contact", kind: "Ask", note: "For anything not on this site" },
        ]}
      />
    </>
  );
}

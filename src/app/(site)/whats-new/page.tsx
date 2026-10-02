import Link from "next/link";
import { ChangeMarks } from "@/components/figures/company/ChangeMarks";
import { FigureNote } from "@/components/figures/Figure";
import { EmptyState, NextSteps, PageHero } from "@/components/ui/Page";
import { glossary } from "@/data/glossary";
import { assetClasses, instruments } from "@/data/instruments";
import { centralBanks, econEvents } from "@/data/knowledge";
import { tools } from "@/data/tools";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "What’s new",
  description: "The GIO4X changelog: what changed on this website and when. One entry so far, describing the current release.",
  path: "/whats-new",
});

type Change = { t: string; d: string; href?: string; go?: string };
type Group = { kind: "New" | "Changed" | "Removed"; items: Change[] };
type Release = { id: string; date: string; dateLabel: string; title: string; summary: string; groups: Group[] };

/** Real entries only. A release is added here when it ships; nothing is back-filled. */
const releases: Release[] = [
  {
    id: "2026-10-01",
    date: "2026-10-01",
    dateLabel: "1 October 2026",
    title: "A new GIO4X website",
    summary: "The site has been rebuilt from the ground up around one rule: publish only what can be shown. This entry lists what the release contains and what was deliberately left out.",
    groups: [
      {
        kind: "New",
        items: [
          { t: "A design system", d: "A palette sampled from the logo, a layout built on the golden ratio, Inter and TT Norms, light and dark themes and seven accent moods.", href: "/design", go: "Designing GIO4X" },
          { t: "Market Command", d: `An overview of sessions and reference rates, a world market clock, currency strength from European Central Bank reference data, ${centralBanks.length} central banks and ${econEvents.length} economic releases explained.`, href: "/markets", go: "Markets" },
          { t: "Instrument pages", d: `${instruments.length} instruments across ${assetClasses.length} asset classes, each with its indicative conditions labelled as indicative.`, href: "/markets", go: "Asset classes" },
          { t: "Trader Toolkit", d: `${tools.length} calculators and visualisers. Each shows its formula and works on the figures you enter.`, href: "/tools", go: "All tools" },
          { t: "Glossary", d: `${glossary.length} definitions, linked to each other and to the tools that use them.`, href: "/glossary", go: "Glossary" },
          { t: "Two platform guides and a comparison", d: "MetaTrader 5 and 777 Raptor described side by side, with neither ranked above the other.", href: "/platforms/compare", go: "Compare platforms" },
          { t: "Trust Centre and link verifier", d: "A registry of official destinations and a tool that checks any address against it, with pages on transparency and data methodology.", href: "/trust/verify", go: "Verify a link" },
          { t: "Command bar and search", d: "Press Ctrl or ⌘ and K on any page. It understands symbols, definitions, calculators and typing mistakes.", href: "/search", go: "Search" },
          { t: "Display & privacy", d: "Theme, accent, density and comfort settings, a time-zone preference, and a list of everything the site stores in your browser with one button to clear it.", href: "/preferences", go: "Preferences" },
          { t: "A site directory", d: "Every section, instrument, tool and term on one page.", href: "/explore", go: "Explore GIO4X" },
        ],
      },
      {
        kind: "Changed",
        items: [
          { t: "Sign-in is a gateway", d: "Portal destinations appear as links only once they are verified. Until then each is shown as not connected, with no placeholder address.", href: "/sign-in", go: "Sign in" },
          { t: "Contact is one form", d: "Routed by topic, with a reference returned for every message received.", href: "/contact", go: "Contact" },
          { t: "Risk is stated in ordinary type", d: "The risk warning and disclosure are set at reading size, at the point of decision.", href: "/legal/risk", go: "Risk disclosure" },
        ],
      },
      {
        kind: "Removed",
        items: [
          { t: "Figures that could not be evidenced", d: "Client counts, trading volumes, execution speeds, uptime percentages, awards and testimonials shown on earlier versions of the site are not carried into this one.", href: "/about#unsaid", go: "What we have chosen not to say" },
          { t: "A leadership page, a company timeline and job listings", d: "None is published until its contents are confirmed.", href: "/trust/transparency", go: "Transparency" },
          { t: "A status percentage", d: "The status page now shows what is monitored, which at present is nothing.", href: "/status", go: "System status" },
        ],
      },
    ],
  },
];

const kindStyle: Record<Group["kind"], string> = { New: "text-pos", Changed: "text-accent", Removed: "text-ink-3" };
const kindMark: Record<Group["kind"], string> = { New: "+", Changed: "~", Removed: "−" };

export default function WhatsNewPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: "What’s new", href: "/whats-new" }]}
        eyebrow="Changelog"
        title="What’s new"
        lead="A dated record of what changes on this website. It begins with this release; earlier history is not reconstructed."
        quiet
      />

      <section className="section-quiet" aria-label="Releases">
        <div className="wrap">
          {releases.map((r) => (
            <article key={r.id} id={r.id} className="grid scroll-mt-[calc(var(--header-h)+1.3125rem)] gap-x-55 gap-y-21 lg:grid-cols-[13rem_minmax(0,1fr)]" aria-labelledby={`${r.id}-h`}>
              <div className="lg:sticky lg:top-[calc(var(--header-h)+2.125rem)] lg:self-start">
                <time dateTime={r.date} className="num font-display text-xl text-ink">
                  {r.dateLabel}
                </time>
                <p className="mt-5">
                  <span className="chip">Current release</span>
                </p>
                <FigureNote figure={<ChangeMarks />} label="Key" className="!mt-21">
                  Each entry is sorted by its mark: + for what is new, ~ for what has changed, − for what was removed.
                </FigureNote>
              </div>
              <div>
                <h2 id={`${r.id}-h`} className="h2">
                  {r.title}
                </h2>
                <p className="lead mt-13 max-w-measure">{r.summary}</p>

                {r.groups.map((g) => (
                  <section key={g.kind} className="mt-34" aria-label={g.kind}>
                    <h3 className="label flex items-center gap-8 border-b border-line-strong pb-13">
                      <span aria-hidden className={`num inline-grid h-21 w-21 place-items-center rounded-xs border border-line text-sm font-semibold ${kindStyle[g.kind]}`}>
                        {kindMark[g.kind]}
                      </span>
                      {g.kind}
                      <span className="num font-normal text-ink-3">{g.items.length}</span>
                    </h3>
                    <ul>
                      {g.items.map((c) => (
                        <li key={c.t} className="grid gap-x-34 gap-y-5 border-b border-line py-13 md:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] md:items-baseline">
                          <div>
                            <p className="font-medium text-ink">{c.t}</p>
                            <p className="mt-2 max-w-measure text-sm text-ink-2">{c.d}</p>
                          </div>
                          {c.href && c.go && (
                            <Link href={c.href} className="go min-h-[2.125rem] md:justify-self-end">
                              {c.go}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </article>
          ))}

          <div className="mt-55 grid gap-x-55 lg:grid-cols-[13rem_minmax(0,1fr)]">
            <p className="label pt-8">Earlier</p>
            <EmptyState title="No earlier entries.">
              <p>This changelog starts with the current release. Changes made before it were not recorded in this form, and they have not been written up after the fact.</p>
            </EmptyState>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Company", label: "Designing GIO4X", note: "The system behind this release.", href: "/design" },
          { kind: "Directory", label: "Explore GIO4X", note: "Everything, on one page.", href: "/explore" },
          { kind: "Trust", label: "Transparency", note: "What is published, and what is open.", href: "/trust/transparency" },
          { kind: "Help", label: "System status", note: "What is monitored.", href: "/status" },
        ]}
      />
    </>
  );
}

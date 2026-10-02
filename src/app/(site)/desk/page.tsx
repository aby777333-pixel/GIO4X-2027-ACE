import Link from "next/link";
import { Desk, type DeskData } from "@/components/desk/Desk";
import type { RatesProp } from "@/components/tools/calc";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { lessons } from "@/data/academy";
import { glossary } from "@/data/glossary";
import { getLesson } from "@/data/glossary-learn";
import { getAssetClass, instruments } from "@/data/instruments";
import { pageMeta } from "@/lib/meta";
import { formatFixingDate, getReferenceRates, RATE_CURRENCIES, RATES_SOURCE, type RateCurrency } from "@/lib/rates";

export const metadata = pageMeta({
  title: "My desk",
  description: "Your watchlist, saved pages, recent pages, calculator figures and learning progress on one page. All of it is kept in your browser, not in an account, and can be exported to a file.",
  path: "/desk",
  // a personal page: there is nothing here for a search engine to index
  index: false,
});

/** the reference fixing is published once a working day */
export const revalidate = 3600;

/** Only the latest fixing crosses to the client: eight numbers and a date (as on the tool pages). */
async function latestRates(): Promise<RatesProp> {
  const r = await getReferenceRates();
  if (r.status !== "ok") return r;
  const last = r.dates.length - 1;
  const perEur = Object.fromEntries(RATE_CURRENCIES.map((c) => [c, r.perEur[c][last]])) as Record<RateCurrency, number>;
  return { status: "ok", date: r.date, perEur };
}

export default async function DeskPage() {
  const rates = await latestRates();
  // the same for every visitor: the names the desk needs to label what the browser holds
  const data: DeskData = {
    instruments: instruments.map((i) => ({ id: `${i.class}/${i.slug}`, symbol: i.symbol, name: i.name, cls: getAssetClass(i.class)?.name ?? i.class, base: i.base, quote: i.quote })),
    terms: glossary.filter((t) => getLesson(t.slug) !== null).map((t) => ({ slug: t.slug, term: t.term })),
    lessons: lessons.map((l) => ({ slug: l.slug, title: l.title })),
    rates,
    ratesDate: rates.status === "ok" ? formatFixingDate(rates.date) : null,
    ratesSource: { name: "ECB", href: RATES_SOURCE.href },
  };

  return (
    <>
      <PageHero
        crumbs={[{ name: "My desk", href: "/desk" }]}
        eyebrow="This browser"
        title="My desk"
        lead="What you watch, what you saved, where you were, the figures in your calculators and what you have learned, on one page. There is no account: all of it is kept in this browser."
        quiet
      >
        <a href="#watchlist" className="btn btn-primary">
          Watchlist
        </a>
        <a href="#saved" className="btn btn-ghost">
          Saved
        </a>
        <Link href="/tools" className="btn btn-ghost">
          Trader Toolkit
        </Link>
      </PageHero>

      <Desk data={data} />

      <NextSteps
        items={[
          { kind: "Markets", label: "Market Command", note: "Find an instrument to watch.", href: "/markets" },
          { kind: "Tools", label: "Trader Toolkit", note: "Twelve calculators that share your figures.", href: "/tools" },
          { kind: "Learn", label: "Glossary", note: "Terms, each with a question to check yourself.", href: "/glossary" },
          { kind: "Controls", label: "Display & privacy", note: "See and clear what this browser holds.", href: "/preferences" },
        ]}
      />
    </>
  );
}

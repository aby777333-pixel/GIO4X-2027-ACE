import Link from "next/link";
import { Hero } from "@/components/home/Hero";
import { HomeStory } from "@/components/home/HomeStory";
import { MarketToRaptor } from "@/components/home/MarketToRaptor";
import { ReferenceRates } from "@/components/home/ReferenceRates";
import { AccountsTable, AssetIndex, IntelligenceTeaser, Philosophy, PlatformsChapter, ToolsTeaser, TrustBlock } from "@/components/home/Sections";
import { SessionStrip } from "@/components/market/SessionStrip";
import { SectionHead } from "@/components/ui/Page";
import { site } from "@/config/site";
import { pageMeta } from "@/lib/meta";
import "@/components/home/home.css";

export const metadata = pageMeta({
  title: `${site.name} | ${site.tagline}`,
  absoluteTitle: true,
  description: site.description,
  path: "/",
});

// Reference rates are refreshed hourly; everything else on the page is static.
export const revalidate = 3600;

/**
 * The homepage is a front door, not an inventory. Its rhythm:
 *   cinematic → quiet strip → whisper → index → the pinned sequence (globe to
 *   Raptor) → platforms → data →
 *   tools → comparison → trust → reading. Section heights vary on purpose.
 *
 * <HomeStory/> ties it into one shot: a small instrument leaves the hero and
 * travels down the page, changing with the chapter (market, instrument, order,
 * account); headings arrive in step; marked layers have a few pixels of depth.
 * It is driven by the scroll position and adds no text: see docs/HOME-STORY.md.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <SessionStrip />
      <Philosophy />
      <AssetIndex />
      <MarketToRaptor />
      <PlatformsChapter />

      <section className="section" aria-labelledby="pulse-home">
        <div className="wrap">
          <SectionHead
            eyebrow="Market pulse"
            title={<span id="pulse-home">The major pairs, at the last reference fixing.</span>}
            action={
              <Link href="/markets/currency-strength" className="go">
                Currency strength
              </Link>
            }
          />
          <div className="mt-34">
            <ReferenceRates />
          </div>
        </div>
      </section>

      <ToolsTeaser />
      <AccountsTable />
      <TrustBlock />
      <IntelligenceTeaser />
      <HomeStory />
    </>
  );
}

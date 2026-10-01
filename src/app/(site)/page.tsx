import Link from "next/link";
import { Hero } from "@/components/home/Hero";
import { ReferenceRates } from "@/components/home/ReferenceRates";
import { AccountsTable, AssetIndex, IntelligenceTeaser, Philosophy, PlatformsChapter, ToolsTeaser, TrustBlock } from "@/components/home/Sections";
import { SessionStrip } from "@/components/market/SessionStrip";
import { SectionHead } from "@/components/ui/Page";
import { site } from "@/config/site";
import { pageMeta } from "@/lib/meta";

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
 *   cinematic → quiet strip → whisper → index → dominant chapter → data →
 *   tools → comparison → trust → reading. Section heights vary on purpose.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <SessionStrip />
      <Philosophy />
      <AssetIndex />
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
    </>
  );
}

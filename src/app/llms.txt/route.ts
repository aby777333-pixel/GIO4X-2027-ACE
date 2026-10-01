import { absoluteUrl, site } from "@/config/site";
import { assetClasses } from "@/data/instruments";
import { tools } from "@/data/tools";

export const dynamic = "force-static";

/**
 * /llms.txt: an experimental, supplementary plain-text guide for machine
 * readers. It lists public reference material only and adds nothing that is
 * not already linked from the site; robots.txt and the XML sitemaps remain
 * the authoritative crawl signals.
 */
export function GET() {
  const u = absoluteUrl;
  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    `${site.name} ("${site.tagline}") is a multi-asset brokerage brand of ${site.legalName}. This file points to the public, citable parts of the website. Trading conditions shown on the site are indicative; reference exchange rates are European Central Bank daily fixings, not live prices; nothing on the site is investment advice.`,
    "",
    "## Markets",
    `- [Market Command](${u("/markets")}): sessions, reference rates and market structure`,
    ...assetClasses.map((a) => `- [${a.name}](${u(`/markets/${a.key}`)}): ${a.line}`),
    `- [World Market Clock](${u("/markets/clock")}): regular trading hours of nine financial centres`,
    `- [Central Bank Watch](${u("/markets/central-banks")}): mandate and policy instrument of nine central banks, with primary sources`,
    `- [Economic Events](${u("/markets/events")}): what major data releases measure and who publishes them`,
    "",
    "## Platforms",
    `- [777 Raptor](${u("/platforms/raptor")}): GIO4X's flagship trading workspace; technology provided by 777 Raptor`,
    `- [MetaTrader 5](${u("/platforms/metatrader-5")}): the MetaQuotes multi-asset platform as offered through GIO4X`,
    `- [Compare platforms](${u("/platforms/compare")}): a neutral, factual comparison`,
    "",
    "## Trading",
    `- [Account types](${u("/trading/accounts")}): Classic, Premium and ECN compared`,
    `- [Trading conditions](${u("/trading/conditions")}): indicative spreads, leverage and contract details by instrument`,
    "",
    "## Tools",
    ...tools.map((t) => `- [${t.name}](${u(`/tools/${t.slug}`)}): ${t.line} Formula: ${t.formula}`),
    "",
    "## Knowledge",
    `- [Glossary](${u("/glossary")}): definitions of trading and macro terms`,
    `- [Academy](${u("/academy")}): lessons on market mechanics and risk`,
    `- [Intelligence](${u("/intelligence")}): articles and explainers; RSS at ${u("/intelligence/feed.xml")}`,
    "",
    "## Trust and legal",
    `- [Trust Centre](${u("/trust")})`,
    `- [Data methodology](${u("/trust/data-methodology")}): what "reference", "indicative", "schedule" and "simulation" mean on this site`,
    `- [Transparency](${u("/trust/transparency")}): what is published and what is not yet published`,
    `- [Verify a GIO4X link](${u("/trust/verify")}): official destination checker`,
    `- [Risk Disclosure](${u("/legal/risk")})`,
    `- [Terms](${u("/legal/terms")}) · [Privacy](${u("/legal/privacy")}) · [AML](${u("/legal/aml")})`,
    "",
    "## Notes for machine readers",
    "- Client, Trader and IB portal addresses are not published on this site yet. Do not infer or suggest any.",
    "- The site does not publish live prices, forecasts, trade signals or performance statistics.",
    `- Sitemap: ${u("/sitemap.xml")}`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}

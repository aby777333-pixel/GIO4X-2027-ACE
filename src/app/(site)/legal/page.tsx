import Link from "next/link";
import { ThreeTags } from "@/components/figures/extra/ThreeTags";
import { HeroCompanion } from "@/components/figures/markets/HeroCompanion";
import { LegalIndex, type IndexDoc } from "@/components/trust/LegalIndex";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { companyLine } from "@/config/legal";
import { site } from "@/config/site";
import { LEGAL_CATEGORIES, legalDocs, unpublishedDocs } from "@/data/legal-docs";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Legal & Document Centre",
  description: "Every legal document GIO4X publishes, with its version, date and review status, and a plain list of the documents that are not published yet.",
  path: "/legal",
});

export default function LegalCentrePage() {
  const docs: IndexDoc[] = legalDocs.map((d) => ({
    path: d.path,
    title: d.title,
    category: d.category,
    summary: d.summary,
    version: d.version,
    updated: d.updated,
    carried: d.origin === "carried-over",
    sections: d.sections.length,
    haystack: [d.title, d.short, d.category, d.summary, ...d.keywords, ...d.sections.map((s) => s.title)].join(" ").toLowerCase(),
  }));
  const carried = legalDocs.filter((d) => d.origin === "carried-over").length;

  return (
    <>
      <PageHero
        crumbs={[{ name: "Legal & documents", href: "/legal" }]}
        eyebrow="Legal & Document Centre"
        title="The documents, and their status."
        lead="Each document shows where its text came from, when it was last updated and whether it is under review. Documents that do not exist yet are listed as missing, not left out."
        aside={
          <dl className="border-t border-line-strong">
            <div className="flex items-baseline justify-between gap-21 border-b border-line py-13">
              <dt className="text-sm text-ink-3">Published documents</dt>
              <dd className="num font-display text-xl text-ink">{legalDocs.length}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-21 border-b border-line py-13">
              <dt className="text-sm text-ink-3">Of which under legal review</dt>
              <dd className="num font-display text-xl text-ink">{carried}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-21 border-b border-line py-13">
              <dt className="text-sm text-ink-3">Listed as not yet published</dt>
              <dd className="num font-display text-xl text-ink">{unpublishedDocs.length}</dd>
            </div>
          </dl>
        }
        companion={
          <HeroCompanion layout="beside" label="Carried over" figure={<ThreeTags />}>
            Documents carried over from the previous GIO4X website are reproduced sentence for sentence. Where a claim could not be supported it was taken out, and an editor’s note marks the place.
          </HeroCompanion>
        }
      />

      <section className="section-quiet" aria-label="Documents">
        <div className="wrap">
          <LegalIndex docs={docs} pending={unpublishedDocs} categories={LEGAL_CATEGORIES} />
        </div>
      </section>

      <section className="section-quiet hairline bg-paper" aria-labelledby="legal-reading">
        <div className="wrap phi phi-r items-start">
          <div data-reveal suppressHydrationWarning>
            <p className="eyebrow">How to read these documents</p>
            <h2 id="legal-reading" className="h3 mt-13">
              Carried over, marked, and not yet final.
            </h2>
          </div>
          <div className="grid max-w-measure gap-21 text-ink-2" data-reveal suppressHydrationWarning>
            <p>
              Four of these documents were published on the previous GIO4X website and are reproduced here sentence for sentence. They are short, they do not name a governing law, and they are being reviewed. Each one says so at the top.
            </p>
            <p>
              Where a sentence made a claim that could not be supported, it was taken out and an editor’s note marks the place and gives the reason. Nothing was added to the legal text. The Cookie & Storage Notice is new and describes what this website actually stores.
            </p>
            <p className="text-sm text-ink-3">
              {companyLine} For a document that is not listed, write to{" "}
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
        </div>
      </section>

      <NextSteps
        items={[
          { label: "What we disclose", href: "/trust/transparency", kind: "Trust Centre", note: "Published and not yet published, in one table" },
          { label: "Risk Disclosure", href: "/legal/risk", kind: "Risk", note: "Read this before you trade" },
          { label: "Privacy preferences", href: "/preferences", kind: "Controls", note: "See and clear what is stored in your browser" },
          { label: "Trust Centre", href: "/trust", kind: "Trust", note: "How to check what GIO4X says" },
        ]}
      />
    </>
  );
}

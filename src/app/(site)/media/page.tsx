import Link from "next/link";
import { EmptyState, NextSteps, PageHero, SectionHead } from "@/components/ui/Page";
import { companyLine } from "@/config/legal";
import { site } from "@/config/site";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Media Centre",
  description: "For journalists and partners: how to describe GIO4X, how to write its names, the logo and mark as downloadable files with usage guidance, and the press contact.",
  path: "/media",
});

const naming = [
  { write: "GIO4X", not: "Gio4x, GIO 4X, Gio4X", note: "Capitals throughout, one word, with the numeral 4." },
  { write: "777 Raptor", not: "Raptor777, 777Raptor, RAPTOR", note: "“Raptor” alone is fine after the first mention." },
  { write: "MetaTrader 5", not: "Metatrader, Meta Trader 5, MT-5", note: "“MT5” after the first mention. A trademark of MetaQuotes, which develops the platform; GIO4X does not own it." },
  { write: "The Gentleman’s Brokerage House", not: "Gentlemen’s, Gentlemans", note: "Singular possessive. Used as a descriptor after the name, never in place of it." },
];

const assets = [
  { key: "logo", name: "GIO4X logo", file: "/brand/gio4x-logo.png", fileName: "gio4x-logo.png", spec: "PNG, transparent, 960 × 299", use: "The primary logo: mark and wordmark together. Use this wherever there is room.", w: 960, h: 299, box: "max-w-[21rem]" },
  { key: "mark", name: "GIO4X mark", file: "/brand/gio4x-mark.png", fileName: "gio4x-mark.png", spec: "PNG, transparent, 512 × 512", use: "The rosette on its own, for avatars and small square spaces where the full logo would be illegible.", w: 512, h: 512, box: "max-w-[8.9375rem]" },
];

const logoColours = [
  { name: "Market Blue", hex: "#0870B8", v: "--dna-blue", where: "The “4” and the cool end of the rosette" },
  { name: "Teal", hex: "#00A098", v: "--dna-teal", where: "The rosette mid-tone, where blue meets green" },
  { name: "Emerald", hex: "#089040", v: "--dna-emerald", where: "The “X” and the warm end of the rosette" },
  { name: "Platinum", hex: "#A0A8A8", v: "--dna-platinum", where: "The “GIO” wordmark" },
];

const donts = ["Do not stretch, squash, rotate or skew it.", "Do not recolour it, add effects, outlines or shadows.", "Do not redraw it or rebuild it from a typeface.", "Do not place it on a busy image or a background that weakens its contrast.", "Do not use it to imply endorsement, partnership or sponsorship."];

export default function MediaPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: "Media Centre", href: "/media" }]}
        eyebrow="Media Centre"
        title="How to describe GIO4X, accurately."
        lead="The approved description, the correct names, the logo files and the person to ask. If a fact you need is not here, it has not been published; please ask rather than infer."
      >
        <Link href="#assets" className="btn btn-primary">
          Logo files
        </Link>
        <Link href="/contact?topic=press" className="btn btn-ghost">
          Press enquiry
        </Link>
      </PageHero>

      {/* description */}
      <section className="section" aria-labelledby="describe">
        <div className="wrap phi items-start">
          <div data-reveal>
            <p className="eyebrow">Brand description</p>
            <h2 id="describe" className="h2 mt-13">
              In one paragraph.
            </h2>
            <blockquote className="mt-34 border-l border-accent pl-21 font-display text-xl leading-snug text-ink">{site.description}</blockquote>
            <p className="mt-21 max-w-measure text-ink-2">
              On first mention, write “GIO4X, {site.tagline}” if a descriptor is wanted. The company line, exactly as published, is:
            </p>
            <p className="mt-8 max-w-measure font-medium text-ink">{companyLine}</p>
          </div>
          <aside className="panel-quiet p-21 lg:p-34" aria-labelledby="please-h" data-reveal>
            <p id="please-h" className="label">
              Please do not attribute to GIO4X
            </p>
            <p className="mt-13 text-sm text-ink-2">
              Client numbers, trading volumes, founding dates, awards, rankings, office networks or statements about regulatory status. None is published on this site, and figures that circulate elsewhere have not been confirmed by GIO4X.
            </p>
            <Link href="/trust/transparency" className="go mt-21">
              What is published
            </Link>
          </aside>
        </div>
      </section>

      {/* naming */}
      <section className="section hairline bg-paper" aria-labelledby="naming">
        <div className="wrap">
          <SectionHead eyebrow="Naming" title={<span id="naming">Four names, written one way.</span>} />
          <div className="scroll-x mt-34" data-reveal>
            <table className="table-gx min-w-[40rem]">
              <caption className="sr-only">Correct spelling of GIO4X names</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-[30%]">
                    Write
                  </th>
                  <th scope="col" className="w-[28%]">
                    Not
                  </th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {naming.map((n) => (
                  <tr key={n.write}>
                    <th scope="row" className="!border-line !py-13 !font-display !text-lg !font-medium !normal-case !tracking-normal !text-ink">
                      {n.write}
                    </th>
                    <td className="!h-auto py-13 text-sm text-ink-3">
                      <span className="line-through decoration-line-strong">{n.not}</span>
                    </td>
                    <td className="!h-auto whitespace-normal py-13 text-sm text-ink-2">{n.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* assets */}
      <section id="assets" className="section scroll-mt-[calc(var(--header-h)+1.3125rem)]" aria-labelledby="assets-h">
        <div className="wrap">
          <SectionHead eyebrow="Logo and mark" title={<span id="assets-h">The files, and how to treat them.</span>} lead="Always use the supplied artwork. The logo is never redrawn, recoloured or distorted, on this site or anywhere else." />

          <div className="mt-55 grid gap-34 lg:grid-cols-phi lg:gap-55">
            {assets.map((a) => (
              <figure key={a.key} data-reveal>
                {/* clear-space diagram: the dashed frame marks the minimum margin */}
                <div className="grid-field grid h-[15rem] place-items-center rounded border border-line bg-surface p-21 sm:h-[21rem] sm:p-34">
                  <div className="relative border border-dashed border-line-strong p-21 sm:p-34">
                    <img src={a.file} alt={a.name} width={a.w} height={a.h} className={`h-auto w-full ${a.box}`} decoding="async" loading="lazy" />
                    <span aria-hidden className="label absolute -top-[0.6rem] left-13 bg-surface px-5">
                      Clear space
                    </span>
                  </div>
                </div>
                <figcaption className="mt-13 flex flex-wrap items-start justify-between gap-13">
                  <span className="max-w-[30rem]">
                    <span className="h4 block">{a.name}</span>
                    <span className="mt-5 block text-sm text-ink-2">{a.use}</span>
                    <span className="num mt-5 block text-xs text-ink-3">{a.spec}</span>
                  </span>
                  <a href={a.file} download={a.fileName} className="btn btn-ghost">
                    Download PNG
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="mt-55 grid gap-34 lg:grid-cols-3 lg:gap-55">
            <div data-reveal>
              <h3 className="label border-b border-line-strong pb-13">Clear space</h3>
              <p className="mt-13 text-sm text-ink-2">
                Keep a margin on every side at least equal to the height of the “X” in the wordmark. For the mark alone, use a quarter of its width. Nothing else, including text, rules and the edge of the page, enters that margin.
              </p>
              <h3 className="label mt-34 border-b border-line-strong pb-13">Background</h3>
              <p className="mt-13 text-sm text-ink-2">Place it on a plain, quiet ground with enough contrast for the platinum wordmark to read. If you are unsure whether a background works, send it to us and ask.</p>
            </div>
            <div data-reveal style={{ ["--i" as string]: 1 }}>
              <h3 className="label border-b border-line-strong pb-13">Please do not</h3>
              <ul className="text-sm text-ink-2">
                {donts.map((d) => (
                  <li key={d} className="grid grid-cols-[0.8125rem_1fr] gap-x-8 border-b border-line py-8">
                    <span aria-hidden className="mt-[0.62rem] h-px w-full bg-neg" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
            <div data-reveal style={{ ["--i" as string]: 2 }}>
              <h3 className="label border-b border-line-strong pb-13">Logo colours</h3>
              <ul>
                {logoColours.map((c) => (
                  <li key={c.hex} className="grid grid-cols-[2.125rem_1fr] items-center gap-x-13 border-b border-line py-8">
                    <span aria-hidden className="h-34 w-34 rounded-xs border border-line" style={{ background: `var(${c.v})` }} />
                    <span>
                      <span className="flex items-baseline justify-between gap-13">
                        <span className="text-sm font-medium text-ink">{c.name}</span>
                        <span className="num select-all text-sm text-ink-2">{c.hex}</span>
                      </span>
                      <span className="block text-xs text-ink-3">{c.where}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-xs text-ink-3">
                Values sampled from the supplied logo artwork.{" "}
                <Link href="/design#palette" className="link">
                  The full palette
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* press */}
      <section className="section hairline bg-paper" aria-labelledby="press">
        <div className="wrap phi items-start">
          <div>
            <p className="eyebrow">Press releases</p>
            <h2 id="press" className="h2 mt-13">
              The record so far.
            </h2>
            <div className="mt-34" data-reveal>
              <EmptyState
                title="No press releases published yet."
                actions={
                  <Link href="/whats-new" className="btn btn-ghost">
                    What’s new on this site
                  </Link>
                }
              >
                <p>When GIO4X issues a statement it will appear here, dated, in full and with a named point of contact. Anything presented elsewhere as a GIO4X press release that is not on this page should be treated with caution.</p>
              </EmptyState>
            </div>
          </div>
          <aside aria-labelledby="contact-h" data-reveal>
            <p id="contact-h" className="label">
              Press contact
            </p>
            <p className="mt-8">
              <a href={`mailto:${site.email}?subject=Press%20enquiry`} className="link font-display text-xl">
                {site.email}
              </a>
            </p>
            <p className="mt-13 text-sm text-ink-2">Put “Press” in the subject line and include your publication and deadline. The contact form has a Press topic if you prefer it.</p>
            <Link href="/contact?topic=press" className="go mt-21">
              Contact form
            </Link>
          </aside>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Company", label: "About GIO4X", note: "What the house is and how it behaves.", href: "/about" },
          { kind: "Company", label: "Designing GIO4X", note: "Palette, proportion and type.", href: "/design" },
          { kind: "Trust", label: "Verify a GIO4X link", note: "Check an address against the registry.", href: "/trust/verify" },
          { kind: "Company", label: "What’s new", note: "The changelog.", href: "/whats-new" },
        ]}
      />
    </>
  );
}

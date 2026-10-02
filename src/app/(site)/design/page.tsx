import Link from "next/link";
import { Rosette } from "@/components/brand/Rosette";
import { GoldenGrid, TokenSwatch } from "@/components/company/DesignKit";
import { GoldenHead } from "@/components/figures/stage/GoldenHead";
import { HeroCompanion } from "@/components/figures/stage/HeroCompanion";
import { DataNote, NextSteps, PageHero, SectionHead } from "@/components/ui/Page";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Designing GIO4X",
  description: "The design story of GIO4X: a palette sampled from the logo, a layout built on the golden ratio, Inter and TT Norms, the rosette, light and dark, accessibility and data honesty.",
  path: "/design",
});

const PHI = 1.618;

const dna = [
  { token: "--brand", name: "Market Blue", role: "Brand and information. The “4”.", raw: "#0870B8" },
  { token: "--teal", name: "Teal", role: "Secondary accent. The rosette mid-tone.", raw: "#00A098" },
  { token: "--emerald", name: "Emerald", role: "Positive and success. The “X”.", raw: "#089040" },
  { token: "--platinum", name: "Platinum", role: "Secondary information. The “GIO”.", raw: "#A0A8A8" },
  { token: "--prestige", name: "Champagne", role: "Prestige only: numerals, rare rules." },
];

const stage = [
  { token: "--bg", name: "Ivory", role: "The page" },
  { token: "--paper", name: "Paper", role: "Alternate chapters" },
  { token: "--surface", name: "Surface", role: "Objects: tools, forms" },
  { token: "--sunken", name: "Sunken", role: "Wells and tracks" },
  { token: "--ink-3", name: "Ink 3", role: "Captions, labels" },
  { token: "--ink-2", name: "Ink 2", role: "Body text" },
  { token: "--ink", name: "Graphite", role: "Headings, emphasis" },
];

const semantics = [
  { token: "--pos", name: "Positive", role: "With ▲ and a plus sign" },
  { token: "--neg", name: "Negative", role: "With ▼ and a minus sign" },
  { token: "--warn", name: "Caution", role: "Pre-open, attention" },
  { token: "--accent", name: "Accent", role: "Follows your chosen mood" },
];

const fib = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
const typeScale = [12, 14, 16, 18, 21, 26, 34, 43, 55, 70, 89];
const motion = [
  { ms: 100, name: "instant", use: "A press" },
  { ms: 160, name: "fast", use: "Hover, colour" },
  { ms: 260, name: "base", use: "A link’s rule, a menu" },
  { ms: 420, name: "slow", use: "Theme change" },
  { ms: 680, name: "reveal", use: "Content arriving" },
  { ms: 1100, name: "cinematic", use: "A hero, once" },
];

const rosettes: { blades: number; label: string; note: string; spin?: boolean; dna?: boolean; solid?: boolean }[] = [
  { blades: 8, label: "Eight", note: "The full signature, in the logo gradient.", dna: true },
  { blades: 8, label: "Eight, turning", note: "Loading and thinking. One turn in thirteen seconds.", spin: true },
  { blades: 7, label: "Seven", note: "The 404. One blade is missing, like the page." },
  { blades: 5, label: "Five", note: "Empty states: something is not here yet." },
  { blades: 3, label: "Three", note: "A fragment, for the quietest corners." },
  { blades: 8, label: "Solid", note: "Filled blades, for small sizes.", solid: true },
];

const access = [
  { t: "Keyboard first", d: "Every control is reachable and operable without a pointer, with a visible focus ring. The command bar opens with Ctrl or ⌘ and K." },
  { t: "Contrast", d: "Text meets WCAG AA in light, dark and every accent. A higher-contrast profile is one switch away." },
  { t: "Never colour alone", d: "Direction carries an arrow and a sign. States carry a shape and a word. A table read in greyscale loses nothing." },
  { t: "Motion is optional", d: "Reduced motion is honoured from the system setting and from the site’s own switch. Every page is finished with animation off." },
  { t: "Text that scales", d: "Spacing and type are set in rem, so a larger text setting enlarges the whole composition in proportion." },
  { t: "Touch", d: "Targets are at least 44 pixels on a phone, and mobile layouts are composed, not shrunk." },
  { t: "Structure", d: "One heading per page at level one, landmarks, captions on tables, text equivalents for charts and canvases." },
  { t: "No autoplay", d: "No sound or video starts by itself, anywhere." },
];

const vocabulary: { status: "reference" | "indicative" | "schedule" | "simulation" | "unavailable"; means: string; example: string }[] = [
  { status: "reference", means: "An official figure published by a named body at a fixed time. Not a price you can trade at.", example: "European Central Bank euro reference rates, with their fixing date." },
  { status: "indicative", means: "A trading condition GIO4X has published, such as a minimum spread. It varies with the market and the account.", example: "“Spread from” on an instrument page." },
  { status: "schedule", means: "A timetable computed from your own clock. It says when a market is normally open, not that it is trading now.", example: "The session strip and the world market clock." },
  { status: "simulation", means: "Arithmetic on figures you typed in. A worked example, not a forecast and not advice.", example: "Every calculator in the Trader Toolkit." },
  { status: "unavailable", means: "The data could not be loaded, or is not connected. The page says so rather than showing a zero or yesterday’s value.", example: "The system status page." },
];

/** A golden rectangle subdivided into squares, with the spiral through them. */
function GoldenSpiral() {
  const squares: { x: number; y: number; s: number; d: string }[] = [];
  let x = 0;
  let y = 0;
  let w = 1618;
  let h = 1000;
  for (let i = 0; i < 9; i++) {
    const step = i % 4;
    if (step === 0) {
      const s = h;
      squares.push({ x, y, s, d: `M ${x} ${y + s} A ${s} ${s} 0 0 1 ${x + s} ${y}` });
      x += s;
      w -= s;
    } else if (step === 1) {
      const s = w;
      squares.push({ x, y, s, d: `M ${x} ${y} A ${s} ${s} 0 0 1 ${x + s} ${y + s}` });
      y += s;
      h -= s;
    } else if (step === 2) {
      const s = h;
      squares.push({ x: x + w - s, y, s, d: `M ${x + w} ${y} A ${s} ${s} 0 0 1 ${x + w - s} ${y + s}` });
      w -= s;
    } else {
      const s = w;
      squares.push({ x, y: y + h - s, s, d: `M ${x + w} ${y + h} A ${s} ${s} 0 0 1 ${x} ${y + h - s}` });
      h -= s;
    }
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return (
    <svg viewBox="-1 -1 1620 1002" className="h-auto w-full" role="img" aria-label="A golden rectangle divided into successively smaller squares, with a spiral drawn through them.">
      {squares.map((q, i) => (
        <rect key={i} x={r(q.x)} y={r(q.y)} width={r(q.s)} height={r(q.s)} fill={i === 0 ? "var(--brand-soft)" : "none"} stroke="var(--viz-stroke)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
      <path
        d={squares.map((q) => q.d.replace(/-?\d+\.\d+/g, (m) => String(r(Number(m))))).join(" ")}
        fill="none"
        stroke="var(--prestige)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The same miniature page under each theme: nested data-theme scopes re-resolve every token. */
function Building({ theme, time, caption }: { theme: "light" | "dark"; time: string; caption: string }) {
  return (
    <figure>
      <div data-theme={theme} data-accent="gio4x" className="rounded border border-line bg-bg p-21 text-ink shadow-2 sm:p-34">
        <div className="flex items-center justify-between gap-13">
          <p className="eyebrow">Markets</p>
          <span className="state state-open">Open</span>
        </div>
        <p className="h3 mt-13">The same building.</p>
        <p className="mt-8 text-sm text-ink-2">Ivory becomes graphite, graphite becomes ivory, and every relationship between them holds.</p>
        <dl className="mt-21 border-t border-line">
          <div className="flex items-baseline justify-between border-b border-line py-8 text-sm">
            <dt className="text-ink-3">Direction, up</dt>
            <dd className="num font-medium text-pos">
              <span aria-hidden>▲ </span>positive
            </dd>
          </div>
          <div className="flex items-baseline justify-between border-b border-line py-8 text-sm">
            <dt className="text-ink-3">Direction, down</dt>
            <dd className="num font-medium text-neg">
              <span aria-hidden>▼ </span>negative
            </dd>
          </div>
        </dl>
        <div className="mt-21 flex flex-wrap items-center gap-13">
          <span className="btn btn-primary btn-sm">Primary</span>
          <span className="btn btn-ghost btn-sm">Ghost</span>
          <span className="chip">Reference data</span>
        </div>
      </div>
      <figcaption className="mt-13 flex items-baseline gap-13">
        <span className="num font-display text-xl text-ink">{time}</span>
        <span className="text-sm text-ink-3">{caption}</span>
      </figcaption>
    </figure>
  );
}

export default function DesignPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: "Designing GIO4X", href: "/design" }]}
        eyebrow="Design story"
        title="Designing GIO4X"
        lead="A palette taken from the logo, a layout taken from one number, two typefaces and a single recurring shape. This page explains the system by being built from it."
        aside={
          <figure>
            <GoldenSpiral />
            <figcaption className="mt-8 text-xs text-ink-3">1.618 : 1. Remove a square and the same rectangle remains.</figcaption>
          </figure>
        }
        companion={
          <HeroCompanion figure={<GoldenHead />} label="One number">
            Here each point is turned from the last by the golden fraction of a circle, and no two ever line up. Move the pointer off centre and spokes appear at once. Spacing, type, layout and even timing on this site step by the same number.
          </HeroCompanion>
        }
      >
        <GoldenGrid />
      </PageHero>

      {/* 1 — palette */}
      <section id="palette" className="section scroll-mt-[calc(var(--header-h)+1.3125rem)]" aria-labelledby="palette-h">
        <div className="wrap">
          <hr className="dna-rule mb-34" />
          <SectionHead
            eyebrow="Logo DNA"
            title={<span id="palette-h">Four colours were already chosen.</span>}
            lead="The palette was not invented. It was sampled from the supplied logo, then each colour was tuned until it passed contrast on ivory and on graphite. One metal was added, and it is rationed."
          />
          <div className="mt-55 grid grid-cols-2 gap-x-21 gap-y-34 sm:grid-cols-3 lg:grid-cols-5">
            {dna.map((c) => (
              <TokenSwatch key={c.token} tall {...c} />
            ))}
          </div>

          <div className="mt-55 grid gap-34 lg:grid-cols-phi lg:gap-55">
            <div>
              <h3 className="label border-b border-line-strong pb-13">The stage: ivory to graphite</h3>
              <div className="mt-21 grid grid-cols-2 gap-x-13 gap-y-21 sm:grid-cols-4 lg:grid-cols-7">
                {stage.map((c) => (
                  <TokenSwatch key={c.token} {...c} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="label border-b border-line-strong pb-13">Meaning</h3>
              <div className="mt-21 grid grid-cols-2 gap-x-13 gap-y-21 sm:grid-cols-4">
                {semantics.map((c) => (
                  <TokenSwatch key={c.token} {...c} />
                ))}
              </div>
            </div>
          </div>
          <p className="mt-34 max-w-measure text-sm text-ink-3">
            The values under each swatch are read from this page as you view it. Change the theme or the accent in{" "}
            <Link href="/preferences" className="link">
              Display & privacy
            </Link>{" "}
            and they change with it. No component on the site contains a colour of its own.
          </p>
        </div>
      </section>

      {/* 2 — φ */}
      <section className="section hairline bg-paper" aria-labelledby="phi-h">
        <div className="wrap">
          <div className="phi items-end">
            <div data-reveal>
              <p className="eyebrow">The φ system</p>
              <h2 id="phi-h" className="h2 mt-13">
                One number decides the proportions.
              </h2>
            </div>
            <p className="lead" data-reveal>
              φ is 1.618…, the ratio at which a whole relates to its larger part as the larger part relates to the smaller. Spacing, type, layout and even timing step by it, so nothing on a page is an arbitrary size.
            </p>
          </div>

          {/* the split, demonstrated by the grid it describes */}
          <div className="phi mt-55 !gap-px overflow-hidden rounded border border-line bg-line" data-reveal>
            <div className="bg-surface p-21 lg:p-34">
              <p className="num font-display text-4xl font-light leading-none text-ink">61.8</p>
              <p className="mt-8 max-w-narrow text-sm text-ink-2">The statement. A heading, an argument, the main object.</p>
            </div>
            <div className="bg-surface p-21 lg:p-34">
              <p className="num font-display text-4xl font-light leading-none text-ink-3">38.2</p>
              <p className="mt-8 text-sm text-ink-2">The aside. A figure, a note, a way onward.</p>
            </div>
          </div>
          <p className="mt-8 text-xs text-ink-3">The split applies from 1080 pixels up. Below that the two parts stack, statement first. It is reversed from section to section so the page does not lean.</p>

          <div className="mt-55 grid gap-55 lg:grid-cols-2 lg:gap-89">
            <div data-reveal>
              <h3 className="label border-b border-line-strong pb-13">Spacing: a Fibonacci scale</h3>
              <ul className="mt-13 grid gap-5">
                {fib.map((n) => (
                  <li key={n} className="grid grid-cols-[2.125rem_1fr] items-center gap-13">
                    <span className="num text-right text-xs text-ink-3">{n}</span>
                    <span className="block h-[0.5rem] rounded-xs bg-accent" style={{ width: `${n / 16}rem` }} />
                  </li>
                ))}
              </ul>
              <p className="mt-13 max-w-narrow text-sm text-ink-2">Each step is the sum of the two before it, and the ratio between neighbours settles on φ. There is no 4, no 10 and no 12 in the system; a class such as <span className="whitespace-nowrap">p-21</span> is exactly 21 pixels.</p>

              <h3 className="label mt-55 border-b border-line-strong pb-13">Time: six durations</h3>
              <ul className="mt-13 grid gap-8">
                {motion.map((m) => (
                  <li key={m.ms} className="grid grid-cols-[3.4375rem_1fr] items-center gap-13 sm:grid-cols-[3.4375rem_8.9375rem_1fr]">
                    <span className="num text-right text-xs text-ink-3">{m.ms} ms</span>
                    <span className="hidden text-sm text-ink-2 sm:block">{m.use}</span>
                    <span className="block h-px bg-ink" style={{ width: `${(m.ms / 1100) * 100}%` }} />
                  </li>
                ))}
              </ul>
              <p className="mt-13 max-w-measure text-sm text-ink-2">Each duration is roughly φ times the one before. Motion is used to explain a change of state, never to decorate one.</p>
            </div>
            <div data-reveal>
              <h3 className="label border-b border-line-strong pb-13">Type: eleven sizes</h3>
              <ul className="mt-13">
                {typeScale.map((n) => (
                  <li key={n} className="flex items-baseline gap-13 overflow-hidden border-b border-line py-3">
                    <span className="num w-21 shrink-0 text-right text-xs text-ink-3">{n}</span>
                    <span className="truncate font-display font-light leading-[1.15] text-ink" style={{ fontSize: `min(${n / 16}rem, 15vw)` }}>
                      Proportion
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-13 max-w-narrow text-sm text-ink-2">From 21 upwards, neighbouring sizes differ by about 1.27, the square root of φ, so two steps up is one golden step.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3 — type */}
      <section className="section" aria-labelledby="type-h">
        <div className="wrap">
          <SectionHead eyebrow="Typography" title={<span id="type-h">Inter × TT Norms</span>} lead="Two typefaces with two jobs. One speaks for the brand; the other does the work." />
          <div className="mt-55 grid gap-px overflow-hidden rounded border border-line bg-line lg:grid-cols-phi">
            <div className="bg-bg p-21 lg:p-34" data-reveal>
              <p className="label">TT Norms · display</p>
              <p className="mt-21 font-display text-[clamp(2.6875rem,9vw,5.5625rem)] font-light leading-none tracking-[-0.028em] text-ink">Gentlemanly standards.</p>
              <dl className="mt-34 grid grid-cols-2 gap-x-21 gap-y-13 sm:grid-cols-4">
                {[
                  { w: 300, n: "Light" },
                  { w: 400, n: "Regular" },
                  { w: 500, n: "Medium" },
                  { w: 700, n: "Bold" },
                ].map((x) => (
                  <div key={x.w}>
                    <dt className="num text-xs text-ink-3">{x.w}</dt>
                    <dd className="font-display text-xl text-ink" style={{ fontWeight: x.w }}>
                      {x.n}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-21 max-w-narrow text-sm text-ink-2">Headings and brand moments only. Geometric, open and calm at large sizes, where its light weight can afford to be light.</p>
            </div>
            <div className="bg-bg p-21 lg:p-34" data-reveal>
              <p className="label">Inter · interface</p>
              <p className="mt-21 text-md text-ink">Everything functional: paragraphs, labels, forms, tables, the words on a button.</p>
              <p className="num mt-21 text-3xl font-medium leading-none text-ink">0123456789</p>
              <p className="mt-8 text-xs text-ink-3">Tabular figures: every numeral has the same width, so columns of numbers align and a changing value does not shiver.</p>
              <p className="mt-21 border-t border-line pt-13 font-sans text-sm text-ink-2">
                <span className="label mr-8">Label</span> ABCDEFGHIJKLM · abcdefghijklm · ▲ ▼ ◆ × φ
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4 — rosette */}
      <section className="on-night relative overflow-hidden" aria-labelledby="rosette-h">
        <div className="wrap section relative">
          <div className="phi phi-r items-center">
            <figure className="relative mx-auto aspect-square w-full max-w-[21rem]" data-reveal>
              {/* construction: three radii in golden ratio, one blade drawn */}
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
                <circle cx="50" cy="50" r="46" fill="none" stroke="var(--viz-stroke)" strokeWidth="0.3" strokeDasharray="1 1.2" />
                <circle cx="50" cy="50" r={46 / PHI} fill="none" stroke="var(--viz-stroke)" strokeWidth="0.3" strokeDasharray="1 1.2" />
                <circle cx="50" cy="50" r={46 / PHI / PHI} fill="none" stroke="var(--viz-stroke)" strokeWidth="0.3" strokeDasharray="1 1.2" />
                {Array.from({ length: 8 }, (_, i) => (
                  <line key={i} x1="50" y1="50" x2="50" y2="4" stroke="var(--viz-faint)" strokeWidth="0.3" transform={`rotate(${i * 45} 50 50)`} />
                ))}
              </svg>
              <Rosette size="100%" strokeWidth={0.8} className="relative text-on-night opacity-30" />
              <Rosette size="100%" blades={1} strokeWidth={1.6} dna className="absolute inset-0" />
              <figcaption className="sr-only">The rosette: eight blades at 45 degree intervals, bounded by three circles whose radii stand in the golden ratio.</figcaption>
            </figure>
            <div data-reveal>
              <p className="eyebrow">The signature</p>
              <h2 id="rosette-h" className="h2 mt-13">
                One blade, turned eight times.
              </h2>
              <p className="lead mt-21">
                The logo mark is a pinwheel of eight blades around a point. The rosette redraws that geometry from first principles: each blade is a pair of arcs whose radii relate by φ, rotated by 45°. It is never a substitute for the logo. It is how the brand stays present where the logo is not.
              </p>
              <dl className="mt-21 grid grid-cols-3 gap-13 border-t border-night-line pt-13 text-sm">
                <div>
                  <dt className="label">Outer</dt>
                  <dd className="num mt-3 text-on-night">R</dd>
                </div>
                <div>
                  <dt className="label">Edge</dt>
                  <dd className="num mt-3 text-on-night">R ÷ φ</dd>
                </div>
                <div>
                  <dt className="label">Core</dt>
                  <dd className="num mt-3 text-on-night">R ÷ φ²</dd>
                </div>
              </dl>
            </div>
          </div>

          <ul className="mt-55 grid grid-cols-2 gap-px overflow-hidden rounded border border-night-line bg-night-line sm:grid-cols-3 lg:grid-cols-6">
            {rosettes.map((x) => (
              <li key={x.label} className="bg-night p-21">
                <Rosette size={55} blades={x.blades} spin={x.spin} dna={x.dna} variant={x.solid ? "solid" : "line"} className="text-on-night" />
                <p className="mt-13 text-sm font-medium text-on-night">{x.label}</p>
                <p className="mt-3 text-xs text-on-night-2">{x.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5 — light / dark */}
      <section className="section" aria-labelledby="theme-h">
        <div className="wrap">
          <SectionHead
            eyebrow="Light and dark"
            title={<span id="theme-h">The same building at 10 AM and 10 PM.</span>}
            lead="Light is the flagship: a private-wealth office in the morning. Dark is not a second design. It is the same rooms after hours, with the same furniture in the same places."
          />
          <div className="mt-55 grid gap-34 md:grid-cols-2 lg:gap-55" data-reveal>
            <Building theme="light" time="10:00" caption="Warm ivory, graphite ink." />
            <Building theme="dark" time="22:00" caption="Graphite ground, ivory ink." />
          </div>
          <p className="mt-21 max-w-measure text-sm text-ink-3">Both panels above are the same markup. Only one attribute differs, and every colour follows from it. Backgrounds never respond to price direction in either theme.</p>
        </div>
      </section>

      {/* 6 — accessibility */}
      <section className="section hairline bg-paper" aria-labelledby="a11y-h">
        <div className="wrap phi phi-r items-start">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+2.125rem)]" data-reveal>
            <p className="eyebrow">Accessibility</p>
            <h2 id="a11y-h" className="h2 mt-13">
              Commitments, not aspirations.
            </h2>
            <p className="lead mt-21">A page that some people cannot use is not finished. These are the rules every page is built to.</p>
            <Link href="/preferences" className="go mt-21">
              Comfort settings
            </Link>
          </div>
          <dl className="grid border-l border-t border-line sm:grid-cols-2">
            {access.map((a, i) => (
              <div key={a.t} className="border-b border-r border-line p-21" data-reveal style={{ ["--i" as string]: i % 2 }}>
                <dt className="h4">{a.t}</dt>
                <dd className="mt-5 text-sm text-ink-2">{a.d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 7 — data honesty */}
      <section className="section" aria-labelledby="data-h">
        <div className="wrap">
          <SectionHead
            eyebrow="Data honesty"
            title={<span id="data-h">Five words for what a number is.</span>}
            lead="No licensed live market-data feed is connected to this site, so nothing on it is labelled live. Every figure carries one of these labels instead, and the label is part of the design."
            action={
              <Link href="/trust/data-methodology" className="go">
                Data methodology
              </Link>
            }
          />
          <ul className="mt-34 border-t border-line-strong">
            {vocabulary.map((v, i) => (
              <li key={v.status} className="grid gap-x-34 gap-y-8 border-b border-line py-21 md:grid-cols-[11rem_minmax(0,1.618fr)_minmax(0,1fr)] md:items-baseline" data-reveal style={{ ["--i" as string]: i }}>
                <DataNote status={v.status} />
                <p className="text-ink">{v.means}</p>
                <p className="text-sm text-ink-3">{v.example}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Preferences", label: "Display & privacy", note: "Theme, accent, density, comfort.", href: "/preferences" },
          { kind: "Company", label: "Media Centre", note: "Logo files and naming.", href: "/media" },
          { kind: "Trust", label: "Data methodology", note: "Where each number comes from.", href: "/trust/data-methodology" },
          { kind: "Company", label: "What’s new", note: "What this release contains.", href: "/whats-new" },
        ]}
      />
    </>
  );
}

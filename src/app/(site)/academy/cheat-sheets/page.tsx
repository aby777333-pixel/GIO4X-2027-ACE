import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { PrintButton } from "@/components/ui/PrintButton";
import { riskWarning } from "@/config/legal";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const DESCRIPTION =
  "Three one-page cheat sheets to print or save as a PDF: what a pip is worth by lot size, the checks to run before any trade, and how to read a candle. Arithmetic and general method; not advice.";

export const metadata = pageMeta({ title: "Cheat sheets | Academy", description: DESCRIPTION, path: "/academy/cheat-sheets" });

// the pip sheet is worked out here, not typed in: units × the pip, in the pair's quote currency
const LOTS = [
  { name: "Micro", lots: "0.01", units: 1_000 },
  { name: "Mini", lots: "0.10", units: 10_000 },
  { name: "Standard", lots: "1.00", units: 100_000 },
];
const QUOTES = [
  { name: "Pairs quoted in USD, e.g. EUR/USD", pip: 0.0001, ccy: "USD" },
  { name: "Pairs quoted in JPY, e.g. USD/JPY", pip: 0.01, ccy: "JPY" },
];
const MOVES = [10, 25, 50, 100];
const fmt = (n: number) => (n >= 100 ? n.toLocaleString("en-GB", { maximumFractionDigits: 0 }) : n.toFixed(2));

const CHECKS = [
  ["The reason", "Can I say in one sentence why I am taking this trade?"],
  ["The stop", "Where is this idea wrong? Is the stop there, and on the right side?"],
  ["The room", "Is the stop further away than this pair moves in ordinary noise?"],
  ["The size", "Does the size make the stop cost the share of the account I chose, and no more?"],
  ["The target", "Is what I aim for larger than what I risk?"],
  ["The cost", "What do the spread, commission and any swap come to, against that target?"],
  ["The calendar", "Is a major release due while this trade is open?"],
  ["The total", "With my other open trades, how much is at risk altogether? Are any of them the same trade twice?"],
  ["The state", "Am I calm, or am I trying to win something back?"],
];

const CANDLE = [
  ["The body", "From the open to the close. A long body: price travelled and stayed. A short one: it ended near where it began."],
  ["The upper wick", "From the body up to the high. Price went there and came back."],
  ["The lower wick", "From the body down to the low. Price went there and came back."],
  ["The colour", "One colour if it closed above its open, another if below. Check which is which on your own chart."],
  ["Its neighbours", "A candle twice the size of those before it is a different event from one the same size."],
  ["What it cannot say", "A candle is a record of one period. It does not tell you the next."],
];

export default function Page() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/academy/cheat-sheets", name: "Cheat sheets", description: DESCRIPTION })} />
      <div className="no-print">
        <PageHero
          quiet
          crumbs={[
            { name: "Academy", href: "/academy" },
            { name: "Cheat sheets", href: "/academy/cheat-sheets" },
          ]}
          eyebrow="Academy · to print"
          title="Three cheat sheets."
          lead="One page each. Print them, or choose “Save as PDF” in the print dialogue. The first is arithmetic worked out on this page; the other two are method."
        >
          <PrintButton />
        </PageHero>
      </div>

      <div className="wrap section gx-sheets">
        <article className="gx-sheet" aria-labelledby="sheet-pip">
          <p className="label">GIO4X Academy · cheat sheet 1 of 3</p>
          <h2 id="sheet-pip" className="h2 mt-8">
            What a pip is worth
          </h2>
          <p className="mt-8 max-w-measure text-ink-2">The value of one pip is the size of the position multiplied by the pip, in the pair’s quote currency. Convert to your account’s currency at the going rate.</p>
          {QUOTES.map((q) => (
            <div key={q.ccy} className="mt-21">
              <h3 className="h4">{q.name}</h3>
              <div className="scroll-x">
                <table className="table-gx mt-8 min-w-[30rem]">
                  <thead>
                    <tr>
                      <th scope="col">Lot</th>
                      <th scope="col">Units</th>
                      <th scope="col">1 pip</th>
                      {MOVES.map((m) => (
                        <th key={m} scope="col">
                          {m} pips
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {LOTS.map((l) => (
                      <tr key={l.name}>
                        <th scope="row">
                          {l.name} <span className="num text-ink-3">{l.lots}</span>
                        </th>
                        <td className="num">{l.units.toLocaleString("en-GB")}</td>
                        <td className="num">
                          {fmt(l.units * q.pip)} {q.ccy}
                        </td>
                        {MOVES.map((m) => (
                          <td key={m} className="num">
                            {fmt(l.units * q.pip * m)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="mt-21 text-sm text-ink-2">
            <strong className="text-ink">The size from the stop:</strong> lots = amount you will risk ÷ (stop in pips × value of one pip per lot).
          </p>
          <p className="gx-sheet-foot">Arithmetic. Not the conditions of any account, and not advice.</p>
        </article>

        <article className="gx-sheet" aria-labelledby="sheet-check">
          <p className="label">GIO4X Academy · cheat sheet 2 of 3</p>
          <h2 id="sheet-check" className="h2 mt-8">
            Before any trade
          </h2>
          <p className="mt-8 max-w-measure text-ink-2">Nine questions, in order. If any has no answer, the order is not finished.</p>
          <ol className="mt-21 border-t border-line-strong">
            {CHECKS.map(([k, q], i) => (
              <li key={k} className="grid grid-cols-[1.5rem_6.5rem_minmax(0,1fr)_1.3125rem] items-baseline gap-x-13 border-b border-line py-13">
                <span className="num text-xs font-semibold text-prestige-ink">{i + 1}</span>
                <span className="font-medium text-ink">{k}</span>
                <span className="text-ink-2">{q}</span>
                <span aria-hidden className="h-[1.125rem] w-[1.125rem] self-center border border-line-strong" />
              </li>
            ))}
          </ol>
          <p className="gx-sheet-foot">A method for checking an order. It removes avoidable mistakes; it does not make a trade win.</p>
        </article>

        <article className="gx-sheet" aria-labelledby="sheet-candle">
          <p className="label">GIO4X Academy · cheat sheet 3 of 3</p>
          <h2 id="sheet-candle" className="h2 mt-8">
            Reading a candle
          </h2>
          <div className="mt-21 grid gap-34 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <svg viewBox="0 0 160 260" className="h-auto w-full max-w-[10rem]" role="img" aria-label="A candlestick with its open, high, low and close marked">
              <line x1="60" y1="20" x2="60" y2="240" stroke="var(--ink)" strokeWidth="2" />
              <rect x="38" y="80" width="44" height="110" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2" />
              {[
                [20, "HIGH"],
                [80, "CLOSE"],
                [190, "OPEN"],
                [240, "LOW"],
              ].map(([y, t]) => (
                <g key={t}>
                  <line x1="88" y1={y} x2="104" y2={y} stroke="var(--ink-3)" />
                  <text x="108" y={Number(y) + 4} fontSize="11" fontWeight="600" fill="var(--ink-2)" fontFamily="var(--font-inter), system-ui, sans-serif">
                    {t}
                  </text>
                </g>
              ))}
            </svg>
            <dl className="border-t border-line-strong">
              {CANDLE.map(([k, v]) => (
                <div key={k} className="grid gap-x-13 border-b border-line py-13 sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <dt className="font-medium text-ink">{k}</dt>
                  <dd className="text-ink-2">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="gx-sheet-foot">Drawn as a candle that closed above its open. General reading, not a signal.</p>
        </article>

        <p className="no-print text-sm text-ink-3">{riskWarning}</p>
      </div>

      <div className="no-print">
        <NextSteps
          items={[
            { kind: "Academy", label: "Your first trade", href: "/academy/first-trade", note: "A ten-minute course in three rooms." },
            { kind: "Tool", label: "Pip value calculator", href: "/tools/pip-value", note: "For any pair and size." },
            { kind: "Tool", label: "Position size", href: "/tools/position-size", note: "The size that fits a stop and a risk amount." },
            { kind: "Academy", label: "All lessons", href: "/academy", note: "The course, by level and by learning path." },
          ]}
        />
      </div>
    </>
  );
}

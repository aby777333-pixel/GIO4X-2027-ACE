import Link from "next/link";
import { Change, RangeBar } from "@/components/ui/Data";
import { DataNote } from "@/components/ui/Page";
import { instrumentHref, type Instrument } from "@/data/instruments";
import { correlation, crossChange, crossSeries, formatFixingDate, formatRate, PERIODS, RATES_SOURCE, type RateCurrency, type ReferenceRates } from "@/lib/rates";
import { formatCorr, ratePair } from "./graph";

type Ok = Extract<ReferenceRates, { status: "ok" }>;

const WINDOW = 63;

/**
 * The fixing history drawn at reading size: a line, its low and high marked
 * and labelled, first and last dates on the axis. Shape with numbers beside
 * it, and a sentence that says the same thing for those who cannot see it.
 */
function FixingChart({ values, dates, quote, symbol }: { values: number[]; dates: string[]; quote: string; symbol: string }) {
  const W = 610;
  const H = 233;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const iMin = values.indexOf(min);
  const iMax = values.indexOf(max);
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => 8 + (1 - (v - min) / span) * (H - 16);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const last = values[values.length - 1];
  const dot = (i: number) => ({ left: `${(x(i) / W) * 100}%`, top: `${(y(values[i]) / H) * 100}%` });
  const summary = `${symbol}: ${values.length} ECB reference fixings from ${formatFixingDate(dates[0])} to ${formatFixingDate(dates[dates.length - 1])}. Lowest ${formatRate(min, quote)} on ${formatFixingDate(dates[iMin])}, highest ${formatRate(max, quote)} on ${formatFixingDate(dates[iMax])}, last ${formatRate(last, quote)}.`;

  return (
    <figure>
      <div className="grid grid-cols-[1fr_auto] gap-x-13">
        <div className="relative aspect-[2/1] sm:aspect-[2.618/1]">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label={summary}>
            <path d={`M0 ${y(max).toFixed(1)}H${W}`} stroke="var(--line-strong)" strokeDasharray="2 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <path d={`M0 ${y(min).toFixed(1)}H${W}`} stroke="var(--line-strong)" strokeDasharray="2 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <path d={`${d} L${W} ${H} L0 ${H} Z`} fill="var(--viz-faint)" opacity="0.6" />
            <path d={d} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {[iMin, iMax].map((i) => (
            <span key={i} aria-hidden className="absolute h-[0.4375rem] w-[0.4375rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink bg-paper" style={dot(i)} />
          ))}
          <span aria-hidden className="absolute h-[0.4375rem] w-[0.4375rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" style={dot(values.length - 1)} />
        </div>
        <div className="flex flex-col justify-between py-[0.1rem] text-right" aria-hidden>
          <span>
            <span className="label block">High</span>
            <span className="num block text-sm font-medium">{formatRate(max, quote)}</span>
            <span className="num block text-xs text-ink-3">{formatFixingDate(dates[iMax]).replace(/ \d{4}$/, "")}</span>
          </span>
          <span>
            <span className="label block">Low</span>
            <span className="num block text-sm font-medium">{formatRate(min, quote)}</span>
            <span className="num block text-xs text-ink-3">{formatFixingDate(dates[iMin]).replace(/ \d{4}$/, "")}</span>
          </span>
        </div>
        <div className="num mt-8 flex justify-between border-t border-line pt-5 text-xs text-ink-3" aria-hidden>
          <span>{formatFixingDate(dates[0])}</span>
          <span>{formatFixingDate(dates[dates.length - 1])}</span>
        </div>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

function CorrList({ title, note, rows }: { title: string; note: string; rows: { i: Instrument; c: number }[] }) {
  return (
    <div>
      <h3 className="label">{title}</h3>
      <ul className="mt-8 border-t border-line">
        {rows.map(({ i, c }) => (
          <li key={i.slug} className="border-b border-line">
            <Link href={instrumentHref(i)} className="group grid min-h-[2.75rem] grid-cols-[5rem_1fr_3.25rem] items-center gap-13">
              <span className="num text-sm font-semibold tracking-[0.02em] transition-colors duration-fast group-hover:text-accent">{i.symbol}</span>
              {/* a centre-zero bar: length is the coefficient, the number beside it carries the sign */}
              <span className="relative block h-[0.3125rem]" aria-hidden>
                <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
                <span className="absolute inset-y-[-3px] left-1/2 w-px bg-line-strong" />
                <span className="absolute inset-y-0 bg-ink-3" style={c >= 0 ? { left: "50%", width: `${Math.min(50, c * 50)}%` } : { right: "50%", width: `${Math.min(50, -c * 50)}%` }} />
              </span>
              <span className="num text-right text-sm font-medium">{formatCorr(c)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs text-ink-3">{note}</p>
    </div>
  );
}

/**
 * The reference panel of a currency-pair page: where the pair last fixed, how
 * far it has travelled over 1, 5, 21 and 63 fixings, the shape of the last 63
 * with its range, and how its daily changes have lined up with other pairs.
 * Descriptive statistics of ECB reference fixings; nothing here is a forecast.
 */
export function ReferencePanel({ rates, instrument, peers }: { rates: Ok; instrument: Instrument; peers: Instrument[] }) {
  const pair = ratePair(instrument);
  if (!pair) return null;
  const [b, q]: [RateCurrency, RateCurrency] = pair;
  const full = crossSeries(rates, b, q);
  const take = Math.min(WINDOW, full.length);
  const series = full.slice(-take);
  const dates = rates.dates.slice(-take);
  const last = series[series.length - 1];
  const low = Math.min(...series);
  const high = Math.max(...series);

  const corr = peers
    .flatMap((p) => {
      const pp = ratePair(p);
      if (!pp || p.slug === instrument.slug) return [];
      const c = correlation(full.slice(-(take + 1)), crossSeries(rates, pp[0], pp[1]).slice(-(take + 1)));
      return c === null ? [] : [{ i: p, c }];
    })
    .sort((x, y) => y.c - x.c);
  const most = corr.slice(0, 3);
  const least = corr.slice(-3).reverse();

  return (
    <div>
      <div className="grid gap-34 lg:grid-cols-phi-r lg:gap-55">
        <div>
          <p className="label">Last reference fixing</p>
          <p className="num mt-8 font-display text-4xl font-light tracking-[-0.02em]">{formatRate(last, q)}</p>
          <p className="mt-5 text-sm text-ink-3">
            {q} per 1 {b} · {formatFixingDate(rates.date)}
          </p>
          <dl className="mt-21 grid grid-cols-2 border-l border-t border-line">
            {PERIODS.map((p) => (
              <div key={p.key} className="border-b border-r border-line p-13">
                <dt className="label">{p.label}</dt>
                <dd className="mt-5 text-[0.9375rem] font-medium">
                  <Change value={crossChange(rates, b, q, p.n)} />
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-21">
            <p className="label">Position in the {take}-fixing range</p>
            <RangeBar low={low} high={high} value={last} className="mt-13" />
            <p className="num mt-8 flex justify-between text-xs text-ink-3">
              <span>Low {formatRate(low, q)}</span>
              <span className="sr-only">, last {formatRate(last, q)}, </span>
              <span>High {formatRate(high, q)}</span>
            </p>
          </div>
        </div>
        <div>
          <p className="label mb-13">The last {take} fixings</p>
          <FixingChart values={series} dates={dates} quote={q} symbol={instrument.symbol} />
        </div>
      </div>

      {corr.length >= 2 && (
        <div className="mt-55 border-t border-line-strong pt-21">
          <div className="grid gap-34 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-55">
            <div>
              <h3 className="h4">Moved together, moved apart</h3>
              <p className="mt-8 text-sm text-ink-2">
                Correlation of daily log returns between {instrument.symbol} and the other pairs on this site over the same {take} fixings. +1.00 means the daily changes lined up perfectly, −1.00 that they mirrored each other, 0 that they were unrelated.
              </p>
              <p className="mt-8 text-sm text-ink-3">A descriptive statistic of reference fixings over one window. Correlations change, and they say nothing about what comes next.</p>
            </div>
            <CorrList title="Highest correlation" note="Daily changes most often in the same direction." rows={most} />
            <CorrList title="Lowest correlation" note="Daily changes least aligned, or opposed when negative." rows={least} />
          </div>
        </div>
      )}

      <DataNote className="mt-34" status="reference" source={RATES_SOURCE.name} sourceHref={RATES_SOURCE.href} updated={formatFixingDate(rates.date)}>
        {RATES_SOURCE.cadence}. Not live, not tradable and not a GIO4X price. Changes compare the last fixing with the fixing 1, 5, 21 and 63 publications earlier.
      </DataNote>
    </div>
  );
}

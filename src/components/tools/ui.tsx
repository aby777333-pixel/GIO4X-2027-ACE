"use client";

import Link from "next/link";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { DataNote } from "@/components/ui/Page";
import { educationalNote } from "@/config/legal";
import { isRateCurrency, RATES_SOURCE } from "@/lib/rates";
import { CUSTOM_ID, DEFAULT_INSTRUMENT, decimalsOf, fixingDate, fmtRate, parse, RATE_CURRENCIES, refRate, SPECS, type Parsed, type RateCurrency, type RatesProp } from "./calc";
import type { Calc } from "./store";

/* ==========================================================================
   Types shared by every tool
   ========================================================================== */

export type ToolMeta = { slug: string; name: string; formula: string; glossary: { slug: string; term: string }[] };
export type ToolProps = { meta: ToolMeta; rates: RatesProp };
/** One line of working: what is being computed, and the arithmetic with the visitor's numbers. */
export type Step = { what: string; calc: string };

/* ==========================================================================
   Fields
   ========================================================================== */

type NumFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: ReactNode;
  unit?: string;
  /** ArrowUp / ArrowDown change the value by this much */
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  /** rendered between the input and its hint (the paired slider) */
  slot?: ReactNode;
};

function stepValue(value: string, dir: 1 | -1, step: number, min?: number, max?: number): string | null {
  const n = Number(value.replace(",", "."));
  if (value.trim() === "" || !Number.isFinite(n)) return null;
  let v = n + dir * step;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return String(Number(v.toFixed(Math.max(decimalsOf(step), 0) + 1)));
}

/** A labelled decimal input. The hint line is always present, so an error never moves the layout. */
export function NumField({ id, label, value, onChange, error, hint, unit, step, min, max, placeholder, className = "", slot }: NumFieldProps) {
  const noteId = `${id}-note`;
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!step || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    const next = stepValue(value, e.key === "ArrowUp" ? 1 : -1, step, min, max);
    if (next === null) return;
    e.preventDefault();
    onChange(next);
  };
  return (
    <div className={`field content-start ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          className={`input num ${unit ? "pr-55" : ""}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? noteId : undefined}
        />
        {unit && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-13 flex items-center text-xs font-semibold tracking-[0.06em] text-ink-3">
            {unit}
          </span>
        )}
      </div>
      {slot}
      <p id={noteId} className={`min-h-[1.25rem] ${error ? "field-error" : "field-hint"}`}>
        {error ?? hint}
      </p>
    </div>
  );
}

/** A slider always paired with a number field: the same value, two ways in. */
export function RangeField(p: NumFieldProps & { min: number; max: number; step: number; sliderMin?: number; sliderMax?: number }) {
  const n = Number(p.value.replace(",", "."));
  const hi = p.sliderMax ?? p.max;
  const lo = p.sliderMin ?? p.min;
  const v = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
  return (
    <NumField
      {...p}
      slot={
        <input
          type="range"
          className="range !h-[2.75rem] -my-5"
          min={lo}
          max={hi}
          step={p.step}
          value={v}
          onChange={(e) => p.onChange(e.target.value)}
          aria-label={`${p.label}, slider`}
          aria-valuetext={`${v}${p.unit ? ` ${p.unit}` : ""}`}
        />
      }
    />
  );
}

export function SelectField({ id, label, value, onChange, children, hint, className = "" }: { id: string; label: string; value: string; onChange: (v: string) => void; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={`field content-start ${className}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-note` : undefined}>
        {children}
      </select>
      <p id={`${id}-note`} className="field-hint min-h-[1.25rem]">
        {hint}
      </p>
    </div>
  );
}

/** A true two- or three-way toggle. */
export function Seg<T extends string>({ label, value, onChange, options, className = "" }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div className={`field content-start ${className}`}>
      <span className="field-label" id={`seg-${label.replace(/\W+/g, "-")}`}>
        {label}
      </span>
      <div className="seg w-full" role="group" aria-labelledby={`seg-${label.replace(/\W+/g, "-")}`}>
        {options.map((o) => (
          <button key={o.value} type="button" className="!h-[2.75rem] flex-1 justify-center" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      <p className="min-h-[1.25rem]" aria-hidden />
    </div>
  );
}

export function CurrencyOptions() {
  return (
    <>
      {RATE_CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </>
  );
}

export function AccountCurrencyField({ calc, set, className }: { calc: Calc; set: (p: Partial<Calc>) => void; className?: string }) {
  return (
    <SelectField id="acct-ccy" label="Account currency" value={accountCurrency(calc)} onChange={(v) => set({ accountCurrency: v })} className={className}>
      <CurrencyOptions />
    </SelectField>
  );
}

export const accountCurrency = (calc: Calc): RateCurrency => (isRateCurrency(calc.accountCurrency) ? calc.accountCurrency : "USD");

/* ==========================================================================
   Instrument
   ========================================================================== */

export type Resolved = {
  id: string;
  symbol: string;
  name: string;
  fx: boolean;
  custom: boolean;
  base?: RateCurrency;
  quote: RateCurrency;
  contractLabel: string;
  contract: Parsed;
  pip: Parsed;
  unit: "pip" | "point";
  ok: boolean;
};

/** Turn the stored selection into a contract the arithmetic can use. */
export function resolveSpec(calc: Calc, fxOnly = false): Resolved {
  if (!fxOnly && calc.instrument === CUSTOM_ID) {
    const contract = parse(calc.customContract, { label: "Contract size", gt: 0, max: 1e9 });
    const pip = parse(calc.pointSize, { label: "Point size", gt: 0, max: 1e6 });
    const quote = isRateCurrency(calc.customQuote) ? calc.customQuote : "USD";
    return { id: CUSTOM_ID, symbol: "your instrument", name: "Another instrument", fx: false, custom: true, quote, contractLabel: "Contract entered by you", contract, pip, unit: "point", ok: contract.ok && pip.ok };
  }
  const s = SPECS.find((x) => x.id === calc.instrument && (!fxOnly || x.fx)) ?? SPECS.find((x) => x.id === DEFAULT_INSTRUMENT) ?? SPECS[0];
  const pip: Parsed = s.pip !== null ? { ok: true, n: s.pip } : parse(calc.pointSize, { label: "Point size", gt: 0, max: 1e6 });
  return { id: s.id, symbol: s.symbol, name: s.name, fx: s.fx, custom: false, base: s.base, quote: s.quote, contractLabel: s.contractLabel, contract: { ok: true, n: s.contract }, pip, unit: s.fx ? "pip" : "point", ok: pip.ok };
}

const GROUPS = ["Currency pairs", "Metals", "Share CFDs"] as const;

/** Instrument select, plus the extra fields an instrument without a pip convention needs. */
export function InstrumentFields({ calc, set, inst, fxOnly = false }: { calc: Calc; set: (p: Partial<Calc>) => void; inst: Resolved; fxOnly?: boolean }) {
  return (
    <>
      <SelectField
        id="instrument"
        label="Instrument"
        value={inst.id}
        onChange={(v) => set({ instrument: v })}
        hint={inst.custom ? "Take the contract size from your platform’s specification." : inst.contractLabel}
      >
        {GROUPS.filter((g) => !fxOnly || g === "Currency pairs").map((g) => (
          <optgroup key={g} label={g}>
            {SPECS.filter((s) => s.group === g).map((s) => (
              <option key={s.id} value={s.id}>
                {s.symbol}
                {s.fx ? "" : ` · ${s.name}`}
              </option>
            ))}
          </optgroup>
        ))}
        {!fxOnly && (
          <optgroup label="Not listed">
            <option value={CUSTOM_ID}>Another instrument (enter the contract)</option>
          </optgroup>
        )}
      </SelectField>
      {inst.custom && (
        <>
          <NumField id="custom-contract" label="Contract size (units per lot)" value={calc.customContract} onChange={(v) => set({ customContract: v })} error={inst.contract.error} hint="Units of the underlying in one lot." />
          <SelectField id="custom-quote" label="Quoted in" value={inst.quote} onChange={(v) => set({ customQuote: v })} hint="The currency the price is quoted in.">
            <CurrencyOptions />
          </SelectField>
        </>
      )}
      {!inst.fx && (
        <NumField
          id="point-size"
          label="Point size"
          value={calc.pointSize}
          onChange={(v) => set({ pointSize: v })}
          error={inst.pip.error}
          hint="The price increment you count in. Conventions differ between platforms."
        />
      )}
    </>
  );
}

/* ==========================================================================
   Currency conversion at the ECB reference fixing, or a rate typed by the visitor
   ========================================================================== */

export type Conversion = {
  /** units of `to` per one `from`; null until a usable rate exists */
  rate: number | null;
  kind: "same" | "ecb" | "manual";
  /** rendered inside the inputs when the visitor has to type the rate */
  field: ReactNode;
  /** rendered under the result: says which rate was used and that a dealing rate would differ */
  note: ReactNode;
  /** short text for the working */
  label: string;
};

export function useConversion(rates: RatesProp, from: RateCurrency, to: RateCurrency, id = "fx"): Conversion {
  const [manual, setManual] = useState<Record<string, string>>({});
  if (from === to) return { rate: 1, kind: "same", field: null, note: null, label: "" };
  if (rates.status === "ok") {
    const rate = refRate(rates, from, to);
    return {
      rate,
      kind: "ecb",
      field: null,
      label: `ECB reference, ${fixingDate(rates.date)}`,
      note: (
        <DataNote status="reference" source={RATES_SOURCE.name} sourceHref={RATES_SOURCE.href} updated={fixingDate(rates.date)}>
          Converted at 1 {from} = <span className="num">{fmtRate(rate)}</span> {to}. A daily reference fixing, not a dealing rate: the rate applied to an account would differ.
        </DataNote>
      ),
    };
  }
  const key = `${from}${to}`;
  const raw = manual[key] ?? "";
  const p = parse(raw, { label: "The rate", gt: 0, max: 1e7 });
  return {
    rate: p.ok ? p.n : null,
    kind: "manual",
    label: "rate entered by you",
    field: (
      <NumField
        id={`${id}-manual-rate`}
        label={`Rate: 1 ${from} in ${to}`}
        value={raw}
        onChange={(v) => setManual((m) => ({ ...m, [key]: v }))}
        error={raw !== "" ? p.error : undefined}
        hint={`The ECB reference rates could not be loaded, so type the rate to use for ${from} into ${to}.`}
        className="sm:col-span-2"
      />
    ),
    note: (
      <DataNote status="unavailable" source={RATES_SOURCE.name} sourceHref={RATES_SOURCE.href}>
        The ECB reference rates could not be loaded ({rates.reason.toLowerCase()}), so nothing is prefilled. The conversion uses the rate you type.
      </DataNote>
    ),
  };
}

/* ==========================================================================
   Layout: the tool (61.8%) beside "How it works" (38.2%)
   ========================================================================== */

export function ToolLayout({ meta, children, steps, assumptions }: { meta: ToolMeta; children: ReactNode; steps: Step[] | null; assumptions: ReactNode[] }) {
  return (
    <div className="phi items-start">
      <div className="panel min-w-0 p-21 sm:p-34">{children}</div>
      <aside aria-labelledby="how-it-works" className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]">
        <h2 id="how-it-works" className="eyebrow">
          How it works
        </h2>

        <h3 className="label mt-21">Formula</h3>
        <p className="mt-8 font-display text-lg leading-snug text-ink">{meta.formula}</p>

        <h3 className="label mt-34">With your numbers</h3>
        {steps ? (
          <ol className="mt-8 border-t border-line">
            {steps.map((s, i) => (
              <li key={s.what} className="grid grid-cols-[1.3125rem_minmax(0,1fr)] gap-x-8 border-b border-line py-13">
                <span className="num pt-2 text-xs font-semibold text-prestige-ink">{i + 1}</span>
                <span>
                  <span className="block text-xs text-ink-3">{s.what}</span>
                  <span className="num mt-2 block break-words text-[0.9375rem] text-ink">{s.calc}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-8 border-y border-line py-13 text-sm text-ink-3">The working appears here once every input holds a valid number.</p>
        )}

        <h3 className="label mt-34">Assumptions</h3>
        <ul className="mt-8 grid gap-8 text-sm text-ink-2">
          {assumptions.map((a, i) => (
            <li key={i} className="relative pl-21 before:absolute before:left-0 before:top-[0.7em] before:h-px before:w-8 before:bg-line-strong">
              {a}
            </li>
          ))}
        </ul>

        <h3 className="label mt-34">Terms used</h3>
        <ul className="mt-8 flex flex-wrap gap-x-13 gap-y-5 text-sm">
          {meta.glossary.map((g) => (
            <li key={g.slug}>
              <Link href={`/glossary/${g.slug}`} className="link inline-flex min-h-[2.125rem] items-center">
                {g.term}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

export function Inputs({ children, legend = "Your figures" }: { children: ReactNode; legend?: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className="label">{legend}</legend>
      <div className="mt-13 grid gap-x-21 gap-y-13 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** The result region. Announced politely; always the same shape, so typing never moves the page. */
export function Outcome({ children, title = "Result" }: { children: ReactNode; title?: string }) {
  return (
    <section className="mt-21 border-t border-line-strong pt-21" aria-label={title}>
      {children}
    </section>
  );
}

export function Live({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div aria-live="polite" aria-atomic="true" className={className}>
      {children}
    </div>
  );
}

export function Headline({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub?: ReactNode; tone?: "pos" | "neg" }) {
  // an amount of money keeps its ISO code small, beside the figure
  const m = unit ? null : /^(.*d) ([A-Z]{3})$/.exec(value);
  const main = m ? m[1] : value;
  const small = m ? m[2] : unit;
  return (
    <div className="min-w-0">
      <p className="label">{label}</p>
      <p className={`num mt-5 break-words font-display text-2xl font-light leading-tight sm:text-3xl ${tone === "neg" ? "text-neg" : tone === "pos" ? "text-pos" : "text-ink"}`}>
        {main}
        {small && <span className="ml-8 whitespace-nowrap font-sans text-sm font-medium text-ink-3">{small}</span>}
      </p>
      <p className="mt-5 min-h-[1.25rem] text-sm text-ink-3">{sub}</p>
    </div>
  );
}

export function Rows({ rows, className = "" }: { rows: { label: string; value: ReactNode; tone?: "pos" | "neg" }[]; className?: string }) {
  return (
    <dl className={`border-t border-line ${className}`}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-21 border-b border-line py-13">
          <dt className="text-sm text-ink-3">{r.label}</dt>
          <dd className={`num text-right text-[0.9375rem] font-medium ${r.tone === "neg" ? "text-neg" : r.tone === "pos" ? "text-pos" : "text-ink"}`}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Shown in place of a result while an input is missing or out of range. */
export const DASH = "–";

/** Every result is a calculation on the visitor's own inputs, and says so. */
export function SimulationNote({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <div className={`mt-21 grid gap-8 ${className}`}>
      <DataNote status="simulation">
        A calculation on the figures you entered. {children} {educationalNote}
      </DataNote>
    </div>
  );
}

/** A figure with a visible caption and a text equivalent for the drawing. */
export function Figure({ caption, children, className = "" }: { caption: ReactNode; children: ReactNode; className?: string }) {
  return (
    <figure className={`mt-21 ${className}`}>
      {children}
      <figcaption className="mt-8 text-xs text-ink-3">{caption}</figcaption>
    </figure>
  );
}

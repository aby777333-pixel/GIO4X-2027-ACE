"use client";

import { useState } from "react";
import { decimalsOf, fixingDate, fmt, parse, pct, plain, refRate } from "./calc";
import { useCalc } from "./store";
import { DASH, Figure, Headline, Inputs, Live, NumField, Outcome, resolveSpec, SimulationNote, ToolLayout, type Step, type ToolProps } from "./ui";
import { Ruler } from "./viz";

const COMMON = [0.5, 1, 1.5, 2, 3, 5];
const breakEven = (ratio: number) => (1 / (1 + ratio)) * 100;

export function RiskReward({ meta, rates }: ToolProps) {
  const [calc] = useCalc();
  const inst = resolveSpec(calc);
  const [typed, setTyped] = useState<{ entry?: string; stop?: string; target?: string }>({});

  // Placeholders come from the reference rate of the currency pair selected elsewhere in the toolkit, if there is one.
  const ref = inst.fx && inst.base && inst.pip.ok && rates.status === "ok" ? refRate(rates, inst.base, inst.quote) : null;
  const dp = inst.pip.ok ? decimalsOf(inst.pip.n) + 1 : 2;
  const base = ref !== null ? Number(plain(ref, dp)) : null;
  const pre = base !== null && inst.pip.ok ? { entry: plain(base, dp), stop: plain(base - 25 * inst.pip.n, dp), target: plain(base + 50 * inst.pip.n, dp) } : null;
  const entryRaw = typed.entry ?? pre?.entry ?? "";
  const stopRaw = typed.stop ?? pre?.stop ?? "";
  const targetRaw = typed.target ?? pre?.target ?? "";
  const untouched = pre !== null && typed.entry === undefined && typed.stop === undefined && typed.target === undefined;

  const entry = parse(entryRaw, { label: "Entry", gt: 0, max: 1e9 });
  const stop = parse(stopRaw, { label: "Stop", gt: 0, max: 1e9 });
  const target = parse(targetRaw, { label: "Target", gt: 0, max: 1e9 });

  let stopError = stopRaw === "" ? undefined : stop.error;
  let targetError = targetRaw === "" ? undefined : target.error;
  let r: { risk: number; reward: number; ratio: number; be: number; long: boolean } | null = null;
  if (entry.ok && stop.ok && target.ok) {
    if (stop.n === entry.n) stopError = "The stop must differ from the entry.";
    else if (target.n === entry.n) targetError = "The target must differ from the entry.";
    else if (stop.n < entry.n !== target.n > entry.n) targetError = "The target must be on the other side of the entry from the stop.";
    else {
      const risk = Math.abs(entry.n - stop.n);
      const reward = Math.abs(target.n - entry.n);
      const ratio = reward / risk;
      r = { risk, reward, ratio, be: breakEven(ratio), long: stop.n < entry.n };
    }
  }
  const p = (n: number) => fmt(n, 0, 6);

  const steps: Step[] | null = r
    ? [
        { what: "Risk: distance from entry to stop", calc: `|${p(entry.n)} − ${p(stop.n)}| = ${p(r.risk)}` },
        { what: "Reward: distance from entry to target", calc: `|${p(target.n)} − ${p(entry.n)}| = ${p(r.reward)}` },
        { what: "Ratio (reward ÷ risk)", calc: `${p(r.reward)} ÷ ${p(r.risk)} = ${fmt(r.ratio, 2, 2)}` },
        { what: "Break-even win rate", calc: `1 ÷ (1 + ${fmt(r.ratio, 2, 2)}) = ${pct(r.be)}` },
      ]
    : null;

  return (
    <ToolLayout
      meta={meta}
      steps={steps}
      assumptions={[
        "Every losing trade loses exactly the risk and every winning trade gains exactly the reward. Real fills vary: a stop can be filled beyond its level.",
        "Costs are ignored. Spread and commission raise the win rate needed to break even.",
        "The break-even win rate is arithmetic. It says nothing about how often a target is in fact reached, and no ratio is better in itself.",
      ]}
    >
      <Inputs legend="Three prices">
        <NumField
          id="entry"
          label="Entry"
          value={entryRaw}
          onChange={(v) => setTyped((t) => ({ ...t, entry: v }))}
          error={entryRaw === "" ? undefined : entry.error}
          placeholder="Type a price"
          className="sm:col-span-2"
          hint={untouched && rates.status === "ok" ? `Placeholders built from the ${inst.symbol} ECB reference of ${fixingDate(rates.date)}. Overwrite all three.` : "Any instrument: only the distances matter."}
        />
        <NumField id="stop" label="Stop loss" value={stopRaw} onChange={(v) => setTyped((t) => ({ ...t, stop: v }))} error={stopError} placeholder="Type a price" />
        <NumField id="target" label="Target" value={targetRaw} onChange={(v) => setTyped((t) => ({ ...t, target: v }))} error={targetError} placeholder="Type a price" />
      </Inputs>

      <Outcome>
        <Live className="grid gap-21 sm:grid-cols-2">
          <Headline label="Risk : reward" value={r ? `1 : ${fmt(r.ratio, 2, 2)}` : DASH} sub={r ? `${r.long ? "A buy" : "A sell"}: risk ${p(r.risk)}, reward ${p(r.reward)}` : "Enter an entry, a stop and a target."} />
          <Headline label="Break-even win rate" value={r ? pct(r.be) : DASH} sub={r ? `Below this share of winning trades, the set loses money before costs.` : undefined} />
        </Live>

        <Figure caption={r ? `Price ruler, lower prices to the left. The distance from entry to stop is the risk; the distance from entry to target is the reward, ${fmt(r.ratio, 2, 2)} times as long.` : "The ruler shows the three prices at their true relative distances."}>
          {r ? (
            <Ruler
              marks={[
                { value: stop.n, label: "Stop", sub: p(stop.n), side: "below", tone: "neg" },
                { value: entry.n, label: "Entry", sub: p(entry.n), side: "above" },
                { value: target.n, label: "Target", sub: p(target.n), side: "below", tone: "pos" },
              ]}
              spans={[
                { from: stop.n, to: entry.n, tone: "neg" },
                { from: entry.n, to: target.n, tone: "pos" },
              ]}
            />
          ) : (
            <div aria-hidden className="relative h-[144px]">
              <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
            </div>
          )}
        </Figure>

        <div className="scroll-x mt-13">
          <table className="table-gx">
            <caption className="label pb-8 text-left">Break-even win rate for common ratios</caption>
            <thead>
              <tr>
                <th scope="col">Risk : reward</th>
                <th scope="col" className="max-sm:hidden">
                  Wins per 100 to break even
                </th>
                <th scope="col" className="!pr-0 !text-right">
                  Break-even win rate
                </th>
              </tr>
            </thead>
            <tbody>
              {r && !COMMON.includes(Number(r.ratio.toFixed(4))) && (
                <tr>
                  <th scope="row" className="num !border-line !text-sm !normal-case !tracking-normal !text-ink">
                    1 : {fmt(r.ratio, 2, 2)} <span className="font-normal text-ink-3">(yours)</span>
                  </th>
                  <td className="num max-sm:hidden">{fmt(Math.ceil(r.be - 1e-9))}</td>
                  <td className="num !pr-0 text-right font-medium">{pct(r.be)}</td>
                </tr>
              )}
              {COMMON.map((c) => {
                const mine = r !== null && Number(r.ratio.toFixed(4)) === c;
                return (
                  <tr key={c}>
                    <th scope="row" className="num !border-line !text-sm !normal-case !tracking-normal !text-ink" style={{ fontWeight: mine ? 600 : 400 }}>
                      1 : {fmt(c, 0, 1)} {mine && <span className="font-normal text-ink-3">(yours)</span>}
                    </th>
                    <td className="num max-sm:hidden">{fmt(Math.ceil(breakEven(c) - 1e-9))}</td>
                    <td className="num !pr-0 text-right font-medium">{pct(breakEven(c))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <SimulationNote>A ratio describes a plan, not its likelihood.</SimulationNote>
      </Outcome>
    </ToolLayout>
  );
}

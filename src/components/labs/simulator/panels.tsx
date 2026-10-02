"use client";

import Link from "next/link";
import { memo, useState, type KeyboardEvent, type ReactNode } from "react";
import { fmt, lotsText, parse, pct } from "@/components/tools/calc";
import { NumField, Seg, SelectField, type Step } from "@/components/tools/ui";
import { DataNote } from "@/components/ui/Page";
import { educationalNote } from "@/config/legal";
import { gainToRecover, marginFor, pipValue, positionSize, r5, SIM, spreadCost, type Account, type Done, type Entry, type OrderKind, type Pending, type Position, type Quote, type Side, type SimState, type Stats } from "./engine";
import { glyph, orderName, pips, px, pxPlain, sim as amt, simSigned, simTime, tell, working } from "./working";

/**
 * The panels of the practice desk: the order ticket, the account in full, the
 * open positions and waiting orders, the journal, the guided exercises and the
 * simulation settings. Each takes the engine's state and reports what the
 * visitor asked for; none of them computes a result of its own.
 */

export type Note = { text: string; bad: boolean } | null;
export type TicketOrder = { type: "market" | OrderKind; side: Side; lots: number; level: number | null; sl: number | null; tp: number | null };

const toPip = (p: number) => r5(Math.round(p / SIM.pip) * SIM.pip);

/** The last thing that happened, repeated beside the control that caused it. The live region itself is on the desk. */
export function NoteLine({ note, className = "" }: { note: Note; className?: string }) {
  return (
    <p aria-hidden className={`min-h-[2.5rem] text-sm ${note?.bad ? "text-neg" : "text-ink-2"} ${className}`}>
      {note ? `${note.bad ? "Not done. " : ""}${note.text}` : ""}
    </p>
  );
}

function Working({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-8 border-t border-line">
      {steps.map((s, i) => (
        <li key={s.what} className="grid grid-cols-[1.3125rem_minmax(0,1fr)] gap-x-8 border-b border-line py-8">
          <span className="num pt-2 text-xs font-semibold text-prestige-ink">{i + 1}</span>
          <span>
            <span className="block text-xs text-ink-3">{s.what}</span>
            <span className="num mt-2 block break-words text-sm text-ink">{s.calc}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Term({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <Link href={`/glossary/${slug}`} className="link">
      {children}
    </Link>
  );
}

/* ==========================================================================
   Order ticket
   ========================================================================== */

export function Ticket({ state, q, acc, onOrder, note }: { state: SimState; q: Quote; acc: Account; onOrder: (o: TicketOrder) => boolean; note: Note }) {
  const [type, setType] = useState<"market" | OrderKind>("market");
  const [side, setSide] = useState<Side>("buy");
  const [lotsRaw, setLotsRaw] = useState("0.10");
  const [slRaw, setSlRaw] = useState("20");
  const [tpRaw, setTpRaw] = useState("");
  const [riskRaw, setRiskRaw] = useState("1");
  const [levelRaw, setLevelRaw] = useState("");
  const [tried, setTried] = useState(false);

  /** a waiting order starts ten pips from the price, on the side its kind allows */
  const startLevel = (t: OrderKind, s: Side) => pxPlain(toPip(s === "buy" ? q.ask + (t === "limit" ? -10 : 10) * SIM.pip : q.bid + (t === "limit" ? 10 : -10) * SIM.pip));
  const chooseType = (t: "market" | OrderKind) => {
    setType(t);
    if (t !== "market") setLevelRaw(startLevel(t, side));
  };
  const chooseSide = (s: Side) => {
    setSide(s);
    if (type !== "market") setLevelRaw(startLevel(type, s));
  };

  const lots = parse(lotsRaw, { label: "Size", min: SIM.minLots, max: SIM.maxLots });
  const sl = slRaw.trim() === "" ? null : parse(slRaw, { label: "Stop distance", gt: 0, max: 5000 });
  const tp = tpRaw.trim() === "" ? null : parse(tpRaw, { label: "Target distance", gt: 0, max: 5000 });
  const risk = parse(riskRaw, { label: "Risk", gt: 0, max: 100 });
  const level = parse(levelRaw, { label: "Level", gt: 0, max: 1000 });

  const dir = side === "buy" ? 1 : -1;
  const market = side === "buy" ? q.ask : q.bid;
  const entry = type === "market" ? market : level.ok ? r5(level.n) : null;
  const slPrice = entry !== null && sl?.ok ? r5(entry - dir * sl.n * SIM.pip) : null;
  const tpPrice = entry !== null && tp?.ok ? r5(entry + dir * tp.n * SIM.pip) : null;
  const need = lots.ok && entry !== null ? marginFor(lots.n, entry, state.leverage) : null;
  const ready = lots.ok && entry !== null && (sl === null || sl.ok) && (tp === null || tp.ok);

  const sized = risk.ok && sl?.ok && state.balance > 0 ? positionSize(state.balance, risk.n, sl.n) : null;
  const sizeSteps: Step[] | null =
    sized && risk.ok && sl?.ok
      ? [
          { what: "Amount at risk", calc: `${fmt(state.balance, 2, 2)} × ${pct(risk.n)} = ${amt(sized.amount)}` },
          { what: "Value of one pip on one lot", calc: `${fmt(SIM.pip, 0, 4)} × ${fmt(SIM.contract)} = ${amt(pipValue(1))}` },
          { what: "Loss on one lot if the stop is reached", calc: `${fmt(sl.n)} pips × ${fmt(pipValue(1), 2, 2)} = ${amt(sized.perLot)}` },
          { what: "Position size", calc: `${fmt(sized.amount, 2, 2)} ÷ ${fmt(sized.perLot, 2, 2)} = ${fmt(sized.lots, 2, 4)} lots` },
          { what: `Rounded down to ${fmt(SIM.lotStep, 2, 2)}-lot steps`, calc: `${fmt(sized.stepped, 2, 2)} lots, risking ${amt(sized.steppedRisk)}` },
        ]
      : null;

  const submit = () => {
    setTried(true);
    if (!ready || !lots.ok || entry === null) return;
    if (onOrder({ type, side, lots: lots.n, level: type === "market" ? null : entry, sl: slPrice, tp: tpPrice })) setTried(false);
  };

  const verb = side === "buy" ? "Buy" : "Sell";
  const action = type === "market" ? `${verb} ${lots.ok ? lotsText(lots.n) : ""} at the ${side === "buy" ? "ask" : "bid"}` : `Place ${orderName(side, type).toLowerCase()}`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      <div className="grid gap-x-13 gap-y-8 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Seg
          label="Order type"
          value={type}
          onChange={chooseType}
          options={[
            { value: "market", label: "Market" },
            { value: "limit", label: "Limit" },
            { value: "stop", label: "Stop" },
          ]}
          className="[&_p]:hidden"
        />
        <Seg
          label="Direction"
          value={side}
          onChange={chooseSide}
          options={[
            { value: "buy", label: "Buy" },
            { value: "sell", label: "Sell" },
          ]}
          className="[&_p]:hidden"
        />
        {type !== "market" && (
          <NumField
            id="sim-level"
            label={`${orderName(side, type)} level`}
            value={levelRaw}
            onChange={setLevelRaw}
            step={SIM.pip}
            error={level.error}
            hint={type === "limit" ? `Waits ${side === "buy" ? "below the ask" : "above the bid"}; fills at this price or better.` : `Waits ${side === "buy" ? "above the ask" : "below the bid"}; becomes a market order when reached.`}
            className="sm:col-span-2 lg:col-span-1 xl:col-span-2"
          />
        )}
        <NumField id="sim-lots" label="Size" unit="lots" value={lotsRaw} onChange={setLotsRaw} step={SIM.lotStep} min={SIM.minLots} max={SIM.maxLots} error={lots.error} hint={lots.ok ? `One pip is worth ${amt(pipValue(lots.n))} at this size.` : undefined} />
        <NumField
          id="sim-sl"
          label="Stop loss, pips from entry"
          unit="pips"
          value={slRaw}
          onChange={setSlRaw}
          step={1}
          min={1}
          error={sl?.error}
          hint={slPrice !== null ? `At ${px(slPrice)}. Leave empty for none.` : "Optional. Empty means no stop loss."}
        />
        <NumField id="sim-tp" label="Take profit, pips from entry" unit="pips" value={tpRaw} onChange={setTpRaw} step={1} min={1} error={tp?.error} hint={tpPrice !== null ? `At ${px(tpPrice)}.` : "Optional."} />
        <NumField id="sim-risk" label="Size from risk" unit="%" value={riskRaw} onChange={setRiskRaw} step={0.5} min={0.5} max={100} error={risk.error} hint="Share of the balance lost if the stop is reached." />
      </div>

      <div className="mt-5 rounded border border-line bg-paper p-13">
        <p className="text-sm text-ink-2">
          {sized && risk.ok && sl?.ok ? (
            <>
              Risking <span className="num">{pct(risk.n)}</span> of <span className="num">{amt(state.balance)}</span> with a <span className="num">{fmt(sl.n)}</span>-pip stop gives <span className="num font-medium text-ink">{fmt(sized.stepped, 2, 2)} lots</span>.
            </>
          ) : (
            "Enter a risk percentage and a stop distance to work out a size from them."
          )}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-21 gap-y-8">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => sized && sized.stepped >= SIM.minLots && setLotsRaw(sized.stepped.toFixed(2))} aria-disabled={!sized || sized.stepped < SIM.minLots}>
            Use this size
          </button>
          <Link href="/tools/position-size" className="link text-sm">
            Position Size tool
          </Link>
        </div>
        {sizeSteps && (
          <details className="mt-8">
            <summary className="cursor-pointer text-sm text-ink-2">How this size was calculated</summary>
            <Working steps={sizeSteps} />
            <p className="mt-8 text-xs text-ink-3">The same formula as the Position Size tool. The starting figures are placeholders that make the arithmetic visible, not suggested values, and a stop passed in a gap loses more than the amount shown.</p>
          </details>
        )}
      </div>

      <dl className="mt-13 border-t border-line">
        {[
          { label: type === "market" ? `Entry (${side === "buy" ? "ask" : "bid"} now)` : "Entry (the order’s level)", value: entry !== null ? px(entry) : "–" },
          { label: `Margin needed at 1:${fmt(state.leverage)}`, value: need !== null ? amt(need) : "–", bad: need !== null && type === "market" && need > acc.free },
          { label: "Free margin now", value: amt(acc.free) },
          { label: "Spread paid on entry", value: lots.ok ? amt(spreadCost(lots.n)) : "–" },
          { label: "Loss if the stop fills at its level", value: lots.ok && sl?.ok ? amt(sl.n * pipValue(lots.n)) : "no stop" },
        ].map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-13 border-b border-line py-8">
            <dt className="text-sm text-ink-3">{r.label}</dt>
            <dd className={`num text-right text-sm font-medium ${r.bad ? "text-neg" : "text-ink"}`}>
              {r.value}
              {r.bad ? " (more than is free)" : ""}
            </dd>
          </div>
        ))}
      </dl>

      <button type="submit" className="btn btn-primary mt-13 w-full justify-center">
        {action}
      </button>
      {tried && !ready ? <p className="field-error mt-8">Correct the fields marked above first.</p> : <NoteLine note={note} className="mt-8" />}
      <p className="text-xs text-ink-3">
        An example order on invented prices. Lessons: <Term slug="market-order">market order</Term>, <Term slug="limit-order">limit order</Term>, <Term slug="stop-order">stop order</Term>, <Term slug="stop-loss">stop loss</Term>, <Term slug="take-profit">take profit</Term>.
      </p>
    </form>
  );
}

/* ==========================================================================
   The account in full
   ========================================================================== */

export function AccountPanel({ state, acc }: { state: SimState; acc: Account }) {
  const rows: { label: string; value: string; how: string; tone?: "pos" | "neg" }[] = [
    { label: "Balance", value: amt(acc.balance), how: "The starting figure, plus or minus every closed result and every swap charge." },
    { label: "Floating profit or loss", value: `${glyph(acc.floating)} ${simSigned(acc.floating)}`, how: "Open positions valued at the price they could be closed at now: a buy at the bid, a sell at the ask.", tone: acc.floating > 0 ? "pos" : acc.floating < 0 ? "neg" : undefined },
    { label: "Equity", value: amt(acc.equity), how: `balance + floating = ${fmt(acc.balance, 2, 2)} ${acc.floating < 0 ? "−" : "+"} ${fmt(Math.abs(acc.floating), 2, 2)}` },
    { label: "Used margin", value: amt(acc.used), how: "Set aside when each position opened: lots × contract size × price ÷ leverage." },
    { label: "Free margin", value: amt(acc.free), how: `equity − used margin = ${fmt(acc.equity, 2, 2)} − ${fmt(acc.used, 2, 2)}`, tone: acc.free < 0 ? "neg" : undefined },
    {
      label: "Margin level",
      value: acc.level === null ? "no open position" : pct(acc.level),
      how: acc.level === null ? "equity ÷ used margin × 100. There is no level while nothing is open." : `equity ÷ used margin × 100 = ${fmt(acc.equity, 2, 2)} ÷ ${fmt(acc.used, 2, 2)} × 100`,
      tone: acc.level !== null && acc.level <= SIM.marginCallLevel ? "neg" : undefined,
    },
  ];
  return (
    <div>
      <dl className="border-t border-line">
        {rows.map((r) => (
          <div key={r.label} className="border-b border-line py-8">
            <div className="flex items-baseline justify-between gap-13">
              <dt className="text-sm text-ink-2">{r.label}</dt>
              <dd className={`num text-right text-[0.9375rem] font-medium ${r.tone === "neg" ? "text-neg" : r.tone === "pos" ? "text-pos" : "text-ink"}`}>{r.value}</dd>
            </div>
            <dd className="num mt-2 text-xs text-ink-3">{r.how}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-13 text-sm text-ink-2">
        In this simulation a <Term slug="margin-call">margin call</Term> warning appears when the margin level is at or below <span className="num">{fmt(SIM.marginCallLevel)}%</span>, and a <Term slug="stop-out">stop out</Term> closes positions automatically at or below <span className="num">{fmt(SIM.stopOutLevel)}%</span>. Both levels are invented for practice.
      </p>
      {state.positions.length > 0 && (
        <>
          <h3 className="label mt-21">Floating result, position by position</h3>
          <ol className="mt-8 border-t border-line">
            {state.positions.map((p) => {
              const l = acc.lines.find((x) => x.id === p.id);
              if (!l) return null;
              return (
                <li key={p.id} className="border-b border-line py-8">
                  <span className="block text-xs text-ink-3">
                    #{p.id} {p.side} {lotsText(p.lots)}: ({p.side === "buy" ? "bid" : "ask"} − entry) × contract size × lots{p.side === "sell" ? " × −1" : ""}
                  </span>
                  <span className="num mt-2 block break-words text-sm text-ink">
                    ({px(l.price)} − {px(p.entry)}) × {fmt(SIM.contract)} × {fmt(p.lots, 0, 2)}
                    {p.side === "sell" ? " × −1" : ""} = {simSigned(l.pl)}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
      <p className="mt-13 text-xs text-ink-3">
        Terms: <Term slug="equity">equity</Term>, <Term slug="margin">margin</Term>, <Term slug="free-margin">free margin</Term>, <Term slug="leverage">leverage</Term>. The same arithmetic as the <Link href="/tools/margin" className="link">Margin</Link> and <Link href="/tools/profit-loss" className="link">Profit &amp; Loss</Link> tools.
      </p>
    </div>
  );
}

/* ==========================================================================
   Open positions and waiting orders
   ========================================================================== */

/** A price that is committed on Enter or on leaving the field, and stepped one pip with the arrow keys. */
function LevelField({ id, label, value, onCommit, clearable }: { id: string; label: string; value: number | null; onCommit: (v: number | null) => void; clearable: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : pxPlain(value));
  const commit = () => {
    if (draft === null) return;
    const raw = draft.trim().replace(",", ".");
    setDraft(null);
    if (raw === "") {
      if (clearable && value !== null) onCommit(null);
      return;
    }
    const n = Number(raw);
    // anything that is not a price is handed to the engine as it is: it refuses it and the desk says why
    if (!Number.isFinite(n) || r5(n) !== value) onCommit(Number.isFinite(n) ? r5(n) : NaN);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") setDraft(null);
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const base = draft !== null ? Number(draft.replace(",", ".")) : value;
      if (base === null || !Number.isFinite(base)) return;
      e.preventDefault();
      setDraft(null);
      onCommit(r5(base + (e.key === "ArrowUp" ? SIM.pip : -SIM.pip)));
    }
  };
  return (
    <div className="field content-start">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input num" type="text" inputMode="decimal" autoComplete="off" spellCheck={false} value={shown} placeholder={clearable ? "none" : undefined} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKeyDown} />
    </div>
  );
}

function PositionRow({ p, pl, moved, onModify, onClose }: { p: Position; pl: number; moved: number; onModify: (id: number, change: { sl?: number | null; tp?: number | null }) => void; onClose: (id: number, lots?: number) => void }) {
  const [partRaw, setPartRaw] = useState("");
  const part = parse(partRaw, { label: "Lots", min: SIM.minLots, max: SIM.maxLots });
  return (
    <li className="border-b border-line py-13" data-position={p.id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-3">
        <p className="text-sm text-ink">
          <span className="font-medium">
            #{p.id} {p.side === "buy" ? "Buy" : "Sell"} <span className="num">{lotsText(p.lots)}</span>
          </span>{" "}
          <span className="num text-ink-3">
            entry {px(p.entry)} · margin {amt(p.margin)}
          </span>
        </p>
        <p className={`num text-sm font-medium ${pl > 0 ? "text-pos" : pl < 0 ? "text-neg" : "text-ink"}`}>
          {glyph(pl)} {simSigned(pl)}{" "}
          <span className="font-normal text-ink-3">
            ({moved > 0 ? "+" : moved < 0 ? "−" : ""}
            {pips(moved)})
          </span>
        </p>
      </div>
      <div className="mt-8 grid grid-cols-2 items-end gap-x-13 gap-y-8 sm:grid-cols-4">
        <LevelField id={`sim-p${p.id}-sl`} label="Stop loss" value={p.sl} clearable onCommit={(v) => onModify(p.id, { sl: v })} />
        <LevelField id={`sim-p${p.id}-tp`} label="Take profit" value={p.tp} clearable onCommit={(v) => onModify(p.id, { tp: v })} />
        <div className="field content-start">
          <label htmlFor={`sim-p${p.id}-part`}>Lots to close</label>
          <input id={`sim-p${p.id}-part`} className="input num" type="text" inputMode="decimal" autoComplete="off" value={partRaw} placeholder={p.lots.toFixed(2)} onChange={(e) => setPartRaw(e.target.value)} />
        </div>
        <div className="flex gap-8">
          <button
            type="button"
            className="btn btn-ghost btn-sm !h-[2.75rem] flex-1 justify-center !px-8"
            onClick={() => {
              onClose(p.id, partRaw.trim() === "" ? undefined : part.ok ? part.n : NaN);
              setPartRaw("");
            }}
          >
            {partRaw.trim() === "" ? "Close" : "Close part"}
            <span className="sr-only"> position {p.id}</span>
          </button>
        </div>
      </div>
    </li>
  );
}

export function Positions({
  state,
  acc,
  note,
  onModify,
  onClose,
  onCloseAll,
  onOrderLevel,
  onCancel,
}: {
  state: SimState;
  acc: Account;
  note: Note;
  onModify: (id: number, change: { sl?: number | null; tp?: number | null }) => void;
  onClose: (id: number, lots?: number) => void;
  onCloseAll: () => void;
  onOrderLevel: (id: number, level: number) => void;
  onCancel: (id: number) => void;
}) {
  const none = state.positions.length === 0 && state.orders.length === 0;
  return (
    <section aria-labelledby="sim-open" className="panel min-w-0 p-13 sm:p-21">
      <div className="flex flex-wrap items-center justify-between gap-13">
        <h2 id="sim-open" className="h4">
          Open positions and waiting orders
        </h2>
        {state.positions.length > 1 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCloseAll}>
            Close all positions
          </button>
        )}
      </div>
      {none ? (
        <p className="mt-13 border-y border-line py-13 text-sm text-ink-3">Nothing is open. Place an example order with the ticket; it appears here and on the chart.</p>
      ) : (
        <>
          <ul className="mt-13 border-t border-line">
            {state.positions.map((p) => {
              const l = acc.lines.find((x) => x.id === p.id);
              return <PositionRow key={p.id} p={p} pl={l?.pl ?? 0} moved={l?.pips ?? 0} onModify={onModify} onClose={onClose} />;
            })}
            {state.orders.map((o: Pending) => (
              <li key={o.id} className="border-b border-line py-13" data-order={o.id}>
                <p className="text-sm text-ink">
                  <span className="font-medium">
                    #{o.id} {orderName(o.side, o.order)} <span className="num">{lotsText(o.lots)}</span>
                  </span>{" "}
                  <span className="num text-ink-3">
                    waiting · {o.sl !== null ? `stop ${px(o.sl)}` : "no stop"}
                    {o.tp !== null ? ` · target ${px(o.tp)}` : ""}
                  </span>
                </p>
                <div className="mt-8 grid grid-cols-2 items-end gap-x-13 gap-y-8 sm:grid-cols-4">
                  <LevelField id={`sim-o${o.id}-level`} label="Level" value={o.level} clearable={false} onCommit={(v) => v !== null && onOrderLevel(o.id, v)} />
                  <button type="button" className="btn btn-ghost btn-sm !h-[2.75rem] justify-center !px-8" onClick={() => onCancel(o.id)}>
                    Cancel<span className="sr-only"> order {o.id}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xs text-ink-3">Type a price and press Enter, or use the up and down arrow keys in a field to move it one pip. The same levels can be dragged on the chart. A waiting order’s stop and target move with its level.</p>
        </>
      )}
      <NoteLine note={note} className="mt-8 lg:hidden" />
    </section>
  );
}

/* ==========================================================================
   Journal
   ========================================================================== */

const TONE = { pos: "text-pos", neg: "text-neg", warn: "text-warn" } as const;

function JournalRow({ e, leverage }: { e: Entry; leverage: number }) {
  const told = tell(e);
  const steps = working(e, leverage);
  return (
    <li className="grid grid-cols-[3.4375rem_minmax(0,1fr)] gap-x-13 border-b border-line py-8" data-entry={e.kind}>
      <span className="num pt-2 text-xs text-ink-3">{simTime(e.tick)}</span>
      <div className="min-w-0">
        <p className={`text-sm ${told.tone ? TONE[told.tone] : "text-ink-2"}`}>{told.text}</p>
        {steps && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-ink-3">{e.kind === "close" ? "How was this P&L calculated" : "Show the arithmetic"}</summary>
            <Working steps={steps} />
          </details>
        )}
      </div>
    </li>
  );
}

const SHOWN = 30;

export const Journal = memo(function Journal({ journal, stats, leverage, startBalance }: { journal: Entry[]; stats: Stats; leverage: number; startBalance: number }) {
  const [all, setAll] = useState(false);
  const newest = journal.slice().reverse();
  const rows = all ? newest : newest.slice(0, SHOWN);
  const dd = stats.maxDrawdown;
  const summary = [
    { label: "Closes", value: fmt(stats.closes) },
    { label: "With a gain", value: fmt(stats.gains) },
    { label: "With a loss", value: fmt(stats.losses) },
    { label: "Unchanged", value: fmt(stats.flat) },
    { label: "Closed results, net", value: simSigned(stats.realised) },
    { label: "Swap charged", value: amt(stats.swaps) },
    { label: "Largest drawdown of equity", value: pct(dd * 100) },
    { label: "Gain needed to recover it", value: dd > 0 && dd < 1 ? pct(gainToRecover(dd) * 100) : dd >= 1 ? "not recoverable" : pct(0) },
  ];
  return (
    <section aria-labelledby="sim-journal" className="panel min-w-0 p-13 sm:p-21">
      <h2 id="sim-journal" className="h4">
        Trade journal
      </h2>
      <dl className="mt-13 grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label} className="bg-paper p-8">
            <dt className="text-xs text-ink-3">{s.label}</dt>
            <dd className="num mt-2 text-sm font-medium text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 text-xs text-ink-3">
        For this session, from a starting balance of <span className="num">{amt(startBalance)}</span>. A partial close counts as a close. Drawdown is the largest fall of equity from its highest point; the recovery figure is the <Link href="/tools/drawdown" className="link">Drawdown</Link> tool’s formula, loss ÷ (1 − loss).
      </p>
      <p className="mt-8 border-l border-accent pl-13 text-sm text-ink-2">A simulated result says nothing about real trading. These prices came from a random walk, nothing was at stake, and no skill is being measured.</p>
      <ol className="mt-13 border-t border-line" aria-label="Journal entries, newest first">
        {rows.map((e) => (
          <JournalRow key={e.n} e={e} leverage={leverage} />
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-13">
        <p className="text-xs text-ink-3">Time is simulated minutes and seconds since the market began. The journal keeps the newest {fmt(200)} entries.</p>
        {newest.length > SHOWN && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAll((v) => !v)}>
            {all ? "Show fewer" : `Show all ${fmt(newest.length)} entries`}
          </button>
        )}
      </div>
    </section>
  );
});

/* ==========================================================================
   Guided exercises
   ========================================================================== */

const EXERCISES: { key: keyof Done; title: string; how: string; slug: string; term: string }[] = [
  { key: "openWithStop", title: "Open a position with a stop loss", how: "Leave a stop distance in the ticket, then buy or sell. The stop appears on the chart as its own line.", slug: "stop-loss", term: "Stop loss" },
  { key: "movedStop", title: "Move the stop", how: "Drag its handle on the chart, focus the handle and use the arrow keys, or type a new price in the position’s row.", slug: "trailing-stop", term: "Trailing stop" },
  { key: "partialGain", title: "Close part of a position while it shows a gain", how: "Type fewer lots than the position holds in “Lots to close”, then close part. The rest stays open.", slug: "take-profit", term: "Take profit" },
  { key: "heldThroughGap", title: "Hold a position through a gap", how: "Gaps are rare here. Keep a position open, let the market run at 20×, and read what the journal says when one arrives: a stop passed in a gap is filled at the next price, not at its level.", slug: "gap", term: "Gap" },
  { key: "marginCall", title: "Cause a margin call on purpose", how: "In Settings choose a small balance and high leverage, open the largest size the ticket accepts, and let the price move against it. Then read what happened in the journal.", slug: "margin-call", term: "Margin call" },
];

export function Exercises({ done }: { done: Done }) {
  const count = EXERCISES.filter((x) => done[x.key]).length;
  return (
    <div>
      <p className="text-sm text-ink-2">Five things worth doing once. Each ticks itself when it actually happens on the desk; none is required, and there is nothing to score.</p>
      <ol className="mt-13 border-t border-line">
        {EXERCISES.map((x) => (
          <li key={x.key} className="grid grid-cols-[1.3125rem_minmax(0,1fr)] gap-x-13 border-b border-line py-13" data-exercise={x.key} data-done={done[x.key] ? "yes" : "no"}>
            <span aria-hidden className={`mt-2 grid h-[1.3125rem] w-[1.3125rem] place-content-center rounded-xs border text-xs ${done[x.key] ? "border-accent bg-accent text-accent-ink" : "border-line-strong text-transparent"}`}>
              ✓
            </span>
            <div>
              <p className="text-sm font-medium text-ink">
                {x.title} <span className="font-normal text-ink-3">({done[x.key] ? "done" : "not yet"})</span>
              </p>
              <p className="mt-3 text-sm text-ink-2">{x.how}</p>
              <p className="mt-5 text-sm">
                <Link href={`/glossary/${x.slug}`} className="link">
                  Lesson: {x.term}
                </Link>
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-xs text-ink-3" aria-live="polite">
        {count} of {EXERCISES.length} done in this session.
      </p>
    </div>
  );
}

/* ==========================================================================
   Simulation settings
   ========================================================================== */

export function SettingsPanel({ state, keep, onKeep, onRestart }: { state: SimState; keep: boolean; onKeep: (on: boolean) => void; onRestart: (seed: number, balance: number, leverage: number) => void }) {
  // each choice follows the running session until the visitor changes it, so a restored session shows its own settings
  const [balanceRaw, setBalance] = useState<string | null>(null);
  const [leverageRaw, setLeverage] = useState<string | null>(null);
  const [seedRaw, setSeedRaw] = useState<string | null>(null);
  const balance = balanceRaw ?? String(state.startBalance);
  const leverage = leverageRaw ?? String(state.leverage);
  const seedShown = seedRaw ?? String(state.seed);
  const seed = parse(seedShown, { label: "Market number", min: 1, max: 999999, integer: true });
  const rows = [
    { label: "Instrument", value: `${SIM.instrument} (invented)` },
    { label: "Unit of account and price", value: `${SIM.unit} (invented, not a currency)` },
    { label: "Opening price of every market", value: px(SIM.startPrice) },
    { label: "One pip · one lot", value: `${fmt(SIM.pip, 0, 4)} · ${fmt(SIM.contract)} units` },
    { label: "Spread", value: `${fmt(SIM.spreadPips)} pips, fixed` },
    { label: "Swap", value: `${amt(SIM.swapPerLot)} per lot per rollover, buys and sells` },
    { label: "Rollover", value: `every ${fmt(SIM.rolloverMinutes)} simulated minutes` },
    { label: "Margin call warning", value: `margin level ≤ ${fmt(SIM.marginCallLevel)}%` },
    { label: "Stop out", value: `margin level ≤ ${fmt(SIM.stopOutLevel)}%` },
    { label: "Commission", value: "none" },
    { label: "Order size", value: `${fmt(SIM.minLots, 2, 2)} to ${fmt(SIM.maxLots)} lots` },
  ];
  return (
    <div>
      <p className="border-l border-accent pl-13 text-sm text-ink-2">
        These are made-up settings for practice. They are not GIO4X’s trading conditions, and they are not a quote: what GIO4X publishes is on the <Link href="/trading/conditions" className="link">trading conditions</Link> and <Link href="/trading/accounts" className="link">account types</Link> pages.
      </p>
      <dl className="mt-13 border-t border-line">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-13 border-b border-line py-8">
            <dt className="text-sm text-ink-3">{r.label}</dt>
            <dd className="num text-right text-sm font-medium text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>

      <h3 className="label mt-21">The example account</h3>
      <div className="mt-8 grid gap-x-13 gap-y-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <SelectField id="sim-balance" label="Starting balance" value={balance} onChange={setBalance}>
          {SIM.balances.map((b) => (
            <option key={b} value={b}>
              {amt(b)}
            </option>
          ))}
        </SelectField>
        <SelectField id="sim-leverage" label="Leverage" value={leverage} onChange={setLeverage} hint="Higher leverage lowers the margin, not the risk.">
          {SIM.leverages.map((l) => (
            <option key={l} value={l}>
              1:{l}
            </option>
          ))}
        </SelectField>
        <NumField id="sim-seed" label="Market number" value={seedShown} onChange={setSeedRaw} error={seed.error} hint="The same number always produces the same invented prices." className="sm:col-span-2 lg:col-span-1 xl:col-span-2" />
      </div>
      <button
        type="button"
        className="btn btn-ghost w-full justify-center"
        onClick={() => {
          if (!seed.ok) return;
          setSeedRaw(null);
          setBalance(null);
          setLeverage(null);
          onRestart(seed.n, Number(balance), Number(leverage));
        }}
      >
        Start again with these settings
      </button>
      <p className="mt-8 text-xs text-ink-3">Starting again opens a fresh example account on that market from its beginning. Open positions, waiting orders and the journal are discarded, not closed at a price.</p>

      <h3 className="label mt-21">This browser</h3>
      <label className="check mt-8">
        <input type="checkbox" checked={keep} onChange={(e) => onKeep(e.target.checked)} />
        <span>
          Keep this practice session in this browser
          <span className="mt-3 block text-xs text-ink-3">
            Off unless you choose it. When on, the session is stored in this browser under the key <code className="font-mono">gx:sim</code> so it is still here after a reload. Nothing is sent anywhere. Turning it off deletes the stored copy; so does the reset on the <Link href="/preferences" className="link">preferences</Link> page.
          </span>
        </span>
      </label>
      <div className="mt-21 grid gap-8">
        <DataNote status="simulation">Every figure on this page is invented or computed from invented figures. {educationalNote}</DataNote>
      </div>
    </div>
  );
}

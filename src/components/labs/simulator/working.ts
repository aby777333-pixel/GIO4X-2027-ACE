/**
 * PRACTICE DESK: the words and the working.
 *
 * The engine records numbers; this file turns a journal entry into a sentence
 * and, where there is arithmetic behind it, into the same "what / calculation"
 * steps the Trader Toolkit prints beside every result. Formatting is the
 * toolkit's own (fmt, money, pct), so a figure reads the same here as there.
 */
import { fmt, lotsText, money, pct, signedMoney } from "@/components/tools/calc";
import type { Step } from "@/components/tools/ui";
import { pipValue, SIM, type Entry, type OrderKind, type Side, type SimError } from "./engine";

const U = SIM.unit;

/** A price, always to a tenth of a pip. */
export const px = (n: number): string => fmt(n, 5, 5);
/** A price for a field: no separators, trailing zeros beyond the pip dropped. */
export const pxPlain = (n: number): string => {
  const s = n.toFixed(5);
  return s.endsWith("0") ? s.slice(0, -1) : s;
};
export const pips = (n: number): string => `${fmt(Math.abs(n), 0, 1)} ${Math.abs(n) === 1 ? "pip" : "pips"}`;
export const sim = (n: number): string => money(n, U);
export const simSigned = (n: number): string => signedMoney(n, U);
/** direction is never colour alone: the site's glyphs */
export const glyph = (n: number): string => (n > 0 ? "▲" : n < 0 ? "▼" : "◆");

/** simulated minutes and seconds since the market began */
export function simTime(tick: number): string {
  const total = tick * SIM.tickSeconds;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const sideWord = (side: Side, past = false): string => (side === "buy" ? (past ? "Bought" : "Buy") : past ? "Sold" : "Sell");
export const orderName = (side: Side, order: OrderKind): string => `${sideWord(side)} ${order}`;
const levels = (sl: number | null, tp: number | null): string => `${sl !== null ? ` Stop loss ${px(sl)}.` : " No stop loss."}${tp !== null ? ` Take profit ${px(tp)}.` : ""}`;

export type Told = { text: string; tone?: "pos" | "neg" | "warn" };

/** One journal entry as a sentence. */
export function tell(e: Entry): Told {
  switch (e.kind) {
    case "start":
      return { text: `Example account opened on market ${e.seed}: ${sim(e.balance)}, leverage 1:${fmt(e.leverage)}.` };
    case "placed":
      return { text: `Order #${e.id} placed: ${orderName(e.side, e.order).toLowerCase()}, ${lotsText(e.lots)} at ${px(e.level)}.${levels(e.sl, e.tp)}` };
    case "open": {
      if (e.via === "market") return { text: `Position #${e.id}: ${sideWord(e.side, true).toLowerCase()} ${lotsText(e.lots)} at the ${e.side === "buy" ? "ask" : "bid"}, ${px(e.price)}. Margin set aside: ${sim(e.margin)}.${levels(e.sl, e.tp)}` };
      const head = `Order #${e.id} (${orderName(e.side, e.via).toLowerCase()} at ${px(e.requested ?? e.price)}) triggered`;
      if (e.gap && e.slip > 0) return { tone: "warn", text: `${head} in a gap: filled at ${px(e.price)}, the first price available. Slipped by ${pips(e.slip)}. Margin set aside: ${sim(e.margin)}.` };
      if (e.gap && e.slip < 0) return { text: `${head} in a gap: filled at ${px(e.price)}, ${pips(e.slip)} better than the limit. Margin set aside: ${sim(e.margin)}.` };
      return { text: `${head}: ${sideWord(e.side, true).toLowerCase()} ${lotsText(e.lots)} at ${px(e.price)}. Margin set aside: ${sim(e.margin)}.` };
    }
    case "modify": {
      const what = e.field === "sl" ? "Stop loss" : e.field === "tp" ? "Take profit" : "Level";
      const of = `${e.target === "position" ? "position" : "order"} #${e.id}`;
      if (e.from === null && e.to !== null) return { text: `${what} of ${of} set at ${px(e.to)}.` };
      if (e.to === null) return { text: `${what} of ${of} removed.` };
      return { text: `${what} of ${of} moved from ${px(e.from ?? e.to)} to ${px(e.to)}.` };
    }
    case "close": {
      const tone = e.pl > 0 ? "pos" : e.pl < 0 ? "neg" : undefined;
      const result = `${glyph(e.pl)} ${simSigned(e.pl)}`;
      const at = `at ${px(e.exit)}`;
      if (e.reason === "partial") return { tone, text: `Part of position #${e.id} closed: ${lotsText(e.lots)} ${at}. ${result}. ${lotsText(e.left)} remain open.` };
      if (e.reason === "stop-out") return { tone: "neg", text: `Position #${e.id} closed automatically by the stop out, ${at}. ${result}.` };
      if (e.reason === "stop-loss") {
        if (e.gap && e.slip > 0) return { tone: "neg", text: `Stop loss of position #${e.id} was passed in a gap: closed ${at}, the first price available. Slipped by ${pips(e.slip)}. ${result}. A stop is an instruction, not a promise of a price.` };
        return { tone, text: `Stop loss of position #${e.id} reached: closed ${at}. ${result}.` };
      }
      if (e.reason === "take-profit") {
        if (e.gap && e.slip < 0) return { tone, text: `Take profit of position #${e.id} was passed in a gap: closed ${at}, ${pips(e.slip)} better than the level. ${result}.` };
        return { tone, text: `Take profit of position #${e.id} reached: closed ${at}. ${result}.` };
      }
      return { tone, text: `Position #${e.id} closed by you at the ${e.side === "buy" ? "bid" : "ask"}, ${px(e.exit)}. ${result}.` };
    }
    case "swap":
      return { text: `Rollover: swap of ${sim(e.charge)} charged on position #${e.id} (${lotsText(e.lots)}).` };
    case "cancel":
      if (e.reason === "margin") return { tone: "warn", text: `Order #${e.id} reached its level but needed ${sim(e.need)} of margin with ${sim(e.free)} free: cancelled.` };
      return { text: `Order #${e.id} cancelled by you.` };
    case "reject":
      return { tone: "warn", text: `${sideWord(e.side)} of ${lotsText(e.lots)} refused: it needs ${sim(e.need)} of margin and ${sim(e.free)} is free.` };
    case "gap":
      return { tone: "warn", text: `The price gapped ${pips(e.pips)} ${e.pips < 0 ? "down" : "up"}, from ${px(e.from)} to ${px(e.to)}, with no trading in between.` };
    case "margin-call":
      return { tone: "warn", text: `Margin call: the margin level fell to ${pct(e.level)} (equity ${sim(e.equity)}, used margin ${sim(e.used)}). Nothing is closed yet, and no new position can be opened.` };
    case "stop-out":
      return { tone: "neg", text: `Stop out: the margin level reached ${pct(e.level)}, at or below this simulation’s ${fmt(SIM.stopOutLevel)}% level. Positions are closed automatically, the largest loss first, at the price available.` };
  }
}

/** The arithmetic behind an entry, in the toolkit's working style; null where there is none. */
export function working(e: Entry, leverage: number): Step[] | null {
  const rev = (side: Side) => (side === "sell" ? " × −1" : "");
  switch (e.kind) {
    case "open": {
      const notional = e.lots * SIM.contract * e.price;
      const steps: Step[] = [
        { what: `Notional value, in ${U}`, calc: `${fmt(e.lots, 0, 2)} × ${fmt(SIM.contract)} × ${px(e.price)} = ${sim(notional)}` },
        { what: `Margin at 1:${fmt(leverage)}`, calc: `${fmt(notional, 2, 2)} ÷ ${fmt(leverage)} = ${sim(e.margin)}` },
        { what: "Spread paid on entry (spread × pip value × lots)", calc: `${fmt(SIM.spreadPips)} × ${fmt(pipValue(1), 2, 2)} × ${fmt(e.lots, 0, 2)} = ${sim(SIM.spreadPips * pipValue(1) * e.lots)}` },
      ];
      if (e.requested !== null && e.slip !== 0) {
        // written so that the difference is positive: a worse fill and a better one are subtracted the other way round
        const diff = (e.side === "buy") === e.slip > 0 ? `${px(e.price)} − ${px(e.requested)}` : `${px(e.requested)} − ${px(e.price)}`;
        steps.push({ what: e.slip > 0 ? "Slippage against the level asked for" : "Improvement on the level asked for", calc: `(${diff}) ÷ ${fmt(SIM.pip, 0, 4)} = ${pips(e.slip)}` });
      }
      return steps;
    }
    case "close": {
      const diff = e.exit - e.entry;
      const moved = (diff / SIM.pip) * (e.side === "buy" ? 1 : -1);
      const steps: Step[] = [
        { what: "Price difference (exit − entry)", calc: `${px(e.exit)} − ${px(e.entry)} = ${fmt(diff, 5, 5)}` },
        { what: `In pips, for a ${e.side}`, calc: `${fmt(diff, 5, 5)} ÷ ${fmt(SIM.pip, 0, 4)}${rev(e.side)} = ${fmt(moved, 0, 1)} pips` },
        { what: `Profit or loss, in ${U}`, calc: `${fmt(diff, 5, 5)} × ${fmt(SIM.contract)} × ${fmt(e.lots, 0, 2)}${rev(e.side)} = ${simSigned(e.pl)}` },
      ];
      if (e.requested !== null && e.slip !== 0) {
        const d = (e.side === "buy") === e.slip > 0 ? `${px(e.requested)} − ${px(e.exit)}` : `${px(e.exit)} − ${px(e.requested)}`;
        const cost = Math.abs(e.slip) * pipValue(e.lots);
        steps.push({ what: e.slip > 0 ? "Slippage against the level asked for" : "Improvement on the level asked for", calc: `(${d}) ÷ ${fmt(SIM.pip, 0, 4)} = ${pips(e.slip)}` });
        steps.push({ what: e.slip > 0 ? "What the slippage cost" : "What the improvement added", calc: `${fmt(Math.abs(e.slip), 0, 1)} × ${fmt(pipValue(1), 2, 2)} × ${fmt(e.lots, 0, 2)} = ${sim(cost)}` });
      }
      steps.push({ what: "Balance", calc: `${fmt(e.balance - e.pl, 2, 2)} ${e.pl < 0 ? "−" : "+"} ${fmt(Math.abs(e.pl), 2, 2)} = ${sim(e.balance)}` });
      steps.push({ what: e.left > 0 ? "Margin released, in proportion to the lots closed" : "Margin released", calc: sim(e.released) });
      return steps;
    }
    case "swap":
      return [
        { what: "Swap (per lot per rollover × lots × rollovers)", calc: `${fmt(SIM.swapPerLot, 2, 2)} × ${fmt(e.lots, 0, 2)} × 1 = ${sim(e.charge)}` },
        { what: "Balance", calc: `${fmt(e.balance + e.charge, 2, 2)} − ${fmt(e.charge, 2, 2)} = ${sim(e.balance)}` },
      ];
    case "margin-call":
    case "stop-out":
      return [
        { what: "Margin level (equity ÷ used margin × 100)", calc: `${fmt(e.equity, 2, 2)} ÷ ${fmt(e.used, 2, 2)} × 100 = ${pct(e.level)}` },
        { what: e.kind === "stop-out" ? "Stop out level in this simulation" : "Margin call level in this simulation", calc: `${fmt(e.kind === "stop-out" ? SIM.stopOutLevel : SIM.marginCallLevel)}%` },
      ];
    case "reject":
      return [
        { what: "Margin needed (lots × contract size × price ÷ leverage)", calc: `${sim(e.need)} at 1:${fmt(leverage)}` },
        { what: "Free margin (equity − used margin)", calc: sim(e.free) },
      ];
    case "cancel":
      return e.reason === "margin"
        ? [
            { what: "Margin needed (lots × contract size × price ÷ leverage)", calc: `${sim(e.need)} at 1:${fmt(leverage)}` },
            { what: "Free margin (equity − used margin)", calc: sim(e.free) },
          ]
        : null;
    case "gap":
      return [{ what: "Size of the gap", calc: `(${px(e.to)} − ${px(e.from)}) ÷ ${fmt(SIM.pip, 0, 4)} = ${fmt(e.pips, 0, 1)} pips` }];
    default:
      return null;
  }
}

/** Why the engine refused something, in plain words. */
export function explain(e: SimError): string {
  switch (e.code) {
    case "lots":
      return `The size must be between ${fmt(SIM.minLots, 2, 2)} and ${fmt(SIM.maxLots)} lots, in steps of ${fmt(SIM.lotStep, 2, 2)}.`;
    case "margin":
      return `Refused: this needs ${sim(e.need)} of margin and ${sim(e.free)} is free. A smaller size needs less margin. Higher leverage also lowers the margin, but not the risk.`;
    case "too-many":
      return `This practice desk holds at most ${SIM.maxTickets} positions and waiting orders together. Close or cancel one first.`;
    case "sl-side":
      return e.side === "buy" ? `A buy’s stop loss must be below the price it would close at now (the bid, or the order’s level): below ${px(e.ref)}.` : `A sell’s stop loss must be above the price it would close at now (the ask, or the order’s level): above ${px(e.ref)}.`;
    case "tp-side":
      return e.side === "buy" ? `A buy’s take profit must be above ${px(e.ref)}.` : `A sell’s take profit must be below ${px(e.ref)}.`;
    case "level-side": {
      const below = e.side === "buy" ? e.order === "limit" : e.order === "stop";
      return `A ${e.side} ${e.order} rests ${below ? "below" : "above"} the current ${e.side === "buy" ? "ask" : "bid"}: ${below ? "below" : "above"} ${px(e.ref)}.`;
    }
    case "close-lots":
      return `The part to close must be between ${fmt(SIM.minLots, 2, 2)} lots and the position’s ${fmt(e.max, 2, 2)} lots.`;
    case "not-found":
      return "That position or order is no longer open.";
    case "no-change":
      return "Nothing changed: the level is the same as before.";
  }
}

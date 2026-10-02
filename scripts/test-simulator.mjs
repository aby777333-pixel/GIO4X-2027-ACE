/**
 * Proves the arithmetic of the Practice desk engine (src/components/labs/simulator/engine.ts).
 *
 *   node scripts/test-simulator.mjs
 *
 * Needs Node 22.18 or later (it imports TypeScript directly; the engine has no
 * imports of its own). Three kinds of check:
 *   1. hand-computed cases, with the working written beside each expectation;
 *   2. the Trader Toolkit's own expressions, copied from the tool components
 *      (they are written inline there, not exported), compared with the engine
 *      over a grid of inputs;
 *   3. the formula sentences published in src/data/tools.ts and in the
 *      glossary, so a change to the site's stated formula fails here.
 */
import { readFileSync } from "node:fs";
import * as E from "../src/components/labs/simulator/engine.ts";
import { tools } from "../src/data/tools.ts";

let passed = 0;
const failures = [];
function ok(name, cond, detail = "") {
  if (cond) passed += 1;
  else failures.push(`${name}${detail ? `: ${detail}` : ""}`);
}
function eq(name, got, want, tol = 1e-9) {
  ok(name, typeof got === "number" && Math.abs(got - want) <= tol, `got ${got}, expected ${want}`);
}
const must = (r) => {
  if (!r.ok) throw new Error(`action refused: ${JSON.stringify(r.error)}`);
  return r.state;
};
const lastOf = (s, kind) => [...s.journal].reverse().find((e) => e.kind === kind);
/** a fresh account on a market that has not moved: mid 2.0000, bid 1.9999, ask 2.0001 */
const fresh = (balance = 10000, leverage = 100) => E.createState(1, balance, leverage, 0);
const MID = 200000;

/* ---- 1. hand-computed ------------------------------------------------------ */

{
  const s = fresh();
  const q = E.quote(s);
  eq("quote: bid is mid less half the 2-pip spread", q.bid, 1.9999);
  eq("quote: ask is mid plus half the 2-pip spread", q.ask, 2.0001);
  eq("pip value of 1 lot: 0.0001 × 100,000", E.pipValue(1), 10);
  eq("pip value of 0.5 lots", E.pipValue(0.5), 5);

  // risk 1% of 10,000 = 100; a 20-pip stop on one lot loses 20 × 10 = 200; 100 ÷ 200 = 0.5 lots
  const size = E.positionSize(10000, 1, 20);
  eq("position size: amount at risk", size.amount, 100);
  eq("position size: loss per lot at the stop", size.perLot, 200);
  eq("position size: lots", size.lots, 0.5);
  eq("position size: stepped", size.stepped, 0.5);
  // 10,000 × 1% = 100; 100 ÷ (33 × 10) = 0.30303…, rounded down to 0.30; risk at 0.30 = 0.30 × 330 = 99
  const odd = E.positionSize(10000, 1, 33);
  eq("position size: rounded down to the 0.01 step", odd.stepped, 0.3);
  eq("position size: risk at the rounded size", odd.steppedRisk, 99);

  // buy 0.5 lots at the ask 2.0001, leverage 1:100: margin = 0.5 × 100,000 × 2.0001 ÷ 100 = 1,000.05
  const a = must(E.placeMarket(s, { side: "buy", lots: 0.5 }));
  const p = a.positions[0];
  eq("market buy fills at the ask", p.entry, 2.0001);
  eq("margin", p.margin, 1000.05);
  // valued at the bid 1.9999: (1.9999 − 2.0001) × 100,000 × 0.5 = −10.00, which is the spread: 2 × 10 × 0.5
  let acc = E.account(a);
  eq("floating P/L at opening equals the spread cost", acc.floating, -10);
  eq("spread cost", E.spreadCost(0.5), 10);
  eq("equity = balance + floating", acc.equity, 9990);
  eq("used margin", acc.used, 1000.05);
  eq("free margin = equity − used margin", acc.free, 8989.95);
  eq("margin level = equity ÷ used margin × 100", acc.level, (9990 / 1000.05) * 100, 1e-9);
  ok("margin level is about 998.95%", Math.abs(acc.level - 998.95) < 0.01, String(acc.level));

  // +20 pips: mid 2.0020, bid 2.0019: (2.0019 − 2.0001) × 100,000 × 0.5 = +90.00
  const b = E.applyTick(a, MID + 200);
  acc = E.account(b);
  eq("floating P/L after +20 pips", acc.floating, 90);
  eq("pips on the position", acc.lines[0].pips, 18);

  // partial close of 0.2 lots at 2.0019: 0.0018 × 100,000 × 0.2 = +36.00; margin released 1,000.05 × 0.2 ÷ 0.5 = 400.02
  const c = must(E.closePosition(b, p.id, 0.2));
  const part = lastOf(c, "close");
  eq("partial close: P/L", part.pl, 36);
  eq("partial close: margin released", part.released, 400.02);
  eq("partial close: balance", c.balance, 10036);
  eq("partial close: lots left", c.positions[0].lots, 0.3);
  eq("partial close: margin left", c.positions[0].margin, 600.03);
  ok("partial close: reason", part.reason === "partial");
  ok("exercise: partial close in profit ticks itself", c.done.partialGain === true);

  // the remaining 0.3 lots closed at 2.0019: 0.0018 × 100,000 × 0.3 = +54.00; balance 10,090.00
  const d = must(E.closePosition(c, p.id));
  eq("full close: P/L", lastOf(d, "close").pl, 54);
  eq("full close: balance", d.balance, 10090);
  ok("full close: no positions left", d.positions.length === 0);
  ok("stats: two closes, both with a gain", d.stats.closes === 2 && d.stats.gains === 2 && d.stats.losses === 0);
  eq("stats: realised", d.stats.realised, 90);

  // a sell: opens at the bid 1.9999, valued at the ask; price down 30 pips → ask 1.9971: (1.9971 − 1.9999) × 100,000 × 1 × −1 = +280
  const e = must(E.placeMarket(s, { side: "sell", lots: 1 }));
  eq("market sell fills at the bid", e.positions[0].entry, 1.9999);
  eq("sell: floating after −30 pips", E.account(E.applyTick(e, MID - 300)).floating, 280);
  eq("profitLoss: sign reversed for a sell", E.profitLoss("sell", 1.9999, 1.9971, 1), 280, 1e-6);
}

/* ---- stop loss, take profit, and a gap ------------------------------------- */
{
  const s = fresh();
  // buy 0.5 at 2.0001 with a stop 20 pips below the entry (1.9981) and a target 30 pips above (2.0031)
  const a = must(E.placeMarket(s, { side: "buy", lots: 0.5, sl: 1.9981, tp: 2.0031 }));
  ok("exercise: opening with a stop ticks itself", a.done.openWithStop === true);

  // ordinary tick to mid 1.9980 (bid 1.9979, through the stop): filled AT the stop: −0.0020 × 100,000 × 0.5 = −100.00, the 1% that was sized for
  const b = E.applyTick(a, MID - 200);
  let cl = lastOf(b, "close");
  ok("stop loss closes the position", b.positions.length === 0 && cl.reason === "stop-loss");
  eq("stop on an ordinary tick fills at its level", cl.exit, 1.9981);
  eq("stop on an ordinary tick: no slippage", cl.slip, 0);
  eq("stop on an ordinary tick: P/L is the amount sized for", cl.pl, -100);
  eq("balance after the stop", b.balance, 9900);

  // the same position, but the price GAPS 40 pips down: mid 1.9960, bid 1.9959. Filled at 1.9959:
  // slipped (1.9981 − 1.9959) ÷ 0.0001 = 22 pips; P/L (1.9959 − 2.0001) × 100,000 × 0.5 = −210.00
  const g = E.applyTick(a, MID - 400, -400);
  cl = lastOf(g, "close");
  eq("gap: stop fills at the first price after the gap", cl.exit, 1.9959);
  eq("gap: slipped by 22 pips", cl.slip, 22);
  eq("gap: P/L", cl.pl, -210);
  ok("gap: the close is marked as a gap fill", cl.gap === true && cl.requested === 1.9981);
  eq("gap: the cost of the slippage is 22 pips × 5 per pip", -210 - -100, -E.pipValue(0.5) * 22, 1e-9);
  const gapEntry = lastOf(g, "gap");
  ok("gap: journal records the gap", !!gapEntry && gapEntry.pips === -40);
  ok("exercise: holding through a gap ticks itself", g.done.heldThroughGap === true);

  // take profit: ordinary tick to bid 2.0034 fills at 2.0031: 0.0030 × 100,000 × 0.5 = +150.00
  const t = E.applyTick(a, MID + 350);
  cl = lastOf(t, "close");
  ok("take profit closes the position", cl.reason === "take-profit");
  eq("take profit fills at its level", cl.exit, 2.0031);
  eq("take profit: P/L", cl.pl, 150);
  // a gap up through the target: bid 2.0049, filled there, 18 pips better than asked (a negative slip)
  const tg = E.applyTick(a, MID + 500, 500);
  cl = lastOf(tg, "close");
  eq("gap through a target fills at the better price", cl.exit, 2.0049);
  eq("gap through a target: slip is negative (better)", cl.slip, -18);

  // a sell with a stop above: gap up 30 pips → ask 2.0031; stop at 2.0019 filled at 2.0031, slipped 12 pips
  const sv = must(E.placeMarket(s, { side: "sell", lots: 1, sl: 2.0019 }));
  cl = lastOf(E.applyTick(sv, MID + 300, 300), "close");
  eq("sell stop loss in a gap fills at the ask", cl.exit, 2.0031);
  eq("sell stop loss in a gap: slipped 12 pips", cl.slip, 12);
  eq("sell stop loss in a gap: P/L (2.0031 − 1.9999) × 100,000 × −1", cl.pl, -320);

  // moving the stop
  const m = must(E.modifyPosition(a, a.positions[0].id, { sl: 1.9991 }));
  ok("modify: stop moved", m.positions[0].sl === 1.9991 && m.positions[0].tp === 2.0031);
  ok("exercise: moving the stop ticks itself", m.done.movedStop === true && a.done.movedStop === false);
  const mod = lastOf(m, "modify");
  ok("modify: journal has from and to", mod.field === "sl" && mod.from === 1.9981 && mod.to === 1.9991);
  const bad = E.modifyPosition(a, a.positions[0].id, { sl: 2.0005 });
  ok("modify: a buy's stop cannot sit at or above the bid", !bad.ok && bad.error.code === "sl-side");
  const badTp = E.modifyPosition(a, a.positions[0].id, { tp: 1.999 });
  ok("modify: a buy's target cannot sit at or below the bid", !badTp.ok && badTp.error.code === "tp-side");
  ok("modify: removing the stop", must(E.modifyPosition(a, a.positions[0].id, { sl: null })).positions[0].sl === null);
}

/* ---- pending orders -------------------------------------------------------- */
{
  const s = fresh();
  // buy stop at 2.0021 (above the ask): triggered when the ask reaches it
  let a = must(E.placePending(s, { side: "buy", order: "stop", lots: 0.2, level: 2.0021, sl: 2.0001, tp: 2.0061 }));
  ok("pending: placed, not open", a.orders.length === 1 && a.positions.length === 0);
  ok("pending: not triggered below its level", E.applyTick(a, MID + 190).orders.length === 1);
  let b = E.applyTick(a, MID + 250); // ask 2.0026
  let op = lastOf(b, "open");
  ok("buy stop: triggered", b.orders.length === 0 && b.positions.length === 1 && op.via === "stop");
  eq("buy stop on an ordinary tick fills at its level", op.price, 2.0021);
  eq("buy stop: margin 0.2 × 100,000 × 2.0021 ÷ 100", op.margin, 400.42);
  b = E.applyTick(a, MID + 250, 250);
  op = lastOf(b, "open");
  eq("buy stop in a gap fills at the ask after the gap", op.price, 2.0026);
  eq("buy stop in a gap: slipped 5 pips", op.slip, 5);

  // buy limit at 1.9981 (below the ask): triggered when the ask falls to it
  a = must(E.placePending(s, { side: "buy", order: "limit", lots: 0.2, level: 1.9981 }));
  b = E.applyTick(a, MID - 300); // ask 1.9971
  eq("buy limit on an ordinary tick fills at its level", lastOf(b, "open").price, 1.9981);
  b = E.applyTick(a, MID - 300, -300);
  eq("buy limit in a gap fills at the better price", lastOf(b, "open").price, 1.9971);
  eq("buy limit in a gap: 10 pips better (negative slip)", lastOf(b, "open").slip, -10);

  // sell limit above the bid, sell stop below it
  a = must(E.placePending(s, { side: "sell", order: "limit", lots: 0.1, level: 2.0019 }));
  eq("sell limit fills at its level", lastOf(E.applyTick(a, MID + 250), "open").price, 2.0019);
  a = must(E.placePending(s, { side: "sell", order: "stop", lots: 0.1, level: 1.9979 }));
  eq("sell stop in a gap fills at the bid after the gap", lastOf(E.applyTick(a, MID - 400, -400), "open").price, 1.9959);
  eq("sell stop in a gap: slipped 20 pips", lastOf(E.applyTick(a, MID - 400, -400), "open").slip, 20);

  // where a pending order may rest
  ok("buy limit above the ask is refused", E.placePending(s, { side: "buy", order: "limit", lots: 0.1, level: 2.001 }).error?.code === "level-side");
  ok("buy stop below the ask is refused", E.placePending(s, { side: "buy", order: "stop", lots: 0.1, level: 1.999 }).error?.code === "level-side");
  ok("sell limit below the bid is refused", E.placePending(s, { side: "sell", order: "limit", lots: 0.1, level: 1.999 }).error?.code === "level-side");
  ok("sell stop above the bid is refused", E.placePending(s, { side: "sell", order: "stop", lots: 0.1, level: 2.001 }).error?.code === "level-side");
  ok("a stop on the wrong side of a pending level is refused", E.placePending(s, { side: "buy", order: "stop", lots: 0.1, level: 2.0021, sl: 2.003 }).error?.code === "sl-side");

  // moving a waiting order carries its stop and target with it
  a = must(E.placePending(s, { side: "buy", order: "stop", lots: 0.2, level: 2.0021, sl: 2.0001, tp: 2.0061 }));
  const mv = must(E.modifyOrder(a, a.orders[0].id, 2.0031));
  ok("modify order: level, stop and target move together", mv.orders[0].level === 2.0031 && mv.orders[0].sl === 2.0011 && mv.orders[0].tp === 2.0071);
  ok("cancel order", must(E.cancelOrder(a, a.orders[0].id)).orders.length === 0);

  // a pending order that cannot be margined when it triggers is cancelled, and says so
  const poor = fresh(1000, 10);
  a = must(E.placePending(poor, { side: "buy", order: "stop", lots: 1, level: 2.0021 }));
  b = E.applyTick(a, MID + 250);
  const can = lastOf(b, "cancel");
  ok("pending without margin is cancelled at its trigger", b.positions.length === 0 && can.reason === "margin");
  eq("pending without margin: the margin it needed, 1 × 100,000 × 2.0021 ÷ 10", can.need, 20021);
}

/* ---- swap at the rollover -------------------------------------------------- */
{
  eq("rollover every 120 simulated minutes = 720 ticks of 10 seconds", E.ROLLOVER_TICKS, 720);
  let s = must(E.placeMarket(fresh(), { side: "buy", lots: 0.5 }));
  for (let i = 0; i < 719; i++) s = E.applyTick(s, MID);
  ok("no swap before the rollover", !lastOf(s, "swap") && s.balance === 10000);
  s = E.applyTick(s, MID);
  const sw = lastOf(s, "swap");
  // 0.50 per lot per rollover × 0.5 lots × 1 = 0.25
  eq("swap charge", sw.charge, 0.25);
  eq("swapCharge()", E.swapCharge(0.5), 0.25);
  eq("balance after the swap", s.balance, 9999.75);
  eq("swap recorded on the position", s.positions[0].swap, 0.25);
  for (let i = 0; i < 720; i++) s = E.applyTick(s, MID);
  eq("a second rollover charges again", s.balance, 9999.5);
  eq("stats: swaps", s.stats.swaps, 0.5);
}

/* ---- margin call and stop out ---------------------------------------------- */
{
  const s = fresh(10000, 100);
  // 4 lots at 2.0001: margin 4 × 100,000 × 2.0001 ÷ 100 = 8,000.40; one pip is worth 40
  const a = must(E.placeMarket(s, { side: "buy", lots: 4 }));
  eq("margin for 4 lots", a.positions[0].margin, 8000.4);
  eq("margin level at opening: 9,920 ÷ 8,000.40 × 100", E.account(a).level, (9920 / 8000.4) * 100);
  ok("no margin call at opening", a.marginCall === false);

  // bid 1.9952: floating (1.9952 − 2.0001) × 400,000 = −1,960 → equity 8,040 → 100.49%: still above
  let b = E.applyTick(a, 199530);
  ok("just above 100%: no margin call", b.marginCall === false && !lastOf(b, "margin-call"));
  // bid 1.9951: floating −2,000 → equity 8,000 → 8,000 ÷ 8,000.40 × 100 = 99.995%: margin call
  b = E.applyTick(b, 199520);
  let mc = lastOf(b, "margin-call");
  ok("margin call at or below 100%", b.marginCall === true && !!mc);
  eq("margin call: equity", mc.equity, 8000);
  eq("margin call: level", mc.level, (8000 / 8000.4) * 100);
  ok("margin call: position still open", b.positions.length === 1);
  ok("exercise: margin call ticks itself", b.done.marginCall === true);
  ok("margin call is logged once while it lasts", E.applyTick(b, 199510).journal.filter((e) => e.kind === "margin-call").length === 1);
  ok("no new position can be opened without free margin", E.placeMarket(b, { side: "buy", lots: 0.01 }).error?.code === "margin");

  // bid 1.9852: floating −5,960 → equity 4,040 → 50.497%: above the stop out
  let c = E.applyTick(b, 198530);
  ok("just above 50%: still open", c.positions.length === 1 && c.stopOut === null);
  // bid 1.9851: floating −6,000 → equity 4,000 → 49.9975%: stop out, closed at 1.9851, balance 4,000
  c = E.applyTick(c, 198520);
  const so = lastOf(c, "stop-out");
  const cl = lastOf(c, "close");
  ok("stop out at or below 50% closes the position", c.positions.length === 0 && cl.reason === "stop-out" && !!so);
  eq("stop out: level", so.level, (4000 / 8000.4) * 100);
  eq("stop out: closed at the bid", cl.exit, 1.9851);
  eq("stop out: P/L", cl.pl, -6000);
  eq("stop out: balance", c.balance, 4000);
  ok("stop out: margin call flag cleared with no positions", c.marginCall === false);

  // in a gap the stop out arrives too late: mid 1.9700, bid 1.9699: (1.9699 − 2.0001) × 400,000 = −12,080 → balance −2,080
  const g = E.applyTick(a, 197000, -3000);
  eq("stop out after a gap can leave a negative balance", g.balance, -2080);

  // two positions: the one with the larger loss is closed first, and the level is measured again
  let t = must(E.placeMarket(s, { side: "buy", lots: 3 })); // margin 6,000.30
  t = E.applyTick(t, MID - 100); // bid 1.9989, ask 1.9991
  t = must(E.placeMarket(t, { side: "buy", lots: 0.5 })); // at 1.9991: margin 999.55
  eq("two positions: used margin", E.account(t).used, 6999.85);
  // bid 1.9790: #1 (1.9790 − 2.0001) × 300,000 = −6,330; #2 (1.9790 − 1.9991) × 50,000 = −1,005; equity 2,665 → 38.07%
  t = E.applyTick(t, 197910);
  ok("two positions: only the larger loser is closed", t.positions.length === 1 && t.positions[0].lots === 0.5);
  eq("two positions: balance after the first close", t.balance, 3670);
  // equity now 3,670 − 1,005 = 2,665 against margin 999.55 → 266.6%
  ok("two positions: level recovers above the stop out", E.account(t).level > 50 && t.stopOut.closed === 1);
}

/* ---- refusals, limits, statistics ------------------------------------------ */
{
  const s = fresh(1000, 10);
  // 1 lot at 1:10 needs 100,000 × 2.0001 ÷ 10 = 20,001.00 against 1,000 free
  const r = E.placeMarket(s, { side: "buy", lots: 1 });
  ok("order beyond free margin is refused", !r.ok && r.error.code === "margin" && r.error.need === 20001 && r.error.free === 1000);
  ok("the refusal is journalled", lastOf(r.state, "reject")?.need === 20001);
  ok("lots must be a multiple of 0.01", E.placeMarket(s, { side: "buy", lots: 0.015 }).error?.code === "lots");
  ok("lots must be at least 0.01", E.placeMarket(s, { side: "buy", lots: 0 }).error?.code === "lots");
  ok("a buy's stop must be below the bid", E.placeMarket(s, { side: "buy", lots: 0.01, sl: 2.0 }).error?.code === "sl-side");
  ok("a sell's stop must be above the ask", E.placeMarket(s, { side: "sell", lots: 0.01, sl: 2.0 }).error?.code === "sl-side");

  let m = fresh(100000, 100);
  for (let i = 0; i < E.SIM.maxTickets; i++) m = must(E.placeMarket(m, { side: i % 2 ? "buy" : "sell", lots: 0.01 }));
  ok("at most six positions and orders together", E.placeMarket(m, { side: "buy", lots: 0.01 }).error?.code === "too-many");
  const all = must(E.closeAll(m));
  ok("close all", all.positions.length === 0 && all.stats.closes === E.SIM.maxTickets);
  // each 0.01 lot pays the 2-pip spread: 2 × 10 × 0.01 = 0.20, six times
  eq("close all at an unchanged price loses the spread on each", all.balance, 100000 - 6 * 0.2);
  ok("partial close larger than the position is refused", E.closePosition(m, m.positions[0].id, 0.02).error?.code === "close-lots");

  // largest drawdown: peak 10,000, trough at equity 9,790 → 2.1%; the gain needed to recover 20% is 25%
  let d = must(E.placeMarket(fresh(), { side: "buy", lots: 0.5 }));
  d = E.applyTick(d, MID - 400); // bid 1.9959: floating −210 → equity 9,790
  d = E.applyTick(d, MID + 400);
  eq("largest drawdown, peak to trough of equity", d.stats.maxDrawdown, 210 / 10000);
  eq("gain to recover a 20% loss", E.gainToRecover(0.2), 0.25);
  eq("gain to recover a 50% loss", E.gainToRecover(0.5), 1);
}

/* ---- the invented market --------------------------------------------------- */
{
  const a = E.createState(2027, 10000, 100);
  const b = E.createState(2027, 10000, 100);
  ok("the same market number gives the same market", JSON.stringify(a) === JSON.stringify(b));
  ok("a different number gives a different market", JSON.stringify(E.createState(2028, 10000, 100).candles) !== JSON.stringify(a.candles));
  ok("60 minutes of history: 60 candles, 360 ticks", a.candles.length === 60 && a.tick === 360);
  eq("every market starts at 2.0000", E.createState(5, 10000, 100, 0).midPts, 200000);
  let s = a;
  let gaps = 0;
  let fast = 0;
  let maxStep = 0;
  let integers = true;
  for (let i = 0; i < 20000; i++) {
    const g = E.nextPrice({ rng: s.rng, midPts: s.midPts, fastLeft: s.fastLeft });
    if (g.gapPts !== 0) gaps += 1;
    else maxStep = Math.max(maxStep, Math.abs(g.midPts - s.midPts));
    if (g.fastLeft > 0) fast += 1;
    if (!Number.isInteger(g.midPts)) integers = false;
    const n = E.step(s);
    if (n.midPts !== g.midPts) integers = false;
    s = n;
  }
  ok("the walk stays on whole tenths of a pip", integers);
  ok("gaps are rare but happen (20,000 ticks)", gaps >= 10 && gaps <= 70, String(gaps));
  ok("faster stretches happen", fast > 1000 && fast < 12000, String(fast));
  ok("an ordinary step is at most a few pips", maxStep <= 80, String(maxStep));
  ok("history is bounded", s.candles.length <= 248 && s.journal.length <= 200);
  ok("candles are well formed", s.candles.every((c) => c.h >= c.o && c.h >= c.c && c.l <= c.o && c.l <= c.c));
  ok("the price stays above its floor", s.midPts >= 100000);
  ok("with no positions the balance never changes", s.balance === 10000 && s.stats.maxDrawdown === 0);

  // stored copy: bounded, and refused unless it is exactly the expected shape
  let k = must(E.placeMarket(s, { side: "buy", lots: 0.1, sl: E.quote(s).bid - 0.002 }));
  k = must(E.placePending(k, { side: "sell", order: "limit", lots: 0.1, level: E.quote(k).bid + 0.003 }));
  for (let i = 0; i < 2000; i++) k = E.step(k);
  const text = JSON.stringify(E.serialise(k));
  ok("stored copy is under 40 KB", text.length < 40000, String(text.length));
  const back = E.revive(JSON.parse(text));
  ok("stored copy is restored", back !== null && back.tick === k.tick && back.balance === k.balance);
  ok("a restored market continues identically", back !== null && E.step(back).midPts === E.step(k).midPts);
  ok("junk is refused", E.revive(null) === null && E.revive({}) === null && E.revive("x") === null && E.revive([1]) === null);
  ok("a wrong version is refused", E.revive({ ...JSON.parse(text), v: 99 }) === null);
  ok("a damaged position is refused", E.revive({ ...JSON.parse(text), positions: [{ id: 1 }] }) === null);
  ok("a damaged journal entry is refused", E.revive({ ...JSON.parse(text), journal: [{ n: 1, tick: 1, kind: "close" }] }) === null);
}

/* ---- 2. the Trader Toolkit's expressions, copied from the tool components ---- */
{
  const pip = E.SIM.pip;
  const contract = E.SIM.contract;
  const rate = 1; // the Example pair is quoted in the account's own unit: no conversion
  const LOT_STEP = 0.01;
  let n = 0;
  let bad = 0;
  const same = (x, y) => {
    n += 1;
    if (Math.abs(x - y) > 1e-9 * Math.max(1, Math.abs(y))) bad += 1;
  };
  for (const lots of [0.01, 0.1, 0.37, 1, 2.5, 50])
    for (const price of [1.2345, 1.9999, 2.0001, 2.5])
      for (const leverage of E.SIM.leverages) {
        // Margin.tsx: notional = lots.n * inst.contract.n * price.n; marginQuote = notional / leverage.n; margin = marginQuote * conv.rate
        same(E.marginFor(lots, price, leverage), ((lots * contract * price) / leverage) * rate);
        // PipValue.tsx / ProfitLoss.tsx: inst.pip.n * inst.contract.n * lots.n * conv.rate
        same(E.pipValue(lots), pip * contract * lots * rate);
        // CostLab.tsx: spreadCost = spread.n * pipAcct * lots.n; swapCost = swap.n * lots.n * nights.n
        same(E.spreadCost(lots), E.SIM.spreadPips * (pip * contract * rate) * lots);
        for (const nights of [1, 3]) same(E.swapCharge(lots, nights), E.SIM.swapPerLot * lots * nights);
        for (const exit of [price - 0.0123, price, price + 0.0045])
          for (const side of ["buy", "sell"]) {
            // ProfitLoss.tsx: dir = side === "buy" ? 1 : -1; diff = exit.n - entry.n; quote = diff * inst.contract.n * lots.n * dir
            const dir = side === "buy" ? 1 : -1;
            same(E.profitLoss(side, price, exit, lots), (exit - price) * contract * lots * dir * rate);
          }
        // Margin.tsx: level: (balance.n / margin) * 100 (equity equals the balance at the moment of opening)
        same(E.marginLevel(10000, E.marginFor(lots, price, leverage)), (10000 / ((lots * contract * price) / leverage)) * 100);
      }
  for (const balance of E.SIM.balances)
    for (const risk of [0.5, 1, 2, 7.5])
      for (const stop of [5, 20, 33, 150]) {
        // PositionSize.tsx: amount = (balance.n * risk.n) / 100; pipAcct = inst.pip.n * inst.contract.n * conv.rate;
        // perLot = stop.n * pipAcct; lots = amount / perLot; stepped = Math.floor(lots / LOT_STEP + 1e-9) * LOT_STEP
        const amount = (balance * risk) / 100;
        const perLot = stop * (pip * contract * rate);
        const lots = amount / perLot;
        const stepped = Math.floor(lots / LOT_STEP + 1e-9) * LOT_STEP;
        const got = E.positionSize(balance, risk, stop);
        same(got.amount, amount);
        same(got.perLot, perLot);
        same(got.lots, lots);
        same(got.stepped, stepped);
      }
  // Drawdown.tsx: gainFor: loss ÷ (1 − loss)
  for (const loss of [0.01, 0.2, 0.5, 0.9]) same(E.gainToRecover(loss), loss / (1 - loss));
  ok(`toolkit expressions agree with the engine (${n} comparisons)`, bad === 0 && n > 1000, `${bad} of ${n} differ`);

  // the copies above are only worth something while the tools still read that way
  const src = (f) => readFileSync(new URL(`../src/components/tools/${f}`, import.meta.url), "utf8");
  const has = (f, text) => ok(`${f} still contains: ${text}`, src(f).includes(text));
  has("Margin.tsx", "const notional = lots.n * inst.contract.n * price.n;");
  has("Margin.tsx", "const marginQuote = notional / leverage.n;");
  has("Margin.tsx", "level: (balance.n / margin) * 100");
  has("ProfitLoss.tsx", "const quote = diff * inst.contract.n * lots.n * dir;");
  has("PositionSize.tsx", "const amount = (balance.n * risk.n) / 100;");
  has("PositionSize.tsx", "const perLot = stop.n * pipAcct;");
  has("PositionSize.tsx", "const stepped = Math.floor(lots / LOT_STEP + 1e-9) * LOT_STEP;");
  has("CostLab.tsx", "const spreadCost = spread.n * pipAcct * lots.n;");
  has("CostLab.tsx", "const swapCost = swap.n * lots.n * nights.n;");
}

/* ---- 3. the formulas the site publishes ------------------------------------ */
{
  const formula = (slug) => tools.find((t) => t.slug === slug)?.formula;
  ok("tools.ts: position size", formula("position-size") === "lots = (balance × risk %) ÷ (stop in pips × pip value per lot)");
  ok("tools.ts: pip value", formula("pip-value") === "pip value = pip size × contract size × lots, converted from the quote currency to the account currency");
  ok("tools.ts: margin", formula("margin") === "margin = (lots × contract size × price) ÷ leverage");
  ok("tools.ts: profit and loss", formula("profit-loss") === "P/L = (exit − entry) × contract size × lots, sign reversed for a sell");
  ok("tools.ts: cost", formula("cost-lab") === "cost = spread cost + commission + (swap per night × nights)");
  ok("tools.ts: drawdown", formula("drawdown") === "gain required = loss ÷ (1 − loss)");
  const glossary = readFileSync(new URL("../src/data/glossary.ts", import.meta.url), "utf8");
  ok("glossary: margin level", glossary.includes('formula: "margin level = equity ÷ used margin × 100%"'));
  ok("glossary: free margin", glossary.includes('formula: "free margin = equity − used margin"'));
}

console.log(`${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(failures.length ? 1 : 0);

/**
 * PRACTICE DESK: the engine of the trading simulation on /labs/simulator.
 *
 * A pure module: no imports, no clock, no storage, no Math.random(). Every
 * function takes a state and returns a new one, so the same market number and
 * the same actions always give the same result, and the arithmetic can be
 * proved in node (scripts/test-simulator.mjs).
 *
 * Nothing in here is a real price or a GIO4X trading condition. The instrument
 * ("Example pair"), its prices, the spread, the swap, the margin call and stop
 * out levels and the length of the simulated "day" are all invented for
 * practice and are listed in SIM below, which the page prints in full.
 *
 * The arithmetic is the Trader Toolkit's, expression for expression (the tools
 * keep theirs inline, so each function names the line it mirrors):
 *   pip value      PipValue.tsx / PositionSize.tsx   pip size × contract size × lots
 *   position size  PositionSize.tsx                  (balance × risk %) ÷ (stop in pips × pip value per lot)
 *   margin         Margin.tsx                        (lots × contract size × price) ÷ leverage
 *   profit or loss ProfitLoss.tsx                    (exit − entry) × contract size × lots, sign reversed for a sell
 *   spread, swap   CostLab.tsx                       spread × pip value × lots;  swap per lot per night × lots × nights
 *   recovery       Drawdown.tsx                      loss ÷ (1 − loss)
 *   margin level   glossary "stop-out"               equity ÷ used margin × 100%
 *   free margin    glossary "free-margin"            equity − used margin
 */

/* ==========================================================================
   The invented settings
   ========================================================================== */

export const SIM = {
  /** never a real symbol */
  instrument: "Example pair",
  /** the invented unit the example account and the price are counted in: not a currency */
  unit: "SIM",
  /** size of one pip, and units in one lot: the currency-pair convention the toolkit uses */
  pip: 0.0001,
  contract: 100000,
  /** every market opens here: an arbitrary round figure */
  startPrice: 2,
  /** fixed, in pips, at all times: a real spread widens and narrows */
  spreadPips: 2,
  /** charged per lot at each simulated rollover, on buys and sells alike */
  swapPerLot: 0.5,
  /** margin level (%) at or below which the warning appears */
  marginCallLevel: 100,
  /** margin level (%) at or below which positions are closed automatically */
  stopOutLevel: 50,
  /** simulated seconds in one tick, and ticks in one one-minute candle */
  tickSeconds: 10,
  candleTicks: 6,
  /** the simulated "day" is shortened so that a rollover arrives while practising */
  rolloverMinutes: 120,
  lotStep: 0.01,
  minLots: 0.01,
  maxLots: 50,
  /** open positions and waiting orders together */
  maxTickets: 6,
  balances: [1000, 10000, 100000],
  leverages: [10, 30, 100, 200],
  defaultBalance: 10000,
  defaultLeverage: 100,
  /** the first market every visitor sees */
  defaultSeed: 2027,
  /** minutes of history drawn before the visitor arrives */
  prerollMinutes: 60,
} as const;

/** How the invented price moves. Lengths in ticks, sizes in tenths of a pip ("points"). */
export const MARKET = {
  calmSd: 6,
  fastSd: 20,
  fastChance: 0.006,
  fastMin: 30,
  fastSpan: 90,
  gapChance: 0.0015,
  gapMinPips: 12,
  gapSpanPips: 28,
  floorPts: 100000,
} as const;

const PTS = 100000;
const HALF_SPREAD_PTS = (SIM.spreadPips * 10) / 2;
export const ROLLOVER_TICKS = (SIM.rolloverMinutes * 60) / SIM.tickSeconds;
const MAX_CANDLES = 240;
const MAX_JOURNAL = 200;
export const PERSIST_VERSION = 1;

export const r2 = (n: number) => Math.round(n * 100) / 100;
export const r5 = (n: number) => Math.round(n * PTS) / PTS;
const r1 = (n: number) => Math.round(n * 10) / 10;

/* ==========================================================================
   Arithmetic (the site's)
   ========================================================================== */

export type Side = "buy" | "sell";
export type OrderKind = "limit" | "stop";

/** pip size × contract size × lots */
export function pipValue(lots: number): number {
  return SIM.pip * SIM.contract * lots;
}

/** lots = (balance × risk %) ÷ (stop in pips × pip value per lot), then rounded down to the lot step */
export function positionSize(balance: number, riskPct: number, stopPips: number): { amount: number; perLot: number; lots: number; stepped: number; steppedRisk: number } {
  const amount = (balance * riskPct) / 100;
  const perLot = stopPips * pipValue(1);
  const lots = amount / perLot;
  const stepped = Math.floor(lots / SIM.lotStep + 1e-9) * SIM.lotStep;
  return { amount, perLot, lots, stepped: r2(stepped), steppedRisk: r2(stepped) * perLot };
}

/** margin = (lots × contract size × price) ÷ leverage */
export function marginFor(lots: number, price: number, leverage: number): number {
  return (lots * SIM.contract * price) / leverage;
}

/** P/L = (exit − entry) × contract size × lots, sign reversed for a sell */
export function profitLoss(side: Side, entry: number, exit: number, lots: number): number {
  return (exit - entry) * SIM.contract * lots * (side === "buy" ? 1 : -1);
}

/** margin level = equity ÷ used margin × 100% */
export function marginLevel(equity: number, used: number): number | null {
  return used > 0 ? (equity / used) * 100 : null;
}

/** swap per lot per night × lots × nights */
export function swapCharge(lots: number, nights = 1): number {
  return SIM.swapPerLot * lots * nights;
}

/** spread × pip value × lots */
export function spreadCost(lots: number): number {
  return SIM.spreadPips * pipValue(1) * lots;
}

/** gain required = loss ÷ (1 − loss), both as fractions */
export function gainToRecover(loss: number): number {
  return loss / (1 - loss);
}

/** price distance in pips, to one decimal */
export function pipsBetween(a: number, b: number): number {
  return r1((b - a) / SIM.pip);
}

/* ==========================================================================
   State
   ========================================================================== */

export type Position = {
  id: number;
  side: Side;
  lots: number;
  entry: number;
  sl: number | null;
  tp: number | null;
  /** fixed when the position opens, at the fill price; reduced in proportion by a partial close */
  margin: number;
  openedTick: number;
  /** swap charged to this position so far */
  swap: number;
};

export type Pending = {
  id: number;
  side: Side;
  order: OrderKind;
  lots: number;
  level: number;
  sl: number | null;
  tp: number | null;
  placedTick: number;
};

export type Candle = { m: number; o: number; h: number; l: number; c: number; gap: boolean };

export type CloseReason = "manual" | "partial" | "close-all" | "stop-loss" | "take-profit" | "stop-out";

export type EntryBody =
  | { kind: "start"; seed: number; balance: number; leverage: number }
  | { kind: "placed"; id: number; side: Side; order: OrderKind; lots: number; level: number; sl: number | null; tp: number | null }
  | { kind: "open"; id: number; side: Side; lots: number; price: number; via: "market" | OrderKind; requested: number | null; slip: number; gap: boolean; margin: number; sl: number | null; tp: number | null }
  | { kind: "modify"; target: "position" | "order"; id: number; field: "sl" | "tp" | "level"; from: number | null; to: number | null }
  | { kind: "close"; id: number; side: Side; lots: number; entry: number; exit: number; pl: number; reason: CloseReason; requested: number | null; slip: number; gap: boolean; released: number; balance: number; left: number }
  | { kind: "swap"; id: number; lots: number; charge: number; balance: number }
  | { kind: "cancel"; id: number; reason: "manual" | "margin"; need: number; free: number }
  | { kind: "reject"; side: Side; lots: number; need: number; free: number }
  | { kind: "gap"; pips: number; from: number; to: number }
  | { kind: "margin-call"; equity: number; used: number; level: number }
  | { kind: "stop-out"; equity: number; used: number; level: number };

/** n: running number; tick: when it happened */
export type Entry = { n: number; tick: number } & EntryBody;

export type Stats = { closes: number; gains: number; losses: number; flat: number; realised: number; swaps: number; peakEquity: number; maxDrawdown: number };

/** the guided exercises, ticked by the engine as each thing actually happens */
export type Done = { openWithStop: boolean; movedStop: boolean; partialGain: boolean; heldThroughGap: boolean; marginCall: boolean };

export type SimState = {
  v: number;
  seed: number;
  rng: number;
  tick: number;
  /** mid price in points (tenths of a pip): an integer, so the walk never drifts by rounding */
  midPts: number;
  fastLeft: number;
  startBalance: number;
  leverage: number;
  balance: number;
  positions: Position[];
  orders: Pending[];
  candles: Candle[];
  journal: Entry[];
  nextId: number;
  nextEntry: number;
  /** true while the margin level is at or below the margin call level */
  marginCall: boolean;
  /** the last automatic stop out, kept so the page can explain it */
  stopOut: { tick: number; equity: number; used: number; level: number; closed: number } | null;
  stats: Stats;
  done: Done;
};

export type SimError =
  | { code: "lots" }
  | { code: "margin"; need: number; free: number }
  | { code: "too-many" }
  | { code: "sl-side"; side: Side; ref: number }
  | { code: "tp-side"; side: Side; ref: number }
  | { code: "level-side"; side: Side; order: OrderKind; ref: number }
  | { code: "close-lots"; max: number }
  | { code: "not-found" }
  | { code: "no-change" };

export type Result = { ok: true; state: SimState } | { ok: false; state: SimState; error: SimError };

/* ==========================================================================
   The invented market: a seeded walk with faster stretches and a rare gap
   ========================================================================== */

/** mulberry32: one 32-bit state in, a number in [0, 1) and the next state out */
function rand(a: number): [number, number] {
  const s = (a + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

export type Walk = { rng: number; midPts: number; fastLeft: number };

/** The next mid price. `gapPts` is non-zero when the price jumped with no trading in between. */
export function nextPrice(g: Walk): Walk & { gapPts: number } {
  let rng = g.rng;
  const u = () => {
    const [v, s] = rand(rng);
    rng = s;
    return v;
  };
  let fastLeft = g.fastLeft > 0 ? g.fastLeft - 1 : 0;
  if (fastLeft === 0 && u() < MARKET.fastChance) fastLeft = MARKET.fastMin + Math.floor(u() * MARKET.fastSpan);
  let gapPts = 0;
  let move: number;
  if (u() < MARKET.gapChance) {
    const size = (MARKET.gapMinPips + Math.floor(u() * MARKET.gapSpanPips)) * 10;
    gapPts = u() < 0.5 ? -size : size;
    move = gapPts;
  } else {
    // the sum of four uniforms is close enough to a bell curve for a practice market (sd 0.5774 before scaling)
    const n = u() + u() + u() + u() - 2;
    move = Math.round((n / 0.5774) * (fastLeft > 0 ? MARKET.fastSd : MARKET.calmSd));
  }
  let midPts = g.midPts + move;
  // an invented price has no reason to reach zero: it is turned back at a floor far below where it starts
  if (midPts < MARKET.floorPts) {
    midPts = MARKET.floorPts + (MARKET.floorPts - midPts);
    gapPts = 0;
  }
  return { rng, midPts, fastLeft, gapPts };
}

export type Quote = { bid: number; ask: number; mid: number };

export function quoteAt(midPts: number): Quote {
  return { bid: (midPts - HALF_SPREAD_PTS) / PTS, ask: (midPts + HALF_SPREAD_PTS) / PTS, mid: midPts / PTS };
}

export const quote = (s: SimState): Quote => quoteAt(s.midPts);

/** simulated minutes since the market began */
export const minuteOf = (tick: number): number => (tick * SIM.tickSeconds) / 60;

/* ==========================================================================
   The account, tick by tick
   ========================================================================== */

export type Line = { id: number; price: number; pl: number; pips: number };
export type Account = { balance: number; floating: number; equity: number; used: number; free: number; level: number | null; lines: Line[] };

/** A buy is valued at the bid and a sell at the ask: the price it could be closed at now. */
export function account(s: SimState): Account {
  const q = quote(s);
  let floating = 0;
  let used = 0;
  const lines = s.positions.map((p) => {
    const price = p.side === "buy" ? q.bid : q.ask;
    const pl = r2(profitLoss(p.side, p.entry, price, p.lots));
    floating += pl;
    used += p.margin;
    return { id: p.id, price, pl, pips: p.side === "buy" ? pipsBetween(p.entry, price) : pipsBetween(price, p.entry) };
  });
  floating = r2(floating);
  used = r2(used);
  const equity = r2(s.balance + floating);
  return { balance: s.balance, floating, equity, used, free: r2(equity - used), level: marginLevel(equity, used), lines };
}

function draft(s: SimState): SimState {
  return { ...s, stats: { ...s.stats }, done: { ...s.done } };
}

function log(d: SimState, body: EntryBody): void {
  const next = d.journal.length >= MAX_JOURNAL ? d.journal.slice(d.journal.length - MAX_JOURNAL + 1) : d.journal.slice();
  next.push({ n: d.nextEntry, tick: d.tick, ...body });
  d.journal = next;
  d.nextEntry += 1;
}

function track(d: SimState): void {
  const eq = account(d).equity;
  if (eq > d.stats.peakEquity) d.stats.peakEquity = eq;
  const dd = d.stats.peakEquity > 0 ? (d.stats.peakEquity - eq) / d.stats.peakEquity : 0;
  if (dd > d.stats.maxDrawdown) d.stats.maxDrawdown = dd;
}

/** Close `lots` of a position at `exit`. `requested` is the level an order asked for, when one did. */
function closeInto(d: SimState, p: Position, lots: number, exit: number, reason: CloseReason, requested: number | null, gap: boolean): void {
  const whole = lots >= p.lots - 1e-9;
  const size = whole ? p.lots : lots;
  const pl = r2(profitLoss(p.side, p.entry, exit, size));
  const released = whole ? p.margin : r2((p.margin * size) / p.lots);
  const left = whole ? 0 : r2(p.lots - size);
  d.balance = r2(d.balance + pl);
  d.positions = whole ? d.positions.filter((x) => x.id !== p.id) : d.positions.map((x) => (x.id === p.id ? { ...x, lots: left, margin: r2(x.margin - released) } : x));
  d.stats.closes += 1;
  if (pl > 0) d.stats.gains += 1;
  else if (pl < 0) d.stats.losses += 1;
  else d.stats.flat += 1;
  d.stats.realised = r2(d.stats.realised + pl);
  // a positive slip is a worse price than the one asked for: a buy closes by selling, a sell by buying
  const slip = requested === null ? 0 : p.side === "buy" ? pipsBetween(exit, requested) : pipsBetween(requested, exit);
  if (reason === "partial" && pl > 0) d.done.partialGain = true;
  log(d, { kind: "close", id: p.id, side: p.side, lots: size, entry: p.entry, exit, pl, reason, requested, slip, gap, released, balance: d.balance, left });
}

function openInto(d: SimState, side: Side, lots: number, price: number, via: "market" | OrderKind, requested: number | null, gap: boolean, sl: number | null, tp: number | null, id: number): void {
  const margin = r2(marginFor(lots, price, d.leverage));
  d.positions = [...d.positions, { id, side, lots, entry: price, sl, tp, margin, openedTick: d.tick, swap: 0 }];
  const slip = requested === null ? 0 : side === "buy" ? pipsBetween(requested, price) : pipsBetween(price, requested);
  if (sl !== null) d.done.openWithStop = true;
  log(d, { kind: "open", id, side, lots, price, via, requested, slip, gap, margin, sl, tp });
}

/**
 * One tick at a given mid price. The order of events inside a tick:
 * the price moves; a gap is noted; swap is charged at a rollover; waiting
 * orders are triggered; stops and targets are triggered; the margin level is
 * checked. On an ordinary tick the price is treated as having traded through
 * every level between the two ticks, so an order fills at its own level. After
 * a gap nothing traded in between, so the fill is the first price available.
 */
export function applyTick(s: SimState, midPts: number, gapPts = 0): SimState {
  const d = draft(s);
  const from = d.midPts;
  d.tick += 1;
  d.midPts = midPts;
  const q = quoteAt(midPts);
  const gap = gapPts !== 0;

  const m = Math.floor((d.tick - 1) / SIM.candleTicks);
  const candles = d.candles.slice(d.candles.length >= MAX_CANDLES + 8 ? d.candles.length - MAX_CANDLES : 0);
  const last = candles[candles.length - 1];
  if (last && last.m === m) candles[candles.length - 1] = { m, o: last.o, h: Math.max(last.h, q.mid), l: Math.min(last.l, q.mid), c: q.mid, gap: last.gap || gap };
  else candles.push({ m, o: q.mid, h: q.mid, l: q.mid, c: q.mid, gap });
  d.candles = candles;

  if (gap && (d.positions.length > 0 || d.orders.length > 0)) {
    if (d.positions.length > 0) d.done.heldThroughGap = true;
    log(d, { kind: "gap", pips: r1(gapPts / 10), from: from / PTS, to: q.mid });
  }

  if (d.tick % ROLLOVER_TICKS === 0) {
    for (const p of d.positions.slice()) {
      const charge = r2(swapCharge(p.lots));
      d.balance = r2(d.balance - charge);
      d.stats.swaps = r2(d.stats.swaps + charge);
      d.positions = d.positions.map((x) => (x.id === p.id ? { ...x, swap: r2(x.swap + charge) } : x));
      log(d, { kind: "swap", id: p.id, lots: p.lots, charge, balance: d.balance });
    }
  }

  for (const o of d.orders.slice()) {
    const market = o.side === "buy" ? q.ask : q.bid;
    const reached = o.side === "buy" ? (o.order === "limit" ? market <= o.level : market >= o.level) : o.order === "limit" ? market >= o.level : market <= o.level;
    if (!reached) continue;
    const price = gap ? market : o.level;
    d.orders = d.orders.filter((x) => x.id !== o.id);
    const need = r2(marginFor(o.lots, price, d.leverage));
    const free = account(d).free;
    if (need > free) {
      log(d, { kind: "cancel", id: o.id, reason: "margin", need, free });
      continue;
    }
    openInto(d, o.side, o.lots, price, o.order, o.level, gap, o.sl, o.tp, o.id);
  }

  for (const p of d.positions.slice()) {
    const market = p.side === "buy" ? q.bid : q.ask;
    const stopped = p.sl !== null && (p.side === "buy" ? market <= p.sl : market >= p.sl);
    const target = p.tp !== null && (p.side === "buy" ? market >= p.tp : market <= p.tp);
    if (stopped && p.sl !== null) closeInto(d, p, p.lots, gap ? market : p.sl, "stop-loss", p.sl, gap);
    else if (target && p.tp !== null) closeInto(d, p, p.lots, gap ? market : p.tp, "take-profit", p.tp, gap);
  }

  let a = account(d);
  if (a.level !== null && a.level <= SIM.stopOutLevel) {
    const first = { equity: a.equity, used: a.used, level: a.level };
    log(d, { kind: "stop-out", ...first });
    let closed = 0;
    // the position with the largest loss goes first, and the level is measured again after each one
    while (a.level !== null && a.level <= SIM.stopOutLevel && d.positions.length > 0) {
      const worst = a.lines.reduce((w, l) => (l.pl < w.pl ? l : w), a.lines[0]!);
      const p = d.positions.find((x) => x.id === worst.id);
      if (!p) break;
      closeInto(d, p, p.lots, worst.price, "stop-out", null, gap);
      closed += 1;
      a = account(d);
    }
    d.stopOut = { tick: d.tick, ...first, closed };
    d.done.marginCall = true;
  }
  const calling = a.level !== null && a.level <= SIM.marginCallLevel;
  if (calling && !d.marginCall && a.level !== null) {
    log(d, { kind: "margin-call", equity: a.equity, used: a.used, level: a.level });
    d.done.marginCall = true;
  }
  d.marginCall = calling;

  track(d);
  return d;
}

/** One tick of the invented market. */
export function step(s: SimState): SimState {
  const g = nextPrice({ rng: s.rng, midPts: s.midPts, fastLeft: s.fastLeft });
  const d = applyTick(s, g.midPts, g.gapPts);
  d.rng = g.rng;
  d.fastLeft = g.fastLeft;
  return d;
}

export function createState(seed: number, balance: number, leverage: number, prerollMinutes: number = SIM.prerollMinutes): SimState {
  let s: SimState = {
    v: PERSIST_VERSION,
    seed,
    rng: seed >>> 0,
    tick: 0,
    midPts: SIM.startPrice * PTS,
    fastLeft: 0,
    startBalance: balance,
    leverage,
    balance,
    positions: [],
    orders: [],
    candles: [],
    journal: [],
    nextId: 1,
    nextEntry: 1,
    marginCall: false,
    stopOut: null,
    stats: { closes: 0, gains: 0, losses: 0, flat: 0, realised: 0, swaps: 0, peakEquity: balance, maxDrawdown: 0 },
    done: { openWithStop: false, movedStop: false, partialGain: false, heldThroughGap: false, marginCall: false },
  };
  const ticks = prerollMinutes * SIM.candleTicks;
  for (let i = 0; i < ticks; i++) s = step(s);
  const d = draft(s);
  log(d, { kind: "start", seed, balance, leverage });
  return d;
}

/* ==========================================================================
   What the visitor can do
   ========================================================================== */

const fail = (state: SimState, error: SimError): Result => ({ ok: false, state, error });

export function validLots(lots: number): boolean {
  if (!Number.isFinite(lots) || lots < SIM.minLots - 1e-9 || lots > SIM.maxLots + 1e-9) return false;
  return Math.abs(lots * 100 - Math.round(lots * 100)) < 1e-6;
}

const validPrice = (p: number | null): boolean => p === null || (Number.isFinite(p) && p > 0);

/** A stop must sit on the losing side of `ref` and a target on the other; `ref` is the price the position closes at. */
function checkStops(side: Side, sl: number | null, tp: number | null, ref: number): SimError | null {
  if (!validPrice(sl)) return { code: "sl-side", side, ref };
  if (!validPrice(tp)) return { code: "tp-side", side, ref };
  if (sl !== null && !(side === "buy" ? sl < ref : sl > ref)) return { code: "sl-side", side, ref };
  if (tp !== null && !(side === "buy" ? tp > ref : tp < ref)) return { code: "tp-side", side, ref };
  return null;
}

const norm = (p: number | null): number | null => (p === null ? null : r5(p));

/** Buy at the ask or sell at the bid, now. */
export function placeMarket(s: SimState, o: { side: Side; lots: number; sl?: number | null; tp?: number | null }): Result {
  if (!validLots(o.lots)) return fail(s, { code: "lots" });
  if (s.positions.length + s.orders.length >= SIM.maxTickets) return fail(s, { code: "too-many" });
  const lots = r2(o.lots);
  const q = quote(s);
  const sl = norm(o.sl ?? null);
  const tp = norm(o.tp ?? null);
  const bad = checkStops(o.side, sl, tp, o.side === "buy" ? q.bid : q.ask);
  if (bad) return fail(s, bad);
  const price = o.side === "buy" ? q.ask : q.bid;
  const need = r2(marginFor(lots, price, s.leverage));
  const free = account(s).free;
  const d = draft(s);
  if (need > free) {
    // a refused order is part of the record: it is the lesson of the leverage exercise
    log(d, { kind: "reject", side: o.side, lots, need, free });
    return { ok: false, state: d, error: { code: "margin", need, free } };
  }
  openInto(d, o.side, lots, price, "market", null, false, sl, tp, d.nextId);
  d.nextId += 1;
  track(d);
  return { ok: true, state: d };
}

/** Where a waiting order may rest: a limit on the better side of the price, a stop on the worse side. */
function checkLevel(side: Side, order: OrderKind, level: number, q: Quote): SimError | null {
  const ref = side === "buy" ? q.ask : q.bid;
  const below = side === "buy" ? order === "limit" : order === "stop";
  if (!Number.isFinite(level) || level <= 0 || !(below ? level < ref : level > ref)) return { code: "level-side", side, order, ref };
  return null;
}

/** A limit or stop order that waits for the simulated price to reach its level. */
export function placePending(s: SimState, o: { side: Side; order: OrderKind; lots: number; level: number; sl?: number | null; tp?: number | null }): Result {
  if (!validLots(o.lots)) return fail(s, { code: "lots" });
  if (s.positions.length + s.orders.length >= SIM.maxTickets) return fail(s, { code: "too-many" });
  const level = r5(o.level);
  const badLevel = checkLevel(o.side, o.order, level, quote(s));
  if (badLevel) return fail(s, badLevel);
  const sl = norm(o.sl ?? null);
  const tp = norm(o.tp ?? null);
  const bad = checkStops(o.side, sl, tp, level);
  if (bad) return fail(s, bad);
  const d = draft(s);
  const lots = r2(o.lots);
  d.orders = [...d.orders, { id: d.nextId, side: o.side, order: o.order, lots, level, sl, tp, placedTick: d.tick }];
  log(d, { kind: "placed", id: d.nextId, side: o.side, order: o.order, lots, level, sl, tp });
  d.nextId += 1;
  return { ok: true, state: d };
}

/** Move, set or remove (null) the stop loss or take profit of an open position. */
export function modifyPosition(s: SimState, id: number, change: { sl?: number | null; tp?: number | null }): Result {
  const p = s.positions.find((x) => x.id === id);
  if (!p) return fail(s, { code: "not-found" });
  const sl = change.sl === undefined ? p.sl : norm(change.sl);
  const tp = change.tp === undefined ? p.tp : norm(change.tp);
  if (sl === p.sl && tp === p.tp) return fail(s, { code: "no-change" });
  const q = quote(s);
  // only the level being changed is checked: the other one was valid when it was set
  const bad = checkStops(p.side, sl === p.sl ? null : sl, tp === p.tp ? null : tp, p.side === "buy" ? q.bid : q.ask);
  if (bad) return fail(s, bad);
  const d = draft(s);
  d.positions = d.positions.map((x) => (x.id === id ? { ...x, sl, tp } : x));
  if (sl !== p.sl) {
    log(d, { kind: "modify", target: "position", id, field: "sl", from: p.sl, to: sl });
    if (p.sl !== null && sl !== null) d.done.movedStop = true;
  }
  if (tp !== p.tp) log(d, { kind: "modify", target: "position", id, field: "tp", from: p.tp, to: tp });
  return { ok: true, state: d };
}

/** Move a waiting order. Its stop and target keep their distance from the level. */
export function modifyOrder(s: SimState, id: number, level: number): Result {
  const o = s.orders.find((x) => x.id === id);
  if (!o) return fail(s, { code: "not-found" });
  const to = r5(level);
  if (to === o.level) return fail(s, { code: "no-change" });
  const bad = checkLevel(o.side, o.order, to, quote(s));
  if (bad) return fail(s, bad);
  const shift = to - o.level;
  const sl = o.sl === null ? null : r5(o.sl + shift);
  const tp = o.tp === null ? null : r5(o.tp + shift);
  if (!validPrice(sl) || !validPrice(tp)) return fail(s, { code: "level-side", side: o.side, order: o.order, ref: o.side === "buy" ? quote(s).ask : quote(s).bid });
  const d = draft(s);
  d.orders = d.orders.map((x) => (x.id === id ? { ...x, level: to, sl, tp } : x));
  log(d, { kind: "modify", target: "order", id, field: "level", from: o.level, to });
  return { ok: true, state: d };
}

export function cancelOrder(s: SimState, id: number): Result {
  if (!s.orders.some((x) => x.id === id)) return fail(s, { code: "not-found" });
  const d = draft(s);
  d.orders = d.orders.filter((x) => x.id !== id);
  log(d, { kind: "cancel", id, reason: "manual", need: 0, free: 0 });
  return { ok: true, state: d };
}

/** Close all of a position, or `lots` of it, at the price available now. */
export function closePosition(s: SimState, id: number, lots?: number): Result {
  const p = s.positions.find((x) => x.id === id);
  if (!p) return fail(s, { code: "not-found" });
  const part = lots !== undefined && lots < p.lots - 1e-9;
  if (lots !== undefined && (!validLots(lots) || lots > p.lots + 1e-9)) return fail(s, { code: "close-lots", max: p.lots });
  const q = quote(s);
  const d = draft(s);
  closeInto(d, p, part && lots !== undefined ? r2(lots) : p.lots, p.side === "buy" ? q.bid : q.ask, part ? "partial" : "manual", null, false);
  if (d.positions.length === 0) d.marginCall = false;
  track(d);
  return { ok: true, state: d };
}

export function closeAll(s: SimState): Result {
  if (s.positions.length === 0) return fail(s, { code: "not-found" });
  const q = quote(s);
  const d = draft(s);
  for (const p of s.positions) closeInto(d, p, p.lots, p.side === "buy" ? q.bid : q.ask, "close-all", null, false);
  d.marginCall = false;
  track(d);
  return { ok: true, state: d };
}

/* ==========================================================================
   Keeping a session in the browser (only when the visitor asks)
   ========================================================================== */

const KEEP_CANDLES = 150;
const KEEP_JOURNAL = 80;

/** A bounded copy: the newest candles and journal entries only. */
export function serialise(s: SimState): SimState {
  return { ...s, candles: s.candles.slice(-KEEP_CANDLES), journal: s.journal.slice(-KEEP_JOURNAL) };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const numOrNull = (x: unknown): x is number | null => x === null || num(x);
const bool = (x: unknown): x is boolean => typeof x === "boolean";
const isSide = (x: unknown): x is Side => x === "buy" || x === "sell";
const isOrder = (x: unknown): x is OrderKind => x === "limit" || x === "stop";
const oneOf = (x: unknown, list: readonly string[]): boolean => typeof x === "string" && list.includes(x);
const allNum = (o: Record<string, unknown>, keys: readonly string[]): boolean => keys.every((k) => num(o[k]));

function okEntry(e: unknown): e is Entry {
  if (!isObj(e) || !num(e.n) || !num(e.tick)) return false;
  switch (e.kind) {
    case "start":
      return allNum(e, ["seed", "balance", "leverage"]);
    case "placed":
      return allNum(e, ["id", "lots", "level"]) && isSide(e.side) && isOrder(e.order) && numOrNull(e.sl) && numOrNull(e.tp);
    case "open":
      return allNum(e, ["id", "lots", "price", "slip", "margin"]) && isSide(e.side) && oneOf(e.via, ["market", "limit", "stop"]) && numOrNull(e.requested) && bool(e.gap) && numOrNull(e.sl) && numOrNull(e.tp);
    case "modify":
      return num(e.id) && oneOf(e.target, ["position", "order"]) && oneOf(e.field, ["sl", "tp", "level"]) && numOrNull(e.from) && numOrNull(e.to);
    case "close":
      return allNum(e, ["id", "lots", "entry", "exit", "pl", "slip", "released", "balance", "left"]) && isSide(e.side) && oneOf(e.reason, ["manual", "partial", "close-all", "stop-loss", "take-profit", "stop-out"]) && numOrNull(e.requested) && bool(e.gap);
    case "swap":
      return allNum(e, ["id", "lots", "charge", "balance"]);
    case "cancel":
      return allNum(e, ["id", "need", "free"]) && oneOf(e.reason, ["manual", "margin"]);
    case "reject":
      return allNum(e, ["lots", "need", "free"]) && isSide(e.side);
    case "gap":
      return allNum(e, ["pips", "from", "to"]);
    case "margin-call":
    case "stop-out":
      return allNum(e, ["equity", "used", "level"]);
    default:
      return false;
  }
}

/** Rebuild a state from what was stored. Anything that is not exactly the expected shape is refused. */
export function revive(raw: unknown): SimState | null {
  if (!isObj(raw) || raw.v !== PERSIST_VERSION) return null;
  if (!allNum(raw, ["seed", "rng", "tick", "midPts", "fastLeft", "startBalance", "leverage", "balance", "nextId", "nextEntry"])) return null;
  if (!Number.isInteger(raw.midPts) || (raw.midPts as number) < MARKET.floorPts || (raw.tick as number) < 0 || (raw.leverage as number) < 1) return null;
  if (!bool(raw.marginCall)) return null;
  const { positions, orders, candles, journal, stats, done, stopOut } = raw;
  if (!Array.isArray(positions) || !Array.isArray(orders) || !Array.isArray(candles) || !Array.isArray(journal)) return null;
  if (positions.length + orders.length > SIM.maxTickets || candles.length > MAX_CANDLES + 8 || journal.length > MAX_JOURNAL) return null;
  const okPos = positions.every((p) => isObj(p) && allNum(p, ["id", "lots", "entry", "margin", "openedTick", "swap"]) && isSide(p.side) && numOrNull(p.sl) && numOrNull(p.tp) && (p.lots as number) > 0 && (p.entry as number) > 0);
  const okOrd = orders.every((o) => isObj(o) && allNum(o, ["id", "lots", "level", "placedTick"]) && isSide(o.side) && isOrder(o.order) && numOrNull(o.sl) && numOrNull(o.tp) && (o.lots as number) > 0 && (o.level as number) > 0);
  const okCan = candles.length > 0 && candles.every((c) => isObj(c) && allNum(c, ["m", "o", "h", "l", "c"]) && bool(c.gap));
  if (!okPos || !okOrd || !okCan || !journal.every(okEntry)) return null;
  if (!isObj(stats) || !allNum(stats, ["closes", "gains", "losses", "flat", "realised", "swaps", "peakEquity", "maxDrawdown"])) return null;
  if (!isObj(done) || !["openWithStop", "movedStop", "partialGain", "heldThroughGap", "marginCall"].every((k) => bool(done[k]))) return null;
  if (stopOut !== null && !(isObj(stopOut) && allNum(stopOut, ["tick", "equity", "used", "level", "closed"]))) return null;
  return raw as unknown as SimState;
}

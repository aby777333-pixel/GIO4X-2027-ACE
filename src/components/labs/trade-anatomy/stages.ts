/**
 * Trade Anatomy: the words.
 *
 * One order, followed through the seven stages of its life. The text here IS
 * the content of the page: the scene beside it only illustrates it. Everything
 * is general market mechanics, stated as such ("may", "commonly", "depends on
 * the broker") wherever practice varies between brokers and platforms.
 *
 * The only statements about GIO4X are in `note`, and each one repeats what
 * another page of this site already says: the account pages list market
 * execution; the transparency ledger lists the execution policy, swap rates
 * and execution statistics as not yet published; the trading conditions page
 * publishes the margin call and stop out levels. No price, rate or level is
 * quoted here.
 */

export type Branches = {
  /** the order type written on the ticket */
  type: "market" | "limit";
  /** whether the order passes its checks */
  check: "pass" | "reject";
  /** who the order is dealt with */
  route: "book" | "lp";
  /** what happens to a market order at the fill */
  fill: "exact" | "slip" | "requote";
  /** what happens to a limit order while it rests */
  wait: "reached" | "never";
  /** who closes the position */
  close: "hand" | "sl" | "tp" | "stopout";
  /** what the closed position leaves in the balance */
  result: "profit" | "loss";
};

export type BranchKey = keyof Branches;

export const DEFAULT_BRANCHES: Branches = { type: "market", check: "pass", route: "lp", fill: "exact", wait: "reached", close: "hand", result: "profit" };

export const CONTROLS: { [K in BranchKey]: { label: string; options: { value: Branches[K]; label: string }[] } } = {
  type: {
    label: "Order type",
    options: [
      { value: "market", label: "Market order" },
      { value: "limit", label: "Limit order" },
    ],
  },
  check: {
    label: "Outcome of the checks",
    options: [
      { value: "pass", label: "Passes" },
      { value: "reject", label: "Rejected" },
    ],
  },
  route: {
    label: "Execution model",
    options: [
      { value: "lp", label: "Passed to providers" },
      { value: "book", label: "Broker’s own book" },
    ],
  },
  fill: {
    label: "What the market order meets",
    options: [
      { value: "exact", label: "Price requested" },
      { value: "slip", label: "Slippage" },
      { value: "requote", label: "Requote" },
    ],
  },
  wait: {
    label: "What the limit order meets",
    options: [
      { value: "reached", label: "Price reaches it" },
      { value: "never", label: "Never reached" },
    ],
  },
  close: {
    label: "Closed by",
    options: [
      { value: "hand", label: "The trader" },
      { value: "sl", label: "Stop loss" },
      { value: "tp", label: "Take profit" },
      { value: "stopout", label: "Stop-out" },
    ],
  },
  result: {
    label: "Result",
    options: [
      { value: "profit", label: "A profit" },
      { value: "loss", label: "A loss" },
    ],
  },
};

/** Plain text, or a link to another page of this site. */
export type NotePart = string | { label: string; href: string };

export type Stage = {
  key: string;
  /** the word on the progress rail and in the scene */
  short: string;
  title: string;
  /** which branch controls this stage offers, given the choices so far */
  controls: (b: Branches) => BranchKey[];
  /** what happens, in plain sentences; follows the branch */
  body: (b: Branches) => string[];
  wrong: string;
  /** glossary slugs; the page drops any that do not exist */
  terms: string[];
  /** what this site says about GIO4X at this stage, and what it does not yet publish */
  note: NotePart[];
  tool?: { label: string; href: string };
};

export const STAGES: Stage[] = [
  {
    key: "ticket",
    short: "Ticket",
    title: "The decision and the ticket",
    controls: () => ["type"],
    body: (b) => [
      "Every order starts as a decision that is entirely the trader’s: what to trade, in which direction, and how much. The order ticket records it as an instrument, a direction (buy or sell), a size in lots and an order type.",
      b.type === "market"
        ? "On this branch the ticket holds a market order: an instruction to trade now, at the price available when the order arrives."
        : "On this branch the ticket holds a limit order: it names a price and waits. It asks to trade only at that price or better, and it may never be filled.",
      "Nothing has been traded yet. Until the ticket is sent it is only an intention.",
    ],
    wrong:
      "Most avoidable mistakes are made on the ticket: the wrong size, the wrong direction, or a level typed on the wrong side of the price. A size chosen without working out what one pip is worth can make a position far larger than intended.",
    terms: ["order", "lot", "market-order", "limit-order", "pending-order", "pip"],
    note: ["Orders at GIO4X are placed on its trading platforms, which are described on the ", { label: "platforms page", href: "/platforms" }, ". Minimum trade sizes are listed with the ", { label: "account types", href: "/trading/accounts" }, "."],
    tool: { label: "Work out a size from the risk", href: "/tools/position-size" },
  },
  {
    key: "checks",
    short: "Checks",
    title: "Checks before it leaves",
    controls: () => ["check"],
    body: (b) => [
      "Before an order goes anywhere it is checked, commonly by the platform and again by the broker’s server. The first check is margin: the account must have enough free margin to cover the deposit the new position would tie up.",
      "The second is validity: the instrument must be open for trading, the size must fit the permitted minimum, maximum and step, and any price level must be on the correct side of the market and, on many platforms, a minimum distance from it.",
      b.check === "pass"
        ? "On this branch the order passes both checks and is sent on."
        : "On this branch the order fails a check. It is returned with a reason, such as not enough free margin or an invalid level, and nothing is traded. The remaining stages follow an order that passes.",
    ],
    wrong:
      "Not enough free margin is a common reason for a rejection, and it is more likely when other positions are already open. A pending order may be checked again at the moment it triggers, so an order that is accepted now can still be refused later if the account has changed in between.",
    terms: ["margin", "free-margin", "leverage", "equity", "lot", "pending-order"],
    note: ["The leverage and minimum trade size GIO4X has published are on the ", { label: "trading conditions", href: "/trading/conditions" }, " page. They are indicative, and margin requirements vary with the instrument and the account."],
    tool: { label: "See what a position ties up", href: "/tools/margin" },
  },
  {
    key: "routing",
    short: "Routing",
    title: "Routing to a price",
    controls: () => ["route"],
    body: (b) => [
      "The order now needs someone to trade with. Broadly there are two models, and many brokers combine them.",
      b.route === "book"
        ? "On this branch the broker fills the order against its own book: it becomes the other side of the trade itself. That makes the broker the trader’s counterparty, which is a conflict of interest."
        : "On this branch the broker passes the order to outside liquidity providers, the banks and trading firms that quote prices, and it is filled at their prices. A broker working this way typically earns a commission or a markup on the spread.",
      "Which model applies, and when, depends on the broker’s execution policy. That document, not a label, is what says how orders are routed, priced and filled.",
    ],
    wrong:
      "Labels such as “ECN” or “no dealing desk” are used loosely in the industry, so a label alone does not say what happens to an order. In either model, time passes between the click and the order being dealt with, and the price may have moved by then.",
    terms: ["market-maker", "liquidity-provider", "non-dealing-desk", "ecn", "interbank-market", "liquidity"],
    note: [
      "GIO4X’s ",
      { label: "account types", href: "/trading/accounts" },
      " list market execution for all three accounts. Its order execution policy, the document that would say how orders are routed, priced and filled, is not yet published: the ",
      { label: "transparency ledger", href: "/trust/transparency" },
      " lists it as outstanding. This page therefore does not say which model GIO4X uses.",
    ],
  },
  {
    key: "fill",
    short: "Fill",
    title: "The fill",
    controls: (b) => ["type", b.type === "market" ? "fill" : "wait"],
    body: (b) => {
      if (b.type === "limit") {
        return [
          "A fill is the moment an order becomes a trade. A limit order is not filled at once: it rests at its level, and the price has to come to it.",
          b.wait === "reached"
            ? "On this branch the price reaches the level and the order is filled at the limit price or better, never worse."
            : "On this branch the price never reaches the level. The order stays pending until it is cancelled or expires, nothing is opened, and the later stages do not happen. They describe an order that was filled.",
          "A limit order controls the price and gives up certainty of being filled.",
        ];
      }
      return [
        "A fill is the moment an order becomes a trade. A market order is filled at the price available when it is dealt with: the ask for a buy, the bid for a sell.",
        b.fill === "exact"
          ? "On this branch the price has not moved since the click, so the fill matches the price that was on screen."
          : b.fill === "slip"
            ? "On this branch the price moved between the click and the fill, so the order is filled at a different price. The difference is slippage. It can go against the trader or in the trader’s favour, and it is most likely in fast or thin markets."
            : "On this branch the broker uses instant execution: the order named a price, that price is no longer available, and the broker replies with a new one. That reply is a requote. Nothing is traded unless the trader accepts it, and the price may move again in the meantime. Under market execution there is no requote: the order is filled at the available price instead.",
        "A market order controls the timing and gives up certainty about the price.",
      ];
    },
    wrong:
      "Around major releases, at the daily rollover and at the weekly open, prices can jump and spreads can widen, so a fill can be well away from the price expected. A large order may be filled in parts, at more than one price.",
    terms: ["fill", "slippage", "requote", "bid-price", "ask-rate", "spread", "gap"],
    note: [
      "GIO4X lists market execution on its ",
      { label: "account types", href: "/trading/accounts" },
      " page. Figures for fill speed, slippage and rejections are not published, so none is quoted here.",
    ],
    tool: { label: "See each order type on a price scale", href: "/tools/order-anatomy" },
  },
  {
    key: "position",
    short: "Position",
    title: "The open position",
    controls: () => [],
    body: () => [
      "The fill opens a position. Margin for it is set aside from the account’s equity: it is a deposit, not a cost, and it is released when the position is closed.",
      "From now on the position is revalued with every change in price. The result is a floating profit or loss, which moves equity but has not yet touched the balance. A new position starts with a small floating loss equal to the spread, because it was opened on one side of the quote and is valued on the other.",
      "If the position is still open at the daily rollover, a swap may be charged or credited for holding it overnight.",
    ],
    wrong:
      "Leverage makes the floating result large relative to the margin, in both directions. If losses bring equity down towards the margin in use, the account reaches its margin call level and then its stop out level, where positions begin to be closed automatically. Swap accrues for every night a position is held, and over time it can outweigh a small gain.",
    terms: ["open-position", "margin", "equity", "unrealized-p-and-l", "free-margin", "rollover", "swap", "overnight-position", "margin-call"],
    note: [
      "GIO4X’s ",
      { label: "account types", href: "/trading/accounts" },
      " say whether overnight swap applies to each account. Swap rates per instrument are not yet published, as the ",
      { label: "trading conditions", href: "/trading/conditions" },
      " page states.",
    ],
    tool: { label: "See leverage act on a position", href: "/tools/leverage-visualizer" },
  },
  {
    key: "close",
    short: "Close",
    title: "The close",
    controls: () => ["close"],
    body: (b) => [
      "A position is closed by an opposite trade of the same size: a position that was bought is closed by selling. What differs is who sends the closing order.",
      b.close === "hand"
        ? "On this branch the trader closes it by hand, with a market order that is filled at the price available at that moment."
        : b.close === "sl"
          ? "On this branch a stop loss closes it. The price reached the level the trader set on the losing side, and the stop became a market order to close, filled at the next available price. In a fast market or after a gap that price can be worse than the level."
          : b.close === "tp"
            ? "On this branch a take profit closes it. The price reached the level the trader set on the winning side. A take profit works as a limit order, so it is filled at its level or better, but only if the market actually trades there."
            : "On this branch the broker’s system closes it. Losses have brought the account’s margin level down to the stop out level, and positions begin to be closed automatically, without the trader’s instruction, at the prices then available.",
      "In every case the close is itself an order that has to be filled, so everything said about the fill applies again.",
    ],
    wrong:
      "A stop loss limits a loss in ordinary conditions but cannot fix it in advance: if the market jumps past the level, the fill is on the far side of the jump. A stop-out is not a safety net either. In a gapping market positions can be closed at prices that leave the balance below zero, and whether the client is liable for that depends on the broker’s terms and the applicable rules.",
    terms: ["stop-loss", "take-profit", "stop-order", "trailing-stop", "margin-call", "stop-out", "gap", "negative-balance"],
    note: ["GIO4X publishes its margin call and stop out levels, with the formula for margin level, on the ", { label: "trading conditions", href: "/trading/conditions" }, " page."],
    tool: { label: "Compare a stop and a target", href: "/tools/risk-reward" },
  },
  {
    key: "settlement",
    short: "Settlement",
    title: "Settlement into the balance",
    controls: () => ["result"],
    body: (b) => [
      "Closing turns the floating result into a realised one. The margin that was set aside is released, and the profit or loss is written to the balance in the account’s currency, converted if the instrument is quoted in another.",
      "Three costs sit inside that result. The spread was paid in the prices themselves, at the open and at the close. A commission, where the account charges one, appears as its own line. Swap appears for each night the position was held.",
      b.result === "profit"
        ? "On this branch the position closed in profit: the gain, less any commission and swap, is added to the balance."
        : "On this branch the position closed at a loss: the loss, together with any commission and swap, is taken from the balance.",
    ],
    wrong:
      "The price can move in the trader’s favour and the trade can still lose money once spread, commission and swap are counted. A loss also changes the arithmetic of what follows: a smaller balance has to earn a larger percentage to return to where it started.",
    terms: ["spread", "swap", "pip", "equity", "drawdown"],
    note: [
      "Which of these costs apply depends on the account. GIO4X publishes its minimum spreads, its commission and whether swap applies on the ",
      { label: "account types", href: "/trading/accounts" },
      " and ",
      { label: "trading conditions", href: "/trading/conditions" },
      " pages. Nothing on this page is a GIO4X price.",
    ],
    tool: { label: "Add up spread, commission and swap", href: "/tools/cost-lab" },
  },
];

/** Every glossary slug any stage refers to, for the page to resolve once on the server. */
export const ALL_TERMS: string[] = [...new Set(STAGES.flatMap((s) => s.terms))];

/** Choosing how the position is closed also sets the result it normally leaves. */
export function withBranch<K extends BranchKey>(b: Branches, key: K, value: Branches[K]): Branches {
  const next: Branches = { ...b, [key]: value };
  if (key === "close") {
    if (value === "tp") next.result = "profit";
    if (value === "sl" || value === "stopout") next.result = "loss";
  }
  return next;
}

/** One line for the screen-reader announcement and the caption under the scene. */
export function branchSummary(stage: Stage, b: Branches): string {
  return stage
    .controls(b)
    .map((k) => {
      const c = CONTROLS[k];
      const o = (c.options as { value: string; label: string }[]).find((x) => x.value === b[k]);
      return `${c.label}: ${o?.label ?? ""}`;
    })
    .join(". ");
}

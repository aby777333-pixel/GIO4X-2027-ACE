/**
 * TRADER TOOLKIT registry. One entry per tool; the hub, navigation, search
 * index and sitemap are generated from this list.
 */
export type ToolKind = "Calculator" | "Visualiser" | "Lab";

export type Tool = {
  slug: string;
  name: string;
  kind: ToolKind;
  /** one line for lists */
  line: string;
  /** meta description */
  description: string;
  /** the formula, shown on the page: no hidden magic */
  formula: string;
  aliases: string[];
  glossary: string[];
  next: string[];
};

export const tools: Tool[] = [
  {
    slug: "position-size",
    name: "Position Size",
    kind: "Calculator",
    line: "From the risk you accept to the size you trade.",
    description: "Work out position size from account balance, the percentage you are prepared to risk and your stop distance. The formula is shown and every input is yours.",
    formula: "lots = (balance × risk %) ÷ (stop in pips × pip value per lot)",
    aliases: ["lot size", "risk calculator", "position sizing", "trade size"],
    glossary: ["lot", "pip", "stop-loss", "risk-management"],
    next: ["pip-value", "risk-reward", "margin"],
  },
  {
    slug: "pip-value",
    name: "Pip Value",
    kind: "Calculator",
    line: "What one pip is worth in your account currency.",
    description: "Calculate the value of one pip for any major pair and position size, converted into your account currency using ECB reference rates.",
    formula: "pip value = pip size × contract size × lots, converted from the quote currency to the account currency",
    aliases: ["pip calculator", "pip", "pips", "point value"],
    glossary: ["pip", "lot", "quote-currency"],
    next: ["position-size", "profit-loss", "margin"],
  },
  {
    slug: "margin",
    name: "Margin",
    kind: "Calculator",
    line: "What a position ties up, at any leverage.",
    description: "Calculate the margin required to open a position from its notional value and leverage, and see how much of your balance it would use.",
    formula: "margin = (lots × contract size × price) ÷ leverage",
    aliases: ["margin calculator", "required margin", "leverage calculator"],
    glossary: ["margin", "leverage", "margin-call", "equity"],
    next: ["leverage-visualizer", "position-size", "cost-lab"],
  },
  {
    slug: "profit-loss",
    name: "Profit & Loss",
    kind: "Calculator",
    line: "The outcome of a trade between two prices.",
    description: "Calculate the profit or loss of a hypothetical trade from its direction, entry price, exit price and size.",
    formula: "P/L = (exit − entry) × contract size × lots, sign reversed for a sell",
    aliases: ["pnl", "p&l", "profit calculator", "profit loss"],
    glossary: ["pip", "lot", "going-long", "going-short"],
    next: ["risk-reward", "pip-value", "cost-lab"],
  },
  {
    slug: "risk-reward",
    name: "Risk / Reward",
    kind: "Calculator",
    line: "How a stop and a target relate, and the win rate that breaks even.",
    description: "Compare the distance to your stop with the distance to your target and see the win rate at which the two break even.",
    formula: "ratio = reward ÷ risk;   break-even win rate = 1 ÷ (1 + ratio)",
    aliases: ["rr", "risk reward ratio", "r multiple", "reward to risk"],
    glossary: ["risk-reward-ratio", "stop-loss", "take-profit"],
    next: ["position-size", "drawdown", "profit-loss"],
  },
  {
    slug: "drawdown",
    name: "Drawdown",
    kind: "Visualiser",
    line: "Why a loss needs a larger gain to recover.",
    description: "See the recovery mathematics of a drawdown: the gain required to return to the starting balance after a loss of any size.",
    formula: "gain required = loss ÷ (1 − loss)",
    aliases: ["drawdown calculator", "recovery", "loss recovery"],
    glossary: ["drawdown", "risk-management", "money-management"],
    next: ["position-size", "risk-reward", "compound-growth"],
  },
  {
    slug: "compound-growth",
    name: "Compound Growth",
    kind: "Calculator",
    line: "What a constant rate does over time, in both directions.",
    description: "Illustrate how a balance changes when a constant periodic rate, positive or negative, is applied repeatedly. A mathematical illustration, not a projection of returns.",
    formula: "balance after n periods = start × (1 + rate)ⁿ",
    aliases: ["compounding", "compound interest", "growth calculator"],
    glossary: ["yield", "drawdown"],
    next: ["drawdown", "risk-reward", "position-size"],
  },
  {
    slug: "currency-converter",
    name: "Currency Converter",
    kind: "Calculator",
    line: "Convert between the eight major currencies at the ECB reference rate.",
    description: "Convert an amount between USD, EUR, GBP, JPY, CHF, AUD, CAD and NZD using the European Central Bank’s daily reference rates. Reference only, not a dealing rate.",
    formula: "amount × (quote per EUR ÷ base per EUR)",
    aliases: ["converter", "exchange rate", "fx converter", "convert currency"],
    glossary: ["cross-rate", "base-currency", "quote-currency"],
    next: ["pip-value", "margin"],
  },
  {
    slug: "cost-lab",
    name: "Cost Lab",
    kind: "Lab",
    line: "Spread, commission and swap, added up in the open.",
    description: "Build the hypothetical cost of a trade from spread, commission and overnight financing with every step of the arithmetic visible. Compare how the same trade is priced on each account type.",
    formula: "cost = spread cost + commission + (swap per night × nights)",
    aliases: ["trading cost", "cost calculator", "spread cost", "commission calculator", "swap calculator"],
    glossary: ["spread", "swap", "rollover", "ecn"],
    next: ["pip-value", "position-size", "profit-loss"],
  },
  {
    slug: "leverage-visualizer",
    name: "Leverage, visualised",
    kind: "Visualiser",
    line: "Exposure and risk move together. See by how much.",
    description: "Move the leverage and watch exposure, margin and the effect of a small price move on your equity change together. Higher leverage is never presented as better.",
    formula: "exposure = equity × leverage;   equity change = exposure × price move",
    aliases: ["leverage", "leverage calculator", "exposure"],
    glossary: ["leverage", "margin", "gearing", "margin-call"],
    next: ["margin", "drawdown", "position-size"],
  },
  {
    slug: "spread-visualizer",
    name: "Spread, visualised",
    kind: "Visualiser",
    line: "Bid, ask and the distance between them.",
    description: "An animated explanation of bid, ask and spread: what you pay to enter a position and how far the price must move before a trade breaks even.",
    formula: "spread = ask − bid;   cost = spread × pip value × lots",
    aliases: ["spread", "bid ask", "bid and ask"],
    glossary: ["spread", "bid-price", "ask-rate", "pip"],
    next: ["cost-lab", "pip-value", "order-anatomy"],
  },
  {
    slug: "order-anatomy",
    name: "Order Anatomy",
    kind: "Visualiser",
    line: "Market, limit and stop orders, and what each one actually does.",
    description: "An interactive diagram of the main order types: market, limit, stop, stop loss and take profit. It shows where each rests relative to the price and when it triggers, including why execution is not guaranteed at the requested price.",
    formula: "A limit order fills at your price or better. A stop order becomes a market order when triggered.",
    aliases: ["order types", "limit order", "stop order", "stop loss", "take profit", "slippage"],
    glossary: ["market-order", "limit-order", "stop-order", "stop-loss", "take-profit", "slippage"],
    next: ["spread-visualizer", "risk-reward", "position-size"],
  },
];

export const getTool = (slug: string) => tools.find((t) => t.slug === slug);

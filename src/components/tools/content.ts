/**
 * Editorial content for the toolkit: how the hub groups the tools, the
 * plain-language explanation under each tool and one contextual onward link.
 * Tool names, lines, formulae and "next" come from src/data/tools.ts.
 */

export type ToolGroup = { key: string; title: string; question: string; note: string; slugs: string[] };

export const toolGroups: ToolGroup[] = [
  {
    key: "size",
    title: "Size the trade",
    question: "How large, and what does that commit?",
    note: "Start from the loss you are prepared to accept and work back to a size, then see what that size ties up and what each pip of it is worth.",
    slugs: ["position-size", "risk-reward", "margin", "pip-value"],
  },
  {
    key: "cost",
    title: "Cost the trade",
    question: "What does it cost, and what would it return?",
    note: "Spread, commission and overnight financing added up line by line, the outcome between any two prices, and conversion at a published reference rate.",
    slugs: ["cost-lab", "profit-loss", "currency-converter"],
  },
  {
    key: "mechanics",
    title: "Understand the mechanics",
    question: "Why does it behave like that?",
    note: "Five drawings of things that are easier to see than to read: what leverage multiplies, what a spread takes, what each order does, and why losses are harder to undo than to make.",
    slugs: ["leverage-visualizer", "spread-visualizer", "order-anatomy", "drawdown", "compound-growth"],
  },
];

export type ToolContent = {
  heading: string;
  paragraphs: string[];
  context: { label: string; href: string; note: string; kind: string };
};

export const toolContent: Record<string, ToolContent> = {
  "position-size": {
    heading: "Size follows from risk, not the other way round.",
    paragraphs: [
      "Most sizing mistakes come from choosing a number of lots first and discovering the risk afterwards. This calculator runs in the opposite direction. You state how much of the balance you are prepared to lose on one trade and how far away the stop is; the size is whatever makes those two statements true together.",
      "A wider stop does not mean more risk if the size shrinks to match, and a tight stop does not mean less if the size grows. The amount at risk is the one figure that stays fixed, which is why it is drawn as a share of the balance.",
      "The result assumes the stop is filled at its level. In a gap it may not be, so the amount shown is the planned loss rather than the largest possible one.",
    ],
    context: { label: "Stop loss", href: "/glossary/stop-loss", note: "What a stop is, and what it cannot promise.", kind: "Glossary" },
  },
  "pip-value": {
    heading: "A pip is a distance. Its value depends on what you hold.",
    paragraphs: [
      "A pip is the standard unit in which a currency pair’s price is counted: the fourth decimal place for most pairs, the second for pairs quoted in yen. On its own it is only a distance. It becomes money when it is multiplied by the size of the position.",
      "That money is always in the quote currency, the second one in the pair. If your account is held in something else, it has to be converted, and this page does that at the European Central Bank’s daily reference rate so that the step is visible. A platform makes the same conversion continuously at its own rate, so the value of a pip on a cross pair drifts slightly as rates move.",
    ],
    context: { label: "Forex", href: "/markets/forex", note: "How currency pairs are quoted and traded.", kind: "Markets" },
  },
  margin: {
    heading: "Margin is a deposit against the position, not its price and not its risk.",
    paragraphs: [
      "To open a leveraged position you set aside a fraction of its full value. That fraction is the margin, and leverage is simply the ratio between the two: at 1:100 the margin is one hundredth of the position’s notional value.",
      "Margin is returned when the position is closed, so it is not a cost. Nor is it the most you can lose: profit and loss are calculated on the full notional value, and a loss is taken from the rest of your equity first and then from the margin itself.",
      "The margin level compares your equity with the margin in use. GIO4X publishes a margin call at 100% and a stop out at 30% for its account types; the reference lines show how much equity is left at each.",
    ],
    context: { label: "Trading conditions", href: "/trading/conditions", note: "Published leverage, margin call and stop out levels.", kind: "Trading" },
  },
  "profit-loss": {
    heading: "The outcome is the price difference multiplied by the size.",
    paragraphs: [
      "Every profit and loss calculation reduces to the same three things: how far the price travelled between entry and exit, how many units the position represented, and which way round you were. A buy gains when the exit is above the entry; a sell gains when it is below.",
      "The result is first expressed in the quote currency and then converted to the currency of the account. The spread is not a separate deduction here because it is already inside the two prices: a buy opens at the ask and closes at the bid.",
    ],
    context: { label: "Market Command", href: "/markets", note: "The instruments, their contracts and their hours.", kind: "Markets" },
  },
  "risk-reward": {
    heading: "A ratio and a win rate are two halves of one sentence.",
    paragraphs: [
      "The risk to reward ratio compares the distance to your stop with the distance to your target. On its own it tells you very little. Its meaning comes from the win rate that goes with it: the share of trades that must reach the target for the set as a whole to break even.",
      "The two pull against each other. A distant target improves the ratio but is reached less often; a near target is reached more often and pays less. The table shows only the arithmetic of that trade-off. It cannot tell you how often a particular target will be reached, and no ratio is better than another in itself.",
    ],
    context: { label: "Order Anatomy", href: "/tools/order-anatomy", note: "Where a stop and a target actually rest, and when they trigger.", kind: "Visualiser" },
  },
  drawdown: {
    heading: "Losses and gains are measured on different amounts.",
    paragraphs: [
      "Lose half of an account and what remains must double to get back to where it started. Nothing unusual has happened: the loss was half of the larger figure, and the recovery has to be earned on the smaller one.",
      "For small losses the difference is slight, which is why it is easy to overlook. It grows quickly. The curve leaves the dashed line of “a gain equal to the loss” almost at once and, past the half-way point, climbs steeply away from it.",
      "This is the arithmetic reason position sizing matters more than any single trade: the cost of a large drawdown is not the loss itself but the size of the task it leaves behind.",
    ],
    context: { label: "Risk disclosure", href: "/legal/risk", note: "The risks of leveraged trading, in readable type.", kind: "Legal" },
  },
  "compound-growth": {
    heading: "The same rule, applied again and again, bends a straight line.",
    paragraphs: [
      "Compounding means each period’s rate is applied to the balance as it then stands, including whatever was gained or lost before. A constant positive rate therefore produces a curve that steepens; a constant negative rate produces one that falls quickly at first and then flattens as there is less left to lose.",
      "This page draws both, always, because the mathematics has no preference between them. It is an illustration of a formula. Trading results do not arrive as a constant rate, and nothing here is a projection of what an account will do.",
    ],
    context: { label: "Data methodology", href: "/trust/data-methodology", note: "What “simulation” and “reference” mean on this site.", kind: "Trust" },
  },
  "currency-converter": {
    heading: "One published rate a day, and everything else derived from it.",
    paragraphs: [
      "Each working day the European Central Bank publishes a reference rate for the euro against a list of currencies. A rate between two non-euro currencies, such as sterling against the yen, is obtained by dividing one euro rate by the other. That is all a cross rate is.",
      "A reference rate is a statement of where the market was at a fixed moment, published for information and accounting. It is not an offer to deal. The rate you receive from a bank, a card or a broker will differ from it and will include that provider’s own margin.",
    ],
    context: { label: "Currency strength", href: "/markets/currency-strength", note: "How the eight majors have moved against one another in reference rates.", kind: "Markets" },
  },
  "cost-lab": {
    heading: "Three costs, each charged in a different way.",
    paragraphs: [
      "The spread is the gap between the buying and the selling price. It is paid once, through the price, at the moment a position is opened. Commission is a separate, explicit charge per lot on accounts that offer raw spreads. Swap is the financing applied for each night a position stays open, and it can be a charge or a credit.",
      "Which account is cheaper for a given trade depends on its size, how long it is held and, above all, on the spread actually quoted at the time. The published “spread from” figures are minimums. The comparison is therefore a floor for each account, not a prediction of what you would pay.",
      "The useful habit is the last line of the working: turning the total into the number of pips the price must move in your favour before the trade has earned anything at all.",
    ],
    context: { label: "Account types", href: "/trading/accounts", note: "Classic, Premium and ECN, compared plainly.", kind: "Trading" },
  },
  "leverage-visualizer": {
    heading: "Leverage changes the size of the consequence, not the odds.",
    paragraphs: [
      "Leverage lets a given amount of equity carry a larger position. The market does not know or care: the price moves exactly as it would have. What changes is how much of your equity each movement is worth.",
      "The clearest way to read any leverage figure is to turn it upside down. One divided by the leverage is the adverse price move that would consume all of the equity behind a fully used position: one per cent at 1:100, a fifth of one per cent at 1:500. A fifth of one per cent is a small move for any market.",
      "The same multiplication applies to gains, and the page shows it, but it is the distance to the loss of the whole equity that shortens as the slider moves to the right.",
    ],
    context: { label: "Risk disclosure", href: "/legal/risk", note: "The risks of leveraged trading, in readable type.", kind: "Legal" },
  },
  "spread-visualizer": {
    heading: "You buy at one price and are valued at another.",
    paragraphs: [
      "Every instrument has two prices at any moment: the ask, at which you can buy, and the bid, at which you can sell. The ask is the higher of the two, and the distance between them is the spread.",
      "When you buy, you pay the ask, but the position is worth what you could sell it for, which is the bid. So a new position starts with a small loss equal to the spread, and the price has to move in your favour by that much before the trade is back to nothing. For a sell the same thing happens in mirror image.",
    ],
    context: { label: "Trading conditions", href: "/trading/conditions", note: "Indicative spreads by instrument, as published.", kind: "Trading" },
  },
  "order-anatomy": {
    heading: "An order is an instruction with a condition attached.",
    paragraphs: [
      "A market order has no condition: trade now, at the price available. A limit order adds a price condition in your favour: trade only at this price or better. A stop order adds a trigger: once the price reaches this level, send a market order.",
      "The difference between the last two is the one that matters. A limit controls the price and gives up certainty of being filled. A stop does the reverse: once triggered it is sent to be filled at whatever the next price happens to be. Stop loss and take profit are the same two instructions attached to a position that is already open: a stop loss is a stop order, a take profit is a limit order.",
      "This is why a stop loss limits a loss in ordinary conditions but cannot fix it in advance. If the market jumps over the level, the order is filled on the far side of the jump.",
    ],
    context: { label: "Compare platforms", href: "/platforms/compare", note: "Where these orders are placed: 777 Raptor and MetaTrader 5.", kind: "Platforms" },
  },
};

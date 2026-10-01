import carried from "./generated/glossary.json";

/**
 * GIO4X Financial Glossary.
 *
 * 139 definitions are carried over from the previous site
 * (generated/glossary.json, produced by scripts/import-glossary). The terms
 * below are additions written for this build, mostly concepts the rest of the
 * site links to. `enrich` adds the relationships that make the glossary a
 * graph rather than an alphabetical list.
 */
export type GlossaryTopic = "Forex" | "Orders" | "Risk" | "Technical analysis" | "Macro & economics" | "Instruments" | "Accounts & platforms" | "Trading";

export type Term = {
  slug: string;
  term: string;
  definition: string;
  letter: string;
  topic: GlossaryTopic;
  /** a short worked example, where one helps */
  example?: string;
  /** formula, where one applies */
  formula?: string;
  related?: string[];
  tools?: string[];
  aliases?: string[];
};

const added: Term[] = [
  { slug: "real-yields", term: "Real Yields", topic: "Macro & economics", letter: "R", definition: "The return on a bond after subtracting expected inflation. Real yields are commonly watched alongside gold, which pays no interest: when the inflation-adjusted return on bonds rises, the opportunity cost of holding gold rises with it.", formula: "real yield ≈ nominal yield − expected inflation", related: ["yield", "inflation", "xau-usd"] },
  { slug: "safe-haven", term: "Safe Haven", topic: "Macro & economics", letter: "S", definition: "An asset that investors have historically moved towards in periods of market stress, such as gold, the Swiss franc, the Japanese yen or US Treasury securities. The description refers to past behaviour and is not a guarantee of how an asset will behave.", related: ["hedging", "volatility", "xau-usd"] },
  { slug: "monetary-policy", term: "Monetary Policy", topic: "Macro & economics", letter: "M", definition: "The actions a central bank takes to influence the cost and availability of money, chiefly by setting a policy interest rate and by buying or selling assets. Its stance is described as tightening when it raises rates or withdraws liquidity and as easing when it does the opposite.", related: ["central-bank", "hawkish", "dovish", "quantitative-easing"] },
  { slug: "recession", term: "Recession", topic: "Macro & economics", letter: "R", definition: "A significant, widespread decline in economic activity lasting more than a few months. A common rule of thumb is two consecutive quarters of falling real GDP, although official definitions vary by country.", related: ["gdp", "inflation"] },
  { slug: "dividend", term: "Dividend", topic: "Instruments", letter: "D", definition: "A distribution of a company’s profits to its shareholders. Holders of share CFDs do not own the shares, so a dividend is reflected instead as a cash adjustment: credited to long positions and debited from short positions on the ex-dividend date.", related: ["cfd", "equity"] },
  { slug: "index", term: "Index", topic: "Instruments", letter: "I", definition: "A measure of the performance of a basket of securities, such as the S&P 500 or the FTSE 100. An index cannot be bought directly; exposure is taken through products that track it, such as futures or CFDs.", related: ["cfd", "volatility"] },
  { slug: "notional-value", term: "Notional Value", topic: "Risk", letter: "N", definition: "The full market value of a leveraged position, as opposed to the margin posted to open it. Profit and loss are calculated on the notional value.", formula: "notional = lots × contract size × price", example: "One standard lot of EUR/USD at 1.1000 has a notional value of 110,000 US dollars.", related: ["margin", "leverage", "lot"], tools: ["margin", "leverage-visualizer"] },
  { slug: "stop-out", term: "Stop Out", topic: "Risk", letter: "S", definition: "The margin level at which a broker begins closing open positions automatically because equity no longer covers the required margin. It follows the margin call level and exists to limit further losses on the account.", formula: "margin level = equity ÷ used margin × 100%", related: ["margin-call", "margin", "equity"], tools: ["margin"] },
  { slug: "free-margin", term: "Free Margin", topic: "Risk", letter: "F", definition: "The equity in an account that is not tied up as margin for open positions and is therefore available to open new positions or absorb losses.", formula: "free margin = equity − used margin", related: ["margin", "equity", "stop-out"], tools: ["margin"] },
  { slug: "contract-size", term: "Contract Size", topic: "Forex", letter: "C", definition: "The quantity of the underlying represented by one lot of an instrument. In foreign exchange one standard lot is 100,000 units of the base currency; for gold it is commonly 100 troy ounces.", related: ["lot", "notional-value", "pip"], tools: ["pip-value", "margin"] },
  { slug: "reference-rate", term: "Reference Rate", topic: "Forex", letter: "R", definition: "An exchange rate published by an official body at a fixed time for information and accounting purposes, such as the European Central Bank’s daily euro reference rates. A reference rate is not a price at which anyone is obliged to deal.", related: ["spot-market", "cross-rate"], tools: ["currency-converter"] },
  { slug: "requote", term: "Requote", topic: "Orders", letter: "R", definition: "A notification that the price requested for an order is no longer available, offering a new price that the trader may accept or decline. Requotes occur under instant execution; under market execution the order is filled at the available price instead, which may differ from the price requested.", related: ["slippage", "market-order", "fill"], tools: ["order-anatomy"] },
  { slug: "liquidity-provider", term: "Liquidity Provider", topic: "Accounts & platforms", letter: "L", definition: "An institution, typically a bank or a non-bank market maker, that quotes prices at which it is prepared to buy and sell, supplying the liquidity that brokers pass on to clients.", related: ["liquidity", "ecn", "market-maker", "interbank-market"] },
  { slug: "negative-balance", term: "Negative Balance", topic: "Risk", letter: "N", definition: "An account balance below zero, which can arise when a market gaps through the stop out level faster than positions can be closed. Whether a client is liable for a negative balance depends on the broker’s terms and the applicable rules.", related: ["stop-out", "gap", "slippage"] },
];

/** Relationships and cleaner search aliases for carried-over terms. */
const enrich: Record<string, Partial<Term>> = {
  pip: { example: "If EUR/USD moves from 1.1000 to 1.1001 it has moved one pip. On one standard lot, one pip is worth 10 US dollars.", formula: "pip value = pip size × contract size × lots", related: ["lot", "spread", "contract-size"], tools: ["pip-value", "position-size"] },
  spread: { example: "With a bid of 1.1000 and an ask of 1.1002, the spread is 2 pips.", formula: "spread = ask − bid", related: ["bid-price", "ask-rate", "pip", "variable-spread"], tools: ["spread-visualizer", "cost-lab"] },
  leverage: { example: "At 1:100, a margin of 1,000 controls a position with a notional value of 100,000.", formula: "leverage = notional value ÷ margin", related: ["margin", "gearing", "notional-value", "margin-call"], tools: ["leverage-visualizer", "margin"] },
  margin: { formula: "margin = notional value ÷ leverage", related: ["leverage", "free-margin", "margin-call", "stop-out"], tools: ["margin", "leverage-visualizer"] },
  "margin-call": { related: ["margin", "stop-out", "equity", "free-margin"], tools: ["margin"] },
  lot: { related: ["contract-size", "pip", "notional-value"], tools: ["position-size", "pip-value"] },
  swap: { related: ["rollover", "carry-trade", "interest-rate-differential"], tools: ["cost-lab"] },
  rollover: { related: ["swap", "overnight-position"], tools: ["cost-lab"] },
  slippage: { related: ["market-order", "fill", "gap", "requote", "liquidity"], tools: ["order-anatomy"] },
  drawdown: { formula: "gain required to recover = loss ÷ (1 − loss)", related: ["risk-management", "money-management"], tools: ["drawdown", "position-size"] },
  "stop-loss": { related: ["stop-order", "take-profit", "trailing-stop", "slippage"], tools: ["order-anatomy", "position-size"] },
  "take-profit": { related: ["limit-order", "stop-loss", "risk-reward-ratio"], tools: ["order-anatomy", "risk-reward"] },
  "limit-order": { related: ["market-order", "stop-order", "pending-order"], tools: ["order-anatomy"] },
  "market-order": { related: ["limit-order", "slippage", "fill"], tools: ["order-anatomy"] },
  "stop-order": { related: ["stop-loss", "limit-order", "pending-order"], tools: ["order-anatomy"] },
  "risk-reward-ratio": { formula: "ratio = potential reward ÷ potential risk", related: ["stop-loss", "take-profit", "risk-management"], tools: ["risk-reward"] },
  volatility: { related: ["atr", "vix", "bollinger-bands", "liquidity"] },
  correlation: { related: ["hedging", "cross-rate"] },
  cfd: { related: ["leverage", "margin", "index", "dividend"], aliases: ["contract for difference", "cfds"] },
  ecn: { related: ["liquidity-provider", "non-dealing-desk", "market-maker", "spread"], aliases: ["electronic communication network"] },
  "carry-trade": { related: ["swap", "interest-rate-differential", "rollover"] },
  inflation: { related: ["deflation", "real-yields", "monetary-policy", "central-bank"] },
  "central-bank": { related: ["monetary-policy", "fomc", "hawkish", "dovish"] },
  hedging: { related: ["correlation", "safe-haven"] },
  liquidity: { related: ["liquidity-provider", "spread", "slippage", "interbank-market"] },
  "cross-rate": { related: ["major-pairs", "minor-pairs", "currency-pair"], tools: ["currency-converter"] },
  "base-currency": { related: ["quote-currency", "currency-pair"] },
  "quote-currency": { related: ["base-currency", "currency-pair", "pip"], tools: ["pip-value"] },
  gdp: { aliases: ["gross domestic product"], related: ["recession", "inflation"] },
  nfp: { aliases: ["non-farm payrolls", "nonfarm payrolls", "payrolls"], related: ["fomc", "volatility"] },
  atr: { aliases: ["average true range"], related: ["volatility"] },
  rsi: { aliases: ["relative strength index"], related: ["overbought", "oversold", "momentum"] },
  ema: { aliases: ["exponential moving average"], related: ["moving-average", "macd"] },
  "expert-advisor": { aliases: ["ea", "trading robot", "robot"], related: ["metatrader", "vps"] },
  vps: { aliases: ["virtual private server"], related: ["expert-advisor"] },
  "xau-usd": { aliases: ["gold"], related: ["safe-haven", "real-yields"] },
  equity: { related: ["margin", "free-margin", "unrealized-p-and-l"] },
  gearing: { related: ["leverage"] },
  "bid-price": { related: ["ask-rate", "spread"], tools: ["spread-visualizer"] },
  "ask-rate": { related: ["bid-price", "spread"], tools: ["spread-visualizer"] },
  yield: { related: ["real-yields", "interest-rate-differential"] },
};

export const glossary: Term[] = [...(carried as Term[]), ...added]
  .map((t) => ({ ...t, ...(enrich[t.slug] ?? {}) }))
  .sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" }));

const bySlug = new Map(glossary.map((t) => [t.slug, t]));
export const getTerm = (slug: string) => bySlug.get(slug);
export const hasTerm = (slug: string) => bySlug.has(slug);

export const glossaryTopics: GlossaryTopic[] = ["Forex", "Orders", "Risk", "Technical analysis", "Macro & economics", "Instruments", "Accounts & platforms", "Trading"];
export const glossaryLetters = [...new Set(glossary.map((t) => t.letter))].sort();

/** Related terms that actually exist, in declared order, then same-topic neighbours. */
export function relatedTerms(t: Term, n = 6): Term[] {
  const out: Term[] = [];
  for (const s of t.related ?? []) {
    const r = bySlug.get(s);
    if (r && r.slug !== t.slug) out.push(r);
  }
  if (out.length < n) {
    for (const o of glossary) {
      if (out.length >= n) break;
      if (o.slug !== t.slug && o.topic === t.topic && !out.includes(o)) out.push(o);
    }
  }
  return out.slice(0, n);
}

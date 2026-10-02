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

/**
 * Relationships and cleaner search aliases for carried-over terms, and
 * corrections to carried definitions: a `definition` or `topic` here replaces
 * the carried one (generated/glossary.json is never edited by hand). Each
 * corrected definition agrees with the term's lesson in glossary-learn.
 */
const enrich: Record<string, Partial<Term>> = {
  pip: { example: "If EUR/USD moves from 1.1000 to 1.1001 it has moved one pip. On one standard lot, one pip is worth 10 US dollars.", formula: "pip value = pip size × contract size × lots", related: ["lot", "spread", "contract-size"], tools: ["pip-value", "position-size"] },
  spread: { example: "With a bid of 1.1000 and an ask of 1.1002, the spread is 2 pips.", formula: "spread = ask − bid", related: ["bid-price", "ask-rate", "pip", "variable-spread"], tools: ["spread-visualizer", "cost-lab"] },
  leverage: { example: "At 1:100, a margin of 1,000 controls a position with a notional value of 100,000.", formula: "leverage = notional value ÷ margin", related: ["margin", "gearing", "notional-value", "margin-call"], tools: ["leverage-visualizer", "margin"] },
  margin: { definition: "The collateral required to open and maintain a leveraged position, expressed as a percentage of the full trade value. Margin is not a cost: it is a portion of your equity set aside as a deposit.", formula: "margin = notional value ÷ leverage", related: ["leverage", "free-margin", "margin-call", "stop-out"], tools: ["margin", "leverage-visualizer"] },
  "margin-call": { related: ["margin", "stop-out", "equity", "free-margin"], tools: ["margin"] },
  lot: { related: ["contract-size", "pip", "notional-value"], tools: ["position-size", "pip-value"] },
  swap: { related: ["rollover", "carry-trade", "interest-rate-differential"], tools: ["cost-lab"] },
  rollover: { related: ["swap", "overnight-position"], tools: ["cost-lab"] },
  slippage: { related: ["market-order", "fill", "gap", "requote", "liquidity"], tools: ["order-anatomy"] },
  drawdown: { formula: "gain required to recover = loss ÷ (1 − loss)", related: ["risk-management", "money-management"], tools: ["drawdown", "position-size"] },
  "stop-loss": { definition: "An order attached to a position to close it if the price moves against the trader to a specified level. Once the level is reached it becomes an order to close at the best price available, which can be worse than the level set in a fast market or after a gap.", related: ["stop-order", "take-profit", "trailing-stop", "slippage"], tools: ["order-anatomy", "position-size"] },
  "take-profit": { definition: "An order attached to a position to close it when the price reaches a specified level in the trader’s favour. It works as a limit order, so it fills at the chosen price or better, but only if the market actually trades there.", related: ["limit-order", "stop-loss", "risk-reward-ratio"], tools: ["order-anatomy", "risk-reward"] },
  "limit-order": { related: ["market-order", "stop-order", "pending-order"], tools: ["order-anatomy"] },
  "market-order": { definition: "An order to buy or sell a currency pair immediately at the best price currently available. Execution is likely but not assured, and the price is not fixed in advance: the fill can differ from the price shown when the order was sent.", related: ["limit-order", "slippage", "fill"], tools: ["order-anatomy"] },
  "stop-order": { definition: "An order that becomes a market order once the price reaches a specified level: a buy stop is placed above the current price and a sell stop below it. Once triggered it is filled at the best price then available, which can differ from the level set, especially in a fast market or after a gap.", related: ["stop-loss", "limit-order", "pending-order"], tools: ["order-anatomy"] },
  "risk-reward-ratio": { definition: "The ratio between the potential loss and the potential gain on a trade: a ratio of 1:3 means the planned gain is three times the planned loss. A ratio means something only alongside how often trades of that kind win, since a more distant target is reached less often.", formula: "ratio = potential reward ÷ potential risk", related: ["stop-loss", "take-profit", "risk-management"], tools: ["risk-reward"] },
  volatility: { definition: "The degree of price variation over time: the size of price movements, not their direction. High volatility means large and rapid price swings; low volatility means smaller ones, which does not make them more predictable.", related: ["atr", "vix", "bollinger-bands", "liquidity"] },
  correlation: { related: ["hedging", "cross-rate"] },
  cfd: { related: ["leverage", "margin", "index", "dividend"], aliases: ["contract for difference", "cfds"] },
  ecn: { definition: "A system that collects prices from many participants, such as banks and other trading firms, and matches orders against the best prices available. A broker using an ECN model passes client orders into that pool instead of filling them from its own book; the spread varies with market conditions and a commission is usually charged.", related: ["liquidity-provider", "non-dealing-desk", "market-maker", "spread"], aliases: ["electronic communication network"] },
  "carry-trade": { definition: "A strategy in which a trader borrows a currency with a low interest rate to buy a currency with a higher interest rate, in order to collect the interest rate differential. A move in the exchange rate can outweigh the interest, and carry trades have historically unwound quickly in periods of market stress.", related: ["swap", "interest-rate-differential", "rollover"] },
  inflation: { related: ["deflation", "real-yields", "monetary-policy", "central-bank"] },
  "central-bank": { definition: "A national institution responsible for monetary policy, interest rate decisions, and currency stability. Major central banks, such as the Fed, ECB, and BoJ, heavily influence forex markets through their policy decisions.", related: ["monetary-policy", "fomc", "hawkish", "dovish"] },
  hedging: { related: ["correlation", "safe-haven"] },
  liquidity: { related: ["liquidity-provider", "spread", "slippage", "interbank-market"] },
  "cross-rate": { definition: "An exchange rate between two currencies that does not include the US dollar, such as EUR/GBP or AUD/JPY. Cross rates are derived from each currency’s rate against the USD.", related: ["major-pairs", "minor-pairs", "currency-pair"], tools: ["currency-converter"] },
  "base-currency": { related: ["quote-currency", "currency-pair"] },
  "quote-currency": { related: ["base-currency", "currency-pair", "pip"], tools: ["pip-value"] },
  gdp: { aliases: ["gross domestic product"], related: ["recession", "inflation"] },
  nfp: { definition: "A key US economic indicator, published by the Bureau of Labor Statistics usually on the first Friday of each month, that measures the change in the number of jobs excluding farm work and a few other categories. NFP releases are often accompanied by sharp moves in forex markets.", aliases: ["non-farm payrolls", "nonfarm payrolls", "payrolls"], related: ["fomc", "volatility"] },
  atr: { topic: "Technical analysis", definition: "A volatility indicator that averages the true range over a set number of periods, commonly 14. The true range of a period is the distance from its high to its low, widened to include any jump from the previous close; ATR measures how much a price moves, not in which direction.", aliases: ["average true range"], related: ["volatility"] },
  rsi: { aliases: ["relative strength index"], related: ["overbought", "oversold", "momentum"] },
  ema: { aliases: ["exponential moving average"], related: ["moving-average", "macd"] },
  "expert-advisor": { aliases: ["ea", "trading robot", "robot"], related: ["metatrader", "vps"] },
  vps: { aliases: ["virtual private server"], related: ["expert-advisor"] },
  "xau-usd": { aliases: ["gold"], related: ["safe-haven", "real-yields"] },
  equity: { related: ["margin", "free-margin", "unrealized-p-and-l"] },
  gearing: { definition: "Another term for leverage: the size of the position a trader controls relative to the capital behind it. Higher gearing means greater exposure relative to the margin deposited.", related: ["leverage"] },
  "bid-price": { related: ["ask-rate", "spread"], tools: ["spread-visualizer"] },
  "ask-rate": { related: ["bid-price", "spread"], tools: ["spread-visualizer"] },
  yield: { related: ["real-yields", "interest-rate-differential"] },

  // Corrections of fact
  momentum: { definition: "The rate of change of a price: how far it has moved over a chosen number of periods. Indicators such as RSI and MACD are ways of measuring it; fading momentum shows that a move is slowing, which is not the same as a reversal." },
  "fibonacci-retracement": { definition: "A technical analysis tool that draws horizontal lines across a price move at fixed fractions of its height, most often 23.6%, 38.2%, 50% and 61.8%, which chart users watch as levels where a pullback might pause. The 50% level is drawn by convention and is not a Fibonacci ratio, and prices frequently pass straight through any of the levels." },
  fomc: { definition: "The Federal Open Market Committee: the committee of the US Federal Reserve that decides monetary policy, chiefly by setting a target range for the federal funds rate. Its scheduled meetings and statements are closely watched in currency markets." },
  "balance-of-payments": { definition: "A record of all economic transactions between a country’s residents and the rest of the world over a given period. The accounts balance overall, so a deficit or surplus belongs to one part of them, usually the current account, and a persistent one is among the things analysts weigh when they assess a currency." },
  "knock-in-option": { definition: "A type of barrier option that comes into force only if the underlying price reaches a specified level, the barrier, during the option’s life. Until the barrier is reached the option cannot be exercised, although it still has a market price that reflects the chance of activation." },
  "knock-out-option": { definition: "A type of barrier option that ceases to exist if the underlying price reaches a specified level, the barrier, during the option’s life. In the standard form the option stays cancelled whatever the price does afterwards; some contracts pay a rebate when this happens." },
  "overnight-position": { topic: "Trading", definition: "A trade that remains open past the end of the trading day, conventionally 5 pm New York time in foreign exchange. Overnight positions incur swap charges or credits based on the interest rate differential between the two currencies." },
  forex: { definition: "The foreign exchange market, in which one currency is exchanged for another. It is the largest financial market in the world by turnover, which the Bank for International Settlements measures in a survey every three years, and it trades 24 hours a day, five days a week." },
  turnover: { definition: "The total value traded in a market over a given period. Foreign exchange is the largest financial market by this measure; the Bank for International Settlements publishes a survey of its turnover every three years." },
  usd: { definition: "United States dollar: the world’s primary reserve currency and the most traded currency in the forex market. The USD is on one side of most forex transactions." },

  // Rewritten as description: what it is, how it is traditionally read, and that the reading can fail
  divergence: { definition: "A situation in which the price of a currency pair and a technical indicator calculated from it, such as RSI or MACD, move in different directions: for example, the price makes a higher high while the indicator makes a lower one. Technical analysts traditionally read it as a sign that a trend is losing strength, but a trend can continue for a long time while divergence persists." },
  "bollinger-bands": { definition: "A technical analysis indicator consisting of a moving average with a band above and below it, each set a number of standard deviations away, commonly two. The bands widen when the market is volatile and narrow when it is quiet, and show whether a price is high or low relative to its own recent behaviour, not where it goes next." },
  dovish: { definition: "A term describing a central bank stance that favours lower interest rates and looser monetary policy to support economic growth. A currency has historically tended to weaken when its central bank sounds more dovish than expected, although the reaction depends on what was already expected." },
  hawkish: { definition: "A term describing a central bank stance that favours higher interest rates and tighter monetary policy to control inflation. A currency has historically tended to strengthen when its central bank sounds more hawkish than expected, although the reaction depends on what was already expected." },
  "risk-management": { definition: "The process of identifying, assessing and controlling potential trading losses through position sizing, stop losses and diversification, and by limiting the loss planned on any one trade. A commonly quoted convention puts that limit at 1% to 2% of account equity; these measures limit planned losses and do not remove risk." },
  breakout: { definition: "A price movement through an identified level of support or resistance, sometimes accompanied by increased volume and volatility. Chart readers take it as a sign that the balance between buyers and sellers at that level has changed, but many breakouts fail: the price returns inside the range soon after, which is called a false breakout." },
  "golden-cross": { topic: "Technical analysis", definition: "The point at which a shorter-term moving average (for example the 50-period) crosses above a longer-term one (for example the 200-period). Chart readers traditionally describe it as a bullish sign, but both averages are built from past prices, so the cross appears after a rise has already happened and can be followed by a fall." },
  "head-and-shoulders": { definition: "A chart pattern consisting of three peaks: a higher middle peak (the head) flanked by two lower peaks (the shoulders). It is traditionally read as a sign that a rising trend may be losing strength; like every chart pattern it is a matter of interpretation and often fails." },
  macd: { definition: "Moving average convergence divergence: a momentum indicator that plots the distance between two exponential moving averages of a price, a faster and a slower one, alongside a smoothed signal line. Because it is built from averages of past prices it turns after the price has turned, and its crossings can be followed by a move in either direction." },
  overbought: { definition: "A label for a market whose price has risen quickly and far by the measure of an indicator; an RSI reading above 70 is conventionally called overbought. It describes recent movement and does not mean that a fall is due: in a strong trend an indicator can stay overbought for a long time." },
  oversold: { definition: "A label for a market whose price has fallen quickly and far by the measure of an indicator; an RSI reading below 30 is conventionally called oversold. It describes recent movement and does not mean that a rise is due: in a persistent downtrend an indicator can stay oversold for a long time." },
  indicator: { definition: "A mathematical calculation applied to past market data, such as price, volume or open interest, and drawn on or under a chart to describe trend, speed or the size of price swings. An indicator rearranges information already in the data and changes only after the price has changed; common examples include RSI, MACD, Bollinger Bands and moving averages." },
  "technical-analysis": { definition: "The study of a market’s historical prices, through charts, patterns and indicators, to describe how it has been behaving. It rests on the view that relevant information is already reflected in the price; its tools are calculated from past prices, and every pattern has cases where the expected outcome did not follow." },
  "quantitative-easing": { definition: "A monetary policy tool in which a central bank purchases government bonds or other financial assets with newly created money, which tends to lower yields. Its effect on the currency does not run in a fixed direction: it also depends on what other central banks are doing and on what the market already expected." },
  pullback: { definition: "A temporary move against the direction of a prevailing trend. Whether a move was a pullback or the start of a reversal is known only afterwards, because the two look the same while they are happening." },
  "wedge-pattern": { definition: "A chart pattern formed by two converging trend lines that both slope in the same direction. A rising wedge is traditionally read as a warning of a possible turn down and a falling wedge of a possible turn up; these readings are conventions and often fail." },
  "triangle-pattern": { definition: "A chart pattern formed by converging trend lines as price swings grow smaller, in ascending, descending and symmetrical forms. Ascending and descending triangles are traditionally read as leaning upward and downward respectively, but any triangle can break either way and breakouts sometimes fail." },
  uptick: { definition: "A trade or quote at a price higher than the one before it; the opposite of a downtick. A single uptick says almost nothing about direction: a falling market contains many upticks." },
  range: { definition: "A period in which the price moves back and forth between an area of support and an area of resistance without establishing a clear trend. A range ends when the price leaves it, known as a breakout, although some breakouts quickly fail and the price returns inside." },
  "non-dealing-desk": { definition: "A model in which a broker passes client orders to outside liquidity providers and has them filled at those providers’ prices, instead of taking the other side itself. An NDD broker typically earns a commission or a markup on the spread; the label is used loosely in the industry." },
  arbitrage: { definition: "The simultaneous purchase and sale of the same asset in different markets to capture a small difference in price. Such differences tend to be small and short-lived and can be smaller than the cost of dealing, and brokers’ terms often restrict strategies that rely on price differences between brokers." },

  // Misfiled topics
  "fundamental-analysis": { topic: "Macro & economics", definition: "The study of economic indicators (GDP, inflation, employment), central bank policy, interest rates and geopolitical events to judge what a currency is worth. It describes the forces behind a price and does not say when a price will move." },
  metatrader: { topic: "Accounts & platforms" },
  "position-trading": { topic: "Trading" },
  "day-trading": { topic: "Trading" },
  scalping: { topic: "Trading" },
  "swing-trading": { topic: "Trading" },
  "forward-contract": { topic: "Instruments" },
  rally: { topic: "Technical analysis" },
  whipsaw: { topic: "Technical analysis" },
  volume: { topic: "Technical analysis" },

  // Same wording as carried, repunctuated to house style (no em dashes, typographic apostrophes and quotation marks)
  "asset-allocation": { definition: "The strategy of distributing investments across various asset classes, such as currencies, equities and commodities, to balance risk and reward according to a trader’s goals and risk tolerance." },
  deflation: { definition: "A sustained decrease in the general price level of goods and services. Deflation increases a currency’s purchasing power but can signal economic weakness, often prompting central banks to lower interest rates." },
  gap: { definition: "A break between prices on a chart where no trading occurred. Gaps often appear at the market open on Sunday when prices differ from Friday’s close due to weekend news events." },
  offer: { definition: "Another term for the ask price: the price at which a seller is willing to sell a currency pair. The offer is the price you pay when entering a long (buy) position." },
  pair: { definition: "Short for currency pair: two currencies quoted together showing their relative value. The first currency is the base and the second is the quote, e.g. EUR/USD." },
  "pivot-point": { definition: "A technical indicator calculated from the previous period’s high, low, and close prices, used to identify potential support and resistance levels. Pivot points are widely used by day traders." },
  vix: { definition: "The CBOE Volatility Index, often called the “fear gauge”, measures expected market volatility. Forex traders watch the VIX because higher volatility often leads to increased currency market movements." },
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

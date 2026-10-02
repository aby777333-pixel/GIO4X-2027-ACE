import type { DiagramSpec } from "./glossary-learn/types";

/**
 * Story mode: what is shown beside each chapter of an Academy lesson.
 *
 * A lesson's chapters are its `h2` sections, in order, preceded by the text
 * before the first heading (the opening). Each gets one panel:
 *
 *  - a diagram from the glossary's diagram engine, with a caption; or
 *  - a quiet typographic panel showing one sentence of the chapter.
 *
 * Nothing here adds to what a lesson says. Every `caption` and every `quote`
 * is a sentence of the chapter it sits beside, word for word (a closing colon
 * may be left off); every label written here is made of words and figures
 * the lesson itself uses, and where a diagram compares sizes, the sizes are
 * the chapter's own figures. Where the chapter is about a term that has a
 * glossary lesson, `term` names it: the panel links to the term, and unless a
 * `diagram` is given here the term's own diagram is the one shown.
 *
 * .tmp/shot/story-map-check.mjs verifies all of that against the lessons.
 */
export type StoryArt =
  /** the glossary term's own diagram, or `diagram` when the chapter needs its own labels; the panel links to the term */
  | { term: string; diagram?: DiagramSpec; caption: string }
  /** a diagram drawn for this chapter */
  | { diagram: DiagramSpec; caption: string }
  /** no diagram says it better than the chapter's own sentence */
  | { quote: string };

export type LessonStory = {
  /** beside the text before the first heading */
  opening: StoryArt;
  /** beside each `h2` section, by index */
  chapters: StoryArt[];
};

export const academyStory: Record<string, LessonStory> = {
  "introduction-to-forex-trading": {
    opening: { term: "forex", caption: "Forex trading, short for foreign exchange trading, is the process of buying and selling currencies on the global decentralized market." },
    chapters: [
      // How does the forex market work?
      { term: "currency-pair", caption: "When you buy a currency pair, you are purchasing the base currency and simultaneously selling the quote currency." },
      // Major forex market sessions
      { diagram: { kind: "cycle", labels: ["Sydney", "Tokyo", "London", "New York"] }, caption: "The forex market is divided into four major trading sessions." },
      // Features of the forex market
      { diagram: { kind: "hub", labels: ["Forex market", "Leverage", "24-Hour Market", "Two-way market"] }, caption: "A position can be long (buy) or short (sell)." },
      // How to get started with forex trading
      { diagram: { kind: "flow", labels: ["Learn the basics", "Demo account", "Trading strategy", "Small live account"] }, caption: "Open a demo account to practice trading without risking real money." },
    ],
  },

  "understanding-currency-pairs": {
    opening: { quote: "Every transaction in the forex market involves currency pairs." },
    chapters: [
      // Base currency vs. Quote currency
      { term: "base-currency", caption: "The exchange rate tells you how much of the quote currency you need to buy one unit of the base currency." },
      // Bid and ask prices
      { term: "spread", caption: "The difference between these two prices is called the spread, and it represents the cost of the trade." },
      // Major currency pairs
      { term: "major-pairs", caption: "They all include the US dollar." },
      // Minor currency pairs
      { term: "minor-pairs", caption: "Popular examples include EUR/GBP, EUR/JPY, and GBP/JPY." },
      // Exotic currency pairs
      { term: "exotic-pairs", diagram: { kind: "pair", labels: ["USD", "TRY"] }, caption: "While exotic pairs can offer larger price movements, they come with wider spreads and lower liquidity." },
      // How currency pairs are quoted
      { term: "pip", caption: "Price movements are measured in pips — the fourth decimal place for most pairs, or the second decimal place for JPY pairs." },
    ],
  },

  "what-is-leverage-and-margin": {
    opening: { term: "leverage", caption: "However, while leverage amplifies potential profits, it equally magnifies potential losses, making it essential to understand how it works." },
    chapters: [
      // How leverage works: what $1,000 controls at each ratio, from the chapter's table
      { diagram: { kind: "bars", labels: ["50:1", "100:1", "200:1", "500:1"], sizes: [1, 2, 4, 10] }, caption: "The higher the leverage ratio, the less capital you need to open a position, but the greater your exposure to market fluctuations." },
      // Understanding forex margin
      { term: "margin", caption: "It is not a fee or cost — it is a portion of your account equity set aside as collateral." },
      // Margin calculation formula
      { diagram: { kind: "flow", labels: ["Position Size", "Leverage Ratio", "Required Margin"] }, caption: "Required Margin = Position Size / Leverage Ratio" },
      // What is a margin call?
      { term: "margin-call", caption: "A margin call occurs when your account equity falls below the required margin level." },
      // Stop out level
      { term: "stop-out", caption: "The stop out level is the point at which the broker automatically closes your losing positions to limit further losses." },
      // Benefits and risks of leverage
      { diagram: { kind: "balance", labels: ["Benefit", "Risk"], tilt: "level" }, caption: "Losses are amplified proportionally — a 1% move against you at 100:1 leverage wipes out your entire margin." },
    ],
  },

  "candlestick-patterns-masterclass": {
    opening: { quote: "Developed in 18th-century Japan, these visual patterns reveal market sentiment and help traders anticipate potential reversals and continuations." },
    chapters: [
      // Anatomy of a candlestick
      { term: "candlestick", caption: "The rectangular body represents the range between open and close, while the thin lines (wicks or shadows) show the high and low." },
      // Single-candle patterns
      { diagram: { kind: "candles", shape: "doji", labels: ["Open", "Close"] }, caption: "A candle where the open and close are virtually identical, creating a cross-like shape." },
      // Two-candle patterns
      { quote: "Two-candle chart patterns provide stronger signals by showing a shift in momentum." },
      // Three-candle reversal patterns
      { diagram: { kind: "candles", shape: "reversal-bottom", labels: ["Bearish candle", "The star", "Bullish candle"] }, caption: "A three-candle bullish reversal: a long bearish candle, followed by a small-bodied candle (the star), and then a long bullish candle." },
      // Trading candlestick patterns effectively
      { quote: "Patterns that form at key levels carry significantly more weight than those appearing in the middle of a range." },
    ],
  },

  "support-and-resistance-levels": {
    opening: { term: "range", caption: "These price levels represent zones where buying or selling pressure has historically been strong enough to halt or reverse price movement." },
    chapters: [
      // What is support?
      { term: "support", caption: "Think of support as a floor beneath the price — each time price approaches this level, buyers step in and push it back up." },
      // What is resistance?
      { term: "resistance", diagram: { kind: "path", shape: "up-then-down", labels: ["Price"], marks: ["Resistance"] }, caption: "Resistance acts as a ceiling above the price." },
      // Horizontal support and resistance
      { diagram: { kind: "band", labels: ["Swing highs", "Swing lows"], breaks: "none" }, caption: "Draw a horizontal line through those swing highs or lows." },
      // Trendlines as dynamic levels
      { diagram: { kind: "path", shape: "zigzag-up", labels: ["Uptrend"], marks: ["Higher low", "Higher low"] }, caption: "A valid trendline requires at least two touch points, with three or more confirming its significance." },
      // Dynamic support and resistance with moving averages
      { term: "moving-average", diagram: { kind: "lines", labels: ["Price", "Moving average"], relation: "parallel" }, caption: "In an uptrend, the moving average often acts as dynamic support; in a downtrend, it acts as dynamic resistance." },
      // The polarity principle
      { diagram: { kind: "threshold", labels: ["Support level", "Price", "Becomes resistance"], from: "above" }, caption: "One of the most powerful concepts in technical analysis is the polarity principle: once a support level is broken, it often becomes resistance, and vice versa." },
      // Trading breakouts
      { term: "breakout", caption: "A breakout occurs when price decisively moves through a support or resistance level." },
    ],
  },

  "moving-averages-strategy": {
    opening: { term: "moving-average", caption: "As a trend indicator, they smooth out price data to reveal the underlying direction of the market, helping traders identify trends, find entry and exit points, and filter out market noise." },
    chapters: [
      // Simple moving average (SMA)
      { diagram: { kind: "flow", labels: ["20 closing prices", "Adds", "Divides by 20", "20-period SMA"] }, caption: "For example, a 20-period SMA adds the last 20 closing prices and divides by 20." },
      // Exponential moving average (EMA)
      { term: "ema", caption: "The EMA (Exponential Moving Average) applies more weight to recent price data, making it more responsive to current market conditions." },
      // SMA vs. EMA: which should you use?
      { diagram: { kind: "balance", labels: ["SMA", "EMA"], tilt: "level" }, caption: "Many traders use both — EMAs for entries and SMAs for trend confirmation and key levels." },
      // The golden cross and death cross
      { term: "golden-cross", caption: "Occurs when the 50-period moving average crosses above the 200-period moving average." },
      // Moving average crossover strategies
      { diagram: { kind: "lines", labels: ["Fast MA (9 EMA)", "Slow MA (21 EMA)"], relation: "cross-down" }, caption: "Beyond the golden and death crosses, moving average crossover strategies use pairs of moving averages with different periods." },
      // Choosing the right period: the longest period each style is given in the chapter (20, 50, 200)
      { diagram: { kind: "bars", labels: ["Scalpers", "Swing traders", "Position traders"], sizes: [1, 2.5, 10] }, caption: "Scalpers use 5-20 period MAs, swing traders prefer 20-50 periods, and position traders rely on 50-200 period MAs." },
    ],
  },

  "fibonacci-retracement-guide": {
    opening: { term: "retracement", caption: "Based on the mathematical sequence discovered by Leonardo Fibonacci, these Fibonacci levels help traders identify potential support and resistance zones where price may reverse or pause during a trend." },
    chapters: [
      // The golden ratio and Fibonacci sequence: five numbers of the sequence, drawn to scale
      { diagram: { kind: "bars", labels: ["5", "8", "13", "21", "34"], sizes: [1.47, 2.35, 3.82, 6.18, 10] }, caption: "The Fibonacci sequence (0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89...) has a unique property: each number divided by the previous one approaches the golden ratio of 1.618." },
      // Key Fibonacci retracement levels
      { term: "fibonacci-retracement", caption: "The most important Fibonacci level, derived directly from the golden ratio." },
      // How to draw Fibonacci retracement
      { diagram: { kind: "path", shape: "zigzag-up", labels: ["Uptrend"], marks: ["Swing low", "Swing high"] }, caption: "In an uptrend: Click the swing low and drag to the swing high." },
      // Fibonacci extensions: the initial move (100%) beside the three extension levels, drawn to scale
      { diagram: { kind: "bars", labels: ["Initial move", "127.2%", "161.8%", "261.8%"], sizes: [3.82, 4.86, 6.18, 10] }, caption: "The most common extension levels are 127.2%, 161.8%, and 261.8%." },
      // Fibonacci clusters
      { quote: "When Fibonacci levels from different swing points converge at the same price zone, they create a Fibonacci cluster." },
      // Combining Fibonacci with other tools
      { diagram: { kind: "hub", labels: ["Fibonacci", "Candlestick", "Moving averages", "Support/resistance"] }, caption: "Practitioners usually combine Fibonacci retracement with candlestick patterns, moving averages, and support/resistance levels." },
    ],
  },

  "rsi-and-macd-strategies": {
    opening: { term: "momentum", caption: "The RSI indicator and MACD are two of the most widely used momentum indicators." },
    chapters: [
      // Understanding the RSI indicator
      { term: "rsi", caption: "The Relative Strength Index (RSI) is an oscillator that measures the speed and magnitude of price changes on a scale from 0 to 100." },
      // RSI divergence
      { term: "divergence", caption: "It occurs when price and the RSI indicator move in opposite directions." },
      // Understanding the MACD
      { term: "macd", caption: "This indicator excels at revealing changes in trend momentum." },
      // MACD signal line crossovers
      { diagram: { kind: "lines", labels: ["MACD line", "Signal line"], relation: "cross-up" }, caption: "The MACD line crosses above the signal line." },
      // The MACD histogram: stated in the chapter before as the difference between the two lines
      { diagram: { kind: "gap", labels: ["MACD line", "Signal line", "Histogram"] }, caption: "Growing histogram bars indicate increasing momentum, while shrinking bars suggest momentum is fading." },
      // Combining RSI and MACD
      { diagram: { kind: "balance", labels: ["RSI", "MACD"], tilt: "level" }, caption: "Look for trades where both momentum indicators agree: for example, an RSI bouncing from oversold territory while the MACD produces a bullish crossover is read by some traders as confirmation." },
    ],
  },

  "bollinger-bands-trading": {
    opening: { quote: "Created by John Bollinger in the 1980s, this volatility indicator consists of three lines that expand and contract based on market volatility." },
    chapters: [
      // How Bollinger Bands work
      { diagram: { kind: "hub", labels: ["Middle Band", "Upper Band", "Lower Band"] }, caption: "A 20-period Simple Moving Average (SMA) that serves as the baseline." },
      // Understanding forex volatility with bands width
      { diagram: { kind: "gap", labels: ["Upper band", "Lower band", "Distance"] }, caption: "The distance between the upper and lower bands directly reflects forex volatility." },
      // The Bollinger squeeze
      { diagram: { kind: "lines", labels: ["Upper band", "Lower band"], relation: "converge" }, caption: "It occurs when the bands contract to their narrowest width, signaling extremely low volatility." },
      // Band bounces in ranges
      { term: "bollinger-bands", caption: "In ranging markets, price tends to bounce between the upper and lower Bollinger Bands like a ball bouncing between a floor and ceiling." },
      // Bollinger band trend following
      { diagram: { kind: "band", labels: ["Upper band", "Lower band"], breaks: "up" }, caption: "The middle band (20 SMA) serves as dynamic support in uptrends and dynamic resistance in downtrends." },
    ],
  },

  "trading-the-news": {
    opening: { diagram: { kind: "path", shape: "volatile", labels: ["Price"], marks: ["Data release"] }, caption: "Economic data releases and central bank announcements can trigger massive price movements within seconds." },
    chapters: [
      // The economic calendar
      { diagram: { kind: "bars", labels: ["Low", "Medium", "High"], sizes: [2, 5, 9] }, caption: "Events are typically classified by impact level — high, medium, and low." },
      // Key high-impact news events
      { diagram: { kind: "hub", labels: ["Large moves", "NFP", "CPI", "FOMC", "Rate decisions", "GDP"] }, caption: "The releases most often associated with large moves." },
      // Risk around releases
      { term: "slippage", caption: "It is the deviation from consensus that drives price, not the absolute number." },
    ],
  },

  "central-bank-policies-explained": {
    opening: { term: "central-bank", caption: "The decisions made by institutions like the Federal Reserve and ECB ripple through every currency pair on your chart." },
    chapters: [
      // Major central banks
      { diagram: { kind: "hub", labels: ["Central banks", "Fed", "ECB", "BOE", "BOJ", "RBA", "RBNZ"] }, caption: "The US Federal Reserve sets monetary policy for the world's reserve currency." },
      // Interest rate decisions
      { term: "interest-rate-differential", caption: "Interest rate differentials between countries drive carry trades and long-term currency trends, making them a cornerstone of forex fundamentals." },
      // Quantitative easing (QE)
      { term: "quantitative-easing", caption: "QE increases the money supply, lowers bond yields, and typically weakens the currency." },
      // Forward guidance
      { term: "dovish", caption: "Hawkish forward guidance (signaling rate hikes) tends to support the currency, while dovish guidance (signaling cuts or continued easing) tends to weigh on it." },
      // Preparing for central bank events
      { diagram: { kind: "gap", labels: ["Actual decision", "Expected decision", "Deviation"] }, caption: "Focus on the deviation between expected and actual decisions." },
    ],
  },

  "risk-reward-ratio-explained": {
    opening: { term: "risk-reward-ratio", caption: "It measures the potential profit of a trade relative to its potential loss, helping traders evaluate whether a trade is worth taking." },
    chapters: [
      // What is the risk-reward ratio?
      { term: "stop-loss", diagram: { kind: "levels", labels: ["Take-profit", "Entry", "Stop-loss"] }, caption: "The risk reward ratio (R:R) compares the distance from your entry price to your stop-loss (risk) against the distance from your entry to your take-profit (reward)." },
      // Why a minimum 1:2 ratio matters: the win rate each ratio needs to break even, as the chapter gives it (50%, 34%, 25%)
      { diagram: { kind: "bars", labels: ["1:1 R:R", "1:2 R:R", "1:3 R:R"], sizes: [10, 6.8, 5] }, caption: "With a 1:2 R:R, you only need to win 34% of your trades to break even." },
      // The expectancy formula: the chapter's own worked example
      { diagram: { kind: "balance", labels: ["0.45 × $200", "0.55 × $100"], tilt: "left" }, caption: "Expectancy = (0.45 × $200) - (0.55 × $100) = $90 - $55 = $35 per trade" },
      // Common R:R mistakes
      { diagram: { kind: "gap", labels: ["Entry", "Stop-loss", "Risk"] }, caption: "Moving your stop-loss further away to avoid being stopped out — this destroys your planned R:R ratio." },
      // Applying R:R in practice
      { diagram: { kind: "flow", labels: ["Calculate R:R", "Place stop-losses", "Set take-profit", "Track actual R:R"] }, caption: "Always calculate your R:R before entering any trade." },
    ],
  },

  "position-sizing-strategies": {
    opening: { quote: "It determines how much of your capital you allocate to each trade and directly controls your risk exposure." },
    chapters: [
      // Understanding lot sizes
      { term: "lot", caption: "In forex, lot size defines the volume of your trade." },
      // The percent risk model
      { diagram: { kind: "flow", labels: ["Account Equity", "Risk Percentage", "Stop Loss in Pips", "Pip Value", "Position Size"] }, caption: "Position Size = (Account Equity × Risk Percentage) / (Stop Loss in Pips × Pip Value)" },
      // Fixed fractional method
      { diagram: { kind: "lines", labels: ["Account", "Position sizes"], relation: "parallel" }, caption: "As your account grows, your position sizes increase proportionally." },
      // The Kelly criterion: the chapter's own worked example, 25%
      { diagram: { kind: "share", labels: ["Kelly %", "Account"], share: 0.25 }, caption: "For example, with a 55% win rate and 1.5 average win/loss ratio: Kelly % = 0.55 - (0.45 / 1.5) = 0.55 - 0.30 = 25%." },
      // Calculating lot sizes in practice
      { diagram: { kind: "flow", labels: ["Maximum risk", "Stop-loss distance", "Pip value", "Position size", "Round down"] }, caption: "Round down to the nearest available lot size — never round up." },
      // Position sizing rules: 2% on a single trade beside 5-6% across all open positions
      { diagram: { kind: "bars", labels: ["Single trade", "All open positions"], sizes: [2, 5.5] }, caption: "Limit total portfolio risk to 5-6% across all open positions." },
    ],
  },

  "managing-trading-psychology": {
    opening: { quote: "Even with a proven strategy and sound risk management, forex emotions can derail your trading results." },
    chapters: [
      // Common psychological pitfalls
      { quote: "This overconfidence bias is one of the most dangerous forex emotions because it feels like skill rather than luck." },
      // Building trading discipline
      { diagram: { kind: "hub", labels: ["Trading discipline", "Trading plan", "Checklist", "Daily loss limits", "Take breaks"] }, caption: "Trading discipline is the ability to follow your plan consistently, regardless of recent results or emotional state." },
      // Emotional control techniques
      { diagram: { kind: "cycle", labels: ["Deep breaths", "Trades", "Journal", "Review weekly"] }, caption: "Review this journal weekly to identify patterns." },
      // A durable mindset
      { quote: "Losses are a natural cost of doing business — not personal failures." },
    ],
  },
};

/** The panel beside a chapter: `index` is -1 for the opening, otherwise the index of the `h2` section. */
export function storyArt(slug: string, index: number): StoryArt | null {
  const story = Object.prototype.hasOwnProperty.call(academyStory, slug) ? academyStory[slug] : null;
  if (!story) return null;
  return (index < 0 ? story.opening : story.chapters[index]) ?? null;
}

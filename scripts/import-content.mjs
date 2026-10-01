#!/usr/bin/env node
/**
 * GIO4X content import and editorial audit.
 *
 *   node scripts/import-content.mjs [extract-dir]      (default: .tmp/extract)
 *
 * Reads the content extracted from the previous GIO4X site and writes:
 *   src/data/generated/articles.json   (GIO4X Intelligence)
 *   src/data/generated/academy.json    (lessons, modules, learning paths)
 *   src/data/generated/faqs.json
 *   src/data/generated/books.json
 *   docs/CONTENT-AUDIT.md              (every decision and every removed sentence)
 *
 * Nothing is published by default. Each item has an explicit editorial
 * decision in the tables below: `publish`, `publish-with-notice` or `hold`.
 * Published items are sanitised against an HTML allow-list, lose their
 * invented bylines, and have unverifiable GIO4X claims and buy/sell
 * instructions removed sentence by sentence. Every removal is logged.
 *
 * Plain Node ESM, no dependencies, deterministic and re-runnable.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.resolve(ROOT, process.argv[2] ?? ".tmp/extract");
const OUT = path.join(ROOT, "src/data/generated");
const AUDIT_FILE = path.join(ROOT, "docs/CONTENT-AUDIT.md");

/** Date of the editorial revision. A constant, so re-running the script is deterministic. */
const AUDIT_DATE = "2026-10-01";

const say = (s) => process.stdout.write(`${s}\n`);

if (!fs.existsSync(SRC)) {
  say(`import-content: extract directory not found (${path.relative(ROOT, SRC) || SRC}).`);
  say("The extracts are not committed. Nothing was changed; the existing generated JSON stays as it is.");
  process.exit(0);
}

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(SRC, name), "utf8"));

/* ==========================================================================
   1. EDITORIAL TABLES
   ========================================================================== */

const DESK = { research: "GIO4X Research", academy: "GIO4X Academy" };

/**
 * Sentence-level rules applied to every published text.
 * A sentence that matches is removed and logged with the reason.
 */
const RULES = [
  { re: /\bGIO4X\b|\bGIO Bots?\b|\bRaptor\b|\bAlgorator\b/, why: "Unverifiable GIO4X product or service statement" },
  { re: /negative balance protection/i, why: "Flagged claim: negative balance protection" },
  { re: /\bsegregated\b/i, why: "Flagged claim: segregated funds" },
  { re: /\bregulated\b|\blicen[cs]ed\b/i, why: "Flagged claim: regulation" },
  { re: /\baward/i, why: "Flagged claim: award" },
  { re: /\bbonus(es)?\b/i, why: "Flagged claim: bonus" },
  { re: /\b24\/7\b|\b24\/5\b/, why: "Flagged claim: availability" },
  { re: /no requotes?/i, why: "Flagged claim: execution" },
  { re: /guaranteed stop/i, why: "Flagged claim: guaranteed stops" },
  { re: /\bEquinix\b|\bLD4\b|\bNY4\b|\btier-1\b/i, why: "Flagged claim: infrastructure or liquidity" },
  { re: /\bmilliseconds?\b|\b\d+\s?ms\b/i, why: "Flagged claim: execution speed" },
  { re: /spreads? (from|as low as|starting from) \$?\d/i, why: "Flagged claim: spreads" },
  { re: /\b(we|our)\b/i, why: "First-person broker voice" },
  { re: /\b(buy|sell) (the )?(dips?|pullbacks?|rallies|now)\b/i, why: "Instruction to buy or sell" },
];

/**
 * INTELLIGENCE. One entry per post in blog.json, keyed by slug.
 *  strip        [[substring, reason]]  remove the sentence containing the substring
 *  replace      [[from, to, reason]]   minimal correction inside a sentence (logged)
 *  dropSections [[h2 text, reason]]    remove a whole section
 *  keep         [substring]            exempt a sentence from the automatic rules
 */
const ARTICLES = {
  "golden-ratio-transforms-forex-trading": {
    decision: "publish",
    reason: "Explains how Fibonacci tools are constructed. Claims of predictive power and the platform plug removed; limits stated in the brief.",
    title: "The golden ratio in technical analysis: how Fibonacci tools are built",
    section: "technical",
    format: "Explainer",
    byline: DESK.research,
    excerpt: "Retracements, extensions, fans and time zones all come from one number, 1.618. This is how each tool is constructed, how traders read it, and where its limits lie.",
    description: "How Fibonacci retracements, extensions, fans and time zones are derived from the golden ratio, how traders read them, and what they cannot tell you.",
    brief: [
      "The Fibonacci sequence converges on 1.618. That ratio and its inverse, 0.618, generate the levels drawn on charts.",
      "Retracement levels (23.6%, 38.2%, 50%, 61.8%, 78.6%) mark how far a move has pulled back; extensions (127.2%, 161.8%, 261.8%) project beyond it.",
      "The levels are widely watched, which is part of why prices sometimes react near them. They are reference zones, not forecasts.",
      "Most practitioners treat a level as meaningful only when it coincides with other evidence, such as a moving average or a prior high or low.",
    ],
    related: ["c:fibonacci-retracement", "c:technical-analysis", "c:support", "c:resistance", "c:moving-average", "i:eur-usd"],
    strip: [
      ["Leonardo da Vinci embedded it", "Unverifiable factual assertion"],
      ["The spirals of sunflowers, hurricanes, and galaxies", "Unverifiable factual assertion"],
      ["But what many traders do not realize", "Claim of reliability (“most reliable … tools”)"],
      ["making it a high-probability entry point", "Claim of predictive power"],
      ["price will often stall or reverse precisely", "Claim of predictive power"],
      ["These predict when the next significant price movement", "Claim of predictive power"],
      ["the likelihood of a reversal increases dramatically", "Claim of predictive power"],
      ["you harness a principle that has governed natural patterns", "Promotional conclusion"],
      ["provides a universal framework for understanding market structure", "Overclaim"],
    ],
    replace: [[", the 61.8% retracement level at 1.0876 often acts as strong support.", ", the 61.8% retracement level sits at 1.0876.", "Worked example kept, predictive wording removed"]],
  },
  "eurusd-2026-outlook-key-levels": {
    decision: "hold",
    reason: "A price forecast with scenario probabilities and an explicit trade plan (entry zone, stops, targets). Also quotes GIO4X spreads and negative balance protection. Signed by an unverifiable individual.",
  },
  "5-risk-management-rules-forex": {
    decision: "publish",
    reason: "General risk education with worked arithmetic. GIO4X feature claims, unsourced statistics and the invented byline removed.",
    title: "Five risk management rules for leveraged trading",
    section: "risk",
    format: "Guide",
    byline: DESK.research,
    excerpt: "Risk per trade, stop placement, the reward-to-risk arithmetic, correlated exposure and a written plan: five habits that limit how much a single mistake can cost.",
    description: "Five risk management rules explained with worked arithmetic: risk per trade, stop-loss placement, reward-to-risk, correlation and a written plan.",
    brief: [
      "Limiting risk to 1–2% of equity per trade means ten consecutive losses draw the account down by roughly 10–20%, not to zero.",
      "A stop-loss defines the loss before the trade is opened. Position size follows from the stop distance, not the other way round.",
      "At a 1:2 risk-to-reward ratio, four wins in ten trades nets +2R before costs. The arithmetic says nothing about whether a strategy will achieve that.",
      "Correlated positions are one position in disguise: long EUR/USD and long GBP/USD is largely a single view on the dollar.",
      "A written plan and a journal make deviations visible.",
    ],
    related: ["c:risk-management", "c:stop-loss", "c:risk-reward-ratio", "c:correlation", "c:drawdown", "c:money-management"],
    strip: [
      ["Ask any consistently profitable forex trader", "Unverifiable generalisation about profitable traders"],
      ["They will talk about risk management.", "Depends on the removed sentence before it"],
      ["Studies show that over 70% of retail traders lose money", "Unsourced statistic"],
      ["where stop-hunting is common", "Unverifiable market-conduct claim"],
      ["move in the same direction approximately 80% of the time", "Unsourced statistic"],
    ],
    replace: [
      ["Why Risk Management Is the Foundation of Trading Success", "Why risk management comes first", "Heading promised success"],
      ["you are still profitable over time", "the arithmetic is still positive before costs", "Promise of profitability replaced with the arithmetic"],
    ],
  },
  "ecn-vs-standard-forex-accounts": {
    decision: "publish",
    reason: "The general explanation of the two pricing structures is kept. Every GIO4X figure (spreads, commission, minimum deposit, transfers, protection) is removed: those figures conflict between the previous sites.",
    title: "ECN and standard accounts: two ways of paying for a trade",
    section: "education",
    format: "Explainer",
    byline: DESK.academy,
    excerpt: "A standard account folds the cost of trading into the spread. An ECN account shows a raw spread and charges a commission. The difference is in how the cost is presented.",
    description: "How ECN and standard forex accounts differ: spread-only pricing versus raw spread plus commission, market depth, and who each structure tends to suit.",
    brief: [
      "A standard account charges through the spread alone; an ECN account passes on a raw spread and adds a commission per lot.",
      "Total cost is what matters: spread, commission and overnight financing, multiplied by how often you trade.",
      "ECN-style accounts may show depth of market. Standard accounts are simpler to cost before a trade.",
      "GIO4X’s own account conditions are published separately, as indicative figures, on the account types page.",
    ],
    related: ["c:ecn", "c:spread", "c:market-maker", "c:liquidity-provider", "c:non-dealing-desk", "c:slippage"],
    strip: [
      ["This means a round-turn (open and close) costs", "Figure depends on a removed GIO4X fee statement"],
      ["the total trading cost is significantly lower than a standard account", "Cost claim built on unverifiable spread figures"],
      ["ECN accounts often provide faster execution", "Execution-speed claim"],
      ["This reduces slippage and requotes", "Execution-quality claim"],
      ["High-volume traders save substantially on costs", "Unverifiable cost claim"],
      ["the commission-based model almost always costs less", "Unverifiable cost claim"],
    ],
    replace: [
      [", which can be as low as 0.0 pips on major pairs during peak liquidity hours", "", "Spread figure removed"],
      ["In exchange for these ultra-tight spreads", "In exchange for the raw spread", "Promotional wording"],
    ],
    dropSections: [["Switching Between Accounts at GIO4X", "GIO4X account, transfer and protection claims"]],
  },
  "gold-trading-strategies-xauusd": {
    decision: "publish-with-notice",
    reason: "Kept as a description of the gold market (volatility, drivers, sessions). The four “strategy” sections were trade instructions with price levels and are removed, with the GIO4X spread and leverage claims.",
    notice: "Published March 2026. Prices, ranges and levels mentioned reflect conditions at the time of writing and are not current quotations.",
    title: "Gold as a market: what makes XAU/USD different",
    section: "commodities",
    format: "Analysis",
    byline: DESK.research,
    excerpt: "Gold trades more like a macro barometer than a currency pair: wider daily ranges, a close relationship with the dollar, and sharp reactions to scheduled data. A description of the market, not a view on its direction.",
    description: "What sets XAU/USD apart from currency pairs: volatility, the dollar and real yields, sensitivity to scheduled data, and when gold is most active.",
    brief: [
      "Gold’s daily ranges are typically several times those of EUR/USD, so the same stop distance means something different.",
      "It is commonly watched against the US dollar and has a history of being sought in periods of stress.",
      "Fed decisions, payrolls, CPI and central-bank purchases are the events most often associated with large moves. Spreads can widen around them.",
      "Activity is concentrated in the London and New York sessions.",
    ],
    related: ["i:xau-usd", "ac:metals", "cb:fed", "ev:cpi", "ev:non-farm-payrolls", "c:safe-haven", "c:real-yields"],
    strip: [
      ["XAU/USD offers exceptional opportunities", "Promotional"],
      ["Straddle strategies", "Trade instruction"],
      ["Gold trends can last for weeks", "Predictive claim"],
    ],
    replace: [
      ["Gold in 2026: A New Era for Precious Metals", "Gold in early 2026", "Heading toned down"],
      ["Gold is the most news-sensitive instrument in the forex market.", "Gold is highly sensitive to news.", "Superlative removed"],
      ["Strategy 3: News-Based Trading", "Sensitivity to news", "Heading no longer describes a strategy"],
      ["Best Times to Trade Gold", "When gold is most active", "Heading no longer implies a recommendation"],
      [", offering potential range-trading setups", "", "Trade suggestion removed"],
    ],
    dropSections: [
      ["Strategy 1: Trend Following with Moving Averages", "Buy and sell instructions"],
      ["Strategy 2: Support and Resistance Levels", "Price levels presented as entry points"],
      ["Strategy 4: Fibonacci and the Golden Ratio", "Claim that a tool “works exceptionally well”"],
    ],
  },
  "complete-guide-copy-trading": {
    decision: "hold",
    reason: "Built on GIO4X copy-trading product statements (vetted providers, leaderboard, risk scores, drawdown limits, $150 minimum) that cannot be verified and conflict between the previous sites; framed as “passive income”.",
  },
  "institutional-execution-retail-traders": {
    decision: "hold",
    reason: "Built on execution-speed, liquidity-provider, data-centre and fill-statistics claims that cannot be verified.",
  },
  "gio4x-raptor-3-launch": {
    decision: "hold",
    reason: "Product launch announcement: feature counts, latency figures and an “AI-powered” scanner that cannot be verified.",
  },
  "japanese-candlestick-patterns-guide": {
    decision: "publish",
    reason: "General chart-reading education. Platform plug and one claim of reliability removed.",
    title: "Japanese candlestick patterns: a visual vocabulary",
    section: "technical",
    format: "Guide",
    byline: DESK.academy,
    excerpt: "Dojis, hammers, engulfing bars and stars: what each pattern looks like, what it is taken to say about buyers and sellers, and why context matters more than the shape.",
    description: "A guide to reading candlestick charts: candle anatomy, single, double and triple patterns, and why where a pattern forms matters more than its shape.",
    brief: [
      "Each candle records four prices for its period: open, high, low and close. The body spans open to close; the wicks mark the extremes.",
      "Single-candle patterns such as the doji, hammer and shooting star describe indecision or rejection within one period.",
      "Two- and three-candle patterns (engulfing, morning star, evening star) describe a shift in control over several periods.",
      "A pattern is conventionally given more weight at a level traders already watch. None of them is a prediction.",
    ],
    related: ["c:candlestick", "c:japanese-candlestick", "c:wick", "c:price-action", "c:support", "c:resistance", "c:technical-analysis"],
    strip: [["This is a reliable top reversal pattern.", "Claim of reliability"]],
    replace: [
      [", developed by Munehisa Homma, a rice trader in Osaka.", " and is traditionally attributed to Munehisa Homma, a rice merchant.", "Historical attribution stated as tradition"],
      [", offering visual insights into market sentiment that no indicator can match", "", "Superlative removed"],
    ],
  },
  "central-bank-decisions-currency-markets": {
    decision: "publish",
    reason: "General macro explainer. Outdated facts corrected, deterministic wording softened, the trading-instructions section and the platform plug removed.",
    title: "How central bank decisions move currencies",
    section: "macro",
    format: "Explainer",
    byline: DESK.research,
    excerpt: "Rates, forward guidance and balance-sheet policy reach exchange rates through one channel above all: what the market expected beforehand.",
    description: "How interest rate decisions, forward guidance and quantitative easing or tightening feed into exchange rates, and why the surprise matters most.",
    brief: [
      "A higher policy rate tends to make a currency more attractive to hold; a lower one, less. The carry trade is built on that differential.",
      "Guidance about the future path of rates can move a currency even when the rate itself is unchanged.",
      "Quantitative easing expands a central bank’s balance sheet and tends to weigh on its currency; tightening does the reverse.",
      "Markets price expectations in advance, so the reaction depends on the gap between the decision and what was expected.",
    ],
    related: ["cb:fed", "cb:ecb", "cb:boe", "cb:boj", "cb:rba", "ev:interest-rate-decision", "c:monetary-policy", "c:carry-trade", "c:hawkish", "c:dovish", "c:quantitative-easing"],
    replace: [
      ["for the 20 eurozone countries", "for the euro area", "Membership count was out of date"],
      [/ECB meetings and Christine Lagarde.s press conferences drive EUR pairs\./, "ECB meetings and the President’s press conferences are closely followed for EUR pairs.", "Named individual and deterministic wording removed"],
      ["Famous for ultra-loose monetary policy and yield curve control.", "Long associated with very low interest rates.", "Yield curve control is no longer current policy"],
      ["the dollar will strengthen even if", "the dollar may strengthen even if", "Deterministic wording softened"],
      ["the reaction will be explosive", "the reaction is likely to be large", "Deterministic wording softened"],
    ],
    dropSections: [["Trading Central Bank Events", "Timing instructions presented as predictable behaviour, and a platform plug"]],
  },
  "position-sizing-secret-weapon": {
    decision: "publish",
    reason: "Formulae and worked examples. Title promised profitability; platform section removed.",
    title: "Position sizing: the arithmetic of risk per trade",
    section: "risk",
    format: "Guide",
    byline: DESK.research,
    excerpt: "Fixed percentage, fixed amount, Kelly and volatility-based sizing, with the formula and a worked example for each.",
    description: "Position sizing methods compared, with formulae and worked examples: fixed percentage, fixed amount, the Kelly criterion and ATR-based sizing.",
    brief: [
      "Position size = (balance × risk %) ÷ (stop in pips × pip value). At 1% of $10,000 with a 40-pip stop on EUR/USD, that is 0.25 lots.",
      "Fixed-percentage sizing shrinks exposure automatically in a drawdown; a fixed amount does not.",
      "Full Kelly sizing is far more aggressive than most accounts can tolerate; practitioners usually take a fraction of it.",
      "Volatility-based sizing uses the average true range so that a stop sits at a comparable distance in quiet and busy markets.",
      "Common errors: sizing up after wins, averaging down, ignoring correlation, and using one lot size for every stop distance.",
    ],
    related: ["c:lot", "c:pip", "c:stop-loss", "c:risk-management", "c:money-management", "c:atr", "c:drawdown"],
    dropSections: [["GIO4X Position Sizing Tools", "Platform feature claims and a promise that results “will transform”"]],
  },
  "fibonacci-extensions-profit-targets": {
    decision: "publish",
    reason: "The construction of extension levels and the worked example are kept. Claims of accuracy and the list of take-profit instructions are removed; limits stated in the brief.",
    title: "Fibonacci extensions: how the levels are calculated",
    section: "technical",
    format: "Explainer",
    byline: DESK.research,
    excerpt: "Extensions project a prior swing beyond its end using the same ratios as retracements. A worked EUR/USD example shows where each level comes from.",
    description: "How Fibonacci extension levels (127.2%, 161.8%, 261.8%) are calculated from three chart points, with a worked example and the method’s limits.",
    brief: [
      "An extension needs three points: the start of a swing (A), its end (B) and the end of the pullback (C). Levels are multiples of A–B projected from C.",
      "For A = 1.0800, B = 1.1000 and C = 1.0900, the 161.8% level is 1.0900 + 1.618 × 0.0200 ≈ 1.1224.",
      "127.2% is the square root of 1.618; 261.8% is 1.618 squared.",
      "Extensions are a convention for marking possible reference levels in a trend. They do not say that price will reach them.",
    ],
    related: ["c:fibonacci-retracement", "c:elliott-wave-theory", "c:take-profit", "c:trend", "c:retracement", "i:eur-usd"],
    strip: [
      ["provide remarkably accurate targets", "Claim of accuracy"],
      ["An ambitious but achievable target", "Claim of achievability"],
      ["acts as a magnet for price", "Claim of predictive power"],
      ["Study any strong trend in forex", "Claim of predictive power"],
      ["maximizes reward while locking in", "Promotional description of a trade plan"],
      ["become exponentially more reliable", "Claim of reliability"],
      ["where smart money takes profits", "Unverifiable claim"],
    ],
    replace: [
      ["Beyond Retracements: The Power of Extensions", "Beyond retracements", "Heading toned down"],
      ["The 161.8% Level: The Primary Target", "The 161.8% level", "Heading toned down"],
      [", including GIO4X Raptor,", "", "Platform reference removed; the sentence is true of charting platforms in general"],
      ["becomes a high-conviction profit target", "is treated as a stronger reference", "Claim of conviction removed"],
    ],
    dropSections: [["Practical Trading Rules for Extensions", "Instructions on where to close positions"]],
  },
  "algorithmic-trading-gio4x-algorator": {
    decision: "hold",
    reason: "Built around “Algorator”, a GIO4X product whose described features (visual builder, Python and MQL5 support, ten years of tick data) cannot be verified.",
  },
  "psychology-of-trading-mastering-emotions": {
    decision: "publish",
    reason: "General behavioural education. One unsourced “studies show” sentence and the closing brand line removed.",
    title: "The psychology of trading: five biases and what to do about them",
    section: "education",
    format: "Deep Dive",
    byline: DESK.academy,
    excerpt: "Fear, greed, overconfidence, confirmation bias and loss aversion each leave a recognisable mark on a trading record. Naming them is the first step to noticing them.",
    description: "Fear, greed, overconfidence, confirmation bias and loss aversion: how each shows up in trading decisions and the routines used to counter them.",
    brief: [
      "Fear shows up as stops set too tight, late entries and missed setups. A written plan moves the decision to before the trade.",
      "Revenge trading after a loss is the most damaging form of greed. A daily loss limit is the standard defence.",
      "Loss aversion: losses are felt roughly twice as strongly as equal gains, which leads to holding losers and cutting winners.",
      "Useful routines: journal the emotional state of each trade, set process goals rather than money goals, and step away when agitated.",
    ],
    related: ["c:risk-management", "c:stop-loss", "c:trailing-stop", "c:money-management", "c:sentiment"],
    strip: [["Studies consistently show that the primary difference", "Unsourced claim about profitable traders"]],
  },
  "oil-price-analysis-2026": {
    decision: "publish-with-notice",
    reason: "Kept as a description of what drives crude oil. The price-level section read as a trade call and is removed, with the GIO4X spread, leverage and execution claims.",
    notice: "Published February 2026. Descriptions of production policy and market conditions reflect the time of writing.",
    title: "What drives crude oil: supply, demand and the geopolitical premium",
    section: "commodities",
    format: "Analysis",
    byline: DESK.research,
    excerpt: "OPEC+ quotas and US shale on the supply side, emerging-market growth and the energy transition on the demand side, and a risk premium that never quite goes away.",
    description: "The forces behind crude oil prices: OPEC+ and US shale supply, global demand and the energy transition, geopolitical risk, and links to currencies.",
    brief: [
      "Supply is shaped by OPEC+ production policy and by the pace of US shale output.",
      "Demand growth comes mainly from emerging economies, while efficiency and electrification weigh on oil intensity in developed ones.",
      "Oil carries a geopolitical risk premium. Disruption to shipping through the Strait of Hormuz is the scenario most often cited.",
      "The Canadian dollar and Norwegian krone are commonly associated with oil prices; importers’ currencies tend to move the other way.",
    ],
    related: ["i:wti", "i:brent", "ac:energy", "i:usd-cad", "ccy:CAD", "c:volatility"],
    strip: [
      ["offer exceptional volatility, liquidity, and trading opportunities", "Promotional"],
      ["creates significant trading opportunities", "Promotional"],
      ["This supports a higher price floor", "Price view"],
      ["In the medium term, oil demand remains robust", "Forecast"],
      ["These events create opportunities for prepared traders", "Promotional"],
      ["express your oil view through correlated currency pairs", "Trade suggestion"],
      ["ECN execution ensures tight spreads", "Execution and spread claim"],
      ["one of the most rewarding instruments", "Promotional"],
    ],
    replace: [
      [", with daily turnover exceeding $100 billion", "", "Unsourced statistic"],
      ["Trading Oil with GIO4X", "Scheduled data for oil", "Heading no longer advertises a product"],
      ["(Wednesday, 15:30 GMT)", "(usually Wednesday)", "Release time varies with daylight saving"],
    ],
    dropSections: [["Technical Analysis: Key Levels for WTI Crude", "Price levels with directional bias and targets: reads as a trade call"]],
  },
  "pamm-accounts-explained": {
    decision: "hold",
    reason: "Describes the GIO4X PAMM programme (manager vetting, ratings, fees, $500 minimum) in terms that cannot be verified and that conflict between the previous sites; illustrates with hypothetical returns.",
  },
  "top-10-forex-trading-mistakes": {
    decision: "publish",
    reason: "General education on common errors. GIO4X leverage and guaranteed-stop claims, unsourced return figures and the closing brand paragraph removed.",
    title: "Ten common trading mistakes and how they happen",
    section: "education",
    format: "Guide",
    byline: DESK.academy,
    excerpt: "No plan, too much leverage, no stop, too many trades: the errors are well known and still routinely made. Each is described here with the habit that guards against it.",
    description: "Ten common trading mistakes, from trading without a plan and overleveraging to moving stops and skipping the journal, with the habit that counters each.",
    brief: [
      "Most of the ten are failures of process, not of analysis: no plan, no stop, no journal.",
      "At 1:500 leverage, a 0.2% adverse move on a fully used $1,000 account is the whole balance.",
      "Overtrading and revenge trading share a remedy: a daily loss limit that ends the session.",
      "Moving a stop further away changes the risk after the decision was made. Moving it closer does not.",
      "Know when high-impact releases are scheduled, even if you trade from charts alone.",
    ],
    related: ["c:leverage", "c:stop-loss", "c:risk-management", "c:fundamental-analysis", "c:margin-call", "c:trailing-stop"],
    strip: [
      ["Most professional traders use effective leverage of 5:1 to 10:1", "Unsourced statistic"],
      ["consistently profitable traders typically earn 2-5% per month", "Unverifiable performance figure"],
      ["A 30% annual return is excellent by any standard", "Unverifiable performance figure"],
      ["Reading this article gives you a head start", "Promotional"],
      ["you will avoid the costly tuition", "Promise of outcome"],
    ],
    replace: [["The forex market offers extraordinary opportunities, but it also exposes", "The forex market exposes", "Promotional opening removed"]],
  },
  "crypto-cfds-bitcoin-ethereum-gio4x": {
    decision: "hold",
    reason: "Built on GIO4X instrument, spread and leverage figures and on “regulated broker” and “segregated funds” statements that cannot be published.",
  },
  "da-vinci-code-markets-sacred-geometry": {
    decision: "hold",
    reason: "Its substance is the assertion that markets obey “sacred geometry”, with a stated win rate (“above 60%”) for harmonic patterns and several factual claims that do not stand up. It could return as a history-of-ideas piece if rewritten.",
  },
  "gio4x-ib-program-earnings": {
    decision: "hold",
    reason: "Introducing Broker earnings post: rebate amounts, payout timing and tier structure conflict between the previous sites, and the piece promises income.",
  },
};

/** How the previous site's tags are tidied. */
const TAG_BLOCK = /gio4x|raptor|passive income|forecast|forex broker|forex strategy|trading strategies|professional/i;

/**
 * ACADEMY. One entry per article in education.json, keyed by id.
 * `dropColumns` removes table columns that carried unsourced statistics or spreads.
 */
const LESSONS = {
  "introduction-to-forex-trading": {
    decision: "publish",
    reason: "General introduction. Promotional lines, the statistics panel and unsourced volume shares removed.",
    title: "Introduction to forex trading",
    level: "Beginner",
    module: "fundamentals",
    description: "What the foreign exchange market is, how currency pairs are quoted, when the four sessions trade and what a newcomer should learn first.",
    related: ["ac:forex", "c:forex", "c:currency-pair", "c:base-currency", "c:quote-currency", "c:leverage"],
    tools: [],
    dropColumns: [["Volume", "Unsourced share-of-volume figures"], ["Best Pairs", "Reads as a recommendation"]],
    strip: [
      ["enter and exit positions instantly", "“Instantly” is an execution claim"],
      ["Low Barriers to Entry", "Encouragement to deposit, with an unsourced figure"],
      ["offers extraordinary opportunities for disciplined traders", "Promotional"],
      ["a solid foundation for long-term success", "Promise of success"],
    ],
    replace: [
      ["with a staggering daily trading volume", "with a daily trading volume", "Tone"],
      [", giving traders around the globe unparalleled access to online trading opportunities", "", "Promotional"],
      [", each offering unique characteristics for forex for beginners and experienced traders alike", "", "Search-engine filler"],
      ["There are several compelling reasons why millions of traders worldwide engage in forex trading:", "Features of the market that are often cited:", "Unsourced count and promotional framing"],
      ["Why Trade Forex?", "Features of the forex market", "Heading no longer sells"],
      ["Profit in Both Directions", "Two-way market", "One-sided description of outcomes"],
      ["You can go long (buy) or short (sell) to profit from rising or falling markets.", "A position can be long (buy) or short (sell). Either can lose as well as gain.", "One-sided description of outcomes"],
      ["If you are a forex for beginners enthusiast, follow these foundational steps to begin your journey:", "A sensible order in which to start:", "Search-engine filler"],
    ],
  },
  "understanding-currency-pairs": {
    decision: "publish",
    reason: "General education. Spread and volume columns and the branded tip removed.",
    title: "Understanding currency pairs",
    level: "Beginner",
    module: "fundamentals",
    description: "Base and quote currencies, bid and ask, the spread, and the difference between major, minor and exotic pairs.",
    related: ["c:currency-pair", "c:base-currency", "c:quote-currency", "c:spread", "c:pip", "c:major-pairs", "c:minor-pairs", "c:exotic-pairs"],
    tools: ["spread-visualizer", "pip-value"],
    dropColumns: [["Avg. Spread", "Spread figures cannot be verified"], ["Daily Volume", "Unsourced share-of-volume figures"]],
    strip: [["Once comfortable, expand to GBP/USD", "Recommendation attached to a removed branded tip"]],
    replace: [
      [" and account for approximately 75% of all forex trading volume", "", "Unsourced statistic"],
      [" but can offer excellent trading opportunities during their respective market sessions", "", "Promotional"],
    ],
  },
  "what-is-leverage-and-margin": {
    decision: "publish",
    reason: "General education with correct arithmetic. Wording that implied protection from negative balances changed.",
    title: "Leverage and margin",
    level: "Beginner",
    module: "fundamentals",
    description: "How leverage ratios, required margin, margin calls and stop-outs work, with the arithmetic that shows why losses scale exactly as gains do.",
    related: ["c:leverage", "c:margin", "c:margin-call", "c:stop-out", "c:free-margin", "c:equity", "c:notional-value"],
    tools: ["leverage-visualizer", "margin"],
    replace: [
      [", maximizing potential returns", "", "Promotional"],
      ["to prevent your account from going into negative balance", "to limit further losses", "Implied a protection GIO4X has not confirmed"],
    ],
  },
  "candlestick-patterns-masterclass": {
    decision: "publish",
    reason: "General education. “Masterclass”, accuracy and probability claims removed.",
    title: "Candlestick patterns",
    level: "Intermediate",
    module: "technical",
    description: "The anatomy of a candle and the single, two- and three-candle patterns most often named in price-action analysis, with their caveats.",
    related: ["c:candlestick", "c:price-action", "c:wick", "c:support", "c:resistance"],
    tools: [],
    replace: [
      [" with remarkable accuracy", "", "Claim of accuracy"],
      ["Mastering these individual candlestick patterns is your first step toward effective price action trading:", "The single-candle patterns most often cited:", "Promotional"],
      ["These complex candlestick patterns offer high-probability trading signals:", "The three-candle patterns most often cited:", "Claim of probability"],
      ["Essential Single-Candle Patterns", "Single-candle patterns", "Heading toned down"],
      ["Powerful Two-Candle Patterns", "Two-candle patterns", "Heading toned down"],
      ["signals a bottom and the start of an uptrend", "is read as a possible bottom", "Deterministic wording softened"],
    ],
  },
  "support-and-resistance-levels": {
    decision: "publish",
    reason: "General education. Two promotional phrases removed.",
    title: "Support and resistance",
    level: "Intermediate",
    module: "technical",
    description: "What support and resistance are, how horizontal levels, trendlines and moving averages are drawn, and what breakouts and false breakouts look like.",
    related: ["c:support", "c:resistance", "c:trend-line", "c:breakout", "c:moving-average", "c:pullback"],
    tools: [],
    strip: [["Every successful forex trader relies on", "Unverifiable generalisation"]],
    replace: [
      [", offering valuable entry points for trend-following strategies", "", "Promotional"],
      [" for a comprehensive and reliable trading approach", "", "Claim of reliability"],
    ],
  },
  "moving-averages-strategy": {
    decision: "publish",
    reason: "General education. A buy/sell rule rewritten as a description of the rule; promise of success removed.",
    title: "Moving averages",
    level: "Intermediate",
    module: "technical",
    description: "Simple and exponential moving averages, how each is calculated, what the golden cross and death cross describe, and how the period changes behaviour.",
    related: ["c:moving-average", "c:ema", "c:golden-cross", "c:trend", "c:macd", "c:whipsaw"],
    tools: [],
    strip: [["essential for consistent trading success", "Promise of success"]],
    replace: [
      ["Buy when the fast MA crosses above the slow MA; sell when it crosses below.", "The rule reads a cross of the fast MA above the slow MA as a buy signal and a cross below as a sell signal.", "Instruction rewritten as a description of the rule"],
      [" and often attracts significant institutional buying", "", "Unverifiable claim"],
      ["Two of the most powerful moving average crossover signals", "Two of the best-known moving average crossover signals", "Superlative removed"],
    ],
  },
  "fibonacci-retracement-guide": {
    decision: "publish",
    reason: "General education. Probability and effectiveness claims removed.",
    title: "Fibonacci retracement",
    level: "Advanced",
    module: "technical",
    description: "How Fibonacci retracement levels are derived and drawn, what each level is conventionally taken to mean, and how extensions and clusters build on them.",
    related: ["c:fibonacci-retracement", "c:retracement", "c:support", "c:resistance", "c:pullback"],
    tools: [],
    strip: [
      ["can dramatically improve your trade entries", "Promise of improvement"],
      ["These clusters significantly increase the probability", "Claim of probability"],
      ["the confluence increases the probability of a successful trade", "Claim of probability"],
      ["the hallmark of professional retracement trading", "Promotional"],
    ],
    replace: [
      [" — and remarkably, in financial markets", "", "Unverifiable claim"],
      [" that every forex trader must know", "", "Tone"],
      [", but it can still offer high risk-reward entry opportunities", "", "Trade suggestion"],
      [" — a particularly strong area of support or resistance", "", "Claim of strength"],
      ["For maximum effectiveness, combine", "Practitioners usually combine", "Claim of effectiveness"],
    ],
  },
  "rsi-and-macd-strategies": {
    decision: "publish",
    reason: "General education on two indicators. Win-rate and “high-confidence” claims removed; buy/sell wording made descriptive.",
    title: "RSI and MACD",
    level: "Advanced",
    module: "technical",
    description: "How the Relative Strength Index and MACD are constructed, what overbought, oversold, divergence and crossovers mean, and where signals mislead.",
    related: ["c:rsi", "c:macd", "c:overbought", "c:oversold", "c:divergence", "c:momentum", "c:ema"],
    tools: [],
    strip: [
      ["creates a robust trading system", "Claim of robustness"],
      ["creates a powerful confirmation system", "Claim of effectiveness"],
      ["improves your overall win rate", "Performance claim"],
    ],
    replace: [
      ["two of the most powerful momentum indicators available to forex traders", "two of the most widely used momentum indicators", "Superlative removed"],
      ["one of the most powerful signals in technical analysis", "one of the most discussed signals in technical analysis", "Superlative removed"],
      [" and a potential buy opportunity", "", "Buy wording removed"],
      [" and a potential sell opportunity", "", "Sell wording removed"],
      [" provides a high-confidence buy signal", " is read by some traders as confirmation", "Claim of confidence removed"],
    ],
  },
  "bollinger-bands-trading": {
    decision: "publish",
    reason: "The construction and reading of the bands are kept. Step-by-step entry instructions, an inaccurate statistic and probability claims removed.",
    title: "Bollinger Bands",
    level: "Advanced",
    module: "technical",
    description: "How Bollinger Bands are built from a moving average and standard deviation, what band width says about volatility, and how squeezes are read.",
    related: ["c:bollinger-bands", "c:volatility", "c:moving-average", "c:breakout", "c:range", "c:overbought"],
    tools: [],
    strip: [
      ["Statistically, approximately 95% of price action", "Inaccurate statistic (assumes normally distributed prices)"],
      ["the more explosive the subsequent breakout", "Predictive claim"],
      ["To trade the Bollinger squeeze:", "Introduces entry instructions"],
      ["Identify periods where the bands are at their narrowest", "Entry instructions"],
      ["Wait for a candle to close decisively outside the bands", "Entry instructions"],
      ["Enter in the direction of the breakout", "Entry instructions"],
      ["Use increasing volume as confirmation of a genuine breakout", "Entry instructions"],
      ["The band trading strategy involves:", "Introduces buy and sell instructions"],
      ["Buying when price touches or pierces the lower band", "Instruction to buy"],
      ["Selling when price touches or pierces the upper band", "Instruction to sell"],
      ["Setting profit targets at the middle band", "Trade instruction"],
      ["for even more reliable signals", "Claim of reliability"],
      ["the probability of a bounce increases significantly", "Claim of probability"],
    ],
    replace: [
      ["one of the most powerful setups in technical trading", "a widely described pattern", "Superlative removed"],
      ["Band Bounce Strategy", "Band bounces in ranges", "Heading no longer describes a strategy"],
      [" and anticipating future moves", "", "Predictive wording"],
    ],
  },
  "trading-the-news": {
    decision: "publish",
    reason: "The calendar, the main releases and the risks around them are kept. The strategies section (straddles, fading, “buy USD pairs”) is removed.",
    title: "Scheduled news and how markets react",
    level: "Advanced",
    module: "news",
    description: "The economic calendar, the releases that most often move currencies, why the surprise matters more than the number, and the risks at release time.",
    related: ["ev:non-farm-payrolls", "ev:cpi", "ev:interest-rate-decision", "ev:gdp", "cb:fed", "c:nfp", "c:fomc", "c:slippage", "c:volatility"],
    tools: [],
    strip: [
      ["one of the most dynamic and potentially rewarding strategies", "Promotional"],
      ["NFP regularly causes 100+ pip moves", "Unsourced statistic"],
    ],
    replace: [
      [", creating opportunities for prepared traders", "", "Promotional"],
      ["the largest and most tradeable price movements", "the largest price movements", "Promotional"],
      ["These are the most market-moving events that every news trading enthusiast must track:", "The releases most often associated with large moves:", "Tone"],
      ["Rate hikes strengthen the currency; cuts weaken it.", "Higher rates tend to support a currency and lower rates to weigh on it.", "Deterministic wording softened"],
      ["Risk Management for News Trading", "Risk around releases", "Heading"],
    ],
    dropSections: [["News Trading Strategies", "Trade instructions, including “buy USD pairs”"]],
  },
  "central-bank-policies-explained": {
    decision: "publish",
    reason: "General macro education. Two outdated facts corrected and deterministic wording softened.",
    title: "Central bank policy",
    level: "Intermediate",
    module: "fundamental",
    description: "Who the major central banks are, how rate decisions, quantitative easing and forward guidance work, and how policy feeds through to currencies.",
    related: ["cb:fed", "cb:ecb", "cb:boe", "cb:boj", "cb:rba", "cb:rbnz", "ev:interest-rate-decision", "c:monetary-policy", "c:quantitative-easing", "c:hawkish", "c:dovish"],
    tools: [],
    replace: [
      [/the eurozone.s 20 member nations/, "the euro area", "Membership count was out of date"],
      [/Known for ultra-loose monetary policy and yield curve control, the BOJ.s interventions can cause dramatic moves in JPY pairs\./, "Long associated with very low interest rates, the BOJ is closely watched for any change of course.", "Yield curve control is no longer current policy"],
      [", expect downward pressure on that currency", ", the currency often comes under pressure", "Deterministic wording softened"],
      ["strengthens the currency, while dovish guidance (signaling cuts or continued easing) weakens it", "tends to support the currency, while dovish guidance (signaling cuts or continued easing) tends to weigh on it", "Deterministic wording softened"],
      ["How to Trade Central Bank Events", "Preparing for central bank events", "Heading"],
      ["To successfully trade central bank events, follow these guidelines:", "Before a central bank event:", "Promise of success"],
    ],
  },
  "risk-reward-ratio-explained": {
    decision: "publish",
    reason: "Formulae and break-even arithmetic. Claims that a ratio makes a system profitable removed.",
    title: "The risk-reward ratio",
    level: "Professional concepts",
    module: "risk",
    description: "How the risk-reward ratio and expectancy are calculated, the break-even win rate each ratio implies, and the mistakes that quietly change the ratio.",
    related: ["c:risk-reward-ratio", "c:stop-loss", "c:take-profit", "c:risk-management"],
    tools: ["risk-reward"],
    strip: [
      ["is what separates profitable traders from those who struggle", "Unverifiable generalisation"],
      ["provides a mathematical edge that makes your trading system profitable", "Promise of profitability"],
    ],
    replace: [
      ["Professional traders typically require a minimum risk reward ratio of 1:2 for every trade.", "Many traders set a minimum risk-reward ratio of 1:2.", "Unverifiable generalisation"],
      ["A positive expectancy means your system is profitable over a large number of trades.", "A positive expectancy means the rules were profitable, before costs, over the trades measured.", "Past measurement, not a promise"],
    ],
  },
  "position-sizing-strategies": {
    decision: "publish",
    reason: "Formulae and worked examples. One promise of success removed.",
    title: "Position sizing",
    level: "Professional concepts",
    module: "risk",
    description: "Lot sizes, the percent-risk model, fixed-fractional sizing and the Kelly criterion, with the formulae and a worked example.",
    related: ["c:lot", "c:pip", "c:money-management", "c:risk-management", "c:drawdown", "c:stop-loss"],
    tools: ["position-size", "pip-value"],
    strip: [["the cornerstone of long-term trading success", "Promise of success"]],
    replace: [
      ["Most professional traders recommend risking no more than 1-2% of your account per trade.", "A common guideline is to risk no more than 1-2% of the account per trade.", "Unverifiable generalisation"],
      ["Follow these essential money management rules for sustainable trading:", "Rules of thumb that are widely quoted:", "Tone"],
    ],
  },
  "managing-trading-psychology": {
    decision: "publish",
    reason: "General behavioural education. Promises of profitability and “edge” removed.",
    title: "Trading psychology",
    level: "Professional concepts",
    module: "risk",
    description: "The recurring psychological pitfalls in trading (FOMO, revenge trading, overconfidence, hesitation) and the routines used to keep decisions consistent.",
    related: ["c:risk-management", "c:money-management", "c:sentiment"],
    tools: ["drawdown"],
    strip: [
      ["is essential for consistent profitability", "Promise of profitability"],
      ["gain a significant edge over those who focus solely", "Promise of an edge"],
    ],
    replace: [
      ["Developing a Winning Mindset", "A durable mindset", "Heading promised winning"],
      ["Here are proven methods for developing discipline:", "Common methods for developing discipline:", "“Proven” is unverifiable"],
    ],
  },
  "getting-started-with-gio4x-raptor": { decision: "hold", reason: "Platform walkthrough describing unverifiable Raptor features (download flow, 100+ indicators, 16-chart layouts) and account types (Standard, Pro, VIP) that conflict with the published ones." },
  "setting-up-custom-indicators": { decision: "hold", reason: "Describes a Raptor indicator library, scripting language and “GIO4X Marketplace” that cannot be verified." },
  "using-the-algo-trading-ide": { decision: "hold", reason: "Describes a Raptor algorithmic IDE, 20 years of tick data and one-click live deployment that cannot be verified." },
  "setting-up-eas-and-trading-robots": { decision: "hold", reason: "Describes proprietary “GIO Bots”, a free VPS and Raptor file formats that cannot be verified; presents automation as free of human error." },
};

/** The ten course modules, restructured as outlines. Keys are the ids in courseModules.json. */
const MODULES = {
  1: {
    decision: "publish",
    key: "fundamentals",
    title: "Forex fundamentals",
    level: "Beginner",
    summary: "How the currency market is organised: pairs, pips and lots, sessions, the bid and ask, leverage and margin, and the basic order types.",
    reason: "Outline kept. Lesson count, duration and GIO4X instrument, lot and leverage statements dropped.",
  },
  2: {
    decision: "publish",
    key: "technical",
    title: "Technical analysis",
    level: "Intermediate",
    summary: "Reading price charts: candlesticks, support and resistance, moving averages and the common indicators, each with what it measures and where it misleads.",
    reason: "Outline kept; “Mastery” removed from the title. Lesson count and duration dropped.",
  },
  3: {
    decision: "publish",
    key: "fundamental",
    title: "Fundamental analysis",
    level: "Intermediate",
    summary: "The macroeconomic inputs to exchange rates: interest rates, growth, inflation and employment data, and central bank policy.",
    reason: "Outline kept. Lesson count and duration dropped.",
  },
  4: {
    decision: "publish",
    key: "styles",
    title: "Trading styles",
    level: "Advanced",
    summary: "Scalping, day trading, swing and position trading, hedging and breakouts, described as ways of working with their costs and constraints.",
    reason: "Outline only: no lesson content exists yet. GIO4X execution and spread statements dropped.",
  },
  5: {
    decision: "publish",
    key: "risk",
    title: "Risk and psychology",
    level: "Professional concepts",
    summary: "How risk is sized and measured, what expectancy means, and the habits that keep decisions consistent. Worth reading early, whatever your level.",
    reason: "Outline kept. Lesson count and duration dropped.",
  },
  6: { decision: "hold", reason: "“GIO4X Raptor Platform Mastery”: the whole module describes unverifiable platform features and execution speed." },
  7: {
    decision: "publish",
    key: "automation",
    title: "Automated trading",
    level: "Advanced",
    summary: "What Expert Advisors are, how backtesting and optimisation work, and why a good backtest is not a forecast.",
    reason: "Outline only: the matching lessons described unverifiable Raptor tooling and are held.",
  },
  8: { decision: "hold", reason: "“PAMM, MAM & Copy Trading”: programme terms (fees, minimums, screening) conflict between the previous sites." },
  9: {
    decision: "publish",
    key: "crypto",
    title: "Cryptocurrency markets",
    level: "Intermediate",
    summary: "Blockchain basics, Bitcoin and Ethereum, stablecoins, and how a crypto CFD differs from owning the asset.",
    reason: "Outline only: no lesson content exists yet. The “crypto CFDs on Raptor” topic dropped.",
  },
  10: {
    decision: "publish",
    key: "news",
    title: "Scheduled news",
    level: "Advanced",
    summary: "How scheduled releases and unscheduled events reach prices, and the execution risks around them.",
    reason: "Outline kept; retitled from “News Trading”. Lesson count and duration dropped.",
  },
};
const TOPIC_BLOCK = /raptor|gio4x|pamm|mam\b|copy trading|strategies$/i;

/** The three learning paths, restructured. Keys are the ids in learningPaths.json. */
const PATHS = {
  "fx-basics": {
    decision: "publish",
    key: "start-here",
    title: "Start here",
    summary: "For someone new to currency markets: the vocabulary, a first look at a chart, how leverage works, and how risk is sized before anything else.",
    reason: "Kept as the entry path. The “Forex Foundations” certificate, 42-lesson and 16-hour claims and the weekly timetable dropped. The platform step is held with the Raptor lessons.",
    steps: [
      { title: "What is forex trading?", skills: "Currency pairs, market hours, terminology", lessons: ["introduction-to-forex-trading", "understanding-currency-pairs"] },
      { title: "Your first chart", skills: "Reading candles, timeframes, basic levels", lessons: ["candlestick-patterns-masterclass", "support-and-resistance-levels"] },
      { title: "Risk and money management", skills: "Leverage and margin, position sizing, stop-loss, risk-reward", lessons: ["what-is-leverage-and-margin", "position-sizing-strategies", "risk-reward-ratio-explained"] },
    ],
  },
  "trade-management": {
    decision: "publish",
    key: "analysis",
    title: "Analysis and trade management",
    summary: "For those who know the vocabulary and want the analytical toolkit in order: structure, price action, indicators, and the discipline that holds it together.",
    reason: "Kept. The “Certified Trader” certificate, 62-lesson and 28-hour claims, the weekly timetable and the promise to “consistently profit” dropped.",
    steps: [
      { title: "Market structure and sessions", skills: "Pips, lots, leverage, session overlaps", lessons: ["introduction-to-forex-trading", "what-is-leverage-and-margin"] },
      { title: "Candlesticks and price action", skills: "Patterns, support and resistance, trendlines", lessons: ["candlestick-patterns-masterclass", "support-and-resistance-levels"] },
      { title: "Indicators and oscillators", skills: "Moving averages, RSI, MACD, Bollinger Bands", lessons: ["moving-averages-strategy", "rsi-and-macd-strategies", "bollinger-bands-trading"] },
      { title: "Fibonacci", skills: "Retracements, extensions, clusters", lessons: ["fibonacci-retracement-guide"] },
      { title: "Testing a set of rules", skills: "Building, testing and journalling a strategy", lessons: [] },
      { title: "Psychology and risk", skills: "Emotional control, risk per trade, sizing", lessons: ["managing-trading-psychology", "risk-reward-ratio-explained", "position-sizing-strategies"] },
    ],
  },
  "pamm-copy": {
    decision: "hold",
    reason: "A path built on the PAMM and copy-trading programmes, whose terms conflict between the previous sites, with a “Certified Investor” certificate and no lesson content behind it.",
  },
};

/** FAQ categories for this build. */
const FAQ_CATS = [
  { key: "getting-started", label: "Getting started", blurb: "What the markets and products are, and how an application works." },
  { key: "accounts", label: "Accounts", blurb: "Account conditions, tax and support." },
  { key: "trading-basics", label: "Trading basics", blurb: "Pips, spreads, swaps, analysis and the vocabulary of a trade." },
  { key: "margin-leverage", label: "Margin and leverage", blurb: "How leveraged positions are funded and measured." },
  { key: "orders", label: "Orders", blurb: "Size, execution and opposing positions." },
  { key: "platforms", label: "Platforms", blurb: "MetaTrader 5 and 777 Raptor." },
  { key: "funding", label: "Funding", blurb: "Currencies and the rules on who may pay in and out." },
  { key: "security", label: "Security", blurb: "Identity checks and regulatory status." },
  { key: "partners", label: "Partners", blurb: "Introducing Brokers and affiliates." },
];

/**
 * FAQ decisions by index in faqs.json. Anything not listed in KEEP is dropped
 * with the reason in DROP. `strip` trims sentences; `q` retitles the question
 * when trimming changes what the answer covers.
 */
const FAQ_KEEP = {
  66: { cat: "getting-started" },
  76: { cat: "getting-started" },
  81: {
    cat: "getting-started",
    strip: [
      ["You can lose more than your initial deposit", "Conflicts with the negative-balance statements elsewhere; neither is confirmed"],
      ["Approximately 75% of retail trader accounts lose money", "Loss percentage conflicts between the previous sites (75% vs 63.21%)"],
    ],
  },
  27: { cat: "getting-started", keep: ["register on the GIO4X website"], strip: [["can be completed in under 15 minutes", "Unverifiable processing time"]] },
  20: { cat: "accounts", q: "Who is responsible for tax on trading results?", keep: ["consulting a tax professional"], strip: [["does not withhold taxes", "Tax-withholding statement conflicts between the previous sites"]] },
  31: { cat: "trading-basics" },
  32: { cat: "trading-basics" },
  35: { cat: "trading-basics" },
  6: { cat: "trading-basics" },
  30: { cat: "trading-basics", strip: [["Detailed trading hours for each instrument are listed", "Refers to a page of the previous site"]] },
  67: { cat: "trading-basics" },
  68: { cat: "trading-basics" },
  69: { cat: "trading-basics" },
  70: { cat: "trading-basics" },
  71: { cat: "trading-basics" },
  72: { cat: "trading-basics" },
  73: { cat: "trading-basics" },
  74: { cat: "trading-basics", strip: [["Successful traders typically aim for", "Unverifiable generalisation and promise of outcome"]] },
  75: { cat: "trading-basics" },
  77: { cat: "trading-basics" },
  78: { cat: "trading-basics", strip: [["Expiry details for each instrument are listed", "Refers to a page of the previous site"]] },
  79: { cat: "trading-basics", keep: ["traded on regulated exchanges"], strip: [["CFDs offer greater flexibility and accessibility", "Promotional"]] },
  56: { cat: "trading-basics", strip: [["you can set a maximum drawdown or stop-loss on your copy trading allocation", "Unverifiable product feature"]] },
  12: { cat: "margin-leverage" },
  13: { cat: "margin-leverage" },
  15: { cat: "margin-leverage" },
  18: { cat: "margin-leverage" },
  19: { cat: "margin-leverage", strip: [["at 100% a margin call is triggered", "Margin call and stop-out levels conflict between the previous sites"]] },
  34: { cat: "orders" },
  40: { cat: "orders" },
  37: { cat: "orders" },
  61: { cat: "funding" },
  62: { cat: "funding", keep: ["accepts deposits in the following currencies"], strip: [["conversion will be applied at the prevailing market rate", "Conversion terms cannot be verified"]] },
  63: { cat: "security", strip: [["Verification is typically completed within", "Unverifiable processing time"]] },
};
const FAQ_DROP = {
  0: "Withdrawal processing times conflict between the previous sites",
  1: "Deposit and withdrawal fees conflict between the previous sites",
  2: "Client-portal procedure and processing time cannot be verified",
  3: "Client-portal procedure and two-factor authentication cannot be verified",
  4: "Answers a regulation question without naming a regulator; replaced by an honest open answer",
  5: "Funding processing times conflict between the previous sites",
  7: "Raptor automation features cannot be verified",
  8: "Leverage tiers conflict between the previous sites",
  9: "Minimum deposits conflict between the previous sites",
  10: "Negative balance protection is a flagged, conflicting claim",
  11: "Swap-free terms conflict between the previous sites",
  14: "Margin call level conflicts between the previous sites",
  16: "Client-portal procedure cannot be verified",
  17: "Stop-out level conflicts between the previous sites",
  21: "Demo account terms cannot be verified",
  22: "Client-portal and platform reporting features cannot be verified",
  23: "States Raptor is the only platform; conflicts with the MetaTrader 5 offering",
  24: "Account figures conflict between the previous sites; published only on the account types page as indicative",
  25: "“No limit” on accounts cannot be verified",
  26: "Instrument counts conflict between the previous sites",
  28: "FIX API offering cannot be verified",
  29: "Swap-free terms conflict between the previous sites",
  33: "Order-type list is a platform feature claim",
  36: "Execution speed and data-centre claims",
  38: "Mobile app features cannot be verified",
  39: "Copy-trading product description with a suitability claim",
  41: "Execution-speed claim and unverifiable trading policy",
  42: "IB programme terms conflict between the previous sites",
  43: "IB onboarding statements cannot be verified",
  44: "“Industry-leading” rebates; terms conflict",
  45: "IB payout timing conflicts between the previous sites",
  46: "IB tier structure conflicts between the previous sites",
  47: "Affiliate CPA figure cannot be verified",
  48: "Marketing-material statements cannot be verified",
  49: "IB programme terms cannot be verified",
  50: "Copy-trading product description cannot be verified",
  51: "Copy-trading minimum conflicts between the previous sites",
  52: "Copy-trading fees conflict between the previous sites",
  53: "Copy-trading product terms cannot be verified",
  54: "Copy-trading leaderboard cannot be verified",
  55: "Suitability claim (“ideal entry point for beginners”)",
  57: "Copy-trading product terms conflict between the previous sites",
  58: "“Industry-leading” security claims cannot be verified",
  59: "Segregated funds is a flagged claim",
  60: "Payment methods imply provider contracts that are not evidenced",
  64: "Negative balance protection is a flagged, conflicting claim",
  65: "Client-portal two-factor authentication cannot be verified",
  80: "Crypto CFD offering and availability statement",
};

/** Answers written for this build where the honest answer is “not yet published”, or comes straight from src/config/site.ts. */
const FAQ_EDITOR = [
  {
    cat: "security",
    kind: "open",
    q: "Is GIO4X regulated?",
    a: "This site does not yet publish a regulatory status for GIO4X. Until one is published with a register reference you can check for yourself, treat the question as open and ask us directly at info@gio4x.com. The Trust Centre lists what has and has not been disclosed.",
    links: [
      { label: "Transparency", href: "/trust/transparency" },
      { label: "Contact", href: "/contact" },
    ],
    note: "Replaces the previous answer, which did not name a regulator.",
  },
  {
    cat: "accounts",
    kind: "open",
    q: "Where are account minimums, spreads and leverage published?",
    a: "In one place: the account types page, where each figure is labelled indicative and carries its source. Earlier answers on these points disagreed with one another and have been withdrawn until they are confirmed.",
    links: [
      { label: "Account types", href: "/trading/accounts" },
      { label: "Trading conditions", href: "/trading/conditions" },
    ],
    note: "Replaces five withdrawn answers on leverage, deposits, account types, margin call and stop-out.",
  },
  {
    cat: "accounts",
    kind: "open",
    q: "What are the support hours?",
    a: "Support hours are not published yet, because earlier pages gave different answers. Write to info@gio4x.com or use the contact page.",
    links: [{ label: "Contact", href: "/contact" }],
    note: "Support hours conflict between the previous sites (24/7, 24/5, weekdays only).",
  },
  {
    cat: "platforms",
    kind: "answer",
    q: "Which platforms does GIO4X offer?",
    a: "Two: MetaTrader 5 and 777 Raptor. The platform pages describe each and compare them side by side. Feature questions that are not answered there can be sent to info@gio4x.com.",
    links: [
      { label: "Compare platforms", href: "/platforms/compare" },
      { label: "MetaTrader 5", href: "/platforms/metatrader-5" },
      { label: "777 Raptor", href: "/platforms/raptor" },
    ],
    note: "Written from src/config/site.ts; replaces an answer that named Raptor as the only platform.",
  },
  {
    cat: "funding",
    kind: "open",
    q: "How long do deposits and withdrawals take, and what do they cost?",
    a: "Processing times and fees are not published here yet: the figures on the previous site conflicted with one another. Please ask before you fund an account.",
    links: [
      { label: "Funding and withdrawals", href: "/trading/funding" },
      { label: "Contact", href: "/contact" },
    ],
    note: "Replaces three withdrawn answers on fees and processing times.",
  },
  {
    cat: "partners",
    kind: "open",
    q: "What are the Introducing Broker terms?",
    a: "Rebate rates, payment schedules and tier structures are not published here yet, because earlier statements disagreed. The partners page explains how the programme is organised; for terms, write to us through the contact page.",
    links: [
      { label: "Partners", href: "/partners" },
      { label: "Contact", href: "/contact" },
    ],
    note: "Replaces eight withdrawn answers on the IB and affiliate programmes.",
  },
];

/** Reading list. Keys are titles in books.json. */
const BOOK_RULES = {
  dropLessons: [
    ["66% annual return", "Performance figure"],
    ["consistently beat human discretionary trading", "Performance claim"],
    ["massive structural advantage", "Performance claim"],
    ["can generate consistent returns", "Performance claim"],
    ["highest-probability", "Claim of probability"],
    ["high-probability", "Claim of probability"],
    ["can predict when the next significant move", "Claim of predictive power"],
    ["one of the most reliable naked setups", "Claim of reliability"],
    ["most reliable price action pattern", "Claim of reliability"],
    ["Sharpe ratio above 2 is good", "Unsourced benchmark"],
    ["unlimited profit potential", "Promotional"],
    ["improve win rate", "Performance claim"],
    ["Choosing a broker with transparent execution", "Self-serving for a broker’s reading list"],
  ],
  replace: [
    ["across all financial markets, including forex and currency trading", "in US equity markets", "The book is about US equity market structure"],
    [", and proven trading strategies", " and trading strategies", "“Proven” is unverifiable"],
    ["reveals how mathematical models, data science, and systematic approaches generated unprecedented returns across all financial markets including forex and currency trading", "describes how the firm built its trading on mathematical models and data", "Performance claim"],
  ],
};
const STORIES = {
  "rabbit-hole": {
    decision: "hold",
    reason: "Allegorical fiction, but it asserts market-conduct claims as fact (front-running by high-frequency traders, deliberate stop-hunting) and twice urges readers towards “regulated brokers”, which this site cannot say of itself. Authorship is also unclear: the previous site carried a longer version with a different narrator.",
  },
  "managed-account-recovery": {
    decision: "hold",
    reason: "A first-person testimonial for a GIO4X “Managed Account program” with performance claims (“consistently positive on a monthly basis”, drawdowns “typically under 5%”) and a “regulated brokerage structure” statement. Flagged in the fact sheet.",
  },
};

/* ==========================================================================
   2. SANITISER
   ========================================================================== */

const ALLOWED = new Set(["h2", "h3", "p", "ul", "ol", "li", "strong", "em", "blockquote", "table", "thead", "tbody", "tr", "th", "td"]);
const RENAME = { h1: "h2", h4: "h3", h5: "h3", h6: "h3", b: "strong", i: "em" };
const DROP_WITH_CONTENT = ["svg", "script", "style", "iframe", "object", "noscript"];
const DROP_DIV_CLASSES = ["stat-grid", "chart-container"];

const stripEmoji = (s) => s.replace(/[\p{Extended_Pictographic}️‍]/gu, "");
const squash = (s) => s.replace(/\s+/g, " ").trim();
const plain = (html) =>
  squash(
    html
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'"),
  ).replace(/\s+([.,;:!?])/g, "$1");
const norm = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ");

/** Remove `<div class="…cls…">…</div>` including nested divs. */
function dropDivs(html, classes) {
  let s = html;
  for (;;) {
    const m = /<div\b[^>]*class="([^"]*)"[^>]*>/gi;
    let hit = null;
    for (let x = m.exec(s); x; x = m.exec(s)) {
      if (x[1].split(/\s+/).some((c) => classes.includes(c))) {
        hit = x;
        break;
      }
    }
    if (!hit) return s;
    let depth = 1;
    const scan = /<(\/?)div\b[^>]*>/gi;
    scan.lastIndex = hit.index + hit[0].length;
    let end = s.length;
    for (let x = scan.exec(s); x; x = scan.exec(s)) {
      depth += x[1] ? -1 : 1;
      if (depth === 0) {
        end = x.index + x[0].length;
        break;
      }
    }
    s = s.slice(0, hit.index) + s.slice(end);
  }
}

/** Allow-list sanitiser. Every attribute is dropped; `div.info-box` becomes `div.note`. */
function sanitise(html) {
  let s = String(html).replace(/<!--[\s\S]*?-->/g, "");
  for (const t of DROP_WITH_CONTENT) s = s.replace(new RegExp(`<${t}\\b[\\s\\S]*?<\\/${t}\\s*>`, "gi"), "");
  s = dropDivs(s, DROP_DIV_CLASSES);
  const divs = [];
  let out = "";
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)|</g;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m[4] !== undefined) {
      out += stripEmoji(m[4]);
      continue;
    }
    if (m[2] === undefined) continue; // a stray "<"
    const closing = m[1] === "/";
    let tag = m[2].toLowerCase();
    if (tag === "div") {
      if (closing) {
        if (divs.pop()) out += "</div>";
      } else {
        const cls = /class="([^"]*)"/i.exec(m[3])?.[1] ?? "";
        const note = cls.split(/\s+/).includes("info-box");
        divs.push(note);
        if (note) out += '<div class="note">';
      }
      continue;
    }
    if (tag === "br") {
      out += " ";
      continue;
    }
    tag = RENAME[tag] ?? tag;
    if (!ALLOWED.has(tag)) continue;
    out += closing ? `</${tag}>` : `<${tag}>`;
  }
  return out.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

/** Top-level blocks of sanitised HTML. */
function parseBlocks(html) {
  const blocks = [];
  const open = /<(h2|h3|p|ul|ol|blockquote|table|div)\b[^>]*>/g;
  let i = 0;
  while (i < html.length) {
    open.lastIndex = i;
    const m = open.exec(html);
    if (!m) {
      const rest = html.slice(i).trim();
      if (plain(rest)) blocks.push({ tag: "p", inner: rest });
      break;
    }
    const stray = html.slice(i, m.index).trim();
    if (plain(stray)) blocks.push({ tag: "p", inner: stray });
    const tag = m[1];
    const scan = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
    scan.lastIndex = m.index + m[0].length;
    let depth = 1;
    let end = html.length;
    let innerEnd = html.length;
    for (let x = scan.exec(html); x; x = scan.exec(html)) {
      depth += x[1] ? -1 : 1;
      if (depth === 0) {
        innerEnd = x.index;
        end = x.index + x[0].length;
        break;
      }
    }
    blocks.push({ tag: tag === "div" ? "note" : tag, inner: html.slice(m.index + m[0].length, innerEnd).trim() });
    i = end;
  }
  return blocks;
}

const ABBREV = /(?:\b(?:e\.g|i\.e|vs|Dr|Mr|Ms|Mrs|St|No|approx|etc|U\.S|W\.D|J|P)\.)$/;
function splitSentences(inner) {
  const parts = inner.split(/(?<=[.!?]["”’)]?(?:<\/strong>|<\/em>)?)\s+(?=(?:<strong>|<em>)?["“‘(]?[A-Z0-9$])/);
  const out = [];
  for (const p of parts) {
    if (out.length && ABBREV.test(plain(out[out.length - 1]))) out[out.length - 1] += ` ${p}`;
    else out.push(p);
  }
  return out;
}
const balanced = (s) => ["strong", "em"].every((t) => (s.match(new RegExp(`<${t}>`, "g")) ?? []).length === (s.match(new RegExp(`</${t}>`, "g")) ?? []).length);

const KEEP_CAPS = ["Fibonacci", "Bollinger Bands", "Bollinger", "Kelly", "Elliott", "Japanese", "Fed", "Federal Reserve", "European Central Bank", "Bank of England", "Bank of Japan", "New York", "London", "Tokyo", "Sydney"];
/** Headings on the previous site were Title Case; the house style is sentence case. */
function sentenceCase(text) {
  const words = text.split(" ");
  const out = words.map((w, i) => {
    const letters = w.replace(/[^A-Za-z]/g, "");
    const acronym = letters.length >= 2 && letters === letters.toUpperCase();
    const mixed = /[a-z][A-Z]/.test(w) || /[A-Z]\/[A-Z]/.test(w);
    if (acronym || mixed) return w;
    // a capital follows a full stop, a question mark, or a numbered label ("Rule 1: Never …")
    if (i === 0 || /[?.]$/.test(words[i - 1]) || /\d:$/.test(words[i - 1])) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    return w.toLowerCase();
  });
  let s = out.join(" ");
  for (const k of KEEP_CAPS) s = s.replace(new RegExp(`\\b${k}\\b`, "gi"), k);
  return s;
}

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/* ==========================================================================
   3. EDITORIAL PASS
   ========================================================================== */

const audit = { removed: [], replaced: [], sections: [], columns: [], unmatched: [] };

/** Returns the reason a sentence must go, or null. */
function flagged(text, cfg) {
  const t = norm(text);
  if ((cfg.keep ?? []).some((k) => t.includes(norm(k)))) return null;
  for (const [sub, why] of cfg.strip ?? []) {
    if (t.includes(norm(sub))) {
      cfg._hit.add(sub);
      return why;
    }
  }
  for (const r of RULES) if (r.re.test(t)) return r.why;
  return null;
}

function applyReplace(html, cfg, item) {
  let s = html;
  for (const [from, to, why] of cfg.replace ?? []) {
    const before = s;
    if (from instanceof RegExp) s = s.replace(from, to);
    else {
      const idx = norm(s).indexOf(norm(from));
      // norm() preserves length except for whitespace runs, which the sanitiser already collapsed
      if (idx >= 0) s = s.slice(0, idx) + to + s.slice(idx + from.length);
    }
    if (s !== before) {
      cfg._hit.add(String(from));
      audit.replaced.push({ item, from: String(from instanceof RegExp ? plain(before.match(from)?.[0] ?? "") : from), to, why });
    }
  }
  return s;
}

/** Strip flagged sentences from one run of inline HTML. Returns "" when nothing worth keeping is left. */
function edit(inner, cfg, item) {
  const kept = [];
  for (const sentence of splitSentences(inner)) {
    const text = plain(sentence);
    if (!text) continue;
    const why = flagged(text, cfg);
    if (why) audit.removed.push({ item, text, why });
    else kept.push(sentence);
  }
  let res = kept.join(" ");
  if (!balanced(res)) {
    audit.removed.push({ item, text: plain(res), why: "Fragment left with broken markup after a removal" });
    return "";
  }
  const left = plain(res);
  if (!left) return "";
  const words = left.split(" ").length;
  const removedSomething = kept.length < splitSentences(inner).length;
  if (removedSomething && (/:$/.test(left) || (words < 4 && !/[.!?]$/.test(left)))) {
    audit.removed.push({ item, text: left, why: "Label left without content after a removal" });
    return "";
  }
  return res;
}

function editTable(inner, cfg, item) {
  const rows = [...inner.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<(th|td)>([\s\S]*?)<\/\1>/g)].map((c) => ({ tag: c[1], html: c[2] })));
  if (!rows.length) return "";
  const head = rows[0].map((c) => plain(c.html));
  const dropIdx = new Set();
  for (const [name, why] of cfg.dropColumns ?? []) {
    const i = head.indexOf(name);
    if (i >= 0) {
      dropIdx.add(i);
      cfg._hit.add(`col:${name}`);
      audit.columns.push({ item, column: name, why });
    }
  }
  for (const row of rows)
    for (const cell of row) {
      const why = flagged(plain(cell.html), { ...cfg, strip: [] });
      if (why) audit.unmatched.push(`${item}: table cell needs review (“${plain(cell.html)}”: ${why})`);
    }
  const render = (row, i) => `<tr>${row.filter((_, k) => !dropIdx.has(k)).map((c) => `<${i === 0 ? "th" : c.tag}>${c.html}</${i === 0 ? "th" : c.tag}>`).join("")}</tr>`;
  return `<thead>${render(rows[0], 0)}</thead><tbody>${rows.slice(1).map((r, i) => render(r, i + 1)).join("")}</tbody>`;
}

/** Bold on the previous Academy pages was keyword stuffing. Keep it only as a leading label. */
function unbold(inner) {
  let first = true;
  return inner.replace(/<strong>([\s\S]*?)<\/strong>/g, (m, t, offset) => {
    const leading = first && plain(inner.slice(0, offset)) === "";
    first = false;
    return leading ? m : t;
  });
}

/**
 * The whole pipeline for one body: sanitise, correct, strip, tidy, add ids.
 * Returns { body, toc, words }.
 */
function editBody(html, cfg, item, opts = {}) {
  cfg._hit = new Set();
  // corrections are applied per block, after keyword bolding is removed, so that markup cannot hide a phrase
  const prep = (inner) => applyReplace(opts.unbold ? unbold(inner) : inner, cfg, item);
  let blocks = parseBlocks(sanitise(html)).map((b) => {
    if (b.tag === "ul" || b.tag === "ol") return { ...b, inner: b.inner.replace(/<li>([\s\S]*?)<\/li>/g, (_, li) => `<li>${prep(li)}</li>`) };
    if (b.tag === "table") return { ...b, inner: applyReplace(b.inner, cfg, item) };
    return { ...b, inner: prep(b.inner) };
  });

  // Academy articles used one h2 (a repeat of the title) and h3 for sections.
  const h2s = blocks.filter((b) => b.tag === "h2").length;
  const h3s = blocks.filter((b) => b.tag === "h3").length;
  if (h2s <= 1 && h3s >= 2) blocks = blocks.filter((b) => b.tag !== "h2").map((b) => (b.tag === "h3" ? { ...b, tag: "h2" } : b));

  // whole sections
  const dropTitles = new Map((cfg.dropSections ?? []).map(([t, why]) => [norm(t), why]));
  let dropping = null;
  blocks = blocks.filter((b) => {
    if (b.tag === "h2") {
      const t = norm(plain(b.inner));
      dropping = dropTitles.has(t) ? { title: plain(b.inner), why: dropTitles.get(t) } : null;
      if (dropping) {
        cfg._hit.add(`sec:${t}`);
        audit.sections.push({ item, section: dropping.title, why: dropping.why });
      }
    } else if (dropping) {
      const text = plain(b.inner);
      if (text) audit.removed.push({ item, text, why: `Section “${dropping.title}” removed: ${dropping.why}` });
    }
    return !dropping;
  });

  // sentence-level editing
  const edited = [];
  for (const b of blocks) {
    if (b.tag === "h2" || b.tag === "h3") {
      const why = flagged(plain(b.inner), cfg);
      if (why) audit.unmatched.push(`${item}: heading needs a decision (“${plain(b.inner)}”: ${why})`);
      edited.push({ ...b, inner: sentenceCase(plain(b.inner)) });
    } else if (b.tag === "ul" || b.tag === "ol") {
      const items = [...b.inner.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => edit(m[1], cfg, item)).filter(Boolean);
      if (items.length) edited.push({ ...b, inner: items.map((x) => `<li>${x}</li>`).join("") });
    } else if (b.tag === "table") {
      const t = editTable(b.inner, cfg, item);
      if (t) edited.push({ ...b, inner: t });
    } else if (b.tag === "note") {
      const text = edit(b.inner.replace(/<\/?p>/g, " ").trim(), cfg, item);
      if (text) edited.push({ ...b, inner: `<p>${text}</p>` });
    } else {
      const text = edit(b.inner, cfg, item);
      if (text) edited.push({ ...b, inner: text });
    }
  }

  // tidy: introductions to removed lists, then empty sections
  const tidy = [];
  for (let i = 0; i < edited.length; i++) {
    const b = edited[i];
    const next = edited[i + 1];
    if (b.tag === "p" && /:$/.test(plain(b.inner)) && (!next || next.tag === "h2" || next.tag === "h3")) {
      audit.removed.push({ item, text: plain(b.inner), why: "Introduced a list that was removed" });
      continue;
    }
    tidy.push(b);
  }
  const final = [];
  for (let i = 0; i < tidy.length; i++) {
    const b = tidy[i];
    const next = tidy[i + 1];
    if (b.tag === "h3" && (!next || next.tag === "h2" || next.tag === "h3")) continue;
    if (b.tag === "h2" && (!next || next.tag === "h2")) {
      audit.sections.push({ item, section: b.inner, why: "Nothing publishable remained in the section" });
      continue;
    }
    final.push(b);
  }

  // serialise
  const toc = [];
  const used = new Set();
  const body = final
    .map((b) => {
      if (b.tag === "h2") {
        let id = slugify(b.inner) || "section";
        for (let n = 2; used.has(id); n++) id = `${slugify(b.inner)}-${n}`;
        used.add(id);
        toc.push({ id, text: b.inner });
        return `<h2 id="${id}">${b.inner}</h2>`;
      }
      if (b.tag === "note") return `<div class="note">${b.inner}</div>`;
      return `<${b.tag}>${b.inner}</${b.tag}>`;
    })
    .join("\n");

  // anything in the decision table that matched nothing is a typo or a source change
  for (const [sub] of cfg.strip ?? []) if (!cfg._hit.has(sub)) audit.unmatched.push(`${item}: strip rule matched nothing (“${sub}”)`);
  for (const [from] of cfg.replace ?? []) if (!cfg._hit.has(String(from))) audit.unmatched.push(`${item}: replace rule matched nothing (“${from}”)`);
  for (const [t] of cfg.dropSections ?? []) if (!cfg._hit.has(`sec:${norm(t)}`)) audit.unmatched.push(`${item}: section not found (“${t}”)`);
  for (const [c] of cfg.dropColumns ?? []) if (!cfg._hit.has(`col:${c}`)) audit.unmatched.push(`${item}: table column not found (“${c}”)`);

  const words = plain(body).split(" ").filter(Boolean).length;
  return { body, toc, words };
}

/** One paragraph of plain text (FAQ answers, book descriptions). */
function processText(text, cfg, item) {
  cfg._hit = new Set();
  const out = edit(applyReplace(stripEmoji(squash(String(text))), cfg, item), cfg, item);
  for (const [sub] of cfg.strip ?? []) if (!cfg._hit.has(sub)) audit.unmatched.push(`${item}: strip rule matched nothing (“${sub}”)`);
  return plain(out);
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function isoDate(s) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})$/.exec(s.trim());
  if (!m || !MONTHS[m[1].toLowerCase()]) throw new Error(`Unrecognised date: ${s}`);
  return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}
const readMinutes = (words) => Math.max(1, Math.ceil(words / 220));

/* ---- valid knowledge-graph ids, read from the data modules --------------- */
function graphIds() {
  const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
  const ids = new Set();
  const inst = read("src/data/instruments.ts");
  for (const m of inst.matchAll(/slug: "([a-z0-9-]+)"/g)) ids.add(`i:${m[1]}`);
  for (const m of inst.matchAll(/fx\("([A-Z]{3})", "([A-Z]{3})"/g)) ids.add(`i:${m[1].toLowerCase()}-${m[2].toLowerCase()}`);
  for (const m of inst.matchAll(/key: "([a-z]+)",/g)) ids.add(`ac:${m[1]}`);
  const know = read("src/data/knowledge.ts");
  for (const m of know.matchAll(/\{ code: "([A-Z]{3})"/g)) ids.add(`ccy:${m[1]}`);
  for (const m of know.matchAll(/\{ slug: "([a-z-]+)", name: "[^"]+", short: "[^"]+", currency/g)) ids.add(`cb:${m[1]}`);
  for (const m of know.matchAll(/^\s{4}slug: "([a-z-]+)",/gm)) ids.add(`ev:${m[1]}`);
  for (const t of JSON.parse(read("src/data/generated/glossary.json"))) ids.add(`c:${t.slug}`);
  for (const m of read("src/data/glossary.ts").matchAll(/\{ slug: "([a-z0-9-]+)", term:/g)) ids.add(`c:${m[1]}`);
  const tools = new Set([...read("src/data/tools.ts").matchAll(/^\s{4}slug: "([a-z-]+)",/gm)].map((m) => m[1]));
  return { ids, tools };
}
const GRAPH = graphIds();
const problems = [];
function checkRelated(item, related) {
  for (const id of related) if (!GRAPH.ids.has(id)) problems.push(`${item}: unknown knowledge-graph id ${id}`);
}

/* ==========================================================================
   4. BUILD
   ========================================================================== */

const SECTIONS = ["markets", "macro", "forex", "commodities", "crypto", "education", "risk", "technical", "platforms", "gio4x"];
const FORMATS = ["Analysis", "Explainer", "Guide", "Deep Dive", "Research Note", "GIO4X"];
const INVENTED_BYLINES = /David Chen|Sarah Mitchell/;

/* ---- Intelligence -------------------------------------------------------- */
const blog = readJson("blog.json");
const articles = [];
const articleLog = [];
for (const post of blog) {
  const cfg = ARTICLES[post.slug];
  if (!cfg) {
    problems.push(`blog: no editorial decision for “${post.slug}”`);
    continue;
  }
  articleLog.push({ slug: post.slug, was: post.title, title: cfg.title ?? post.title, decision: cfg.decision, reason: cfg.reason, byline: post.author });
  if (cfg.decision === "hold") continue;
  const item = `intelligence/${post.slug}`;
  const { body, toc, words } = editBody(post.content, cfg, item);
  if (!SECTIONS.includes(cfg.section)) problems.push(`${item}: invalid section`);
  if (!FORMATS.includes(cfg.format)) problems.push(`${item}: invalid format`);
  if (cfg.description.length > 155) problems.push(`${item}: description is ${cfg.description.length} characters`);
  if (cfg.brief.length < 3 || cfg.brief.length > 5) problems.push(`${item}: brief must have 3 to 5 points`);
  if (INVENTED_BYLINES.test(cfg.byline) || !Object.values(DESK).includes(cfg.byline)) problems.push(`${item}: byline must be a desk`);
  if ((cfg.decision === "publish-with-notice") !== Boolean(cfg.notice)) problems.push(`${item}: notice and decision disagree`);
  checkRelated(item, cfg.related);
  const published = isoDate(post.date);
  articles.push({
    slug: post.slug,
    title: cfg.title,
    excerpt: cfg.excerpt,
    description: cfg.description,
    section: cfg.section,
    format: cfg.format,
    byline: cfg.byline,
    published,
    updated: AUDIT_DATE,
    readMinutes: readMinutes(words),
    tags: (post.tags ?? []).filter((t) => !TAG_BLOCK.test(t)),
    related: cfg.related,
    toc,
    brief: cfg.brief,
    body,
    ...(cfg.notice ? { notice: cfg.notice } : {}),
  });
}
articles.sort((a, b) => b.published.localeCompare(a.published));

/* ---- Academy ------------------------------------------------------------- */
const education = readJson("education.json");
const lessons = [];
const lessonLog = [];
for (const [order, src] of education.entries()) {
  const cfg = LESSONS[src.id];
  if (!cfg) {
    problems.push(`education: no editorial decision for “${src.id}”`);
    continue;
  }
  lessonLog.push({ slug: src.id, was: src.title, title: cfg.title ?? src.title, decision: cfg.decision, reason: cfg.reason });
  if (cfg.decision === "hold") continue;
  const item = `academy/${src.id}`;
  const { body, toc, words } = editBody(src.content, cfg, item, { unbold: true });
  if (cfg.description.length > 155) problems.push(`${item}: description is ${cfg.description.length} characters`);
  checkRelated(item, cfg.related);
  for (const t of cfg.tools) if (!GRAPH.tools.has(t)) problems.push(`${item}: unknown tool ${t}`);
  lessons.push({
    slug: src.id,
    title: cfg.title,
    description: cfg.description,
    level: cfg.level,
    module: cfg.module,
    order,
    byline: DESK.academy,
    published: isoDate(src.date),
    updated: AUDIT_DATE,
    readMinutes: readMinutes(words),
    tags: (src.tags ?? []).filter((t) => !TAG_BLOCK.test(t)).slice(0, 6),
    related: cfg.related,
    tools: cfg.tools,
    toc,
    body,
  });
}

const courseModules = readJson("courseModules.json");
const modules = [];
const moduleLog = [];
for (const src of courseModules) {
  const cfg = MODULES[src.id];
  if (!cfg) {
    problems.push(`courseModules: no editorial decision for module ${src.id}`);
    continue;
  }
  moduleLog.push({ was: src.title, title: cfg.title ?? src.title, decision: cfg.decision, reason: cfg.reason, dropped: `${src.lessons} lessons, ${src.duration}` });
  if (cfg.decision === "hold") continue;
  const topics = String(src.topics)
    .split(",")
    .map((t) => squash(t))
    .filter((t) => t && !TOPIC_BLOCK.test(t))
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1));
  modules.push({ key: cfg.key, title: cfg.title, level: cfg.level, summary: cfg.summary, topics, lessons: lessons.filter((l) => l.module === cfg.key).map((l) => l.slug) });
}
for (const l of lessons) if (!modules.some((m) => m.key === l.module)) problems.push(`academy/${l.slug}: module “${l.module}” is not published`);

const learningPaths = readJson("learningPaths.json");
const paths = [];
const pathLog = [];
for (const src of learningPaths) {
  const cfg = PATHS[src.id];
  if (!cfg) {
    problems.push(`learningPaths: no editorial decision for “${src.id}”`);
    continue;
  }
  pathLog.push({ was: src.title, title: cfg.title ?? src.title, decision: cfg.decision, reason: cfg.reason, dropped: `${src.stats?.lessons} lessons, ${src.stats?.hours} hours, “${src.stats?.cert}” certificate` });
  if (cfg.decision === "hold") continue;
  for (const s of cfg.steps) for (const slug of s.lessons) if (!lessons.some((l) => l.slug === slug)) problems.push(`path ${cfg.key}: lesson “${slug}” is not published`);
  paths.push({ key: cfg.key, title: cfg.title, summary: cfg.summary, steps: cfg.steps });
}
paths.sort((a, b) => (a.key === "start-here" ? -1 : b.key === "start-here" ? 1 : 0));

/* ---- FAQ ----------------------------------------------------------------- */
const faqSrc = readJson("faqs.json");
const faqItems = [];
const faqLog = [];
faqSrc.forEach((f, i) => {
  const keep = FAQ_KEEP[i];
  if (!keep) {
    if (!FAQ_DROP[i]) problems.push(`faq #${i}: no editorial decision (“${f.q}”)`);
    faqLog.push({ i, q: f.q, decision: "drop", reason: FAQ_DROP[i] ?? "No decision" });
    return;
  }
  const item = `faq/${i}`;
  const before = audit.removed.length;
  const a = processText(f.a, keep, item);
  const trimmed = audit.removed.length > before;
  if (!a) {
    faqLog.push({ i, q: f.q, decision: "drop", reason: "Nothing publishable remained after trimming" });
    return;
  }
  const q = keep.q ?? f.q;
  faqItems.push({ id: slugify(q), cat: keep.cat, kind: "answer", q, a });
  faqLog.push({ i, q: f.q, decision: trimmed ? "keep, trimmed" : "keep", reason: keep.q ? `Question retitled “${keep.q}”` : trimmed ? "See removed sentences" : "General education or a fact both previous sites agree on" });
});
for (const e of FAQ_EDITOR) faqItems.push({ id: slugify(e.q), cat: e.cat, kind: e.kind, q: e.q, a: e.a, links: e.links });
const faqs = {
  categories: FAQ_CATS,
  items: FAQ_CATS.flatMap((c) => {
    const inCat = faqItems.filter((f) => f.cat === c.key);
    return [...inCat.filter((f) => f.links), ...inCat.filter((f) => !f.links)];
  }),
};
for (const f of faqItems) if (!FAQ_CATS.some((c) => c.key === f.cat)) problems.push(`faq “${f.q}”: unknown category`);
const dupFaq = faqs.items.map((f) => f.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dupFaq.length) problems.push(`faq: duplicate ids ${dupFaq.join(", ")}`);

/* ---- Books --------------------------------------------------------------- */
const bookSrc = readJson("books.json");
const books = [];
const bookLog = [];
for (const b of bookSrc) {
  const item = `books/${slugify(b.title)}`;
  const description = processText(b.description, { replace: BOOK_RULES.replace.filter(([from]) => norm(b.description).includes(norm(from))) }, item);
  const keptLessons = [];
  for (const l of b.keyLessons ?? []) {
    const hit = BOOK_RULES.dropLessons.find(([sub]) => norm(l).toLowerCase().includes(sub.toLowerCase()));
    const cfg = { _hit: new Set(), keep: ["operates 24/5"] };
    const auto = hit ? hit[1] : flagged(l, cfg);
    if (auto) audit.removed.push({ item, text: l, why: `Key lesson: ${auto}` });
    else keptLessons.push(squash(stripEmoji(l)));
  }
  if (!description) problems.push(`${item}: no description left`);
  books.push({ slug: slugify(b.title), title: b.title, author: b.author, category: b.category, year: b.year, description, lessons: keptLessons });
  bookLog.push({ title: b.title, author: b.author, keptLessons: keptLessons.length, of: (b.keyLessons ?? []).length });
}
const stories = readJson("stories.json");
const storyLog = stories.map((s) => ({ id: s.id, title: s.title, ...(STORIES[s.id] ?? { decision: "hold", reason: "No decision recorded" }) }));

/* ---- final scan: nothing flagged may survive ----------------------------- */
const FINAL = [/David Chen|Sarah Mitchell/, /\bRaptor\b|\bAlgorator\b/, /negative balance protection/i, /\bsegregated\b/i, /\baward/i, /<(?!\/?(?:h2|h3|p|ul|ol|li|strong|em|blockquote|table|thead|tbody|tr|th|td|div)\b)/, /\son\w+=|javascript:/i, /[\p{Extended_Pictographic}]/u];
const scan = (label, text) => {
  for (const re of FINAL) if (re.test(text)) problems.push(`${label}: final scan matched ${re}`);
};
for (const a of articles) scan(`intelligence/${a.slug}`, `${a.byline} ${a.title} ${a.excerpt} ${a.body}`);
for (const l of lessons) scan(`academy/${l.slug}`, `${l.title} ${l.description} ${l.body}`);
for (const f of faqs.items) if (!f.links) scan(`faq/${f.id}`, `${f.q} ${f.a}`);
for (const b of books) scan(`books/${b.slug}`, `${b.description} ${b.lessons.join(" ")}`);

if (problems.length) {
  say("import-content: stopped. Fix these before anything is written:");
  for (const p of problems) say(`  - ${p}`);
  process.exit(1);
}

/* ==========================================================================
   5. WRITE
   ========================================================================== */

fs.mkdirSync(OUT, { recursive: true });
const write = (name, data) => fs.writeFileSync(path.join(OUT, name), `${JSON.stringify(data, null, 2)}\n`);
write("articles.json", articles);
write("academy.json", { lessons, modules, paths });
write("faqs.json", faqs);
write("books.json", books);

/* ---- audit document ------------------------------------------------------ */
const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const count = (log, d) => log.filter((x) => x.decision === d).length;
const table = (head, rows) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`)].join("\n");
const removedFor = (prefix) => audit.removed.filter((r) => r.item.startsWith(prefix));
const groupBy = (list, key) => list.reduce((m, x) => m.set(x[key], [...(m.get(x[key]) ?? []), x]), new Map());

const md = [];
md.push("# Content audit");
md.push("");
md.push(`Generated by \`scripts/import-content.mjs\` (editorial revision dated ${AUDIT_DATE}). Do not edit by hand: change the decision tables in the script and run it again.`);
md.push("");
md.push("The content of the previous GIO4X site was read item by item and each item was given one decision:");
md.push("");
md.push("- **publish**: carried over after sanitising and trimming;");
md.push("- **publish-with-notice**: time-sensitive, carried over with a dated notice above the body;");
md.push("- **hold**: not imported. Its substance is an unverifiable GIO4X product or performance claim, a programme whose facts conflict, a price forecast or a trade call.");
md.push("");
md.push("Rules applied to everything published: HTML reduced to an allow-list (headings, paragraphs, lists, emphasis, blockquotes, tables and a `note` box; every attribute, `svg`, statistics panel, script, style and emoji dropped); invented bylines (“David Chen”, “Sarah Mitchell”) replaced by desk bylines; any sentence stating an unverifiable GIO4X claim or instructing the reader to buy or sell removed; headings set in sentence case. Bold used for keyword stuffing in the Academy articles was removed, which changes no wording.");
md.push("");
md.push("## Totals");
md.push("");
md.push(
  table(
    ["Collection", "Source items", "Published", "With notice", "Held or dropped"],
    [
      ["Intelligence (blog posts)", blog.length, count(articleLog, "publish"), count(articleLog, "publish-with-notice"), count(articleLog, "hold")],
      ["Academy lessons", education.length, count(lessonLog, "publish"), 0, count(lessonLog, "hold")],
      ["Course modules (as outlines)", courseModules.length, count(moduleLog, "publish"), 0, count(moduleLog, "hold")],
      ["Learning paths", learningPaths.length, count(pathLog, "publish"), 0, count(pathLog, "hold")],
      ["FAQ answers", faqSrc.length, faqLog.filter((f) => f.decision !== "drop").length, 0, faqLog.filter((f) => f.decision === "drop").length],
      ["Books", bookSrc.length, books.length, 0, 0],
      ["Featured stories", stories.length, 0, 0, stories.length],
    ],
  ),
);
md.push("");
md.push(`Sentences and list items removed from published items: **${audit.removed.length}**. Corrections inside sentences: **${audit.replaced.length}**. Sections removed whole: **${audit.sections.length}**. FAQ answers written for this build: **${FAQ_EDITOR.length}**.`);
md.push("");

md.push("## Intelligence");
md.push("");
md.push(table(["Item", "Previous byline", "Decision", "Reason"], articleLog.map((a) => [a.decision === "hold" ? a.was : `${a.title} (was “${a.was}”)`, INVENTED_BYLINES.test(a.byline) ? `${a.byline} (invented, removed)` : a.byline, a.decision, a.reason])));
md.push("");
md.push("## Academy lessons");
md.push("");
md.push(table(["Item", "Decision", "Reason"], lessonLog.map((a) => [a.decision === "hold" ? a.was : a.title === a.was ? a.title : `${a.title} (was “${a.was}”)`, a.decision, a.reason])));
md.push("");
md.push("## Course modules");
md.push("");
md.push("Published as outlines: a title, a level, a one-line summary, the topic list, and links to the lessons that actually exist. The lesson counts and durations below were not backed by content and are not published.");
md.push("");
md.push(table(["Module", "Decision", "Claim dropped", "Reason"], moduleLog.map((m) => [m.title === m.was ? m.title : `${m.title} (was “${m.was}”)`, m.decision, m.dropped, m.reason])));
md.push("");
md.push("## Learning paths");
md.push("");
md.push(table(["Path", "Decision", "Claim dropped", "Reason"], pathLog.map((m) => [m.title === m.was ? m.title : `${m.title} (was “${m.was}”)`, m.decision, m.dropped, m.reason])));
md.push("");
md.push("## FAQ");
md.push("");
md.push(`Re-categorised into: ${FAQ_CATS.map((c) => c.label).join(", ")}.`);
md.push("");
md.push(table(["#", "Question", "Decision", "Reason"], faqLog.map((f) => [f.i, f.q, f.decision, f.reason])));
md.push("");
md.push("### Answers written for this build");
md.push("");
md.push("Where every previous answer had to be withdrawn, the page says so plainly instead of leaving a gap.");
md.push("");
md.push(table(["Category", "Question", "Kind", "Why"], FAQ_EDITOR.map((e) => [FAQ_CATS.find((c) => c.key === e.cat).label, e.q, e.kind === "open" ? "not yet published" : "answer", e.note])));
md.push("");
md.push("## Books and stories");
md.push("");
md.push(`All ${books.length} titles are kept with title, author, category, year, a description and key lessons. Dropped from every entry: the star rating and page count (auto-filled, edition-dependent), the purchase link, the chapter list and the quotation (attributions could not be checked). The year is kept: each was checked against the known first-publication or cited-edition year. In every description the sentences beginning “GIO4X Academy recommends…” were removed; they are logged below.`);
md.push("");
md.push(table(["Story", "Decision", "Reason"], storyLog.map((s) => [s.title, s.decision, s.reason])));
md.push("");

md.push("## Sections removed whole");
md.push("");
md.push(table(["Item", "Section", "Reason"], audit.sections.map((s) => [s.item, s.section, s.why])));
md.push("");
md.push("## Table columns removed");
md.push("");
md.push(table(["Item", "Column", "Reason"], audit.columns.map((s) => [s.item, s.column, s.why])));
md.push("");
md.push("## Corrections inside sentences");
md.push("");
md.push(table(["Item", "Was", "Now", "Reason"], audit.replaced.map((r) => [r.item, r.from, r.to || "(removed)", r.why])));
md.push("");
md.push("## Removed sentences");
md.push("");
for (const [prefix, label] of [
  ["intelligence/", "Intelligence"],
  ["academy/", "Academy"],
  ["faq/", "FAQ"],
  ["books/", "Books"],
]) {
  md.push(`### ${label}`);
  md.push("");
  for (const [item, rows] of groupBy(removedFor(prefix), "item")) {
    const name = prefix === "faq/" ? `FAQ #${item.slice(4)}: ${faqSrc[Number(item.slice(4))].q}` : item;
    md.push(`**${name}**`);
    md.push("");
    for (const r of rows) md.push(`- “${r.text}” _${r.why}._`);
    md.push("");
  }
}
if (audit.unmatched.length) {
  md.push("## Needs attention");
  md.push("");
  for (const u of audit.unmatched) md.push(`- ${u}`);
  md.push("");
}
fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true });
fs.writeFileSync(AUDIT_FILE, `${md.join("\n").trimEnd()}\n`);

say(`import-content: wrote ${articles.length} articles, ${lessons.length} lessons, ${modules.length} modules, ${paths.length} paths, ${faqs.items.length} FAQ answers, ${books.length} books.`);
say(`  Intelligence: ${count(articleLog, "publish")} published, ${count(articleLog, "publish-with-notice")} with notice, ${count(articleLog, "hold")} held.`);
say(`  Academy: ${count(lessonLog, "publish")} lessons published, ${count(lessonLog, "hold")} held.`);
say(`  FAQ: ${faqLog.filter((f) => f.decision !== "drop").length} kept, ${faqLog.filter((f) => f.decision === "drop").length} dropped, ${FAQ_EDITOR.length} written.`);
say(`  Removed ${audit.removed.length} sentences, corrected ${audit.replaced.length}, dropped ${audit.sections.length} sections. Log: docs/CONTENT-AUDIT.md`);
if (audit.unmatched.length) {
  say(`  ${audit.unmatched.length} item(s) need attention:`);
  for (const u of audit.unmatched) say(`    - ${u}`);
}

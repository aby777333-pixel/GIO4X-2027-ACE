import type { TermQuiz } from "./glossary-learn/types";

/**
 * Three questions at the end of every Academy lesson, by lesson slug.
 *
 * Each question is written from the lesson's own text: the right answer is
 * supported by a sentence in that lesson, and `because` points to the idea.
 * Three or four options, one right. No trick questions, and nothing here says
 * what to trade: a question asks what the lesson says, not what to do.
 *
 * The shape is the glossary's (TermQuiz), so the same form asks them.
 */
export type LessonQuestions = readonly [TermQuiz, TermQuiz, TermQuiz];

export const academyQuiz: Record<string, LessonQuestions> = {
  "introduction-to-forex-trading": [
    {
      question: "When you buy a currency pair, what are you doing?",
      options: ["Buying the base currency and selling the quote currency at the same time", "Buying both currencies in the pair", "Selling the base currency and buying the quote currency"],
      answer: 0,
      because: "The lesson says that buying a pair means purchasing the base currency and simultaneously selling the quote currency.",
    },
    {
      question: "If EUR/USD is quoted at 1.1050, what does the quote say?",
      options: ["One US dollar costs 1.1050 euros", "One euro costs 1.1050 US dollars", "The pair has moved 1.1050 pips"],
      answer: 1,
      because: "The price of a pair is how much of the quote currency is needed to buy one unit of the base currency, and the euro is the base here.",
    },
    {
      question: "When is the forex market open, according to the lesson?",
      options: ["Only while the London session is open", "24 hours a day, seven days a week", "24 hours a day, five days a week"],
      answer: 2,
      because: "Unlike a stock exchange, the lesson says, the forex market operates 24 hours a day, five days a week, across four sessions.",
    },
  ],

  "understanding-currency-pairs": [
    {
      question: "What is the spread?",
      options: ["The difference between the day’s high and low", "The difference between the bid and the ask", "A commission charged on every lot"],
      answer: 1,
      because: "Every pair has a bid and an ask; the lesson calls the difference between them the spread, and it represents the cost of the trade.",
    },
    {
      question: "EUR/USD shows a bid of 1.1198 and an ask of 1.1200. How wide is the spread?",
      options: ["2 pips", "20 pips", "0.2 pips"],
      answer: 0,
      because: "For most pairs a pip is the fourth decimal place, so the 0.0002 between the two prices is 2 pips, as in the lesson’s example.",
    },
    {
      question: "What do the major pairs have in common?",
      options: ["They all include the euro", "None of them includes the US dollar", "They all include the US dollar"],
      answer: 2,
      because: "The lesson lists the majors and notes that every one includes the US dollar; minor (cross) pairs are the ones that do not.",
    },
  ],

  "what-is-leverage-and-margin": [
    {
      question: "With 100:1 leverage, how much margin does a standard lot of $100,000 need in the lesson’s example?",
      options: ["$100", "$1,000", "$10,000"],
      answer: 1,
      because: "Required margin is the position size divided by the leverage ratio: $100,000 ÷ 100 = $1,000, which is a 1% margin requirement.",
    },
    {
      question: "How does the lesson describe margin?",
      options: ["A portion of the account’s equity set aside as collateral", "A fee charged for opening a position", "The profit made on a leveraged trade"],
      answer: 0,
      because: "The lesson is explicit that margin is not a fee or a cost: it is part of the account’s equity held as collateral for the position.",
    },
    {
      question: "What happens at the stop out level?",
      options: ["The broker raises the leverage on the account", "The broker asks for a deposit and waits", "The broker automatically closes losing positions"],
      answer: 2,
      because: "A margin call is the warning; the stop out is the point at which the broker closes losing positions automatically to limit further losses.",
    },
  ],

  "candlestick-patterns-masterclass": [
    {
      question: "Which four prices does every candlestick contain?",
      options: ["The bid, the ask, the spread and the volume", "The open, the high, the low and the close", "The open, the close, the average and the volume"],
      answer: 1,
      because: "The lesson’s anatomy of a candle names four data points: the open, high, low and close.",
    },
    {
      question: "What does the body of a candle represent?",
      options: ["The range between the open and the close", "The range between the high and the low", "The number of trades in the period"],
      answer: 0,
      because: "The rectangular body spans the open and the close; the thin wicks, or shadows, show the high and the low.",
    },
    {
      question: "What is a doji?",
      options: ["A candle with no wicks at all", "A candle with a small body at the top and a long lower wick", "A candle whose open and close are virtually identical"],
      answer: 2,
      because: "The lesson describes the doji as a candle where the open and close are virtually identical; the other two descriptions are the marubozu and the hammer.",
    },
  ],

  "support-and-resistance-levels": [
    {
      question: "How does the lesson picture a support level?",
      options: ["As a ceiling above the price, where selling pressure gathers", "As a floor beneath the price, where buying interest is concentrated", "As the average of the last fifty closing prices"],
      answer: 1,
      because: "Support is described as a floor beneath the price; resistance is its opposite, a ceiling above it.",
    },
    {
      question: "What is the polarity principle?",
      options: ["A level becomes weaker each time it is tested", "A trendline needs exactly two touch points", "Once a support level is broken it often becomes resistance, and the reverse"],
      answer: 2,
      because: "The lesson calls this role reversal the polarity principle: broken support often acts as resistance afterwards, and vice versa.",
    },
    {
      question: "Why does the lesson say to treat levels as zones rather than exact prices?",
      options: ["Because price may slightly overshoot a level before reversing", "Because a level is only valid for a single day", "Because levels can only be drawn on a weekly chart"],
      answer: 0,
      because: "The steps for drawing horizontal levels end with this point: price may slightly overshoot before it reverses, so a level is a zone.",
    },
  ],

  "moving-averages-strategy": [
    {
      question: "How is a 20-period simple moving average calculated?",
      options: ["It adds the last 20 closing prices and divides by 20", "It gives the most recent prices more weight than older ones", "It halves the sum of the highest and lowest of the last 20 prices"],
      answer: 0,
      because: "The simple moving average is the arithmetic mean of the closing prices in the period, with equal weight given to each.",
    },
    {
      question: "How does an exponential moving average differ from a simple one?",
      options: ["It ignores the most recent prices", "It applies more weight to recent prices, so it responds faster", "It can only be calculated on daily charts"],
      answer: 1,
      because: "The lesson says the exponential average weights recent price data more heavily, which makes it more responsive and also more prone to false signals.",
    },
    {
      question: "What does the term golden cross describe?",
      options: ["The price crossing above its 20-period average", "The 50-period average crossing below the 200-period average", "The 50-period average crossing above the 200-period average"],
      answer: 2,
      because: "The golden cross is the 50-period average crossing above the 200-period average; the cross below is called the death cross.",
    },
  ],

  "fibonacci-retracement-guide": [
    {
      question: "Which ratio does each number in the Fibonacci sequence, divided by the one before it, approach?",
      options: ["0.5", "1.618", "3.142"],
      answer: 1,
      because: "The lesson calls 1.618 the golden ratio and says it is the mathematical basis of the Fibonacci levels.",
    },
    {
      question: "Which widely watched retracement level is, by the lesson’s account, not a true Fibonacci ratio?",
      options: ["23.6%", "38.2%", "50.0%", "61.8%"],
      answer: 2,
      because: "The 50% level is watched because markets frequently retrace half of a move, but the lesson notes it is not a true Fibonacci ratio.",
    },
    {
      question: "What are Fibonacci extension levels used for?",
      options: ["Projecting beyond the initial move to identify potential targets", "Measuring how volatile the market is", "Finding the swing low to start drawing from"],
      answer: 0,
      because: "Extensions such as 127.2% and 161.8% project beyond the initial move; the lesson says traders use them to gauge how far a trend might extend.",
    },
  ],

  "rsi-and-macd-strategies": [
    {
      question: "What is a market conventionally called when the RSI is above 70?",
      options: ["Overbought", "Oversold", "Neutral"],
      answer: 0,
      because: "On the RSI’s scale of 0 to 100, the lesson gives above 70 as overbought and below 30 as oversold.",
    },
    {
      question: "What is a bearish divergence?",
      options: ["Price makes a lower low while the RSI makes a higher low", "Price and the RSI both make higher highs", "Price makes a higher high while the RSI makes a lower high"],
      answer: 2,
      because: "Divergence is price and the indicator moving in opposite directions; a higher high in price with a lower high in the RSI is the bearish case.",
    },
    {
      question: "What is the MACD line?",
      options: ["A 14-period average of the RSI", "The difference between the 12-period and 26-period exponential moving averages", "A 9-period exponential moving average of the signal line"],
      answer: 1,
      because: "The MACD line is the difference between the 12 and 26 EMAs; the signal line is a 9-period EMA of that line.",
    },
  ],

  "bollinger-bands-trading": [
    {
      question: "What is the middle Bollinger Band?",
      options: ["A 14-period RSI", "A 20-period simple moving average", "The midpoint of the day’s high and low"],
      answer: 1,
      because: "The middle band is a 20-period simple moving average; the upper and lower bands sit two standard deviations either side of it.",
    },
    {
      question: "What does it mean when the bands are wide apart?",
      options: ["The market is experiencing high volatility", "The market is experiencing low volatility", "The moving average has stopped updating"],
      answer: 0,
      because: "The distance between the upper and lower bands reflects volatility: wide bands mean high volatility, narrow bands low.",
    },
    {
      question: "What is a Bollinger squeeze?",
      options: ["The price closing outside both bands at once", "The bands widening to their greatest width", "The bands contracting to their narrowest width"],
      answer: 2,
      because: "The squeeze is the bands contracting to their narrowest width, which the lesson reads as a sign of extremely low volatility.",
    },
  ],

  "trading-the-news": [
    {
      question: "According to the lesson, what drives the price when a figure is released?",
      options: ["The absolute number on its own", "The deviation of the number from what the market expected", "The time of day at which it is released"],
      answer: 1,
      because: "The lesson’s closing point is that it is the deviation from consensus that drives price, not the absolute number.",
    },
    {
      question: "What does an economic calendar list?",
      options: ["Scheduled data releases, central bank meetings and speeches by policymakers", "The live prices of every currency pair", "The spreads a broker charges"],
      answer: 0,
      because: "The calendar lists scheduled events, usually classified by expected impact as high, medium or low.",
    },
    {
      question: "Which risks does the lesson name around a release?",
      options: ["Narrower spreads and calmer prices", "Fewer trading sessions being open", "Slippage, widened spreads and extreme volatility"],
      answer: 2,
      because: "The section on risk around releases names slippage, widened spreads and extreme volatility.",
    },
  ],

  "central-bank-policies-explained": [
    {
      question: "How does the lesson describe the usual effect of a rate hike on a currency?",
      options: ["Higher rates attract foreign capital, which tends to strengthen the currency", "Higher rates make the currency less attractive, which tends to weaken it", "Rates have no bearing on a currency’s value"],
      answer: 0,
      because: "The lesson links higher interest rates to foreign capital seeking better returns, and so to a stronger currency; a cut works the other way.",
    },
    {
      question: "What is quantitative easing?",
      options: ["A central bank raising its interest rate", "A central bank reducing its balance sheet", "A central bank buying government bonds and other assets to inject money into the economy"],
      answer: 2,
      because: "Quantitative easing is the purchase of bonds and other financial assets; reducing the balance sheet is its opposite, quantitative tightening.",
    },
    {
      question: "What is forward guidance?",
      options: ["A monthly employment report", "A communication strategy in which a central bank signals its future policy intentions", "A rule that fixes the exchange rate"],
      answer: 1,
      because: "By telling markets what to expect, the lesson says, central banks aim to manage expectations and smooth the reaction to their decisions.",
    },
  ],

  "risk-reward-ratio-explained": [
    {
      question: "A buy trade has its entry at 1.1000, its stop-loss at 1.0950 and its take-profit at 1.1100. What is its risk-reward ratio?",
      options: ["1:1", "1:2", "1:3"],
      answer: 1,
      because: "The risk is 50 pips and the reward is 100 pips, so the ratio is 1:2, as in the lesson’s own example.",
    },
    {
      question: "With a 45% win rate, an average win of $200 and an average loss of $100, what is the expectancy per trade?",
      options: ["$35", "$90", "$145"],
      answer: 0,
      because: "Expectancy is (win rate × average win) − (loss rate × average loss): (0.45 × 200) − (0.55 × 100) = 90 − 55 = 35.",
    },
    {
      question: "What does the lesson say about moving a stop-loss further away to avoid being stopped out?",
      options: ["It improves the ratio", "It leaves the ratio unchanged", "It destroys the planned risk-reward ratio"],
      answer: 2,
      because: "The first of the lesson’s common mistakes: a stop moved further away makes the risk larger than the one the ratio was planned on.",
    },
  ],

  "position-sizing-strategies": [
    {
      question: "A $10,000 account risks 2% with a 50-pip stop-loss, and one pip on a standard lot is worth $10. What position size does the percent-risk formula give?",
      options: ["0.04 standard lots", "0.4 standard lots", "4 standard lots"],
      answer: 1,
      because: "($10,000 × 0.02) ÷ (50 × $10) = $200 ÷ $500 = 0.4 standard lots, the lesson’s worked example.",
    },
    {
      question: "How many units of the base currency is a standard lot?",
      options: ["100,000", "10,000", "1,000"],
      answer: 0,
      because: "A standard lot is 100,000 units; a mini lot is 10,000 and a micro lot is 1,000.",
    },
    {
      question: "When the calculated size falls between two available lot sizes, what does the lesson say to do?",
      options: ["Round up to the next lot size", "Round to whichever is nearer", "Round down to the nearest available lot size"],
      answer: 2,
      because: "The last step of the lesson’s calculation is to round down, never up, so the amount at risk is not exceeded.",
    },
  ],

  "managing-trading-psychology": [
    {
      question: "What does the lesson mean by revenge trading?",
      options: ["Entering a position because a large move is happening without you", "Re-entering the market immediately after a loss to win back what was lost", "Missing valid setups out of fear after a loss"],
      answer: 1,
      because: "Revenge trading is the immediate re-entry after a loss; entering because of a move already under way is what the lesson calls FOMO.",
    },
    {
      question: "What is a pre-trade checklist for, according to the lesson?",
      options: ["Verifying that all the criteria are met before a trade, so decisions are not impulsive", "Predicting whether the trade will be profitable", "Deciding how much to add after a winning streak"],
      answer: 0,
      because: "The lesson describes the checklist as a mechanical process that prevents impulsive decisions driven by emotion.",
    },
    {
      question: "What is a daily loss limit?",
      options: ["The smallest number of trades to place each day", "A profit target for the day", "A maximum loss for the day, after which trading stops until the next day"],
      answer: 2,
      because: "The lesson defines it as a maximum daily loss after which you stop trading for the day, with no exceptions.",
    },
  ],
};

/** The questions of a lesson, or null when none are written for it. */
export const quizFor = (slug: string): LessonQuestions | null => academyQuiz[slug] ?? null;

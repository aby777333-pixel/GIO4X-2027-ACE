import type { LessonBook } from "./types";

/** Lessons for the terms listed in .tmp/gloss-1.txt (alphabetical third 1 of 3). */
export const book1: LessonBook = {
  "aggregate-demand": {
    plain:
      "Aggregate demand is the total amount that everyone in an economy wants to spend on goods and services over a period: households, businesses, the government and buyers abroad. Economists write it as consumption plus investment plus government spending plus net exports, where net exports are exports minus imports.",
    why: "Strong or weak total spending feeds into growth and inflation figures, which central banks watch when they set interest rates. Traders follow those figures because expectations about interest rates are one of the things exchange rates are sensitive to.",
    example: {
      setup: "An invented economy records, for one year, consumption of 600, investment of 150, government spending of 200, exports of 100 and imports of 50, all in billions.",
      steps: ["Net exports = 100 − 50 = 50", "Aggregate demand = 600 + 150 + 200 + 50", "= 1,000 billion"],
      result: "Total demand is 1,000 billion, of which household consumption makes up 60%.",
    },
    mistake: "It is easy to read aggregate demand as consumer spending alone. Consumer spending is usually the largest part, but business investment, government spending and trade all count.",
    diagramCaption: "Total demand sits at the centre, joined to the four kinds of spending that make it up; moving the pointer over a spender shows its contribution flowing into the total.",
    diagram: { kind: "hub", labels: ["Total demand", "Households", "Businesses", "Government", "Net exports"] },
    quiz: {
      question: "Imports rise while consumption, investment, government spending and exports stay the same. What happens to aggregate demand as the formula measures it?",
      options: ["It rises, because more is being bought", "It falls, because imports are subtracted", "It is unchanged, because imports are not counted"],
      answer: 1,
      because: "Net exports are exports minus imports, so higher imports with nothing else changed lower the total. Spending on imports is demand for another country’s output.",
    },
  },

  appreciation: {
    plain:
      "A currency appreciates when it becomes worth more of another currency than it was before. Because currencies are priced against each other, one currency appreciating always means the other currency in the pair has lost value against it.",
    why: "A trader who holds the currency that appreciates sees a gain measured in the other currency, and one who has sold it sees a loss. Outside trading, it changes what imports, exports and foreign travel cost.",
    example: {
      setup: "In an invented example EUR/USD moves from 1.1000 to 1.1100.",
      steps: ["Change = 1.1100 − 1.1000 = 0.0100, which is 100 pips", "0.0100 ÷ 1.1000 = 0.0091, about 0.9%", "On one standard lot: 100 pips × 10 US dollars = 1,000 US dollars"],
      result: "The euro has appreciated by about 0.9% against the dollar, a change of 1,000 US dollars in the value of one standard lot.",
    },
    mistake: "A rising EUR/USD does not show that the euro is strong against everything. It says only that the euro gained against the dollar; against the yen or the pound it may have fallen over the same period.",
    diagramCaption: "Two bars compare what one unit of a currency buys before and after it appreciates.",
    diagram: { kind: "bars", labels: ["Rate before", "Rate after"], sizes: [5, 7] },
    quiz: {
      question: "In an invented example USD/JPY moves from 150 to 153. Which currency has appreciated?",
      options: ["The dollar, because one dollar now buys more yen", "The yen, because the number is larger", "Both, because the pair rose"],
      answer: 0,
      because: "The quote is the price of one dollar in yen. A higher number means each dollar buys more yen, so the dollar has appreciated and the yen has lost value against it.",
    },
  },

  arbitrage: {
    plain:
      "Arbitrage means buying something in one place and selling the same thing in another place at the same moment, to capture a difference in price between the two. The buying and selling themselves push the two prices back together, so such differences tend to be small and short-lived.",
    why: "Arbitrage is the reason one instrument is priced almost identically across venues, and the reason cross rates stay consistent with the rates they are derived from. For an individual trader, the differences seen on a screen are usually smaller than the cost of dealing, and a broker’s terms may restrict strategies that rely on delayed prices.",
    example: {
      setup: "In an invented case the same pair can be bought at 1.1000 in one market and sold at 1.1003 in another.",
      steps: ["Buy 100,000 units at 1.1000", "Sell 100,000 units at 1.1003", "Difference = 0.0003 = 3 pips; 3 × 10 = 30 US dollars before costs", "If dealing costs total 2 pips, 1 pip remains: 10 US dollars"],
      result: "The apparent 30 US dollars shrinks to 10 once costs are counted, and vanishes if either price moves before both orders are filled.",
    },
    mistake: "Arbitrage is often described as profit without risk. In practice the two trades are never perfectly simultaneous, so a price can move between them, and costs can exceed the difference.",
    diagramCaption: "The same instrument is shown at a higher price in one market and a lower price in another, with the difference between them; moving the pointer in closes the difference as the two prices are traded together.",
    diagram: { kind: "gap", labels: ["Higher price", "Lower price", "Difference"] },
    quiz: {
      question: "Why do price differences between two markets for the same instrument tend to be brief?",
      options: ["A regulator sets one official price for every venue", "Markets close whenever prices differ", "Buying where it is cheaper and selling where it is dearer pushes the two prices together"],
      answer: 2,
      because: "Buying raises the lower price and selling lowers the higher one. The trades that exploit a difference are the same trades that remove it.",
    },
  },

  "ask-rate": {
    plain:
      "The ask is the price at which you can buy. Every quote shows two prices: the lower one, the bid, is what you receive if you sell, and the higher one, the ask, is what you pay if you buy. The ask is also called the offer.",
    why: "A buy order is opened at the ask, and a sell position is closed by buying at the ask. The distance between the ask and the bid, called the spread, is a cost paid on every trade that is opened and closed.",
    example: {
      setup: "In an invented example a pair is quoted at 1.1000 bid and 1.1002 ask, and a trader buys one standard lot.",
      steps: ["The buy is filled at the ask: 1.1002", "Sold back at once, it would be filled at the bid: 1.1000", "1.1002 − 1.1000 = 0.0002 = 2 pips; 2 × 10 = 20 US dollars"],
      result: "The position starts 20 US dollars behind, which is the cost of the spread.",
    },
    mistake: "Many charts draw the bid price only. A buy order is filled at the ask, which sits above the line on such a chart, so a buy can be filled at a price the chart never appears to reach.",
    diagramCaption: "The ask sits above the bid with the spread between them; the spread can be made wider or narrower.",
    diagram: { kind: "gap", labels: ["Ask", "Bid", "Spread"] },
    quiz: {
      question: "A trader has a short (sold) position open. At which price is it closed?",
      options: ["The bid, because it was opened at the bid", "The ask, because closing a short position means buying", "The midpoint between the bid and the ask"],
      answer: 1,
      because: "Closing a short position means buying back what was sold, and every purchase is made at the ask.",
    },
  },

  "asset-allocation": {
    plain:
      "Asset allocation is the decision about how to divide money between different kinds of asset, such as shares, bonds, commodities, currencies and cash. The idea behind it is that different kinds of asset do not all rise and fall together, so the mix shapes how much the whole portfolio swings.",
    why: "The split between kinds of asset is commonly said to explain much of how a portfolio behaves, more than the choice of individual instruments within each kind. A trader whose positions are all in one market has, in effect, allocated everything to it.",
    example: {
      setup: "A portfolio of 10,000 is split 50% shares, 30% bonds and 20% commodities, and over an invented year shares lose 10%, bonds gain 2% and commodities gain 5%.",
      steps: ["Shares: 5,000 × −10% = −500", "Bonds: 3,000 × 2% = +60", "Commodities: 2,000 × 5% = +100", "Total = −500 + 60 + 100 = −340"],
      result: "The portfolio falls by 340, or 3.4%, compared with 10% had it all been in shares.",
    },
    mistake: "Spreading money across assets does not remove risk. In periods of market stress, assets that usually move separately can fall together.",
    diagramCaption: "Three bars show a portfolio divided between shares, bonds and commodities; choosing a bar measures the other two against it.",
    diagram: { kind: "bars", labels: ["Shares", "Bonds", "Commodities"], sizes: [5, 3, 2] },
    quiz: {
      question: "A trader holds five positions, each buying the US dollar against a different currency. How spread out is the risk?",
      options: ["Well spread, because there are five pairs", "Fully offset, because the pairs cancel out", "Well spread, provided the lots are equal", "Barely, because every position depends on the dollar"],
      answer: 3,
      because: "All five positions gain or lose with the same currency, so they behave much like one large position. Counting positions is not the same as spreading risk.",
    },
  },

  atr: {
    plain:
      "The average true range, or ATR, measures how far a price typically travels in one period, such as a day. For each period it takes the true range, which is the distance from high to low, widened to include any jump from the previous close, and then averages those ranges over a set number of periods, commonly 14. It says how much the price moves, not in which direction.",
    why: "Traders use ATR to compare how active a market is now with how active it has been. Some set the distance of a stop-loss as a multiple of ATR, so that the distance adapts to how much the market is moving.",
    example: {
      setup: "To keep the arithmetic short, take a three-day average with invented true ranges of 40, 60 and 80 pips.",
      steps: ["Sum = 40 + 60 + 80 = 180 pips", "ATR = 180 ÷ 3 = 60 pips", "A distance of 2 × ATR would be 2 × 60 = 120 pips"],
      result: "The three-day ATR is 60 pips; the standard indicator works the same way over 14 periods, with a smoothing step.",
    },
    mistake: "A rising ATR is sometimes read as a rising market. ATR has no direction: it rises in a sharp fall just as it does in a sharp rally.",
    diagramCaption: "Three bars show the range of three days and a fourth shows their average; choosing a day shows whether it stands above or below the average.",
    diagram: { kind: "bars", labels: ["Day 1", "Day 2", "Day 3", "Average"], sizes: [4, 6, 8, 6] },
    quiz: {
      question: "The ATR on a daily chart doubles over a month. What does that say?",
      options: ["Typical daily ranges have roughly doubled", "The price has doubled", "The trend has turned upwards", "The market has reached a ceiling"],
      answer: 0,
      because: "ATR measures the size of price ranges, so a doubling means the market is moving about twice as far in a day. It says nothing about direction.",
    },
  },

  "balance-of-payments": {
    plain:
      "The balance of payments is a country’s account with the rest of the world: everything its residents sold, bought, lent, borrowed and invested across the border over a period. Its best-known part is the current account, which covers trade in goods and services and income; the rest records flows of investment and lending.",
    why: "Money that crosses a border has to be exchanged, so these flows are a source of demand for a currency and of supply of it. A persistent current account deficit means a country depends on money flowing in from abroad, which is one of the things analysts weigh when they assess a currency.",
    example: {
      setup: "In an invented year a country exports goods and services worth 500 billion and imports 560 billion, with no other current account items.",
      steps: ["Current account = 500 − 560 = −60 billion", "The 60 billion shortfall has to be paid for", "It is matched by 60 billion of net inflows: foreign investment, borrowing or a fall in reserves"],
      result: "The current account shows a deficit of 60 billion, financed by an equal net inflow recorded elsewhere in the accounts.",
    },
    mistake: "A “balance of payments deficit” usually refers to one part of the accounts, most often the current account. Taken as a whole the accounts balance by construction, because every payment is matched by a flow that finances it.",
    diagramCaption: "A beam weighs the current account against the financial flows that finance it; pushing one side down brings the other up until the beam is level again.",
    diagram: { kind: "balance", labels: ["Current account", "Financial account"], tilt: "level" },
    quiz: {
      question: "A country runs a current account deficit. What must be true elsewhere in its balance of payments?",
      options: ["Nothing, because the parts are unrelated", "Its exchange rate must be fixed", "There is a matching net inflow of money from abroad, or a fall in reserves"],
      answer: 2,
      because: "A deficit on the current account has to be financed. The financing appears as investment or lending from abroad, or as a reduction in the country’s reserves.",
    },
  },

  "base-currency": {
    plain:
      "In a currency pair the base currency is the one written first. The price of the pair is the price of one unit of the base currency, expressed in the second currency, which is called the quote currency. Buying the pair means buying the base currency and selling the quote currency.",
    why: "Trade size is counted in the base currency: one standard lot of EUR/USD is 100,000 euros, not 100,000 dollars. Profit and loss, by contrast, arise in the quote currency.",
    example: {
      setup: "In an invented example EUR/USD is at 1.1000 and a trader buys one standard lot.",
      steps: ["The base currency is the euro, so the size is 100,000 euros", "Value in the quote currency = 100,000 × 1.1000 = 110,000 US dollars", "A rise of 10 pips = 10 × 10 = 100 US dollars"],
      result: "The trader has bought 100,000 euros against 110,000 US dollars, and gains or losses are counted in dollars.",
    },
    mistake: "It is tempting to think the base currency is the stronger or more important of the two. The order is a market convention: it says which currency is being priced, and nothing about its strength.",
    diagramCaption: "The two currencies of a pair are shown bound together, the base on the left and the quote on the right; when one rises the other falls, and the pair’s price follows the base.",
    diagram: { kind: "pair", labels: ["EUR (base)", "USD (quote)"] },
    quiz: {
      question: "A trader sells one standard lot of GBP/USD. What has been sold?",
      options: ["100,000 pounds", "100,000 US dollars", "100,000 of each currency"],
      answer: 0,
      because: "Lot size is counted in the base currency, which is the first one named. In GBP/USD that is the pound.",
    },
  },

  "bear-market": {
    plain:
      "A bear market is a long period in which prices keep falling and most participants expect further falls. In share markets a fall of 20% or more from a recent high is a common rule of thumb for the label. Currencies are priced against each other, so a bear market in one currency is a bull market in the currency on the other side of the pair.",
    why: "The label describes the backdrop a trader is working in: rallies tend to be shorter than declines and sentiment is cautious. It describes what has happened so far and says nothing certain about what comes next.",
    example: {
      setup: "An invented share index peaks at 5,000 and later stands at 3,900.",
      steps: ["Fall = 5,000 − 3,900 = 1,100 points", "1,100 ÷ 5,000 = 0.22 = 22%", "22% is beyond the 20% rule of thumb"],
      result: "By the common convention this decline would be called a bear market.",
    },
    mistake: "A bear market does not mean prices fall every day. Sharp rallies occur inside long declines, and the trend is judged over months, not sessions.",
    diagramCaption: "A run of candles steps downwards, each high and each low beneath the one before; moving the pointer along the run marks the lower highs and lower lows.",
    diagram: { kind: "candles", shape: "bearish-run", labels: ["Lower highs", "Lower lows"] },
    quiz: {
      question: "EUR/USD has been in a long decline. Which statement is accurate?",
      options: ["Both the euro and the dollar are in a bear market", "The euro is in a bear market against the dollar, and the dollar in a bull market against the euro", "Every currency is falling"],
      answer: 1,
      because: "A pair’s price is one currency measured in the other, so one side’s decline is the other side’s rise. Both cannot fall against each other.",
    },
  },

  "bid-price": {
    plain:
      "The bid is the price at which you can sell. It is the highest price that buyers in the market are prepared to pay at that moment. It sits just below the ask, the price at which you can buy.",
    why: "A sell order is opened at the bid, and a long (bought) position is closed by selling at the bid. On most platforms the stop-loss and take-profit of a long position are therefore triggered by the bid, not the ask.",
    example: {
      setup: "A trader buys one standard lot at an ask of 1.1002 while the bid is 1.1000, and the quote later rises to 1.1010 bid and 1.1012 ask (invented figures).",
      steps: ["The long position is closed by selling at the bid: 1.1010", "1.1010 − 1.1002 = 0.0008 = 8 pips", "8 × 10 = 80 US dollars"],
      result: "The gain is 80 US dollars: the bid rose 10 pips, and 2 of those pips covered the spread.",
    },
    mistake: "People sometimes read the bid as the price they can buy at, because a bid sounds like an offer to buy. It is the market’s bid: the market buys from you there, so it is your selling price.",
    diagramCaption: "Sell orders rest above the latest price and buy orders below it; moving the pointer onto the lower level shows a sale being matched at the bid.",
    diagram: { kind: "levels", labels: ["Sell orders (ask)", "Latest price", "Buy orders (bid)"] },
    quiz: {
      question: "A pair is quoted at 1.2500 bid and 1.2503 ask. A trader sells. At what price is the order filled, assuming the quote does not move?",
      options: ["1.2503", "1.25015", "1.2500"],
      answer: 2,
      because: "Sales are made at the bid, the lower of the two prices. The ask of 1.2503 is the price for buying.",
    },
  },

  "bollinger-bands": {
    plain:
      "Bollinger Bands are three lines drawn on a price chart: a moving average in the middle, and a band above and below it set a number of standard deviations away, commonly two. Standard deviation measures how widely prices have been scattered around their average, so the bands widen when the market is volatile and narrow when it is quiet.",
    why: "The bands put the current price in context: high or low relative to its own recent behaviour. Traders also watch the width of the bands, since a narrow band shows an unusually quiet market.",
    example: {
      setup: "With invented figures, the 20-period average is 1.1000 and the standard deviation is 0.0025.",
      steps: ["Upper band = 1.1000 + 2 × 0.0025 = 1.1050", "Lower band = 1.1000 − 2 × 0.0025 = 1.0950", "Width = 1.1050 − 1.0950 = 0.0100 = 100 pips"],
      result: "The bands sit 50 pips either side of the average and 100 pips apart.",
    },
    mistake: "A touch of the upper band is often read as a sign that the price must turn down. In a strong trend the price can run along a band for a long time, so a touch says only that the price is high relative to its recent average.",
    diagramCaption: "A price line moves between an upper and a lower band, touching each in turn.",
    diagram: { kind: "band", labels: ["Upper band", "Lower band"], breaks: "none" },
    quiz: {
      question: "The bands on a chart narrow sharply. What has changed?",
      options: ["The price is about to climb", "The moving average has stopped updating", "The price has reached a limit", "Recent volatility has fallen"],
      answer: 3,
      because: "The distance between the bands is set by the standard deviation of recent prices. Narrow bands mean prices have been moving less; they do not say what happens next.",
    },
  },

  breakout: {
    plain:
      "A breakout is a move by the price through a level that had previously held it back: above resistance, a level where rises have stalled, or below support, a level where falls have stalled. Chart readers take it as a sign that the balance between buyers and sellers at that level has changed.",
    why: "Many pending orders tend to sit just beyond well-watched levels, so a break can be fast and orders can be filled at worse prices than requested. Breakouts also fail: the price can cross a level and return inside the range soon after, which is called a false breakout.",
    example: {
      setup: "On an invented chart a pair has turned back from 1.1050 three times and then trades at 1.1065.",
      steps: ["Resistance: 1.1050", "Distance beyond it = 1.1065 − 1.1050 = 0.0015 = 15 pips", "A return to 1.1040 would put the price 10 pips back inside the range"],
      result: "The move 15 pips above resistance is a breakout; a return below 1.1050 would make it a false one.",
    },
    mistake: "A break of a level is not confirmation that a new trend has begun. Many breaks reverse, which is why the term false breakout exists.",
    diagramCaption: "A price climbs towards a resistance level and crosses it; dragging the price back below the level shows a breakout that fails.",
    diagram: { kind: "threshold", labels: ["Resistance", "Price", "Breakout"], from: "below" },
    quiz: {
      question: "The price rises above a resistance level, then returns below it within the hour and stays there. What is this usually called?",
      options: ["A confirmed breakout", "A false breakout", "A gap"],
      answer: 1,
      because: "The price crossed the level but did not hold beyond it. A break that reverses back into the old range is known as a false breakout.",
    },
  },

  broker: {
    plain:
      "A broker is the firm through which an individual reaches a market. It provides the trading platform, quotes prices and holds the client’s account, and it either passes each order on to other institutions or takes the other side of the trade itself.",
    why: "The broker’s prices, costs, method of execution and rules are the conditions a trader actually deals under. Whether and where the firm is regulated determines which protections apply to a client’s money.",
    example: {
      setup: "A trader presses buy on one standard lot of a pair quoted at 1.1000 bid and 1.1002 ask (invented figures).",
      steps: ["The platform sends the order to the broker", "The broker fills it at the ask, 1.1002, from its own book or through a liquidity provider", "Spread cost = 2 pips × 10 = 20 US dollars, plus any commission"],
      result: "The trader never deals with the wider market directly: the broker is the counterparty or the route to one.",
    },
    mistake: "It is often assumed that every order is sent to an exchange. Spot forex and CFDs are traded over the counter, meaning directly between firms, and a broker may itself be the counterparty to a client’s trade.",
    diagramCaption: "An order travels from the trader through the broker to the market.",
    diagram: { kind: "flow", labels: ["Trader", "Broker", "Market"] },
    quiz: {
      question: "A retail trader’s buy order in spot forex is filled. Who may be on the other side of the trade?",
      options: ["The broker itself, or an institution the broker passes the order to", "A central exchange, in every case", "Another client of the same broker, in every case"],
      answer: 0,
      because: "Spot forex has no central exchange. A broker either takes the other side of the trade or routes the order to a liquidity provider.",
    },
  },

  "bull-market": {
    plain:
      "A bull market is a long period in which prices keep rising and most participants expect further rises. In share markets a rise of 20% or more from a recent low is a common rule of thumb for the label. In a currency pair, a bull market for one currency is a bear market for the other.",
    why: "The label describes the backdrop: declines tend to be shorter than advances and sentiment is confident. It describes what has happened so far and carries no information about how long it lasts.",
    example: {
      setup: "An invented share index bottoms at 4,000 and later stands at 5,000.",
      steps: ["Rise = 5,000 − 4,000 = 1,000 points", "1,000 ÷ 4,000 = 0.25 = 25%", "25% is beyond the 20% rule of thumb"],
      result: "By the common convention this advance would be called a bull market.",
    },
    mistake: "A bull market is not in itself a reason to expect further gains. The label describes the rise so far, and sharp falls occur inside long advances.",
    diagramCaption: "A run of candles steps upwards, each high and each low above the one before; moving the pointer along the run marks the higher highs and higher lows.",
    diagram: { kind: "candles", shape: "bullish-run", labels: ["Higher highs", "Higher lows"] },
    quiz: {
      question: "An index falls from 5,000 to 4,000 and then rises 20% from that low. Where does it stand?",
      options: ["5,000, back at the old high", "4,200", "4,800, still below the old high"],
      answer: 2,
      because: "20% of 4,000 is 800, which gives 4,800. A percentage rise is measured from the low, so a 20% rise does not undo a 20% fall.",
    },
  },

  cable: {
    plain:
      "Cable is the dealing-room nickname for the pound against the US dollar, GBP/USD. The name goes back to the nineteenth century, when the rate was sent between London and New York along a telegraph cable laid across the Atlantic.",
    why: "The word appears in market commentary and news without explanation. Knowing that it means GBP/USD, with the pound as the base currency, avoids misreading a headline.",
    example: {
      setup: "A commentary says “cable rose 50 pips to 1.2550” (an invented figure).",
      steps: ["Cable is GBP/USD, so the pound is the base currency", "Rate before the move = 1.2550 − 0.0050 = 1.2500", "On one standard lot: 50 pips × 10 = 500 US dollars"],
      result: "The pound rose against the dollar from 1.2500 to 1.2550, a change of 500 US dollars per standard lot.",
    },
    mistake: "Cable is sometimes taken to mean the pound in general. It refers only to the pound against the US dollar; EUR/GBP, for example, is not cable.",
    diagramCaption: "A rate travels from London along the Atlantic cable to New York; moving the pointer along the line sends the quote across.",
    diagram: { kind: "flow", labels: ["London", "Atlantic cable", "New York"] },
    quiz: {
      question: "A headline reads “cable falls”. What has happened?",
      options: ["The dollar has weakened against the pound", "The pound has weakened against the dollar", "The pound has weakened against the euro"],
      answer: 1,
      because: "Cable is GBP/USD, the price of one pound in dollars. A lower price means the pound buys fewer dollars.",
    },
  },

  candlestick: {
    plain:
      "A candlestick draws what the price did in one period, such as an hour or a day, as a single shape. The thick part, the body, runs from the opening price to the closing price; the thin lines above and below it, the wicks, reach to the highest and lowest prices of the period. The colour of the body shows whether the close was above or below the open.",
    why: "Candlesticks are the usual way a trading platform draws a chart. A candle shows four prices where a line chart shows one, so a reader sees not only where the price ended but how far it travelled on the way.",
    example: {
      setup: "In an invented hour a pair opens at 1.1000, rises to 1.1040, falls to 1.0990 and closes at 1.1030.",
      steps: ["Body: 1.1030 − 1.1000 = 30 pips, with the close above the open", "Upper wick: 1.1040 − 1.1030 = 10 pips", "Lower wick: 1.1000 − 1.0990 = 10 pips", "Whole range: 1.1040 − 1.0990 = 50 pips"],
      result: "The candle has a rising body of 30 pips with a 10-pip wick at each end.",
    },
    mistake: "A single candle is often treated as a forecast. It is a record of one period; candle patterns are said to indicate a change of mood, and they fail often.",
    diagramCaption: "One candle is drawn with its body and its two wicks named, built from the path the price took during the period.",
    diagram: { kind: "candles", shape: "single", labels: ["Body", "Upper wick", "Lower wick"] },
    quiz: {
      question: "A candle has a very small body and a long wick on each side. What happened in that period?",
      options: ["The price barely moved during the period", "No trades took place", "The price travelled far both ways but closed near its open", "The price closed at its highest point"],
      answer: 2,
      because: "Long wicks show that the high and the low were far apart, and a small body shows that the open and the close were near each other.",
    },
  },

  "carry-trade": {
    plain:
      "A carry trade means holding a currency that pays a higher interest rate, funded by a currency that charges a lower one, in order to collect the difference between the two rates. In a leveraged account that difference shows up as the swap, the daily interest adjustment applied to positions held overnight.",
    why: "The interest difference is small compared with how far an exchange rate can move, so the outcome depends mostly on the exchange rate. Carry trades have historically unwound quickly in periods of market stress, when the higher-yielding currency falls.",
    example: {
      setup: "A trader holds a position worth 100,000 for a year in a currency yielding 5%, funded in one costing 1% (invented rates, broker charges ignored).",
      steps: ["Differential = 5% − 1% = 4%", "Interest collected = 100,000 × 4% = 4,000", "If the higher-yielding currency falls 6%: 100,000 × 6% = 6,000 lost", "Net = 4,000 − 6,000 = −2,000"],
      result: "A 6% fall in the exchange rate more than cancels a year of interest and leaves a loss of 2,000.",
    },
    mistake: "The interest difference is sometimes seen as income that arrives whatever happens. A move in the exchange rate can cost more than the interest earns, and with leverage that loss is magnified.",
    diagramCaption: "Two bars compare the low interest rate of the funding currency with the higher rate of the currency held; moving the pointer over them shows the differential between the two.",
    diagram: { kind: "bars", labels: ["Funding rate", "Target rate"], sizes: [1, 5] },
    quiz: {
      question: "A carry trade collects 3% in interest over a year. Over the same year the higher-yielding currency falls 3% against the funding currency. Roughly what is the result before costs?",
      options: ["About zero", "A gain of 3%", "A gain of 6%", "A loss of 6%"],
      answer: 0,
      because: "The interest collected and the loss on the exchange rate are about the same size and offset each other. The exchange rate decides whether a carry trade gains or loses.",
    },
  },

  "central-bank": {
    plain:
      "A central bank is the public institution that manages the money of a country or currency area. It sets the policy interest rate, which anchors what commercial banks pay and charge, issues the currency, and usually has a mandate to keep inflation low and stable.",
    why: "Interest rate decisions, and the language around them, are among the events exchange rates are most sensitive to. Markets often move on the difference between what a central bank does and what was expected, not on the decision alone.",
    example: {
      setup: "Markets expect a central bank to raise its policy rate from 3.00% to 3.25%, and it raises the rate to 3.50% instead (invented figures).",
      steps: ["Expected rate = 3.00% + 0.25% = 3.25%", "Actual rate = 3.00% + 0.50% = 3.50%", "Surprise = 3.50% − 3.25% = 0.25 percentage points"],
      result: "The surprise of 0.25 points, not the full 0.50, is the new information that prices have to absorb.",
    },
    mistake: "A rate rise is often assumed to lift the currency. If the rise was fully expected it is already reflected in the price, and the currency can weaken if the accompanying statement is more cautious than expected.",
    diagramCaption: "A lever shows a small movement in the policy rate at one end shifting the much larger economy at the other.",
    diagram: { kind: "lever", labels: ["Policy rate", "Economy"] },
    quiz: {
      question: "A central bank raises rates exactly as everyone expected and the currency barely moves. Why?",
      options: ["Interest rates have no bearing on currencies", "Central banks fix the exchange rate on decision days", "The rise was already reflected in the price"],
      answer: 2,
      because: "Prices adjust as expectations form, before the announcement. A decision that matches expectations brings little new information.",
    },
  },

  cfd: {
    plain:
      "A contract for difference is an agreement with a provider to exchange the difference between an instrument’s price when the contract is opened and its price when it is closed. The trader never owns the underlying share, index or commodity; only the change in price is settled, in cash. CFDs are traded on margin, meaning only a fraction of the position’s full value is deposited.",
    why: "A CFD allows a position on a rising or a falling price without owning the asset, and with a deposit much smaller than the position. That leverage magnifies losses as much as gains, and a loss can exceed the margin deposited.",
    example: {
      setup: "A trader buys 10 CFDs on an invented share at 100, with a margin requirement of 10%, and closes at 104.",
      steps: ["Position value = 10 × 100 = 1,000", "Margin = 10% × 1,000 = 100", "Difference = 104 − 100 = 4 per CFD; 4 × 10 = 40 gained", "Had the price fallen to 96: −4 × 10 = 40 lost"],
      result: "A 4% move in the share is worth 40, which is 40% of the 100 deposited, in either direction.",
    },
    mistake: "Buying a share CFD is not the same as buying the share. There is no ownership and there are no shareholder rights; the contract is with the provider, and dividends appear as cash adjustments.",
    diagramCaption: "The opening price and the closing price are shown with the difference between them, which is what the contract pays; the difference can be made larger or smaller.",
    diagram: { kind: "gap", labels: ["Closing price", "Opening price", "Difference"] },
    quiz: {
      question: "A trader sells (goes short) 5 CFDs at 200 and closes the position at 190. What is the result before costs?",
      options: ["A loss of 50", "A gain of 50", "A gain of 10", "Nothing, because the asset was never owned"],
      answer: 1,
      because: "A short position gains when the price falls. The difference is 200 − 190 = 10 per CFD, and 10 × 5 = 50.",
    },
  },

  "commodity-currencies": {
    plain:
      "Commodity currencies are the currencies of countries that earn a large share of their export income from raw materials such as metals, energy or farm products. The Australian, Canadian and New Zealand dollars are the usual examples. When the price of a country’s main exports changes, so does the amount of foreign income being converted into its currency.",
    why: "These currencies have historically tended to move with commodity prices, so traders watch the two together. The link is loose and can break down for long periods, because interest rates and the general appetite for risk act on the currency too.",
    example: {
      setup: "A country sells 10 million tonnes of ore abroad each year, priced in US dollars (invented figures).",
      steps: ["At 100 US dollars a tonne: 10 million × 100 = 1 billion US dollars", "At 120 US dollars a tonne: 10 million × 120 = 1.2 billion US dollars", "Extra income to convert = 1.2 − 1 = 0.2 billion US dollars"],
      result: "A 20% rise in the ore price means 20% more dollars to be exchanged for the home currency, which is the channel that links the two.",
    },
    mistake: "The link is sometimes treated as mechanical, as if the currency must follow the commodity. It is a tendency observed over time, and the two can move in opposite directions for months.",
    diagramCaption: "Commodity prices sit at the centre, joined to the three currencies most often tied to them; moving the pointer over a currency shows the link pulsing between the two.",
    diagram: { kind: "hub", labels: ["Commodities", "AUD", "CAD", "NZD"] },
    quiz: {
      question: "Why might the currency of a commodity exporter tend to strengthen when its export prices rise?",
      options: ["Its central bank is obliged to raise the exchange rate", "Commodities are priced in that currency", "The currency is backed by the commodity", "Exporters earn more foreign income and convert it into the home currency"],
      answer: 3,
      because: "Higher export prices bring in more foreign currency, which is exchanged for the home currency and adds to demand for it. It is a tendency, not a rule.",
    },
  },

  consolidation: {
    plain:
      "Consolidation is a stretch of time in which the price moves sideways inside a fairly narrow range, typically after a strong rise or fall. Neither buyers nor sellers push the price far, so the highs and lows cluster between two levels.",
    why: "Volatility is low during consolidation, and the edges of the range become levels that many traders watch. The range ends eventually, but how long it lasts and in which direction the price leaves it cannot be known in advance.",
    example: {
      setup: "After a rise, an invented pair trades for a week between 1.1000 and 1.1040.",
      steps: ["Range = 1.1040 − 1.1000 = 0.0040 = 40 pips", "Midpoint = 1.1020", "A move to 1.1055 would be 15 pips beyond the top of the range"],
      result: "The price is consolidating in a 40-pip range between 1.1000 and 1.1040.",
    },
    mistake: "Consolidation after a rise is often assumed to resolve upwards. A range can break in either direction, and it can also simply widen.",
    diagramCaption: "A price line moves back and forth between the top and the bottom of a range, turning at each.",
    diagram: { kind: "band", labels: ["Range high", "Range low"], breaks: "none" },
    quiz: {
      question: "During consolidation, how does volatility usually compare with the move that came before it?",
      options: ["It is lower", "It is at its highest", "It is exactly the same"],
      answer: 0,
      because: "Consolidation is defined by a narrow sideways range, which means smaller price swings than in the strong move that preceded it.",
    },
  },

  "contract-size": {
    plain:
      "Contract size is the amount of the underlying that one lot stands for. In foreign exchange one standard lot is 100,000 units of the base currency; for gold it is commonly 100 troy ounces. The lot figure on a platform means nothing until it is multiplied by the contract size.",
    why: "Contract size turns a lot figure into real exposure, and with it the value of each step in the price. The same “1 lot” is a very different position in a currency pair, in gold and in an index.",
    example: {
      setup: "A trader opens 0.20 lots of EUR/USD at an invented price of 1.1000.",
      steps: ["Units = 0.20 × 100,000 = 20,000 euros", "Notional value = 20,000 × 1.1000 = 22,000 US dollars", "Pip value = 0.0001 × 20,000 = 2 US dollars"],
      result: "A position of 0.20 lots is 20,000 euros, and each pip is worth 2 US dollars.",
    },
    mistake: "It is easy to assume that one lot is the same size in every instrument. Contract size is set for each instrument and can differ between brokers; it is stated in the instrument’s specification.",
    diagramCaption: "A lot figure passes through the contract size and comes out as the number of units traded.",
    diagram: { kind: "flow", labels: ["Lots", "Contract size", "Units traded"] },
    quiz: {
      question: "With a contract size of 100 troy ounces, how much gold does a position of 0.05 lots represent?",
      options: ["0.05 ounces", "5 ounces", "50 ounces", "500 ounces"],
      answer: 1,
      because: "Units are lots multiplied by contract size: 0.05 × 100 = 5 ounces.",
    },
  },

  correlation: {
    plain:
      "Correlation measures how closely two prices move together. It is expressed as a number between −1 and +1: near +1 the two tend to rise and fall together, near −1 one tends to rise when the other falls, and near 0 there is no steady relationship.",
    why: "Two positions in strongly correlated pairs behave much like one larger position, so risk can be more concentrated than the number of trades suggests. Correlations are measured from past data and change over time.",
    example: {
      setup: "A trader is long one standard lot in each of two pairs whose correlation has been +0.9, and both fall 50 pips (invented figures, with a pip worth 10 US dollars in each).",
      steps: ["First pair: 50 × 10 = 500 US dollars lost", "Second pair: 50 × 10 = 500 US dollars lost", "Total = 500 + 500 = 1,000 US dollars"],
      result: "The two positions lost together, as a single position of two lots would have.",
    },
    mistake: "Correlation is often read as cause, or as permanent. It describes how two prices moved over a past period; it does not show that one drives the other, and it can weaken or reverse.",
    diagramCaption: "Two price lines move side by side in step with each other, keeping the same distance apart.",
    diagram: { kind: "lines", labels: ["Pair A", "Pair B"], relation: "parallel" },
    quiz: {
      question: "Two pairs have had a correlation of −0.9. A trader buys both in equal size. What is the likely effect?",
      options: ["The risk is roughly doubled", "The two positions are unrelated", "Moves in one tend to offset moves in the other"],
      answer: 2,
      because: "A correlation near −1 means the pairs have tended to move in opposite directions, so a gain on one has tended to come with a loss on the other. The relationship can change.",
    },
  },

  "cross-rate": {
    plain:
      "A cross rate is an exchange rate between two currencies neither of which is the US dollar, such as EUR/GBP or AUD/JPY. Because most currencies trade most actively against the dollar, a cross can be worked out from the two dollar rates.",
    why: "A cross moves when either of its two dollar pairs moves, so it has two sources of change. Crosses often carry wider spreads than the most traded dollar pairs.",
    example: {
      setup: "EUR/USD is 1.2000 and GBP/USD is 1.5000 (invented round figures).",
      steps: ["One euro = 1.2000 US dollars", "One pound = 1.5000 US dollars", "EUR/GBP = 1.2000 ÷ 1.5000 = 0.8000"],
      result: "One euro buys 0.80 pounds, a rate reached without quoting euros against pounds directly.",
    },
    mistake: "It is often assumed that a cross has nothing to do with the dollar. EUR/GBP can move because of news that affects only EUR/USD or only GBP/USD.",
    diagramCaption: "An amount of euros passes through US dollars and comes out as pounds.",
    diagram: { kind: "flow", labels: ["EUR", "USD", "GBP"] },
    quiz: {
      question: "EUR/USD rises while GBP/USD is unchanged. What happens to EUR/GBP?",
      options: ["It rises", "It falls", "It is unchanged"],
      answer: 0,
      because: "EUR/GBP equals EUR/USD divided by GBP/USD. If the top figure rises and the bottom one stays the same, the result rises.",
    },
  },

  "currency-pair": {
    plain:
      "A currency has no price on its own, only against another currency, so currencies are always quoted in pairs. In EUR/USD at 1.1000, one euro costs 1.10 US dollars: the first currency is the one being priced, and the second is what it is priced in. Every trade in a pair buys one currency and sells the other at the same time.",
    why: "Reading the pair the right way round tells a trader what a rising or a falling quote means, and which currency the profit or loss is counted in.",
    example: {
      setup: "A trader buys 10,000 EUR/USD at 1.1000 and the rate rises to 1.1050 (invented figures).",
      steps: ["Bought 10,000 euros, sold 10,000 × 1.1000 = 11,000 US dollars", "At 1.1050 the euros are worth 10,000 × 1.1050 = 11,050 US dollars", "11,050 − 11,000 = 50 US dollars"],
      result: "A rise of 50 pips on 10,000 euros is a gain of 50 US dollars, counted in the quote currency.",
    },
    mistake: "Buying EUR/USD is sometimes thought of as buying a single thing. It is two actions at once, buying euros and selling dollars, so the outcome depends on both currencies.",
    diagramCaption: "Two currencies are shown bound together as one pair; pulling one upwards pushes the other down, since the pair is one priced in the other.",
    diagram: { kind: "pair", labels: ["EUR", "USD"] },
    quiz: {
      question: "GBP/USD is quoted at 1.2500. What does the number mean?",
      options: ["One US dollar costs 1.25 pounds", "The pound has risen 1.25%", "The pair needs 1.25 units of margin", "One pound costs 1.25 US dollars"],
      answer: 3,
      because: "The quote is the price of one unit of the first currency, the base, expressed in the second, the quote currency.",
    },
  },

  "day-trading": {
    plain:
      "Day trading means opening and closing every position within the same trading day, so that nothing is held overnight. Positions last minutes or hours, and the aim is to capture small moves within the session.",
    why: "Closing before the end of the day avoids overnight financing charges and the chance of a price jump while the market is shut or the trader is away. It also means many trades, so spreads and commissions are paid often and take a larger share of any result.",
    example: {
      setup: "A day trader makes 10 trades in a day, each of one standard lot and each costing a spread of 2 pips (invented figures).",
      steps: ["Cost per trade = 2 × 10 = 20 US dollars", "Cost for the day = 10 × 20 = 200 US dollars", "In pips: 10 × 2 = 20 pips of movement needed to cover costs"],
      result: "Across the day, 200 US dollars is spent on spreads before any trade has gained or lost.",
    },
    mistake: "Day trading is sometimes thought safer because nothing is held overnight. It removes overnight risk but adds frequent costs and fast decisions, and the risks of leverage remain in full.",
    diagramCaption: "A loop runs from the market opening, to a position being opened, to it being closed, to an account with nothing open overnight; moving the pointer round the loop steps through one trading day.",
    diagram: { kind: "cycle", labels: ["Market opens", "Position opened", "Position closed", "Flat overnight"] },
    quiz: {
      question: "Which cost does a day trader avoid by closing every position before the end of the trading day?",
      options: ["Overnight financing, also called swap", "The spread", "Commission per trade"],
      answer: 0,
      because: "Swap is applied to positions held past the daily rollover. Spreads and commissions are paid on every trade however briefly it is held.",
    },
  },

  "dead-cat-bounce": {
    plain:
      "A dead cat bounce is a short-lived rise in a price that has been falling hard, after which the fall resumes. The name is traders’ slang. It can be identified only afterwards: while it is happening, a bounce and a lasting recovery look the same.",
    why: "The term is a reminder that a rise after a steep fall is not, taken alone, evidence that the fall is over.",
    example: {
      setup: "An invented share falls from 100 to 60, rises to 69 and then falls to 50.",
      steps: ["First fall = 100 − 60 = 40, which is 40%", "Bounce = 69 − 60 = 9; 9 ÷ 60 = 15%", "Second fall = 69 − 50 = 19, to a new low"],
      result: "A rise of 15% looked large, yet it recovered less than a quarter of the 40 lost, and the decline went on.",
    },
    mistake: "People speak of spotting a dead cat bounce as it forms. The label can be applied only once the price has made a new low; before that, nobody can tell it from a reversal.",
    diagramCaption: "A falling price rises briefly and then falls further; moving the pointer along the line marks the bounce and the new low that follows it.",
    diagram: { kind: "path", shape: "zigzag-down", labels: ["Falling price"], marks: ["Bounce"] },
    quiz: {
      question: "When can a rise be reliably called a dead cat bounce?",
      options: ["As soon as the price rises after a fall", "Whenever the rise is smaller than 10%", "Only after the price has gone below its earlier low"],
      answer: 2,
      because: "The term describes a rise that was followed by a further fall. Until that further fall has happened, the rise could equally be the start of a recovery.",
    },
  },

  deflation: {
    plain:
      "Deflation is a sustained fall in the general level of prices across an economy, the opposite of inflation. Each unit of money buys more than it did before. It is different from a fall in the price of a few goods, and from disinflation, which is inflation slowing down while prices still rise.",
    why: "Falling prices can lead households and firms to delay spending, and they make debts heavier in real terms, so central banks generally respond by lowering interest rates or easing policy in other ways. Those policy expectations are what link deflation to exchange rates.",
    example: {
      setup: "A basket of goods costs 100 at the start of an invented year, prices fall 2% over the year, and a borrower owes 1,000 throughout.",
      steps: ["Basket at the end of the year = 100 × 0.98 = 98", "Debt at the start, in baskets = 1,000 ÷ 100 = 10", "Debt at the end, in baskets = 1,000 ÷ 98 = about 10.2"],
      result: "Money buys about 2% more, and the unchanged debt has become about 2% heavier when measured in goods.",
    },
    mistake: "Falling prices sound like good news for everyone. A sustained general fall tends to come with weak demand, and it raises the real burden of debt.",
    diagramCaption: "A loop runs from falling prices, to delayed spending, to weaker sales, to falling incomes and back to falling prices; moving the pointer round it shows how each stage feeds the next.",
    diagram: { kind: "cycle", labels: ["Prices fall", "Spending delayed", "Sales weaken", "Incomes fall"] },
    quiz: {
      question: "Inflation slows from 5% a year to 2% a year. Is this deflation?",
      options: ["Yes, because inflation fell", "No, prices are still rising, only more slowly", "Yes, if it lasts for a year"],
      answer: 1,
      because: "Deflation means the price level itself is falling, which is inflation below zero. A lower but still positive rate of inflation is called disinflation.",
    },
  },

  depreciation: {
    plain:
      "A currency depreciates when it loses value against another currency, so that it buys less of that currency than before. The word is used for moves in a market-set exchange rate; a deliberate lowering of a fixed rate by a government is called a devaluation.",
    why: "Depreciation makes imports and foreign travel dearer and makes exports cheaper for buyers abroad. For a trader, a depreciating base currency appears as a falling quote for the pair.",
    example: {
      setup: "In an invented example GBP/USD moves from 1.2500 to 1.2000.",
      steps: ["Change = 1.2500 − 1.2000 = 0.0500 = 500 pips lower", "0.0500 ÷ 1.2500 = 0.04 = 4%", "1,000 pounds bought 1,250 US dollars before and buy 1,200 after"],
      result: "The pound has depreciated 4% against the dollar: the same 1,000 pounds now buy 50 fewer dollars.",
    },
    mistake: "The percentages are not the same for the two currencies. If the pound loses 4% against the dollar, the dollar has gained about 4.2% against the pound, not 4%.",
    diagramCaption: "A line traces the price of a currency sloping downwards as it depreciates.",
    diagram: { kind: "path", shape: "down", labels: ["GBP/USD"] },
    quiz: {
      question: "USD/CHF moves lower. Which currency has depreciated?",
      options: ["The US dollar", "The Swiss franc", "Both currencies"],
      answer: 0,
      because: "The quote is the price of one dollar in francs. A lower number means each dollar buys fewer francs, so the dollar has depreciated against the franc.",
    },
  },

  divergence: {
    plain:
      "Divergence is a disagreement between a price and an indicator calculated from it. The usual case: the price makes a higher high while a momentum indicator, a measure of how fast the price is moving, makes a lower high. It shows that the latest push went further than the one before, but with less force.",
    why: "Technical analysts read divergence as a sign that a trend is losing strength. It is not a timing tool: a trend can continue for a long time while divergence persists, and many divergences are followed by no reversal at all.",
    example: {
      setup: "On an invented chart the price peaks at 1.1000 and later at 1.1050, while a momentum indicator reads 75 at the first peak and 65 at the second.",
      steps: ["Price: 1.1050 is above 1.1000, a higher high", "Indicator: 65 is below 75, a lower high", "The two disagree, which is called bearish divergence"],
      result: "The price is higher but momentum is lower, which is said to indicate a weakening rise and nothing more certain than that.",
    },
    mistake: "Divergence is often treated as a reversal that has already begun. It describes slowing momentum; the price may keep moving in the same direction.",
    diagramCaption: "A price line climbs while an indicator line beneath it slopes down, the two drawing apart; the distance between them is measured as the lines are drawn.",
    diagram: { kind: "lines", labels: ["Price", "Indicator"], relation: "diverge" },
    quiz: {
      question: "The price makes a lower low while a momentum indicator makes a higher low. What is this called?",
      options: ["Bearish divergence, because the price is falling", "Bullish divergence, because the fall is losing momentum", "No divergence, because both made lows"],
      answer: 1,
      because: "The price fell further but the indicator did not, which is called bullish divergence. It is said to indicate a weakening decline, and it can fail.",
    },
  },

  dividend: {
    plain:
      "A dividend is a payment a company makes to its shareholders out of its profits, usually a set amount per share. On the ex-dividend date the share begins trading without the right to the payment, and its price typically opens lower by about the amount of the dividend. A CFD holder does not own the share, so the dividend is passed on as a cash adjustment: added to long positions and taken from short ones.",
    why: "Without the adjustment, the drop in the share price on the ex-dividend date would hand a loss to long positions and a gain to short ones for no market reason. The adjustment offsets that drop, so a dividend is not a windfall for the holder of a CFD.",
    example: {
      setup: "A trader is long 100 CFDs on an invented share priced at 50, which pays a dividend of 1 per share, before any deduction a broker applies.",
      steps: ["On the ex-dividend date the price opens about 1 lower, at 49", "Change in the position = 100 × −1 = −100", "Dividend adjustment credited = 100 × 1 = +100", "Net effect = −100 + 100 = 0"],
      result: "The adjustment and the price drop cancel out; a short position would see the reverse, a gain of 100 on price and a debit of 100.",
    },
    mistake: "A dividend adjustment is sometimes seen as extra income from holding a long CFD. The share price typically falls by about the same amount on the ex-dividend date, so the two roughly offset.",
    diagramCaption: "A company’s profit is shown as a whole with the part paid out as dividends marked off; dragging the divider changes the share that is paid out and the share that is kept.",
    diagram: { kind: "share", labels: ["Dividend", "Company profit"], share: 0.4 },
    quiz: {
      question: "A trader holds a short position in a share CFD over the ex-dividend date. What happens in the account?",
      options: ["Nothing, because a CFD carries no ownership", "It is credited with the dividend amount", "It is debited the dividend adjustment"],
      answer: 2,
      because: "Short positions gain from the price drop on the ex-dividend date, so the adjustment is taken from them. Long positions receive it.",
    },
  },

  "double-bottom": {
    plain:
      "A double bottom is a chart shape resembling the letter W: the price falls to a low, rebounds, falls again to about the same low and rebounds again. The high between the two lows is called the neckline. Chart readers treat the pattern as complete only when the price rises above the neckline.",
    why: "It is read as showing that sellers twice failed to push the price lower, and so is said to indicate that a decline may be ending. Like every chart pattern it fails often: the price can drop through the two lows after appearing to form the shape.",
    example: {
      setup: "On an invented chart the price falls to 1.1000, rebounds to 1.1100, falls to 1.1005 and turns up again.",
      steps: ["Lows: 1.1000 and 1.1005, about the same level", "Neckline: 1.1100", "Height = 1.1100 − 1.1000 = 0.0100 = 100 pips", "The pattern is complete only above 1.1100"],
      result: "Until the price is above 1.1100 this is two lows inside a range, not yet a double bottom.",
    },
    mistake: "Two similar lows are often called a double bottom straight away. By the usual definition the pattern does not exist until the neckline is broken, and even then it can fail.",
    diagramCaption: "A price line falls to a low twice and turns up, with the neckline drawn across the high between the lows; moving the pointer along the line marks each low and the neckline.",
    diagram: { kind: "path", shape: "double-bottom", labels: ["W shape"], marks: ["First low", "Second low", "Neckline"] },
    quiz: {
      question: "The price has made two similar lows but has not risen above the high between them. What is on the chart?",
      options: ["A completed double bottom", "Not yet a double bottom", "A double top"],
      answer: 1,
      because: "The pattern is defined as complete only when the price breaks above the neckline. Before that, the price is still moving within a range.",
    },
  },

  "double-top": {
    plain:
      "A double top is a chart shape resembling the letter M: the price rises to a high, pulls back, rises again to about the same high and turns down again. The low between the two highs is called the neckline. Chart readers treat the pattern as complete only when the price falls below the neckline.",
    why: "It is read as showing that buyers twice failed to push the price higher, and so is said to indicate that a rise may be ending. Like every chart pattern it fails often: the price can go on through the two highs after appearing to form the shape.",
    example: {
      setup: "On an invented chart the price rises to 1.2000, pulls back to 1.1900, rises to 1.1995 and turns down again.",
      steps: ["Highs: 1.2000 and 1.1995, about the same level", "Neckline: 1.1900", "Height = 1.2000 − 1.1900 = 0.0100 = 100 pips", "The pattern is complete only below 1.1900"],
      result: "Until the price is below 1.1900 this is two highs inside a range, not yet a double top.",
    },
    mistake: "A second failure at a high is often taken as proof that the trend has turned. Uptrends pause at earlier highs all the time, and many then continue upwards.",
    diagramCaption: "A price line rises to a high twice and turns down, with the neckline drawn across the low between the highs; moving the pointer along the line marks each peak and the neckline.",
    diagram: { kind: "path", shape: "double-top", labels: ["M shape"], marks: ["First peak", "Second peak", "Neckline"] },
    quiz: {
      question: "What separates a completed double top from an ordinary pause in an uptrend?",
      options: ["The second peak exactly matching the first", "A set number of days between the peaks", "The second peak forming faster than the first", "A fall below the low between the two peaks"],
      answer: 3,
      because: "The pattern is defined as complete only when the price breaks below the neckline, the low between the peaks. Two similar highs alone do not make it.",
    },
  },

  dovish: {
    plain:
      "Dovish describes a central bank, or one of its policymakers, that leans towards lower interest rates and looser policy, usually because it is more concerned about weak growth or unemployment than about inflation. The opposite is hawkish: leaning towards higher rates to restrain inflation.",
    why: "Commentators use the word to sum up the tone of a decision or a speech. A currency has historically tended to weaken when its central bank sounds more dovish than expected, since lower expected interest rates make it less attractive to hold; the reaction depends on what was already expected.",
    example: {
      setup: "A central bank holds its rate at 4.00% but says cuts are likely; markets had expected 4.00% at the end of the year and now expect 3.50% (invented figures).",
      steps: ["Rate today: unchanged at 4.00%", "Expected year-end rate before the meeting: 4.00%", "Expected year-end rate after it: 3.50%", "Shift = 4.00% − 3.50% = 0.50 percentage points"],
      result: "Nothing was cut, yet the message was dovish: expectations moved down by half a point.",
    },
    mistake: "Dovish is sometimes taken to mean that rates have been cut. It describes a leaning: a bank can sound dovish while leaving rates unchanged, or while raising them by less than expected.",
    diagramCaption: "A marker swings between a hawkish zone at the top and a dovish zone at the bottom as a central bank’s tone changes; moving the pointer shifts the tone and shows which zone it falls in.",
    diagram: { kind: "oscillator", labels: ["Hawkish", "Dovish"] },
    quiz: {
      question: "A central bank raises rates by 0.25 points when 0.50 was expected, and says it may pause. How would commentators most likely describe the decision?",
      options: ["Hawkish, because rates went up", "Dovish, relative to what was expected", "Neutral, because rates changed"],
      answer: 1,
      because: "Tone is judged against expectations. A smaller rise than expected, with talk of a pause, leans towards looser policy than markets had assumed.",
    },
  },

  drawdown: {
    plain:
      "Drawdown is how far an account has fallen from its highest point, usually given as a percentage of that peak. Maximum drawdown is the largest such fall over a period.",
    why: "Drawdown shows the worst stretch an account or a strategy went through, which an average return hides. The deeper the fall, the larger the percentage gain needed to return to the peak, because the gain is earned on a smaller sum.",
    example: {
      setup: "An account peaks at 10,000 and falls to 8,000 (invented figures).",
      steps: ["Drawdown = (10,000 − 8,000) ÷ 10,000 = 20%", "Gain needed = 2,000 ÷ 8,000 = 25%", "By the formula: 0.20 ÷ (1 − 0.20) = 0.25"],
      result: "A drawdown of 20% needs a gain of 25% to recover; a drawdown of 50% would need 100%.",
    },
    mistake: "It is natural to assume a 20% loss is undone by a 20% gain. Here 20% of 8,000 is 1,600, which leaves the account at 9,600.",
    diagramCaption: "The account’s peak and its lowest point are shown with the drawdown between them; the drawdown can be made deeper or shallower.",
    diagram: { kind: "gap", labels: ["Peak equity", "Lowest equity", "Drawdown"] },
    quiz: {
      question: "An account falls 50% from its peak. What gain on the remaining amount returns it to the peak?",
      options: ["50%", "75%", "100%", "150%"],
      answer: 2,
      because: "After a 50% fall, half remains, and half has to double to become the whole again. By the formula, 0.50 ÷ (1 − 0.50) = 1, or 100%.",
    },
  },

  ecn: {
    plain:
      "An electronic communication network, or ECN, is a system that collects buying and selling prices from many participants, such as banks and other trading firms, and matches orders against the best prices available. A broker using an ECN model passes client orders into such a pool instead of filling them from its own book.",
    why: "In this model the spread is whatever the pool shows at that moment, so it varies: narrow in busy markets and wide in thin ones. The broker usually charges a separate commission, and orders are filled at the prices available, which may differ from the price requested.",
    example: {
      setup: "On an invented ECN-style account the spread is 0.2 pips and the commission is 6 US dollars per standard lot for opening and closing.",
      steps: ["Spread cost = 0.2 × 10 = 2 US dollars", "Commission = 6 US dollars", "Total = 2 + 6 = 8 US dollars, the same as 0.8 pips"],
      result: "The full cost of the trade is 0.8 pips, not the 0.2 shown as the spread.",
    },
    mistake: "A narrow ECN spread is sometimes compared directly with a wider spread on an account that charges no commission. The comparison is fair only when the commission is added in.",
    diagramCaption: "The network sits at the centre, joined to the banks, market makers, brokers and funds whose prices it gathers; moving the pointer over a participant shows its price arriving at the centre.",
    diagram: { kind: "hub", labels: ["ECN", "Banks", "Market makers", "Brokers", "Funds"] },
    quiz: {
      question: "An account shows a spread of 0.1 pips and charges a commission on each trade. What is the cost of a trade?",
      options: ["The spread plus the commission", "The spread only", "The commission only"],
      answer: 0,
      because: "Both are paid. A very narrow spread with a commission can cost the same as, or more than, a wider spread with none.",
    },
  },

  "elliott-wave-theory": {
    plain:
      "Elliott wave theory is a way of reading charts put forward by Ralph Nelson Elliott in the 1930s. It holds that prices move in a repeating rhythm: five waves in the direction of the main trend, called an impulse, followed by three waves against it, called a correction. Each wave is said to be built from smaller waves of the same form.",
    why: "Analysts who use it try to place the current price within a count of waves, to describe where a trend might be in its course. Counts are subjective: two analysts can label the same chart differently, and a count is often revised after the price moves.",
    example: {
      setup: "On an invented chart a rise unfolds as five moves: from 100 to 110, back to 105, up to 125, back to 120 and up to 130.",
      steps: ["Waves 1, 3 and 5 rise: +10, +20 and +10", "Waves 2 and 4 fall: −5 and −5", "Net = 10 − 5 + 20 − 5 + 10 = 30, from 100 to 130"],
      result: "Three rising waves and two smaller falling ones make up the five-wave impulse that the theory describes.",
    },
    mistake: "A wave count can look like a forecast. It is an interpretation, usually clear only in hindsight, and there is no agreed test that shows a count to be right at the time.",
    diagramCaption: "A price line rises in five numbered waves, three up and two down; moving the pointer along the line names each wave in turn.",
    diagram: { kind: "path", shape: "zigzag-up", labels: ["Five-wave impulse"], marks: ["1", "2", "3", "4", "5"] },
    quiz: {
      question: "Two analysts apply Elliott wave theory to the same chart and reach different wave counts. What does this show?",
      options: ["One of them has made an arithmetic error", "The chart data must be faulty", "The method relies on judgement, so counts are not unique"],
      answer: 2,
      because: "Deciding where one wave ends and the next begins is a matter of interpretation. Different readings of the same chart are common.",
    },
  },

  ema: {
    plain:
      "A moving average smooths a series of prices by averaging the most recent ones. An exponential moving average, or EMA, gives the newest prices the greatest weight, with the weight fading for older ones, so it turns sooner than a simple moving average, which weights every price equally.",
    why: "Because it reacts faster, an EMA follows the price more closely, at the cost of reacting to more short-lived moves. It is also a building block of other indicators, such as MACD.",
    example: {
      setup: "For a 9-period EMA the weighting factor is 2 ÷ (9 + 1) = 0.2; the previous EMA is 1.1000 and the new close is 1.1050 (invented figures).",
      steps: ["EMA = previous EMA + 0.2 × (close − previous EMA)", "= 1.1000 + 0.2 × (1.1050 − 1.1000)", "= 1.1000 + 0.2 × 0.0050 = 1.1010"],
      result: "The EMA moves a fifth of the way towards the new price, from 1.1000 to 1.1010.",
    },
    mistake: "A faster average is not a better one. An EMA responds sooner to real turns and to noise alike, and every moving average describes prices that have already happened.",
    diagramCaption: "After the price turns upwards, the exponential average turns first and crosses above the slower simple average; moving the pointer across the chart shows the distance between the two.",
    diagram: { kind: "lines", labels: ["EMA", "Simple average"], relation: "cross-up" },
    quiz: {
      question: "The price jumps sharply today. Which 20-period average moves more in response?",
      options: ["The simple moving average", "The exponential moving average", "Both move by the same amount"],
      answer: 1,
      because: "The exponential average gives the newest price more weight than the simple average does, so a single large move shifts it further.",
    },
  },

  equity: {
    plain:
      "In a trading account, equity is what the account would be worth if every open position were closed now. It is the balance, which changes only when a trade is closed or money is paid in or out, plus the running profit or minus the running loss on open positions.",
    why: "Margin calculations use equity, not balance: free margin and margin level are both worked out from it. An account with a healthy balance can have low equity if its open positions are losing.",
    example: {
      setup: "An account has a balance of 5,000 and one open position showing an unrealised loss of 800 (invented figures).",
      steps: ["Equity = balance + unrealised profit or loss", "= 5,000 + (−800)", "= 4,200"],
      result: "The balance still reads 5,000, but the account is worth 4,200 at this moment.",
    },
    mistake: "Equity and balance are often used as if they were the same. They are equal only when nothing is open; while a position is running, equity moves with every change in price and the balance does not.",
    diagramCaption: "Three bars show the balance, the loss on an open position and the equity left after it; measured from the balance, the equity falls short by the size of the loss.",
    diagram: { kind: "bars", labels: ["Balance", "Open loss", "Equity"], sizes: [10, 2, 8] },
    quiz: {
      question: "An account has a balance of 2,000, and its open positions show a profit of 300. Nothing is closed. What are the balance and the equity?",
      options: ["Balance 2,300 and equity 2,300", "Balance 2,000 and equity 2,000", "Balance 2,300 and equity 2,000", "Balance 2,000 and equity 2,300"],
      answer: 3,
      because: "The balance changes only when a trade is closed. Equity adds the unrealised profit: 2,000 + 300 = 2,300.",
    },
  },

  "exotic-pairs": {
    plain:
      "An exotic pair combines a major currency, such as the US dollar or the euro, with the currency of a smaller or developing economy, such as the Turkish lira or the South African rand. Far less is traded in these pairs than in the major ones, so there are fewer buyers and sellers at any moment.",
    why: "Thin trading shows up as wider spreads, larger jumps in price and, often, higher overnight financing charges. The cost of opening and closing a position can be many times that of a major pair.",
    example: {
      setup: "An invented major pair has a spread of 1 pip and an invented exotic pair a spread of 30 pips, taking a pip as worth 10 in each case for simplicity.",
      steps: ["Major pair: 1 × 10 = 10", "Exotic pair: 30 × 10 = 300", "300 ÷ 10 = 30 times the cost"],
      result: "The exotic pair has to move 30 pips in the trader’s favour before the position breaks even, against 1 pip for the major pair.",
    },
    mistake: "Large daily moves in an exotic pair can look like more opportunity. The thin trading that produces the moves also produces wider spreads and gaps, so cost and risk rise together.",
    diagramCaption: "Three bars compare the typical width of the spread on major, minor and exotic pairs, for illustration; choosing a group measures the other two against it.",
    diagram: { kind: "bars", labels: ["Major", "Minor", "Exotic"], sizes: [1, 3, 9] },
    quiz: {
      question: "Why are spreads on exotic pairs usually wider than on major pairs?",
      options: ["Fewer participants trade them, so liquidity is lower", "A regulator sets a minimum spread for them", "Their pips are a different size"],
      answer: 0,
      because: "With fewer buyers and sellers, the best buying and selling prices sit further apart. Liquidity, not regulation, sets the width.",
    },
  },

  "expert-advisor": {
    plain:
      "An expert advisor, or EA, is a program that runs inside the MetaTrader platform and trades without anyone clicking. It follows rules written into its code: it reads prices, checks whether its conditions are met, and sends, changes or closes orders.",
    why: "An EA applies its rules the same way every time and can run around the clock, which a person cannot. It also has no judgement: it does exactly what it was coded to do, including when market conditions change or its connection fails, so it still has to be supervised.",
    example: {
      setup: "An invented EA has one rule: buy 0.10 lots when the price closes above its 50-period average, with a stop-loss 40 pips away.",
      steps: ["Pip value at 0.10 lots = 0.0001 × 10,000 = 1 US dollar", "Loss if the stop is reached = 40 × 1 = about 40 US dollars", "Five losing trades in a row = 5 × 40 = about 200 US dollars"],
      result: "The program repeats its rule faithfully, including through a losing run of about 200 US dollars, until someone stops it.",
    },
    mistake: "Good results in a backtest, a run over past prices, are often taken as proof that an EA works. Rules can be tuned to fit the past closely and then behave quite differently on new prices.",
    diagramCaption: "A loop runs from reading prices, to checking the rules, to sending an order, to managing the trade and back again; moving the pointer round the loop shows what the program does at each step.",
    diagram: { kind: "cycle", labels: ["Read prices", "Check rules", "Send order", "Manage trade"] },
    quiz: {
      question: "An EA showed a profit over five years of past data. What does that establish?",
      options: ["That its rules fitted those past prices, and nothing certain about the future", "That it can safely be left running unattended", "That its code contains no errors"],
      answer: 0,
      because: "A backtest shows how the rules would have behaved on prices already known. Future prices can behave differently, and past results do not carry forward.",
    },
  },

  "fibonacci-retracement": {
    plain:
      "A Fibonacci retracement is a set of horizontal lines drawn across a price move at fixed fractions of its height, most often 23.6%, 38.2%, 50% and 61.8%. The fractions other than 50% come from ratios between numbers in the Fibonacci sequence. The lines mark how much of the move a pullback has given back.",
    why: "Many chart users watch these levels as places where a pullback might pause, and that shared attention is the main reason they matter. There is no economic law behind them, and prices frequently pass straight through.",
    example: {
      setup: "An invented pair rises from 1.1000 to 1.1200 and then pulls back.",
      steps: ["Height of the move = 1.1200 − 1.1000 = 0.0200 = 200 pips", "38.2% level = 1.1200 − 0.382 × 0.0200 = 1.11236", "50% level = 1.1200 − 0.5 × 0.0200 = 1.1100", "61.8% level = 1.1200 − 0.618 × 0.0200 = 1.10764"],
      result: "A pullback to 1.1100 has given back half of the rise; the levels describe how deep a pullback is and predict nothing.",
    },
    mistake: "The 50% level is commonly listed with the others, but it is not a Fibonacci ratio. It is included by convention.",
    diagramCaption: "Three horizontal levels mark a pullback of 38.2%, 50% and 61.8% of an earlier rise; moving the price down through them shows how much of the rise has been given back at each one.",
    diagram: { kind: "levels", labels: ["38.2% level", "50% level", "61.8% level"] },
    quiz: {
      question: "A price rises from 100 to 200 and then falls back to 150. How much of the rise has been retraced?",
      options: ["25%", "38.2%", "50%", "61.8%"],
      answer: 2,
      because: "The rise was 100 and the pullback is 200 − 150 = 50. 50 ÷ 100 = 50%.",
    },
  },

  fill: {
    plain:
      "A fill is the moment an order becomes a trade: the order has been executed, at a specific price, for a specific amount. If only part of the amount could be executed, that is a partial fill, and the rest waits or is cancelled, depending on the terms of the order.",
    why: "Profit and loss are measured from the fill price, not from the price on screen when the button was pressed. In a fast or thin market the two can differ, and the difference is called slippage.",
    example: {
      setup: "A trader sends a market order to buy one standard lot with 1.1000 on screen, and it is filled at 1.1001 (invented figures).",
      steps: ["Price requested: 1.1000", "Price filled: 1.1001", "Slippage = 1.1001 − 1.1000 = 1 pip = 10 US dollars"],
      result: "The position is opened at 1.1001, and everything afterwards is measured from that price.",
    },
    mistake: "Sending an order is not the same as being filled. A limit order may never be filled if the price does not reach it, and a market order is filled at the price available, which may not be the one shown.",
    diagramCaption: "An order passes from being sent, to being matched with a price, to being filled.",
    diagram: { kind: "flow", labels: ["Order sent", "Price matched", "Order filled"] },
    quiz: {
      question: "A limit order to buy at 1.0950 is placed while the price is 1.1000. The price falls to 1.0960 and then rises. What happened to the order?",
      options: ["It was filled at 1.0960", "It was not filled, because the price never reached 1.0950", "It was filled at 1.0950"],
      answer: 1,
      because: "A buy limit order is filled only at its price or lower. The lowest price reached was 1.0960, so the order is still waiting.",
    },
  },

  flat: {
    plain:
      "A trader is flat when no position is open: nothing has been bought and nothing has been sold short. The value of the account no longer changes with the market. The word square means the same.",
    why: "Being flat is a state in its own right: no exposure, no margin in use and no overnight financing. Some traders choose to be flat over events whose outcome they do not want exposure to.",
    example: {
      setup: "A trader is long 0.50 lots of a pair and short 0.20 lots of the same pair, and then closes both (invented figures).",
      steps: ["Net position before = 0.50 − 0.20 = 0.30 lots long", "Net position after closing both = 0 lots", "Used margin = 0, so equity equals balance"],
      result: "With nothing open the trader is flat, and the balance stops moving with the price.",
    },
    mistake: "Flat is also used of a market that is moving sideways, which is a different meaning. A trader can be flat in a fast market, and a market can be flat while a trader holds a position.",
    diagramCaption: "A beam holds long positions on one side and short positions on the other, resting level when neither side holds anything; adding weight to either side tips the beam away from flat.",
    diagram: { kind: "balance", labels: ["Long", "Short"], tilt: "level" },
    quiz: {
      question: "Which of these accounts is flat?",
      options: ["One with a long position showing neither profit nor loss", "One with positions in two different pairs", "One with no open positions at all"],
      answer: 2,
      because: "Flat means having no open position. A position that happens to show zero profit is still open and still exposed to the next move in price.",
    },
  },

  "floating-exchange-rate": {
    plain:
      "A floating exchange rate is one that the market sets. The price of the currency moves continuously as buyers and sellers trade it, and there is no official level that the government or central bank promises to hold. The alternative is a fixed or pegged rate, where the authorities commit to keeping the currency at or near a set value.",
    why: "The pairs most people trade are floating, which is why their prices move all the time. Floating does not mean untouched: central banks sometimes intervene by buying or selling their own currency, an arrangement often called a managed float.",
    example: {
      setup: "In an invented session importers want to buy 500 million of a currency at the current price, while exporters want to sell only 300 million.",
      steps: ["Demand at this price: 500 million", "Supply at this price: 300 million", "Shortfall = 500 − 300 = 200 million, so buyers have to bid higher"],
      result: "The price of the currency rises until enough sellers come forward, with no authority setting the level.",
    },
    mistake: "Floating is sometimes taken to mean that a central bank never acts in the market. Authorities with floating currencies can and occasionally do intervene; what they do not do is promise a fixed rate.",
    diagramCaption: "A beam weighs buyers of a currency against sellers and tilts towards the heavier side; adding weight to the buyers lifts the rate, and adding it to the sellers lowers it.",
    diagram: { kind: "balance", labels: ["Buyers", "Sellers"], tilt: "left" },
    quiz: {
      question: "What sets the level of a freely floating currency?",
      options: ["Supply and demand in the market", "A rate announced each day by the central bank", "The size of the country’s gold reserves"],
      answer: 0,
      because: "A floating rate is whatever price balances those who want to buy the currency with those who want to sell it. No official body fixes it.",
    },
  },

  fomc: {
    plain:
      "The Federal Open Market Committee, or FOMC, is the body within the US Federal Reserve that decides monetary policy, chiefly the target range for the federal funds rate, the rate at which banks lend to each other overnight. It holds eight scheduled meetings a year and publishes a statement after each one.",
    why: "The US dollar is on one side of most currency trading, so the committee’s decisions and wording move many markets at once. Prices often move sharply in the minutes around a statement, and spreads can widen.",
    example: {
      setup: "Before a meeting the target range is 4.00% to 4.25%, and the committee lowers it by 0.25 percentage points (invented figures).",
      steps: ["Old range: 4.00% to 4.25%", "New lower bound = 4.00% − 0.25% = 3.75%", "New upper bound = 4.25% − 0.25% = 4.00%"],
      result: "The new target range is 3.75% to 4.00%; how markets respond depends on whether the cut was expected.",
    },
    mistake: "The committee does not set the rates that households and firms pay. It sets a target range for one overnight rate between banks, and other interest rates respond to that.",
    diagramCaption: "A loop runs from economic data arriving, to the meeting, to the statement, to the market’s reaction and round again; moving the pointer round it steps through one meeting.",
    diagram: { kind: "cycle", labels: ["Data arrives", "Meeting", "Statement", "Markets react"] },
    quiz: {
      question: "What does the FOMC decide directly?",
      options: ["The exchange rate of the US dollar", "US government spending and taxes", "The interest rate on every US loan", "The target range for the federal funds rate"],
      answer: 3,
      because: "The committee sets a target range for the overnight rate between banks. The dollar’s exchange rate is set by the market, and spending and taxes by the government.",
    },
  },

  forex: {
    plain:
      "Forex, short for foreign exchange, is the market in which one currency is exchanged for another. It has no central exchange: banks, companies, funds, central banks and individuals deal with one another electronically, in what is called an over-the-counter market. Because trading passes from one financial centre to the next around the world, it runs around the clock through the working week.",
    why: "The size and continuous hours of the market mean that the most traded pairs can usually be dealt at any time during the week with narrow spreads. Conditions are not uniform: activity and spreads vary with the time of day, and the market is closed at weekends.",
    example: {
      setup: "A company holding euros has to pay a supplier 110,000 US dollars, and EUR/USD is 1.1000 (invented figures).",
      steps: ["Euros needed = 110,000 ÷ 1.1000 = 100,000", "At a rate of 1.0000: 110,000 ÷ 1.0000 = 110,000 euros", "Difference = 110,000 − 100,000 = 10,000 euros"],
      result: "The same bill costs 10,000 euros more at the lower rate, which is why exchange rates matter well beyond trading.",
    },
    mistake: "Forex is sometimes pictured as a single marketplace with one official price. It is a network of dealers, so prices differ slightly from one provider to another at any moment.",
    diagramCaption: "The market sits at the centre, joined to the kinds of participant that exchange currencies through it; each link is picked out in turn.",
    diagram: { kind: "hub", labels: ["Forex market", "Banks", "Companies", "Central banks", "Funds", "Individuals"] },
    quiz: {
      question: "Where does trading in the forex market take place?",
      options: ["On one central exchange", "Across a network of participants dealing directly with one another", "On each country’s stock exchange"],
      answer: 1,
      because: "Foreign exchange is an over-the-counter market. Participants deal with each other electronically, with no single venue or official price.",
    },
  },

  "forward-contract": {
    plain:
      "A forward contract is an agreement made today to exchange one currency for another on a set future date, at a rate fixed now. Nothing is exchanged until that date. It is a private agreement between two parties, not a standard contract traded on an exchange.",
    why: "Businesses use forwards to know in advance what a future foreign payment will cost. The forward rate usually differs from today’s rate, because it reflects the difference in interest rates between the two currencies over the period.",
    example: {
      setup: "A firm holding euros must pay 1,000,000 US dollars in three months and agrees a forward rate of EUR/USD 1.2500 (invented figures).",
      steps: ["Cost fixed today = 1,000,000 ÷ 1.2500 = 800,000 euros", "Without the forward, at 1.2000: 1,000,000 ÷ 1.2000 = about 833,333 euros", "Without the forward, at 1.3000: 1,000,000 ÷ 1.3000 = about 769,231 euros"],
      result: "The firm pays 800,000 euros whichever happens: it is protected from the first outcome and gives up the benefit of the second.",
    },
    mistake: "A forward rate is sometimes read as a forecast of where the exchange rate is heading. It is calculated from today’s rate and the two interest rates, and fixing it removes favourable moves as well as unfavourable ones.",
    diagramCaption: "A contract passes from the day the rate is agreed, through the waiting period, to the day the currencies are exchanged.",
    diagram: { kind: "flow", labels: ["Rate agreed", "Waiting period", "Exchange"] },
    quiz: {
      question: "A company fixes a forward rate. By the settlement date the market rate has moved to a level that would have suited it better. What happens?",
      options: ["It still exchanges at the agreed forward rate", "It exchanges at the better market rate", "The contract lapses and no exchange takes place"],
      answer: 0,
      because: "A forward binds both parties to the agreed rate. Certainty about the cost is bought by giving up any favourable move.",
    },
  },

  "free-margin": {
    plain:
      "Free margin is the part of an account’s equity that is not set aside as margin for open positions. Margin is the deposit a broker holds against each open trade; whatever equity is left over is free to support new positions or to absorb losses on existing ones.",
    why: "Free margin shrinks when open positions lose and when new positions are opened. When it reaches zero no new position can be opened, and further losses bring the account towards a margin call.",
    example: {
      setup: "An account in US dollars has equity of 5,000 and one position open with a notional value of 100,000 US dollars at leverage of 1:100 (invented figures).",
      steps: ["Used margin = 100,000 × 1% = 1,000", "Free margin = 5,000 − 1,000 = 4,000", "After a further loss of 1,500: equity = 5,000 − 1,500 = 3,500", "Free margin = 3,500 − 1,000 = 2,500"],
      result: "Free margin falls from 4,000 to 2,500 as the loss reduces equity, while used margin stays at 1,000.",
    },
    mistake: "Free margin is not spare money that sits apart from open trades. It is calculated from equity, so it falls with every pip an open position loses.",
    diagramCaption: "The account’s equity is shown as a whole with the free part marked off from the part held as margin; dragging the divider shows free margin shrinking as more margin is used.",
    diagram: { kind: "share", labels: ["Free margin", "Equity"], share: 0.8 },
    quiz: {
      question: "An account has equity of 2,000 and used margin of 500. Its open positions then lose a further 300. What is the free margin now?",
      options: ["1,500", "1,200", "1,700", "200"],
      answer: 1,
      because: "Equity falls to 2,000 − 300 = 1,700, and used margin is unchanged at 500. Free margin = 1,700 − 500 = 1,200.",
    },
  },

  "fundamental-analysis": {
    plain:
      "Fundamental analysis studies the economic forces behind a price: growth, inflation, employment, interest rates, trade and politics. For a currency, it asks how one economy and its central bank compare with another’s. Technical analysis, by contrast, studies the price chart itself.",
    why: "Scheduled data releases and central bank decisions are the moments when fundamentals reach the market, and prices often move sharply around them. What usually matters is how a figure compares with what was expected, since expectations are already reflected in the price.",
    example: {
      setup: "Economists expect inflation of 3.0% and the published figure is 3.4% (invented figures).",
      steps: ["Expected: 3.0%", "Published: 3.4%", "Surprise = 3.4% − 3.0% = 0.4 percentage points higher"],
      result: "The surprise of 0.4 points is the new information; an analyst then asks what it implies for interest rates, and the market’s reaction is not certain.",
    },
    mistake: "A strong economic figure is often expected to lift the currency automatically. If the figure was already expected, or other factors outweigh it, the price may not move, or may move the other way.",
    diagramCaption: "A currency’s value sits at the centre, joined to the economic forces an analyst weighs; each link is picked out in turn.",
    diagram: { kind: "hub", labels: ["Currency value", "Growth", "Inflation", "Jobs", "Interest rates", "Politics"] },
    quiz: {
      question: "Unemployment figures are published exactly in line with forecasts. What is the usual effect on the currency?",
      options: ["A sharp rise, because the data was as good as hoped", "A sharp move lower, because traders sell on news", "Little reaction to the figure itself, since it was already expected"],
      answer: 2,
      because: "Prices already reflect what is expected. A figure that matches the forecast adds little new information, although other news at the same time can still move the price.",
    },
  },

  gap: {
    plain:
      "A gap is a jump in price from one level to another with no trading in between, so that the chart shows an empty space. Gaps appear most often when a market reopens after a closure, such as the weekend, at a price different from where it closed, and sometimes after major news.",
    why: "An order cannot be filled at a price that never traded. A stop-loss that lies inside a gap is filled at the first price available beyond it, which can be worse than the level that was set.",
    example: {
      setup: "A trader is long one standard lot with a stop-loss at 1.0980; the market closes for the weekend at 1.1000 and reopens at 1.0950 (invented figures).",
      steps: ["Gap = 1.1000 − 1.0950 = 0.0050 = 50 pips", "The stop at 1.0980 lies inside the gap, so it is filled at about 1.0950", "Extra loss = 1.0980 − 1.0950 = 30 pips; 30 × 10 = 300 US dollars"],
      result: "The stop closed the position, but at about 1.0950, which is 30 pips beyond the level that had been set.",
    },
    mistake: "A stop-loss is sometimes thought to fix the worst possible exit price. It is an instruction to close at the next available price once the level is reached, and across a gap that price can be far from the level.",
    diagramCaption: "A price line stops at the close and resumes at a lower level, leaving an empty space; moving the pointer into the space shows that no price traded there.",
    diagram: { kind: "path", shape: "gap", labels: ["Gap on reopening"], marks: ["Close", "Open"] },
    quiz: {
      question: "A market gaps down through the stop-loss of a long position. At what price is the stop filled?",
      options: ["Exactly at the stop level", "At the first available price after the gap", "It is cancelled and the position stays open"],
      answer: 1,
      because: "No trading took place at the stop level, so the order is filled at the next price the market offers. The difference from the level set is slippage.",
    },
  },
};

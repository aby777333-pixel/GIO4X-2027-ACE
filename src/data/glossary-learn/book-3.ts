import type { LessonBook } from "./types";

/** Lessons for the terms listed in .tmp/gloss-3.txt (alphabetical third 3 of 3). */
export const book3: LessonBook = {
  "profit-taking": {
    plain:
      "Profit taking is closing a position that is showing a gain, so that the gain on paper becomes money in the account. Until a position is closed, its profit can still shrink or disappear.",
    why: "When many holders close at around the same price, their closing orders push against the move that made them the profit. This is one common explanation for a pause or a dip after a strong run.",
    example: {
      setup: "A trader bought one standard lot of EUR/USD at 1.1000 and can now sell it at 1.1050.",
      steps: [
        "Move in the trader’s favour: 1.1050 − 1.1000 = 0.0050, which is 50 pips.",
        "One pip on one standard lot is worth 10 US dollars.",
        "50 pips × 10 US dollars = 500 US dollars.",
      ],
      result: "Closing the position turns the 500 US dollar gain on paper into a realised profit, before any costs such as commission or swap.",
    },
    mistake:
      "A fall after a long rise is often described as profit taking, but that is an explanation offered after the event. It does not show that the rise has ended, nor that it continues.",
    diagramCaption: "A price line climbs and then dips where holders close their positions; move along the line to draw it as far as the mark where profits are taken.",
    diagram: { kind: "path", shape: "up-then-down", labels: ["Price"], marks: ["Profits taken"] },
    quiz: {
      question: "A trader holding a long (bought) position closes it at a gain. What does that closing order add to the market?",
      options: [
        "A sell order, because a bought position is closed by selling",
        "A buy order, because the trader is collecting a gain",
        "Nothing, because closing a position is not a trade",
      ],
      answer: 0,
      because: "A long position is closed by selling. Many such sales at once add selling pressure, which is why profit taking is linked with dips after a rise.",
    },
  },

  pullback: {
    plain:
      "A pullback is a short move against the main direction of a market. In a rising market it is a dip; in a falling market it is a brief rise. The word assumes that the main direction then carries on, which is only known afterwards.",
    why: "Traders who follow trends watch pullbacks because they bring the price back towards earlier levels. The difficulty is that a pullback and the start of a reversal look the same while they are happening.",
    example: {
      setup: "A pair rises from 1.1000 to 1.1100, slips to 1.1060, then climbs to 1.1150.",
      steps: [
        "First rise: 1.1100 − 1.1000 = 100 pips.",
        "Dip: 1.1100 − 1.1060 = 40 pips, which is 40% of the rise.",
        "The low of the dip, 1.1060, is still above the starting point of 1.1000.",
      ],
      result: "Because the dip stopped above the earlier low and the price then made a new high, it is described afterwards as a pullback within an uptrend.",
    },
    mistake:
      "A pullback is sometimes described as a better price at which to join a trend. That is how some traders use it, not a property of the market: some dips keep going and become reversals.",
    diagramCaption: "A rising price line steps upward with a dip part of the way; move along the line to reach the dip marked as the pullback.",
    diagram: { kind: "path", shape: "zigzag-up", labels: ["Uptrend"], marks: ["Pullback"] },
    quiz: {
      question: "A market has been rising for weeks and dips for a day. What can be said at that moment?",
      options: [
        "The dip is a pullback and the rise is certain to resume",
        "The uptrend is over",
        "It may prove to be a pullback or the start of a reversal; only later prices show which",
      ],
      answer: 2,
      because: "A move is only confirmed as a pullback once the earlier direction resumes. While it is happening it cannot be told apart from the start of a reversal.",
    },
  },

  "quantitative-easing": {
    plain:
      "Quantitative easing, or QE, is when a central bank creates new money and uses it to buy large amounts of assets, usually government bonds, from the market. The buying pushes bond prices up, which pushes down their yields (the interest return a buyer receives), and it leaves banks holding more cash.",
    why: "QE changes the yields available in a currency, and differences in yield between countries are one of the things exchange rates respond to. Announcements about starting, slowing or ending such purchases are therefore events that currency markets watch closely.",
    example: {
      setup: "A bond pays a fixed 30 a year and trades at 1,000 before a central bank begins buying.",
      steps: [
        "Yield before: 30 ÷ 1,000 = 3%.",
        "Heavy buying lifts the bond’s price to 1,200.",
        "Yield after: 30 ÷ 1,200 = 2.5%.",
      ],
      result: "The bond’s payment has not changed, but a new buyer now earns 2.5% instead of 3% because the price is higher.",
    },
    mistake:
      "It is often said that QE weakens a currency. Lower yields can have that effect, but exchange rates also depend on what other central banks are doing and on what the market already expected, so the currency does not move in a fixed direction.",
    diagramCaption: "Four stages run from the central bank’s purchases to lower yields; step through them to follow the effect from left to right.",
    diagram: { kind: "flow", labels: ["Central bank", "Buys bonds", "Bond prices up", "Yields down"] },
    quiz: {
      question: "A central bank buys bonds on a large scale. Other things being equal, what happens to the yield on those bonds?",
      options: [
        "It rises, because the bonds are in demand",
        "It falls, because a higher price is paid for the same fixed payments",
        "It is unchanged, because the payments are fixed",
      ],
      answer: 1,
      because: "A bond’s payments are fixed, so paying a higher price for them means a lower return. Demand from the central bank raises the price and so lowers the yield.",
    },
  },

  "quote-currency": {
    plain:
      "A currency pair is written as two codes, such as EUR/USD. The second code is the quote currency: the price of the pair is the amount of the quote currency that one unit of the first currency, the base currency, costs.",
    why: "Profit and loss on a position first arise in the quote currency, and the value of one pip is a fixed amount of the quote currency. If the account is held in a different currency, that amount is then converted.",
    example: {
      setup: "EUR/USD is quoted at 1.1000 and a trader holds one standard lot, which is 100,000 euros.",
      steps: [
        "One euro costs 1.1000 US dollars, so 100,000 euros cost 110,000 US dollars.",
        "One pip is 0.0001, so one pip on the lot is 100,000 × 0.0001 = 10 US dollars.",
        "A rise of 20 pips to 1.1020 changes the value by 20 × 10 = 200 US dollars.",
      ],
      result: "The size of the position is counted in euros, the base currency, but the gain of 200 is in US dollars, the quote currency.",
    },
    mistake:
      "It is easy to assume that a pip on a standard lot is always worth 10 US dollars. For a pair quoted to four decimals it is worth 10 units of the quote currency, so on EUR/GBP it is 10 pounds.",
    diagramCaption: "Two currency codes are joined as a pair, the base on the left and the quote on the right; move across the diagram to see how the two are bound together.",
    diagram: { kind: "pair", labels: ["EUR", "USD"] },
    quiz: {
      question: "A trader gains 30 pips on one standard lot of EUR/GBP, a pair quoted to four decimals. In which currency does the gain of 300 first arise?",
      options: ["Euros", "US dollars", "Pounds sterling"],
      answer: 2,
      because: "Gains and losses arise in the quote currency, the second code in the pair. In EUR/GBP that is the pound.",
    },
  },

  rally: {
    plain:
      "A rally is a rise in price that carries on for some time, as opposed to a single jump. The word describes what the price has done; it says nothing about how long the rise lasts.",
    why: "The term appears constantly in market commentary, often with a cause attached, such as economic data or a change in central bank policy. Rallies also occur inside falling markets, where they are sometimes called relief rallies.",
    example: {
      setup: "A pair closes at 1.1000, 1.1040, 1.1070 and 1.1120 on four days in a row.",
      steps: [
        "Day two: up 40 pips. Day three: up 30 pips. Day four: up 50 pips.",
        "Total rise: 1.1120 − 1.1000 = 0.0120, which is 120 pips.",
        "As a percentage: 0.0120 ÷ 1.1000 is about 1.09%.",
      ],
      result: "Three higher closes in a row, adding up to 120 pips, would commonly be described as a rally.",
    },
    mistake:
      "A rally is not proof that a market has turned upward for good. A rise within a longer decline can be sharp and still be followed by lower prices.",
    diagramCaption: "A run of candles each closes higher than the one before; move across the diagram to follow the closes upward.",
    diagram: { kind: "candles", shape: "bullish-run", labels: ["Higher closes"] },
    quiz: {
      question: "Which statement about a rally is correct?",
      options: [
        "It only occurs in markets that are in a long-term uptrend",
        "It describes a sustained rise that has happened, without saying whether it continues",
        "It is a single large price jump on one piece of news",
      ],
      answer: 1,
      because: "A rally is a description of a rise that has lasted for some time. It can occur within a falling market, and the word carries no information about what comes next.",
    },
  },

  range: {
    plain:
      "A market is in a range when its price moves back and forth between a lower area where falls have tended to stop (support) and an upper area where rises have tended to stop (resistance), without making progress in either direction. The distance between the two is the width of the range.",
    why: "Whether a market is ranging or trending changes how its movements are read, and methods designed for one condition tend to perform poorly in the other. A range ends when the price leaves it, known as a breakout, and some breakouts quickly fail.",
    example: {
      setup: "Over two weeks a pair turns down three times near 1.1100 and turns up three times near 1.1000.",
      steps: [
        "Upper boundary: 1.1100. Lower boundary: 1.1000.",
        "Width: 1.1100 − 1.1000 = 0.0100, which is 100 pips.",
        "Midpoint: (1.1100 + 1.1000) ÷ 2 = 1.1050.",
      ],
      result: "The pair is described as ranging between 1.1000 and 1.1100, a range of 100 pips, until it moves and stays outside those levels.",
    },
    mistake:
      "The boundaries of a range are areas, not exact prices, and they hold only until they do not. Buying near the bottom and selling near the top is a known approach, but each touch of a boundary may be the one that breaks.",
    diagramCaption: "A price line moves back and forth between an upper boundary and a lower one; move along the line to see it turn at each.",
    diagram: { kind: "band", labels: ["Resistance", "Support"], breaks: "none" },
    quiz: {
      question: "What ends a range?",
      options: [
        "The price moving outside one of its boundaries and staying there",
        "A fixed number of days passing",
        "The price reaching the midpoint of the range",
      ],
      answer: 0,
      because: "A range is defined by its boundaries, so it lasts until the price leaves them. There is no time limit, and the midpoint has no special role.",
    },
  },

  "real-yields": {
    plain:
      "A bond’s stated yield, called the nominal yield, takes no account of rising prices. The real yield is what remains after expected inflation is subtracted: roughly, how much more a saver’s money is expected to buy at the end.",
    why: "Real yields allow the return on a currency’s bonds to be compared with assets that pay no interest, such as gold. They are commonly watched alongside the gold price and the US dollar, though those relationships are not constant.",
    example: {
      setup: "A bond yields 5% a year and inflation is expected to be 3% a year.",
      steps: [
        "Real yield: 5% − 3% = about 2%.",
        "Suppose expected inflation rises to 6% while the bond still yields 5%.",
        "Real yield: 5% − 6% = about minus 1%.",
      ],
      result: "The same 5% bond offers a positive real yield in the first case and a negative one in the second.",
    },
    mistake:
      "A high nominal yield does not mean a high real return. A bond paying 10% where inflation is expected to be 12% has a negative real yield.",
    diagramCaption: "Three bars show a nominal yield, expected inflation and the real yield that remains; choose a bar to measure the other two against it.",
    diagram: { kind: "bars", labels: ["Nominal yield", "Inflation", "Real yield"], sizes: [5, 3, 2] },
    quiz: {
      question: "A bond yields 4% and inflation is expected to be 4%. What is the approximate real yield?",
      options: ["8%", "4%", "0%", "Minus 4%"],
      answer: 2,
      because: "The real yield is the nominal yield less expected inflation. Here 4% − 4% leaves about zero: the interest is expected only to keep pace with prices.",
    },
  },

  recession: {
    plain:
      "A recession is a period in which an economy shrinks instead of growing: output falls, businesses sell less and unemployment tends to rise, across many industries and for more than a few months. A common rule of thumb is two quarters in a row of falling real GDP, which is the total output of the economy adjusted for inflation.",
    why: "Recessions bear on interest rate decisions, company profits and government finances, so signs of one, or of one ending, can move currencies, share indices and bonds. Markets tend to react to expectations, often before official figures confirm anything.",
    example: {
      setup: "An economy’s real GDP changes by +0.5%, −0.3%, −0.2% and +0.4% in the four quarters of a year.",
      steps: [
        "Second quarter: output falls by 0.3%.",
        "Third quarter: output falls again, by 0.2%, the second fall in a row.",
        "Fourth quarter: output grows by 0.4%.",
      ],
      result: "By the rule of thumb the economy was in recession in the second and third quarters and began to recover in the fourth.",
    },
    mistake:
      "The two-quarter rule is a shorthand, not the official definition everywhere. In some countries a committee or statistical body decides using a wider set of data, and its announcement can come long after the recession began.",
    diagramCaption: "Four stages of the business cycle follow one another in a loop; go round it to see expansion give way to recession and return.",
    diagram: { kind: "cycle", labels: ["Expansion", "Peak", "Recession", "Trough"] },
    quiz: {
      question: "An economy’s real GDP falls in one quarter and rises in the next. Under the common rule of thumb, was this a recession?",
      options: [
        "Yes, because any quarterly fall counts",
        "No, because the rule of thumb needs two consecutive quarters of decline",
        "Yes, provided share prices fell as well",
      ],
      answer: 1,
      because: "The rule of thumb is two quarters of falling real GDP in a row. One falling quarter followed by growth does not meet it.",
    },
  },

  "reference-rate": {
    plain:
      "A reference rate is an exchange rate that an official body, such as a central bank, publishes at a set time of day as a record of where the market was. It is a single number for each currency, with no separate buying and selling price.",
    why: "Reference rates are used where an agreed, neutral number is needed: converting figures in accounts, settling contracts that name the rate, or showing indicative conversions. A trader does not deal at a reference rate; dealing happens at live buying and selling prices, which move all day.",
    example: {
      setup: "A company must record a 10,000 euro invoice in US dollars, using that day’s published reference rate of 1.1000.",
      steps: [
        "Recorded value: 10,000 × 1.1000 = 11,000 US dollars.",
        "Later the same day the live market is at 1.1050: 10,000 × 1.1050 = 11,050 US dollars.",
        "Difference: 11,050 − 11,000 = 50 US dollars.",
      ],
      result: "The books show 11,000 US dollars because the reference rate was fixed for the day; a live deal would be done at whatever price the market then offers.",
    },
    mistake:
      "A reference rate is not a price anyone has promised to trade at, and it is not the live rate. It is a snapshot taken at one moment and published for information.",
    diagramCaption: "Moving market prices pass through a set time of day and come out as one published rate; step through the three stages in order.",
    diagram: { kind: "flow", labels: ["Market prices", "Set time", "Published rate"] },
    quiz: {
      question: "Why can the price at which a trader deals differ from the day’s published reference rate?",
      options: [
        "Because the reference rate is a snapshot for information, while dealing prices are live and have a buying and a selling side",
        "Because reference rates are estimates of tomorrow’s price",
        "Because brokers must deal at the reference rate plus a fixed fee",
      ],
      answer: 0,
      because: "A reference rate records the market at one moment and is not an offer to deal. Live prices keep moving and are quoted with a spread between buying and selling.",
    },
  },

  requote: {
    plain:
      "A requote happens when a trader asks to deal at the price on screen but the price has moved before the order is processed. Instead of filling the order, the broker replies with the new price and asks whether the trader still wants to deal.",
    why: "Requotes belong to instant execution, a method in which the order names a price and is either filled at that price or returned. Under market execution there is no requote: the order is filled at the best available price, and any difference shows up as slippage instead.",
    example: {
      setup: "Under instant execution a trader clicks to buy one standard lot of EUR/USD at 1.1000 in a fast market.",
      steps: [
        "By the time the order arrives the buying price is 1.1003.",
        "The broker requotes 1.1003, which is 3 pips higher than requested.",
        "On one standard lot, 3 pips × 10 US dollars = 30 US dollars.",
      ],
      result: "The trader can accept and buy at a price 30 US dollars worse than first requested, or decline and have no position.",
    },
    mistake:
      "A requote is not a fill. Until the new price is accepted nothing has been traded, and the price may move again while the trader decides.",
    diagramCaption: "An order passes through four stages, from being sent to the trader’s choice to accept or decline the new price; step through them in order.",
    diagram: { kind: "flow", labels: ["Order sent", "Price moves", "New price", "Accept or decline"] },
    quiz: {
      question: "A trader receives a requote and does not respond. What position does the trader hold as a result?",
      options: [
        "A position at the price first requested",
        "A position at the new price",
        "No position, because the order was not filled",
      ],
      answer: 2,
      because: "A requote is an offer of a new price, not an execution. Unless the trader accepts it, no trade takes place.",
    },
  },

  resistance: {
    plain:
      "Resistance is a price area where rises have stopped before, because sellers there outweighed buyers. Chart readers mark it from earlier highs and expect that sellers may appear there again.",
    why: "Resistance levels are widely watched, so orders tend to gather around them: take profit orders from holders, and stop orders from those waiting for a break higher. That clustering can make the price react at the level, in either direction.",
    example: {
      setup: "A pair has turned down from 1.1200 three times in a month and now trades at 1.1150.",
      steps: [
        "Distance to the marked level: 1.1200 − 1.1150 = 50 pips.",
        "If the price turns down again at 1.1200, the level has held a fourth time.",
        "If the price moves above 1.1200 and stays there, the level is described as broken, and some chart readers then treat it as possible support.",
      ],
      result: "The level records where selling was found before; it does not say which of the two outcomes comes next.",
    },
    mistake:
      "Resistance is not a ceiling. It is an area where selling appeared in the past, and every level that has ever been broken was resistance until then.",
    diagramCaption: "A beam weighs buyers against sellers at a resistance level and settles towards the sellers; shift the weight to see what it would take for the buyers to prevail.",
    diagram: { kind: "balance", labels: ["Buyers", "Sellers"], tilt: "right" },
    quiz: {
      question: "What does a resistance level tell a chart reader?",
      options: [
        "A price the market cannot exceed",
        "An area where selling has outweighed buying before and may do so again",
        "The highest price a broker is allowed to quote",
        "The price at which a trend must reverse",
      ],
      answer: 1,
      because: "Resistance is drawn from past behaviour. It marks where selling was strong before, which makes it a level to watch and not a limit.",
    },
  },

  retracement: {
    plain:
      "A retracement is a partial move back against a larger move, measured as a share of it. If a price rises by 200 pips and then gives back 100, it has retraced half of the rise.",
    why: "Chart readers often measure retracements with Fibonacci levels, a set of percentages of the earlier move; 38.2%, 50% and 61.8% are the ones most often drawn. These are conventions that many people watch, not natural limits on how far a price can come back.",
    example: {
      setup: "A pair rises from 1.1000 to 1.1200 and then falls to 1.1100.",
      steps: [
        "Rise: 1.1200 − 1.1000 = 200 pips.",
        "Given back: 1.1200 − 1.1100 = 100 pips.",
        "Share retraced: 100 ÷ 200 = 0.5, which is 50%.",
        "For comparison, 38.2% of the rise is 200 × 0.382 = 76.4 pips, a fall to about 1.1124.",
      ],
      result: "The fall to 1.1100 is a 50% retracement of the rise.",
    },
    mistake:
      "Calling a move a retracement assumes the earlier trend resumes. That is only known later: a move that goes back past the start of the earlier swing was a reversal, not a retracement.",
    diagramCaption: "Part of a whole move is marked off to show how much of it has been given back; move across the diagram to compare the part with the whole.",
    diagram: { kind: "share", labels: ["Retraced", "Whole move"], share: 0.5 },
    quiz: {
      question: "A price falls from 1.3000 to 1.2800, then rises to 1.2850. What share of the fall has been retraced?",
      options: ["25%", "50%", "75%"],
      answer: 0,
      because: "The fall was 200 pips and the rise back was 50 pips. 50 ÷ 200 is one quarter, or 25%.",
    },
  },

  "risk-management": {
    plain:
      "Risk management is deciding, before a trade is opened, how much could be lost and taking steps to keep that amount within a chosen limit. The main tools are the size of the position, an order that closes it at a set loss (a stop loss), and not having every position depend on the same market move.",
    why: "With leverage a position can be far larger than the money in the account, so losses can build quickly. A common convention is to limit the loss planned on any one trade to a small percentage of the account, often quoted as 1% or 2%.",
    example: {
      setup: "A trader with a 10,000 US dollar account chooses to risk 1% on a EUR/USD trade whose stop loss is 50 pips from the entry.",
      steps: [
        "Amount at risk: 1% of 10,000 = 100 US dollars.",
        "Value per pip that fits: 100 ÷ 50 pips = 2 US dollars a pip.",
        "One standard lot is worth 10 US dollars a pip, so 2 US dollars a pip is 0.2 lots.",
      ],
      result: "At 0.2 lots a 50 pip loss is 100 US dollars, which is 1% of the account, provided the stop is filled at its price.",
    },
    mistake:
      "Risk management limits planned losses; it does not remove risk. A stop loss can be filled at a worse price when the market gaps or moves fast, so the actual loss can exceed the planned one.",
    diagramCaption: "Risk management sits at the centre, joined to four tools that serve it; move across the diagram to pick out each link in turn.",
    diagram: { kind: "hub", labels: ["Risk management", "Position size", "Stop loss", "Diversification", "Risk per trade"] },
    quiz: {
      question: "A trader keeps the same 1% limit on risk but places the stop loss twice as far from the entry. What happens to the position size that fits the limit?",
      options: ["It doubles", "It stays the same", "It halves"],
      answer: 2,
      because: "The amount at risk is the stop distance multiplied by the value per pip. If the distance doubles and the amount at risk is fixed, the value per pip, and so the position size, must halve.",
    },
  },

  "risk-reward-ratio": {
    plain:
      "The risk-reward ratio compares what a trade stands to lose if it reaches its stop loss with what it stands to gain if it reaches its target. A ratio of 1:3 means the planned gain is three times the planned loss.",
    why: "The ratio is tied to how often a trader needs to be right. At 1:3 one winning trade covers three losing ones, so the break-even point, before costs, is winning one trade in four.",
    example: {
      setup: "A trader buys EUR/USD at 1.1000 with a stop loss at 1.0950 and a take profit at 1.1150.",
      steps: [
        "Risk: 1.1000 − 1.0950 = 50 pips.",
        "Reward: 1.1150 − 1.1000 = 150 pips.",
        "Ratio: 50 to 150, which is 1:3.",
        "Break-even win rate before costs: 1 ÷ (1 + 3) = 25%.",
      ],
      result: "On one standard lot the plan risks 500 US dollars to aim for 1,500, a ratio of 1:3.",
    },
    mistake:
      "A bigger ratio is not automatically better. A target placed further away is reached less often, so the ratio means something only together with how often trades of that kind succeed. No particular ratio is the mark of a successful trader.",
    diagramCaption: "Two bars compare the planned loss with the planned gain, the second three times the height of the first; choose a bar to measure the other against it.",
    diagram: { kind: "bars", labels: ["Risk", "Reward"], sizes: [3, 9] },
    quiz: {
      question: "At a risk-reward ratio of 1:1, what share of trades must win for a trader to break even, ignoring costs?",
      options: ["75%", "25%", "100%", "50%"],
      answer: 3,
      because: "At 1:1 each win is the same size as each loss, so wins and losses must be equal in number. The general rule is risk ÷ (risk + reward), here 1 ÷ 2.",
    },
  },

  rollover: {
    plain:
      "Currency trades at today’s price are due to settle a couple of business days after they are made. A trader who wants to keep a position open, and not exchange the currencies, has the settlement date pushed forward by one day at the end of each trading day. That daily push is the rollover.",
    why: "Each rollover comes with an interest adjustment called swap, which can be a charge or a credit. On one day of the week, commonly Wednesday for many currency pairs, the adjustment is applied three times to cover the weekend.",
    example: {
      setup: "A trader opens a position on Monday and closes it on Friday before the daily cut-off; the swap is a charge of 5 US dollars a night, tripled on Wednesday.",
      steps: [
        "Rollovers passed: Monday, Tuesday, Wednesday and Thursday.",
        "Wednesday counts three times, so the nights charged are 1 + 1 + 3 + 1 = 6.",
        "Total swap: 6 × 5 US dollars = 30 US dollars.",
      ],
      result: "The position passes four rollovers and is charged six nights of swap, 30 US dollars in all.",
    },
    mistake:
      "Rollover applies at a fixed cut-off time, not after 24 hours of holding. A position opened minutes before the cut-off is rolled, while one opened just after it and closed before the next is not.",
    diagramCaption: "Four stages repeat each trading day in a loop, from an open position to the swap being applied; go round the loop to follow one day.",
    diagram: { kind: "cycle", labels: ["Position open", "Daily cut-off", "Date moved on", "Swap applied"] },
    quiz: {
      question: "A position is opened ten minutes before the daily rollover time and closed twenty minutes later. How many times is its settlement date rolled forward?",
      options: [
        "Not at all, because it was open for less than a day",
        "Once, because it was open at the cut-off",
        "Twice, once for opening and once for closing",
      ],
      answer: 1,
      because: "Rollover is applied to every position that is open at the cut-off time, however briefly it has been held. This position was open at one cut-off.",
    },
  },

  rsi: {
    plain:
      "The Relative Strength Index, or RSI, is a line on a chart that moves between 0 and 100. It compares the size of recent rises with the size of recent falls: the more the recent gains outweigh the losses, the higher the reading.",
    why: "By convention a reading above 70 is called overbought and one below 30 oversold, meaning the price has moved a long way in one direction in a short time. These are descriptions of what has happened, and a market can stay above 70 or below 30 for a long time while a trend continues.",
    example: {
      setup: "Over the chosen period, commonly 14 bars, a pair’s average gain is 3 pips and its average loss is 1 pip.",
      steps: [
        "Relative strength: average gain ÷ average loss = 3 ÷ 1 = 3.",
        "RSI = 100 − 100 ÷ (1 + 3).",
        "100 ÷ 4 = 25, and 100 − 25 = 75.",
      ],
      result: "The RSI reads 75, above the conventional line at 70, so the reading would be described as overbought.",
    },
    mistake:
      "Overbought does not mean the price is about to drop, and oversold does not mean it is about to climb. In a strong trend the RSI can remain at an extreme while the price keeps going.",
    diagramCaption: "A line swings between an upper zone and a lower zone on a scale from 0 to 100; move across the diagram to follow it into and out of each zone.",
    diagram: { kind: "oscillator", labels: ["Overbought", "Oversold"] },
    quiz: {
      question: "The RSI reads 80 during a strong uptrend. What does the reading establish?",
      options: [
        "That recent gains have been much larger than recent losses",
        "That the price is about to turn down",
        "That the price is at 80% of its highest level",
      ],
      answer: 0,
      because: "The RSI is calculated from recent gains and losses, so a high reading describes what has just happened. It is not a statement about the next move.",
    },
  },

  "safe-haven": {
    plain:
      "A safe haven is an asset that investors have tended to buy when markets are frightened, for example during a financial crisis or a sharp fall in share prices. Gold, the Swiss franc, the Japanese yen and US government bonds have often been described this way.",
    why: "The idea helps to explain why some currencies and gold have at times moved against shares in periods of stress. The label is drawn from past behaviour, and an asset that rose in one crisis has not always risen in the next.",
    mistake:
      "Safe does not mean the price cannot go down. A safe-haven asset can lose value, sometimes quickly, including in the middle of a crisis when investors sell whatever they can to raise cash.",
    diagramCaption: "Market stress sits at the centre, joined to four assets that investors have often moved towards; move across the diagram to pick out each link in turn.",
    diagram: { kind: "hub", labels: ["Market stress", "Gold", "Swiss franc", "Japanese yen", "US Treasuries"] },
    quiz: {
      question: "What does calling an asset a safe haven actually claim?",
      options: [
        "That its price cannot go down",
        "That a regulator protects its value",
        "That it has often attracted buyers in past periods of market stress",
      ],
      answer: 2,
      because: "The term describes how investors have behaved in the past. It is not a protection and not a promise about how the asset behaves next time.",
    },
  },

  scalping: {
    plain:
      "Scalping is a style of trading that opens and closes positions within seconds or minutes, aiming for a gain of a few pips each time and repeating this many times a day.",
    why: "Because each target is so small, trading costs take a large share of it, and a single loss can cancel several gains. Scalping also depends heavily on execution: a fill one pip worse than expected matters far more than it would on a longer trade.",
    example: {
      setup: "A scalper aims for 5 pips a trade on one standard lot, in a pair with a spread of 1 pip.",
      steps: [
        "A gain of 5 pips on one standard lot is 5 × 10 = 50 US dollars.",
        "The spread of 1 pip costs 1 × 10 = 10 US dollars on each trade.",
        "Share of the target: 10 ÷ 50 = 20%.",
        "Over 20 trades the spread alone costs 20 × 10 = 200 US dollars.",
      ],
      result: "The spread equals 20% of each 5 pip target; against a 100 pip target the same 1 pip spread would be 1%.",
    },
    mistake:
      "Small targets do not mean small risk. Scalpers often use large positions to make a few pips worthwhile, so a sudden move or a poor fill can produce a loss many times the usual gain.",
    diagramCaption: "Part of a whole is marked off to show how much of a small profit target the spread takes; move across the diagram to compare the part with the whole.",
    diagram: { kind: "share", labels: ["Spread cost", "Target"], share: 0.2 },
    quiz: {
      question: "Why do trading costs matter more to a scalper than to a trader who holds for days?",
      options: [
        "Because scalpers are charged a wider spread by rule",
        "Because the same spread is a much larger fraction of a small target, and it is paid on each of many trades",
        "Because scalpers pay overnight swap on every trade",
      ],
      answer: 1,
      because: "A spread of 1 pip is a fifth of a 5 pip target but a hundredth of a 100 pip target, and a scalper pays it many times a day. Swap applies only to positions held past the daily cut-off.",
    },
  },

  sentiment: {
    plain:
      "Sentiment is the prevailing mood of the people trading a market: whether most expect prices to go up (bullish), to go down (bearish), or have no strong view. It cannot be observed directly, so it is estimated from surveys, from data on how traders are positioned, and from the behaviour of the price itself.",
    why: "Sentiment is one explanation for why a market sometimes moves against what the news seems to imply: if most participants were already positioned for good news, there may be few buyers left when it arrives. Readings at an extreme are watched for this reason, although extremes can persist.",
    example: {
      setup: "A positioning report for one group of traders shows 1,400 long (bought) positions and 600 short (sold) positions in a pair.",
      steps: [
        "Total positions: 1,400 + 600 = 2,000.",
        "Long share: 1,400 ÷ 2,000 = 70%.",
        "Short share: 600 ÷ 2,000 = 30%.",
      ],
      result: "The group is described as 70% long, a bullish reading for that group, which says nothing certain about the wider market.",
    },
    mistake:
      "Positioning figures from one broker or one survey describe only the traders they cover. The currency market has no central exchange, so no single source shows the positions of everyone.",
    diagramCaption: "A line drifts between a very bullish zone at the top and a very bearish zone at the bottom; move across the diagram to follow the mood to each extreme.",
    diagram: { kind: "oscillator", labels: ["Very bullish", "Very bearish"] },
    quiz: {
      question: "A broker reports that 80% of its clients with positions in a pair are long. What does this show?",
      options: [
        "How that broker’s clients are positioned, and nothing certain about the rest of the market",
        "That 80% of the whole market is long",
        "That the pair must go up because most traders agree",
      ],
      answer: 0,
      because: "The figure covers one broker’s clients only. It is a sample of sentiment, not a measure of the whole market, and it does not determine the next move.",
    },
  },

  "short-selling": {
    plain:
      "Short selling is opening a trade by selling first, with the aim of buying back later at a lower price. If the price goes down, the difference is the gain; if it goes up, the difference is the loss. In a currency pair, selling the pair means selling the base currency and buying the quote currency.",
    why: "It lets a trader act on a view that a price is heading lower, and with products such as CFDs it needs no ownership of the thing sold. The risk is shaped differently from buying: a price can drop only as far as zero but has no upper limit, so the possible loss on a short position has no fixed ceiling.",
    example: {
      setup: "A trader sells one standard lot of EUR/USD at 1.1000.",
      steps: [
        "Bought back at 1.0950: a fall of 50 pips, and 50 × 10 = 500 US dollars gained.",
        "Bought back at 1.1050 instead: a rise of 50 pips, and 50 × 10 = 500 US dollars lost.",
        "A short position is closed by buying at the higher of the two quoted prices, so the spread is paid on the way out.",
      ],
      result: "The short position gains when the pair goes down and loses when it goes up, the mirror image of a bought position.",
    },
    mistake:
      "Selling a currency pair short is not a bet against money as such. Selling EUR/USD is at the same time buying US dollars with euros, so a short position in one currency is always a long position in another.",
    diagramCaption: "A falling price line carries two marks, the sale at the higher price and the purchase back at the lower one; move along the line to reach each mark.",
    diagram: { kind: "path", shape: "down", labels: ["Price"], marks: ["Sell", "Buy back"] },
    quiz: {
      question: "A trader sells a pair short at 1.2500 and later buys it back at 1.2540. What is the outcome?",
      options: [
        "A gain of 40 pips",
        "A loss of 40 pips",
        "Neither, until the pair is sold again",
      ],
      answer: 1,
      because: "A short position gains only if the pair is bought back for less than it was sold. Here it was bought back 40 pips higher, which is a loss.",
    },
  },

  slippage: {
    plain:
      "Slippage is the difference between the price a trader expected for an order and the price at which it was actually filled. It arises because the price can move in the moment between sending an order and its execution, or because not enough is available at the expected price to fill the whole order.",
    why: "It is most common when prices move fast, such as around major news, or when few orders are resting in the market, such as when trading reopens after a weekend. It affects market orders and stop orders, including stop losses, which become market orders once triggered.",
    example: {
      setup: "A trader sends a market order to buy one standard lot of EUR/USD with a buying price of 1.1000 on screen.",
      steps: [
        "The order is filled at 1.1002.",
        "Slippage: 1.1002 − 1.1000 = 0.0002, which is 2 pips.",
        "Cost: 2 × 10 US dollars = 20 US dollars.",
      ],
      result: "The trade starts 20 US dollars worse than expected; had the fill been 1.0999, the slippage would have been 1 pip in the trader’s favour.",
    },
    mistake:
      "Slippage is not always against the trader. A fill can also be better than the expected price, which is called positive slippage.",
    diagramCaption: "Two prices, the expected price and the fill price, run apart with the distance between them named as slippage; narrow or widen the gap to see small and large slippage.",
    diagram: { kind: "gap", labels: ["Fill price", "Expected price", "Slippage"] },
    quiz: {
      question: "A stop loss on a bought position is set at 1.1000. After a weekend the market reopens at 1.0970, below it. At roughly what price is the stop filled?",
      options: [
        "Around 1.0970, the first price available, which is 30 pips worse",
        "At 1.1000, because that is the price on the order",
        "It is cancelled, because its price was skipped",
      ],
      answer: 0,
      because: "A triggered stop becomes an order to close at the best price available. If the market has jumped past the stop level, the first available price is beyond it.",
    },
  },

  "spot-market": {
    plain:
      "The spot market is where currencies are bought and sold at today’s price for delivery straight away. In practice “straight away” means settlement a short time after the trade: by convention two business days for most currency pairs, and one for a few.",
    why: "The spot price is the exchange rate most people mean when they quote a currency, and other products such as forwards and CFDs are priced from it. Retail traders using margin accounts rarely take delivery of currency; their positions are rolled forward each day instead.",
    example: {
      setup: "On a Monday a bank agrees to buy 1,000,000 euros against US dollars at a spot rate of 1.1000.",
      steps: [
        "Amount fixed on Monday: 1,000,000 × 1.1000 = 1,100,000 US dollars.",
        "Under the two-day convention both sides deliver on Wednesday, assuming no holidays.",
        "Movements in the rate between Monday and Wednesday do not change either amount.",
      ],
      result: "On Wednesday the bank receives 1,000,000 euros and pays 1,100,000 US dollars, at the rate agreed on Monday.",
    },
    mistake:
      "Spot does not mean the money changes hands instantly. The price is agreed on the spot; the exchange itself follows on the settlement date.",
    diagramCaption: "A spot trade passes through three stages, from agreement through the settlement period to settlement; step through them in order.",
    diagram: { kind: "flow", labels: ["Trade agreed", "Two business days", "Settlement"] },
    quiz: {
      question: "A spot trade is agreed on a Tuesday under the two business day convention, with no holidays that week. When does it settle?",
      options: ["Tuesday", "Wednesday", "Thursday", "The following Tuesday"],
      answer: 2,
      because: "Two business days after Tuesday is Thursday. The price is fixed on the trade date and the currencies are exchanged on the settlement date.",
    },
  },

  spread: {
    plain:
      "Every quote has two prices: the ask, at which a trader can buy, and the bid, at which a trader can sell. The ask is the higher of the two, and the difference between them is the spread.",
    why: "The spread is a cost paid on every trade without appearing as a separate charge. A position is opened at one price and can only be closed at the other, so it starts with a small loss equal to the spread.",
    example: {
      setup: "EUR/USD is quoted with a bid of 1.1000 and an ask of 1.1002, and a trader buys one standard lot.",
      steps: [
        "Spread: 1.1002 − 1.1000 = 0.0002, which is 2 pips.",
        "Cost on one standard lot: 2 × 10 US dollars = 20 US dollars.",
        "The lot is bought at 1.1002 and could be sold at once only at 1.1000.",
      ],
      result: "The trade opens showing a loss of 20 US dollars, and the bid must climb 2 pips to 1.1002 before it breaks even.",
    },
    mistake:
      "The spread is not the only cost of trading. Depending on the account there may also be commission and overnight swap, so a narrow spread with a commission can cost more or less than a wider spread without one.",
    diagramCaption: "The ask runs above the bid with the distance between them named as the spread; narrow or widen the gap to see a tighter or a wider spread.",
    diagram: { kind: "gap", labels: ["Ask", "Bid", "Spread"] },
    quiz: {
      question: "With a bid of 1.2500 and an ask of 1.2503, a trader buys one standard lot and sells it again at once. What is the result?",
      options: [
        "No gain or loss",
        "A gain of 3 pips",
        "A loss of 3 pips, which is 30 units of the quote currency",
      ],
      answer: 2,
      because: "The trader buys at the ask, 1.2503, and sells at the bid, 1.2500. The 3 pip difference is the spread, and on one standard lot it is worth 30 units of the quote currency.",
    },
  },

  "stop-loss": {
    plain:
      "A stop loss is an instruction attached to a position to close it if the price moves against the trader to a chosen level. For a position that was bought it sits below the current price; for one that was sold it sits above.",
    why: "It fixes in advance the loss a trader plans to accept, and it works without the trader watching the screen. The distance to the stop, together with the size of the position, determines the amount at risk.",
    example: {
      setup: "A trader buys one standard lot of EUR/USD at 1.1000 with a stop loss at 1.0970.",
      steps: [
        "Distance to the stop: 1.1000 − 1.0970 = 30 pips.",
        "Planned loss: 30 × 10 US dollars = 300 US dollars.",
        "If the market jumps past the stop and the first price available is 1.0960, the loss is 40 pips, or 400 US dollars.",
      ],
      result: "The stop sets the planned loss at 300 US dollars, but the actual loss depends on the price at which the order is filled.",
    },
    mistake:
      "A stop loss is not a guarantee of the exit price. Once the level is reached it becomes an order to close at the best price available, which can be worse in a fast market or after a gap.",
    diagramCaption: "Three price levels are stacked, a take profit above the current price and a stop loss below it; move across the diagram to bring the price to either order.",
    diagram: { kind: "levels", labels: ["Take profit", "Current price", "Stop loss"] },
    quiz: {
      question: "A trader has sold a pair short at 1.3000. Where does the stop loss for this position sit?",
      options: [
        "Below 1.3000, because stops always sit below the entry",
        "Above 1.3000, because a short position loses when the price goes up",
        "Exactly at 1.3000",
      ],
      answer: 1,
      because: "A stop loss sits on the losing side of the position. A short position loses as the price climbs, so its stop is above the entry.",
    },
  },

  "stop-order": {
    plain:
      "A stop order is an instruction to open a trade only if the price reaches a level beyond the current one: a buy stop is placed above the current price and a sell stop below it. When the level is reached the order becomes a market order and is filled at the best price then available.",
    why: "It lets a trader enter only if the market first moves in the chosen direction, for example through a level it has failed to pass before. Because the fill happens at the market, the price obtained can differ from the level set, especially in a fast move.",
    example: {
      setup: "EUR/USD trades at 1.1000, and a trader places a buy stop at 1.1050 and a sell stop at 1.0950.",
      steps: [
        "The buy stop is 50 pips above the price and the sell stop is 50 pips below it.",
        "If the buying price reaches 1.1050 the buy stop is triggered and becomes a market order.",
        "If the market is moving quickly and the fill is 1.1052, the slippage is 2 pips.",
      ],
      result: "The order waits unused until its level is touched and then buys at the market, here at 1.1052 and not 1.1050.",
    },
    mistake:
      "A stop order is often confused with a limit order. A limit order waits for a better price (buying lower, selling higher) and does not fill at a worse one; a stop order waits for a higher price to buy or a lower price to sell and, once triggered, accepts the market price.",
    diagramCaption: "Three price levels are stacked, a buy stop above the current price and a sell stop below it; move across the diagram to bring the price to either order.",
    diagram: { kind: "levels", labels: ["Buy stop", "Current price", "Sell stop"] },
    quiz: {
      question: "The price is 1.2000 and a trader wants to buy only if it climbs to 1.2060. Which order does that?",
      options: ["A buy stop at 1.2060", "A buy limit at 1.2060", "A sell stop at 1.2060"],
      answer: 0,
      because: "A buy stop rests above the current price and triggers when the market reaches it. A buy limit is used to buy at a lower price than the current one.",
    },
  },

  "stop-out": {
    plain:
      "Leveraged positions need a deposit called margin. The margin level compares the account’s equity, which is its balance plus or minus the result of open positions, with the margin in use. If losses push the margin level down to the broker’s stop out level, the broker starts closing positions automatically.",
    why: "Stop out is the point at which the trader no longer decides which positions close or when. It usually comes after a margin call, a warning at a higher level, and it exists to stop the account’s losses running further.",
    example: {
      setup: "An account has 2,000 US dollars of equity and 1,000 of used margin; suppose, for the example, that the broker’s stop out level is 50%.",
      steps: [
        "Margin level: 2,000 ÷ 1,000 × 100% = 200%.",
        "Open positions lose 1,500, so equity drops to 2,000 − 1,500 = 500.",
        "Margin level: 500 ÷ 1,000 × 100% = 50%.",
      ],
      result: "At 50% the margin level has reached the assumed stop out level and positions begin to be closed, commonly starting with the one showing the largest loss.",
    },
    mistake:
      "Stop out does not ensure that the account ends above zero. In a gap or a very fast market, positions can be closed at prices worse than the level implies, and the balance can go negative.",
    diagramCaption: "The margin level comes down towards the stop out level, and positions are closed once it crosses; move it towards the level to see the crossing.",
    diagram: { kind: "threshold", labels: ["Stop out level", "Margin level", "Positions closed"], from: "above" },
    quiz: {
      question: "An account has equity of 600 and used margin of 1,200. What is its margin level?",
      options: ["200%", "20%", "50%"],
      answer: 2,
      because: "Margin level is equity divided by used margin. 600 ÷ 1,200 = 0.5, which is 50%.",
    },
  },

  support: {
    plain:
      "Support is a price area where falls have stopped before, because buyers there outweighed sellers. Chart readers mark it from earlier lows and expect that buyers may appear there again.",
    why: "Because many people watch the same levels, orders gather around them: buy orders from those expecting a bounce, and stop losses just below from those already holding. A break of support can therefore set off a burst of selling.",
    example: {
      setup: "A pair has turned up from 1.0900 three times in a month and now trades at 1.0940.",
      steps: [
        "Distance to the marked level: 1.0940 − 1.0900 = 40 pips.",
        "If the price turns up again at 1.0900, the level has held a fourth time.",
        "If the price moves below 1.0900 and stays there, the level is described as broken, and some chart readers then treat it as possible resistance.",
      ],
      result: "The level records where buying was found before; it does not say which of the two outcomes comes next.",
    },
    mistake:
      "Support is not a floor. The more often a level is tested the more it is talked about, but each test may be the one that fails.",
    diagramCaption: "A price line drops to a marked level and turns back up from it; move along the line to reach the mark where support was found.",
    diagram: { kind: "path", shape: "down-then-up", labels: ["Price"], marks: ["Support"] },
    quiz: {
      question: "A support level that held four times is broken, and the price stays below it. How do some chart readers then treat that level?",
      options: [
        "As possible resistance if the price climbs back to it",
        "As stronger support than before",
        "As a price the market can never return to",
      ],
      answer: 0,
      because: "A broken support level is often watched as possible resistance, on the view that those who bought there may sell when the price returns. It is a convention of chart reading, not a rule.",
    },
  },

  swap: {
    plain:
      "Swap is the interest adjustment made to a position that is kept open past the daily cut-off. Holding a currency pair means, in effect, holding one currency and owing the other, and each carries an interest rate; the swap reflects the gap between the two, and it can be a credit or a charge.",
    why: "A trade closed within the day never meets swap; for one held for weeks it can add up to a meaningful part of the result. Brokers publish one swap rate for buying and one for selling each instrument, and these include the broker’s own charge.",
    example: {
      setup: "A position has a notional value of 100,000 US dollars; the currency bought earns 4.65% a year and the currency sold costs 1% a year, before any broker charge.",
      steps: [
        "Interest difference: 4.65% − 1% = 3.65% a year.",
        "Over a year: 100,000 × 3.65% = 3,650 US dollars.",
        "Per night: 3,650 ÷ 365 = 10 US dollars.",
      ],
      result: "The raw interest difference is a credit of 10 US dollars a night, and the opposite position would pay that much; in practice a broker’s rates make the credit smaller and the charge larger.",
    },
    mistake:
      "A positive interest difference does not always produce a swap credit. Once the broker’s charge is included, the swap can be a cost in both directions.",
    diagramCaption: "A beam weighs the interest earned on one currency against the interest paid on the other; shift the weight to see the difference turn from a credit into a charge.",
    diagram: { kind: "balance", labels: ["Interest earned", "Interest paid"], tilt: "left" },
    quiz: {
      question: "A trader opens and closes a position within the same trading day, before the daily cut-off. How much swap applies?",
      options: ["One night’s swap", "Half a night’s swap", "None"],
      answer: 2,
      because: "Swap is applied only to positions that are open at the daily cut-off. A position opened and closed between two cut-offs never meets one.",
    },
  },

  "swing-trading": {
    plain:
      "Swing trading is a style that holds positions for several days to a few weeks, aiming to capture one “swing”: a single move up or down within a larger pattern. It sits between day trading, which closes everything before the day ends, and long-term position trading.",
    why: "Holding for days means fewer trades and less attention to each small price change, but it brings exposures a day trader avoids: positions stay open overnight and across weekends, when prices can gap, and swap is applied each night.",
    example: {
      setup: "A trader buys 0.5 lots of EUR/USD at 1.1000, holds for 6 nights with a swap charge of 2 US dollars a night, and closes at 1.1120.",
      steps: [
        "Move: 1.1120 − 1.1000 = 120 pips.",
        "0.5 lots is worth 5 US dollars a pip, so 120 × 5 = 600 US dollars.",
        "Swap: 6 × 2 = 12 US dollars.",
      ],
      result: "The net gain is 600 − 12 = 588 US dollars before any other costs; had the price dropped 120 pips instead, the loss would have been 600 + 12 = 612 US dollars.",
    },
    mistake:
      "Fewer trades does not mean lower risk. Stops on swing trades are usually set further away than on short-term trades, and a weekend gap can carry the price straight past them.",
    diagramCaption: "Four bars compare how long positions are typically held in four styles of trading, from the shortest to the longest; choose a bar to measure the others against it.",
    diagram: { kind: "bars", labels: ["Scalping", "Day trading", "Swing trading", "Position trading"], sizes: [1, 3, 6, 10] },
    quiz: {
      question: "Which exposure does a swing trader carry that a trader who closes every position within the day does not?",
      options: [
        "Overnight and weekend gaps, and nightly swap",
        "The spread between buying and selling prices",
        "Price movement of any kind",
      ],
      answer: 0,
      because: "Both pay the spread and both are exposed to price movement. Only positions held past the daily cut-off and over weekends meet swap and the risk of the market reopening at a different price.",
    },
  },

  "take-profit": {
    plain:
      "A take profit is an instruction attached to a position to close it when the price reaches a chosen level in the trader’s favour. For a position that was bought it sits above the current price; for one that was sold, below.",
    why: "It lets a target be set in advance, so the position closes without the trader watching. It is a limit order, so it fills at the chosen price or better, but only if the market actually trades there.",
    example: {
      setup: "A trader buys one standard lot of EUR/USD at 1.1000 with a take profit at 1.1080.",
      steps: [
        "Distance to the target: 1.1080 − 1.1000 = 80 pips.",
        "Gain if filled: 80 × 10 US dollars = 800 US dollars.",
        "If the selling price peaks at 1.1078 and turns back, the order is not triggered.",
      ],
      result: "The position closes with a gain of 800 US dollars only if the selling price reaches 1.1080; a rise that stops 2 pips short leaves it open.",
    },
    mistake:
      "Setting a take profit does not make the gain likely. It is filled only if the price gets there, and a bought position is closed at the bid, the lower of the two quoted prices, so a chart may appear to touch the level without the order filling.",
    diagramCaption: "The price climbs towards the take profit level, and the position closes once it crosses; move it towards the level to see the crossing.",
    diagram: { kind: "threshold", labels: ["Take profit", "Price", "Position closes"], from: "below" },
    quiz: {
      question: "A bought position has a take profit at 1.1500. The selling price climbs to 1.1497 and then drops away. What happens?",
      options: [
        "The position is closed at 1.1497",
        "The position stays open, because the level was not reached",
        "The position is closed at 1.1500",
      ],
      answer: 1,
      because: "A take profit is triggered only when the price reaches its level. Coming within 3 pips leaves the order unfilled and the position open.",
    },
  },

  "technical-analysis": {
    plain:
      "Technical analysis studies the record of a market’s own prices, usually on charts, to describe how it has been behaving. It uses tools such as trend lines, levels where the price has turned before, recurring shapes called patterns, and indicators, which are calculations made from past prices.",
    why: "It gives traders a common language for describing a market and for deciding in advance where an idea would be judged wrong. It is usually contrasted with fundamental analysis, which studies the economy, interest rates and news instead of the chart.",
    example: {
      setup: "An indicator is arithmetic on past prices: take a pair’s last three closing prices of 1.1000, 1.1020 and 1.1040.",
      steps: [
        "Sum: 1.1000 + 1.1020 + 1.1040 = 3.3060.",
        "Average: 3.3060 ÷ 3 = 1.1020.",
        "When the next close arrives, the oldest price drops out and the average is worked out again.",
      ],
      result: "The three-period moving average is 1.1020, a number built entirely from prices that have already happened.",
    },
    mistake:
      "Technical analysis does not forecast with certainty. Indicators are calculated from past prices, so they describe what has happened, and every pattern has cases where the expected outcome did not follow.",
    diagramCaption: "A price chart sits at the centre, joined to the four kinds of tool used to read it; move across the diagram to pick out each link in turn.",
    diagram: { kind: "hub", labels: ["Price chart", "Trends", "Levels", "Patterns", "Indicators"] },
    quiz: {
      question: "What information does a technical indicator such as a moving average use?",
      options: [
        "Economic data such as inflation and employment",
        "A broker’s forecast of future prices",
        "Past prices, and sometimes volume, of the market itself",
      ],
      answer: 2,
      because: "Technical indicators are calculations on a market’s own past prices and sometimes its volume. Economic data belongs to fundamental analysis.",
    },
  },

  tick: {
    plain:
      "A tick is the smallest step by which a quoted price can change. Where a currency pair is quoted to five decimal places, the last digit is one tenth of a pip, and a move of one in that digit is one tick. The word is also used for each single update of the price.",
    why: "Platforms record every price update as a tick, which is where terms such as tick chart and tick volume come from. Knowing the smallest step also explains why spreads and price changes are often shown in fractions of a pip.",
    example: {
      setup: "EUR/USD moves from 1.10000 to 1.10001 while a trader holds one standard lot.",
      steps: [
        "Change: 1.10001 − 1.10000 = 0.00001, one tenth of a pip.",
        "Value on one standard lot: 100,000 × 0.00001 = 1 US dollar.",
        "Ten such steps make one pip, worth 10 US dollars.",
      ],
      result: "One tick on this quote changes the value of a standard lot by 1 US dollar.",
    },
    mistake:
      "A tick and a pip are not the same thing. On a five-decimal quote a pip is still the fourth decimal place, and ten of the smallest steps make one pip.",
    diagramCaption: "A small part of a whole is marked off to show one tick as a tenth of one pip; move across the diagram to compare the part with the whole.",
    diagram: { kind: "share", labels: ["One tick", "One pip"], share: 0.1 },
    quiz: {
      question: "A five-decimal quote moves from 1.25000 to 1.25007. How far has it moved?",
      options: ["0.7 of a pip", "7 pips", "70 pips"],
      answer: 0,
      because: "The fifth decimal place counts tenths of a pip. A change of 7 in that place is seven tenths of one pip.",
    },
  },

  trader: {
    plain:
      "A trader is anyone who buys and sells financial instruments with the aim of gaining from changes in price, as opposed to holding them for the long term or needing them for business. Traders range from individuals with small accounts, called retail traders, to banks, funds and companies dealing in very large amounts.",
    why: "Every trade has two sides: for each trader who buys there is a counterparty who sells. Most of the volume in currencies comes from institutions and not from individuals, which puts a retail trader’s own orders in proportion.",
    example: {
      setup: "A retail trader buys 0.1 lots of EUR/USD while a bank deals 50,000,000 euros in a single trade.",
      steps: [
        "Retail trade: 0.1 × 100,000 = 10,000 euros.",
        "Bank trade: 50,000,000 euros.",
        "Ratio: 50,000,000 ÷ 10,000 = 5,000.",
      ],
      result: "The bank’s deal is 5,000 times the size of the retail one, which is why a single retail order has no noticeable effect on the price of a heavily traded pair.",
    },
    mistake:
      "Trading is not the same as investing, and it is not a dependable source of income. Regulators in several jurisdictions require brokers to state what proportion of their retail clients lose money on leveraged products, and the published figures show that most do.",
    diagramCaption: "A beam holds a buyer on one side and a seller on the other; shift the weight between them to see that every trade has two sides.",
    diagram: { kind: "balance", labels: ["Buyer", "Seller"], tilt: "level" },
    quiz: {
      question: "A trader buys one lot of a currency pair. What must also have happened?",
      options: [
        "The number of buyers in the market now exceeds the number of sellers",
        "A central bank issued more of the currency",
        "A counterparty, such as a broker or a liquidity provider, sold one lot as the other side of the trade",
      ],
      answer: 2,
      because: "A trade is an exchange between two parties. Whatever one side buys, the other side sells, so the amounts bought and sold in any trade are equal.",
    },
  },

  "trailing-stop": {
    plain:
      "A trailing stop is a stop loss that follows the price at a set distance when the price moves in the trader’s favour, and stays where it is when the price moves back. It only ever moves in one direction: towards locking in more of the gain.",
    why: "It allows a position to stay open while a move continues, without a fixed target, and closes it once the price gives back a set amount. On some platforms the trailing is done by the trader’s own software and stops working if that software is closed or disconnected.",
    example: {
      setup: "A trader buys one standard lot of EUR/USD at 1.1000 with a trailing stop of 30 pips.",
      steps: [
        "At the start the stop is at 1.1000 − 0.0030 = 1.0970.",
        "The price climbs to 1.1050, and the stop follows to 1.1050 − 0.0030 = 1.1020.",
        "The price drops back to 1.1020 and the stop is triggered: 1.1020 − 1.1000 = 20 pips, or 200 US dollars.",
      ],
      result: "The trade closes with a gain of 200 US dollars, 30 pips below its best point, if the stop is filled at its price.",
    },
    mistake:
      "A trailing stop does not capture the best price of a move. By design it closes the position after the price has already come back by the trailing distance, and like any stop it can be filled at a worse price.",
    diagramCaption: "Two lines climb together, the price above and the trailing stop a set distance below it; move across the diagram to follow the two lines together.",
    diagram: { kind: "lines", labels: ["Price", "Trailing stop"], relation: "parallel" },
    quiz: {
      question: "A bought position has a trailing stop of 40 pips. The price climbs 100 pips from the entry, then drops 25 pips. Where is the stop?",
      options: ["35 pips above the entry", "60 pips above the entry", "40 pips below the entry"],
      answer: 1,
      because: "The stop trails the highest price reached, which was 100 pips above the entry, so it sits at 100 − 40 = 60 pips above. It does not move back when the price drops.",
    },
  },

  trend: {
    plain:
      "A trend is the general direction in which a price is moving. In an uptrend each peak and each dip tends to be higher than the one before; in a downtrend each tends to be lower. When neither is true the market is described as moving sideways.",
    why: "Many ways of reading a chart start by asking whether there is a trend and on what timescale, because the same market can be climbing over months and dropping over the past few hours. A trend is a description of the past and can end at any point.",
    example: {
      setup: "A pair’s successive turning points are a high of 1.1100, a low of 1.1040, a high of 1.1060 and a low of 1.0990.",
      steps: [
        "Second high against first: 1.1060 is 40 pips below 1.1100, a lower high.",
        "Second low against first: 1.0990 is 50 pips below 1.1040, a lower low.",
        "Lower highs together with lower lows fit the description of a downtrend.",
      ],
      result: "On these four turning points the pair is in a downtrend.",
    },
    mistake:
      "A trend is not a straight line and not a promise. Prices in a trend still move against it for periods, and the sequence of highs and lows shows that a trend has ended only after the fact.",
    diagramCaption: "A price line steps downward, each peak and each dip lower than the last; move along the line to reach each lower high and lower low.",
    diagram: { kind: "path", shape: "zigzag-down", labels: ["Downtrend"], marks: ["Lower high", "Lower low"] },
    quiz: {
      question: "A market makes a higher high and then a lower low. What does the sequence of highs and lows now show?",
      options: [
        "A clear uptrend",
        "A clear downtrend",
        "No clear trend, because the two conditions disagree",
      ],
      answer: 2,
      because: "An uptrend needs higher highs with higher lows, and a downtrend needs lower highs with lower lows. A higher high with a lower low meets neither description.",
    },
  },

  "trend-line": {
    plain:
      "A trend line is a straight line drawn on a chart through a series of turning points: under the rising lows of an uptrend, or over the falling highs of a downtrend. It is a drawing aid that makes the slope of the trend visible.",
    why: "Chart readers watch whether the price stays on the trend’s side of the line. A price that crosses it is described as breaking the trend line, which some read as a sign that the trend is weakening, though a break is often followed by a return.",
    example: {
      setup: "An uptrend has lows at 1.1000 on day 1 and 1.1040 on day 5, and a line is drawn through them.",
      steps: [
        "Slope: 40 pips over 4 days, which is 10 pips a day.",
        "Extended 4 more days to day 9: 1.1040 + 4 × 0.0010 = 1.1080.",
        "If the price on day 9 is 1.1060, it is 1.1080 − 1.1060 = 20 pips below the line.",
      ],
      result: "The line passes through 1.1080 on day 9, so a price of 1.1060 has broken below it.",
    },
    mistake:
      "Two points are enough to draw a line, so any two lows produce one. A line is usually given more weight once the price has turned at it a third time, and different people draw different lines on the same chart.",
    diagramCaption: "A price line runs above a rising trend line and then crosses below it; move across the diagram to reach the crossing.",
    diagram: { kind: "lines", labels: ["Price", "Trend line"], relation: "cross-down" },
    quiz: {
      question: "Two chart readers draw different trend lines on the same uptrend. What does this illustrate?",
      options: [
        "That one of them has made an error",
        "That a trend line is a judgement about which turning points to join, not a fixed feature of the market",
        "That trend lines can only be drawn on one timescale",
      ],
      answer: 1,
      because: "A trend line depends on which points the person drawing it chooses. It is a tool for reading a chart, and two reasonable choices can give two different lines.",
    },
  },

  "triangle-pattern": {
    plain:
      "A triangle forms on a chart when the swings of a price get smaller and smaller, so that a line across the highs and a line across the lows move towards each other. It shows a market in which neither buyers nor sellers are taking control, and it ends when the price leaves through one of the lines.",
    why: "Triangles come in three named forms: ascending (flat top, rising lows), descending (flat bottom, falling highs) and symmetrical (both lines sloping inward). The first two are traditionally read as leaning upward and downward respectively, but any of them can break either way, and breakouts sometimes fail.",
    example: {
      setup: "A pair makes three highs at 1.1100 with lows between them at 1.1000, 1.1040 and 1.1070.",
      steps: [
        "First swing: 1.1100 − 1.1000 = 100 pips.",
        "Second swing: 1.1100 − 1.1040 = 60 pips.",
        "Third swing: 1.1100 − 1.1070 = 30 pips.",
      ],
      result: "The swings shrink from 100 to 60 to 30 pips under a flat top at 1.1100 with rising lows, the shape called an ascending triangle.",
    },
    mistake:
      "The name of a triangle is not a forecast. An ascending triangle can break downward, and the pattern alone does not settle which way the price leaves.",
    diagramCaption: "A line across the highs and a line across the lows draw closer together until they nearly meet; move across the diagram to see the space between them narrow.",
    diagram: { kind: "lines", labels: ["Line of highs", "Line of lows"], relation: "converge" },
    quiz: {
      question: "What do all three types of triangle have in common?",
      options: [
        "The distance between highs and lows narrows as the pattern develops",
        "They are followed by a rise in price",
        "They last exactly three swings",
      ],
      answer: 0,
      because: "A triangle is defined by its converging boundaries, which means shrinking swings. The direction in which it ends is not part of the definition.",
    },
  },

  turnover: {
    plain:
      "Turnover is the total value of everything traded in a market over a period, such as a day. Each trade is counted once at its full value, so a market in which the same money changes hands many times has a high turnover.",
    why: "Turnover is the usual measure of how large and how active a market is. Foreign exchange is the largest financial market by this measure, with daily turnover counted in trillions of US dollars in the surveys published by the Bank for International Settlements.",
    example: {
      setup: "Three EUR/USD trades take place in an hour, for 1 million, 2 million and 3 million euros, all at a rate of 1.1000.",
      steps: [
        "Turnover in euros: 1 + 2 + 3 = 6 million euros.",
        "In US dollars: 6,000,000 × 1.1000 = 6,600,000 US dollars.",
        "Who gained or lost on the trades plays no part in the count.",
      ],
      result: "Turnover for the hour is 6 million euros, or 6.6 million US dollars.",
    },
    mistake:
      "Turnover is not profit, and it is not the amount of money invested in a market. It measures activity: a single sum traded back and forth ten times adds ten times its value to turnover.",
    diagramCaption: "Three bars for single trades stand beside a fourth bar, their sum, which is the turnover; choose a bar to measure the others against it.",
    diagram: { kind: "bars", labels: ["Trade 1", "Trade 2", "Trade 3", "Turnover"], sizes: [1, 2, 3, 6] },
    quiz: {
      question: "A dealer buys 5 million euros in the morning and sells the same 5 million euros in the afternoon. How much has this added to the day’s turnover?",
      options: ["Nothing, because the two trades cancel out", "5 million euros", "10 million euros"],
      answer: 2,
      because: "Turnover counts the value of every trade. Two trades of 5 million euros add 10 million euros, even though the dealer ends the day with no position.",
    },
  },

  "unrealized-p-and-l": {
    plain:
      "Unrealised profit and loss (P&L) is the gain or loss an open position would produce if it were closed at the current price. It changes with every price move and becomes realised, meaning fixed and added to or taken from the account balance, only when the position is closed.",
    why: "Unrealised P&L is the difference between an account’s balance and its equity, and it is equity that margin calculations use. An open loss therefore reduces the room available for other positions even though nothing has been closed.",
    example: {
      setup: "An account has a balance of 5,000 US dollars, and the trader buys one standard lot of EUR/USD at 1.1000.",
      steps: [
        "Price at 1.1030: 30 pips up, so unrealised P&L is +300 and equity is 5,300.",
        "Price at 1.0980: 20 pips down, so unrealised P&L is −200 and equity is 4,800.",
        "Throughout, the balance stays at 5,000 because nothing has been closed.",
      ],
      result: "If the trader closes at 1.0980, the loss of 200 US dollars is realised and the balance becomes 4,800.",
    },
    mistake:
      "An open loss is sometimes treated as not real until the position is closed. It is real for the account: it lowers equity and free margin at once, and it can lead to a margin call or a stop out.",
    diagramCaption: "A balance line and an equity line start together and draw apart as an open position gains or loses; move across the diagram to see the distance between them, the unrealised P&L, grow.",
    diagram: { kind: "lines", labels: ["Equity", "Balance"], relation: "diverge" },
    quiz: {
      question: "An account has a balance of 3,000 and one open position showing a loss of 400. What is its equity?",
      options: ["2,600", "3,000", "3,400"],
      answer: 0,
      because: "Equity is the balance plus unrealised P&L. 3,000 − 400 = 2,600, while the balance stays at 3,000 until the position is closed.",
    },
  },

  uptick: {
    plain:
      "An uptick is a single price change in which the new price is higher than the one before. Its opposite, a downtick, is a change to a lower price.",
    why: "Ticks are the raw material of a price chart: each candle or bar is built from the upticks and downticks within its period. Platforms that colour a quote when it changes are showing whether the latest tick was up or down.",
    example: {
      setup: "A pair’s price updates in the sequence 1.1000, 1.1001, 1.1001, 1.1000, 1.1002.",
      steps: [
        "1.1000 to 1.1001: an uptick.",
        "1.1001 to 1.1001: no change.",
        "1.1001 to 1.1000: a downtick.",
        "1.1000 to 1.1002: an uptick.",
      ],
      result: "The sequence holds two upticks and one downtick, and the price ends 2 pips higher than it began.",
    },
    mistake:
      "One uptick says almost nothing about direction. Prices tick up and down constantly, and a falling market contains many upticks.",
    diagramCaption: "Two prices run one above the other, the new price above the previous one, with the step between them named as the uptick; narrow or widen the gap to see a smaller or a larger uptick.",
    diagram: { kind: "gap", labels: ["New price", "Previous price", "Uptick"] },
    quiz: {
      question: "During one hour a pair records 600 upticks and 400 downticks. What can be concluded about where the price ended?",
      options: [
        "It ended higher, because upticks outnumbered downticks",
        "Nothing certain, because ticks differ in size",
        "It ended exactly where it began",
      ],
      answer: 1,
      because: "An uptick only says that a price was higher than the one before, not by how much. A few large downticks can outweigh many small upticks.",
    },
  },

  usd: {
    plain:
      "USD is the international code for the United States dollar. It is the currency most widely held by central banks as reserves, the one in which commodities such as oil and gold are usually priced, and the most traded currency in the world.",
    why: "Because the dollar is one side of most currency trades, news about the United States economy and its central bank, the Federal Reserve, tends to move many pairs at once. The pairs that combine the dollar with another heavily traded currency are known as the majors.",
    example: {
      setup: "EUR/USD goes from 1.1000 to 1.1110 at the same time as USD/JPY goes from 150.00 to 148.50.",
      steps: [
        "EUR/USD: up 0.0110, and 0.0110 ÷ 1.1000 = 1%.",
        "USD/JPY: down 1.50, and 1.50 ÷ 150.00 = 1%.",
        "In EUR/USD the dollar is the quote currency, so a higher price means a weaker dollar; in USD/JPY it is the base currency, so a lower price also means a weaker dollar.",
      ],
      result: "Both moves show the dollar losing about 1%, although one chart went up and the other went down.",
    },
    mistake:
      "A climbing chart does not always mean a stronger dollar. It depends on whether USD is the first or the second code in the pair.",
    diagramCaption: "The US dollar sits at the centre, joined to six other heavily traded currencies with which it forms the major pairs; move across the diagram to pick out each pair in turn.",
    diagram: { kind: "hub", labels: ["USD", "EUR", "JPY", "GBP", "CHF", "AUD", "CAD"] },
    quiz: {
      question: "The price of USD/CHF goes up. What has happened to the US dollar against the Swiss franc?",
      options: ["It has strengthened", "It has weakened", "Nothing can be said from the price"],
      answer: 0,
      because: "In USD/CHF the dollar is the base currency, so the price is the number of francs one dollar buys. A higher price means the dollar buys more francs.",
    },
  },

  "variable-spread": {
    plain:
      "A variable spread, also called a floating spread, is a gap between the buying and the selling price that changes from moment to moment with market conditions. It narrows when many participants are quoting prices and widens when few are.",
    why: "The cost of opening a trade therefore depends on when it is opened. Spreads commonly widen around major news releases, at the daily rollover time and when markets reopen after a weekend, and a wider spread can trigger stop orders that a narrow one would not have reached.",
    example: {
      setup: "The spread on a pair is 1 pip in the busiest hours and 5 pips for a few seconds around a news release, and a trader deals in one standard lot.",
      steps: [
        "Cost in busy hours: 1 × 10 = 10 units of the quote currency.",
        "Cost around the release: 5 × 10 = 50 units of the quote currency.",
        "Difference: 50 − 10 = 40.",
      ],
      result: "The same trade costs 40 units of the quote currency more to open during the release than in normal hours.",
    },
    mistake:
      "A low “typical” or “from” spread is not the spread at every moment. With a variable spread, the figure that counts is the one on the screen when the order is sent.",
    diagramCaption: "The ask runs above the bid, and the spread between them narrows and widens as conditions change; narrow or widen the gap to compare a busy market with a thin one.",
    diagram: { kind: "gap", labels: ["Ask", "Bid", "Variable spread"] },
    quiz: {
      question: "A trader holds a short position with a stop loss 3 pips above the current ask. The spread widens by 4 pips while the bid stays where it is. What can happen?",
      options: [
        "Nothing, because the bid has not moved",
        "The stop can be triggered, because a short position is closed at the ask and the ask has moved up",
        "The stop moves further away automatically",
      ],
      answer: 1,
      because: "A short position is closed by buying at the ask. If the spread widens with the bid unchanged, the ask climbs 4 pips, which is past a stop set 3 pips above it.",
    },
  },

  vix: {
    plain:
      "The VIX is an index published by the exchange group Cboe that estimates how much the US share market, measured by the S&P 500 index, is expected to move over the next 30 days. It is calculated from the prices of options on that index: when traders pay more for protection against large moves, the VIX goes up.",
    why: "It is widely used as a shorthand for nervousness in markets, hence the nickname “fear gauge”. Currency traders watch it because periods of stress in shares have often coincided with larger moves in currencies, although the VIX measures shares and not currencies.",
    example: {
      setup: "The VIX reads 16, a figure expressed as an annual percentage.",
      steps: [
        "A reading of 16 means expected movement of about 16% over a year.",
        "A year has about 252 trading days, and the square root of 252 is about 15.9.",
        "Daily equivalent: 16 ÷ 15.9 is about 1.",
      ],
      result: "A VIX of 16 corresponds to a typical expected daily move in the S&P 500 of roughly 1%, up or down.",
    },
    mistake:
      "The VIX does not point up or down. It estimates the size of expected moves, not their direction, and it describes expectations, which can prove wrong.",
    diagramCaption: "Option prices pass through a calculation and come out as a single VIX reading; step through the three stages in order.",
    diagram: { kind: "flow", labels: ["Option prices", "Calculation", "VIX reading"] },
    quiz: {
      question: "The VIX climbs sharply. What does that indicate?",
      options: [
        "That US share prices have gone up",
        "That currency spreads have widened",
        "That option prices imply larger expected moves in the S&P 500",
      ],
      answer: 2,
      because: "The VIX is derived from the prices of S&P 500 options. A higher reading means those prices imply bigger moves ahead, in either direction.",
    },
  },

  volatility: {
    plain:
      "Volatility is how much and how quickly a price moves. A market whose price swings widely from day to day is said to be volatile; one that changes little is said to be quiet. It measures the size of movement, not its direction.",
    why: "The more volatile a market, the larger the gain or loss a position of a given size can produce in a given time, and the more likely a nearby stop is reached. Traders therefore often relate position size and stop distance to how much a market usually moves.",
    example: {
      setup: "Over three days pair A has daily ranges (high minus low) of 40, 50 and 60 pips, and pair B has ranges of 100, 150 and 200 pips.",
      steps: [
        "Pair A average: (40 + 50 + 60) ÷ 3 = 50 pips.",
        "Pair B average: (100 + 150 + 200) ÷ 3 = 150 pips.",
        "Ratio: 150 ÷ 50 = 3.",
      ],
      result: "By this measure pair B is three times as volatile as pair A: on one standard lot an average day spans 1,500 units of its quote currency against 500 for pair A.",
    },
    mistake:
      "Low volatility does not make prices predictable, and it does not last. Quiet periods can end abruptly, often around news.",
    diagramCaption: "Two bars compare the average daily range of a quiet pair and a volatile pair, the second three times the first; choose a bar to measure the other against it.",
    diagram: { kind: "bars", labels: ["Pair A range", "Pair B range"], sizes: [3, 9] },
    quiz: {
      question: "Two markets both end the week exactly where they started. Market A moved about 20 pips a day and market B about 200 pips a day. Which statement is right?",
      options: [
        "Both had the same volatility, because the net change was the same",
        "Market B was more volatile, because volatility measures the size of movements and not the net result",
        "Market A was more volatile, because it was steadier",
      ],
      answer: 1,
      because: "Volatility describes how far prices move along the way. A market can end unchanged and still have been highly volatile.",
    },
  },

  volume: {
    plain:
      "Volume is the amount traded in a period: the number of shares, contracts or units of currency that changed hands. On an exchange it can be counted exactly. Currencies are traded between many separate dealers with no central exchange, so a complete count does not exist.",
    why: "Currency platforms usually show tick volume in its place, which counts how many times the price changed in the period. It is used as a rough guide to how active the market was, on the reasoning that busier markets update their prices more often.",
    example: {
      setup: "A platform records 1,200 price changes in a pair during one hour and 300 during the next.",
      steps: [
        "Tick volume in the first hour: 1,200.",
        "Tick volume in the second hour: 300.",
        "Ratio: 1,200 ÷ 300 = 4.",
      ],
      result: "The first hour shows four times the tick volume, meaning four times as many price updates, which suggests but does not prove that more was traded.",
    },
    mistake:
      "Tick volume is not the amount of money traded. A hundred price changes could accompany a few small trades or several very large ones, and each broker’s count reflects only its own price feed.",
    diagramCaption: "Two bars compare the number of price changes in a quiet hour and in a busy hour; choose a bar to measure the other against it.",
    diagram: { kind: "bars", labels: ["Quiet hour", "Busy hour"], sizes: [2, 8] },
    quiz: {
      question: "A currency chart on a retail platform shows a tall volume bar. What has usually been counted?",
      options: [
        "The number of price changes in that period on that price feed",
        "The total value traded worldwide in that period",
        "The number of traders logged in",
      ],
      answer: 0,
      because: "Without a central exchange there is no complete count of currency trades, so platforms usually show tick volume: how many times the price updated on their own feed.",
    },
  },

  vps: {
    plain:
      "A VPS, or virtual private server, is a computer in a data centre that a trader rents and reaches over the internet. A trading platform installed on it keeps running day and night, whether or not the trader’s own computer is switched on.",
    why: "It matters mainly to traders who run automated strategies, such as Expert Advisors, which can act only while their platform is running and connected. A server located near a broker’s servers can also shorten the time an order takes to arrive, known as latency.",
    mistake:
      "A VPS keeps software running; it does not make a strategy better and it is not immune to failure. Servers can restart or lose their connection, and an unattended program can keep trading in conditions it was not designed for.",
    diagramCaption: "Three stages run from the trader’s home computer to the VPS and on to the broker’s server; step through them to follow an instruction along the chain.",
    diagram: { kind: "flow", labels: ["Home computer", "VPS", "Broker server"] },
    quiz: {
      question: "A trader’s home computer is switched off overnight. In which case does an automated strategy keep running?",
      options: [
        "When the platform and the strategy are installed on the home computer",
        "When the platform and the strategy run on a VPS that stays on and connected",
        "In every case, because the strategy is stored in the trading account",
      ],
      answer: 1,
      because: "An automated strategy acts only while the platform it is attached to is running. A VPS keeps that platform running independently of the trader’s own computer.",
    },
  },

  "wedge-pattern": {
    plain:
      "A wedge forms on a chart when a line across the highs and a line across the lows both slope the same way, up or down, while drawing closer together. In a rising wedge the price keeps climbing but each push gains less; in a falling wedge it keeps dropping but each drop is smaller.",
    why: "Chart readers traditionally take the shrinking swings as a sign that the move is losing force, so a rising wedge is read as a warning of a possible turn down and a falling wedge of a possible turn up. That reading is a convention and often fails: wedges also resolve in the direction they were already heading.",
    example: {
      setup: "A pair makes highs at 1.1100, 1.1140 and 1.1160, with lows at 1.1000, 1.1070 and 1.1120.",
      steps: [
        "Highs: up 40 pips, then up 20 pips.",
        "Lows: up 70 pips, then up 50 pips.",
        "Distance from low to high: 100 pips, then 70 pips, then 40 pips.",
      ],
      result: "Both lines climb, the lower one faster than the upper, and the distance between them shrinks from 100 to 40 pips: the shape of a rising wedge.",
    },
    mistake:
      "A wedge is not the same as a triangle. In a triangle one line is flat or the two slope in opposite directions; in a wedge both slope the same way.",
    diagramCaption: "A price line turns between two rising lines that draw closer together and then leaves through the lower one, the outcome traditionally associated with a rising wedge; move along the line to reach the break.",
    diagram: { kind: "band", labels: ["Rising upper line", "Rising lower line"], breaks: "down" },
    quiz: {
      question: "What distinguishes a wedge from a symmetrical triangle?",
      options: [
        "A wedge has parallel boundary lines",
        "A wedge always lasts longer",
        "In a wedge both boundary lines slope in the same direction",
      ],
      answer: 2,
      because: "Both patterns have converging lines. In a symmetrical triangle one line slopes down and the other up; in a wedge both slope up or both slope down.",
    },
  },

  whipsaw: {
    plain:
      "A whipsaw is a sharp move in one direction followed almost at once by a sharp move back. A trader caught in one enters or is stopped out on the first move, only to see the price return to where it started.",
    why: "Whipsaws are a cost of acting on short-term moves: stop losses are triggered and breakout orders are filled just before the price reverses. They are most common in thin or directionless markets and in the minutes around major news.",
    example: {
      setup: "A trader buys one standard lot of EUR/USD at 1.1000 with a stop loss at 1.0980; the price drops to 1.0975 and then climbs to 1.1030 within minutes.",
      steps: [
        "The drop through 1.0980 triggers the stop: 20 pips, or 200 US dollars, if filled at its price.",
        "The price then reaches 1.1030, which is 30 pips above the entry.",
        "The position is no longer open, so that 300 US dollar move is not captured.",
      ],
      result: "The trader is left with a loss of 200 US dollars on a trade whose direction turned out to be right.",
    },
    mistake:
      "A whipsaw is not in itself evidence that anyone aimed at a particular trader’s stop. Stops from many traders cluster at similar levels, and ordinary swings in a thin market are enough to reach them.",
    diagramCaption: "A jagged price line dips sharply and snaps back; move along the line to reach the mark where a stop is triggered and then the reversal.",
    diagram: { kind: "path", shape: "volatile", labels: ["Price"], marks: ["Stop triggered", "Reversal"] },
    quiz: {
      question: "Which outcome describes being whipsawed?",
      options: [
        "A stop loss is hit by a brief move, after which the price returns in the original direction",
        "A position gains steadily for several days",
        "An order is rejected because the market is closed",
      ],
      answer: 0,
      because: "A whipsaw is a quick move one way and then back. Its typical effect is to close a position at a loss just before the price returns.",
    },
  },

  wick: {
    plain:
      "On a candlestick chart each period is drawn as a thick body with thin lines above and below. The body spans the opening and closing prices; the thin lines, called wicks or shadows, reach to the highest and lowest prices traded in the period.",
    why: "A long wick shows that the price travelled to a level during the period and did not stay there by the close. Chart readers often describe this as the market rejecting those prices, which is an interpretation and not a rule about what follows.",
    example: {
      setup: "A candle opens at 1.1000, reaches a high of 1.1050 and a low of 1.0990, and closes at 1.1010.",
      steps: [
        "Body: 1.1010 − 1.1000 = 10 pips.",
        "Upper wick, from the top of the body to the high: 1.1050 − 1.1010 = 40 pips.",
        "Lower wick, from the low to the bottom of the body: 1.1000 − 1.0990 = 10 pips.",
      ],
      result: "The candle has a small body and an upper wick four times as long: the price reached 1.1050 but closed 40 pips lower.",
    },
    mistake:
      "The upper wick is not always measured from the open. It runs from the top of the body, which is the higher of the open and the close, up to the high.",
    diagramCaption: "A single candle is drawn with its body and the thin wicks above and below it; move across the diagram to pick out each part.",
    diagram: { kind: "candles", shape: "single", labels: ["Upper wick", "Body", "Lower wick"] },
    quiz: {
      question: "A candle opens at 1.2000 and closes at 1.2000, with a high of 1.2040 and a low of 1.1990. How long is its upper wick?",
      options: ["10 pips", "40 pips", "50 pips"],
      answer: 1,
      because: "The upper wick runs from the top of the body to the high. With the open and close both at 1.2000, that is 1.2040 − 1.2000 = 40 pips.",
    },
  },

  "xau-usd": {
    plain:
      "XAU/USD is the market symbol for gold priced in US dollars. XAU is the standard code for one troy ounce of gold, so the quote is the number of dollars one ounce costs, written like a currency pair with gold as the base and the dollar as the quote.",
    why: "Gold is traded alongside currencies on many platforms, but its contract differs: one lot is commonly 100 troy ounces, and its price moves in dollars and cents and not in the four-decimal pips of most currency pairs. Its price is often discussed together with the US dollar and with real yields.",
    example: {
      setup: "A trader holds one lot of XAU/USD, taken here as 100 troy ounces, bought at an invented price of 2,000.00, and the price moves to 2,010.00.",
      steps: [
        "Change per ounce: 2,010 − 2,000 = 10 US dollars.",
        "Change on the lot: 100 × 10 = 1,000 US dollars.",
        "Notional value at entry: 100 × 2,000 = 200,000 US dollars.",
      ],
      result: "A move of 10 US dollars in the price, which is 0.5% of 2,000, changes the value of the position by 1,000 US dollars.",
    },
    mistake:
      "Gold is often called a safe haven and is said to move opposite to the dollar. Both are tendencies seen in past data, not fixed relationships: gold and the dollar have at times gone up together, and gold can drop sharply.",
    diagramCaption: "Gold and the US dollar are joined as a pair, gold as the base on the left and the dollar as the quote on the right; move across the diagram to see how the two are bound together.",
    diagram: { kind: "pair", labels: ["XAU", "USD"] },
    quiz: {
      question: "XAU/USD is quoted at 2,500. What does the number mean?",
      options: [
        "One US dollar buys 2,500 ounces of gold",
        "One lot of gold costs 2,500 US dollars",
        "One troy ounce of gold costs 2,500 US dollars",
      ],
      answer: 2,
      because: "The quote gives the amount of the second code, US dollars, needed for one unit of the first, and one unit of XAU is one troy ounce.",
    },
  },

  yield: {
    plain:
      "Yield is the income an investment pays in a year, expressed as a percentage of its price. For a bond, which pays a fixed amount of interest, the yield a new buyer receives depends on the price paid: the lower the price, the higher the yield.",
    why: "Government bond yields reflect the interest rates the market expects in a currency. Differences in yield between countries are one of the influences on exchange rates, because money tends to be drawn towards higher returns, and they underlie the carry trade, in which a trader holds a higher-yielding currency against a lower-yielding one.",
    example: {
      setup: "A bond pays a fixed 50 a year and trades at 1,000; yield is taken here in its simplest form, income divided by price.",
      steps: [
        "At a price of 1,000: 50 ÷ 1,000 = 5%.",
        "If the price drops to 800: 50 ÷ 800 = 6.25%.",
        "If the price climbs to 1,250: 50 ÷ 1,250 = 4%.",
      ],
      result: "The payment never changed; the yield moved from 5% to 6.25% or to 4% only because the price did.",
    },
    mistake:
      "A higher yield is not simply a better deal. Yields are often higher because investors see more risk, such as inflation, default or a weakening currency, and a currency loss can outweigh the extra interest.",
    diagramCaption: "A beam holds a bond’s price on one side and its yield on the other; shift the weight to see one go up as the other comes down.",
    diagram: { kind: "balance", labels: ["Bond price", "Yield"], tilt: "left" },
    quiz: {
      question: "A bond pays a fixed 40 a year. Its market price drops from 1,000 to 800. What happens to the yield for a new buyer?",
      options: ["It drops from 4% to 3.2%", "It stays at 4%", "It climbs from 4% to 5%"],
      answer: 2,
      because: "Yield is the fixed payment divided by the price. 40 ÷ 1,000 = 4% and 40 ÷ 800 = 5%, so a lower price means a higher yield.",
    },
  },
};

import type { LessonBook } from "./types";

/** Lessons for the terms listed in .tmp/gloss-2.txt (alphabetical third 2 of 3). */
export const book2: LessonBook = {
  gdp: {
    plain:
      "Gross domestic product, or GDP, adds up the value of all the goods and services a country produces in a period, usually a quarter or a year. It is the broadest single measure of the size of an economy, and its change from one period to the next is what people call economic growth.",
    why: "GDP figures are published on a schedule and markets watch them, because growth feeds into what a central bank may later do with interest rates. A currency often reacts to the difference between the published figure and the figure that was expected.",
    example: {
      setup: "An invented economy produces 500 billion in one quarter and 505 billion in the next, measured at the same prices.",
      steps: ["Change in output: 505 − 500 = 5 billion", "Growth rate: 5 ÷ 500 = 0.01", "As a percentage: 0.01 × 100 = 1%"],
      result: "The economy grew by 1% from one quarter to the next.",
    },
    mistake:
      "It is easy to assume that a strong GDP figure always lifts a currency. If the strong figure was already expected the price may hardly move, and a figure that is good but below expectations can be followed by a fall.",
    diagramCaption:
      "Four bars show an economy’s output in four successive quarters, each a little taller than the one before; pointing at a bar picks it out for comparison with the others.",
    diagram: { kind: "bars", labels: ["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4"], sizes: [6, 7, 8, 9] },
    quiz: {
      question: "A country’s GDP shows growth of 2% when 3% was widely expected. What is the most reasonable reading?",
      options: [
        "The economy shrank",
        "The economy grew, but by less than markets had expected",
        "The currency must strengthen because growth is positive",
        "The figure says nothing about the economy",
      ],
      answer: 1,
      because: "Growth of 2% is still growth. What often moves prices is the shortfall against the expected 3%, not the sign of the number.",
    },
  },

  gearing: {
    plain:
      "Gearing is another word for leverage. It compares the size of the position a trader controls with the trader’s own money that supports it: a position worth 50,000 backed by 1,000 of the trader’s own money is geared 50 times.",
    why: "The word appears mainly in British usage and means the same thing as leverage. The higher the gearing, the larger the gain or loss that a given price move produces relative to the money put up.",
    example: {
      setup: "A trader puts up 2,000 of their own money to hold a position with a full value of 40,000.",
      steps: [
        "Gearing: 40,000 ÷ 2,000 = 20, written 1:20 or 20 times",
        "A 1% move in the price changes the position’s value by 40,000 × 0.01 = 400",
        "As a share of the trader’s own money: 400 ÷ 2,000 = 0.20, or 20%",
      ],
      result: "At 20 times gearing, a 1% price move is a 20% gain or loss on the money put up.",
    },
    mistake:
      "Some read high gearing as a way of earning more from the same money. It enlarges losses by exactly the same factor as gains, so the same adverse move removes a larger part of the account.",
    diagramCaption:
      "A lever with the trader’s own money as a small weight on one side and a much larger position on the other; the small side moves a little and the large side travels much further.",
    diagram: { kind: "lever", labels: ["Own money", "Position"] },
    quiz: {
      question: "An account is geared 10 times and the market moves 2% against the position. Roughly what share of the money put up is lost?",
      options: ["2%", "10%", "20%", "0.2%"],
      answer: 2,
      because: "The loss is calculated on the full position, which is 10 times the money put up: 2% × 10 = 20%.",
    },
  },

  "going-long": {
    plain:
      "Going long means buying first in the hope of selling later at a higher price. In a currency pair, going long means buying the first currency of the pair and, in the same trade, selling the second.",
    why: "It is one of the two directions every trade can take. A long trade gains when the price rises and loses when it falls, so the direction decides which price moves help and which hurt.",
    example: {
      setup: "A trader goes long one standard lot of EUR/USD at 1.1000 and later closes at 1.1050.",
      steps: [
        "Move: 1.1050 − 1.1000 = 0.0050, which is 50 pips",
        "One pip on one standard lot is worth 10 US dollars",
        "Result: 50 × 10 = 500 US dollars",
      ],
      result: "The trade gains 500 US dollars before costs; a fall of 50 pips would have lost the same amount.",
    },
    mistake: "“Long” does not mean holding for a long time. It describes the direction of the trade, and a long trade can last seconds or months.",
    diagramCaption:
      "A price line rises from a point marked Buy to a point marked Sell; following the line shows the long trade gaining as the price climbs.",
    diagram: { kind: "path", shape: "up", labels: ["Price"], marks: ["Buy", "Sell"] },
    quiz: {
      question: "A trader is long GBP/USD. Which statement is true?",
      options: [
        "They have sold pounds and bought dollars",
        "They gain if the pound weakens against the dollar",
        "They have bought pounds and sold dollars",
        "They must hold the trade for at least a week",
      ],
      answer: 2,
      because: "Going long a pair means buying its first currency, here the pound, and selling its second, the dollar. The trade gains if the pound strengthens.",
    },
  },

  "going-short": {
    plain:
      "Going short means selling first in the hope of buying back later at a lower price. In a currency pair, going short means selling the first currency and buying the second, so a short on EUR/USD is also a purchase of dollars with euros.",
    why: "A short trade is how a trader takes the view that a price may fall. It gains when the price falls and loses when it rises, and because a price has no upper limit, the possible loss on a short is not capped by the price itself.",
    example: {
      setup: "A trader goes short one standard lot of EUR/USD at 1.1000 and later closes at 1.0960.",
      steps: [
        "Move: 1.1000 − 1.0960 = 0.0040, which is 40 pips",
        "One pip on one standard lot is worth 10 US dollars",
        "Result: 40 × 10 = 400 US dollars",
      ],
      result: "The trade gains 400 US dollars before costs; had the price risen 40 pips instead, it would have lost 400 US dollars.",
    },
    mistake:
      "Selling a pair is sometimes pictured as betting against one currency with nothing on the other side. Every short on a pair is at the same time a long on its second currency.",
    diagramCaption:
      "A price line falls from a point marked Sell to a point marked Buy back; following the line shows the short trade gaining as the price drops.",
    diagram: { kind: "path", shape: "down", labels: ["Price"], marks: ["Sell", "Buy back"] },
    quiz: {
      question: "A trader shorts a pair at 1.2000 and the price moves to 1.2030. What has happened to the trade?",
      options: ["It shows a loss of 30 pips", "It shows a gain of 30 pips", "Nothing, until the price falls", "It shows a gain of 300 pips"],
      answer: 0,
      because: "A short loses when the price rises. From 1.2000 to 1.2030 is 30 pips against the trade.",
    },
  },

  "golden-cross": {
    plain:
      "A moving average is the average price over a set number of past periods, recalculated as each new period arrives. A golden cross is the moment a shorter moving average, commonly the 50-period, rises above a longer one, commonly the 200-period.",
    why: "Chart readers describe it as a sign that recent prices have become stronger than the longer-run average. Because both averages are built from past prices, the cross appears after a rise has already happened, and it can be followed by a fall.",
    example: {
      setup: "On an invented chart the 50-period average rises over three days while the 200-period average barely changes.",
      steps: [
        "Day 1: 50-period 1.0980, 200-period 1.1000, so the short average is below",
        "Day 2: 50-period 1.1000, 200-period 1.1001, still just below",
        "Day 3: 50-period 1.1015, 200-period 1.1002, now above",
      ],
      result: "The golden cross is recorded on day 3, the first day the short average stands above the long one.",
    },
    mistake:
      "A golden cross is often presented as a forecast. It is a description of what prices have already done, and markets that move sideways produce crosses that reverse soon afterwards.",
    diagramCaption:
      "Two lines, a faster 50-period average and a slower 200-period average; the faster line climbs through the slower one, and pointing at the crossing marks the golden cross.",
    diagram: { kind: "lines", labels: ["50-period MA", "200-period MA"], relation: "cross-up" },
    quiz: {
      question: "Why does a golden cross appear late relative to the price move it describes?",
      options: [
        "Because exchanges publish it with a delay",
        "Because it can only form at the end of a month",
        "Because it uses forecasts of future prices",
        "Because moving averages are built from past prices",
      ],
      answer: 3,
      because: "Both averages are calculated from prices that have already been recorded, so the short one can only overtake the long one after prices have been rising for some time.",
    },
  },

  hawkish: {
    plain:
      "A central bank, or one of its officials, is called hawkish when they lean towards higher interest rates or tighter policy, usually because they are more worried about inflation than about weak growth. The opposite leaning is called dovish.",
    why: "Traders read central bank statements and speeches for changes in tone, because expectations about future interest rates are one of the things currencies respond to. A statement more hawkish than expected is commonly associated with a firmer currency, though the reaction is not certain.",
    example: {
      setup: "A central bank leaves its interest rate unchanged, as expected, but changes the wording of its statement.",
      steps: [
        "Previous statement: inflation is “expected to ease”",
        "New statement: inflation is “proving persistent” and further rises “may be needed”",
        "The rate did not change, but the expected path of future rates moved higher",
      ],
      result: "Commentators would describe the new statement as more hawkish than the last one.",
    },
    mistake:
      "Hawkish does not mean that rates have been raised. It describes a leaning, and a central bank can sound hawkish while leaving rates where they are.",
    diagramCaption:
      "A balance weighs worry about inflation against worry about growth; it tips towards inflation, the hawkish side, and shifting the weight shows the opposite leaning.",
    diagram: { kind: "balance", labels: ["Inflation worry", "Growth worry"], tilt: "left" },
    quiz: {
      question: "Which statement from a policymaker would most likely be described as hawkish?",
      options: [
        "“We see room to cut rates if growth slows.”",
        "“Rates may need to stay high until inflation is clearly falling.”",
        "“We are ready to add support if unemployment rises.”",
      ],
      answer: 1,
      because: "A hawkish stance puts the control of inflation first and favours higher rates. The other two statements lean towards supporting growth, which is dovish.",
    },
  },

  "head-and-shoulders": {
    plain:
      "Head and shoulders is the name for a chart shape with three peaks: a middle peak, the head, that is higher than the peak on either side, the shoulders. A line drawn through the two low points between the peaks is called the neckline.",
    why: "Chart readers treat it as a possible sign that a rising trend is running out of strength, and many regard the pattern as complete only when the price falls below the neckline. Like every chart pattern it is a matter of interpretation, and it often fails.",
    example: {
      setup: "An invented price rises to three peaks with two dips between them.",
      steps: [
        "Left shoulder peaks at 1.2100, then the price dips to 1.2000",
        "Head peaks at 1.2200, then the price dips to 1.2000",
        "Right shoulder peaks at 1.2100",
        "The neckline joins the two dips at 1.2000",
      ],
      result: "The shape is a head and shoulders; by the usual reading it is complete only if the price then closes below 1.2000.",
    },
    mistake:
      "Three bumps on a chart are easy to see afterwards and easy to imagine beforehand. Until the neckline breaks the pattern is unfinished, and even a break can be followed by a recovery.",
    diagramCaption:
      "A price line rises through a left shoulder, a higher head and a right shoulder, then turns down towards the neckline; pointing at each mark names that part of the pattern.",
    diagram: { kind: "path", shape: "up-then-down", labels: ["Price"], marks: ["Left shoulder", "Head", "Right shoulder", "Neckline"] },
    quiz: {
      question: "In a head and shoulders pattern, what is the neckline?",
      options: [
        "The highest point of the head",
        "The average height of the three peaks",
        "A line through the low points between the peaks",
        "The price at which the rise began",
      ],
      answer: 2,
      because: "The neckline connects the two dips that separate the head from the shoulders. Chart readers watch it because a fall below it is what they take as completing the pattern.",
    },
  },

  hedging: {
    plain:
      "Hedging means opening a second position whose result is expected to move the opposite way to one already held, so that a loss on one is partly or wholly offset by a gain on the other. It works like insurance: it reduces what can be lost, and it has a cost.",
    why: "Traders and businesses hedge when they want to keep a position or a commitment but reduce their exposure to a price move for a time. A hedge also reduces the possible gain, and each position carries its own spread and possibly its own overnight charge.",
    example: {
      setup: "A trader is long one standard lot of EUR/USD and opens a short of half a lot on the same pair; the price then falls 40 pips.",
      steps: [
        "Long 1 lot: 40 × 10 = 400 US dollars lost",
        "Short 0.5 lot: 40 × 5 = 200 US dollars gained",
        "Net: 200 − 400 = −200 US dollars",
      ],
      result: "The hedge halves the loss from the fall, and it would equally have halved the gain from a rise.",
    },
    mistake:
      "A hedge is sometimes thought to remove risk at no cost. A full hedge in the same instrument freezes the result where it stands while costs continue, and a hedge in a different instrument relies on a relationship that can change.",
    diagramCaption:
      "A balance holds a position on one side and its hedge on the other, resting level; shifting the weight shows what happens when one no longer offsets the other.",
    diagram: { kind: "balance", labels: ["Position", "Hedge"], tilt: "level" },
    quiz: {
      question: "A trader fully hedges a long position with an equal short in the same instrument. What happens to the combined result as the price moves?",
      options: [
        "It stays roughly where it was, apart from costs",
        "It grows whichever way the price moves",
        "It doubles on a rise and is flat on a fall",
      ],
      answer: 0,
      because: "Equal and opposite positions cancel each other’s gains and losses, so the combined result stops changing with the price. Spreads and any overnight charges still apply.",
    },
  },

  index: {
    plain:
      "A stock index is a single number that tracks a chosen basket of shares, so that one figure can stand for a whole market or sector. When the shares in the basket rise on balance the index rises, and when they fall it falls.",
    why: "An index cannot itself be bought; exposure comes through products that follow it, such as futures, funds or CFDs. How the index is built matters, because where members are weighted by size a few large companies can account for much of its movement.",
    example: {
      setup: "An invented index holds three shares weighted by company size: A at 50%, B at 30% and C at 20%.",
      steps: ["A rises 2%: 0.50 × 2 = 1.0", "B is unchanged: 0.30 × 0 = 0", "C falls 1%: 0.20 × −1 = −0.2", "Index change: 1.0 + 0 − 0.2 = 0.8%"],
      result: "The index rises 0.8%, driven by its largest member.",
    },
    mistake:
      "An index rising does not mean that every share in it rose. A weighted index can climb while most of its members fall, if the largest ones go up.",
    diagramCaption:
      "An index at the centre is joined to the shares that make it up; pointing at a share shows that it is one of several feeding the single index figure.",
    diagram: { kind: "hub", labels: ["Index", "Share A", "Share B", "Share C"] },
    quiz: {
      question: "In an index weighted by company size, which share moves the index most for the same percentage change in its price?",
      options: ["The one with the highest share price", "The newest member", "Each moves it equally", "The one with the largest weight"],
      answer: 3,
      because: "Each member’s change is multiplied by its weight, so the same percentage move counts for more in a share that makes up more of the index.",
    },
  },

  indicator: {
    plain:
      "A technical indicator is a calculation applied to past market data, usually prices and sometimes volume, and drawn on or under a chart. It rearranges information that is already in the chart, for example by smoothing it or by measuring how fast the price is changing.",
    why: "Traders use indicators to describe trend, speed or the width of price swings in a consistent way. An indicator has no knowledge of the future: it changes only after the price has changed, and different settings give different readings from the same data.",
    example: {
      setup: "A simple indicator, the 3-period average, is applied to closing prices of 10, 11 and 12, and then updated when the next close is 13.",
      steps: ["First value: (10 + 11 + 12) ÷ 3 = 11", "The oldest close, 10, drops out and 13 comes in", "Second value: (11 + 12 + 13) ÷ 3 = 12"],
      result: "The indicator moved from 11 to 12 only because the price had already moved.",
    },
    mistake:
      "Adding more indicators can feel like adding more evidence. Many are built from the same prices, so they often repeat one another instead of confirming anything independently.",
    diagramCaption:
      "Price data passes through a formula and comes out as an indicator line; stepping through the stages shows that nothing enters except past prices.",
    diagram: { kind: "flow", labels: ["Price data", "Formula", "Indicator line"] },
    quiz: {
      question: "What does every technical indicator have in common?",
      options: [
        "It is calculated from market data that already exists",
        "It is published by a central bank",
        "It shows where the price is going next",
        "It works only on currency pairs",
      ],
      answer: 0,
      because: "An indicator is arithmetic on recorded prices or volume. It can describe what has happened in a tidy way, but it contains no information beyond its inputs.",
    },
  },

  inflation: {
    plain:
      "Inflation is a general rise in prices over time, which means the same amount of money buys less than it did. It is usually measured by pricing a fixed basket of everyday goods and services and comparing its cost with a year earlier.",
    why: "Many central banks aim to keep inflation low and stable, and they adjust interest rates in response to it. Inflation releases therefore affect expectations about rates, which currencies and other markets respond to.",
    example: {
      setup: "An invented basket of goods costs 200 one year and 206 the next, while savings of 1,000 earn 1% interest.",
      steps: ["Rise in cost: 206 − 200 = 6", "Inflation rate: 6 ÷ 200 = 0.03, or 3%", "Savings after interest: 1,000 × 1.01 = 1,010, a rise of 1%"],
      result: "Prices rose 3% while the savings grew 1%, so the savings buy less than they did a year earlier.",
    },
    mistake:
      "Lower inflation does not mean that prices are falling. If inflation drops from 5% to 2%, prices are still rising, only more slowly; a general fall in prices is called deflation.",
    diagramCaption:
      "Two bars compare the cost of the same basket of goods last year and this year, the second a little taller; pointing at a bar picks it out for comparison.",
    diagram: { kind: "bars", labels: ["Basket last year", "Basket this year"], sizes: [8, 9] },
    quiz: {
      question: "Inflation falls from 6% to 3%. What is happening to prices?",
      options: ["They are falling by 3%", "They are unchanged", "They are still rising, but more slowly", "They are rising faster than before"],
      answer: 2,
      because: "An inflation rate of 3% means prices are 3% higher than a year earlier. The rate of increase has halved, but prices are still going up.",
    },
  },

  "interbank-market": {
    plain:
      "The interbank market is the network in which large banks trade currencies with one another, directly or through electronic dealing systems. It has no single exchange or building: it is many banks quoting prices to each other around the clock on working days.",
    why: "Prices on a retail platform are derived from prices in this wholesale market, passed on through liquidity providers and brokers with a spread or commission added along the way. This is why there is no single official price for a currency pair at a given moment, and why quotes can differ slightly between providers.",
    example: {
      setup: "Two banks quote the same pair at the same moment.",
      steps: [
        "Bank A: bid 1.10000, ask 1.10010",
        "Bank B: bid 1.10005, ask 1.10015",
        "Best bid is the higher one, B’s 1.10005; best ask is the lower one, A’s 1.10010",
      ],
      result: "A participant seeing both quotes can deal at the best of each, which is how competing quotes narrow the spread.",
    },
    mistake:
      "It is tempting to picture one central price that everyone sees. Foreign exchange is traded over the counter, meaning directly between parties, so each participant sees the quotes of the counterparties it deals with.",
    diagramCaption:
      "The interbank market at the centre is joined to several banks that quote prices to one another; pointing at a bank shows its link to the rest.",
    diagram: { kind: "hub", labels: ["Interbank market", "Bank A", "Bank B", "Bank C", "Bank D"] },
    quiz: {
      question: "Why can two brokers show slightly different prices for the same pair at the same moment?",
      options: [
        "One of them must be wrong",
        "Currencies trade between many parties, with no single central exchange",
        "Exchange rates are fixed once a day",
        "Each country sets its own rate by law",
      ],
      answer: 1,
      because: "Foreign exchange has no single venue that sets one price. Each broker’s quote depends on the providers it draws on and on what it adds to their prices.",
    },
  },

  "interest-rate-differential": {
    plain:
      "Each currency has an interest rate behind it, set largely by its central bank. The interest rate differential is the gap between the rates of the two currencies in a pair.",
    why: "The differential is the basis of the swap, the amount credited or charged for holding a position overnight, and of the carry trade, which holds a higher-rate currency against a lower-rate one. Changes in the expected differential are also commonly associated with movements in the exchange rate.",
    example: {
      setup: "Currency A has an interest rate of 5% and currency B a rate of 1%, and a position is worth 100,000.",
      steps: ["Differential: 5% − 1% = 4% a year", "On the position: 100,000 × 0.04 = 4,000 a year", "Per day: 4,000 ÷ 365 ≈ 10.96"],
      result: "Before any adjustment by a broker, the differential is worth about 11 a day on this position, credited or charged according to its direction.",
    },
    mistake:
      "A favourable differential is not income without risk. The exchange rate can move against the position by more than the interest earned, and a broker’s swap usually includes a markup, so the credit is smaller than the raw differential and can even be a charge.",
    diagramCaption:
      "Two interest rates sit one above the other with the distance between them marked as the differential; moving either rate widens or narrows the gap.",
    diagram: { kind: "gap", labels: ["Higher rate", "Lower rate", "Differential"] },
    quiz: {
      question: "Currency X yields 3% and currency Y also yields 3%. What is the interest rate differential of the pair?",
      options: ["6%", "3%", "1%", "Zero"],
      answer: 3,
      because: "The differential is one rate minus the other: 3% − 3% = 0. It measures the gap between the two rates, not their sum.",
    },
  },

  "japanese-candlestick": {
    plain:
      "A candlestick is a way of drawing what the price did during one period, such as an hour or a day. A thick body spans the opening and closing prices, and thin lines called wicks or shadows reach to the highest and lowest prices of the period. The method is traditionally traced to the rice markets of Japan, which is where the name comes from.",
    why: "Most trading platforms draw charts this way, so reading a candle is a basic chart skill. The colour or fill of the body shows at a glance whether the period closed above or below where it opened.",
    example: {
      setup: "During one hour an invented price opens at 1.1000, rises as high as 1.1030, drops as low as 1.0990 and closes at 1.1020.",
      steps: [
        "Body: from the open at 1.1000 up to the close at 1.1020, so 20 pips and rising",
        "Upper wick: from 1.1020 to the high at 1.1030, so 10 pips",
        "Lower wick: from 1.1000 down to the low at 1.0990, so 10 pips",
      ],
      result: "The candle is a rising one with a 20-pip body and a 10-pip wick at each end; its full range is 40 pips.",
    },
    mistake:
      "The top of the body is not always the close. On a falling candle the open is at the top of the body and the close is at the bottom.",
    diagramCaption:
      "A single candle with its body and its upper and lower wicks, built from the path the price took during the period.",
    diagram: { kind: "candles", shape: "single", labels: ["Body", "Upper wick", "Lower wick"] },
    quiz: {
      question: "A candle has a long upper wick and a small body near its low. What does that say about the period?",
      options: [
        "The price never traded above the body",
        "The close was the highest price of the period",
        "The price went well above the body at some point, then came back",
        "No trades took place",
      ],
      answer: 2,
      because: "The upper wick reaches to the highest price of the period. A long one means the price climbed well above both the open and the close and did not stay there.",
    },
  },

  "knock-in-option": {
    plain:
      "An option is a contract that gives its holder the right, but not the obligation, to buy or sell something at a set price called the strike. A knock-in option is one that comes into force only if the underlying price touches a chosen level, called the barrier, during the option’s life.",
    why: "Barrier options usually cost less than an ordinary option with the same terms, because there are outcomes in which they never come into force. The buyer pays the price of the option, called the premium, at the start, whether or not the barrier is ever touched.",
    example: {
      setup: "A buyer pays a premium of 100 for a knock-in call, the right to buy, with a strike of 1.2000 and a barrier above it at 1.2200.",
      steps: [
        "Case 1: the price reaches 1.2200 during the option’s life, so the option is activated and from then on behaves like an ordinary call",
        "Case 2: the price rises only as far as 1.2150, so the barrier is never touched",
        "In case 2 the option never comes into force, although the price finished above the strike",
      ],
      result: "In the second case the buyer has paid 100 and holds nothing, where an ordinary call with the same strike would have had value.",
    },
    mistake:
      "Before the barrier is touched the option is not without a market price: its price reflects the chance that it is activated. What it lacks until then is any right that can be exercised.",
    diagramCaption:
      "The underlying price rises towards a barrier line; when it touches the line the option switches on, and moving the price shows the option staying inactive below the barrier.",
    diagram: { kind: "threshold", labels: ["Barrier", "Underlying price", "Option activates"], from: "below" },
    quiz: {
      question: "The barrier of a knock-in option is never touched before expiry. In the standard form, what does the holder have at expiry?",
      options: ["Nothing: the option never came into force", "An ordinary option", "A full refund of the premium"],
      answer: 0,
      because: "A knock-in option exists as a usable right only after the barrier has been touched. If that never happens it lapses, and the premium paid at the start is not returned.",
    },
  },

  "knock-out-option": {
    plain:
      "A knock-out option is an option, a contract giving the right to buy or sell at a set price called the strike, that is cancelled if the underlying price touches a chosen level called the barrier. Once it has been knocked out it stays cancelled, whatever the price does afterwards.",
    why: "The possibility of cancellation makes a knock-out option cheaper than an ordinary option with the same terms. The holder accepts that a touch of the barrier ends the contract even if the price later moves the way they had hoped.",
    example: {
      setup: "A buyer pays a premium of 100 for a knock-out call, the right to buy, with a strike of 1.2000 and a barrier below it at 1.1800.",
      steps: [
        "The price dips to 1.1800: the barrier is touched and the option is cancelled",
        "The price then recovers and finishes at 1.2300",
        "An ordinary call with the same strike would finish 1.2300 − 1.2000 = 0.0300, or 300 pips, above its strike",
      ],
      result: "The knock-out holder has nothing at expiry and has lost the premium of 100, because the cancellation happened on the way.",
    },
    mistake:
      "It is natural to think that only the price at expiry matters. For a barrier option the path matters: in the standard form, one touch of the barrier during the option’s life is enough.",
    diagramCaption:
      "The underlying price falls towards a barrier line; when it touches the line the option ends.",
    diagram: { kind: "threshold", labels: ["Barrier", "Underlying price", "Option ends"], from: "above" },
    quiz: {
      question: "Why is a knock-out option usually cheaper than an otherwise identical ordinary option?",
      options: [
        "It has a longer life",
        "It can be cancelled before expiry, so it pays out in fewer cases",
        "It carries no premium",
        "Its strike price is always lower",
      ],
      answer: 1,
      because: "The ordinary option pays in every case the knock-out does, and also in the cases where the barrier was touched. Fewer possible payouts make the knock-out worth less.",
    },
  },

  leverage: {
    plain:
      "Leverage lets a trader hold a position worth much more than the money they put up for it. The money put up is called margin, and the ratio between the position and the margin is the leverage: at 1:100, a margin of 1,000 supports a position of 100,000.",
    why: "Profit and loss are calculated on the full position, not on the margin, so leverage multiplies the effect of every price move on the account. It is the main reason losses in leveraged trading can be fast, and large relative to the money deposited.",
    example: {
      setup: "With leverage of 1:100, a trader opens a position with a notional value, meaning its full value, of 100,000.",
      steps: [
        "Margin required: 100,000 ÷ 100 = 1,000",
        "The price moves 0.5% against the position: 100,000 × 0.005 = 500 lost",
        "As a share of the margin: 500 ÷ 1,000 = 0.5, or 50%",
      ],
      result: "A move of half of one per cent in the price removes half of the margin put up.",
    },
    mistake:
      "Leverage is sometimes described as extra money to trade with. It is extra exposure: the trader’s own funds bear the whole of any loss on the larger position.",
    diagramCaption:
      "A lever with a small margin on one side lifting a much larger position on the other; the margin side moves a little and the position side moves a great deal.",
    diagram: { kind: "lever", labels: ["Margin", "Position"] },
    quiz: {
      question: "At leverage of 1:50, what margin supports a position with a notional value of 200,000?",
      options: ["2,000", "4,000", "10,000", "50,000"],
      answer: 1,
      because: "Margin is the notional value divided by the leverage: 200,000 ÷ 50 = 4,000.",
    },
  },

  "limit-order": {
    plain:
      "A limit order is an instruction to buy or sell only at a stated price or a better one. A buy limit sits below the current price and waits for the market to come down to it; a sell limit sits above and waits for the market to rise.",
    why: "It lets a trader name the price in advance instead of accepting whatever the market offers at that moment. The price is controlled but the execution is not: if the market never reaches the limit, the order is not filled.",
    example: {
      setup: "A pair trades at 1.1050 and a trader places a buy limit at 1.1000.",
      steps: [
        "The price falls to 1.1020: the order waits, because 1.1020 is above the limit",
        "The price falls to 1.1000: the order can now be filled at 1.1000 or lower",
        "Had the price turned up from 1.1005, the order would have stayed unfilled",
      ],
      result: "The order fills only once the market trades at the limit price or better.",
    },
    mistake:
      "A limit order is not certain to be filled just because it has been placed. The market may stop short of the price, and the trade then never happens.",
    diagramCaption:
      "The current price sits between a sell limit resting above it and a buy limit resting below; moving the price to either level shows that order being reached.",
    diagram: { kind: "levels", labels: ["Sell limit", "Current price", "Buy limit"] },
    quiz: {
      question: "The market is at 1.3000. Where does a sell limit order rest?",
      options: ["Below 1.3000", "Exactly at 1.3000", "Above 1.3000", "Anywhere, it makes no difference"],
      answer: 2,
      because: "A limit order asks for the stated price or better. For a seller, better means higher, so a sell limit waits above the current price.",
    },
  },

  liquidity: {
    plain:
      "Liquidity is how easily something can be bought or sold in quantity without moving its price. In a liquid market there are many buyers and sellers with orders close to the current price; in an illiquid one there are few, and a single large order can shift the price.",
    why: "Liquidity shows up in the cost and quality of execution: liquid markets tend to have narrower spreads and less slippage, which is the difference between the price expected and the price received. It also changes through the day and can thin out sharply around major news or at the daily rollover.",
    example: {
      setup: "A trader wants to buy 3 lots; sellers are offering 2 lots at 1.1001 and 5 lots at 1.1003.",
      steps: [
        "The first 2 lots fill at 1.1001",
        "The remaining 1 lot fills at 1.1003",
        "Average price: (2 × 1.1001 + 1 × 1.1003) ÷ 3 = 3.3005 ÷ 3 ≈ 1.10017",
      ],
      result: "Because there was not enough on offer at the best price, the order was filled a little higher on average than the first quote.",
    },
    mistake:
      "A market that is liquid most of the time is not liquid all of the time. Even the most traded pairs can show wide spreads and gaps for short periods.",
    diagramCaption:
      "Sellers’ orders rest above the current price and buyers’ orders below it; moving the price up or down brings it to the orders resting on that side.",
    diagram: { kind: "levels", labels: ["Sellers’ orders", "Current price", "Buyers’ orders"] },
    quiz: {
      question: "Which is the clearest sign of a liquid market?",
      options: ["A narrow gap between buying and selling prices", "Large jumps between one trade and the next", "A price that never changes"],
      answer: 0,
      because: "Where many buyers and sellers compete close to the current price, the best buying and selling prices sit near each other. Jumps between trades suggest the opposite.",
    },
  },

  "liquidity-provider": {
    plain:
      "A liquidity provider is a firm, typically a large bank or a specialist trading firm, that continuously quotes a price at which it will buy and a price at which it will sell. Those standing quotes are what make it possible for someone else to trade at once.",
    why: "A broker’s prices are built from the quotes of the providers it is connected to. Depending on the broker’s model, a client’s order may be passed on to a provider or dealt with by the broker itself, and the providers behind a broker affect its spreads and how orders are filled.",
    example: {
      setup: "A broker receives quotes for the same pair from three providers at the same moment.",
      steps: [
        "Provider A: bid 1.1000, ask 1.1003",
        "Provider B: bid 1.1001, ask 1.1004",
        "Provider C: bid 1.0999, ask 1.1002",
        "Best bid 1.1001 from B; best ask 1.1002 from C",
      ],
      result: "Combining the best of each gives a spread of 1 pip, narrower than the 3 pips that each provider quoted alone.",
    },
    mistake:
      "A liquidity provider is not obliged to quote the same price or the same amount in all conditions. In fast markets providers widen their quotes or reduce the amount on offer, and spreads widen with them.",
    diagramCaption:
      "A broker at the centre is joined to several liquidity providers; pointing at a provider shows its quotes flowing to the broker.",
    diagram: { kind: "hub", labels: ["Broker", "Provider A", "Provider B", "Provider C"] },
    quiz: {
      question: "What does a liquidity provider do?",
      options: [
        "Sets official exchange rates",
        "Lends traders the money for margin",
        "Quotes prices at which it is prepared to buy and to sell",
        "Supervises brokers",
      ],
      answer: 2,
      because: "A liquidity provider stands ready on both sides of the market with a buying price and a selling price. It does not set official rates, lend margin or supervise anyone.",
    },
  },

  "long-position": {
    plain:
      "A long position is a trade that was opened by buying and is still open. It gains value when the price rises above the purchase price and loses value when the price falls below it.",
    why: "On a trading platform a long position is opened at the ask, the higher of the two quoted prices, and closed at the bid, the lower. It therefore starts with a small loss equal to the spread, and the price has to move by that much before the position breaks even.",
    example: {
      setup: "A trader opens a long position of one standard lot of GBP/USD at an ask of 1.2002 when the bid is 1.2000, and closes it when the bid is 1.2032.",
      steps: [
        "At the open the position could be closed only at the bid, 1.2000, which is 2 pips below entry",
        "Exit minus entry: 1.2032 − 1.2002 = 0.0030, or 30 pips",
        "30 pips × 10 US dollars = 300 US dollars",
      ],
      result: "The position gains 300 US dollars before any commission or overnight charge.",
    },
    mistake:
      "A long position showing a gain has not yet earned that gain. Until the position is closed the result is floating, and it changes with every price move.",
    diagramCaption:
      "An entry price and an exit price with the distance between them marked as the profit or loss; the further the exit is from the entry, the larger the result.",
    diagram: { kind: "gap", labels: ["Exit price", "Entry price", "Profit or loss"] },
    quiz: {
      question: "A long position was opened at 1.5000 and the bid now stands at 1.4950. What is its floating result?",
      options: ["A gain of 50 pips", "A loss of 5 pips", "Zero, because it is still open", "A loss of 50 pips"],
      answer: 3,
      because: "A long position loses when the price falls. From 1.5000 to 1.4950 is 0.0050, or 50 pips, against it, and that loss counts in the account’s equity while the position is open.",
    },
  },

  lot: {
    plain:
      "A lot is the standard unit in which the size of a trade is measured. In foreign exchange one standard lot is 100,000 units of the first currency in the pair; a mini lot is 10,000 units, a micro lot 1,000, and some brokers also offer a nano lot of 100.",
    why: "The lot size decides how much each pip of movement is worth, so it is the setting that scales both profit and loss. Trade sizes are usually entered in lots or decimals of a lot, such as 0.10 for a mini lot.",
    example: {
      setup: "A pair quoted to four decimals moves 20 pips, and the same move is measured on three trade sizes.",
      steps: [
        "Standard lot (1.00): 10 per pip × 20 = 200",
        "Mini lot (0.10): 1 per pip × 20 = 20",
        "Micro lot (0.01): 0.10 per pip × 20 = 2",
      ],
      result: "The same 20-pip move is worth 200, 20 or 2 units of the quote currency, depending only on the lot size.",
    },
    mistake:
      "A lot is not a fixed sum of money. It is a quantity of the base currency, so its value in a trader’s own currency depends on the exchange rate, and for other instruments such as gold or indices the contract size is different.",
    diagramCaption:
      "A mini lot is drawn as one tenth of a standard lot.",
    diagram: { kind: "share", labels: ["Mini lot", "Standard lot"], share: 0.1 },
    quiz: {
      question: "How many units of the base currency is a trade of 0.25 standard lots?",
      options: ["250", "2,500", "25,000", "250,000"],
      answer: 2,
      because: "One standard lot is 100,000 units, so 0.25 × 100,000 = 25,000 units.",
    },
  },

  macd: {
    plain:
      "MACD stands for moving average convergence divergence. It takes two exponential moving averages of price, which are averages that give more weight to recent prices, one faster and one slower, and plots the distance between them as a line. A second, smoothed line called the signal line is drawn alongside it.",
    why: "Chart readers use it to describe whether recent price movement is gaining or losing speed relative to the longer run. Because it is built from averages of past prices it turns after the price has turned, and in sideways markets its crossings are frequent and often reversed.",
    example: {
      setup: "With the common settings the fast average covers 12 periods and the slow one 26; on an invented chart they stand at 1.1040 and 1.1010.",
      steps: [
        "MACD line: 1.1040 − 1.1010 = 0.0030",
        "The signal line, a 9-period average of the MACD line, stands at 0.0020",
        "Histogram: 0.0030 − 0.0020 = 0.0010",
      ],
      result: "MACD is positive, so the fast average is above the slow one, and it is above its signal line, so the gap is larger than its own recent average.",
    },
    mistake:
      "A MACD crossing is sometimes treated as an instruction. It restates what the price has already done, with a delay, and the same crossing can be followed by a move in either direction.",
    diagramCaption:
      "A fast average and a slow average draw apart and come back together; the distance between them is the MACD line, and pointing along the lines shows that distance growing and shrinking.",
    diagram: { kind: "lines", labels: ["Fast average", "Slow average"], relation: "diverge" },
    quiz: {
      question: "The MACD line is at zero. What does that say about the two moving averages?",
      options: ["They are equal", "The fast one is far above the slow one", "The price has stopped moving", "Both averages are at zero"],
      answer: 0,
      because: "The MACD line is the fast average minus the slow average. A difference of zero means the two averages have the same value at that moment.",
    },
  },

  "major-pairs": {
    plain:
      "The major pairs are the most heavily traded currency pairs, and each of them has the US dollar on one side. By the usual convention there are seven: EUR/USD, USD/JPY, GBP/USD, USD/CHF, AUD/USD, USD/CAD and NZD/USD.",
    why: "Because so much business passes through them, the majors are generally the most liquid pairs, which tends to mean narrower spreads than on less traded pairs. The list is a market convention, and some sources use a shorter one.",
    example: {
      setup: "Three pairs are sorted by the usual convention: EUR/USD, EUR/GBP and USD/JPY.",
      steps: [
        "EUR/USD: includes the US dollar and is on the list, so it is a major",
        "EUR/GBP: has no US dollar, so it is a minor, also called a cross",
        "USD/JPY: includes the US dollar and is on the list, so it is a major",
      ],
      result: "Two of the three are majors; the test is whether the pair is one of the heavily traded dollar pairs.",
    },
    mistake:
      "Not every pair containing the US dollar is a major. A pair such as USD/TRY has the dollar on one side but is classed as an exotic, because the other currency is far less traded.",
    diagramCaption:
      "The US dollar at the centre is joined to six of the currencies it forms major pairs with (the New Zealand dollar, the seventh, is not drawn); pointing at a currency shows the pair it makes with the dollar.",
    diagram: { kind: "hub", labels: ["USD", "EUR", "JPY", "GBP", "CHF", "AUD", "CAD"] },
    quiz: {
      question: "Which of these is a major pair?",
      options: ["EUR/GBP", "USD/CHF", "GBP/JPY", "AUD/NZD"],
      answer: 1,
      because: "USD/CHF is one of the heavily traded dollar pairs. The other three contain no US dollar, which makes them crosses.",
    },
  },

  margin: {
    plain:
      "Margin is the part of a trader’s own funds that a broker sets aside as security while a leveraged position is open. It is a deposit held against the position, released when the position is closed, and it is not a fee.",
    why: "The margin required decides how large a position an account can open and how much is left over to absorb losses. If losses reduce the account’s equity towards the margin in use, the broker may issue a margin call or close positions.",
    example: {
      setup: "An account has equity of 5,000 US dollars and opens one standard lot of a pair priced at 1.0000 against the dollar, with leverage of 1:100.",
      steps: [
        "Notional value: 100,000 × 1.0000 = 100,000 US dollars",
        "Margin at 1%: 100,000 × 0.01 = 1,000 US dollars",
        "Free margin: 5,000 − 1,000 = 4,000 US dollars",
      ],
      result: "One fifth of the account is held as margin and 4,000 US dollars remains free.",
    },
    mistake:
      "Margin is not the most that can be lost on a trade. The loss is calculated on the full position and can be larger than the margin held for it.",
    diagramCaption:
      "The account’s equity is drawn as a whole with the margin in use as one fifth of it; the rest of the ring is what remains free.",
    diagram: { kind: "share", labels: ["Used margin", "Account equity"], share: 0.2 },
    quiz: {
      question: "What happens to the margin held for a position when that position is closed?",
      options: [
        "It is kept by the broker as a fee",
        "It is doubled",
        "It is turned into a new position",
        "It is released, and the trade’s profit or loss is applied to the balance",
      ],
      answer: 3,
      because: "Margin is security, not a charge. On closing, the amount set aside becomes free again and the balance changes only by the result of the trade and its costs.",
    },
  },

  "margin-call": {
    plain:
      "A margin call is a warning that the funds in an account have fallen close to the minimum needed to keep its leveraged positions open. It is measured by the margin level: equity, meaning the balance plus or minus the result of open trades, divided by the margin in use and shown as a percentage.",
    why: "After a margin call the choices are to add funds, to reduce positions, or to leave things as they are and risk the broker closing positions automatically at a lower level called the stop out. Each broker sets its own levels.",
    example: {
      setup: "An account has equity of 2,000 and 1,000 of margin in use; the broker in this example issues a margin call at a margin level of 100%.",
      steps: [
        "Margin level now: 2,000 ÷ 1,000 × 100 = 200%",
        "Open trades lose 1,000, so equity falls to 1,000",
        "Margin level: 1,000 ÷ 1,000 × 100 = 100%",
      ],
      result: "The margin level has reached 100%, the level at which the broker in this example issues a margin call.",
    },
    mistake:
      "A margin call is often imagined as a telephone call that leaves time to respond. In electronic trading it is usually a status shown on the platform, and in a fast market the stop out can follow within moments.",
    diagramCaption:
      "The account’s margin level falls from above towards the margin call level; when it touches that line a warning is issued, and moving the margin level shows where the line is crossed.",
    diagram: { kind: "threshold", labels: ["Margin call level", "Margin level", "Warning issued"], from: "above" },
    quiz: {
      question: "Equity is 1,500 and the margin in use is 1,000. What is the margin level?",
      options: ["150%", "66%", "500%", "15%"],
      answer: 0,
      because: "Margin level is equity divided by used margin, times 100: 1,500 ÷ 1,000 × 100 = 150%.",
    },
  },

  "market-maker": {
    plain:
      "A market maker is a firm that continuously quotes two prices for an instrument: a bid at which it will buy and an ask at which it will sell. When a client trades on those prices, the market maker itself is the other side of the trade.",
    why: "Market makers supply the standing prices that let others trade immediately. A broker that acts as market maker is the counterparty to its clients’ trades, which is a conflict of interest, and a broker’s order execution policy is where its model is described.",
    example: {
      setup: "A market maker quotes a pair at 1.3000 bid and 1.3002 ask; one client sells one standard lot and another buys one standard lot at those prices.",
      steps: [
        "It buys from the seller at 1.3000",
        "It sells to the buyer at 1.3002",
        "Difference: 1.3002 − 1.3000 = 0.0002, or 2 pips",
        "2 pips × 10 = 20 units of the quote currency",
      ],
      result: "With the two trades matched, the market maker keeps the spread of 20 and has no position left.",
    },
    mistake:
      "A market maker does not simply collect the spread on every trade. When buying and selling do not match, the firm is left holding a position whose value moves with the market, and it has to manage or hedge that risk.",
    diagramCaption:
      "A trade passes from a seller, through the market maker, to a buyer; stepping through the stages shows the market maker buying at its bid and selling at its ask.",
    diagram: { kind: "flow", labels: ["Seller", "Market maker", "Buyer"] },
    quiz: {
      question: "A client buys from a market maker. Who is on the other side of that trade?",
      options: ["Another retail client, in every case", "The central bank", "The market maker itself", "Nobody"],
      answer: 2,
      because: "A market maker deals as principal: it sells to the client from its own book. It may later offset that position with other clients’ trades or in the wider market.",
    },
  },

  "market-order": {
    plain:
      "A market order is an instruction to buy or sell straight away at the best price currently available. The trader chooses the size and the direction, and the market supplies the price.",
    why: "It is the quickest way into or out of a position, and the cost of that speed is uncertainty about the exact price. The fill can differ from the price seen on screen when the order was sent, a difference called slippage, which is most likely in fast or thin markets.",
    example: {
      setup: "A trader sees an ask of 1.1000 on EUR/USD and sends a market order to buy one standard lot; by the time it is executed the best ask is 1.1002.",
      steps: [
        "Expected price 1.1000, filled at 1.1002",
        "Slippage: 1.1002 − 1.1000 = 0.0002, or 2 pips",
        "On one standard lot: 2 × 10 = 20 US dollars",
      ],
      result: "The order was filled at once, 2 pips worse than the price on screen, a difference of 20 US dollars.",
    },
    mistake:
      "The price on screen is not a promise. A market order accepts the price available when it is executed, which can be worse or better than the one displayed a moment earlier.",
    diagramCaption:
      "An order passes through three stages: sent, matched with the best available price, and filled; stepping through them shows that the price is settled only at the last stage.",
    diagram: { kind: "flow", labels: ["Order sent", "Best price found", "Order filled"] },
    quiz: {
      question: "What does a market order leave uncertain?",
      options: ["The exact price of the fill", "The size of the trade", "Whether it is a buy or a sell"],
      answer: 0,
      because: "The trader sets the size and the direction. The price is whatever the market offers at the moment of execution, which may differ from the quote seen when the order was sent.",
    },
  },

  "martingale-strategy": {
    plain:
      "Martingale is a staking method taken from gambling: after every losing trade the next trade is made twice as large, so that a single win recovers all the earlier losses and leaves a small gain. It depends on a winning trade arriving before the money, or the largest trade size allowed, runs out.",
    why: "It appears in trading forums and in some automated systems because it tends to produce many small gains in a row. The size required doubles with each loss, so a run of losses that is not unusual can consume an entire account.",
    example: {
      setup: "A trader starts by risking 100, doubles after each loss, and each trade wins or loses the amount risked; five trades in a row lose.",
      steps: [
        "Amounts risked: 100, 200, 400, 800, 1,600",
        "Total lost after five: 100 + 200 + 400 + 800 + 1,600 = 3,100",
        "The sixth trade must risk 3,200",
        "If it wins: 3,200 − 3,100 = 100",
      ],
      result: "To end 100 ahead, the trader has had to put 3,200 at risk on top of 3,100 already lost; a sixth loss would bring the total lost to 6,300.",
    },
    mistake:
      "The reasoning “a win must come eventually” overlooks that funds are finite. A long losing run becomes more and more likely the longer the method is used, and when it comes the loss is far larger than all the small gains before it.",
    diagramCaption:
      "Four bars show the amount risked on four successive losing trades, each twice the height of the one before; pointing at a bar picks it out for comparison.",
    diagram: { kind: "bars", labels: ["Trade 1", "Trade 2", "Trade 3", "Trade 4"], sizes: [1, 2, 4, 8] },
    quiz: {
      question: "Starting at 50 and doubling after each loss, how much is risked on the fourth trade, after three losses?",
      options: ["200", "800", "150", "400"],
      answer: 3,
      because: "The amounts run 50, 100, 200, 400. Each loss doubles the next amount, so the fourth trade risks eight times the first.",
    },
  },

  metatrader: {
    plain:
      "MetaTrader is a family of trading platforms made by the software company MetaQuotes; the two versions in use are MetaTrader 4 and MetaTrader 5. A platform is the program through which a trader sees prices and charts and sends orders to a broker. MetaTrader can also run Expert Advisors, programs that place orders automatically according to rules.",
    why: "Many brokers offer MetaTrader, so a trader who learns it meets the same charts, order tickets and tools at different firms. The software is the same everywhere, but the instruments, prices and trading conditions shown in it come from the broker whose account is logged in.",
    mistake:
      "MetaTrader is not itself a broker and does not hold client money. It is software supplied by MetaQuotes; the account, the prices and the execution belong to the broker.",
    diagramCaption:
      "The platform at the centre is joined to the things it provides: charts, orders, indicators and Expert Advisors; pointing at one shows its link to the platform.",
    diagram: { kind: "hub", labels: ["MetaTrader", "Charts", "Orders", "Indicators", "Expert Advisors"] },
    quiz: {
      question: "On a MetaTrader platform, where do the prices and trading conditions come from?",
      options: [
        "From MetaQuotes, identically for everyone",
        "From the broker whose account is logged in",
        "From the trader’s own computer",
        "From one public exchange for all currencies",
      ],
      answer: 1,
      because: "MetaQuotes makes the software. Each broker connects it to its own servers, so prices, instruments and conditions are the broker’s and can differ from one broker to another.",
    },
  },

  "minor-pairs": {
    plain:
      "Minor pairs, also called crosses, are pairs made of two major currencies where neither is the US dollar. EUR/GBP, EUR/JPY and GBP/JPY are examples.",
    why: "Crosses let a trader take a view on two currencies directly, without going through the dollar. They are generally traded less than the majors, so their spreads are commonly somewhat wider, and their price reflects the two dollar pairs that lie behind them.",
    example: {
      setup: "In an invented market EUR/USD stands at 1.2000 and GBP/USD at 1.5000.",
      steps: [
        "One euro buys 1.2000 dollars; one pound buys 1.5000 dollars",
        "EUR/GBP = EUR/USD ÷ GBP/USD",
        "1.2000 ÷ 1.5000 = 0.8000",
      ],
      result: "The cross rate EUR/GBP is 0.8000: one euro buys 0.80 pounds.",
    },
    mistake:
      "“Minor” does not mean small or obscure: these are pairs of heavily used currencies, and the name only marks the absence of the dollar. Pairs that include a thinly traded currency are called exotics.",
    diagramCaption:
      "Two currencies, the euro and the pound, are bound together as one pair with no dollar between them; the euro, on the left, is the base and the pound is the quote.",
    diagram: { kind: "pair", labels: ["EUR", "GBP"] },
    quiz: {
      question: "Which of these is a minor pair, or cross?",
      options: ["EUR/JPY", "USD/JPY", "EUR/USD", "USD/CAD"],
      answer: 0,
      because: "EUR/JPY joins two major currencies without the US dollar. The other three all have the dollar on one side.",
    },
  },

  momentum: {
    plain:
      "Momentum is the speed at which a price is changing: how far it has moved over a chosen number of periods. A price that has risen 100 pips in ten periods has more momentum than one that has risen 20 pips in the same time.",
    why: "Chart readers watch momentum to judge whether a move is strengthening or fading, and many indicators, such as RSI and MACD, are ways of measuring it. Fading momentum says that the move is slowing, which is not the same as saying it is about to reverse.",
    example: {
      setup: "The simplest momentum measure subtracts the close ten periods ago from the latest close.",
      steps: [
        "Latest close 1.1080, close ten periods earlier 1.1000: momentum = 0.0080, or 80 pips",
        "Five periods later: latest close 1.1100, close ten periods earlier 1.1060",
        "Momentum = 1.1100 − 1.1060 = 0.0040, or 40 pips",
      ],
      result: "The price is higher than before, 1.1100 against 1.1080, yet momentum has halved from 80 pips to 40: the rise is slowing.",
    },
    mistake:
      "Falling momentum is easily mistaken for a falling price. Momentum can decline while the price is still rising, because it measures the pace of the move and not the level of the price.",
    diagramCaption:
      "A price line keeps rising while a momentum line turns down, the two drawing apart; pointing along them shows the price making a new high as momentum makes a lower one.",
    diagram: { kind: "lines", labels: ["Price", "Momentum"], relation: "diverge" },
    quiz: {
      question: "The price makes a new high, but its momentum reading is lower than at the previous high. What does this describe?",
      options: ["The price is falling", "The rise is continuing at a slower pace", "The indicator is faulty", "The price and its momentum are the same thing"],
      answer: 1,
      because: "A new high means the price is still rising. Lower momentum means it is covering less ground per period than it did before.",
    },
  },

  "monetary-policy": {
    plain:
      "Monetary policy is how a central bank influences the cost and supply of money in an economy. Its main tool is a policy interest rate, which feeds through to the rates that banks charge and pay; it can also buy or sell assets such as government bonds.",
    why: "Interest rates are one of the main influences on exchange rates, so policy decisions and the statements that accompany them are among the most watched events on the economic calendar. Markets respond to changes in what is expected as well as to the decisions themselves.",
    example: {
      setup: "A central bank raises its policy rate from 2.00% to 2.25%.",
      steps: [
        "Change: 2.25 − 2.00 = 0.25 percentage points",
        "One basis point is one hundredth of a percentage point, 0.01",
        "0.25 ÷ 0.01 = 25 basis points",
      ],
      result: "The move is described as a rise of 25 basis points, a tightening of policy.",
    },
    mistake:
      "Raising a rate from 2% to 3% is a rise of one percentage point, not of 1%. Measured against the old rate it is an increase of 50%, which is why rate moves are quoted in basis points.",
    diagramCaption:
      "A loop of four stages: economic data, the central bank’s decision, the change in rates and the economy’s response, which becomes the next round of data; stepping round the loop shows each stage leading to the next.",
    diagram: { kind: "cycle", labels: ["Data", "Decision", "Rates change", "Economy responds"] },
    quiz: {
      question: "A central bank raises its policy rate and reduces its holdings of bonds. How is this stance described?",
      options: ["Easing", "Fiscal stimulus", "Tightening"],
      answer: 2,
      because: "Higher rates and a smaller stock of assets both make money more costly or less plentiful, which is tightening. Fiscal measures are taxes and public spending, decided by governments.",
    },
  },

  "money-management": {
    plain:
      "Money management is the set of rules a trader uses to decide how much of the account to put at risk on each trade and in total. Its central idea is position sizing: choosing the trade size so that a loss at the planned exit costs a known, limited part of the account.",
    why: "It determines how many losing trades an account can absorb before it is seriously damaged. The arithmetic is unforgiving: the more that is lost, the larger the percentage gain needed to get back, so a 50% loss needs a 100% gain to recover.",
    example: {
      setup: "An account of 10,000 US dollars limits the risk on one trade to 1%, with the stop-loss, the price at which the trade is closed at a loss, 50 pips from entry.",
      steps: [
        "Amount at risk: 10,000 × 0.01 = 100 US dollars",
        "Value per pip allowed: 100 ÷ 50 = 2 US dollars",
        "One standard lot is worth 10 US dollars per pip, so 2 ÷ 10 = 0.20 lots",
      ],
      result: "A trade of 0.20 lots loses 100 US dollars, or 1% of the account, if it is closed at the stop-loss price.",
    },
    mistake:
      "Sizing a trade by how confident one feels is not money management. The rule is set before the trade, and a stop-loss limits the loss only if it is filled at its price, which a gap or slippage can prevent.",
    diagramCaption:
      "Three bars compare how much of an account is lost after ten losing trades in a row when each trade risks 1%, 2% or 5% of what remains: about 10%, 18% and 40%; pointing at a bar picks it out for comparison.",
    diagram: { kind: "bars", labels: ["1% per trade", "2% per trade", "5% per trade"], sizes: [2, 4, 8] },
    quiz: {
      question: "An account of 1,000 loses 20% of its value. What gain on the remaining amount is needed to return to 1,000?",
      options: ["25%", "20%", "40%", "10%"],
      answer: 0,
      because: "After a 20% loss, 800 is left and 200 must be regained. 200 ÷ 800 = 0.25, so the gain needed is 25%, more than the 20% that was lost.",
    },
  },

  "moving-average": {
    plain:
      "A moving average is the average of the most recent prices, usually closing prices, over a set number of periods. Each time a new period ends the oldest price drops out and the newest comes in, so the average moves along with the chart as a smoothed line.",
    why: "It filters out small swings so that the general direction is easier to see. The smoothing has a cost: the line reacts after the price has moved, and the more periods it covers the later it reacts.",
    example: {
      setup: "A 5-period simple moving average is calculated on closes of 10, 12, 11, 13 and 14, and then the next close is 15.",
      steps: [
        "Sum: 10 + 12 + 11 + 13 + 14 = 60",
        "Average: 60 ÷ 5 = 12",
        "New window 12, 11, 13, 14, 15: sum 65, average 65 ÷ 5 = 13",
      ],
      result: "The average moves from 12 to 13 as the oldest close, 10, is replaced by the newest, 15.",
    },
    mistake:
      "A moving average is sometimes read as a level that the price must respect. It is only an average of past prices: a simple one weights every period equally, while an exponential one gives more weight to recent periods and so turns sooner.",
    diagramCaption:
      "A jagged price line and its smoother moving average; the price climbs through the average, and pointing along the lines shows the average turning later than the price.",
    diagram: { kind: "lines", labels: ["Price", "Moving average"], relation: "cross-up" },
    quiz: {
      question: "Compared with a 20-period moving average, how does a 200-period moving average behave?",
      options: ["It reacts faster to new prices", "It is smoother and reacts more slowly", "It is always higher", "It uses future prices"],
      answer: 1,
      because: "With 200 prices in the average, each new price changes it very little. The line is smoother and takes longer to reflect a change of direction.",
    },
  },

  "negative-balance": {
    plain:
      "A negative balance is an account that has fallen below zero, so that more has been lost than was deposited. It can happen with leveraged positions when the price jumps so far and so fast that positions are closed at a much worse price than the level at which the broker would normally have closed them.",
    why: "It is the extreme outcome of leverage, usually linked to a gap: a jump in price with no trading in between, for example over a weekend or on unexpected news. Whether the client must repay the shortfall depends on the broker’s terms and on the rules that apply to the account.",
    example: {
      setup: "An account holds 2,000 US dollars and is long one standard lot of a pair quoted in dollars; the market closes at 1.1000 and reopens at 1.0750.",
      steps: [
        "Gap: 1.1000 − 1.0750 = 0.0250, or 250 pips",
        "Loss: 250 × 10 = 2,500 US dollars",
        "Account: 2,000 − 2,500 = −500 US dollars",
      ],
      result: "No price was available between the two levels, so the position could only be closed after the gap, leaving the account 500 US dollars below zero.",
    },
    mistake:
      "A stop-loss order does not rule this out. When triggered, a stop becomes an order to close at the next available price, and after a gap that price can be far beyond the stop.",
    diagramCaption:
      "A price line stops at the close and resumes much lower at the reopening, with empty space between; pointing at the gap shows that no price traded inside it.",
    diagram: { kind: "path", shape: "gap", labels: ["Price"], marks: ["Close", "Reopen"] },
    quiz: {
      question: "Why can an account go below zero even though a broker closes positions automatically at a stop out level?",
      options: [
        "Because automatic closing works only at weekends",
        "Because margin doubles overnight",
        "Because the price can jump past the level with no trading in between",
      ],
      answer: 2,
      because: "Automatic closing needs a price to close at. If the market gaps, the first available price may already be far beyond the stop out level, and the loss can exceed the funds in the account.",
    },
  },

  nfp: {
    plain:
      "Non-farm payrolls, or NFP, is a monthly figure from the US Bureau of Labor Statistics showing how many jobs the American economy added or lost in the previous month, leaving out farm work and a few other categories. It is published as part of the monthly employment report, usually on the first Friday of the month.",
    why: "Employment is one of the things the US central bank considers when setting interest rates, so the figure can change expectations about the dollar within seconds. Around the release prices often move sharply, spreads commonly widen and orders may be filled at prices different from those requested.",
    example: {
      setup: "Forecasters expect 200,000 new jobs and the report shows 120,000; the previous month’s figure is also revised from 180,000 to 150,000.",
      steps: [
        "Surprise: 120,000 − 200,000 = −80,000",
        "Revision: 150,000 − 180,000 = −30,000",
        "Jobs were still added in both months",
      ],
      result: "The report is weaker than expected on two counts, the shortfall and the revision, even though employment grew.",
    },
    mistake:
      "The headline number alone does not decide the reaction. The comparison with expectations, revisions to earlier months, and the unemployment rate and wage figures in the same report all feed into it, and the first move is often partly reversed.",
    diagramCaption:
      "A price line moves quietly, then swings sharply in both directions at the moment marked Release; pointing along the line shows how the swings cluster around the release.",
    diagram: { kind: "path", shape: "volatile", labels: ["Price at release"], marks: ["Release"] },
    quiz: {
      question: "NFP shows 250,000 jobs added when 150,000 were expected. Which description fits?",
      options: ["A fall in employment", "A result weaker than expected", "A result exactly in line", "A result stronger than expected"],
      answer: 3,
      because: "The figure is 100,000 above the forecast, so it is stronger than expected. How prices then move is a separate matter and is not settled by the number alone.",
    },
  },

  "non-dealing-desk": {
    plain:
      "A dealing desk is the part of a broker that takes the other side of clients’ trades. A non-dealing-desk broker, or NDD broker, describes a model in which client orders are instead passed on to outside liquidity providers, the banks and trading firms that quote prices, and filled at their prices.",
    why: "The model affects where a broker’s income comes from: an NDD broker typically earns a commission or a markup added to the providers’ spread. The label is used loosely in the industry, so a broker’s order execution policy is the document that says what actually happens to an order.",
    example: {
      setup: "The best quotes from an NDD broker’s providers are 1.1000 bid and 1.1001 ask, and the broker adds a markup of half a pip to each side.",
      steps: [
        "Client bid: 1.10000 − 0.00005 = 1.09995",
        "Client ask: 1.10010 + 0.00005 = 1.10015",
        "Client spread: 1.10015 − 1.09995 = 0.00020, or 2 pips",
      ],
      result: "The client sees a 2-pip spread: 1 pip from the providers and 1 pip of markup for the broker.",
    },
    mistake:
      "“No dealing desk” does not mean no cost and no slippage. The order still crosses a spread, and because it is filled at the providers’ current prices, the fill can differ from the price requested.",
    diagramCaption:
      "A client’s order passes through the broker and on to the liquidity providers; stepping through the stages shows the broker passing the order on and not taking the other side.",
    diagram: { kind: "flow", labels: ["Client order", "Broker", "Providers"] },
    quiz: {
      question: "In the non-dealing-desk model, who fills a client’s order?",
      options: ["An outside liquidity provider", "The broker’s own dealing desk", "The maker of the trading platform"],
      answer: 0,
      because: "The defining feature of the model is that orders are passed to outside providers and filled at their prices. A dealing desk, by contrast, takes the other side itself.",
    },
  },

  "notional-value": {
    plain:
      "Notional value is the full size of a position expressed in money: how much of the underlying the trade actually controls. It is far larger than the margin put up to open the position, and it is the figure on which profit and loss are worked out.",
    why: "Looking at notional value shows the real exposure behind a trade, which the small margin figure can hide. A 1% move in the price is 1% of the notional value, whatever the margin was.",
    example: {
      setup: "A trader holds 2 standard lots of EUR/USD at a price of 1.2000, with leverage of 1:100.",
      steps: [
        "Units: 2 × 100,000 = 200,000 euros",
        "Notional value: 200,000 × 1.2000 = 240,000 US dollars",
        "Margin at 1%: 240,000 × 0.01 = 2,400 US dollars",
        "A 1% price move: 240,000 × 0.01 = 2,400 US dollars",
      ],
      result: "The position is worth 240,000 US dollars, and a 1% move against it equals the entire margin of 2,400.",
    },
    mistake:
      "The margin is sometimes taken for the size of the trade. Margin is what is set aside; notional value is what is exposed to the market.",
    diagramCaption:
      "Lots, contract size and price are multiplied in turn to give the notional value; stepping through the stages builds the figure one factor at a time.",
    diagram: { kind: "flow", labels: ["Lots", "Contract size", "Price", "Notional value"] },
    quiz: {
      question: "Three standard lots of a pair priced at 1.5000: what is the notional value in the quote currency?",
      options: ["300,000", "150,000", "450,000", "4,500"],
      answer: 2,
      because: "Three lots are 300,000 units of the base currency, and 300,000 × 1.5000 = 450,000 in the quote currency.",
    },
  },

  offer: {
    plain:
      "The offer is the price at which the market is prepared to sell to you; it is another name for the ask. It is the higher of the two prices in a quote, and it is the price paid when buying.",
    why: "Every quote has two sides: a trader buys at the offer and sells at the bid, the lower price. The distance between them, the spread, is a cost paid on every round trip.",
    example: {
      setup: "A pair is quoted at 1.2500 bid and 1.2503 offer; a trader buys one standard lot and sells it at once with the quote unchanged.",
      steps: [
        "Buy at the offer: 1.2503",
        "Sell at the bid: 1.2500",
        "Difference: 1.2503 − 1.2500 = 0.0003, or 3 pips",
        "3 × 10 = 30 units of the quote currency",
      ],
      result: "The round trip costs 30 units of the quote currency, the spread, without the market having moved.",
    },
    mistake:
      "A chart usually draws only one of the two prices, commonly the bid. A buy is executed at the offer, which sits above that line by the width of the spread.",
    diagramCaption:
      "The offer sits above the bid with the distance between them marked as the spread; moving either price widens or narrows the gap.",
    diagram: { kind: "gap", labels: ["Offer (ask)", "Bid", "Spread"] },
    quiz: {
      question: "A quote reads 0.9500 / 0.9502. At what price does a trader buy?",
      options: ["0.9502", "0.9500", "0.9501"],
      answer: 0,
      because: "The second, higher price is the offer, and buying is done at the offer. The lower price, 0.9500, is the bid, at which the trader would sell.",
    },
  },

  "open-position": {
    plain:
      "An open position is a trade that has been entered and not yet closed. While it is open its result is floating: it rises and falls with each change in price and becomes final only at the close.",
    why: "Open positions tie up margin, and their floating result is counted in the account’s equity, so they affect how much room the account has. A position left open past the daily rollover may also be charged or credited swap, the overnight financing amount.",
    example: {
      setup: "An account has a balance of 5,000 US dollars and one open position showing a floating loss of 300.",
      steps: [
        "Equity: 5,000 − 300 = 4,700 US dollars",
        "The price recovers and the floating loss shrinks to 100: equity is 4,900",
        "The position is closed there, and the loss of 100 becomes final",
        "Balance: 5,000 − 100 = 4,900 US dollars",
      ],
      result: "The balance changed only when the position was closed; until then the loss existed in equity alone.",
    },
    mistake:
      "A floating loss is sometimes treated as not yet real. It already reduces equity and free margin, and it is what a margin call is calculated on.",
    diagramCaption:
      "A line showing a position’s floating result swings up and down between the points marked Open and Close; pointing along it shows the result changing until the close fixes it.",
    diagram: { kind: "path", shape: "volatile", labels: ["Floating result"], marks: ["Open", "Close"] },
    quiz: {
      question: "Which account figure changes from moment to moment while a position is open?",
      options: ["Balance", "Equity", "Total deposited", "Leverage"],
      answer: 1,
      because: "Equity is the balance plus or minus the floating result of open positions, so it moves with the price. The balance changes only when a position is closed.",
    },
  },

  order: {
    plain:
      "An order is an instruction given to a broker to buy or sell a stated amount of an instrument. It says what to trade, how much, in which direction and on what terms: at once at the current price, or later if the price reaches a chosen level.",
    why: "Every trade begins and ends with an order, and the type chosen decides what is fixed and what is left open. A market order fixes the timing and leaves the price open; a limit order fixes the price and leaves open whether it is filled.",
    example: {
      setup: "A pair trades at 1.1000 and a trader considers three instructions to buy.",
      steps: [
        "Market order: filled now, at about 1.1000",
        "Buy limit at 1.0950: waits, and fills only if the price falls to 1.0950",
        "Buy stop at 1.1050: waits, and becomes a market order if the price rises to 1.1050",
      ],
      result: "The same intention, to buy, leads to three different outcomes depending on the type of order.",
    },
    mistake:
      "Placing an order is not the same as making a trade. An order is a request: it becomes a position only when it is executed, and a waiting order can expire or be cancelled without ever trading.",
    diagramCaption:
      "The order at the centre is joined to its common types: market, limit, stop and trailing stop; pointing at a type shows it as one form the same instruction can take.",
    diagram: { kind: "hub", labels: ["Order", "Market", "Limit", "Stop", "Trailing stop"] },
    quiz: {
      question: "Which order type fixes the price but leaves it uncertain whether the trade happens at all?",
      options: ["A market order", "A stop order after it is triggered", "A limit order"],
      answer: 2,
      because: "A limit order trades only at its stated price or better, so if the market never gets there nothing happens. The other two take the available price.",
    },
  },

  overbought: {
    plain:
      "Overbought is a label chart readers give to a market that has risen quickly and far by the measure of an indicator. With the relative strength index, or RSI, which runs from 0 to 100, a reading above 70 is conventionally called overbought.",
    why: "The label is used as a note of caution that a rise has been unusually fast and may pause or pull back. It describes recent movement, and in a strong trend an indicator can stay in the overbought zone for a long time while the price keeps climbing.",
    example: {
      setup: "RSI compares the average gain with the average loss over a set number of periods, commonly 14; here the average gain is 3 and the average loss is 1.",
      steps: ["Ratio of gain to loss: 3 ÷ 1 = 3", "RSI = 100 − 100 ÷ (1 + 3)", "100 ÷ 4 = 25, so RSI = 100 − 25 = 75"],
      result: "A reading of 75 is above 70, so by convention the market is called overbought.",
    },
    mistake:
      "Overbought does not mean that the price is too high or that a fall is due. It says that recent gains have been large relative to recent losses, and nothing about what comes next.",
    diagramCaption:
      "An indicator line swings between an upper zone marked Overbought and a lower zone marked Oversold; pointing along it shows when the line enters the upper zone.",
    diagram: { kind: "oscillator", labels: ["Overbought", "Oversold"] },
    quiz: {
      question: "RSI reads 82 during a strong uptrend. What can be said with confidence?",
      options: [
        "A fall is about to begin",
        "The trend has ended",
        "The indicator can go no higher",
        "Recent gains have far outweighed recent losses",
      ],
      answer: 3,
      because: "RSI is built from the ratio of recent gains to recent losses, so a high reading states that and no more. It can stay high, or go higher, while the price continues to rise.",
    },
  },

  "overnight-position": {
    plain:
      "An overnight position is a trade still open when the trading day officially ends. In foreign exchange the day is conventionally taken to end at 5 pm New York time, and a position open at that moment is rolled over into the next day.",
    why: "At rollover the broker applies a swap: a charge or a credit based on the difference between the two currencies’ interest rates, adjusted by the broker. By a common convention three days of swap are applied on one day of the week, often Wednesday, to cover the weekend.",
    example: {
      setup: "A broker in this example charges a swap of 5 US dollars per standard lot per night, with the triple charge on Wednesday; a trader opens 2 lots on Monday and closes them on Friday before the rollover.",
      steps: [
        "Per night: 2 × 5 = 10 US dollars",
        "Rollovers passed: Monday, Tuesday, Wednesday and Thursday",
        "Nights charged: 1 + 1 + 3 + 1 = 6",
        "Total: 6 × 10 = 60 US dollars",
      ],
      result: "Holding the position for the week costs 60 US dollars in swap, however the price moved.",
    },
    mistake:
      "Opening and closing on the same calendar date does not always avoid swap. What counts is whether the position is open at the rollover time, which falls at a different local hour in each part of the world.",
    diagramCaption:
      "A loop of four stages: the trading day, the rollover time, the swap being applied and the next day; stepping round the loop shows the swap applied once each time the rollover is passed.",
    diagram: { kind: "cycle", labels: ["Trading day", "Rollover time", "Swap applied", "Next day"] },
    quiz: {
      question: "A position is opened ten minutes before the daily rollover and closed twenty minutes after it. Is swap applied?",
      options: [
        "No, because it was open for only half an hour",
        "Yes, because it was open at the rollover time",
        "Only if it shows a profit",
        "Only if it is larger than one lot",
      ],
      answer: 1,
      because: "Swap depends on being open at the rollover moment, not on how long the position was held. A trade open for half an hour across the rollover is treated as held overnight.",
    },
  },

  oversold: {
    plain:
      "Oversold is the mirror image of overbought: a label for a market that has fallen quickly and far by the measure of an indicator. With the relative strength index, or RSI, which runs from 0 to 100, a reading below 30 is conventionally called oversold.",
    why: "Chart readers use the label as a note that a fall has been unusually fast and may pause or bounce. In a persistent downtrend the indicator can remain in the oversold zone for a long time while the price continues lower.",
    example: {
      setup: "RSI compares the average gain with the average loss over a set number of periods, commonly 14; here the average gain is 1 and the average loss is 4.",
      steps: ["Ratio of gain to loss: 1 ÷ 4 = 0.25", "RSI = 100 − 100 ÷ (1 + 0.25)", "100 ÷ 1.25 = 80, so RSI = 100 − 80 = 20"],
      result: "A reading of 20 is below 30, so by convention the market is called oversold.",
    },
    mistake:
      "Oversold does not mean cheap. The reading describes the speed of the recent fall and says nothing about the value of what is being traded or about where the price goes next.",
    diagramCaption:
      "An indicator line swings between an upper zone marked Overbought and a lower zone marked Oversold; pointing along it shows when the line enters the lower zone.",
    diagram: { kind: "oscillator", labels: ["Overbought", "Oversold"] },
    quiz: {
      question: "An indicator has shown an oversold reading for two weeks while the price kept falling. What does this illustrate?",
      options: [
        "An oversold reading can persist in a downtrend",
        "The indicator has stopped working",
        "A rise of equal size must follow",
      ],
      answer: 0,
      because: "The reading reports that recent losses have outweighed recent gains, which stays true for as long as the fall continues. It sets no limit on how long that can last.",
    },
  },

  pair: {
    plain:
      "Currencies are always priced against one another, so they trade in pairs. In EUR/USD the first currency, the euro, is the base and the second, the dollar, is the quote: the price says how many units of the quote currency one unit of the base costs.",
    why: "Buying a pair means buying the base and selling the quote; selling the pair does the reverse. Profit and loss on a pair arise first in the quote currency and are then converted to the account’s currency if that is different.",
    example: {
      setup: "EUR/USD is quoted at 1.2000 and a trader exchanges 1,000 euros.",
      steps: [
        "One euro costs 1.2000 dollars",
        "1,000 euros × 1.2000 = 1,200 dollars",
        "Going the other way: 1,200 dollars ÷ 1.2000 = 1,000 euros",
      ],
      result: "At a price of 1.2000, 1,000 euros and 1,200 dollars are the same amount of money.",
    },
    mistake:
      "A rising pair does not mean that both currencies are strong. If EUR/USD rises, the euro has gained against the dollar, which is the same as the dollar losing against the euro.",
    diagramCaption:
      "Two currencies are bound together, the base on one side and the quote on the other; when the base rises against the quote, the pair’s price rises.",
    diagram: { kind: "pair", labels: ["Base", "Quote"] },
    quiz: {
      question: "The price of USD/JPY rises from 100 to 110. What has happened?",
      options: [
        "The yen has strengthened against the dollar",
        "Both currencies have strengthened",
        "The dollar has strengthened against the yen",
      ],
      answer: 2,
      because: "The price is the number of yen that one dollar costs. If a dollar now costs 110 yen where it cost 100, the dollar buys more yen and has strengthened.",
    },
  },

  "pending-order": {
    plain:
      "A pending order is an instruction that waits: it names a price, and it acts only if the market reaches that price. Limit orders wait for a better price than the current one and stop orders wait for a worse one, so a buy limit sits below the market and a buy stop above it, with sell orders the other way round.",
    why: "Pending orders let a trader set entries and exits in advance without watching the screen. A limit order fills at its price or better, while a stop order becomes a market order when triggered and may fill at a different price in a fast market or after a gap.",
    example: {
      setup: "The market is at 1.2000 and a trader places four pending orders.",
      steps: [
        "Buy limit at 1.1950 and sell stop at 1.1940: both below the market",
        "Sell limit at 1.2050 and buy stop at 1.2060: both above the market",
        "The price rises to 1.2050: the sell limit can fill, and the buy stop is still waiting 10 pips higher",
      ],
      result: "Only the order whose price has been reached acts; the other three stay pending until they are reached, cancelled or expire.",
    },
    mistake: "A buy stop and a buy limit are easily confused. Both buy, but the limit waits for a lower price and the stop waits for a higher one.",
    diagramCaption:
      "The current price sits between a buy stop resting above it and a buy limit resting below; moving the price to either level shows that order being triggered.",
    diagram: { kind: "levels", labels: ["Buy stop", "Current price", "Buy limit"] },
    quiz: {
      question: "The market is at 1.5000 and a trader wants to buy only if the price rises to 1.5100. Which pending order does that?",
      options: ["Buy limit", "Buy stop", "Sell limit", "Sell stop"],
      answer: 1,
      because: "A buy order placed above the current price is a buy stop. A buy limit would sit below the market and wait for the price to fall.",
    },
  },

  pip: {
    plain:
      "A pip is the standard unit for measuring a change in an exchange rate. For most pairs it is the fourth decimal place, 0.0001; for pairs quoted in Japanese yen it is the second, 0.01. Many platforms show one further digit, a tenth of a pip.",
    why: "Spreads, price moves, stop distances and results are all counted in pips, so the pip is the common unit that makes trades comparable. What a pip is worth in money depends on the size of the trade and on the quote currency.",
    example: {
      setup: "EUR/USD moves from 1.1000 to 1.1025 on a position of 0.5 standard lots.",
      steps: [
        "Move: 1.1025 − 1.1000 = 0.0025, or 25 pips",
        "Pip value: 0.0001 × 100,000 × 0.5 = 5 US dollars",
        "Result: 25 × 5 = 125 US dollars",
      ],
      result: "The 25-pip move is worth 125 US dollars on half a lot: a gain for a long position and a loss for a short one.",
    },
    mistake:
      "A pip is not worth the same on every pair. Its value arises in the quote currency, so one pip on a yen pair is 1,000 yen per standard lot, which must be converted before it can be compared with 10 dollars on a dollar-quoted pair.",
    diagramCaption:
      "A price moving between two levels one pip apart, 1.1000 and 1.1001.",
    diagram: { kind: "levels", labels: ["1.1001", "Price", "1.1000"] },
    quiz: {
      question: "A yen pair moves from 100.00 to 100.25. How many pips is that?",
      options: ["250", "2.5", "25", "2,500"],
      answer: 2,
      because: "On a yen pair one pip is 0.01. The move is 0.25, and 0.25 ÷ 0.01 = 25 pips.",
    },
  },

  "pivot-point": {
    plain:
      "A pivot point is a price level worked out from the previous period’s high, low and close, most often the previous day’s. In the classic method the pivot is the average of those three prices, and further levels above and below it, called resistance and support, are derived from it.",
    why: "Because the calculation is fixed and widely known, many short-term traders look at the same levels and use them as reference lines for the session. The price is under no obligation to stop or turn at them.",
    example: {
      setup: "Yesterday’s high was 1.2100, the low 1.2000 and the close 1.2080.",
      steps: [
        "Pivot: (1.2100 + 1.2000 + 1.2080) ÷ 3 = 3.6180 ÷ 3 = 1.2060",
        "First resistance: 2 × 1.2060 − 1.2000 = 1.2120",
        "First support: 2 × 1.2060 − 1.2100 = 1.2020",
      ],
      result: "Today’s reference levels are 1.2020, 1.2060 and 1.2120.",
    },
    mistake:
      "Pivot levels are sometimes treated as barriers in the market. They are arithmetic on yesterday’s prices, and there are several methods that give different levels from the same data.",
    diagramCaption:
      "A price line moves between the first resistance level above and the first support level below, with the pivot between them; pointing along the line shows where it approaches each level.",
    diagram: { kind: "band", labels: ["Resistance 1", "Support 1"], breaks: "none" },
    quiz: {
      question: "What information is needed to calculate a classic daily pivot point?",
      options: [
        "Today’s opening price only",
        "The average of the last 200 closes",
        "The current spread",
        "The previous day’s high, low and close",
      ],
      answer: 3,
      because: "The classic pivot is the previous day’s high, low and close added together and divided by three. Nothing from the current day enters the calculation.",
    },
  },

  "position-trading": {
    plain:
      "Position trading is a style in which trades are held for weeks, months or longer, with the aim of following a large, slow move. Decisions rest mainly on long-term trends and on economic fundamentals such as interest rates and growth, and day-to-day swings are tolerated.",
    why: "The long holding period changes which costs matter: the spread is paid once and is small relative to the move sought, while swap, the overnight financing amount, is charged or credited every night and accumulates. Stops are usually set far from the entry, so trade sizes have to be smaller for the same amount at risk.",
    example: {
      setup: "A position trader holds one standard lot for 60 nights; in this example the swap is a charge of 4 US dollars a night and the spread on entry was 2 pips.",
      steps: [
        "Spread cost: 2 × 10 = 20 US dollars, paid once",
        "Swap cost: 60 × 4 = 240 US dollars",
        "Total: 20 + 240 = 260 US dollars, which is 260 ÷ 10 = 26 pips",
      ],
      result: "Over the 60 nights the overnight charge is twelve times the spread, and the price must move 26 pips in the trader’s favour to cover the costs.",
    },
    mistake:
      "Holding for longer is not the same as taking less risk. A position held for months is exposed to every event in that time, including weekend gaps, and a distant stop on too large a size can lose a great deal.",
    diagramCaption:
      "Four bars compare typical holding times, from scalping, the shortest, to position trading, the longest; pointing at a bar picks it out for comparison.",
    diagram: { kind: "bars", labels: ["Scalping", "Day trading", "Swing trading", "Position trading"], sizes: [1, 2, 5, 10] },
    quiz: {
      question: "Which cost grows with the length of time a leveraged position is held?",
      options: ["Swap, applied each night the position is held", "The spread paid on entry", "The size of a pip"],
      answer: 0,
      because: "The spread is paid once, when the position is opened and closed. Swap is applied at every rollover, so it adds up with each night held.",
    },
  },

  "price-action": {
    plain:
      "Price action is the study of the price chart itself, without indicators laid over it. The reader looks at the size and shape of candles, at successive highs and lows, and at levels where the price has turned before, known as support and resistance.",
    why: "Price is the raw material every indicator is calculated from, so reading it directly shows changes without the delay an indicator adds. It involves judgement, and two people can look at the same chart and reach different conclusions.",
    example: {
      setup: "An invented price makes a series of swings.",
      steps: [
        "Highs: 1.1020, then 1.1050, then 1.1080, each higher than the last",
        "Lows: 1.1000, then 1.1030, then 1.1060, each higher than the last",
        "Next low: 1.1040, which is below the previous low of 1.1060",
      ],
      result: "Higher highs and higher lows are the usual description of an uptrend; the lower low is the first break in that sequence and is read as the trend weakening, not as proof that it has ended.",
    },
    mistake:
      "Working without indicators can seem more objective. Patterns and levels are drawn by eye, so price action is at least as open to seeing what one hopes to see.",
    diagramCaption:
      "A run of rising candles in which each high and each low is above the one before; a guide is ruled through the highs and another through the lows as the candles are added.",
    diagram: { kind: "candles", shape: "bullish-run", labels: ["Higher high", "Higher low"] },
    quiz: {
      question: "Which sequence is the usual price action description of an uptrend?",
      options: ["Lower highs and lower lows", "Equal highs and equal lows", "Higher highs and higher lows", "Higher highs and lower lows"],
      answer: 2,
      because: "In an uptrend each rise goes further than the last and each pullback stops higher than the last. Lower highs and lower lows describe a downtrend.",
    },
  },
};

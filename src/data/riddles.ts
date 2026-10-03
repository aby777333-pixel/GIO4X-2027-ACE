/**
 * The daily riddle: one a day, in rhyme, each answered by a glossary term.
 *
 * `a` is the answer and `o` two other terms offered beside it; all three are
 * glossary slugs. The riddle for a day is chosen by the date alone (the day's
 * number, counted in UTC), so everyone sees the same one and nothing is
 * fetched. A riddle describes what a term means and nothing else: no riddle
 * hints at what a market will do.
 */
export type Riddle = { q: readonly [string, string, string, string]; a: string; o: readonly [string, string] };

export const riddles: readonly Riddle[] = [
  { q: ["I sit between the buy and sell,", "a gap you pay, though none will tell.", "You cross me every time you trade:", "what am I, this toll that's paid?"], a: "spread", o: ["swap", "slippage"] },
  { q: ["Fourth decimal is where I dwell,", "the smallest step most quotes will tell.", "Alone I'm distance, nothing more:", "name me, and you know the score."], a: "pip", o: ["tick", "lot"] },
  { q: ["A little down, a lot controlled,", "I lift what's won and what is sold.", "The loss grows too, by the same degree:", "be careful when you call on me."], a: "leverage", o: ["margin", "equity"] },
  { q: ["I am not spent, I'm set aside,", "a stake held back while trades are live.", "Close the trade and I return,", "less whatever loss you earn."], a: "margin", o: ["swap", "spread"] },
  { q: ["Four prices in a single frame,", "a body and two wicks my claim.", "Open, high, low, close I show:", "from old rice markets, long ago."], a: "candlestick", o: ["pivot-point", "trend-line"] },
  { q: ["You set me where you'll say 'enough',", "I close the trade when things get rough.", "I cannot promise the price you chose", "if the market gaps before I close."], a: "stop-loss", o: ["take-profit", "limit-order"] },
  { q: ["You asked for one, you got another,", "a fill that differs from its brother.", "Fast markets are where I appear:", "what's my name, this gap austere?"], a: "slippage", o: ["requote", "spread"] },
  { q: ["Hold past the close and I arrive,", "an interest sum, to pay or thrive.", "Two rates differ, I'm what's due:", "nightly, I am charged to you."], a: "swap", o: ["margin", "spread"] },
  { q: ["From the peak down to the low,", "I measure how far balances go.", "The deeper I am, the harder the climb:", "what am I, this mark in time?"], a: "drawdown", o: ["volatility", "retracement"] },
  { q: ["I'm the size in which you deal,", "I set how big each pip will feel.", "Standard, mini, micro too:", "which word is it? Over to you."], a: "lot", o: ["pip", "tick"] },
  { q: ["Buyers gather where I stand,", "a floor that's drawn by eye and hand.", "Price falls to me and often stays:", "though floors can break on certain days."], a: "support", o: ["resistance", "trend-line"] },
  { q: ["Sellers wait along my line,", "a ceiling price has yet to climb.", "It rises to me, then turns back:", "until the day it breaks my rack."], a: "resistance", o: ["support", "pivot-point"] },
  { q: ["Name your price and wait in line,", "I fill at that, or better, in time.", "If price won't come, I never trade:", "what order am I, patiently made?"], a: "limit-order", o: ["market-order", "stop-order"] },
  { q: ["No waiting and no price to state,", "I trade at once at the going rate.", "Quick I am, though price may slide:", "name the order, don't be shy."], a: "market-order", o: ["limit-order", "pending-order"] },
  { q: ["How easily you buy or sell,", "is what my depth is there to tell.", "When I am thin the spreads grow wide:", "what's my name? You decide."], a: "liquidity", o: ["volatility", "volume"] },
  { q: ["I measure how the price is thrown,", "calm one day, the next windblown.", "High or low, I'm neither good nor bad:", "just the size of the swings you've had."], a: "volatility", o: ["momentum", "liquidity"] },
  { q: ["Borrow where the rate is low,", "hold where interest has more to show.", "The gap between is what I earn,", "till exchange rates take a turn."], a: "carry-trade", o: ["hedging", "arbitrage"] },
  { q: ["A second trade to blunt the first,", "I limit how bad is the worst.", "I cost a little, that is true:", "what is it that I do for you?"], a: "hedging", o: ["scalping", "carry-trade"] },
  { q: ["Prices rising, year on year,", "the same note buys less, I fear.", "Central banks watch me with care:", "what am I, in the air?"], a: "inflation", o: ["deflation", "recession"] },
  { q: ["I favour rates that rise, not fall,", "tight money is my rallying call.", "Opposite the gentle dove:", "which bird am I, circling above?"], a: "hawkish", o: ["dovish", "bear-market"] },
  { q: ["First Friday, half past eight,", "the jobs report that markets await.", "Three letters name this monthly test:", "which of these do you think best?"], a: "nfp", o: ["fomc", "gdp"] },
  { q: ["Balance plus what's open now,", "I change with every tick, and how.", "I am the truer sum to read:", "which word is it that you need?"], a: "equity", o: ["margin", "free-margin"] },
  { q: ["Equity thin, the margin tight,", "I am the warning in the night.", "Top up, or see positions go:", "what am I? You ought to know."], a: "margin-call", o: ["stop-out", "requote"] },
  { q: ["One price here, the next up there,", "between the two there's only air.", "Weekends and news are when I show:", "what's the word? Do you know?"], a: "gap", o: ["wick", "breakout"] },
  { q: ["I follow price when it goes your way,", "and hold my ground when it turns astray.", "A stop that moves, but never back:", "what am I, on this track?"], a: "trailing-stop", o: ["stop-loss", "take-profit"] },
  { q: ["What you may lose to what you may gain,", "two numbers that keep a plan in frame.", "One to two, or one to three:", "what do traders call me?"], a: "risk-reward-ratio", o: ["drawdown", "leverage"] },
  { q: ["Smooth the price across a span,", "I show the trend's rough plan.", "I always lag, I'm built that way:", "what am I, would you say?"], a: "moving-average", o: ["rsi", "bollinger-bands"] },
  { q: ["Seconds in and seconds out,", "small moves, many, are what I'm about.", "Costs weigh on me more than most:", "which style is it I boast?"], a: "scalping", o: ["swing-trading", "position-trading"] },
  { q: ["First in the pair, the one you price,", "the quote says what I cost, precise.", "In EUR/USD the euro's me:", "which currency would I be?"], a: "base-currency", o: ["quote-currency", "cross-rate"] },
  { q: ["Up, then down, then up again,", "I stop you out, then turn, and then", "the price goes where you thought it would:", "what am I? Misunderstood."], a: "whipsaw", o: ["pullback", "dead-cat-bounce"] },
  { q: ["Double the stake each time you lose,", "a method with a hidden fuse.", "One long run and the account is spent:", "which strategy is it that's meant?"], a: "martingale-strategy", o: ["carry-trade", "hedging"] },
];

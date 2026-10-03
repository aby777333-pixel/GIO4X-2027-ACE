/**
 * Fun@Finance: the material. Everything here was written for this page.
 *
 * The rule is the one the rhymes keep, with one addition. A joke may laugh at
 * the habits of traders, at jargon and at the market's indifference. It may
 * not promise a result, make light of losing money a person cannot afford,
 * tell anyone to trade, or be told at the expense of a real person or a named
 * firm. Nothing here is advice and the page says so.
 */

export const JOKES: readonly string[] = [
  "I told my stop-loss a joke. It got triggered.",
  "A pip walks into a bar. Nobody notices. Then a hundred thousand of them walk in together.",
  "I’m not saying the spread was wide, but my order needed a passport to cross it.",
  "The market can stay irrational longer than I can stay off my phone.",
  "I diversified. Now I am confused in six currencies.",
  "My demo account and I have a wonderful relationship. No commitment, no consequences, no lessons.",
  "Leverage is like hot sauce. The bottle says “a little”. Nobody reads the bottle.",
  "I asked the chart what it wanted. It drew a triangle and left.",
  "Support and resistance: also what I got from my family when I said I was learning to trade.",
  "Technical analysis is the art of drawing a line through the points that agree with you.",
  "Swap is the fee for not going to bed.",
  "I have a rule: never trade the news. I have a second rule for when I break the first.",
  "Patience is a position. It has no spread.",
  "The candle closed. So did my laptop. One of us was calm about it.",
  "My stop was so tight it filed a complaint.",
  "A bull and a bear agree on one thing: the other one is early.",
  "I backtested my patience. Insufficient data.",
  "Slippage: when the price you wanted and the price you got agree to see other people.",
  "The trend is your friend. Mine hasn’t called in weeks.",
  "I keep a trading diary. Mostly it says “see yesterday”.",
  "A margin call is the only phone call that opens with your account’s opinion of you.",
  "The economic calendar is the only calendar where a Friday can ruin a Monday.",
  "A sideways market is a chart that also can’t decide what to have for lunch.",
  "Overtrading is cardio for the mouse finger.",
  "My favourite indicator is the one I added last. It agrees with me so far.",
  "They say cut your losses short. I gave mine a fringe.",
  "I zoomed out for comfort and zoomed in for hope. The chart was the same chart.",
  "Hindsight is the only analyst with a perfect record, and it never publishes in time.",
  "I set a price alert so I could ignore the chart. I now ignore the alert as well.",
  "My trading plan has three steps. Step one is not skipping steps two and three.",
  "The bid and the ask walked into a bar. They never did meet in the middle.",
  "I wanted a second opinion, so I added a second indicator. They are not speaking.",
];

export const RIDDLES: readonly { q: string; a: string }[] = [
  { q: "I go up, I go down, and I never leave my chair. What am I?", a: "A trader’s mood." },
  { q: "The harder you stare at me, the slower I move. What am I?", a: "A candle about to close." },
  { q: "I cost nothing until you keep me past bedtime. What am I?", a: "A swap." },
  { q: "I am two prices pretending to be one. What am I?", a: "A quote: the bid and the ask." },
  { q: "Everyone has me before the trade. Few can find me after it. What am I?", a: "The plan." },
  { q: "I am always right, and always late. What am I?", a: "Hindsight." },
  { q: "Turn me up and everything gets louder: the gains, the losses and your heartbeat. What am I?", a: "Leverage." },
  { q: "Every chart points at me. None of them contains me. What am I?", a: "Tomorrow." },
  { q: "I am the smallest thing on the screen and the first thing in every sum. What am I?", a: "A pip." },
  { q: "You place me hoping never to meet me. What am I?", a: "A stop-loss." },
];

export const LIMERICKS: readonly (readonly string[])[] = [
  ["A trader who swore by a line", "drew twelve of them, each a design;", "the price wandered through", "all twelve, as prices do,", "and he said, “Well, the thirteenth is fine.”"],
  ["A bear with a permanent frown", "said, “Everything’s bound to go down.”", "He was right, in the end,", "on one day out of ten,", "and he tells it all over the town."],
  ["A scalper who lived on caffeine", "took forty-two trades off one screen;", "the total, he found,", "once the costs came around,", "was the same as if he’d never been."],
  ["A novice whose leverage was high", "watched a one per cent wobble go by;", "it was small on the chart,", "but it took him apart,", "and the chart never told him goodbye."],
  ["A lady who journalled each trade", "found the same three mistakes that she made;", "she wrote them out plain,", "didn’t make them again,", "and it’s not a good joke, I’m afraid."],
  ["There once was a chart so serene", "that it moved not a pip on the screen;", "three traders, in fright,", "watched it all through the night,", "and it did the same thing: nothing. Clean."],
];

export const DICTIONARY: readonly { word: string; means: string }[] = [
  { word: "Bull", means: "Someone who thinks it is going up and would like you to agree, loudly." },
  { word: "Bear", means: "Someone who thinks it is going down and has thought so for years." },
  { word: "Breakout", means: "The moment a price leaves its range, usually to fetch something and come back." },
  { word: "Consolidation", means: "A chart’s way of saying “typing…”." },
  { word: "Dip", means: "A fall you approve of." },
  { word: "Correction", means: "A fall you do not." },
  { word: "Indicator", means: "A second opinion, from the same data." },
  { word: "Demo account", means: "The place where everyone is a genius." },
  { word: "Stop-loss", means: "The adult in the room." },
  { word: "Pip", means: "Small, until multiplied." },
  { word: "Volatility", means: "What you asked for, in a quantity you did not." },
  { word: "Overnight position", means: "A house guest that keeps a tab." },
  { word: "Risk-reward ratio", means: "A promise you make to yourself, in fractions." },
  { word: "Hindsight", means: "The only strategy with a perfect record." },
  { word: "Economic calendar", means: "A list of times to be somewhere else." },
  { word: "Spread", means: "The cover charge." },
  { word: "Sideways", means: "The market’s hold music." },
  { word: "Trading journal", means: "A book in which the villain is always the author." },
];

/** the excuse machine: one from each column */
export const EXCUSES = {
  who: ["The chart", "My indicator", "The cat", "The Wi-Fi", "A single candle", "My other monitor", "The coffee", "Mercury"],
  did: ["walked across the keyboard", "repainted when I blinked", "lagged at exactly the wrong second", "gave a signal out of spite", "closed one pip early", "was in retrograde", "went cold at the critical moment", "froze, in solidarity with me"],
  so: ["so, technically, it wasn’t my trade.", "and the plan was perfect otherwise.", "which nobody could have foreseen. Except the plan.", "and that is why there was no stop.", "so I have added another indicator.", "and I would do it all again, apparently."],
} as const;

export const BINGO: readonly string[] = [
  "“It’s only a pullback”",
  "Moved the stop, just a little",
  "One more trade",
  "Added an indicator",
  "Zoomed out for comfort",
  "Checked the phone in bed",
  "Forgot the news was due",
  "“This time is different”",
  "Blamed the wick",
  "Closed at the exact low",
  "Skipped the journal",
  "Traded out of boredom",
  "FREE: no trade today",
  "Zoomed in for hope",
  "Doubled the size to get it back",
  "“It’s a long-term position now”",
  "Changed the plan mid-trade",
  "Watched one candle for an hour",
  "Blamed the spread",
  "Told someone about the one win",
  "Drew a line that fitted",
  "Set an alert, ignored it",
  "Entered early, “to be safe”",
  "Refreshed the calendar",
  "Said “never again”. Again.",
];

/* ---- the comics --------------------------------------------------------------
   Three characters: the Bull (green, horns, sure of himself), the Bear (gold,
   round ears, sure of the opposite) and Wick, a candle who has seen it all.
   A strip is three panels. A panel names who is in it, how each looks, what
   is on the screen behind them and what is said. */
export type Who = "bull" | "bear" | "wick";
export type Mood = "happy" | "smug" | "worried" | "shock" | "flat";
export type Screen = "up" | "down" | "flat" | "clock" | "none";
export type Panel = { cast: readonly { who: Who; mood: Mood }[]; screen: Screen; says: readonly { by: Who; text: string }[] };
export type Strip = { title: string; panels: readonly [Panel, Panel, Panel] };

export const STRIPS: readonly Strip[] = [
  {
    title: "The plan",
    panels: [
      { cast: [{ who: "bull", mood: "smug" }, { who: "bear", mood: "flat" }], screen: "flat", says: [{ by: "bull", text: "I have a plan. Entry, stop, target. All written down." }] },
      { cast: [{ who: "bull", mood: "worried" }, { who: "bear", mood: "flat" }], screen: "down", says: [{ by: "bull", text: "It moved two pips against me." }] },
      { cast: [{ who: "bull", mood: "happy" }, { who: "bear", mood: "smug" }], screen: "down", says: [{ by: "bull", text: "New plan." }, { by: "bear", text: "That was eleven seconds." }] },
    ],
  },
  {
    title: "Diversified",
    panels: [
      { cast: [{ who: "bear", mood: "flat" }, { who: "bull", mood: "smug" }], screen: "up", says: [{ by: "bear", text: "Are you diversified?" }, { by: "bull", text: "Very. I’m in five positions." }] },
      { cast: [{ who: "bear", mood: "worried" }, { who: "bull", mood: "happy" }], screen: "up", says: [{ by: "bear", text: "Which five?" }] },
      { cast: [{ who: "bear", mood: "shock" }, { who: "bull", mood: "happy" }], screen: "up", says: [{ by: "bull", text: "The same currency. Five ways." }] },
    ],
  },
  {
    title: "The mental stop",
    panels: [
      { cast: [{ who: "wick", mood: "flat" }, { who: "bull", mood: "smug" }], screen: "flat", says: [{ by: "wick", text: "Where is your stop?" }, { by: "bull", text: "It’s a mental stop." }] },
      { cast: [{ who: "wick", mood: "flat" }, { who: "bull", mood: "shock" }], screen: "down", says: [{ by: "bull", text: "…" }] },
      { cast: [{ who: "wick", mood: "smug" }, { who: "bull", mood: "worried" }], screen: "down", says: [{ by: "wick", text: "And how is your mental?" }, { by: "bull", text: "Also stopped." }] },
    ],
  },
  {
    title: "Patience",
    panels: [
      { cast: [{ who: "bear", mood: "smug" }, { who: "wick", mood: "flat" }], screen: "flat", says: [{ by: "bear", text: "I am waiting for my setup. That is discipline." }] },
      { cast: [{ who: "bear", mood: "smug" }, { who: "wick", mood: "flat" }], screen: "clock", says: [{ by: "bear", text: "Still waiting. Still disciplined." }] },
      { cast: [{ who: "bear", mood: "shock" }, { who: "wick", mood: "smug" }], screen: "up", says: [{ by: "wick", text: "It came and went while you were telling me about the waiting." }] },
    ],
  },
  {
    title: "The decision",
    panels: [
      { cast: [{ who: "bull", mood: "happy" }, { who: "bear", mood: "happy" }], screen: "clock", says: [{ by: "bull", text: "Rate decision in one minute. I am ready for anything." }] },
      { cast: [{ who: "bull", mood: "flat" }, { who: "bear", mood: "flat" }], screen: "flat", says: [{ by: "bear", text: "Unchanged. As expected." }] },
      { cast: [{ who: "bull", mood: "worried" }, { who: "bear", mood: "smug" }], screen: "flat", says: [{ by: "bull", text: "I was not ready for nothing." }] },
    ],
  },
  {
    title: "The backtest",
    panels: [
      { cast: [{ who: "bull", mood: "smug" }, { who: "wick", mood: "flat" }], screen: "up", says: [{ by: "bull", text: "My system has never lost." }] },
      { cast: [{ who: "bull", mood: "smug" }, { who: "wick", mood: "flat" }], screen: "up", says: [{ by: "wick", text: "On data it had already seen?" }] },
      { cast: [{ who: "bull", mood: "worried" }, { who: "wick", mood: "smug" }], screen: "flat", says: [{ by: "bull", text: "It is very fond of that data." }] },
    ],
  },
];

/** single drawings with one line beneath */
export const CARTOONS: readonly { cast: Panel["cast"]; screen: Screen; caption: string }[] = [
  { cast: [{ who: "wick", mood: "worried" }, { who: "bear", mood: "flat" }], screen: "none", caption: "“I just feel that people only notice me when I’m red.”" },
  { cast: [{ who: "bull", mood: "happy" }, { who: "bear", mood: "happy" }], screen: "flat", caption: "The one hour a week on which they agree: the market is closed." },
  { cast: [{ who: "bull", mood: "shock" }], screen: "clock", caption: "He had set an alarm for the release. He had not set one for the time zone." },
  { cast: [{ who: "bear", mood: "smug" }, { who: "wick", mood: "flat" }], screen: "down", caption: "“I called it.” “You have called it every day since we met.”" },
];

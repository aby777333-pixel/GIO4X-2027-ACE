/**
 * One line to remember per section of the site, in two halves that rhyme.
 *
 * A punch line is a memory hook about care, cost or method. It is never a
 * promise and never advice: nothing here says a trade will pay, that a loss
 * is unlikely, or that anyone should trade.
 */
export const punchLines = {
  home: { a: "No plan, no trade:", b: "that's how fortunes fade." },
  markets: { a: "Many markets, one clear view:", b: "know what moves before you do." },
  trading: { a: "Mind the spread", b: "before you tread." },
  conditions: { a: "Read the terms", b: "before the turns." },
  funding: { a: "Money in, money out:", b: "know the route, remove the doubt." },
  platforms: { a: "Know your screen", b: "before the scene." },
  intelligence: { a: "Read the chart,", b: "then play your part." },
  academy: { a: "Learn it slow,", b: "then let it show." },
  glossary: { a: "Name the thing", b: "and lose the sting." },
  tools: { a: "Size it right,", b: "sleep at night." },
  labs: { a: "Try it here,", b: "where nothing's dear." },
  trust: { a: "Don't take our word:", b: "check what you've heard." },
  company: { a: "Said in the open,", b: "kept as spoken." },
  partners: { a: "Refer with care:", b: "be clear, be fair." },
  support: { a: "Stuck or unsure?", b: "Ask: that's what we're for." },
  risk: { a: "Leverage lifts, and leverage drops;", b: "the careful trader sets the stops." },
} as const;

export type PunchKey = keyof typeof punchLines;

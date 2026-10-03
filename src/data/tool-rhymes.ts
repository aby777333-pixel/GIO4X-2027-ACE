/**
 * A couplet for each tool in the Trader Toolkit, shown under its heading.
 * A way to remember what the tool is for; never a promise and never advice.
 */
export const toolRhymes: Record<string, readonly [string, string]> = {
  "position-size": ["From the stop and from the stake,", "comes the size that you should take."],
  "pip-value": ["Know the pip", "before the dip."],
  margin: ["Not a fee, but funds set by:", "held for as long as the trade is live."],
  "profit-loss": ["Count the gain and count the cost:", "know what's won and what is lost."],
  "risk-reward": ["What you risk for what you seek:", "keep the ratio from growing weak."],
  drawdown: ["The deeper the fall,", "the taller the wall."],
  "compound-growth": ["Small on small, in time, grows tall:", "and so do losses, after all."],
  "currency-converter": ["Change the sum from this to that:", "a reference rate, and that is that."],
  "cost-lab": ["Spread and swap and fee:", "add them up before you agree."],
  "leverage-visualizer": ["Leverage lifts, and leverage drops:", "see how near the margin stops."],
  "spread-visualizer": ["Mind the spread", "before you tread."],
  "order-anatomy": ["Entry, stop and target, three:", "an order's whole anatomy."],
};

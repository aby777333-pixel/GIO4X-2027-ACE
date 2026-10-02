/**
 * Screenshots supplied by the owner. Each one is a capture of a DEMO account:
 * every price, position, percentage and headline inside it is whatever the
 * demo showed at that moment. `alt` describes what is on the screen; nothing
 * here states what a feature does, because that documentation is not published
 * yet (see `raptorPending` in `platforms.ts`).
 *
 * Files live in `public/platforms/` as `<id>-<width>.webp` and `.jpg`.
 */
export type PlatformShot = {
  id: string;
  /** intrinsic size of the largest file */
  width: number;
  height: number;
  /** widths available, smallest first */
  widths: [number, number];
  alt: string;
};

export const shots = {
  raptorWorkspace: {
    id: "raptor-workspace",
    width: 1600,
    height: 840,
    widths: [800, 1600],
    alt: "Screenshot of the 777 Raptor workspace on a demo account: a watchlist on the left, a candlestick chart with two moving averages in the centre, a tools and news column on the right, and the order desk along the bottom.",
  },
  raptorEmil: {
    id: "raptor-emil",
    width: 1504,
    height: 1188,
    widths: [800, 1504],
    alt: "Screenshot of the panel named EMIL inside 777 Raptor, on a demo account, in its observing mode: a text box for instructions above a grid of status tiles.",
  },
  raptorHedge: {
    id: "raptor-hedge-engine",
    width: 1600,
    height: 1085,
    widths: [800, 1600],
    alt: "Screenshot of the correlation hedging panel inside 777 Raptor, on a demo account: a command bar, a notice that no reliable hedge is available for the selected pair, and a list of currency-pair relationships.",
  },
  mt5Terminal: {
    id: "mt5-terminal",
    width: 1600,
    height: 1042,
    widths: [800, 1600],
    alt: "Screenshot of the MetaTrader 5 desktop terminal on a MetaQuotes demo account: Market Watch and Navigator on the left, four chart windows, and the Toolbox with open positions along the bottom.",
  },
  mt5Order: {
    id: "mt5-order-depth",
    width: 1600,
    height: 849,
    widths: [800, 1600],
    alt: "Screenshot of MetaTrader 5 on a MetaQuotes demo account showing the Depth of Market ladder, the order window set to a pending order, and the account history tab.",
  },
} satisfies Record<string, PlatformShot>;

/** One sentence that travels with every group of screenshots. */
export const shotsNote =
  "Screenshots of demo accounts. The prices, positions, percentages and headlines inside them are what the demo showed when it was captured: not live data, not results, and not a recommendation to trade. Names and marks of other companies visible in them belong to their owners.";

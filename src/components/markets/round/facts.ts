import type { AssetClass, AssetClassKey, Instrument } from "@/data/instruments";

/**
 * The facts pinned to each asset class's object in "in the round".
 *
 * Every fact is something this site already says about the class. Each one
 * carries, in a comment, the field of `src/data/instruments.ts` (or the
 * sentence of the class page) it was taken from, so a reviewer can check it.
 * Where the field can be used word for word it is read from the data rather
 * than retyped, and a fact that depends on the instruments listed is only
 * shown while the data still supports it.
 *
 * There are no prices here and nothing that could be read as live data. The
 * worked example in the forex summary ("EUR/USD at 1.1000") is deliberately
 * left out: on an object it would read as a quote.
 */

export type Fact = {
  /** the name of the point on the object this fact is pinned to (objects.ts) */
  at: string;
  title: string;
  text: string;
  /** a short list under the text, where the fact is a list */
  items?: string[];
};

/** "Hours", word for word. Source: `AssetClass.hours`, as shown under "Hours" on the class page. */
const hours = (cls: AssetClass, at: string): Fact => ({ at, title: "Hours", text: cls.hours });

/**
 * The page's own "Commonly monitored" list.
 * Source: `AssetClass.drivers`; the sentence is the one printed under that list on the class page.
 */
const monitored = (cls: AssetClass, at: string): Fact => ({
  at,
  title: "Commonly monitored",
  text: "Factors market participants commonly follow for this asset class. A description of practice, not a view on where prices will go.",
  items: cls.drivers,
});

const LOT = "1 standard lot = ";

const BUILD: Record<AssetClassKey, (cls: AssetClass, list: Instrument[]) => (Fact | null)[]> = {
  forex: (cls, list) => [
    {
      at: "base",
      title: "The base currency",
      // Source: forex `summary`: "Every quote is a pair: the base currency is priced in units of the quote currency".
      text: "Every quote is a pair. The base currency is the one being priced.",
    },
    {
      at: "quote",
      title: "The quote currency",
      // Source: forex `summary` (as above), and `spreadUnit: "pips"` (the instruments section: "Spreads are quoted in pips and are minimums").
      text: `The base currency is priced in units of the quote currency. Spreads on this page are quoted in ${cls.spreadUnit} and are minimums.`,
    },
    // Source: `Instrument.contract` of every forex pair: "1 standard lot = 100,000 <base>". Shown only while every pair still says so.
    list.length > 0 && list.every((i) => i.contract === `${LOT}100,000 ${i.base}`)
      ? { at: "axle", title: "One standard lot", text: "On every pair listed here, one standard lot is 100,000 units of the base currency." }
      : null,
    {
      at: "base-rim",
      title: "Traded on margin",
      // Source: forex `structure`: "Forex at GIO4X is traded as a margined product: you post a fraction of the position’s notional
      // value as margin and your profit or loss is the change in the pair’s price multiplied by position size."
      text: "Forex at GIO4X is a margined product: you post a fraction of the position’s notional value as margin. Your profit or loss is the change in the pair’s price multiplied by position size.",
    },
    hours(cls, "quote-rim"),
    monitored(cls, "axle-back"),
  ],

  metals: (cls, list) => {
    // Source: `Instrument.contract` of XAU/USD ("1 standard lot = 100 troy ounces") and XAG/USD ("1 standard lot = 5,000 troy ounces").
    // Platinum and palladium state no lot size ("Quoted in US dollars per troy ounce"), so none is given for them.
    const lots = list.filter((i) => i.contract.startsWith(LOT)).map((i) => `${i.name.split(" / ")[0]}: ${i.contract}`);
    return [
      {
        at: "hallmark",
        title: "Priced by the troy ounce",
        // Source: metals `summary`: "Precious metals are priced per troy ounce in US dollars."
        text: "Precious metals are priced per troy ounce in US dollars.",
      },
      {
        at: "front",
        title: "Quoted as a pair",
        // Source: metals `structure`, word for word.
        text: cls.structure,
      },
      lots.length > 0 ? { at: "end", title: "One standard lot", text: "What one standard lot represents, where this site states it.", items: lots } : null,
      {
        at: "back",
        title: "What is listed",
        // Source: metals `line`, word for word.
        text: cls.line,
      },
      hours(cls, "far-end"),
      monitored(cls, "corner"),
    ];
  },

  indices: (cls, list) => [
    {
      at: "top",
      title: "A basket in one instrument",
      // Source: indices `summary`, word for word.
      text: cls.summary,
    },
    {
      at: "block-2",
      title: "A contract, not the shares",
      // Source: indices `structure`: "Indices are traded as contracts for difference (CFDs): you do not own the underlying shares, ..."
      text: "Indices are traded as contracts for difference (CFDs): you do not own the underlying shares.",
    },
    {
      at: "block-4",
      title: "Quoted in index points",
      // Source: `Instrument.contract` of every index ("Index CFD, quoted in index points"), `spreadUnit: "points"`, and indices
      // `structure`: "... your result is the change in the index level multiplied by your position size."
      text: "Each index CFD is quoted in index points. Your result is the change in the index level multiplied by your position size.",
    },
    {
      at: "block-1",
      title: "What is listed",
      // Source: indices `line`, word for word, and the `symbol` of each instrument in the list below.
      text: `${cls.line} On this page: ${list.map((i) => i.symbol).join(", ")}.`,
    },
    hours(cls, "block-3"),
    monitored(cls, "block-5"),
  ],

  energy: (cls, list) => {
    // Source: `Instrument.contract` of each energy instrument: "CFD, quoted in US dollars per barrel" (Brent, WTI),
    // "CFD, quoted in US dollars per MMBtu" (natural gas).
    const quoted = list.map((i) => `${i.name}: ${i.contract.replace(/^CFD, q/, "q")}`);
    return [
      {
        at: "lid",
        title: "Two crude benchmarks",
        // Source: energy `summary`: "Brent is the reference for seaborne crude; WTI is the US benchmark delivered at Cushing, Oklahoma."
        text: "Brent is the reference for seaborne crude; WTI is the US benchmark delivered at Cushing, Oklahoma.",
      },
      { at: "body", title: "How each is quoted", text: "The unit each contract is quoted in.", items: quoted },
      {
        at: "upper",
        title: "A contract on margin",
        // Source: energy `structure`: "Energy is traded as CFDs on margin."
        text: "Energy is traded as CFDs on margin.",
      },
      {
        at: "hoop",
        title: "Financing and rollover",
        // Source: energy `structure`: "Positions held overnight may incur financing, and contracts may be subject to rollover."
        text: "Positions held overnight may incur financing, and contracts may be subject to rollover.",
      },
      hours(cls, "body-back"),
      monitored(cls, "lower"),
    ];
  },

  equities: (cls, list) => [
    {
      at: "share",
      title: "A share",
      // Source: equities `summary`: "A share represents ownership in a company."
      text: "A share represents ownership in a company.",
    },
    {
      at: "cfd",
      title: "Its mirror, the share CFD",
      // Source: equities `summary`: "A share CFD mirrors the share price without conferring ownership, voting rights or delivery of the stock."
      text: "A share CFD mirrors the share price without conferring ownership, voting rights or delivery of the stock.",
    },
    // Source: `Instrument.contract` of every share CFD: "Share CFD, 1 lot = 1 share". Shown only while every one still says so.
    list.length > 0 && list.every((i) => i.contract === "Share CFD, 1 lot = 1 share")
      ? { at: "share-back", title: "One lot is one share", text: "On every share CFD listed here, one lot is one share." }
      : null,
    {
      at: "glass",
      title: "Corporate actions",
      // Source: equities `structure`: "Corporate actions such as dividends and splits are reflected as adjustments to open positions."
      text: "Corporate actions such as dividends and splits are reflected as adjustments to open positions.",
    },
    hours(cls, "cfd-back"),
    monitored(cls, "share-edge"),
  ],

  crypto: (cls, list) => [
    {
      at: "first-top",
      title: "A public record",
      // Source: crypto `summary`: "Cryptocurrencies are digital assets recorded on public blockchains."
      text: "Cryptocurrencies are digital assets recorded on public blockchains.",
    },
    {
      at: "middle-front",
      title: "Exposure, not coins",
      // Source: crypto `structure`, word for word.
      text: cls.structure,
    },
    // Source: crypto `line` ("Major digital assets, quoted against the US dollar.") and `Instrument.contract` of each:
    // "CFD, quoted in US dollars per <asset>". Shown only while every one is still quoted that way.
    list.length > 0 && list.every((i) => i.contract === `CFD, quoted in US dollars per ${i.base}`)
      ? { at: "last-top", title: "Quoted in US dollars", text: `Each is a CFD quoted in US dollars per unit of the asset. On this page: ${list.map((i) => i.base).join(", ")}.` }
      : null,
    {
      at: "last-front",
      title: "Sharp moves at any hour",
      // Source: crypto `summary`: "Their prices are among the most volatile of any market and can move sharply at any hour, including weekends."
      text: "Their prices are among the most volatile of any market and can move sharply at any hour, including weekends.",
    },
    hours(cls, "middle-back"),
    monitored(cls, "first-back"),
  ],
};

/** The facts for one class, in pin order. */
export function factsFor(cls: AssetClass, list: Instrument[]): Fact[] {
  return BUILD[cls.key](cls, list).filter((f): f is Fact => f !== null);
}

/** What the object is, in one sentence: the picture's text equivalent and its caption. */
export const OBJECT: Record<AssetClassKey, string> = {
  forex: "Two coins on one axle: the base currency and the quote currency.",
  metals: "A cast bar with a hallmark panel on its top face.",
  indices: "Blocks of different sizes stacked on one axis: a basket of shares as one body.",
  energy: "A steel barrel with its hoops.",
  equities: "A share certificate, a pane of glass, and the certificate’s outline on the other side of it.",
  crypto: "Three blocks joined in a chain that continues at both ends.",
};

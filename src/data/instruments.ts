/**
 * Instrument and asset-class metadata.
 *
 * `conditions` are the indicative trading conditions GIO4X published on its
 * previous website (lib/constants.ts in GIO4X-NEW). They are carried over
 * unchanged, always displayed as INDICATIVE, and are flagged for owner
 * confirmation in docs/WAITING-FOR-ABE.md. Nothing in this file is a price.
 */

export type AssetClassKey = "forex" | "metals" | "indices" | "energy" | "equities" | "crypto";

export type AssetClass = {
  key: AssetClassKey;
  name: string;
  /** one-line positioning, factual */
  line: string;
  /** what the market is, in plain language */
  summary: string;
  /** how the product is structured at GIO4X */
  structure: string;
  /** what typically matters to this market: explanatory, never predictive */
  drivers: string[];
  /** typical trading schedule, described rather than promised */
  hours: string;
  /** subtle personality: which token tints this class */
  tone: "brand" | "prestige" | "teal" | "night" | "emerald" | "accent";
  /** unit used to quote the indicative spread */
  spreadUnit: string;
  related: { glossary: string[]; tools: string[]; events: string[] };
};

export const assetClasses: AssetClass[] = [
  {
    key: "forex",
    name: "Forex",
    line: "Currency pairs, quoted around the clock from Monday morning in Sydney to Friday evening in New York.",
    summary:
      "Foreign exchange is the market in which one currency is exchanged for another. Every quote is a pair: the base currency is priced in units of the quote currency, so EUR/USD at 1.1000 means one euro costs 1.10 US dollars.",
    structure:
      "Forex at GIO4X is traded as a margined product: you post a fraction of the position’s notional value as margin and your profit or loss is the change in the pair’s price multiplied by position size.",
    drivers: [
      "Interest-rate differentials and central bank policy",
      "Inflation, employment and growth releases",
      "Risk appetite and capital flows",
      "Session liquidity: the London–New York overlap is typically the most active window",
    ],
    hours: "Continuous, 24 hours a day, five days a week. Liquidity varies by session.",
    tone: "brand",
    spreadUnit: "pips",
    related: { glossary: ["pip", "spread", "leverage", "margin", "swap"], tools: ["pip-value", "position-size", "margin", "currency-converter"], events: ["interest-rate-decision", "cpi", "non-farm-payrolls"] },
  },
  {
    key: "metals",
    name: "Metals",
    line: "Gold, silver, platinum and palladium, quoted against the US dollar.",
    summary:
      "Precious metals are priced per troy ounce in US dollars. Gold in particular is watched as a store of value and as a reflection of real interest rates and the strength of the dollar.",
    structure: "Spot metals are quoted as pairs (XAU/USD is gold in US dollars) and traded on margin, like a currency pair.",
    drivers: [
      "Real yields and expectations for interest rates",
      "The US dollar",
      "Inflation expectations",
      "Demand for defensive assets in periods of stress",
    ],
    hours: "Close to 24 hours a day on weekdays, with a short daily break.",
    tone: "prestige",
    spreadUnit: "USD",
    related: { glossary: ["spread", "margin", "volatility", "hedging"], tools: ["margin", "position-size", "risk-reward"], events: ["cpi", "interest-rate-decision"] },
  },
  {
    key: "indices",
    name: "Indices",
    line: "Benchmark equity indices from the United States, Europe and Asia.",
    summary:
      "A stock index measures a basket of shares. Trading an index gives exposure to a whole market in a single instrument rather than to one company.",
    structure: "Indices are traded as contracts for difference (CFDs): you do not own the underlying shares, and your result is the change in the index level multiplied by your position size.",
    drivers: ["Corporate earnings", "Interest rates and bond yields", "Economic growth data", "The opening and closing auctions of the underlying exchange"],
    hours: "Follows the underlying futures and cash sessions. Activity concentrates around each exchange’s regular hours.",
    tone: "teal",
    spreadUnit: "points",
    related: { glossary: ["cfd", "index", "volatility", "margin"], tools: ["margin", "profit-loss", "risk-reward"], events: ["gdp", "pmi", "interest-rate-decision"] },
  },
  {
    key: "energy",
    name: "Energy",
    line: "Brent and WTI crude oil, and natural gas.",
    summary:
      "Energy contracts track the price of crude oil benchmarks and natural gas. Brent is the reference for seaborne crude; WTI is the US benchmark delivered at Cushing, Oklahoma.",
    structure: "Energy is traded as CFDs on margin. Positions held overnight may incur financing, and contracts may be subject to rollover.",
    drivers: ["Supply decisions by producers", "Inventory reports", "Global growth and industrial demand", "Geopolitics and weather"],
    hours: "Nearly 24 hours a day on weekdays, with a daily maintenance break.",
    tone: "night",
    spreadUnit: "USD",
    related: { glossary: ["cfd", "rollover", "volatility", "margin"], tools: ["margin", "profit-loss", "cost-lab"], events: ["gdp", "pmi"] },
  },
  {
    key: "equities",
    name: "Equities",
    line: "Share CFDs on widely followed US companies.",
    summary:
      "A share represents ownership in a company. A share CFD mirrors the share price without conferring ownership, voting rights or delivery of the stock.",
    structure: "Equities at GIO4X are traded as CFDs. Corporate actions such as dividends and splits are reflected as adjustments to open positions.",
    drivers: ["Company earnings and guidance", "Sector trends", "Interest rates", "Broad market sentiment"],
    hours: "Regular hours of the listing exchange. US shares trade 09:30–16:00 New York time.",
    tone: "accent",
    spreadUnit: "USD",
    related: { glossary: ["cfd", "dividend", "volatility", "margin"], tools: ["margin", "profit-loss", "position-size"], events: ["gdp", "non-farm-payrolls"] },
  },
  {
    key: "crypto",
    name: "Crypto",
    line: "Major digital assets, quoted against the US dollar.",
    summary:
      "Cryptocurrencies are digital assets recorded on public blockchains. Their prices are among the most volatile of any market and can move sharply at any hour, including weekends.",
    structure: "Crypto at GIO4X is traded as CFDs: you take exposure to the price without holding the underlying coins or a wallet.",
    drivers: ["Market liquidity and risk appetite", "Regulatory developments", "Network events", "Interest rates and the US dollar"],
    hours: "Underlying markets trade every day. Availability on the platform may include scheduled breaks.",
    tone: "emerald",
    spreadUnit: "USD",
    related: { glossary: ["cfd", "volatility", "leverage", "slippage"], tools: ["margin", "position-size", "drawdown"], events: ["interest-rate-decision", "cpi"] },
  },
];

export type Instrument = {
  /** URL slug, e.g. "eur-usd" */
  slug: string;
  /** display symbol, e.g. "EUR/USD" */
  symbol: string;
  /** platform symbol, e.g. "EURUSD" */
  code: string;
  name: string;
  class: AssetClassKey;
  /** search aliases */
  aliases: string[];
  /** base / quote ISO codes when the instrument is a pair */
  base?: string;
  quote?: string;
  /** indicative conditions as previously published */
  conditions: { spreadFrom: string; leverage: string; minLot: string };
  /** contract description */
  contract: string;
  /** TradingView symbol for the embedded chart */
  tv: string;
  /** two-sentence factual description */
  about: string;
  /** ids of related knowledge-graph nodes */
  related: string[];
};

const fx = (
  base: string,
  quote: string,
  name: string,
  spread: string,
  leverage: string,
  about: string,
  aliases: string[],
  related: string[],
): Instrument => ({
  slug: `${base}-${quote}`.toLowerCase(),
  symbol: `${base}/${quote}`,
  code: `${base}${quote}`,
  name,
  class: "forex",
  aliases: [`${base}${quote}`.toLowerCase(), `${base} ${quote}`.toLowerCase(), ...aliases],
  base,
  quote,
  conditions: { spreadFrom: spread, leverage, minLot: "0.01" },
  contract: `1 standard lot = 100,000 ${base}`,
  tv: `FX:${base}${quote}`,
  about,
  related: [`ccy:${base}`, `ccy:${quote}`, ...related],
});

export const instruments: Instrument[] = [
  // ── Forex ────────────────────────────────────────────────────────────────
  fx("EUR", "USD", "Euro / US Dollar", "0.1", "1:500", "The euro priced in US dollars, and the most actively traded currency pair in the world. It reflects the relative monetary policy of the European Central Bank and the Federal Reserve.", ["euro dollar", "fiber", "euro"], ["cb:ecb", "cb:fed", "ev:cpi", "ev:non-farm-payrolls"]),
  fx("GBP", "USD", "British Pound / US Dollar", "0.3", "1:500", "Sterling priced in US dollars, often called “cable”. It responds to Bank of England and Federal Reserve policy and to UK growth and inflation data.", ["cable", "sterling", "pound dollar", "pound"], ["cb:boe", "cb:fed", "ev:cpi", "ev:gdp"]),
  fx("USD", "JPY", "US Dollar / Japanese Yen", "0.2", "1:500", "The US dollar priced in yen. It is closely watched for its sensitivity to the gap between US and Japanese interest rates.", ["dollar yen", "yen"], ["cb:fed", "cb:boj", "ev:interest-rate-decision", "c:carry-trade"]),
  fx("AUD", "USD", "Australian Dollar / US Dollar", "0.4", "1:400", "The Australian dollar priced in US dollars. It is frequently associated with commodity demand and with economic conditions in Asia.", ["aussie", "aussie dollar"], ["cb:rba", "cb:fed", "ev:gdp"]),
  fx("USD", "CHF", "US Dollar / Swiss Franc", "0.4", "1:400", "The US dollar priced in Swiss francs. The franc is commonly regarded as a defensive currency.", ["swissy", "swiss franc", "franc"], ["cb:fed", "cb:snb", "c:safe-haven"]),
  fx("USD", "CAD", "US Dollar / Canadian Dollar", "0.5", "1:400", "The US dollar priced in Canadian dollars, sometimes called the “loonie”. Canada’s position as an energy exporter links the pair to oil prices.", ["loonie", "canadian dollar"], ["cb:fed", "cb:boc", "ac:energy"]),
  fx("NZD", "USD", "New Zealand Dollar / US Dollar", "0.6", "1:400", "The New Zealand dollar priced in US dollars, known as the “kiwi”.", ["kiwi", "new zealand dollar"], ["cb:rbnz", "cb:fed"]),
  fx("EUR", "GBP", "Euro / British Pound", "0.5", "1:400", "The euro priced in sterling: a cross that isolates the relationship between the euro area and the United Kingdom without the US dollar.", ["euro sterling", "euro pound"], ["cb:ecb", "cb:boe"]),
  fx("EUR", "JPY", "Euro / Japanese Yen", "0.6", "1:400", "The euro priced in yen, a widely traded cross.", ["euro yen"], ["cb:ecb", "cb:boj", "c:carry-trade"]),
  fx("GBP", "JPY", "British Pound / Japanese Yen", "0.8", "1:400", "Sterling priced in yen, a cross known for wide daily ranges.", ["pound yen", "sterling yen"], ["cb:boe", "cb:boj", "c:volatility"]),

  // ── Metals ───────────────────────────────────────────────────────────────
  {
    slug: "xau-usd", symbol: "XAU/USD", code: "XAUUSD", name: "Gold / US Dollar", class: "metals",
    aliases: ["gold", "xau", "xauusd", "bullion"], base: "XAU", quote: "USD",
    conditions: { spreadFrom: "0.05", leverage: "1:200", minLot: "0.01" },
    contract: "1 standard lot = 100 troy ounces", tv: "OANDA:XAUUSD",
    about: "Spot gold priced in US dollars per troy ounce. Gold pays no interest, which is why it is commonly analysed against real yields and the dollar.",
    related: ["ccy:USD", "cb:fed", "ev:cpi", "c:real-yields", "c:safe-haven", "c:inflation"],
  },
  {
    slug: "xag-usd", symbol: "XAG/USD", code: "XAGUSD", name: "Silver / US Dollar", class: "metals",
    aliases: ["silver", "xag", "xagusd"], base: "XAG", quote: "USD",
    conditions: { spreadFrom: "0.04", leverage: "1:100", minLot: "0.01" },
    contract: "1 standard lot = 5,000 troy ounces", tv: "OANDA:XAGUSD",
    about: "Spot silver priced in US dollars per troy ounce. Silver has both monetary and industrial uses, and typically moves more than gold in percentage terms.",
    related: ["ccy:USD", "cb:fed", "c:inflation", "c:volatility"],
  },
  {
    slug: "xpt-usd", symbol: "XPT/USD", code: "XPTUSD", name: "Platinum / US Dollar", class: "metals",
    aliases: ["platinum", "xpt", "xptusd"], base: "XPT", quote: "USD",
    conditions: { spreadFrom: "4.0", leverage: "1:50", minLot: "0.01" },
    contract: "Quoted in US dollars per troy ounce", tv: "OANDA:XPTUSD",
    about: "Spot platinum priced in US dollars per troy ounce. Demand is led by industrial and automotive uses.",
    related: ["ccy:USD", "c:volatility"],
  },
  {
    slug: "xpd-usd", symbol: "XPD/USD", code: "XPDUSD", name: "Palladium / US Dollar", class: "metals",
    aliases: ["palladium", "xpd", "xpdusd"], base: "XPD", quote: "USD",
    conditions: { spreadFrom: "4.5", leverage: "1:50", minLot: "0.01" },
    contract: "Quoted in US dollars per troy ounce", tv: "OANDA:XPDUSD",
    about: "Spot palladium priced in US dollars per troy ounce. It is a thinner market than gold or silver, with correspondingly wider spreads.",
    related: ["ccy:USD", "c:liquidity"],
  },

  // ── Indices ──────────────────────────────────────────────────────────────
  {
    slug: "us30", symbol: "US30", code: "US30", name: "Dow Jones 30", class: "indices",
    aliases: ["dow", "dow jones", "djia", "wall street"],
    conditions: { spreadFrom: "1.5", leverage: "1:200", minLot: "0.1" },
    contract: "Index CFD, quoted in index points", tv: "FOREXCOM:DJI",
    about: "A CFD tracking the Dow Jones Industrial Average, a price-weighted index of 30 large US companies.",
    related: ["ccy:USD", "cb:fed", "ev:non-farm-payrolls", "ev:gdp"],
  },
  {
    slug: "us500", symbol: "US500", code: "US500", name: "S&P 500", class: "indices",
    aliases: ["sp500", "s&p", "s&p 500", "spx", "sandp"],
    conditions: { spreadFrom: "0.4", leverage: "1:200", minLot: "0.1" },
    contract: "Index CFD, quoted in index points", tv: "FOREXCOM:SPXUSD",
    about: "A CFD tracking the S&P 500, a market-capitalisation-weighted index of 500 large US companies and the most widely used benchmark for US equities.",
    related: ["ccy:USD", "cb:fed", "ev:cpi", "ev:gdp", "c:volatility"],
  },
  {
    slug: "us100", symbol: "US100", code: "US100", name: "Nasdaq 100", class: "indices",
    aliases: ["nasdaq", "nas100", "ndx", "tech 100"],
    conditions: { spreadFrom: "1.0", leverage: "1:200", minLot: "0.1" },
    contract: "Index CFD, quoted in index points", tv: "FOREXCOM:NSXUSD",
    about: "A CFD tracking the Nasdaq-100, an index of the 100 largest non-financial companies listed on Nasdaq, weighted towards technology.",
    related: ["ccy:USD", "cb:fed", "ev:interest-rate-decision"],
  },
  {
    slug: "uk100", symbol: "UK100", code: "UK100", name: "FTSE 100", class: "indices",
    aliases: ["ftse", "footsie", "ftse 100"],
    conditions: { spreadFrom: "1.2", leverage: "1:100", minLot: "0.1" },
    contract: "Index CFD, quoted in index points", tv: "FOREXCOM:UKXGBP",
    about: "A CFD tracking the FTSE 100, the index of the 100 largest companies listed on the London Stock Exchange.",
    related: ["ccy:GBP", "cb:boe", "ev:gdp"],
  },
  {
    slug: "de40", symbol: "DE40", code: "DE40", name: "DAX 40", class: "indices",
    aliases: ["dax", "germany 40", "ger40"],
    conditions: { spreadFrom: "1.5", leverage: "1:100", minLot: "0.1" },
    contract: "Index CFD, quoted in index points", tv: "FOREXCOM:GRXEUR",
    about: "A CFD tracking the DAX, the index of 40 major companies listed on the Frankfurt Stock Exchange.",
    related: ["ccy:EUR", "cb:ecb", "ev:pmi"],
  },
  {
    slug: "jp225", symbol: "JP225", code: "JP225", name: "Nikkei 225", class: "indices",
    aliases: ["nikkei", "japan 225", "nikkei 225"],
    conditions: { spreadFrom: "8.0", leverage: "1:100", minLot: "0.1" },
    contract: "Index CFD, quoted in index points", tv: "FOREXCOM:JPXJPY",
    about: "A CFD tracking the Nikkei 225, a price-weighted index of 225 companies listed on the Tokyo Stock Exchange.",
    related: ["ccy:JPY", "cb:boj"],
  },

  // ── Energy ───────────────────────────────────────────────────────────────
  {
    slug: "brent", symbol: "XBR/USD", code: "XBRUSD", name: "Brent Crude Oil", class: "energy",
    aliases: ["brent", "oil", "crude", "uk oil", "xbrusd"],
    conditions: { spreadFrom: "0.03", leverage: "1:100", minLot: "0.1" },
    contract: "CFD, quoted in US dollars per barrel", tv: "TVC:UKOIL",
    about: "A CFD on Brent crude, the benchmark used to price most of the world’s internationally traded oil.",
    related: ["ccy:USD", "ccy:CAD", "c:inflation", "ev:gdp"],
  },
  {
    slug: "wti", symbol: "XTI/USD", code: "XTIUSD", name: "WTI Crude Oil", class: "energy",
    aliases: ["wti", "us oil", "west texas", "crude oil", "xtiusd"],
    conditions: { spreadFrom: "0.03", leverage: "1:100", minLot: "0.1" },
    contract: "CFD, quoted in US dollars per barrel", tv: "TVC:USOIL",
    about: "A CFD on West Texas Intermediate, the main benchmark for crude oil produced in the United States.",
    related: ["ccy:USD", "ccy:CAD", "c:inflation"],
  },
  {
    slug: "natural-gas", symbol: "XNG/USD", code: "XNGUSD", name: "Natural Gas", class: "energy",
    aliases: ["natgas", "gas", "henry hub", "xngusd"],
    conditions: { spreadFrom: "0.005", leverage: "1:50", minLot: "0.1" },
    contract: "CFD, quoted in US dollars per MMBtu", tv: "CAPITALCOM:NATURALGAS",
    about: "A CFD on US natural gas. Prices are strongly seasonal and sensitive to weather and storage data.",
    related: ["ccy:USD", "c:volatility"],
  },

  // ── Equities ─────────────────────────────────────────────────────────────
  ...(
    [
      ["AAPL", "Apple Inc.", "0.10", "1:20", "NASDAQ:AAPL", ["apple"]],
      ["AMZN", "Amazon.com Inc.", "0.30", "1:20", "NASDAQ:AMZN", ["amazon"]],
      ["GOOGL", "Alphabet Inc.", "0.50", "1:20", "NASDAQ:GOOGL", ["google", "alphabet"]],
      ["NFLX", "Netflix Inc.", "0.40", "1:20", "NASDAQ:NFLX", ["netflix"]],
      ["MSFT", "Microsoft Corp.", "0.15", "1:20", "NASDAQ:MSFT", ["microsoft"]],
      ["TSLA", "Tesla Inc.", "0.25", "1:10", "NASDAQ:TSLA", ["tesla"]],
    ] as const
  ).map(
    ([code, name, spread, lev, tv, aliases]): Instrument => ({
      slug: code.toLowerCase(), symbol: code, code, name, class: "equities",
      aliases: [...aliases, code.toLowerCase()],
      conditions: { spreadFrom: spread, leverage: lev, minLot: "1" },
      contract: "Share CFD, 1 lot = 1 share", tv,
      about: `A CFD on the shares of ${name}, listed on Nasdaq. Holding the CFD does not confer ownership of the shares.`,
      related: ["ccy:USD", "cb:fed", "c:dividend"],
    }),
  ),

  // ── Crypto ───────────────────────────────────────────────────────────────
  ...(
    [
      ["BTC", "Bitcoin", "25.0", "1:20", "0.01", "BITSTAMP:BTCUSD", ["bitcoin", "btc", "xbt"]],
      ["ETH", "Ethereum", "2.0", "1:20", "0.01", "BITSTAMP:ETHUSD", ["ethereum", "ether", "eth"]],
      ["LTC", "Litecoin", "0.5", "1:10", "0.01", "BITSTAMP:LTCUSD", ["litecoin", "ltc"]],
      ["XRP", "XRP", "0.003", "1:10", "1", "BITSTAMP:XRPUSD", ["ripple", "xrp"]],
      ["SOL", "Solana", "0.3", "1:10", "0.1", "COINBASE:SOLUSD", ["solana", "sol"]],
    ] as const
  ).map(
    ([base, name, spread, lev, lot, tv, aliases]): Instrument => ({
      slug: `${base.toLowerCase()}-usd`, symbol: `${base}/USD`, code: `${base}USD`, name: `${name} / US Dollar`, class: "crypto",
      aliases: [...aliases, `${base.toLowerCase()}usd`], base, quote: "USD",
      conditions: { spreadFrom: spread, leverage: lev, minLot: lot },
      contract: `CFD, quoted in US dollars per ${base}`, tv,
      about: `A CFD on ${name} priced in US dollars. You take exposure to the price without holding the underlying asset.`,
      related: ["ccy:USD", "c:volatility", "c:liquidity"],
    }),
  ),
];

export const instrumentsByClass = (key: AssetClassKey) => instruments.filter((i) => i.class === key);
export const getAssetClass = (key: string) => assetClasses.find((a) => a.key === key);
export const getInstrument = (cls: string, slug: string) => instruments.find((i) => i.class === cls && i.slug === slug);
export const instrumentHref = (i: Instrument) => `/markets/${i.class}/${i.slug}`;

/** Legacy URLs from the previous site → new canonical instrument pages. */
export const legacyInstrumentRedirects: Record<string, string> = {
  eurusd: "/markets/forex/eur-usd",
  xauusd: "/markets/metals/xau-usd",
  btcusd: "/markets/crypto/btc-usd",
};

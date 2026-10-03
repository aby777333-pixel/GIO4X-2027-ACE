/**
 * NICE & NEED — free things elsewhere on the web that a trader will find
 * useful, and the free things on this site.
 *
 * Every outside entry is a well-known public resource, free to read or use at
 * the time of writing. GIO4X has no arrangement with any of them and is not
 * paid for a link. An entry is a pointer, not an endorsement of what that
 * site publishes: the page says so.
 */
export type NeedKind = "learn" | "data" | "banks" | "charts" | "safe";
export type NeedLink = { name: string; href: string; what: string };
export type NeedGroup = { id: string; kind: NeedKind; eyebrow: string; title: string; lead: string; need: boolean; links: readonly NeedLink[] };

export const NEED: readonly NeedGroup[] = [
  {
    id: "learn",
    kind: "learn",
    eyebrow: "Free courses and references",
    title: "Learn it properly, for nothing.",
    lead: "Whole courses and encyclopaedias of finance that cost nothing to read.",
    need: false,
    links: [
      { name: "Investopedia", href: "https://www.investopedia.com/", what: "The largest plain-language dictionary of finance, with articles on nearly every term." },
      { name: "BabyPips: School of Pipsology", href: "https://www.babypips.com/learn/forex", what: "A free, beginner-first forex course, from what a pip is to building a plan." },
      { name: "Khan Academy: economics and finance", href: "https://www.khanacademy.org/economics-finance-domain", what: "Free video lessons on interest, inflation, markets and macroeconomics." },
      { name: "CME Group Education", href: "https://www.cmegroup.com/education.html", what: "Free courses from a futures exchange on how futures, options and hedging work." },
      { name: "ECB explainers", href: "https://www.ecb.europa.eu/ecb-and-you/explainers/html/index.en.html", what: "A central bank explains inflation, interest rates and monetary policy in plain words." },
      { name: "Bank of England explainers", href: "https://www.bankofengland.co.uk/explainers", what: "Short answers to questions such as what money is and why interest rates change." },
    ],
  },
  {
    id: "data",
    kind: "data",
    eyebrow: "Free data",
    title: "The numbers, from the source.",
    lead: "Official statistics, free to look up and download: the same series the professionals quote.",
    need: true,
    links: [
      { name: "FRED, Federal Reserve Bank of St. Louis", href: "https://fred.stlouisfed.org/", what: "Hundreds of thousands of economic series, each with a chart: rates, inflation, jobs, exchange rates." },
      { name: "BIS statistics", href: "https://www.bis.org/statistics/index.htm", what: "The Bank for International Settlements on global banking, debt, exchange rates and derivatives." },
      { name: "BIS Triennial Survey of FX turnover", href: "https://www.bis.org/statistics/rpfx22.htm", what: "The reference count of how much currency is traded each day, by pair, centre and instrument." },
      { name: "IMF Data", href: "https://www.imf.org/en/Data", what: "World economic outlook figures, reserves and balance of payments, country by country." },
      { name: "World Bank Open Data", href: "https://data.worldbank.org/", what: "Free development and economic indicators for every country." },
      { name: "ECB euro reference rates", href: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html", what: "The euro’s official daily reference rates against other currencies, with history." },
    ],
  },
  {
    id: "banks",
    kind: "banks",
    eyebrow: "Central banks",
    title: "When the rate is decided, and why.",
    lead: "Meeting calendars, statements and minutes, published free by the banks themselves.",
    need: true,
    links: [
      { name: "Federal Reserve: FOMC calendar", href: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", what: "Meeting dates, statements, minutes and projections of the US rate-setting committee." },
      { name: "Bank of England: monetary policy", href: "https://www.bankofengland.co.uk/monetary-policy", what: "Bank Rate decisions, minutes and the Monetary Policy Report." },
      { name: "Bank of Japan", href: "https://www.boj.or.jp/en/", what: "Policy statements, outlook reports and meeting schedules, in English." },
    ],
  },
  {
    id: "charts",
    kind: "charts",
    eyebrow: "Charts, calendars and platforms",
    title: "Tools that cost nothing to open.",
    lead: "A chart, an economic calendar and a trading platform, each with a free tier or free outright.",
    need: false,
    links: [
      { name: "TradingView", href: "https://www.tradingview.com/", what: "Charts for almost every market in a browser, with drawing tools and indicators on the free plan." },
      { name: "Forex Factory calendar", href: "https://www.forexfactory.com/calendar", what: "A widely used economic calendar, with expected impact and previous figures for each release." },
      { name: "MetaTrader 5", href: "https://www.metatrader5.com/en", what: "The trading platform itself is free to download, and runs a demo account without a deposit." },
    ],
  },
  {
    id: "safe",
    kind: "safe",
    eyebrow: "Stay safe",
    title: "Check before you send money anywhere.",
    lead: "Regulators publish, free, the warnings and registers that expose most frauds. This is the part you need.",
    need: true,
    links: [
      { name: "IOSCO investor alerts portal", href: "https://www.iosco.org/investor_protection/?subsection=investor_alerts_portal", what: "Warnings from securities regulators around the world about firms that are not authorised." },
      { name: "FCA ScamSmart", href: "https://www.fca.org.uk/scamsmart", what: "The UK regulator’s guide to spotting investment scams, with a warning list to search." },
      { name: "CFTC: Learn and Protect", href: "https://www.cftc.gov/LearnAndProtect", what: "The US derivatives regulator on forex and crypto fraud, and how to check a firm." },
      { name: "Investor.gov", href: "https://www.investor.gov/", what: "The US SEC’s investor education site: how products work, and how to check a professional." },
      { name: "FINRA BrokerCheck", href: "https://brokercheck.finra.org/", what: "Look up the record of a US broker or firm before dealing with them." },
    ],
  },
];

/** the free things on this site, for the same page and for the footer */
export const HERE: readonly { label: string; href: string; what: string }[] = [
  { label: "The Playbook", href: "/playbook", what: "Candlestick patterns and common situations, one page each." },
  { label: "Trader Toolkit", href: "/tools", what: "Calculators for pip value, position size, margin and more." },
  { label: "Cheat sheets", href: "/academy/cheat-sheets", what: "Three pages to print or save as PDF." },
  { label: "The glossary", href: "/glossary", what: "Every term, defined, with a couplet to remember it by." },
  { label: "Practice room", href: "/academy/practice", what: "Build an order, fix a trade, duel with flashcards." },
  { label: "Fun@Finance", href: "/fun", what: "Jokes, comics and riddles." },
];

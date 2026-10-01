/**
 * Reference knowledge: currencies, central banks and economic events.
 *
 * These are institutional facts (names, mandates, what a release measures),
 * not data. Policy rates, meeting dates and release values are deliberately
 * absent: GIO4X has no licensed feed for them yet, and each page links to the
 * primary source instead of printing a number that would go stale.
 */

export type Currency = {
  code: string;
  name: string;
  /** what people call it */
  nicknames: string[];
  area: string;
  bank: string; // central bank slug
  symbol: string;
  note: string;
};

export const currencies: Currency[] = [
  { code: "USD", name: "US Dollar", nicknames: ["dollar", "greenback", "buck"], area: "United States", bank: "fed", symbol: "$", note: "The world’s primary reserve currency and one side of most foreign-exchange transactions." },
  { code: "EUR", name: "Euro", nicknames: ["euro", "single currency"], area: "Euro area", bank: "ecb", symbol: "€", note: "The shared currency of the euro area member states." },
  { code: "GBP", name: "British Pound", nicknames: ["sterling", "pound", "cable"], area: "United Kingdom", bank: "boe", symbol: "£", note: "Pound sterling, the oldest currency still in use among the majors." },
  { code: "JPY", name: "Japanese Yen", nicknames: ["yen"], area: "Japan", bank: "boj", symbol: "¥", note: "Quoted to two or three decimal places rather than four or five; one pip in a yen pair is 0.01." },
  { code: "CHF", name: "Swiss Franc", nicknames: ["swissy", "franc"], area: "Switzerland", bank: "snb", symbol: "Fr", note: "Often regarded as a defensive currency." },
  { code: "AUD", name: "Australian Dollar", nicknames: ["aussie"], area: "Australia", bank: "rba", symbol: "A$", note: "Commonly associated with commodity demand and with growth in Asia." },
  { code: "CAD", name: "Canadian Dollar", nicknames: ["loonie"], area: "Canada", bank: "boc", symbol: "C$", note: "Linked to energy prices through Canada’s role as an oil exporter." },
  { code: "NZD", name: "New Zealand Dollar", nicknames: ["kiwi"], area: "New Zealand", bank: "rbnz", symbol: "NZ$", note: "A smaller, commodity-linked currency." },
];

export type CentralBank = {
  slug: string;
  name: string;
  short: string;
  currency: string;
  area: string;
  city: string;
  /** the body that sets policy */
  committee: string;
  /** the name of the headline policy instrument */
  instrument: string;
  mandate: string;
  /** primary source for decisions and the current rate */
  url: string;
  /** IANA zone of the announcement */
  tz: string;
  lat: number;
  lon: number;
};

export const centralBanks: CentralBank[] = [
  { slug: "fed", name: "Federal Reserve", short: "Fed", currency: "USD", area: "United States", city: "Washington, D.C.", committee: "Federal Open Market Committee (FOMC)", instrument: "Target range for the federal funds rate", mandate: "Maximum employment and stable prices.", url: "https://www.federalreserve.gov/monetarypolicy.htm", tz: "America/New_York", lat: 38.89, lon: -77.05 },
  { slug: "ecb", name: "European Central Bank", short: "ECB", currency: "EUR", area: "Euro area", city: "Frankfurt", committee: "Governing Council", instrument: "Deposit facility rate", mandate: "Price stability across the euro area.", url: "https://www.ecb.europa.eu/mopo/html/index.en.html", tz: "Europe/Berlin", lat: 50.11, lon: 8.7 },
  { slug: "boe", name: "Bank of England", short: "BoE", currency: "GBP", area: "United Kingdom", city: "London", committee: "Monetary Policy Committee (MPC)", instrument: "Bank Rate", mandate: "Monetary and financial stability, with an inflation target set by the government.", url: "https://www.bankofengland.co.uk/monetary-policy", tz: "Europe/London", lat: 51.51, lon: -0.09 },
  { slug: "boj", name: "Bank of Japan", short: "BoJ", currency: "JPY", area: "Japan", city: "Tokyo", committee: "Policy Board", instrument: "Short-term policy interest rate", mandate: "Price stability and the stability of the financial system.", url: "https://www.boj.or.jp/en/mopo/index.htm", tz: "Asia/Tokyo", lat: 35.69, lon: 139.77 },
  { slug: "snb", name: "Swiss National Bank", short: "SNB", currency: "CHF", area: "Switzerland", city: "Zurich and Bern", committee: "Governing Board", instrument: "SNB policy rate", mandate: "Price stability, taking due account of economic developments.", url: "https://www.snb.ch/en/the-snb/mandates-goals/monetary-policy", tz: "Europe/Zurich", lat: 47.37, lon: 8.54 },
  { slug: "rba", name: "Reserve Bank of Australia", short: "RBA", currency: "AUD", area: "Australia", city: "Sydney", committee: "Monetary Policy Board", instrument: "Cash rate target", mandate: "Price stability and full employment.", url: "https://www.rba.gov.au/monetary-policy/", tz: "Australia/Sydney", lat: -33.87, lon: 151.21 },
  { slug: "boc", name: "Bank of Canada", short: "BoC", currency: "CAD", area: "Canada", city: "Ottawa", committee: "Governing Council", instrument: "Target for the overnight rate", mandate: "Low, stable and predictable inflation.", url: "https://www.bankofcanada.ca/core-functions/monetary-policy/", tz: "America/Toronto", lat: 45.42, lon: -75.7 },
  { slug: "rbnz", name: "Reserve Bank of New Zealand", short: "RBNZ", currency: "NZD", area: "New Zealand", city: "Wellington", committee: "Monetary Policy Committee", instrument: "Official Cash Rate (OCR)", mandate: "Price stability over the medium term.", url: "https://www.rbnz.govt.nz/monetary-policy", tz: "Pacific/Auckland", lat: -41.29, lon: 174.78 },
  { slug: "rbi", name: "Reserve Bank of India", short: "RBI", currency: "INR", area: "India", city: "Mumbai", committee: "Monetary Policy Committee (MPC)", instrument: "Policy repo rate", mandate: "Price stability while keeping in mind the objective of growth.", url: "https://www.rbi.org.in/", tz: "Asia/Kolkata", lat: 18.93, lon: 72.84 },
];

export type EconEvent = {
  slug: string;
  name: string;
  short: string;
  kind: "Inflation" | "Employment" | "Growth" | "Monetary policy" | "Survey" | "Consumption";
  /** what it is */
  what: string;
  /** how it is measured */
  how: string;
  /** why markets watch it */
  why: string;
  /** assets commonly sensitive to it: "commonly monitored", never "will move" */
  watchedBy: string[];
  /** who publishes it, with primary links */
  publishers: { area: string; body: string; url: string }[];
  cadence: string;
  related: string[];
};

export const econEvents: EconEvent[] = [
  {
    slug: "cpi",
    name: "Consumer Price Index",
    short: "CPI",
    kind: "Inflation",
    what: "A measure of the average change over time in the prices paid by consumers for a fixed basket of goods and services. The year-over-year change in the index is the most quoted measure of inflation.",
    how: "Statistical agencies price a representative basket each month and weight each category by its share of household spending. “Core” measures exclude the most volatile categories, usually food and energy.",
    why: "Central banks set policy against an inflation objective, so an inflation reading that differs from what was expected can change the outlook for interest rates, and through it the pricing of currencies, bonds, equities and gold.",
    watchedBy: ["ccy:USD", "ccy:EUR", "ccy:GBP", "i:xau-usd", "i:us500"],
    publishers: [
      { area: "United States", body: "Bureau of Labor Statistics", url: "https://www.bls.gov/cpi/" },
      { area: "Euro area", body: "Eurostat (HICP)", url: "https://ec.europa.eu/eurostat/web/hicp" },
      { area: "United Kingdom", body: "Office for National Statistics", url: "https://www.ons.gov.uk/economy/inflationandpriceindices" },
    ],
    cadence: "Monthly",
    related: ["c:inflation", "c:real-yields", "ev:interest-rate-decision"],
  },
  {
    slug: "non-farm-payrolls",
    name: "Non-Farm Payrolls",
    short: "NFP",
    kind: "Employment",
    what: "The headline figure of the US Employment Situation report: the monthly change in the number of people employed outside farming, private households and non-profit organisations.",
    how: "Compiled by the Bureau of Labor Statistics from a survey of employers. The same report carries the unemployment rate and average hourly earnings, which come from a separate household survey and the payroll survey respectively.",
    why: "Employment is half of the Federal Reserve’s mandate. The report is one of the most closely watched scheduled releases, and trading conditions around it can change quickly: spreads may widen and prices may gap.",
    watchedBy: ["ccy:USD", "i:eur-usd", "i:usd-jpy", "i:xau-usd", "i:us30"],
    publishers: [{ area: "United States", body: "Bureau of Labor Statistics", url: "https://www.bls.gov/ces/" }],
    cadence: "Monthly, usually the first Friday",
    related: ["cb:fed", "c:volatility", "c:slippage"],
  },
  {
    slug: "interest-rate-decision",
    name: "Interest Rate Decision",
    short: "Rates",
    kind: "Monetary policy",
    what: "The scheduled announcement at which a central bank’s policy committee sets its policy interest rate and explains its assessment of the economy.",
    how: "The committee votes on the level of the policy rate. The decision is published with a statement, and in many cases with projections and a press conference.",
    why: "The policy rate anchors short-term borrowing costs in a currency. Markets respond not only to the decision itself but to how it compares with what was already priced in, and to guidance about what may follow.",
    watchedBy: ["ccy:USD", "ccy:EUR", "ccy:GBP", "ccy:JPY", "i:xau-usd", "i:us100"],
    publishers: [
      { area: "United States", body: "Federal Reserve", url: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm" },
      { area: "Euro area", body: "European Central Bank", url: "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html" },
      { area: "United Kingdom", body: "Bank of England", url: "https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates" },
    ],
    cadence: "Typically six to eight scheduled meetings a year, depending on the bank",
    related: ["c:monetary-policy", "c:carry-trade", "c:real-yields"],
  },
  {
    slug: "gdp",
    name: "Gross Domestic Product",
    short: "GDP",
    kind: "Growth",
    what: "The total value of goods and services produced in an economy over a period. Growth is usually reported as the quarter-on-quarter or year-on-year change in real (inflation-adjusted) GDP.",
    how: "National statistical agencies publish preliminary estimates soon after each quarter and revise them as more complete data arrives.",
    why: "GDP is the broadest measure of economic activity. Because it is published with a delay, markets often treat it as confirmation of trends already visible in more timely data.",
    watchedBy: ["ccy:USD", "ccy:EUR", "ccy:GBP", "i:us500", "i:brent"],
    publishers: [
      { area: "United States", body: "Bureau of Economic Analysis", url: "https://www.bea.gov/data/gdp/gross-domestic-product" },
      { area: "Euro area", body: "Eurostat", url: "https://ec.europa.eu/eurostat/web/national-accounts" },
      { area: "United Kingdom", body: "Office for National Statistics", url: "https://www.ons.gov.uk/economy/grossdomesticproductgdp" },
    ],
    cadence: "Quarterly, with revisions",
    related: ["c:recession", "ev:pmi"],
  },
  {
    slug: "pmi",
    name: "Purchasing Managers’ Index",
    short: "PMI",
    kind: "Survey",
    what: "A monthly survey of purchasing managers about new orders, output, employment, supplier deliveries and inventories, condensed into a diffusion index.",
    how: "Responses are aggregated so that a reading above 50 indicates that more firms reported expansion than contraction, and a reading below 50 the opposite.",
    why: "PMIs arrive early in the month and cover the month just ended, which makes them one of the timeliest indicators of the direction of activity.",
    watchedBy: ["ccy:EUR", "ccy:GBP", "ccy:USD", "i:de40", "i:us500"],
    publishers: [
      { area: "United States", body: "Institute for Supply Management", url: "https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/" },
      { area: "Global", body: "S&P Global", url: "https://www.pmi.spglobal.com/" },
    ],
    cadence: "Monthly",
    related: ["ev:gdp", "c:recession"],
  },
  {
    slug: "unemployment-rate",
    name: "Unemployment Rate",
    short: "Jobless rate",
    kind: "Employment",
    what: "The share of the labour force that is without work, available for work and actively looking for it.",
    how: "Measured by household surveys conducted by national statistical agencies, using definitions aligned with the International Labour Organization.",
    why: "It indicates slack in the labour market, which bears on wage growth, consumer spending and central bank policy.",
    watchedBy: ["ccy:USD", "ccy:AUD", "ccy:CAD", "ccy:GBP"],
    publishers: [
      { area: "United States", body: "Bureau of Labor Statistics", url: "https://www.bls.gov/cps/" },
      { area: "Euro area", body: "Eurostat", url: "https://ec.europa.eu/eurostat/web/lfs" },
    ],
    cadence: "Monthly",
    related: ["ev:non-farm-payrolls", "c:monetary-policy"],
  },
  {
    slug: "retail-sales",
    name: "Retail Sales",
    short: "Retail sales",
    kind: "Consumption",
    what: "The total receipts of retail stores over a month, used as a timely gauge of consumer spending.",
    how: "Statistical agencies survey retailers and report the month-on-month and year-on-year change, often with a “core” version excluding the most volatile categories.",
    why: "Household consumption is the largest component of GDP in most developed economies.",
    watchedBy: ["ccy:USD", "ccy:GBP", "ccy:AUD", "i:us500"],
    publishers: [
      { area: "United States", body: "US Census Bureau", url: "https://www.census.gov/retail/index.html" },
      { area: "United Kingdom", body: "Office for National Statistics", url: "https://www.ons.gov.uk/businessindustryandtrade/retailindustry" },
    ],
    cadence: "Monthly",
    related: ["ev:gdp", "c:inflation"],
  },
];

export const getCurrency = (code: string) => currencies.find((c) => c.code === code);
export const getBank = (slug: string) => centralBanks.find((b) => b.slug === slug);
export const getEvent = (slug: string) => econEvents.find((e) => e.slug === slug);

/**
 * PLATFORMS: the single source of truth for everything the site says about
 * 777 Raptor and MetaTrader 5.
 *
 * Every statement is a `Fact` with an explicit status:
 *   - "verified"   → may be published. Either both previous GIO4X sites agree
 *                    on it (Raptor: web, desktop and mobile; multi-asset), or
 *                    it is a publicly documented capability of the MetaTrader 5
 *                    platform itself, attributed to MetaQuotes.
 *   - "unverified" → the owner has not confirmed it. The UI renders
 *                    "Not yet published": never a tick, never a cross.
 *
 * To publish a pending fact, change its status here and supply the value.
 * Nothing in the page components needs to change.
 *
 * Deliberately absent: execution speeds, data-centre names, uptime, indicator
 * counts for Raptor, AI features, server names, download links.
 */

export type PlatformKey = "mt5" | "raptor";

export type Source = { label: string; href?: string };

/** How a verified capability compares in a matrix. */
export type Availability = "available" | "different" | "none";

export type Fact =
  | { status: "verified"; state: Availability; value: string; source: Source }
  | { status: "unverified"; note?: string };

export const metaquotes: Source = { label: "MetaQuotes, metatrader5.com", href: "https://www.metatrader5.com/" };
export const bothSites: Source = { label: "Stated on both previous GIO4X websites" };

const pending = (note?: string): Fact => ({ status: "unverified", note });
const mq = (value: string, state: Availability = "available"): Fact => ({ status: "verified", state, value, source: metaquotes });
const gx = (value: string, state: Availability = "available"): Fact => ({ status: "verified", state, value, source: bothSites });

export const platforms: Record<
  PlatformKey,
  { key: PlatformKey; name: string; short: string; href: string; role: string; maker: string; makerUrl: string; tagline: string; summary: string }
> = {
  raptor: {
    key: "raptor",
    name: "777 Raptor",
    short: "Raptor",
    href: "/platforms/raptor",
    role: "The GIO4X flagship",
    maker: "777 Raptor",
    makerUrl: "https://www.777raptor.com/",
    tagline: "Built for the market.",
    summary:
      "A multi-asset trading workspace on web, desktop and mobile, covering the asset classes GIO4X lists. One place to watch a market, arrange your screens, analyse, place an order and keep an eye on what is open.",
  },
  mt5: {
    key: "mt5",
    name: "MetaTrader 5",
    short: "MT5",
    href: "/platforms/metatrader-5",
    role: "Third-party platform",
    maker: "MetaQuotes",
    makerUrl: "https://www.metatrader5.com/",
    tagline: "Global markets. Familiar workflow.",
    summary:
      "The multi-asset platform developed by MetaQuotes. Many traders already know its charts, its order ticket and its Expert Advisors, and that familiarity is worth something: there is nothing new to learn before you can concentrate on the market.",
  },
};

export const platformOrder: PlatformKey[] = ["mt5", "raptor"];

/* ── What GIO4X itself has (and has not) published about each platform ──── */

export type GioFactKey = "devices" | "server" | "downloads" | "accounts" | "instruments" | "demo" | "requirements" | "releases" | "features";

export const gioFacts: { key: GioFactKey; label: string; about: string; raptor: Fact; mt5: Fact }[] = [
  {
    key: "devices",
    label: "Where it runs",
    about: "The device classes on which the platform is offered.",
    raptor: gx("Web, desktop and mobile"),
    mt5: mq("Desktop, web and mobile terminals exist for MetaTrader 5"),
  },
  { key: "server", label: "Server name", about: "The server you select when you log in.", raptor: pending(), mt5: pending() },
  { key: "downloads", label: "Download and store links", about: "Official installers and app-store listings.", raptor: pending(), mt5: pending() },
  { key: "accounts", label: "Account types on this platform", about: "Which of Classic, Premium and ECN can be opened on it.", raptor: pending(), mt5: pending() },
  { key: "instruments", label: "Instrument list on this platform", about: "The symbols available, instrument by instrument.", raptor: pending(), mt5: pending() },
  { key: "demo", label: "Demo access", about: "Whether, and how, you can practise without funds.", raptor: pending(), mt5: pending() },
  { key: "requirements", label: "System requirements", about: "Operating systems, browsers and hardware.", raptor: pending(), mt5: pending() },
  { key: "releases", label: "Release notes", about: "What changed, version by version.", raptor: pending(), mt5: pending() },
  { key: "features", label: "Detailed feature library", about: "A documented list of tools, order types and settings.", raptor: pending(), mt5: pending("See the capabilities documented by MetaQuotes below.") },
];

export const gioFact = (key: GioFactKey) => gioFacts.find((f) => f.key === key)!;

/* ── Comparison matrix ──────────────────────────────────────────────────── */

export type NeedKey = "desktop" | "mobile" | "web" | "charting" | "workspace" | "automation" | "markets";

export const needs: { key: NeedKey; label: string }[] = [
  { key: "desktop", label: "Desktop trading" },
  { key: "mobile", label: "Mobile access" },
  { key: "web", label: "Web access" },
  { key: "charting", label: "Charting" },
  { key: "workspace", label: "Workspace customisation" },
  { key: "automation", label: "Automation" },
  { key: "markets", label: "Specific markets" },
];

export type CompareRow = { key: string; label: string; needs: NeedKey[]; raptor: Fact; mt5: Fact };

export const compareRows: CompareRow[] = [
  {
    key: "markets",
    label: "Available markets",
    needs: ["markets"],
    raptor: gx("Multi-asset: described as covering the asset classes GIO4X lists"),
    mt5: mq("A multi-asset platform"),
  },
  {
    key: "devices",
    label: "Device availability",
    needs: ["desktop", "mobile", "web"],
    raptor: gx("Web, desktop and mobile"),
    mt5: mq("Desktop, web and mobile terminals"),
  },
  { key: "web", label: "Web access", needs: ["web"], raptor: gx("Described as available in a browser"), mt5: mq("A web terminal exists") },
  { key: "desktop", label: "Desktop access", needs: ["desktop"], raptor: gx("Described as available on desktop"), mt5: mq("A desktop terminal exists") },
  { key: "mobile", label: "Mobile access", needs: ["mobile"], raptor: gx("Described as available on mobile"), mt5: mq("Mobile terminals exist") },
  {
    key: "charting",
    label: "Charting",
    needs: ["charting"],
    raptor: pending(),
    mt5: mq("21 timeframes and 44 analytical objects"),
  },
  {
    key: "workspace",
    label: "Workspace customisation",
    needs: ["workspace"],
    raptor: pending(),
    mt5: mq("Chart templates and profiles"),
  },
  {
    key: "orders",
    label: "Order types",
    needs: [],
    raptor: pending(),
    mt5: mq("Market orders and six pending types: buy and sell limit, buy and sell stop, buy and sell stop limit"),
  },
  { key: "indicators", label: "Indicators", needs: ["charting"], raptor: pending(), mt5: mq("38 built-in technical indicators") },
  { key: "watchlists", label: "Watchlists", needs: ["workspace"], raptor: pending(), mt5: mq("The Market Watch window") },
  { key: "history", label: "Trading history", needs: [], raptor: pending(), mt5: mq("An account history of orders and deals") },
  {
    key: "automation",
    label: "Automation",
    needs: ["automation"],
    raptor: pending(),
    mt5: mq("MQL5, Expert Advisors and a multi-threaded Strategy Tester"),
  },
  { key: "requirements", label: "System requirements", needs: ["desktop", "mobile", "web"], raptor: pending(), mt5: pending() },
];

/* ── Platform finder ────────────────────────────────────────────────────── */

export type WhereKey = "desktop" | "browser" | "mobile";
export type ValueKey = "familiar" | "workspace" | "charting" | "devices" | "assets";

export const finderWhere: { key: WhereKey; label: string; rows: string[] }[] = [
  { key: "desktop", label: "Desktop", rows: ["desktop"] },
  { key: "browser", label: "Browser", rows: ["web"] },
  { key: "mobile", label: "Mobile", rows: ["mobile"] },
];

export const finderValue: { key: ValueKey; label: string; rows: string[]; note?: Partial<Record<PlatformKey, string>> }[] = [
  {
    key: "familiar",
    label: "Familiar workflow",
    rows: ["orders", "history"],
    note: {
      mt5: "MetaTrader 5 is the same product wherever it is offered. If you have used it before, the interface will be the one you know.",
      raptor: "Raptor is its own workspace. Nothing has been published yet about how its workflow compares with platforms you may know.",
    },
  },
  { key: "workspace", label: "Workspace customisation", rows: ["workspace", "watchlists"] },
  { key: "charting", label: "Charting", rows: ["charting", "indicators"] },
  { key: "devices", label: "Device flexibility", rows: ["devices"] },
  { key: "assets", label: "Specific asset access", rows: ["markets"], note: { mt5: "Which GIO4X instruments are offered on MetaTrader 5 has not been published.", raptor: "An instrument-by-instrument list for Raptor has not been published." } },
];

/* ── 777 Raptor: the five-beat narrative and the interface tour ─────────── */

export type RegionKey = "watchlist" | "chart" | "order" | "positions" | "explorer" | "account" | "history" | "risk" | "workspace";

export const raptorBeats: { key: string; title: string; body: string; regions: RegionKey[]; links: { label: string; href: string }[] }[] = [
  {
    key: "see",
    title: "See the market.",
    body: "A trading day starts with looking. A watchlist holds the instruments you follow; selecting one brings its chart forward. Before any decision, the job is simply to see what is moving and what is not.",
    regions: ["explorer", "watchlist", "chart"],
    links: [{ label: "Markets", href: "/markets" }],
  },
  {
    key: "build",
    title: "Build your workspace.",
    body: "No two traders arrange a screen the same way. A workspace is the arrangement itself: which panels are open, where they sit and how much room each one gets. The same panels, set out for the way you work.",
    regions: ["workspace"],
    links: [],
  },
  {
    key: "analyse",
    title: "Analyse.",
    body: "The chart is where a view is formed. You change the timeframe, mark the levels that matter to you and compare what price has done with what you expected it to do. The analysis is yours; the platform is the drawing board.",
    regions: ["chart"],
    links: [
      { label: "Technical analysis", href: "/glossary/technical-analysis" },
      { label: "Timeframes and candlesticks", href: "/glossary/candlestick" },
    ],
  },
  {
    key: "act",
    title: "Act.",
    body: "An order ticket turns a view into an instruction: which instrument, which direction, what size, and where the trade is wrong. It is worth settling the size and the stop before the ticket is open, not after.",
    regions: ["order"],
    links: [
      { label: "Order anatomy", href: "/tools/order-anatomy" },
      { label: "Position size", href: "/tools/position-size" },
    ],
  },
  {
    key: "monitor",
    title: "Monitor.",
    body: "Once a position is open, the work changes from deciding to watching: what is open, what it is using in margin, and how far equity sits above the levels at which positions are closed.",
    regions: ["positions", "history", "risk", "account"],
    links: [
      { label: "Margin", href: "/tools/margin" },
      { label: "Margin call", href: "/glossary/margin-call" },
    ],
  },
];

export const raptorTour: { key: RegionKey; label: string; purpose: string; links: { label: string; href: string }[] }[] = [
  {
    key: "watchlist",
    label: "Watchlist",
    purpose: "The short list of instruments you follow. It is the first thing most traders look at, and choosing a row is how a chart and an order ticket know which market you mean.",
    links: [{ label: "Browse the markets", href: "/markets" }],
  },
  {
    key: "chart",
    label: "Charts",
    purpose: "Price over time. A chart is where you change the timeframe, mark levels and form a view of what a market has been doing.",
    links: [
      { label: "Candlestick", href: "/glossary/candlestick" },
      { label: "Technical analysis", href: "/glossary/technical-analysis" },
    ],
  },
  {
    key: "order",
    label: "Order entry",
    purpose: "The ticket that turns a decision into an instruction: instrument, direction, size, and the prices at which you want to be in or out.",
    links: [
      { label: "Order anatomy", href: "/tools/order-anatomy" },
      { label: "Market order", href: "/glossary/market-order" },
    ],
  },
  {
    key: "positions",
    label: "Positions",
    purpose: "Everything currently open: instrument, size, entry and the running result. This is the panel you watch while a trade is live.",
    links: [{ label: "Open position", href: "/glossary/open-position" }],
  },
  {
    key: "explorer",
    label: "Market explorer",
    purpose: "The way into instruments you are not yet following: browse by asset class or search by name, then add what interests you to a watchlist.",
    links: [{ label: "Asset classes", href: "/markets" }],
  },
  {
    key: "account",
    label: "Account information",
    purpose: "The state of the account at a glance: balance, equity, the margin in use and the margin still free.",
    links: [
      { label: "Equity", href: "/glossary/equity" },
      { label: "Free margin", href: "/glossary/free-margin" },
    ],
  },
  {
    key: "history",
    label: "History",
    purpose: "The record of what has already happened: closed trades and past orders. It is the raw material for reviewing how you actually trade.",
    links: [{ label: "Drawdown mathematics", href: "/tools/drawdown" }],
  },
  {
    key: "risk",
    label: "Risk controls",
    purpose: "The settings that bound a trade before it is placed, such as a stop loss and a take profit, kept in view beside the ticket.",
    links: [
      { label: "Stop loss", href: "/glossary/stop-loss" },
      { label: "Risk / reward", href: "/tools/risk-reward" },
    ],
  },
  {
    key: "workspace",
    label: "Workspace",
    purpose: "The arrangement of all of the above. A workspace remembers which panels are open and where they sit, so the screen suits the way you work.",
    links: [],
  },
];

/** Listed on the Raptor page as pending. `id` values are anchor targets. */
export const raptorPending: { id: string; label: string; body: string }[] = [
  { id: "releases", label: "Release notes", body: "A dated record of what changed in each version." },
  { id: "requirements", label: "System requirements", body: "Supported operating systems, browsers and devices." },
  { id: "downloads", label: "Downloads", body: "Official installers and app-store listings. Until they are published here, treat any Raptor download link you are sent with caution." },
  { id: "features", label: "Detailed feature library", body: "Chart tools, order types, indicators and settings, each documented rather than merely named." },
  { id: "intelligence", label: "Raptor Intelligence", body: "Earlier GIO4X material described AI-assisted features. None of it has been verified for publication, so none of it is described here." },
];

/* ── MetaTrader 5 ───────────────────────────────────────────────────────── */

/** Publicly documented capabilities of the MetaTrader 5 platform itself. */
export const mt5Capabilities: { group: string; rows: { label: string; value: string }[] }[] = [
  {
    group: "Markets and terminals",
    rows: [
      { label: "Platform type", value: "Multi-asset" },
      { label: "Developer", value: "MetaQuotes" },
      { label: "Terminals", value: "Desktop, web, mobile" },
    ],
  },
  {
    group: "Analysis",
    rows: [
      { label: "Timeframes", value: "21" },
      { label: "Built-in technical indicators", value: "38" },
      { label: "Analytical objects", value: "44" },
      { label: "Economic calendar", value: "Built in" },
    ],
  },
  {
    group: "Trading",
    rows: [
      { label: "Market orders", value: "Yes" },
      { label: "Pending orders", value: "Buy limit, sell limit, buy stop, sell stop, buy stop limit, sell stop limit" },
      { label: "Depth of Market", value: "Yes" },
      { label: "Position accounting", value: "Netting and hedging" },
    ],
  },
  {
    group: "Automation",
    rows: [
      { label: "Language", value: "MQL5" },
      { label: "Trading robots", value: "Expert Advisors" },
      { label: "Strategy Tester", value: "Multi-threaded" },
    ],
  },
];

/** "Learn MT5" outline. Glossary and tool slugs are checked for existence at render. */
export const mt5Learn: { topic: string; line: string; glossary: string[]; tools: string[] }[] = [
  { topic: "Interface", line: "The main window: menus, toolbars, Market Watch, the Navigator, charts and the Toolbox.", glossary: ["metatrader"], tools: [] },
  { topic: "Market Watch", line: "The list of symbols with their bid and ask prices, and the place a new order usually starts.", glossary: ["bid-price", "ask-rate", "spread"], tools: ["spread-visualizer"] },
  { topic: "Charts", line: "Bars, candlesticks or a line; several charts open at once, each on its own symbol.", glossary: ["candlestick", "trend-line"], tools: [] },
  { topic: "Timeframes", line: "The 21 periods a chart can be drawn in, from one minute to one month.", glossary: [], tools: [] },
  { topic: "Indicators", line: "The 38 built-in technical indicators, and how to add one to a chart.", glossary: ["indicator", "moving-average", "rsi", "macd"], tools: [] },
  { topic: "Order types", line: "Market orders and the six pending types, and what makes each one trigger.", glossary: ["market-order", "pending-order", "limit-order", "stop-order"], tools: ["order-anatomy"] },
  { topic: "Positions", line: "What is open, how netting and hedging accounts record it, and how to modify or close it.", glossary: ["open-position", "stop-loss", "take-profit", "hedging"], tools: ["position-size"] },
  { topic: "History", line: "Past orders and deals for the account, and how to read a statement.", glossary: ["fill", "unrealized-p-and-l"], tools: ["profit-loss"] },
  { topic: "Templates", line: "Saving a chart’s set-up so the same view can be applied to another symbol.", glossary: [], tools: [] },
  { topic: "Mobile", line: "The mobile terminal: quotes, charts and order entry on a phone.", glossary: [], tools: [] },
  { topic: "Security", line: "Passwords, signing in only to the correct server, and checking that software is the official release.", glossary: [], tools: [] },
];

/** The general sequence. GIO4X's exact steps are published with the server details. */
export const mt5GettingStarted: { title: string; body: string }[] = [
  { title: "Open a GIO4X account", body: "Complete the application and verification. The account type you choose sets your trading conditions." },
  { title: "Receive your trading credentials", body: "A trading login and password for the platform. Keep them private." },
  { title: "Install or open MetaTrader 5", body: "Use only an official release of the platform, on desktop, web or mobile." },
  { title: "Select the server and log in", body: "MetaTrader 5 asks for a server as well as a login. The server must be the one named by GIO4X." },
  { title: "Find an instrument", body: "Add the symbols you intend to follow to Market Watch." },
  { title: "Open a chart and read the order ticket", body: "Know what each field in the ticket does before you use it." },
  { title: "Review the trading conditions", body: "Spread, margin and the stop out level apply from the first trade." },
  { title: "Begin only when ready", body: "There is no deadline. A platform learned slowly is a platform used well." },
];

export const mt5Troubleshooting: string[] = [
  "Cannot log in",
  "Incorrect server",
  "No connection",
  "Invalid account",
  "Charts not updating",
  "Symbol not visible",
  "Order rejected",
  "Platform update",
  "Password reset",
];

export const mt5Trademark = "MetaTrader 5 is a trademark of MetaQuotes Ltd. GIO4X does not own MetaTrader and is independent of MetaQuotes; MetaTrader 5 is third-party platform technology.";

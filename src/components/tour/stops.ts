/**
 * The first-visit tour: eight real pages, in the order a newcomer would ask
 * about them. Each stop's sentences are taken from that page's own opening
 * text, so the tour says nothing the page does not say itself.
 *
 * `target` names one element on the page, marked there with
 * `data-tour="<target>"`, that the tour brings into view and rings. A stop
 * without one simply shows its panel.
 */
export type TourStop = {
  path: string;
  target?: string;
  /** short name of the stop, also used in "Next: …" */
  title: string;
  body: string;
};

export const TOUR_STOPS: TourStop[] = [
  {
    path: "/",
    title: "What GIO4X is",
    body: "GIO4X is a brokerage: six asset classes, traded on MetaTrader 5 and 777 Raptor. Around them is an open library of tools, research and plain disclosure, so you understand a market before you trade it.",
  },
  {
    path: "/markets",
    target: "markets",
    title: "The markets",
    body: "Market Command is one calm overview: what is in session, where the major pairs last fixed, and how each market is built. Every figure carries its source and its date. Open a class in this list to see its instruments.",
  },
  {
    path: "/trading/accounts",
    target: "accounts",
    title: "The three accounts",
    body: "Classic, Premium and ECN. What chiefly separates them is how you pay for trading: through the spread alone, or through a raw spread with a commission shown as its own line. Select an account here to read its character.",
  },
  {
    path: "/platforms",
    target: "platforms",
    title: "The two platforms",
    body: "777 Raptor and MetaTrader 5 are two different trading environments under one roof. Neither is the better one. Further down, the comparison has no winner and no scores, only what each platform documents.",
  },
  {
    path: "/tools",
    target: "tools",
    title: "The tools",
    body: "Calculators and visualisers that work as one system: set a balance or a risk figure in one and it is there in the next. Each shows its formula and the working with your own numbers. None of them tells you what to trade.",
  },
  {
    path: "/academy",
    target: "academy",
    title: "The Academy and glossary",
    body: "Mechanics and concepts, taught in order: from what a currency pair is to how professionals size risk. There are no certificates and no promise that study leads to profit. The glossary defines the terms the lessons use.",
  },
  {
    path: "/trust",
    target: "trust",
    title: "The Trust Centre",
    body: "These pages are built so that you can check what GIO4X says, and see plainly what it has not yet said. Each section ends in something you can test yourself: an address, a header, a formula, a document.",
  },
  {
    path: "/support",
    target: "support",
    title: "Where to get help",
    body: "Open a support request and you are given a reference. Come back with it and your email address to read the reply on this page. For a general question there is the contact form, and the FAQ needs no waiting.",
  },
];

/** The one thing the tour keeps in sessionStorage: `{ "stop": n }`, the stop it has reached, for the length of the visit. */
export const TOUR_KEY = "gx:tour";

/** The address that starts the tour, wherever it is linked from. It is the homepage; the fragment is read and removed. */
export const TOUR_HASH = "#tour";

/**
 * Single-page tours (PageTour.tsx): a first-visit walk round one page. Each
 * is offered once on that page, can be ended at any step, and is started
 * again from /preferences or by a link to the page with the fragment below.
 *
 * Whether one has been offered is kept with the display preferences
 * (`gx:prefs`), as one true/false field per tour beside `tourDone`. Nothing
 * else is stored and nothing is sent.
 */
export type PageTourId = "tools" | "gateway";

/** A step of a single-page tour. `target` is a CSS selector on that page; a step without one simply shows its panel. */
export type PageTourStop = { target?: string; title: string; body: string };

/** The field of `gx:prefs` that records that a page tour was started or declined. */
export const PAGE_TOUR_FLAG: Record<PageTourId, "tourTools" | "tourGateway"> = { tools: "tourTools", gateway: "tourGateway" };

/** Where each page tour lives, and the words that offer it. */
export const PAGE_TOURS: Record<PageTourId, { path: string; name: string; offer: string }> = {
  tools: { path: "/tools", name: "Toolkit tour", offer: "First time in the Toolkit? A few short steps show how the twelve tools fit together." },
  gateway: { path: "/sign-in", name: "Gateway tour", offer: "Not sure which door is yours? A few short steps explain each portal and how to check an address." },
};

/** The fragment that starts a page tour: `/tools#guide`, `/sign-in#guide`. It is read and removed. */
export const PAGE_TOUR_HASH = "#guide";

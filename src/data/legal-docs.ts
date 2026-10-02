import { LOCAL_KEYS } from "@/lib/prefs";
import { PULSE_STATEMENT } from "@/lib/pulse";

/**
 * LEGAL & DOCUMENT CENTRE — the registry.
 *
 * Four documents (Terms, Risk Disclosure, Privacy Policy, AML Policy) are
 * CARRIED OVER from the previous GIO4X website. Their wording is preserved
 * sentence for sentence, with three kinds of exception, every one of which is
 * recorded with the original sentence and the reason in
 * docs/CONTENT-AUDIT-LEGAL.md:
 *   1. sentences containing a flagged or conflicting claim were removed
 *      (a provider-specific retail-loss percentage, a conflicting leverage
 *      maximum, promises of protection, a withdrawal-time promise);
 *   2. one sentence that would be untrue of this website (analytics and
 *      personalisation cookies) was removed;
 *   3. typographic normalisation only (’ and — as real characters).
 * Nothing was added to the body of a carried-over document. Where a removal
 * leaves a gap, an `editor` block says so in a visibly different voice.
 *
 * "Last updated" for carried-over documents is the date printed on the
 * previous site ("March 2026"). The previous site printed no version numbers,
 * so none is invented: the version label says what the text is.
 *
 * Do not write new legal promises here. Changes need the owner's legal review.
 */

export const LEGAL_CATEGORIES = ["Legal", "Trading", "Accounts", "Privacy", "Risk", "Policies"] as const;
export type LegalCategory = (typeof LEGAL_CATEGORIES)[number];

export type LegalBlock =
  /** a paragraph of the document itself */
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; caption: string; head: string[]; rows: string[][] }
  /** the restricted-jurisdictions list from src/data/accounts.ts */
  | { kind: "jurisdictions" }
  /** an editorial note: NOT part of the legal text, rendered in a different voice */
  | { kind: "editor"; text: string; href?: string; linkLabel?: string }
  | { kind: "link"; href: string; label: string };

export type LegalSection = { id: string; title: string; body: LegalBlock[] };

export type LegalDoc = {
  slug: "terms" | "risk" | "privacy" | "aml" | "cookies";
  path: string;
  title: string;
  /** shorter name for lists and navigation */
  short: string;
  category: LegalCategory;
  summary: string;
  version: string;
  /** exactly as printed */
  updated: string;
  origin: "carried-over" | "new";
  /** set in large type before the first section (Risk Disclosure) */
  opening?: string;
  sections: LegalSection[];
  /** closing statement after the last section */
  closing?: string;
  /** search keywords beyond title and summary */
  keywords: string[];
};

/** Shown on every carried-over document. */
export const CARRIED_OVER_NOTICE = "This document is carried over from the previous GIO4X website and is under legal review.";

const p = (text: string): LegalBlock => ({ kind: "p", text });

const CARRIED_VERSION = "Carried-over text";

/* -------------------------------------------------------------------------- */
/* Terms                                                                      */
/* -------------------------------------------------------------------------- */
const terms: LegalDoc = {
  slug: "terms",
  path: "/legal/terms",
  title: "Terms of Service",
  short: "Terms",
  category: "Legal",
  summary: "The terms and conditions governing your use of GIO4X services.",
  version: CARRIED_VERSION,
  updated: "March 2026",
  origin: "carried-over",
  keywords: ["terms and conditions", "agreement", "eligibility", "restricted jurisdictions", "liability", "governing law", "deposits", "withdrawals"],
  sections: [
    {
      id: "introduction",
      title: "Introduction",
      body: [p("These Terms of Service govern your use of GIO4X trading services, platforms, and website. By opening an account or using our services, you agree to be bound by these terms.")],
    },
    {
      id: "eligibility",
      title: "Eligibility",
      body: [
        p("You must be at least 18 years old and a resident of a jurisdiction where trading forex and CFDs is permitted. GIO4X does not offer services to residents of restricted jurisdictions."),
        { kind: "jurisdictions" },
      ],
    },
    {
      id: "account-opening",
      title: "Account Opening",
      body: [p("To open a trading account, you must provide accurate identification and complete our KYC verification process. GIO4X reserves the right to refuse account opening at its sole discretion.")],
    },
    {
      id: "trading-conditions",
      title: "Trading Conditions",
      body: [
        p("Spreads, leverage, commissions, and other trading conditions are specified on our website and may change. GIO4X provides execution on a best-effort basis and does not guarantee specific prices or fill rates."),
        { kind: "link", href: "/trading/conditions", label: "Trading conditions as currently published" },
      ],
    },
    {
      id: "deposits-withdrawals",
      title: "Deposits & Withdrawals",
      body: [
        p("All deposits must originate from accounts in the client’s name. GIO4X may request additional documentation for compliance purposes."),
        {
          kind: "editor",
          text: "One sentence stating a withdrawal processing time was removed from this section: the previous GIO4X websites published several different times and none has been confirmed. Processing times are not yet published.",
          href: "/trust/transparency",
          linkLabel: "What we disclose",
        },
      ],
    },
    {
      id: "risk-acknowledgement",
      title: "Risk Acknowledgement",
      body: [
        p("Trading forex and CFDs involves significant risk of loss. You may lose more than your initial deposit. You should not trade with funds you cannot afford to lose."),
        { kind: "link", href: "/legal/risk", label: "Read the Risk Disclosure" },
      ],
    },
    {
      id: "limitation-of-liability",
      title: "Limitation of Liability",
      body: [p("GIO4X shall not be liable for losses resulting from market movements, technical failures beyond our control, or any indirect, incidental, or consequential damages.")],
    },
    {
      id: "governing-law",
      title: "Governing Law",
      body: [
        p("These terms shall be governed by and construed in accordance with applicable laws. Disputes shall be resolved through arbitration or in the courts of the relevant jurisdiction."),
        {
          kind: "editor",
          text: "The carried-over text does not name a governing law, a court or an arbitration body. That is one of the points under legal review.",
        },
      ],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Risk Disclosure                                                            */
/* -------------------------------------------------------------------------- */
const risk: LegalDoc = {
  slug: "risk",
  path: "/legal/risk",
  title: "Risk Disclosure",
  short: "Risk Disclosure",
  category: "Risk",
  summary: "Please read this risk disclosure carefully before opening an account or placing any trades with GIO4X.",
  version: CARRIED_VERSION,
  updated: "March 2026",
  origin: "carried-over",
  keywords: ["risk warning", "CFD", "leverage", "margin", "gapping", "volatility", "short selling", "insolvency", "past performance"],
  opening:
    "Trading foreign exchange, CFDs, and other derivative products carries a high level of risk and may not be suitable for all investors. You should carefully consider your objectives, financial situation, and risk tolerance before trading. You may lose more than your initial investment.",
  sections: [
    {
      id: "what-are-cfds",
      title: "What Are CFDs",
      body: [
        p(
          "CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. You should consider whether you understand how CFDs work and whether you can afford to take the high risk of losing your money. A Contract for Difference (CFD) is a derivative financial instrument that allows traders to speculate on price movements of underlying assets without owning them. When trading CFDs, you enter into a contract with GIO4X to exchange the difference in the value of an asset from when the contract is opened to when it is closed.",
        ),
        {
          kind: "editor",
          text: "One sentence giving a percentage of retail client accounts that lose money was removed. The previous GIO4X websites published two different figures and neither was sourced. A figure will be published only when it is calculated from GIO4X’s own client data.",
        },
      ],
    },
    {
      id: "no-investment-advice",
      title: "No Investment Advice",
      body: [
        p(
          "GIO4X does not provide investment advice. Any information provided by GIO4X is for general informational purposes only and should not be construed as investment advice. You should seek independent financial advice before making any investment decisions. GIO4X employees are not authorized to provide personal investment recommendations. Market analysis, research reports, and educational materials are provided for informational purposes only and do not constitute a recommendation to buy or sell any financial instrument.",
        ),
      ],
    },
    {
      id: "product-appropriateness",
      title: "Product Appropriateness",
      body: [
        p(
          "CFDs may not be suitable for all investors. Before trading, you should carefully consider your investment objectives, level of experience, and risk appetite. You should not invest money that you cannot afford to lose. You should be aware of all the risks associated with CFD trading and seek advice from an independent financial advisor if you have any doubts.",
        ),
      ],
    },
    {
      id: "general-risks",
      title: "General Risks of CFD Trading",
      body: [
        p(
          "The value of CFDs can fluctuate significantly due to market conditions. Past performance is not indicative of future results. You may sustain a total loss of your initial investment and may be required to deposit additional funds to maintain your position. CFD trading involves significant risk of loss. The high degree of leverage that is often obtainable in CFD trading can work against you as well as for you. Currency rates may fluctuate significantly over short periods.",
        ),
      ],
    },
    {
      id: "short-selling",
      title: "Short Selling Risks",
      body: [
        p(
          "Short selling involves selling an asset that you do not own in the expectation that the price will fall. If the price rises instead, losses are theoretically unlimited. Short selling carries specific risks including the obligation to buy back at a higher price, potential for unlimited losses, and the risk of short squeezes where rapid price increases force short sellers to cover positions.",
        ),
      ],
    },
    {
      id: "currency-risk",
      title: "Currency Risk",
      body: [
        p(
          "If you trade in a currency other than your base currency, exchange rate fluctuations may affect your profits and losses. Currency risk applies to all transactions denominated in a currency different from your account’s base currency.",
        ),
      ],
    },
    {
      id: "volatility-risk",
      title: "Volatility Risk",
      body: [
        p(
          "Financial markets can be extremely volatile. Prices can change rapidly and significantly, particularly during economic announcements, geopolitical events, and periods of market stress. Volatility can result in significant gains or losses in a very short period.",
        ),
      ],
    },
    {
      id: "gapping-risk",
      title: "Gapping Risk",
      body: [
        p(
          "Prices may gap between trading sessions or during high-impact news events. A gap occurs when the market price moves significantly between two consecutive trading periods without any trading occurring in between. Stop-loss orders may not be executed at the specified price during gap events, resulting in greater losses than anticipated.",
        ),
      ],
    },
    {
      id: "leverage-and-margin",
      title: "Leverage and Margin",
      body: [
        p(
          "Trading on margin means that you are borrowing money to trade, which amplifies both potential gains and losses. A small adverse market movement can result in substantial losses that exceed your initial deposit. Margin calls may require you to deposit additional funds at short notice. If you fail to meet a margin call, your positions may be liquidated at a loss.",
        ),
        {
          kind: "editor",
          text: "One sentence stating a maximum leverage figure was removed: the previous GIO4X websites published conflicting maxima. The leverage available to you depends on the instrument, the account and your jurisdiction.",
          href: "/trading/accounts",
          linkLabel: "Account types as currently published",
        },
      ],
    },
    {
      id: "electronic-trading",
      title: "Electronic Trading Risks",
      body: [
        p(
          "Trading via electronic platforms carries risks including system failures, communication failures, internet connectivity issues, and software malfunctions. GIO4X is not liable for losses resulting from system failures or delays in order execution due to technical issues. During periods of high market activity, you may experience delays in order execution.",
        ),
      ],
    },
    {
      id: "corporate-actions",
      title: "Corporate Actions",
      body: [
        p(
          "If you hold CFDs on stocks or indices, corporate actions such as dividends, stock splits, mergers, or delistings may affect the value of your position. GIO4X will make reasonable efforts to reflect corporate actions in your account, but timing and adjustments may vary.",
        ),
      ],
    },
    {
      id: "insolvency",
      title: "Insolvency",
      body: [
        p("However, there is no guarantee that all funds will be recovered."),
        {
          kind: "editor",
          text: "Two sentences were removed from this section: one described how client funds would be protected in an insolvency “in accordance with applicable regulations” without naming any, and one made a statement about the company’s capital that this site cannot evidence. The sentence that remains is the cautious half of the original and is kept word for word, which is why it begins with “However”. What GIO4X has published about client funds, and what it has not, is set out on a separate page.",
          href: "/trust/client-funds",
          linkLabel: "Client funds",
        },
      ],
    },
    {
      id: "past-performance",
      title: "Past Performance",
      body: [
        p(
          "Past performance is not a reliable indicator of future results. Historical trading results do not guarantee future profits. Market conditions change, and strategies that were profitable in the past may not be profitable in the future.",
        ),
      ],
    },
    {
      id: "regulatory-risk",
      title: "Regulatory Risk",
      body: [
        p(
          "Changes in laws, regulations, or government policies may adversely affect your trading activities, the value of your investments, or the ability of GIO4X to provide services. Regulatory requirements may vary by jurisdiction.",
        ),
      ],
    },
    {
      id: "third-party-risk",
      title: "Third-Party Risk",
      body: [
        p(
          "GIO4X may rely on third-party service providers for certain aspects of its operations, including liquidity providers, payment processors, and technology providers. Failures or issues with third-party providers may affect GIO4X’s ability to provide services.",
        ),
      ],
    },
  ],
  closing:
    "GIO4X, a subsidiary of 777 Capital Markets Limited (UK), Company No. 17049134. By opening an account with GIO4X, you acknowledge that you have read, understood, and accepted this Risk Disclosure document in its entirety. This document does not disclose all of the risks and other significant aspects of trading leveraged products. You should not deal in these products unless you understand their nature and the extent of your exposure to risk.",
};

/* -------------------------------------------------------------------------- */
/* Privacy                                                                    */
/* -------------------------------------------------------------------------- */
const privacy: LegalDoc = {
  slug: "privacy",
  path: "/legal/privacy",
  title: "Privacy Policy",
  short: "Privacy Policy",
  category: "Privacy",
  summary: "How GIO4X collects, uses, and protects your personal information.",
  version: CARRIED_VERSION,
  updated: "March 2026",
  origin: "carried-over",
  keywords: ["personal data", "data protection", "retention", "your rights", "third-party sharing", "cookies"],
  sections: [
    {
      id: "information-we-collect",
      title: "Information We Collect",
      body: [
        p(
          "We collect personal information including name, email, phone number, date of birth, address, and identification documents during account registration. We also collect trading activity data and technical data such as IP addresses and browser information.",
        ),
      ],
    },
    {
      id: "how-we-use-your-information",
      title: "How We Use Your Information",
      body: [
        p(
          "Your information is used to verify your identity, manage your account, process transactions, comply with regulatory requirements, and improve our services. We may also use it to send relevant communications about our products and services.",
        ),
      ],
    },
    {
      id: "data-protection",
      title: "Data Protection",
      body: [
        p("We implement industry-standard security measures including encryption, secure servers, and access controls. Your personal data is stored in compliance with applicable data protection regulations."),
        {
          kind: "editor",
          text: "This section is kept as carried over. What this website itself does, in terms you can check from your own browser, is described separately.",
          href: "/trust/security",
          linkLabel: "Online security",
        },
      ],
    },
    {
      id: "third-party-sharing",
      title: "Third-Party Sharing",
      body: [
        p(
          "We do not sell your personal information. We may share data with regulatory authorities, payment processors, and service providers who assist in operating our business, all under strict confidentiality agreements.",
        ),
      ],
    },
    {
      id: "cookies",
      title: "Cookies",
      body: [
        p("You can manage cookie preferences through your browser settings."),
        {
          kind: "editor",
          text: "One sentence was removed: it said cookies are used to analyse traffic and personalise content, which is not true of this website. This website sets no advertising or analytics cookies. It does count page views, accepted forms and searches as daily totals, without a cookie or any identifier. What it stores in your browser, key by key, and what it counts are set out in the Cookie & Storage Notice.",
          href: "/legal/cookies",
          linkLabel: "Cookie & Storage Notice",
        },
      ],
    },
    {
      id: "your-rights",
      title: "Your Rights",
      body: [p("You have the right to access, correct, delete, or restrict processing of your personal data. To exercise these rights, contact our Data Protection Officer at privacy@gio4x.com.")],
    },
    {
      id: "data-retention",
      title: "Data Retention",
      body: [
        p(
          "We retain personal data for as long as necessary to provide our services and comply with legal obligations. Trading records are retained for a minimum of 5 years as required by financial regulations.",
        ),
      ],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* AML                                                                        */
/* -------------------------------------------------------------------------- */
const aml: LegalDoc = {
  slug: "aml",
  path: "/legal/aml",
  title: "Anti-Money Laundering Policy",
  short: "AML Policy",
  category: "Policies",
  summary: "The identity checks, transaction monitoring, reporting and record keeping GIO4X states it applies to prevent money laundering and terrorist financing.",
  version: CARRIED_VERSION,
  updated: "March 2026",
  origin: "carried-over",
  keywords: ["AML", "KYC", "know your customer", "identity verification", "proof of address", "transaction monitoring", "record keeping"],
  sections: [
    {
      id: "purpose",
      title: "Purpose",
      body: [p("GIO4X is committed to preventing money laundering and terrorist financing. This policy outlines the procedures and controls in place to detect, prevent, and report suspicious activities.")],
    },
    {
      id: "know-your-customer",
      title: "Know Your Customer (KYC)",
      body: [p("All clients must complete identity verification before accessing trading services. Required documents include government-issued photo ID and proof of address dated within the last 3 months.")],
    },
    {
      id: "transaction-monitoring",
      title: "Transaction Monitoring",
      body: [
        p(
          "We monitor all transactions for unusual patterns including large deposits, rapid withdrawals, deposits from multiple sources, and trading patterns inconsistent with the client’s profile.",
        ),
      ],
    },
    {
      id: "reporting",
      title: "Reporting",
      body: [p("Suspicious activities are reported to the relevant financial intelligence units. GIO4X employees are trained to identify red flags and escalate concerns through the proper channels.")],
    },
    {
      id: "record-keeping",
      title: "Record Keeping",
      body: [p("All client identification documents and transaction records are retained for a minimum of 5 years in compliance with regulatory requirements.")],
    },
    {
      id: "staff-training",
      title: "Staff Training",
      body: [p("All employees receive regular AML training to ensure awareness of current regulations, typologies, and reporting obligations.")],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Cookie & Storage Notice (new, written for this website)                    */
/* -------------------------------------------------------------------------- */

/**
 * Purpose of every key in LOCAL_KEYS. Typed against the list in
 * src/lib/prefs.ts, so adding a key there without describing it here fails
 * the type-check.
 */
const LOCAL_KEY_PURPOSE: Record<(typeof LOCAL_KEYS)[number], { holds: string; why: string }> = {
  "gx:prefs": {
    holds: "Theme, colour palette (for a palette of your own, the one or two hue values you chose), density, motion, contrast, text size, effects, whether pointer effects are on, link underlining, time zone, remembered platform, whether TradingView panels load automatically, whether your visits are counted, whether interface sounds are on and at which volume, whether the guided tour has been started or declined, whether Academy lessons open as “Read” or as “Story”,and whether an offline copy may be kept.",
    why: "So the site looks and behaves the way you set it on your next visit.",
  },
  "gx:recent": {
    holds: "The path and title of the last pages you opened, and the last searches you made on this website, once you have switched that list on from My desk.",
    why: "So My desk can list them for you to return to. Until you switch the list on, this key does not exist and nothing about the pages you open is recorded; “Stop and clear this list” removes it again.",
  },
  "gx:saved": {
    holds: "The path and title of each article, lesson, glossary term or tool you chose to save for later.",
    why: "So My desk can list them when you return.",
  },
  "gx:calc": {
    holds: "The figures you typed into the Trader Toolkit calculators.",
    why: "So one tool can reuse the inputs you gave another.",
  },
  "gx:consent": {
    holds: "Your choice about loading third-party content, such as chart frames.",
    why: "So you are not asked the same question on every page.",
  },
  "gx:watch": {
    holds: "Instruments you added to a watchlist.",
    why: "So My desk can list them when you return.",
  },
  "gx:morning-depth": {
    holds: "The reading depth you chose in the Morning Room: quick, standard or deep.",
    why: "So the Morning Room opens at the same depth on your next visit.",
  },
  "gx:boot": {
    holds: "The time the short start-up animation was shown in this browser, or was left out because reduced motion or low visual effects was on.",
    why: "So the animation plays once at most, on the first page of your first visit, and is not shown on later pages or visits.",
  },
  "gx:learn": {
    holds: "The glossary terms whose “Check yourself” question you answered correctly, and the Academy lessons you have completed by answering all three of their questions correctly.",
    why: "So the glossary can mark the terms you have checked and show how many, and the Academy can mark the lessons you have completed and count them by level and by learning path. No score is kept. Each can be cleared where it is shown, with “Start over”: the terms from the glossary, the lessons from the Academy.",
  },
  "gx:sim": {
    holds: "The state of the Practice desk simulation in Labs: its invented prices, the example account, example positions and orders, and the newest journal entries. No real prices, no real account and nothing about you.",
    why: "So a practice session survives a reload. Written only if you tick “Keep this practice session in this browser” on that page, which is off by default; unticking it deletes the key.",
  },
};

const cookies: LegalDoc = {
  slug: "cookies",
  path: "/legal/cookies",
  title: "Cookie & Storage Notice",
  short: "Cookie Notice",
  category: "Privacy",
  summary: "Everything this website stores in your browser, key by key, and how to clear it. There are no advertising or analytics cookies; page views are counted as daily totals without a cookie or an identifier, and that can be switched off.",
  version: "1.7",
  updated: "3 October 2026",
  origin: "new",
  keywords: ["cookies", "local storage", "offline", "service worker", "cache storage", "tracking", "analytics", "advertising", "preferences", "consent"],
  sections: [
    {
      id: "summary",
      title: "The short version",
      body: [
        {
          kind: "list",
          items: [
            "This website sets no advertising cookies and no analytics cookies.",
            "It loads no third-party scripts, so no third party can set a cookie through a script on these pages.",
            "It counts page views, accepted forms and searches itself, as daily totals, with no cookie and no identifier of any kind. Counting is on by default; you can switch it off, and a Global Privacy Control or Do Not Track signal from your browser is honoured.",
            "It keeps a small number of display and convenience settings in your browser’s local storage. They stay on your device and are not sent to GIO4X.",
            "For the length of a visit it may keep three items in session storage: an announcement you closed, a live chat you started, and the stop a guided tour has reached.",
            "An authentication cookie is set only for GIO4X staff who sign in to the internal console. Visitors to the public site do not receive it.",
            "So that the calculators and pages you have opened still open without a connection, it keeps copies of them in your browser’s cache storage. The copies are sent nowhere and can be removed or switched off.",
          ],
        },
      ],
    },
    {
      id: "cookies",
      title: "Cookies",
      body: [
        {
          kind: "table",
          caption: "Cookies set by this website",
          head: ["Cookie", "Who receives it", "Purpose"],
          rows: [["Staff authentication cookie", "GIO4X staff who sign in to the internal console", "Keeps a signed-in staff session. Not set for visitors to the public pages."]],
        },
        p("That is the complete list. There is no consent banner on this website because it sets no advertising or analytics cookie. Visits are counted without a cookie, as described under “Counting visits” below."),
        p("Besides that cookie, the staff console keeps the look a member of staff has chosen for it, and the state of its guided tour, in that member of staff’s own browser (local and session storage); neither is sent anywhere, and visitors to the public pages never receive them."),
      ],
    },
    {
      id: "local-storage",
      title: "Local storage",
      body: [
        p("Local storage is a small store inside your own browser. Unlike a cookie, its contents are not sent with each request. This website uses the following keys."),
        {
          kind: "table",
          caption: "Local-storage keys used by this website",
          head: ["Key", "What it holds", "Why"],
          rows: LOCAL_KEYS.map((k) => [k, LOCAL_KEY_PURPOSE[k].holds, LOCAL_KEY_PURPOSE[k].why]),
        },
        p("A key is written only when you use the feature it belongs to. If you never change a setting, use a tool or answer the invitation to the guided tour, nothing is stored."),
        p(
          "The My desk page gathers the watchlist, saved pages, recent list, calculator figures and learning progress on one screen. It reads them from this browser and sends them nowhere. From that page you can export these keys, with your display preferences, to a file that your browser saves on your device, and import such a file in another browser. The file is created and read inside your browser; it is not uploaded to GIO4X.",
        ),
        { kind: "link", href: "/desk", label: "My desk" },
      ],
    },
    {
      id: "session-storage",
      title: "Session storage",
      body: [
        p("Session storage is like local storage, but the browser empties it when you close the tab. This website uses three keys there."),
        {
          kind: "table",
          caption: "Session-storage keys used by this website",
          head: ["Key", "What it holds", "Why"],
          rows: [
            ["gx:announcement:dismissed", "The text of an announcement line you closed.", "So the same announcement is not shown again during this visit. A new announcement is shown."],
            [
              "gx:chat",
              "The identifier and access token of a live chat you started.",
              "So the conversation continues when you move to another page. The token is sent to GIO4X’s database with each chat message, which is how the conversation is recognised as yours. It is removed when the chat ends.",
            ],
            ["gx:tour", "The number of the stop a guided tour has reached.", "So the tour continues when it takes you to the next page, and after a reload. It is removed when the tour ends, and it is not sent anywhere."],
          ],
        },
        p("None of the three is written unless you close an announcement, start a chat or start the guided tour."),
      ],
    },
    {
      // What public/sw.js does, in the visitor's words. Keep the two in step (docs/OFFLINE.md).
      id: "offline-copy",
      title: "Offline copy",
      body: [
        p(
          "If you switch it on, a small program supplied by this website itself (a service worker) keeps copies in your browser’s cache storage, so that part of this website still opens without a connection. It is off until you switch it on, on the preferences page or My desk. Cache storage is a store inside your own browser, separate from cookies and from local storage.",
        ),
        p("What is kept:"),
        {
          kind: "list",
          items: [
            "The Trader Toolkit page and each calculator, the My desk page and the page shown when you are offline. These are fetched once, a few seconds after a page has loaded, and renewed about once a day.",
            "A copy of each public page you open, up to the 50 most recent, without any query string. The system status page and the support pages are never kept.",
            "This website’s own scripts, styles, fonts, logo and icons, so that a kept page can be displayed.",
          ],
        },
        p("What it does not do:"),
        {
          kind: "list",
          items: [
            "Nothing is sent anywhere. The copies stay in your browser and are read only by your browser.",
            "While you are connected you always receive the current page from the website. A copy is shown only when the request for a page fails.",
            "It does not keep or intercept anything from the staff console, any form you submit, live chat, the counting of visits, or anything from another website such as TradingView.",
          ],
        },
        p(
          "To remove it: use “Remove the offline copy” on the preferences page, which also stops it being made again until you switch it back on (that choice is kept in the gx:prefs key); or clear this website’s data in your browser. “Clear everything stored by GIO4X on this device” empties the copies as well; with the offline copy still switched on, they are made again as you open pages.",
        ),
        p("The website can also be installed as an app from the My desk and preferences pages, where your browser offers that. The installed app is this website in its own window; it stores nothing beyond what this notice lists."),
        { kind: "link", href: "/preferences#offline", label: "Offline copy: the control" },
      ],
    },
    {
      // The wording lives in src/lib/pulse.ts (PULSE_STATEMENT) and is shown to staff, word for word, above the figures in the console.
      id: "counting-visits",
      title: "Counting visits",
      body: [
        p(PULSE_STATEMENT.intro),
        p("What is counted:"),
        { kind: "list", items: [...PULSE_STATEMENT.counted] },
        p("What is not collected:"),
        { kind: "list", items: [...PULSE_STATEMENT.notCollected] },
        p("Your choice:"),
        { kind: "list", items: [...PULSE_STATEMENT.controls] },
        { kind: "link", href: "/preferences#counting", label: "Count my visits: the switch" },
      ],
    },
    {
      id: "third-party-content",
      title: "Third-party content",
      body: [
        p(
          "Some pages can show content supplied by TradingView: a price chart on each instrument page; an economic calendar on the Economic Events page and in the Morning Room; a market overview and a ticker tape on the Market Command page; and heat maps, cross rates and quote tables on the asset-class pages and the Currency Strength page. Each is an embedded frame that is loaded only when you ask for it. Once loaded, the frame is TradingView’s own page: it may set its own cookies under its own domain, governed by TradingView’s privacy policy, and this website cannot read them. No TradingView script runs on this website’s own pages.",
        ),
        p(
          "On the preferences page you can choose to have TradingView frames load automatically. That choice is off by default and is kept in the gx:prefs key with your display settings. While it is on, each frame loads as it scrolls into view, without a further question, and connects your browser to TradingView at that moment. Switching it off, or clearing what this website has stored, returns every frame to waiting for its button.",
        ),
        p("Reference exchange rates are fetched by GIO4X’s server, not by your browser, so the rate provider does not see your visit."),
        p(
          "The announcement line, live chat, the notices on the Status page and the support hours are read by your browser directly from GIO4X’s hosted database project. That host sits behind a network provider (Cloudflare), which may set its own short-lived security cookie on the database’s address, not on this website’s. This website cannot read it and does not use it.",
        ),
      ],
    },
    {
      id: "your-controls",
      title: "Your controls",
      body: [
        p("You can review and change every display setting, switch the counting of your visits off, or clear everything this website has stored in your browser, from the preferences page. Clearing your browser’s site data has the same effect."),
        p("The offline copy is removed, and switched off or on, from the same page. Single items (one watched instrument, one saved page, the recent list, the calculator figures) can be removed from My desk."),
        { kind: "link", href: "/preferences", label: "Display & privacy preferences" },
      ],
    },
    {
      id: "changes",
      title: "Changes to this notice",
      body: [
        p("If this website begins to store anything else in your browser, or to count anything else, this notice will be updated before the change is released, and the date and version above will change with it."),
        p("Questions about this notice can be sent to info@gio4x.com."),
      ],
    },
  ],
};

export const legalDocs: LegalDoc[] = [terms, risk, privacy, aml, cookies];

export function getLegalDoc(slug: LegalDoc["slug"]): LegalDoc {
  const doc = legalDocs.find((d) => d.slug === slug);
  if (!doc) throw new Error(`Unknown legal document: ${slug}`);
  return doc;
}

/**
 * Documents a client would reasonably expect to find here and that GIO4X has
 * not yet published. Listed so their absence is stated, not hidden.
 */
export const unpublishedDocs: { title: string; category: LegalCategory; note: string }[] = [
  { title: "Order execution policy", category: "Trading", note: "How orders are routed, priced and filled." },
  { title: "Swap and financing schedule", category: "Trading", note: "Overnight rates per instrument." },
  { title: "Funding fees and processing times", category: "Accounts", note: "Deposit and withdrawal methods, costs and timings." },
  { title: "Client agreement by account type", category: "Accounts", note: "The contract for each account, naming the contracting entity." },
  { title: "Complaints procedure", category: "Policies", note: "How to complain, who answers and by when." },
  { title: "Regulatory status statement", category: "Legal", note: "The supervising authority, if any, with a register reference." },
];

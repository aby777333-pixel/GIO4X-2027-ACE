/**
 * TRADING and PARTNERS content.
 *
 * Publishing rule (see .tmp/facts.md): a GIO4X-specific statement appears here
 * only if both previous GIO4X websites agree on it, or it is an unflagged,
 * non-performance statement from the newer site. Anything the two sites
 * disagree on (fees, processing times, payment methods, minimums, rebate and
 * profit-share percentages, partner counts) is recorded as PENDING and the UI
 * renders "Not yet published". General explanations of how an arrangement
 * works are education, not claims about GIO4X.
 */
import { accounts, type AccountKey } from "./accounts";

/* ── Hub ────────────────────────────────────────────────────────────────── */

export const tradingIndex: { group: string; items: { href: string; name: string; line: string; detail: string }[] }[] = [
  {
    group: "The account",
    items: [
      { href: "/trading/accounts", name: "Account types", line: "Three accounts that differ mainly in how you pay for trading.", detail: "Classic · Premium · ECN" },
      { href: "/trading/conditions", name: "Trading conditions", line: "Indicative spread, leverage and minimum size, instrument by instrument.", detail: "Six asset classes" },
      { href: "/trading/funding", name: "Funding and withdrawals", line: "How money moves in and out, and which details are confirmed in your client area.", detail: "Eleven accepted currencies" },
    ],
  },
  {
    group: "Ways to participate",
    items: [
      { href: "/trading/copy-trading", name: "Copy trading", line: "Mirroring another trader’s positions in your own account: the mechanics and the risks.", detail: "Mechanics and risks" },
      { href: "/trading/pamm", name: "PAMM", line: "Allocating funds to a manager who trades one pooled account on behalf of many.", detail: "Results shared by allocation" },
    ],
  },
  {
    group: "Working with GIO4X",
    items: [
      { href: "/partners", name: "Introducing Brokers", line: "For those who introduce clients to GIO4X and support them afterwards.", detail: "Partner programme" },
      { href: "/partners/money-managers", name: "Money managers", line: "For those who trade on behalf of others across several accounts.", detail: "Multi-account management" },
    ],
  },
  {
    group: "Work the numbers",
    items: [{ href: "/tools", name: "Trader Toolkit", line: "Calculators and visualisers that show their formulae and never tell you what to trade.", detail: "Position size · Margin · Cost Lab" }],
  },
];

/* ── Accounts: how you pay, with a worked example ───────────────────────── */

export const accountCharacter: Record<AccountKey, { pricing: string; pay: string; consider: string }> = {
  classic: {
    pricing: "Spread only",
    pay: "The cost of a trade is built into the spread. There is no separate commission line, so what you see between bid and ask is what you pay.",
    consider: "The simplest account to reason about, and the lowest minimum deposit. The spread is the widest of the three.",
  },
  premium: {
    pricing: "Spread only, tighter",
    pay: "Priced the same way as Classic, with a narrower minimum spread and no commission. It adds an account manager and priority support.",
    consider: "For traders who want commission-free pricing but trade often enough for the narrower spread to matter.",
  },
  ecn: {
    pricing: "Raw spread plus commission",
    pay: "The spread is close to the underlying market, and the cost of dealing is charged separately as a fixed commission per lot.",
    consider: "For traders who measure cost per trade and prefer to see it as its own line. It carries the highest minimum deposit.",
  },
};

/** USD value of one pip on one standard lot of EUR/USD: 0.0001 × 100,000. */
export const EURUSD_PIP_VALUE = 10;

export type CostExample = { key: AccountKey; name: string; pips: number; spreadCost: number; commission: number; total: number };

/**
 * Worked example, computed from the published account figures: the cost of
 * opening one standard lot of EUR/USD at the account's minimum ("from") spread.
 * It is arithmetic on minimums, not a quote.
 */
export function costExamples(): CostExample[] {
  return accounts.map((a) => {
    const pips = Number.parseFloat(a.spreadFrom);
    const commission = /\d/.test(a.commission) ? Number.parseFloat(a.commission.replace(/[^0-9.]/g, "")) : 0;
    const spreadCost = pips * EURUSD_PIP_VALUE;
    return { key: a.key, name: a.name, pips, spreadCost, commission, total: spreadCost + commission };
  });
}

/** Stated on the newer GIO4X site (accounts FAQ and AML notice), unflagged. */
export const accountDocuments: { label: string; detail: string }[] = [
  { label: "Proof of identity", detail: "A government-issued photo ID: a passport or national identity card." },
  { label: "Proof of address", detail: "A recent utility bill or bank statement, dated within the last three months." },
];

export const accountEligibility = "You must be at least 18 years old and resident in a jurisdiction where trading forex and CFDs is permitted.";

export const accountPending: string[] = [
  "Which platforms each account type is offered on",
  "How long verification takes",
  "Whether the ECN commission is charged per side or per round turn",
  "Demo account terms",
  "Base currencies available for each account",
];

/* ── Conditions: plain explanations ─────────────────────────────────────── */

export const costConcepts: { key: string; name: string; plain: string; glossary: string; tool: { slug: string; label: string } }[] = [
  {
    key: "spread",
    name: "Spread",
    plain: "The distance between the price you can sell at and the price you can buy at. You cross it when you open a position, so a trade starts slightly behind and the market must move by the spread before it breaks even.",
    glossary: "spread",
    tool: { slug: "spread-visualizer", label: "Spread, visualised" },
  },
  {
    key: "commission",
    name: "Commission",
    plain: "A separate charge for dealing, quoted per lot. On the ECN account it replaces most of the cost that the other accounts carry inside a wider spread.",
    glossary: "ecn",
    tool: { slug: "cost-lab", label: "Cost Lab" },
  },
  {
    key: "swap",
    name: "Swap",
    plain: "The financing adjustment applied when a position is held overnight. It reflects the interest-rate difference between the two sides of the trade and can be a debit or a credit.",
    glossary: "swap",
    tool: { slug: "cost-lab", label: "Cost Lab" },
  },
  {
    key: "margin",
    name: "Margin",
    plain: "The part of your balance set aside while a position is open. It is not a fee. It is determined by the size of the position and the leverage on the instrument.",
    glossary: "margin",
    tool: { slug: "margin", label: "Margin calculator" },
  },
];

/* ── Funding ────────────────────────────────────────────────────────────── */

/** Identical list on both previous GIO4X websites. */
export const fundingCurrencies = ["AUD", "USD", "GBP", "EUR", "AED", "SGD", "CAD", "CHF", "HKD", "INR", "NZD"];

/** Statements both previous sites agree on (or newer-site, unflagged, non-performance). */
export const fundingConfirmed: { title: string; body: string }[] = [
  { title: "Payments in your own name", body: "Deposits must come from an account held in the same name as your GIO4X trading account, and withdrawals are paid only to an account in that name. Third-party payments are not accepted." },
  { title: "Withdrawals return to their source", body: "Where applicable, a withdrawal goes back to the method the money came from. A card can be refunded only up to the amount deposited from that card; anything above that is paid to a bank account in your name." },
  { title: "Verification before the first withdrawal", body: "Your identity is verified before a first withdrawal is released, and further documents may be requested for compliance purposes." },
  { title: "Charges outside GIO4X", body: "Banks, intermediary banks and payment providers may apply their own transfer or conversion charges. Those are set by them and are your responsibility." },
];

export const fundingPending: { label: string; why: string }[] = [
  { label: "Payment methods", why: "The two previous websites list different methods." },
  { label: "Deposit and withdrawal fees", why: "Previously published figures contradict one another." },
  { label: "Processing times and cut-off", why: "Several different timings were published." },
  { label: "Minimum and maximum amounts", why: "Previously published minimums differ." },
  { label: "Availability by country", why: "Not stated consistently." },
];

export const fundingExplainers: { title: string; body: string }[] = [
  {
    title: "Why the name must match",
    body: "A broker has to know whose money it is holding. Accepting a payment from, or sending one to, somebody other than the account holder is how accounts are used to move money for other people. The same-name rule is an anti-money-laundering control, and it protects you: nobody else can direct your funds to themselves.",
  },
  {
    title: "Why verification comes before withdrawal",
    body: "Paying money out is the moment at which identity matters most. Verification confirms that the person asking is the person who owns the account. It is done once, with a photo ID and a recent proof of address, and is simplest to complete before you need it.",
  },
  {
    title: "Why processing takes time",
    body: "A withdrawal passes through several hands. The request is checked against the account; the payment is instructed; then the card network, bank or payment provider moves it on its own timetable. A broker controls the first two steps and not the third, which is why a transfer can be sent promptly and still take days to arrive, and longer around weekends and bank holidays.",
  },
  {
    title: "Why money goes back the way it came",
    body: "Returning funds to their source closes the loop: the same instrument, in the same name. It is also why profits above the amount you deposited by card travel a different route, normally to a bank account in your name.",
  },
];

export const fundingFlow: { step: string; who: string; note: string }[] = [
  { step: "You instruct a payment", who: "You", note: "From an account in your own name." },
  { step: "The provider moves it", who: "Bank or payment provider", note: "On its own timetable, possibly with its own charges." },
  { step: "The deposit is credited", who: "GIO4X", note: "To the trading account you nominated." },
  { step: "You request a withdrawal", who: "You", note: "In your client area, once verified." },
  { step: "The request is checked and sent", who: "GIO4X", note: "Back to the source, in your name." },
  { step: "The provider delivers it", who: "Bank or payment provider", note: "Arrival time depends on the method." },
];

/* ── Copy trading ───────────────────────────────────────────────────────── */

export const copyTrading = {
  what: [
    "Copy trading is an arrangement in which trades placed by one trader, usually called a provider, are reproduced automatically in the accounts of the people who choose to follow that trader.",
    "The positions are opened in your own account, with your own money, at your own risk. You are not handing funds to the provider. You are giving an instruction that your account should do what theirs does, in proportion.",
  ],
  mechanics: [
    { title: "A provider trades their own account", body: "Every order the provider places becomes a signal." },
    { title: "The signal is scaled to your account", body: "Your copy is sized according to the amount you allocated, not the provider’s balance." },
    { title: "The trade is placed in your account", body: "It is filled at the price available at that moment, which may differ from the provider’s price." },
    { title: "You can stop at any time", body: "Pausing or ending the subscription is your decision. What happens to positions already open depends on the settings and should be understood beforehand." },
    { title: "The provider is paid from profits", body: "A share of the profit a copier makes is normally paid to the provider. The rate and the schedule are terms of the programme." },
  ],
  /** The four steps both previous GIO4X websites describe, in the same order. */
  gioSteps: ["Open a trading account", "Complete the copy-trading subscription", "Subscribe to a provider", "Monitor your portfolio"],
  gioAgreed: ["A stop loss and a take profit can be set on what you copy.", "The amount you allocate to copying can be adjusted."],
  pending: ["Provider profit share and when it is paid", "Minimum amount to start copying", "How many providers you may copy at once", "How many copiers a provider may have", "How providers are assessed before they are listed", "Any other fees"],
  risks: [
    { title: "Past results are not a forecast", body: "A provider’s history tells you what happened, under those conditions, at that size. It does not tell you what will happen next." },
    { title: "Your fills will differ", body: "A copied order reaches the market after the provider’s. In a fast market the difference in price, known as slippage, can be material." },
    { title: "Leverage copies too", body: "If the provider trades with high leverage, so does your copy. A drawdown that is tolerable for them may be a stop out for you." },
    { title: "Size does not always scale", body: "Minimum trade sizes mean a small allocation cannot always reproduce a provider’s position exactly. The risk you actually carry may differ from theirs." },
    { title: "Their incentives are not yours", body: "A provider paid from profits is rewarded for gains and does not share your losses." },
    { title: "Delegating is still deciding", body: "Choosing a provider is a trading decision, and the account remains your responsibility." },
  ],
  questions: [
    "How long is the provider’s record, and does it cover a period when markets fell?",
    "What was the largest drawdown, and how long did recovery take?",
    "How much leverage does the provider typically use?",
    "What exactly is the provider paid, and when?",
    "What happens to my open positions if I stop copying, or if the provider stops trading?",
    "Can I set my own stop on the whole allocation?",
    "How much of my capital am I prepared to lose on this, and is that the amount I have allocated?",
  ],
};

/* ── PAMM ───────────────────────────────────────────────────────────────── */

export const pamm = {
  what: [
    "PAMM stands for Percentage Allocation Management Module. A manager trades a single master account; investors allocate funds to it; and the result of every trade is shared among them in proportion to what each has allocated.",
    "It differs from copy trading in one important way. With copy trading, trades are reproduced in your account and you can intervene. In a PAMM arrangement the manager trades the pool, and an investor’s control is limited to allocating and withdrawing.",
  ],
  mechanics: [
    { title: "A manager opens a master account", body: "And publishes the terms on which others may allocate to it." },
    { title: "Investors allocate funds", body: "Each investor’s share of the pool is their allocation as a percentage of the whole." },
    { title: "The manager trades the pool as one account", body: "Investors do not place or modify trades." },
    { title: "Results are distributed by percentage", body: "Profit and loss are divided according to each investor’s share at the time." },
    { title: "The manager’s fee is taken from profits", body: "Normally a performance fee on net new profit, set out in the manager’s terms." },
    { title: "Allocations change at the end of a trading period", body: "Adding or withdrawing funds takes effect when the current period closes, so that shares can be recalculated fairly." },
  ],
  /** Both previous GIO4X websites agree on these. */
  gioAgreed: ["GIO4X offers PAMM accounts for both managers and investors.", "Funds are added or withdrawn at the end of a trading period, not in the middle of one."],
  pending: ["Minimum allocation", "Length of a trading period", "Manager performance fees and how they are calculated", "How managers are assessed before they may accept investors", "The platform on which PAMM accounts run", "Where the full terms can be read"],
  risks: [
    { title: "You do not control the trading", body: "Once allocated, your funds are traded at the manager’s discretion. You cannot close a position you disagree with." },
    { title: "You may not be able to leave immediately", body: "A withdrawal waits for the end of the trading period. Losses can continue in the meantime." },
    { title: "Past results are not a forecast", body: "A manager’s record describes the past. It is not evidence about the future." },
    { title: "Fees change the arithmetic", body: "A performance fee is taken in good periods and not refunded in bad ones. Understand how a high-water mark, if any, is applied." },
    { title: "Leverage belongs to the manager", body: "The pool can lose value quickly, and your share falls with it." },
    { title: "A manager is not your adviser", body: "A PAMM manager trades a strategy. They do not assess whether it suits your circumstances." },
  ],
  questions: [
    "Who is the manager, and how long is the record I am being shown?",
    "What is the largest loss the account has had, peak to trough?",
    "What fee is charged, on what, and is there a high-water mark?",
    "How long is a trading period, and when can I withdraw?",
    "Does the manager have their own money in the account?",
    "What leverage is used, and is there a limit on losses at which the account stops trading?",
    "Where are the full terms, and have I read them?",
  ],
};

/* ── Partners ───────────────────────────────────────────────────────────── */

export const introducingBrokers = {
  what: [
    "An Introducing Broker introduces clients to a brokerage and is paid for the trading activity of the clients they introduce. The IB does not hold client money and does not execute trades: accounts are opened with, and held by, the broker.",
    "The role is a responsibility as much as a business. An IB speaks for the firm to the people they introduce, which is why what an IB may say about trading, and how, is governed by the partner agreement.",
  ],
  who: [
    { title: "Educators and communities", body: "People who teach trading or run a community and are asked, often, which broker they use." },
    { title: "Local representatives", body: "Those who can support clients in a language or a region where they are already trusted." },
    { title: "Technology and tool providers", body: "Developers whose users need a brokerage account to use what they have built." },
    { title: "Existing clients", body: "Traders who find themselves recommending GIO4X anyway." },
  ],
  /** The four application steps both previous GIO4X websites describe. */
  steps: [
    { title: "Apply", body: "Complete the partner application." },
    { title: "Verification", body: "GIO4X verifies the application and the applicant." },
    { title: "Onboarding", body: "You are taken through the programme and how referrals are tracked." },
    { title: "Begin", body: "You start introducing clients." },
  ],
  gioAgreed: ["An IB may have sub-IBs beneath them.", "A Partner Loyalty Programme with quarterly rewards has been described on both previous GIO4X websites."],
  pending: ["Rebate amounts", "When and how partners are paid", "How many sub-IB levels there are", "The terms of the loyalty programme", "The partner agreement and marketing rules", "The partner portal address"],
  duties: [
    "Describe trading honestly: it is high risk, and most of what an IB says should begin there.",
    "Never promise returns, never give personal investment advice, never handle a client’s funds or passwords.",
    "Use only approved marketing material, and carry the risk warning wherever it is required.",
    "Make it clear to those you introduce that you are paid for doing so.",
  ],
};

export const moneyManagers = {
  what: [
    "A money manager trades on behalf of other people. Instead of logging in to each client’s account in turn, the manager places a trade once, and it is allocated across the accounts under management according to rules agreed in advance.",
    "In the usual structure the manager is given authority to trade, not custody of the money: clients do not transfer funds to the manager.",
  ],
  who: [
    { title: "Professional traders with clients of their own", body: "Who need to trade several accounts as one." },
    { title: "PAMM managers", body: "Who run a pooled master account and accept allocations from investors." },
    { title: "Firms and family offices", body: "That manage capital for a defined group under an agreed mandate." },
  ],
  /** Capabilities both previous GIO4X websites describe. */
  gioAgreed: [
    { title: "Multi-account management", body: "Trading across several client accounts from a single login." },
    { title: "PAMM and MAM arrangements", body: "Pooled and multi-account structures for allocating trades." },
    { title: "Flexible fee options", body: "More than one way of structuring the manager’s fee." },
    { title: "Reporting", body: "Reporting on the accounts under management." },
  ],
  /** Newer-site sequence, unflagged. */
  steps: [
    { title: "Apply", body: "Tell GIO4X who you are and how you trade." },
    { title: "Verification", body: "Your identity and standing are verified." },
    { title: "Set-up", body: "The master account and allocation method are configured." },
    { title: "Launch", body: "You begin trading the accounts under management." },
  ],
  pending: ["Fee models offered and how they are calculated", "Leverage and conditions on managed accounts", "Limits on the number of managed accounts", "The platform and software used", "The manager agreement and what authorisation a manager needs in their own jurisdiction"],
  duties: [
    "Managing other people’s money requires authorisation in many jurisdictions. Whether you need it where you and your clients live is your responsibility to establish.",
    "A client must give written authority before you trade their account, and can withdraw it.",
    "Report results as they are, including the losing periods.",
  ],
};

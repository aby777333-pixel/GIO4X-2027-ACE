/**
 * Account types.
 *
 * Headline specifications are the ones GIO4X published on BOTH its previous
 * sites (and which agree with each other): minimum deposit, spread from,
 * commission, swap, minimum trade size, margin call and stop out.
 * Where the two previous sites disagreed (maximum leverage, bundled extras),
 * the value is recorded in docs/WAITING-FOR-ABE.md and shown as "up to" or
 * left out, never resolved by guesswork.
 */

export type AccountKey = "classic" | "premium" | "ecn";

export type Account = {
  key: AccountKey;
  name: string;
  /** who it suits, as previously published */
  suits: string;
  /** one-sentence character */
  line: string;
  minDeposit: string;
  spreadFrom: string;
  commission: string;
  leverage: string;
  swap: string;
  minTrade: string;
  marginCall: string;
  stopOut: string;
  execution: string;
  extras: string[];
};

export const accounts: Account[] = [
  {
    key: "classic",
    name: "Classic",
    suits: "Those starting out",
    line: "Commission-free pricing with the spread as the only trading cost. A sensible first account.",
    minDeposit: "$150",
    spreadFrom: "2.5 pips",
    commission: "None",
    leverage: "Up to 1:500",
    swap: "Applies",
    minTrade: "0.01 lots",
    marginCall: "100%",
    stopOut: "30%",
    execution: "Market execution",
    extras: [],
  },
  {
    key: "premium",
    name: "Premium",
    suits: "Experienced traders",
    line: "Tighter commission-free spreads, with an account manager and priority support.",
    minDeposit: "$500",
    spreadFrom: "1.5 pips",
    commission: "None",
    leverage: "Up to 1:500",
    swap: "Applies",
    minTrade: "0.01 lots",
    marginCall: "100%",
    stopOut: "30%",
    execution: "Market execution",
    extras: ["Account manager", "Priority support"],
  },
  {
    key: "ecn",
    name: "ECN",
    suits: "Professionals",
    line: "Raw spreads with a fixed commission per lot, for those who measure cost per trade.",
    minDeposit: "$2,000",
    spreadFrom: "0.2 pips",
    commission: "$3.50 per lot",
    leverage: "Up to 1:500",
    swap: "Swap-free",
    minTrade: "0.01 lots",
    marginCall: "100%",
    stopOut: "30%",
    execution: "Market execution",
    extras: ["Dedicated account manager", "Priority support"],
  },
];

export const accountRows: { key: keyof Account; label: string; term?: string }[] = [
  { key: "minDeposit", label: "Minimum deposit" },
  { key: "spreadFrom", label: "Spread from", term: "spread" },
  { key: "commission", label: "Commission" },
  { key: "leverage", label: "Leverage", term: "leverage" },
  { key: "swap", label: "Overnight swap", term: "swap" },
  { key: "minTrade", label: "Minimum trade", term: "lot" },
  { key: "marginCall", label: "Margin call level", term: "margin-call" },
  { key: "stopOut", label: "Stop out level" },
  { key: "execution", label: "Execution", term: "market-order" },
];

/** Services are not available to residents of these jurisdictions (list as published on both previous sites). */
export const restrictedJurisdictions = [
  "Afghanistan", "Belarus", "Burma", "Burundi", "Central African Republic", "China", "Congo", "Cuba", "Egypt", "Guinea", "Guinea-Bissau", "Iraq", "Iran", "Indonesia", "Lebanon", "Lesotho", "Libya", "Malaysia", "Maldives", "Mali", "Moldova", "Nicaragua", "Nigeria", "North Korea", "Pakistan", "Russia", "Somalia", "Sudan", "South Sudan", "Syria", "Tunisia", "Turkey", "Vanuatu", "Venezuela", "Yemen", "Zimbabwe",
];

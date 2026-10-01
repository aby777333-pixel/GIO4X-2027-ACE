import { getNode } from "@/data/graph";

/** Connect the Dots keeps its selection in `?n=id,id,id` so a set can be shared. */
export const PICK_PARAM = "n";
export const MAX_PICKS = 5;
export const MIN_PICKS = 2;

/** Shown when the page is opened without a selection: a worked example, labelled as one. */
export const EXAMPLE_PICKS = ["i:xau-usd", "ccy:USD", "cb:fed", "ev:cpi"];

export const SUGGESTED_SETS: { name: string; ids: string[] }[] = [
  { name: "Gold, the dollar, the Fed and CPI", ids: ["i:xau-usd", "ccy:USD", "cb:fed", "ev:cpi"] },
  { name: "EUR/USD and its two central banks", ids: ["i:eur-usd", "cb:ecb", "cb:fed"] },
  { name: "The yen, the carry trade and rate decisions", ids: ["i:usd-jpy", "c:carry-trade", "ev:interest-rate-decision"] },
  { name: "Leverage, margin and drawdown", ids: ["c:leverage", "c:margin", "c:drawdown", "t:margin"] },
  { name: "Oil, the Canadian dollar and inflation", ids: ["i:brent", "ccy:CAD", "c:inflation"] },
];

/** Parse a raw `n` value into valid, unique node ids. `undefined` (no parameter at all) yields the example. */
export function parsePicks(raw: string | null | undefined): string[] {
  if (raw === undefined || raw === null) return EXAMPLE_PICKS;
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id && getNode(id) && !out.includes(id)) out.push(id);
    if (out.length >= MAX_PICKS) break;
  }
  return out;
}

export const picksQuery = (ids: string[]) => `?${PICK_PARAM}=${ids.join(",")}`;

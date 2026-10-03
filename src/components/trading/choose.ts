/**
 * ACCOUNT CHOOSER: the questions, and how an answer is matched to an account.
 *
 * Every fact the chooser states is read from src/data/accounts.ts at the
 * moment it is used: the minimum deposit, the minimum spread, the commission,
 * the overnight swap, what is included and who each account was published as
 * suiting. Nothing here adds a condition of its own. The match is a count of
 * published facts that agree with the answers; it is not advice, and it says
 * so on the page.
 *
 * The answers are four short codes (never free text), so the page can also
 * work as a plain GET form: /trading/accounts/choose?e=new&d=1&p=simple&n=no.
 * They describe a preference, not a person, and nothing is stored or sent
 * anywhere else.
 */
import { accounts, type Account, type AccountKey } from "@/data/accounts";

export type QuestionKey = "e" | "d" | "p" | "n";
export type Answers = Partial<Record<QuestionKey, string>>;
export type Option = { value: string; label: string; note?: string };
export type Question = { key: QuestionKey; legend: string; hint: string; options: Option[] };

/* ---- the published facts, as numbers ------------------------------------------ */

const amount = (s: string): number => Number(s.replace(/[^0-9.]/g, "")) || 0;
const minDeposit = (a: Account) => amount(a.minDeposit);
const spread = (a: Account) => Number.parseFloat(a.spreadFrom);
const hasCommission = (a: Account) => /\d/.test(a.commission);
const swapFree = (a: Account) => /free/i.test(a.swap);

/** the accounts from the lowest minimum deposit up, as published */
const byDeposit = [...accounts].sort((a, b) => minDeposit(a) - minDeposit(b));
const widest = [...accounts].sort((a, b) => spread(b) - spread(a))[0];
const tightest = [...accounts].sort((a, b) => spread(a) - spread(b))[0];

/** Which account was published as suiting each level of experience. */
const EXPERIENCE: Record<string, AccountKey> = { new: "classic", some: "premium", pro: "ecn" };

/** Deposit bands are cut at the published minimums, so each band is exactly "which accounts can be opened with this". */
const depositOptions: Option[] = [
  { value: "0", label: `Less than ${byDeposit[0].minDeposit}` },
  ...byDeposit.map((a, i) => ({
    value: String(i + 1),
    label: i + 1 < byDeposit.length ? `${a.minDeposit} or more, but less than ${byDeposit[i + 1].minDeposit}` : `${a.minDeposit} or more`,
  })),
];

export const questions: Question[] = [
  {
    key: "e",
    legend: "How much trading have you done?",
    hint: "Each account was published with the kind of trader it suits.",
    options: [
      { value: "new", label: "I am starting out" },
      { value: "some", label: "I have traded before and know the mechanics" },
      { value: "pro", label: "I trade professionally, or as seriously as one" },
    ],
  },
  {
    key: "d",
    legend: "How much do you expect to deposit first?",
    hint: "The bands are the three published minimum deposits. This is a preference, not a commitment: deposit only what you can afford to lose.",
    options: depositOptions,
  },
  {
    key: "p",
    legend: "What matters most to you?",
    hint: "One answer. The other qualities are still shown in the result.",
    options: [
      { value: "simple", label: "Simplicity", note: "One cost to follow, with no separate commission" },
      { value: "spread", label: "A tight spread", note: "The narrowest published minimum spread" },
      { value: "cost", label: "Cost per trade, in the open", note: "The dealing cost shown as its own line" },
      { value: "support", label: "Someone to speak to", note: "An account manager and priority support" },
      { value: "deposit", label: "The lowest minimum deposit" },
    ],
  },
  {
    key: "n",
    legend: "Do you expect to hold positions overnight?",
    hint: "A position held past the daily rollover may carry an overnight swap.",
    options: [
      { value: "yes", label: "Yes, often" },
      { value: "no", label: "Rarely or never" },
    ],
  },
];

/** Keep only answers that are one of a question's own options. Anything else in the address is ignored. */
export function readAnswers(source: Record<string, string | string[] | undefined>): Answers {
  const out: Answers = {};
  for (const q of questions) {
    const raw = source[q.key];
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (typeof v === "string" && q.options.some((o) => o.value === v)) out[q.key] = v;
  }
  return out;
}

export const complete = (a: Answers): boolean => questions.every((q) => typeof a[q.key] === "string");

/* ---- the match ------------------------------------------------------------------- */

export type Match = {
  /** the closest match among the accounts the stated deposit can open; null when it can open none */
  account: Account | null;
  /** published facts that agree with the answers */
  reasons: string[];
  /** published facts worth weighing against it */
  weigh: string[];
  /** an account that agreed with more answers but needs a larger first deposit */
  beyond: { account: Account; reasons: string[] } | null;
  /** the other accounts the deposit can open, for comparison */
  others: Account[];
};

function reasonsFor(a: Account, ans: Answers): string[] {
  const r: string[] = [];
  if (EXPERIENCE[ans.e ?? ""] === a.key) r.push(`It was published as suiting “${a.suits.toLowerCase()}”, which is how you described yourself.`);
  switch (ans.p) {
    case "simple":
      if (!hasCommission(a)) r.push(`There is no commission (${a.commission.toLowerCase()}), so the spread, from ${a.spreadFrom}, is the only dealing cost to follow.`);
      break;
    case "spread":
      if (a.key === tightest.key) r.push(`Its minimum spread, from ${a.spreadFrom}, is the narrowest of the three.`);
      else if (a.key !== widest.key) r.push(`Its minimum spread, from ${a.spreadFrom}, is narrower than ${widest.name}’s ${widest.spreadFrom}.`);
      break;
    case "cost":
      if (hasCommission(a)) r.push(`The dealing cost is charged as its own line, ${a.commission}, beside a spread from ${a.spreadFrom}.`);
      break;
    case "support":
      if (a.extras.length) r.push(`It includes: ${a.extras.join(" and ").toLowerCase()}.`);
      break;
    case "deposit":
      if (a.key === byDeposit[0].key) r.push(`Its minimum deposit, ${a.minDeposit}, is the lowest of the three.`);
      break;
  }
  if (ans.n === "yes" && swapFree(a)) r.push(`Overnight swap is listed as “${a.swap.toLowerCase()}” on this account.`);
  return r;
}

function weighFor(a: Account, ans: Answers): string[] {
  const w: string[] = [];
  if (a.key === widest.key) w.push(`Its minimum spread, from ${a.spreadFrom}, is the widest of the three.`);
  if (hasCommission(a)) w.push(`A commission of ${a.commission} is charged in addition to the spread. Whether that is per side or per round turn has not been published.`);
  if (ans.n === "yes" && !swapFree(a)) w.push(`Overnight swap is listed as “${a.swap.toLowerCase()}”: positions held past the daily rollover are charged or credited, and the account specification lists no rate.`);
  if (a.extras.length === 0) w.push("No account manager or priority support is listed for it.");
  if (a.key === byDeposit[byDeposit.length - 1].key) w.push(`It carries the highest minimum deposit, ${a.minDeposit}.`);
  w.push(`Leverage is listed as “${a.leverage.toLowerCase()}”. Higher leverage increases risk as much as exposure.`);
  return w;
}

/** The answers, matched. Returns null until every question has an answer. */
export function match(ans: Answers): Match | null {
  if (!complete(ans)) return null;
  const band = Number(ans.d);
  // band n can open the n accounts with the lowest minimums
  const open = byDeposit.slice(0, band);
  const scored = accounts.map((a) => ({ a, reasons: reasonsFor(a, ans) }));
  const rank = (list: typeof scored) =>
    [...list].sort((x, y) => y.reasons.length - x.reasons.length || minDeposit(x.a) - minDeposit(y.a));

  const eligible = rank(scored.filter((s) => open.some((o) => o.key === s.a.key)));
  const top = eligible[0] ?? null;
  const overall = rank(scored)[0];
  const beyond = overall && (!top || (overall.a.key !== top.a.key && overall.reasons.length > top.reasons.length)) ? { account: overall.a, reasons: overall.reasons } : null;

  return {
    account: top?.a ?? null,
    reasons: top?.reasons ?? [],
    weigh: top ? weighFor(top.a, ans) : [],
    beyond,
    others: eligible.slice(1).map((s) => s.a),
  };
}

export const lowestAccount = byDeposit[0];

/** The address of a result, for the plain form and for sharing: the four codes and nothing else. */
export function resultHref(ans: Answers): string {
  const q = questions.flatMap((x) => (ans[x.key] ? [`${x.key}=${encodeURIComponent(ans[x.key] as string)}`] : []));
  return `/trading/accounts/choose${q.length ? `?${q.join("&")}` : ""}`;
}

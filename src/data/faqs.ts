import raw from "./generated/faqs.json";

/**
 * Help and FAQ.
 *
 * Answers carried over from the previous site are general education or facts
 * both previous sites agree on (see docs/CONTENT-AUDIT.md). Where every
 * earlier answer had to be withdrawn, an `open` entry says plainly that the
 * information is not yet published and where to ask.
 */
export type FaqCategory = { key: string; label: string; blurb: string };

export type Faq = {
  id: string;
  cat: string;
  /** `open`: the honest answer is "not yet published" */
  kind: "answer" | "open";
  q: string;
  a: string;
  links?: { label: string; href: string }[];
};

type FaqData = { categories: FaqCategory[]; items: Faq[] };
const data = raw as unknown as FaqData;

/**
 * Corrections to carried answers, by id: the answer here replaces the one in
 * generated/faqs.json, which is never edited by hand.
 * - what-is-forex-trading: quoted a daily turnover figure with no source or
 *   date, which the editorial standards do not allow.
 * - what-is-the-fomc: called the FOMC a "branch" of the Federal Reserve that
 *   sets interest rates; it is the Fed's committee, and it sets a target range
 *   for the federal funds rate.
 */
const corrections: Record<string, string> = {
  "what-is-forex-trading":
    "Forex (foreign exchange) trading is the buying and selling of currencies on the global market to profit from changes in exchange rates. It is the largest financial market in the world by turnover, which the Bank for International Settlements measures in a survey every three years. Traders speculate on whether a currency will rise or fall relative to another.",
  "what-is-the-fomc":
    "The FOMC (Federal Open Market Committee) is the committee of the US Federal Reserve that decides monetary policy, chiefly by setting a target range for the federal funds rate. It holds eight scheduled meetings a year, and its decisions directly affect the US dollar and global financial markets. Traders closely watch FOMC statements for clues about future rate changes.",
};

export const faqs: Faq[] = data.items.map((f) => (corrections[f.id] ? { ...f, a: corrections[f.id] } : f));
/** Only categories that have at least one entry. */
export const faqCategories: FaqCategory[] = data.categories.filter((c) => faqs.some((f) => f.cat === c.key));
export const faqsIn = (cat: string) => faqs.filter((f) => f.cat === cat);

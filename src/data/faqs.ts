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

export const faqs: Faq[] = data.items;
/** Only categories that have at least one entry. */
export const faqCategories: FaqCategory[] = data.categories.filter((c) => faqs.some((f) => f.cat === c.key));
export const faqsIn = (cat: string) => faqs.filter((f) => f.cat === cat);

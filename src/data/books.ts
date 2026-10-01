import raw from "./generated/books.json";

/**
 * The Academy reading list.
 *
 * A bibliography, not a shop: no covers, ratings, page counts or purchase
 * links. Descriptions were trimmed of every "GIO4X recommends…" sentence in
 * the editorial audit (docs/CONTENT-AUDIT.md).
 */
export type Book = {
  slug: string;
  title: string;
  author: string;
  category: string;
  /** year of first publication, or of the edition described */
  year: number;
  description: string;
  /** what the book covers, as short points */
  lessons: string[];
};

export const books: Book[] = raw as Book[];

/** Categories in reading order, each sorted by author surname. */
const ORDER = ["Fundamental Analysis", "Technical Analysis", "Price Action", "Risk Management", "Market Psychology", "Algorithmic Trading", "Options & Derivatives", "Wealth Management"];
const surname = (author: string) => author.split(/\s*&\s*/)[0].trim().split(" ").pop() ?? author;

export const bookCategories: { category: string; books: Book[] }[] = [...new Set([...ORDER, ...books.map((b) => b.category)])]
  .map((category) => ({
    category,
    books: books.filter((b) => b.category === category).sort((a, b) => surname(a.author).localeCompare(surname(b.author)) || a.year - b.year),
  }))
  .filter((g) => g.books.length > 0);

/** "Lien, Kathy" / "Brooks, Kathleen and Brian Dolan" */
export function authorLastFirst(author: string): string {
  const [first, ...rest] = author.split(/\s*&\s*/);
  const parts = first.trim().split(" ");
  const last = parts.pop() ?? first;
  const lead = parts.length ? `${last}, ${parts.join(" ")}` : last;
  return rest.length ? `${lead} and ${rest.join(" and ")}` : lead;
}

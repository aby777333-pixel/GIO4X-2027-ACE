import raw from "./generated/books.json";

/**
 * The Academy reading list.
 *
 * A bibliography, not a shop: no covers, ratings or page counts, and GIO4X
 * sells nothing here. Descriptions were trimmed of every "GIO4X recommends…"
 * sentence in the editorial audit (docs/CONTENT-AUDIT.md).
 *
 * Each entry carries two outside links (see `bookLinks`): a search for the
 * book at a bookseller and a search of a library catalogue. They are SEARCH
 * addresses built from the entry's own title and first author, because no
 * product address or ISBN in this data has been checked. They carry no
 * affiliate tag and no tracking parameter: GIO4X earns nothing from them, and
 * the page says so. Keep that true. Both hosts are in the approved
 * third-party registry (src/config/destinations.ts).
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
  /**
   * The exact address of the book at a seller, when the owner supplies one
   * (https only, no affiliate tag). It replaces the bookseller search link.
   * Unset for every entry today. A new seller's host must be added to the
   * approved third-party registry before its address is used here.
   */
  buyUrl?: string;
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

export type BookLink = {
  kind: "seller" | "library";
  /** visible wording: says what the link is (a search at that seller, or the seller's own page) */
  label: string;
  href: string;
};

/** An owner-supplied address is used only if it is a plain https address without credentials. */
function httpsUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" && !u.username && !u.password ? u : null;
  } catch {
    return null;
  }
}

/** What is searched for: the title and the first author, exactly as the entry gives them. */
const searchTerms = (b: Book) => `${b.title} ${b.author.split(/\s*&\s*/)[0].trim()}`;

/**
 * The two outside links of an entry. The bookseller link is a search of
 * Amazon's book department unless `buyUrl` is set; the library link is a
 * search of WorldCat, the catalogue of library holdings run by OCLC.
 */
export function bookLinks(b: Book): BookLink[] {
  const q = encodeURIComponent(searchTerms(b));
  const exact = httpsUrl(b.buyUrl);
  return [
    exact
      ? { kind: "seller", label: `View at ${exact.hostname.replace(/^www\./, "")}`, href: exact.href }
      : { kind: "seller", label: "Find at Amazon", href: `https://www.amazon.com/s?k=${q}&i=stripbooks` },
    { kind: "library", label: "Find in a library", href: `https://search.worldcat.org/search?q=${q}` },
  ];
}

/** "Lien, Kathy" / "Brooks, Kathleen and Brian Dolan" */
export function authorLastFirst(author: string): string {
  const [first, ...rest] = author.split(/\s*&\s*/);
  const parts = first.trim().split(" ");
  const last = parts.pop() ?? first;
  const lead = parts.length ? `${last}, ${parts.join(" ")}` : last;
  return rest.length ? `${lead} and ${rest.join(" and ")}` : lead;
}

/**
 * The website's FAQ: what the public page, the console and the server actions
 * share.
 *
 * The questions in the code (src/data/faqs.ts) are the base. Rows in
 * `faq_entries` (supabase/migrations/0016_faq.sql), written in GIO4X Control,
 * replace a question's text, leave a question off the page, or add a new one.
 * `mergeFaqs` puts the two together.
 *
 * Pure functions only: nothing here reads the database, the clock or the
 * browser, and nothing is imported at run time, so the same code runs on the
 * page, in the editor as someone types, in the action when the form arrives,
 * and in scripts/test-faq-merge.mjs.
 */
import type { Faq, FaqCategory } from "@/data/faqs";
import type { FaqCategoryKey, FaqEntryPublic, FaqStatus } from "@/lib/supabase/types";

export const FAQ_PATH = "/faq";

/** Must equal `faq_entries_category_valid` in 0016_faq.sql and the category keys in src/data/generated/faqs.json. */
export const FAQ_CATEGORY_KEYS = ["getting-started", "accounts", "trading-basics", "margin-leverage", "orders", "platforms", "funding", "security", "partners"] as const satisfies readonly FaqCategoryKey[];

export const FAQ_STATUSES = ["draft", "published", "hidden"] as const satisfies readonly FaqStatus[];

/** Limits. Must equal the checks in 0016_faq.sql. */
export const FAQ_LIMITS = { questionMin: 10, question: 200, answerMin: 10, answer: 4000, positionMax: 9999, baseId: 96 } as const;

/** Where a new question goes when nobody says otherwise: after the code's questions. */
export const FAQ_DEFAULT_POSITION = 1000;
/** The code's questions stand at 10, 20, 30… within their category, so a new one can be placed between two of them. */
export const FAQ_SLOT_STEP = 10;

export const isFaqCategory = (value: unknown): value is FaqCategoryKey => typeof value === "string" && (FAQ_CATEGORY_KEYS as readonly string[]).includes(value);
export const isFaqStatus = (value: unknown): value is FaqStatus => typeof value === "string" && (FAQ_STATUSES as readonly string[]).includes(value);

const BASE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** The shape of a question's id in the code. Whether such a question exists is a separate matter. */
export const isFaqBaseId = (value: unknown): value is string => typeof value === "string" && value.length >= 1 && value.length <= FAQ_LIMITS.baseId && BASE_ID.test(value);

/* -------------------------------------------------------------------------- */
/* the merge                                                                  */
/* -------------------------------------------------------------------------- */

/** A question as the page shows it. `md`: the answer came from the console and is restricted Markdown, not plain text. */
export type PublicFaq = Faq & { md?: true };

/** What reading `faq_entries` came to. A page must tell "nothing there" from "could not ask". */
export type FaqRead = { state: "ok"; rows: FaqEntryPublic[] } | { state: "none" } | { state: "failed"; reason: "not-configured" | "unavailable" };

export type MergedFaq = {
  items: PublicFaq[];
  /** only the categories that have at least one question to show */
  categories: FaqCategory[];
  /** false: the list is the code's own, untouched (no rows, none that apply, or the read failed) */
  changed: boolean;
};

/** The id a new question has on the page (`/faq#…`): stable for the life of the row, and not a shape a code id takes. */
export function faqAnchor(rowId: string): string {
  return `q-${rowId.replace(/-/g, "").slice(0, 12)}`;
}

/** The place of each of the code's questions within its own category: 10, 20, 30… */
export function faqSlots(base: readonly Faq[]): Map<string, number> {
  const slots = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const f of base) {
    const n = (seen.get(f.cat) ?? 0) + 1;
    seen.set(f.cat, n);
    slots.set(f.id, n * FAQ_SLOT_STEP);
  }
  return slots;
}

/**
 * The code's FAQ with the console's changes applied.
 *
 *   · a published row with a base_id replaces that question's text (and may
 *     move it to another category); it is shown as a settled answer, and the
 *     links listed under the original are not carried over
 *   · a hidden row with a base_id removes that question
 *   · a published row without a base_id is a new question, placed in its
 *     category by `position` among the code's questions (which stand at
 *     10, 20, 30…); at an equal place the code's question comes first
 *   · a draft, a row about a question the code no longer has, and a row in a
 *     category the code does not have change nothing
 *   · when the read failed, or found nothing that applies, the result is the
 *     code's list itself: the same objects in the same order
 */
export function mergeFaqs(base: Faq[], categories: FaqCategory[], read: FaqRead): MergedFaq {
  const untouched: MergedFaq = { items: base, categories: categories.filter((c) => base.some((f) => f.cat === c.key)), changed: false };
  if (read.state !== "ok") return untouched;

  const known = new Set(categories.map((c) => c.key));
  const baseIds = new Set(base.map((f) => f.id));
  const about = new Map<string, FaqEntryPublic>();
  const added: FaqEntryPublic[] = [];
  for (const row of read.rows) {
    if (row.status !== "published" && row.status !== "hidden") continue;
    if (row.base_id !== null) {
      // the table allows one row for a question; if two ever arrived, the first stands
      if (baseIds.has(row.base_id) && !about.has(row.base_id)) about.set(row.base_id, row);
    } else if (row.status === "published" && known.has(row.category)) {
      added.push(row);
    }
  }
  if (!about.size && !added.length) return untouched;

  const slots = faqSlots(base);
  type Placed = { faq: PublicFaq; slot: number; fromCode: boolean; order: number };
  const placed: Placed[] = [];
  const used = new Set<string>();

  base.forEach((f, order) => {
    const row = about.get(f.id);
    const slot = slots.get(f.id) ?? FAQ_DEFAULT_POSITION;
    if (!row) {
      placed.push({ faq: f, slot, fromCode: true, order });
      used.add(f.id);
    } else if (row.status === "published") {
      placed.push({ faq: { id: f.id, cat: known.has(row.category) ? row.category : f.cat, kind: "answer", q: row.question, a: row.answer, md: true }, slot, fromCode: true, order });
      used.add(f.id);
    }
    // hidden: left out
  });

  [...added]
    .sort((x, y) => x.position - y.position || x.question.localeCompare(y.question, "en") || x.id.localeCompare(y.id))
    .forEach((row, order) => {
      const short = faqAnchor(row.id);
      const id = used.has(short) ? `q-${row.id}` : short;
      used.add(id);
      placed.push({ faq: { id, cat: row.category, kind: "answer", q: row.question, a: row.answer, md: true }, slot: row.position, fromCode: false, order });
    });

  const rank = new Map(categories.map((c, n) => [c.key, n] as const));
  placed.sort(
    (x, y) =>
      (rank.get(x.faq.cat) ?? 0) - (rank.get(y.faq.cat) ?? 0) || x.slot - y.slot || Number(y.fromCode) - Number(x.fromCode) || x.order - y.order,
  );
  const items = placed.map((p) => p.faq);
  return { items, categories: categories.filter((c) => items.some((f) => f.cat === c.key)), changed: true };
}

/**
 * An answer written in the restricted Markdown, as plain words: for structured
 * data, which carries text and not marks.
 */
export function faqPlainText(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/^(#{2,3} |[-*] |\d+[.)] |> )/, "")
        .replace(/^---+$/, ""),
    )
    .filter(Boolean)
    .join(" ")
    .replace(/!?\[([^\]]*)\]\([^)\s]+(?:\s+"[^"]*")?\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/* -------------------------------------------------------------------------- */
/* what an answer may contain                                                 */
/* -------------------------------------------------------------------------- */

/**
 * An answer is rendered by the blog's renderer, which also understands
 * headings and pictures. Neither belongs inside an answer: the question is
 * itself a heading on the page, and the picture store is the blog's. Says
 * which of the two an answer contains, or null when it has neither. The action
 * refuses such an answer; the editor says why as it is typed.
 */
export function faqAnswerProblem(answer: string): "heading" | "picture" | null {
  for (const raw of answer.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (/^#{2,3} /.test(line)) return "heading";
    if (/^!\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\)$/.test(line)) return "picture";
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* the editorial checklist                                                    */
/* -------------------------------------------------------------------------- */

export type FaqFlag = { key: string; text: string };

/**
 * Wording the site's editorial standards rule out: promises and trading
 * calls. The same list the blog's checklist reads (blog-shared.ts keeps its
 * copy private).
 */
const RULED_OUT: readonly { label: string; pattern: RegExp }[] = [
  { label: "guaranteed", pattern: /\bguaranteed\b/i },
  { label: "risk-free", pattern: /\brisk[\s-]?free\b/i },
  { label: "buy now", pattern: /\bbuy\s+now\b/i },
  { label: "sell now", pattern: /\bsell\s+now\b/i },
  { label: "will rise", pattern: /\bwill\s+rise\b/i },
  { label: "will fall", pattern: /\bwill\s+fall\b/i },
  { label: "sure profit", pattern: /\bsure\s+profits?\b/i },
];

/** The same rule BlogBody applies before it makes a link: a path on this site, or https. */
const SAFE_HREF = /^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/;
const LINK = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/**
 * Reads a question and its answer and says, in plain words, what an editor
 * would point at. Reminders, not rules: nothing here stops a save, and it
 * cannot judge whether an answer is true.
 */
export function faqChecks(draft: { question: string; answer: string }): FaqFlag[] {
  const flags: FaqFlag[] = [];
  const question = draft.question.trim();
  const answer = draft.answer.trim();

  if (question && !question.endsWith("?")) flags.push({ key: "question-mark", text: "The question does not end with a question mark. Every entry on the page is phrased as a question a visitor would ask." });

  // the last thing a reader meets, once closing marks are set aside
  const closing = faqPlainText(answer).replace(/[)\]"'”’*`\s]+$/, "");
  if (closing && !/[.!?]$/.test(closing)) flags.push({ key: "full-stop", text: "The answer does not end with a full stop. An answer is written in whole sentences." });

  if (answer && /<\/?[a-z][^>]*>/i.test(answer)) flags.push({ key: "html", text: "The answer contains what looks like HTML. HTML is not understood: a visitor would see the tags as typed." });

  let badLinks = 0;
  for (const m of answer.matchAll(LINK)) {
    if (m[1] !== "!" && !SAFE_HREF.test(m[3])) badLinks++;
  }
  if (badLinks)
    flags.push({
      key: "links",
      text: `${badLinks === 1 ? "One link points" : `${badLinks} links point`} to an address that is neither a page on this site (starting with /) nor an https address. ${badLinks === 1 ? "It is" : "They are"} shown to visitors as plain text, not as a link.`,
    });

  const problem = faqAnswerProblem(answer);
  if (problem === "heading") flags.push({ key: "heading", text: "The answer contains a heading (a line starting with ##). The question is itself the heading: use paragraphs and lists. It cannot be saved like this." });
  if (problem === "picture") flags.push({ key: "picture", text: "The answer contains a picture. Answers are text only. It cannot be saved like this." });

  const found = RULED_OUT.filter((w) => w.pattern.test(`${question}\n${answer}`)).map((w) => `“${w.label}”`);
  if (found.length)
    flags.push({
      key: "wording",
      text: `The text uses ${found.join(", ")}. The site does not publish trading recommendations or promises about what a market or an account will do. Rewrite the sentence.`,
    });

  return flags;
}

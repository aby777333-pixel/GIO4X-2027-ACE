/**
 * What the Content section's screens and its server actions share: the fixed
 * outcome codes, the intents a save can carry, and how the code's questions
 * and the console's rows are laid side by side for the list.
 *
 * Pure functions only: nothing here reads the database, the clock or the
 * browser.
 */
import type { Faq } from "@/data/faqs";
import { FAQ_DEFAULT_POSITION, faqSlots } from "@/lib/faq";
import type { FaqEntryRow, FaqStatus } from "@/lib/supabase/types";

export const CONTENT_PATH = "/control/content";
export const FAQ_CONSOLE_PATH = "/control/content/faq";

/* -------------------------------------------------------------------------- */
/* outcomes                                                                   */
/* -------------------------------------------------------------------------- */

/** What the save action answers with when nothing was saved. The editor keeps what was typed. */
export type FaqFormState = { error?: FaqErrorCode; fields?: readonly string[] };

export const FAQ_ERRORS = {
  invalid: "That request was not valid. Nothing was saved.",
  forbidden: "Your role cannot do that. Nothing was saved.",
  check: "Check the highlighted fields. Nothing was saved.",
  exists: "This question already has a change saved for it. Open that one from the list instead. Nothing was saved.",
  base: "That question is not in the website’s code any more, so there is nothing to replace or hide. Nothing was saved.",
  gone: "This entry no longer exists.",
  save: "The entry could not be saved. Nothing was changed; please try again.",
} as const;
export type FaqErrorCode = keyof typeof FAQ_ERRORS;

/** A database refusal as a fixed code. Nothing the database said is ever shown. */
export function faqDbError(code: string | undefined): FaqErrorCode {
  if (code === "23505") return "exists";
  if (code === "23514") return "check";
  if (code === "42501") return "forbidden";
  return "save";
}

export const FAQ_NOTICES: Record<string, string> = {
  created: "Draft saved. Nothing has changed on the website.",
  saved: "Saved.",
  published: "Published. It is on the website now.",
  hidden: "Hidden. The question is no longer on the website.",
  restored: "The original is back on the website. Your text is kept here as a draft.",
  withdrawn: "Taken off the website. The entry is kept here as a draft.",
};

/** What a save should do to the entry's status: leave it where it is (a new entry starts as a draft), or publish. */
export const FAQ_INTENTS = ["save", "publish"] as const;
export type FaqIntent = (typeof FAQ_INTENTS)[number];

/* -------------------------------------------------------------------------- */
/* the list                                                                   */
/* -------------------------------------------------------------------------- */

/** Where a question on the list comes from, as the website stands now. */
export type FaqOrigin = "code" | "replaced" | "added" | "hidden";
export const FAQ_ORIGINS = ["code", "replaced", "added", "hidden"] as const satisfies readonly FaqOrigin[];

export const FAQ_ORIGIN_LABEL: Record<FaqOrigin, string> = {
  code: "From the code",
  replaced: "Replaced",
  added: "Added",
  hidden: "Hidden",
};

export const FAQ_LIST_COLUMNS = "id, base_id, category, question, position, status, updated_at";
export type FaqListRow = Pick<FaqEntryRow, "id" | "base_id" | "category" | "question" | "position" | "status" | "updated_at">;

export type FaqListItem = {
  key: string;
  /** where the entry opens */
  href: string;
  origin: FaqOrigin;
  /** the row's status, or null when the question has no row: it is simply the code's */
  status: FaqStatus | null;
  /** the category it is listed under */
  cat: string;
  /** the question as the website shows it now, or as the draft has it when it is not on the website */
  question: string;
  /** whether a visitor sees this question today */
  live: boolean;
  /** its place within the category: the code's questions stand at 10, 20, 30… */
  place: number;
  /** the code marks it "not yet published" and nothing here replaces it */
  open: boolean;
  /** a row about a question the code no longer has: the website ignores it */
  orphan: boolean;
  changedAt: string | null;
};

const rowHref = (id: string) => `${FAQ_CONSOLE_PATH}/${id}`;
export const faqBaseHref = (baseId: string) => `${FAQ_CONSOLE_PATH}/base/${baseId}`;

/**
 * Every question the console knows about, in the order of the website: the
 * code's questions with what each row does to them, the new questions, and
 * (last in their category) rows whose question has left the code.
 */
export function composeFaqList(base: readonly Faq[], rows: readonly FaqListRow[]): FaqListItem[] {
  const slots = faqSlots(base);
  const about = new Map<string, FaqListRow>();
  for (const row of rows) if (row.base_id !== null && !about.has(row.base_id)) about.set(row.base_id, row);
  const baseIds = new Set(base.map((f) => f.id));

  const items: (FaqListItem & { fromCode: boolean; order: number })[] = [];
  base.forEach((f, order) => {
    const row = about.get(f.id);
    const place = slots.get(f.id) ?? FAQ_DEFAULT_POSITION;
    if (!row) {
      items.push({ key: f.id, href: faqBaseHref(f.id), origin: "code", status: null, cat: f.cat, question: f.q, live: true, place, open: f.kind === "open", orphan: false, changedAt: null, fromCode: true, order });
      return;
    }
    const replaced = row.status === "published";
    items.push({
      key: row.id,
      href: rowHref(row.id),
      origin: replaced ? "replaced" : row.status === "hidden" ? "hidden" : "code",
      status: row.status,
      cat: replaced ? row.category : f.cat,
      question: replaced ? row.question : f.q,
      live: row.status !== "hidden",
      place,
      open: !replaced && f.kind === "open",
      orphan: false,
      changedAt: row.updated_at,
      fromCode: true,
      order,
    });
  });

  rows.forEach((row, order) => {
    if (row.base_id !== null && baseIds.has(row.base_id)) return;
    const orphan = row.base_id !== null;
    items.push({
      key: row.id,
      href: rowHref(row.id),
      origin: "added",
      status: row.status,
      cat: row.category,
      question: row.question,
      live: !orphan && row.status === "published",
      // a row whose question has left the code goes after everything else
      place: orphan ? Number.MAX_SAFE_INTEGER : row.position,
      open: false,
      orphan,
      changedAt: row.updated_at,
      fromCode: false,
      order,
    });
  });

  items.sort((x, y) => x.place - y.place || Number(y.fromCode) - Number(x.fromCode) || (x.fromCode ? x.order - y.order : x.question.localeCompare(y.question, "en") || x.order - y.order));
  return items.map((i) => ({ key: i.key, href: i.href, origin: i.origin, status: i.status, cat: i.cat, question: i.question, live: i.live, place: i.place, open: i.open, orphan: i.orphan, changedAt: i.changedAt }));
}

/** The code's questions in each category with their places, for the editor's "where does a new question go". */
export function faqPlaces(base: readonly Faq[]): Record<string, { place: number; q: string }[]> {
  const slots = faqSlots(base);
  const places: Record<string, { place: number; q: string }[]> = {};
  for (const f of base) (places[f.cat] ??= []).push({ place: slots.get(f.id) ?? FAQ_DEFAULT_POSITION, q: f.q });
  return places;
}

/** How many questions stand where, counted from the composed list. */
export type FaqCounts = { live: number; code: number; replaced: number; added: number; hidden: number; drafts: number };

export function countFaqList(items: readonly FaqListItem[]): FaqCounts {
  return {
    live: items.filter((i) => i.live).length,
    code: items.filter((i) => i.origin === "code").length,
    replaced: items.filter((i) => i.origin === "replaced").length,
    added: items.filter((i) => i.origin === "added" && i.live).length,
    hidden: items.filter((i) => i.origin === "hidden").length,
    drafts: items.filter((i) => i.status === "draft").length,
  };
}

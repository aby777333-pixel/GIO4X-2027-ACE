/**
 * The website's FAQ, read for the public page.
 *
 * The questions in the code are the base; the console's changes are rows in
 * `faq_entries`. The read here is made as the anonymous role. The database
 * decides what that role may see (0016_faq.sql: rows that are published or
 * hidden, and only the columns the page needs), so the filter below is a
 * courtesy that lets the index be used; it is not the gate.
 *
 * `publicFaq()` never fails and is never empty: when the project is not
 * configured, the table is not there yet, or the read does not complete, it
 * returns the code's FAQ exactly as written.
 *
 * What is read is kept for FAQ_REVALIDATE seconds under the tag FAQ_CACHE_TAG,
 * so a change made in the console is on the site within about a minute without
 * a deploy; the console's actions make it immediate with
 * revalidateTag(FAQ_CACHE_TAG) and revalidatePath(FAQ_PATH). A failed read is
 * thrown through the cache so that it is never kept.
 */
import { unstable_cache } from "next/cache";
import { faqCategories, faqs } from "@/data/faqs";
import { isFaqCategory, isFaqStatus, mergeFaqs, type FaqRead, type MergedFaq } from "@/lib/faq";
import { createPublicSupabase } from "@/lib/supabase/server";
import { FAQ_PUBLIC_COLUMNS, type FaqEntryPublic } from "@/lib/supabase/types";

/** Seconds the page, and what it read, may be served before the database is asked again. */
export const FAQ_REVALIDATE = 60;
export const FAQ_CACHE_TAG = "faq";
/** More rows than this are not read: the FAQ is a page, not an archive. */
const MAX_ROWS = 500;

/** A row as the page can use it, or null when it is not one (a shape the code does not know). */
function toEntry(row: unknown): FaqEntryPublic | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.question !== "string" || typeof r.answer !== "string") return null;
  if (r.base_id !== null && typeof r.base_id !== "string") return null;
  if (!isFaqCategory(r.category) || !isFaqStatus(r.status)) return null;
  const position = typeof r.position === "number" && Number.isFinite(r.position) ? r.position : 0;
  return { id: r.id, base_id: r.base_id, category: r.category, question: r.question, answer: r.answer, position, status: r.status };
}

async function readEntries(): Promise<FaqRead> {
  const supabase = createPublicSupabase();
  if (!supabase) return { state: "failed", reason: "not-configured" };
  try {
    const { data, error } = await supabase
      .from("faq_entries")
      .select(FAQ_PUBLIC_COLUMNS)
      .in("status", ["published", "hidden"])
      .order("category", { ascending: true })
      .order("position", { ascending: true })
      .order("id", { ascending: true })
      .limit(MAX_ROWS);
    if (error) return { state: "failed", reason: "unavailable" };
    const rows = ((data ?? []) as unknown[]).map(toEntry).filter((r): r is FaqEntryPublic => r !== null);
    return rows.length ? { state: "ok", rows } : { state: "none" };
  } catch {
    return { state: "failed", reason: "unavailable" };
  }
}

class FaqReadFailed extends Error {}

const cachedEntries = unstable_cache(
  async (): Promise<FaqRead> => {
    const result = await readEntries();
    if (result.state === "failed") throw new FaqReadFailed(result.reason);
    return result;
  },
  ["faq-entries"],
  { revalidate: FAQ_REVALIDATE, tags: [FAQ_CACHE_TAG] },
);

/** The console's published and hidden rows, as the anonymous role sees them. */
export async function readFaqEntries(): Promise<FaqRead> {
  if (!createPublicSupabase()) return { state: "failed", reason: "not-configured" };
  try {
    return await cachedEntries();
  } catch (e) {
    return { state: "failed", reason: e instanceof FaqReadFailed && e.message === "not-configured" ? "not-configured" : "unavailable" };
  }
}

/** The FAQ as the website shows it: the code's questions with the console's changes applied. */
export async function publicFaq(): Promise<MergedFaq> {
  return mergeFaqs(faqs, faqCategories, await readFaqEntries());
}

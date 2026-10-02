"use server";

/**
 * Server actions for Content in GIO4X Control: the website's FAQ.
 *
 * The same four steps as src/app/control/actions.ts: who is calling, what they
 * may do, is every field on the allow-list and inside its limit, then the
 * write AS THE SIGNED-IN USER. Column grants, row-level security, the checks
 * and the trigger `faq_entries_before_write` in
 * supabase/migrations/0016_faq.sql have the final say: only content.publish
 * may change what the public sees (publish, hide, take off the website, or
 * edit a row that is published or hidden). The trigger also writes who and
 * when, and the audit entries.
 *
 * Nothing is ever deleted. "Restore the original" and "take off the website"
 * set a row back to a draft; the words stay in the console.
 *
 * Two kinds of outcome, as in the blog's actions:
 *   · saveFaqEntry carries a question and an answer. When it refuses, it
 *     ANSWERS with a fixed code (and the names of the fields to look at)
 *     instead of redirecting, so the editor keeps what was typed.
 *   · setFaqStatus and hideFaqQuestion carry an id and redirect with a fixed
 *     code either way.
 * Nothing a caller typed, and nothing the database said, is ever echoed.
 *
 * The public page keeps what it reads for about a minute (the cache tagged
 * FAQ_CACHE_TAG in src/lib/server/faq.ts). Every action that changes what the
 * public can see tells Next.js to read again, so the change shows at once.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { FAQ_CONSOLE_PATH, FAQ_INTENTS, faqBaseHref, faqDbError, type FaqErrorCode, type FaqFormState, type FaqIntent } from "@/components/control/views/content-shared";
import { faqs } from "@/data/faqs";
import { FAQ_DEFAULT_POSITION, FAQ_LIMITS, FAQ_PATH, faqAnswerProblem, isFaqBaseId, isFaqCategory, isFaqStatus } from "@/lib/faq";
import { FAQ_CACHE_TAG } from "@/lib/server/faq";
import { can, getAccess, SIGN_IN_PATH } from "@/lib/server/staff";
import { cleanLine, cleanText, isUuid } from "@/lib/server/validate";
import type { FaqCategoryKey, FaqStatus } from "@/lib/supabase/types";

async function writer() {
  const access = await getAccess();
  if (access.state === "anonymous") redirect(SIGN_IN_PATH);
  if (access.state !== "staff") redirect("/control");
  return access;
}

/** The website reads again: the cached rows and the FAQ page. Called after a write that touched what the public sees, or saw a moment ago. */
function refreshPublic(): void {
  revalidateTag(FAQ_CACHE_TAG);
  revalidatePath(FAQ_PATH);
}

function isIntent(value: unknown): value is FaqIntent {
  return typeof value === "string" && (FAQ_INTENTS as readonly string[]).includes(value);
}

const text = (formData: FormData, name: string): string => {
  const raw = formData.get(name);
  return typeof raw === "string" ? raw : "";
};

const refuse = (error: FaqErrorCode, fields?: string[]): FaqFormState => (fields?.length ? { error, fields } : { error });

/** A status that is in front of the public: a published row is shown, a hidden row takes a question away. */
const isPublic = (status: FaqStatus) => status !== "draft";

type Fields = { category: FaqCategoryKey; question: string; answer: string; position: number };

/**
 * Every field of the form, normalised and measured against FAQ_LIMITS (which
 * mirror the checks in 0016). `bad` names the fields that are not acceptable;
 * the names are this file's own, never anything the caller sent.
 */
function readFields(formData: FormData): { values: Fields; bad: string[] } {
  const bad: string[] = [];

  const question = cleanLine(text(formData, "question"));
  if (question.length < FAQ_LIMITS.questionMin || question.length > FAQ_LIMITS.question) bad.push("question");

  const answer = cleanText(text(formData, "answer"));
  // a heading or a picture has no place inside an answer (see faqAnswerProblem)
  if (answer.length < FAQ_LIMITS.answerMin || answer.length > FAQ_LIMITS.answer || faqAnswerProblem(answer) !== null) bad.push("answer");

  const categoryRaw = formData.get("category");
  const category: FaqCategoryKey = isFaqCategory(categoryRaw) ? categoryRaw : "getting-started";
  if (!isFaqCategory(categoryRaw)) bad.push("category");

  // empty: the usual place, after the code's questions
  const positionRaw = text(formData, "position").trim();
  let position: number = FAQ_DEFAULT_POSITION;
  if (positionRaw !== "") {
    if (/^\d{1,4}$/.test(positionRaw) && Number(positionRaw) <= FAQ_LIMITS.positionMax) position = Number(positionRaw);
    else bad.push("position");
  }

  return { bad, values: { category, question, answer, position } };
}

/* -------------------------------------------------------------------------- */
/* save: create or edit                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Saves the question and answer in the editor. Without an `id` it creates the
 * entry: a new question, or (with `base_id`) the replacement for a question in
 * the code. The intent says whether it should also be published.
 */
export async function saveFaqEntry(_prev: FaqFormState, formData: FormData): Promise<FaqFormState> {
  const ctx = await writer();
  const mayWrite = can(ctx, "content.write");
  const mayPublish = can(ctx, "content.publish");
  if (!mayWrite && !mayPublish) return refuse("forbidden");

  const intent = formData.get("intent");
  if (!isIntent(intent)) return refuse("invalid");
  if (intent === "publish" && !mayPublish) return refuse("forbidden");

  const idRaw = formData.get("id");
  const { values, bad } = readFields(formData);

  /* ---- a new entry ---- */
  if (idRaw === null || idRaw === "") {
    const baseRaw = text(formData, "base_id").trim();
    let baseId: string | null = null;
    if (baseRaw !== "") {
      // a replacement is for a question the code has today
      if (!isFaqBaseId(baseRaw) || !faqs.some((f) => f.id === baseRaw)) return refuse("base");
      baseId = baseRaw;
    }
    if (bad.length) return refuse("check", bad);
    const status: FaqStatus = intent === "publish" ? "published" : "draft";

    // created_by, updated_by and the timestamps are not sent: the trigger sets them to the caller and the clock
    const { data, error } = await ctx.supabase
      .from("faq_entries")
      .insert({ ...values, base_id: baseId, status })
      .select("id");
    if (error) return refuse(faqDbError(error.code));
    const id = data?.[0]?.id;
    if (!data || data.length !== 1 || !isUuid(id)) return refuse("save");

    if (isPublic(status)) refreshPublic();
    redirect(`${FAQ_CONSOLE_PATH}/${id}?notice=${status === "published" ? "published" : "created"}`);
  }

  /* ---- an entry that exists ---- */
  if (!isUuid(idRaw)) return refuse("invalid");
  // where the entry stands now decides what this caller may do to it
  const current = await ctx.supabase.from("faq_entries").select("id, status").eq("id", idRaw).maybeSingle();
  if (current.error) return refuse("save");
  if (!current.data) return refuse("gone");
  const was = current.data.status;
  const status: FaqStatus = intent === "publish" ? "published" : was;

  // published or hidden, before or after: that is content.publish (the trigger refuses anyone else)
  const publicMatter = isPublic(was) || isPublic(status);
  if (publicMatter && !mayPublish) return refuse("forbidden");
  if (bad.length) return refuse("check", bad);

  // .select() makes a refusal visible: a row that row-level security filters out is simply "0 rows updated"
  const { data, error } = await ctx.supabase
    .from("faq_entries")
    .update({ ...values, status })
    .eq("id", idRaw)
    .select("id");
  if (error) return refuse(faqDbError(error.code));
  if (!data || data.length !== 1) return refuse("forbidden");

  if (publicMatter) refreshPublic();
  redirect(`${FAQ_CONSOLE_PATH}/${idRaw}?notice=${status !== was ? "published" : "saved"}`);
}

/* -------------------------------------------------------------------------- */
/* status alone                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Moves a saved entry to another status without touching its words:
 *   to "draft"      off the website. For a replacement or a hidden question,
 *                   the code's original is back; the row is kept as a draft.
 *   to "hidden"     the question from the code is left off the website.
 *   to "published"  the saved words go on the website as they stand.
 * Every one of these changes what the public sees, so each needs
 * content.publish.
 */
export async function setFaqStatus(formData: FormData): Promise<void> {
  const ctx = await writer();
  const id = formData.get("id");
  const to = formData.get("status");
  if (!isUuid(id)) redirect(`${FAQ_CONSOLE_PATH}?error=invalid`);
  const back = `${FAQ_CONSOLE_PATH}/${id}`;
  if (!isFaqStatus(to)) redirect(`${back}?error=invalid`);
  if (!can(ctx, "content.publish")) redirect(`${back}?error=forbidden`);

  const current = await ctx.supabase.from("faq_entries").select("id, status, base_id").eq("id", id).maybeSingle();
  if (current.error) redirect(`${back}?error=save`);
  if (!current.data) redirect(`${FAQ_CONSOLE_PATH}?error=gone`);
  const was = current.data.status;
  const fromCode = current.data.base_id !== null;
  if (was === to) redirect(`${back}?error=invalid`);
  // only a question that exists in the code can be hidden (the table says so too)
  if (to === "hidden" && !fromCode) redirect(`${back}?error=invalid`);

  const { data, error } = await ctx.supabase.from("faq_entries").update({ status: to }).eq("id", id).select("id");
  if (error) redirect(`${back}?error=${faqDbError(error.code)}`);
  if (!data || data.length !== 1) redirect(`${back}?error=forbidden`);

  refreshPublic();
  const notice = to === "published" ? "published" : to === "hidden" ? "hidden" : fromCode ? "restored" : "withdrawn";
  redirect(`${back}?notice=${notice}`);
}

/**
 * Hides a question that is in the code and has no row yet. A row is made for
 * it, marked hidden, carrying the code's own words (the table wants a question
 * and an answer on every row; they are also what the editor starts from if the
 * question is later replaced instead). If a row already exists for the
 * question, that row is the one that is hidden.
 */
export async function hideFaqQuestion(formData: FormData): Promise<void> {
  const ctx = await writer();
  const baseId = formData.get("base_id");
  if (!isFaqBaseId(baseId)) redirect(`${FAQ_CONSOLE_PATH}?error=invalid`);
  const base = faqs.find((f) => f.id === baseId);
  if (!base) redirect(`${FAQ_CONSOLE_PATH}?error=base`);
  const back = faqBaseHref(base.id);
  if (!can(ctx, "content.publish")) redirect(`${back}?error=forbidden`);

  const existing = await ctx.supabase.from("faq_entries").select("id, status").eq("base_id", base.id).maybeSingle();
  if (existing.error) redirect(`${back}?error=save`);

  if (existing.data) {
    const row = `${FAQ_CONSOLE_PATH}/${existing.data.id}`;
    if (existing.data.status === "hidden") redirect(`${row}?error=invalid`);
    const { data, error } = await ctx.supabase.from("faq_entries").update({ status: "hidden" }).eq("id", existing.data.id).select("id");
    if (error) redirect(`${row}?error=${faqDbError(error.code)}`);
    if (!data || data.length !== 1) redirect(`${row}?error=forbidden`);
    refreshPublic();
    redirect(`${row}?notice=hidden`);
  }

  if (!isFaqCategory(base.cat)) redirect(`${back}?error=check`);
  const { data, error } = await ctx.supabase
    .from("faq_entries")
    .insert({ base_id: base.id, category: base.cat, question: cleanLine(base.q), answer: cleanText(base.a), status: "hidden" })
    .select("id");
  if (error) redirect(`${back}?error=${faqDbError(error.code)}`);
  const id = data?.[0]?.id;
  if (!data || data.length !== 1 || !isUuid(id)) redirect(`${back}?error=save`);

  refreshPublic();
  redirect(`${FAQ_CONSOLE_PATH}/${id}?notice=hidden`);
}

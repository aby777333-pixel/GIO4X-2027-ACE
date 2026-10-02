import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { composeFaqList, countFaqList, FAQ_ERRORS, FAQ_LIST_COLUMNS, type FaqListItem, type FaqListRow } from "@/components/control/views/content-shared";
import { FAQ_SHOW, FaqListView, type FaqShow } from "@/components/control/views/FaqListView";
import { faqCategories, faqs } from "@/data/faqs";
import { can, requireStaff } from "@/lib/server/staff";
import { cleanLine } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Help & FAQ", "/control/content/faq");

/** A search is a few words: each must appear in the question. */
const MAX_WORDS = 5;

const shows = (item: FaqListItem, show: FaqShow): boolean => (show === "draft" ? item.status === "draft" : show === "added" ? item.origin === "added" : item.origin === show);

/**
 * Every question of the FAQ: the code's list with the console's rows laid over
 * it. The rows are read as the signed-in user (content.read sees drafts). The
 * filter and the search words arrive as query parameters; the filter is
 * checked against an allow-list, and the words are matched here, in memory,
 * against a list that is partly in the code, so they never reach the database.
 */
export default async function FaqListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "content.read")) return <NoAccess title="Help & FAQ" />;

  const params = await searchParams;
  const showParam = firstParam(params.show);
  const show: FaqShow | "" = (FAQ_SHOW as readonly string[]).includes(showParam) ? (showParam as FaqShow) : "";
  const words = cleanLine(firstParam(params.q).slice(0, 100))
    .toLowerCase()
    .split(" ")
    .filter((w) => w.length > 1)
    .slice(0, MAX_WORDS);

  const { data, error } = await ctx.supabase.from("faq_entries").select(FAQ_LIST_COLUMNS).order("updated_at", { ascending: false }).limit(1000);
  const failed = !!error;
  const all = composeFaqList(faqs, failed ? [] : ((data ?? []) as FaqListRow[]));

  const items = all.filter((item) => (!show || shows(item, show)) && words.every((w) => item.question.toLowerCase().includes(w)));
  const errorCode = firstParam(params.error);

  return (
    <FaqListView
      items={items}
      categories={faqCategories}
      // a figure that could not be counted is not shown
      counts={failed ? null : countFaqList(all)}
      show={show}
      q={words.join(" ")}
      canAdd={can(ctx, "content.write") || can(ctx, "content.publish")}
      failed={failed}
      error={Object.hasOwn(FAQ_ERRORS, errorCode) ? FAQ_ERRORS[errorCode as keyof typeof FAQ_ERRORS] : undefined}
    />
  );
}

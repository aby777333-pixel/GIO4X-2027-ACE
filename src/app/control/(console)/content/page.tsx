import Link from "next/link";
import { NoAccess } from "@/components/control/bits";
import { controlMeta } from "@/components/control/format";
import { composeFaqList, countFaqList, FAQ_LIST_COLUMNS, type FaqListRow } from "@/components/control/views/content-shared";
import { ContentView } from "@/components/control/views/ContentView";
import { faqs } from "@/data/faqs";
import { can, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Content", "/control/content");

/**
 * What of the website's words is edited in the console, and what lives in the
 * code. The only thing read is the FAQ's rows, as the signed-in user, to count
 * where its questions stand.
 */
export default async function ContentPage() {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "content.read")) return <NoAccess title="Content" />;

  const { data, error } = await ctx.supabase.from("faq_entries").select(FAQ_LIST_COLUMNS).order("updated_at", { ascending: false }).limit(1000);
  // figures that could not be counted are left out, not shown as zero
  const counts = error ? null : countFaqList(composeFaqList(faqs, (data ?? []) as FaqListRow[]));

  return (
    <>
      <ContentView faq={counts} faqInCode={faqs.length} canReadBlog={can(ctx, "blog.read")} />
      <p className="mt-21 text-sm text-ink-2">
        Visitors can send a riddle from the Verse Room. Nothing they send is shown until it is approved:{" "}
        <Link href="/control/content/riddles" className="link">
          Readers’ riddles
        </Link>
        .
      </p>
    </>
  );
}

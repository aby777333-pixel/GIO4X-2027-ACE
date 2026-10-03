import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { decideRiddle } from "@/app/control/actions-riddles";
import { ControlHead, Empty, NoAccess, Notice } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { getTerm } from "@/data/glossary";
import { can, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Readers’ riddles", "/control/content/riddles");

type Row = { id: string; line_a: string; line_b: string; answer_slug: string; byline: string; status: "pending" | "approved" | "rejected"; created_at: string; decided_at: string | null };

const NOTICES: Record<string, string> = { approved: "Approved: it is now on the Verse Room page.", rejected: "Rejected: it will not be shown.", pending: "Put back to waiting." };
const ERRORS: Record<string, string> = { invalid: "That request was not valid.", forbidden: "Approving and rejecting needs the right to publish content.", save: "It could not be saved. Nothing was changed." };

/**
 * Readers' riddles, for the person who decides. A visitor sends two lines and
 * names the glossary term that answers them; nothing is public until it is
 * approved here. What to look for is on the page.
 */
export default async function RiddlesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "content.read")) return <NoAccess title="Readers’ riddles" />;
  const params = await searchParams;
  const notice = NOTICES[firstParam(params.notice)];
  const problem = ERRORS[firstParam(params.error)];
  const mayDecide = can(ctx, "content.publish");

  const db = ctx.supabase as unknown as SupabaseClient;
  const { data, error } = await db.from("reader_riddles").select("id, line_a, line_b, answer_slug, byline, status, created_at, decided_at").order("created_at", { ascending: false }).limit(300);
  const rows = (data ?? []) as Row[];
  const groups: [Row["status"], string][] = [
    ["pending", "Waiting to be read"],
    ["approved", "On the website"],
    ["rejected", "Rejected"],
  ];

  return (
    <div className="grid gap-21">
      <ControlHead
        title="Readers’ riddles"
        lead="Visitors send a two-line riddle with the glossary term that answers it. Nothing a visitor sends is shown until it is approved here."
        actions={
          <Link href="/control/content" className="btn btn-ghost btn-sm">
            Content
          </Link>
        }
      />
      {notice && <Notice title={notice} tone="ok" />}
      {problem && <Notice title={problem} tone="error" />}
      {error && <Notice title="The riddles could not be read." tone="error" />}

      <Notice title="Before approving, check four things">
        The riddle describes what the term means and nothing else. It makes no promise about markets or money and gives no advice. It names no person, firm or product. It is fit to be read by anyone.
      </Notice>

      {groups.map(([status, title]) => {
        const list = rows.filter((r) => r.status === status);
        return (
          <section key={status} aria-labelledby={`r-${status}`} className="gxc-card">
            <div className="gxc-card-head">
              <h2 id={`r-${status}`} className="gxc-card-title">
                {title} · {list.length}
              </h2>
            </div>
            <div className="gxc-card-body">
              {list.length === 0 ? (
                <Empty title={status === "pending" ? "Nothing is waiting." : "None."} />
              ) : (
                <ul className="grid gap-13">
                  {list.map((r) => {
                    const term = getTerm(r.answer_slug);
                    return (
                      <li key={r.id} className="grid gap-8 border-b border-line pb-13 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                        <div className="min-w-0">
                          <p className="text-ink [overflow-wrap:anywhere]">{r.line_a}</p>
                          <p className="text-ink [overflow-wrap:anywhere]">{r.line_b}</p>
                          <p className="mt-5 text-xs text-ink-3">
                            Answer: <span className="font-medium text-ink-2">{term ? term.term : `${r.answer_slug} (not a glossary term)`}</span>
                            {r.byline ? ` · sent by ${r.byline}` : ""} · {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        {mayDecide && (
                          <div className="flex flex-wrap gap-8">
                            {(status === "pending" ? (["approved", "rejected"] as const) : status === "approved" ? (["rejected", "pending"] as const) : (["approved", "pending"] as const)).map((to) => (
                              <form key={to} action={decideRiddle}>
                                <input type="hidden" name="id" value={r.id} />
                                <input type="hidden" name="status" value={to} />
                                <button type="submit" className={`btn btn-sm ${to === "approved" ? "btn-primary" : "btn-ghost"}`}>
                                  {to === "approved" ? "Approve" : to === "rejected" ? "Reject" : "Back to waiting"}
                                </button>
                              </form>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

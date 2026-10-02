import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { CustomersView } from "@/components/control/views/CustomersView";
import { can, requireStaff } from "@/lib/server/staff";
import { cleanSearch } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Customers", "/control/customers");

const PER_PAGE = 50;
// how far back "you were mentioned" looks, and how many mentions are read to count it
const MENTIONS_DAYS = 30;
const MENTIONS_READ = 50;

/**
 * Everyone who has contacted GIO4X, one record per address, from people_list()
 * (0009_insight.sql). The function checks customers.read itself and returns
 * nothing without it. The search text is reduced to characters that can appear
 * in a name or an address before it is passed on; the function uses it as a
 * plain substring, never as a pattern.
 */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "customers.read")) return <NoAccess title="Customers" />;
  const { supabase } = ctx;

  const params = await searchParams;
  const q = cleanSearch(firstParam(params.q));
  const pageParam = Number.parseInt(firstParam(params.page), 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 && pageParam <= 100000 ? pageParam : 1;

  // The caller's own mentions in notes about people (my_mentions, 0019): only
  // ever theirs, and no note text. Shown above the list on its first page; if
  // they cannot be read the list is unaffected and the card is simply absent.
  const [result, mentionsResult] = await Promise.all([
    supabase.rpc("people_list", { p_search: q, p_limit: PER_PAGE, p_offset: (page - 1) * PER_PAGE }),
    page === 1 && !q ? supabase.rpc("my_mentions", { p_limit: MENTIONS_READ }) : null,
  ]);
  const failed = !!result.error;
  const people = result.data ?? [];
  // every row carries the size of the whole result; a page past the end has no rows to carry it
  const total = Number(people[0]?.total ?? 0);
  const pastEnd = !failed && people.length === 0 && page > 1;

  const since = Date.now() - MENTIONS_DAYS * 86_400_000;
  const mentions = mentionsResult && !mentionsResult.error ? (mentionsResult.data ?? []).filter((m) => new Date(m.created_at).getTime() >= since) : [];

  return (
    <CustomersView
      people={people}
      q={q}
      total={total}
      page={page}
      pageCount={Math.max(1, Math.ceil(total / PER_PAGE))}
      failed={failed}
      pastEnd={pastEnd}
      mentions={mentions}
      mentionsDays={MENTIONS_DAYS}
      // the function returns at most this many: when it does, there may be more than are counted
      mentionsCapped={(mentionsResult?.data ?? []).length >= MENTIONS_READ && mentions.length >= MENTIONS_READ}
    />
  );
}

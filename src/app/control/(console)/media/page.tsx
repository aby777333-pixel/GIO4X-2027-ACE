import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { MEDIA_PER_PAGE, MEDIA_TABS, MEDIA_USE_FILTERS, type MediaTab, type MediaUseFilter } from "@/components/control/media-shared";
import { MediaView, type MediaCard } from "@/components/control/views/MediaView";
import { blogImageUrl } from "@/lib/blog";
import { isMediaMonth, listMedia, readMediaUsage } from "@/lib/server/media";
import { can, requireStaff } from "@/lib/server/staff";
import { siteImages } from "@/lib/site-images";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Media", "/control/media");

/**
 * The media library. The blog's picture bucket is listed AS THE SIGNED-IN
 * USER (storage lets holders of blog.read list it), and every post is read the
 * same way to say where each picture is used. The filters arrive as query
 * parameters and are validated against allow-lists; they are applied here, to
 * the listing, and never reach storage or the database.
 *
 * The second tab lists the pictures shipped with the site itself, from a list
 * made at build time: it reads nothing at all.
 */
export default async function MediaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "blog.read")) return <NoAccess title="Media" />;

  const params = await searchParams;
  const tabParam = firstParam(params.tab);
  const tab: MediaTab = (MEDIA_TABS as readonly string[]).includes(tabParam) ? (tabParam as MediaTab) : "library";
  const useParam = firstParam(params.use);
  let use: MediaUseFilter = (MEDIA_USE_FILTERS as readonly string[]).includes(useParam) ? (useParam as MediaUseFilter) : "all";
  const monthParam = firstParam(params.month);
  const month = isMediaMonth(monthParam) ? monthParam : "";
  const pageParam = Number.parseInt(firstParam(params.page), 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 && pageParam <= 100000 ? pageParam : 1;

  const base = { tab, month, canUpload: can(ctx, "blog.write"), siteImages };

  if (tab === "site") {
    return <MediaView {...base} listed cards={[]} counts={{ all: 0, used: null, unused: null }} months={[]} use="all" total={0} page={1} pageCount={1} pastEnd={false} listingTruncated={false} usage="ok" />;
  }

  const [listing, usage] = await Promise.all([listMedia(ctx.supabase), readMediaUsage(ctx.supabase)]);
  if (listing.state === "failed") {
    return <MediaView {...base} listed={false} cards={[]} counts={{ all: 0, used: null, unused: null }} months={[]} use="all" total={0} page={1} pageCount={1} pastEnd={false} listingTruncated={false} usage="ok" />;
  }

  const uses = usage.state === "ok" ? usage.uses : null;
  // without the posts nothing can be called used or unused, so those filters are not applied
  if (!uses) use = "all";

  // the months that hold pictures, and the one asked for even when it holds none, so the filter shows what is applied
  const months = [...new Set([...listing.items.map((i) => i.month), month].filter(Boolean))].sort().reverse();
  const inMonth = month ? listing.items.filter((i) => i.month === month) : listing.items;
  const isUsed = (path: string) => (uses?.get(path)?.length ?? 0) > 0;
  const usedCount = uses ? inMonth.filter((i) => isUsed(i.path)).length : null;
  const shown = use === "used" ? inMonth.filter((i) => isUsed(i.path)) : use === "unused" ? inMonth.filter((i) => !isUsed(i.path)) : inMonth;

  const total = shown.length;
  const pageCount = Math.max(1, Math.ceil(total / MEDIA_PER_PAGE));
  const cards: MediaCard[] = shown.slice((page - 1) * MEDIA_PER_PAGE, page * MEDIA_PER_PAGE).map((item) => ({ ...item, url: blogImageUrl(item.path), uses: uses ? (uses.get(item.path) ?? []) : null }));

  return (
    <MediaView
      {...base}
      listed
      cards={cards}
      counts={{ all: inMonth.length, used: usedCount, unused: usedCount === null ? null : inMonth.length - usedCount }}
      months={months}
      use={use}
      total={total}
      page={page}
      pageCount={pageCount}
      pastEnd={total > 0 && page > pageCount}
      listingTruncated={listing.truncated}
      usage={usage.state === "failed" ? "failed" : usage.truncated ? "partial" : "ok"}
    />
  );
}

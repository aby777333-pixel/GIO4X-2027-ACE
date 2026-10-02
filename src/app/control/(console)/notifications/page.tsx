import { controlMeta, firstParam } from "@/components/control/format";
import { NotificationsView } from "@/components/control/views/NotificationsView";
import { readNotifications } from "@/lib/server/personal";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Notifications", "/control/notifications");

const PER_PAGE = 25;

const NOTICES: Record<string, string> = {
  read: "All your notifications are marked read.",
};
const ERRORS: Record<string, string> = {
  save: "The notifications could not be marked read. Nothing was changed; please try again.",
};

/**
 * The signed-in person's notifications, newest first, 25 to a page. There is
 * no capability to check: every member of staff has their own, and row-level
 * security returns only the caller's rows (0018_personal.sql).
 */
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;

  const params = await searchParams;
  const pageParam = Number.parseInt(firstParam(params.page), 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 && pageParam <= 100000 ? pageParam : 1;

  const result = await readNotifications(ctx.supabase, PER_PAGE, (page - 1) * PER_PAGE);

  return (
    <NotificationsView
      items={result.items}
      total={result.total}
      unread={result.unread}
      page={page}
      pageCount={Math.max(1, Math.ceil(result.total / PER_PAGE))}
      failed={result.failed}
      pastEnd={result.pastEnd}
      notice={NOTICES[firstParam(params.notice)]}
      error={ERRORS[firstParam(params.error)]}
    />
  );
}

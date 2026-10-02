import Link from "next/link";
import { markAllNotificationsRead } from "@/app/control/actions-personal";
import { ControlHead, Empty, Notice, Pager } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { NOTIFY_KIND_LABEL, type NotifyItem } from "@/components/control/notify";
import { SubmitButton } from "@/components/control/SubmitButton";

export type NotificationsViewProps = {
  items: NotifyItem[];
  total: number;
  unread: number;
  page: number;
  pageCount: number;
  failed: boolean;
  pastEnd: boolean;
  notice?: string;
  error?: string;
  /** the real action by default; a preview hands in its own */
  markAll?: () => Promise<void>;
};

/**
 * Every notification the person still has, newest first. Presentation only:
 * the rows were read as the signed-in member of staff, who can read no one
 * else's. A title is the database's own fixed sentence with, at most, a
 * reference; it never names a customer.
 */
export function NotificationsView({ items, total, unread, page, pageCount, failed, pastEnd, notice, error, markAll = markAllNotificationsRead }: NotificationsViewProps) {
  const href = (p: number) => (p > 1 ? `/control/notifications?page=${p}` : "/control/notifications");

  return (
    <>
      <ControlHead
        title="Notifications"
        lead="What you have been told: a ticket, an enquiry or a follow-up assigned to you, a customer’s reply on a ticket of yours, a staff change or a blog post waiting for you, a visitor waiting in live chat. Only you see these."
        actions={
          !failed && unread > 0 ? (
            <form action={markAll}>
              <SubmitButton pending="Marking…" className="btn btn-ghost">
                Mark all read
              </SubmitButton>
            </form>
          ) : undefined
        }
      />

      {(notice || error) && (
        <div className="mt-21 grid gap-13">
          {notice && !error && <Notice title={notice} tone="ok" />}
          {error && <Notice title={error} tone="error" />}
        </div>
      )}

      <div className="mt-21">
        {failed ? (
          <Notice title="Your notifications could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        ) : items.length ? (
          <>
            <p className="num mb-8 text-sm text-ink-3" data-notify-page-summary>
              {unread === 0 ? "None unread" : `${unread} unread`}
            </p>
            <ul className="gxc-card overflow-hidden" aria-label="Your notifications, newest first">
              {items.map((item) => (
                <li key={item.id} className="border-b border-line last:border-b-0" data-notify-row={item.id}>
                  <Link href={item.href} className="grid gap-x-21 gap-y-3 px-21 py-13 transition-colors duration-fast hover:bg-[color-mix(in_srgb,var(--gxc-tint)_6%,transparent)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-8 gap-y-3">
                        <span className={`state ${item.read ? "state-off" : "state-open"}`}>{item.read ? "Read" : "New"}</span>
                        <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-3">{NOTIFY_KIND_LABEL[item.kind]}</span>
                      </span>
                      <span className={`mt-3 block break-words text-sm ${item.read ? "text-ink-2" : "font-semibold text-ink"}`}>{item.title}</span>
                    </span>
                    <span className="num text-xs text-ink-3 md:text-right">{fmtDateTime(item.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : pastEnd ? (
          <Empty title="There is no such page">
            <p>
              <Link href={href(1)} className="link">
                Go to the first page
              </Link>
            </p>
          </Empty>
        ) : (
          <Empty title="No notifications yet">
            <p>
              When a ticket, an enquiry or a follow-up is assigned to you by somebody else, when a customer replies on a ticket you hold, or when something waits for your approval, a line appears here and on the bell. What you do yourself
              never notifies you.
            </p>
          </Empty>
        )}
      </div>

      {!failed && !pastEnd && total > 0 && <Pager page={page} pageCount={pageCount} total={total} noun={total === 1 ? "notification" : "notifications"} href={href} />}

      <p className="mt-21 max-w-measure text-xs text-ink-3">
        Opening a notification from the bell marks it read. A read notification is removed 30 days after it was made, and any notification after 90 days. To be told on this computer as well, open the bell and choose “Also notify me on this
        computer”: that works only while a console tab is open.
      </p>
    </>
  );
}

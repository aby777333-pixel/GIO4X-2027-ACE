"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { fmtDateTime } from "@/components/control/format";
import { NOTIFY_KIND_LABEL, NOTIFY_PANEL_SIZE } from "@/components/control/notify";
import { getNotifyServerState, getNotifyState, markNotifyRead, refreshNotify, requestBrowserNotify, stopBrowserNotify, subscribeNotify } from "@/components/control/notify-store";

function BellIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9.5a6 6 0 1 1 12 0c0 4.2 1.6 5.6 2 6H4c.4-.4 2-1.8 2-6Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

/**
 * The bell: how many notifications are unread, and a panel with the latest
 * thirty. `variant="side"` sits in the sidebar beside the signed-in person;
 * `variant="top"` in the phone's top bar. Both read one store
 * (notify-store.ts), so two bells still make one request every 30 seconds.
 *
 * The panel is drawn as a child of the console's root, not of the sidebar:
 * the sidebar is its own layer, and a panel inside it would be painted under
 * anything on the page that is positioned. It is a dialog that does not take
 * the page over: Escape, a click outside, the close button or going somewhere
 * closes it, and focus returns to the bell.
 *
 * The count is said in words on the button, and a line that is unread carries
 * the word "New", so nothing depends on colour.
 */
export function NotifyBell({ variant }: { variant: "side" | "top" }) {
  const state = useSyncExternalStore(subscribeNotify, getNotifyState, getNotifyServerState);
  const [open, setOpen] = useState(false);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  // the console root carries the look (light or dark, palette): the panel must be inside it to wear it
  useEffect(() => setRoot(button.current?.closest<HTMLElement>("[data-gxc-root]") ?? null), []);
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    refreshNotify();
    panel.current?.focus();
    const close = () => {
      setOpen(false);
      button.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && !panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const { unread, items, status, pref, permission } = state;
  const shown = unread > 99 ? "99+" : String(unread);
  const label = unread === 0 ? "Notifications: none unread" : `Notifications: ${unread} unread`;
  const browserOn = pref.browser && permission === "granted";

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`gxc-top-button relative shrink-0 ${variant === "side" ? "-my-3 -mr-5 ml-auto" : ""}`}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-notify-bell={variant}
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon />
        {unread > 0 && (
          <span aria-hidden data-notify-count className="num absolute right-[0.125rem] top-[0.25rem] min-w-[1.125rem] rounded-full bg-white px-[0.25rem] text-center text-[0.625rem] font-bold leading-[1.125rem] text-[var(--gxc-side)]">
            {shown}
          </span>
        )}
      </button>

      {open &&
        root &&
        createPortal(
          <div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-label="Notifications"
            tabIndex={-1}
            data-notify-panel=""
            className={`fixed z-overlay flex flex-col overflow-hidden rounded-[16px] border border-line-strong bg-surface text-ink shadow-3 outline-none ${
              variant === "side" ? "left-[17.5rem] top-[4.75rem] max-h-[calc(100dvh-6.5rem)] w-[24rem]" : "inset-x-8 top-[4.25rem] max-h-[calc(100dvh-5.25rem)]"
            }`}
          >
            <div className="flex items-center justify-between gap-13 border-b border-line px-21 py-13">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-ink">Notifications</h2>
                <p className="num text-xs text-ink-3" data-notify-summary>
                  {status === "idle" ? "Reading…" : unread === 0 ? "None unread" : `${unread} unread`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-8">
                <button type="button" className="btn btn-ghost btn-sm" disabled={unread === 0} aria-disabled={unread === 0} onClick={() => void markNotifyRead("all")}>
                  Mark all read
                </button>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => {
                    setOpen(false);
                    button.current?.focus();
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {status === "failed" && (
                <p role="status" className="border-b border-line px-21 py-13 text-xs text-ink-2">
                  Notifications could not be read just now. The console asks again every 30 seconds.
                </p>
              )}
              {items.length ? (
                <ul aria-label={`The latest ${NOTIFY_PANEL_SIZE} notifications, newest first`}>
                  {items.map((item) => (
                    <li key={item.id} className="border-b border-line last:border-b-0">
                      <Link
                        href={item.href}
                        data-notify-item={item.id}
                        className="block px-21 py-13 transition-colors duration-fast hover:bg-[color-mix(in_srgb,var(--gxc-tint)_6%,transparent)]"
                        onClick={() => {
                          void markNotifyRead([item.id]);
                          setOpen(false);
                        }}
                      >
                        <span className="flex flex-wrap items-center gap-x-8 gap-y-3">
                          {!item.read && <span className="state state-open">New</span>}
                          <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-3">{NOTIFY_KIND_LABEL[item.kind]}</span>
                        </span>
                        <span className={`mt-3 block break-words text-sm ${item.read ? "text-ink-2" : "font-semibold text-ink"}`}>{item.title}</span>
                        <span className="num mt-3 block text-xs text-ink-3">{fmtDateTime(item.at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                status !== "idle" &&
                status !== "failed" && (
                  <p className="px-21 py-21 text-sm text-ink-2">
                    Nothing yet. You are told here when a ticket, an enquiry or a follow-up is assigned to you, when a customer replies on a ticket of yours, and when something waits for your approval.
                  </p>
                )
              )}
            </div>

            <div className="grid gap-8 border-t border-line px-21 py-13">
              <Link href="/control/notifications" className="gxc-card-link" onClick={() => setOpen(false)}>
                All notifications →
              </Link>
              <div data-notify-browser={permission === "unsupported" ? "unsupported" : browserOn ? "on" : permission === "denied" ? "denied" : "off"}>
                {permission === "unsupported" ? (
                  <p className="text-xs text-ink-3">This browser cannot raise notifications from a page, so they stay here in the console.</p>
                ) : browserOn ? (
                  <>
                    <p className="text-xs text-ink-2">
                      <span className="font-semibold text-ink">Also notifying you on this computer.</span> It works only while a console tab is open in this browser: nothing is sent when the console is closed.
                    </p>
                    <button type="button" className="btn btn-ghost btn-sm mt-8" onClick={stopBrowserNotify}>
                      Switch off on this computer
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void requestBrowserNotify()}>
                      Also notify me on this computer
                    </button>
                    {permission === "denied" ? (
                      <p role="status" className="mt-8 text-xs text-ink-2">
                        This browser is set to block notifications from this site. Allow them in the browser’s settings for this site, then press the button again.
                      </p>
                    ) : (
                      <p className="mt-8 text-xs text-ink-3">
                        Your browser will ask for permission. A notification then appears on this computer when something new arrives while the console is open in a tab you are not looking at. It works only while a console tab is open:
                        there is no push service, and nothing is sent when the console is closed. The choice is kept in this browser only.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>,
          root,
        )}
    </>
  );
}

"use client";

/**
 * The website's chat window.
 *
 * The rule it is built around (supabase/migrations/0008_chat.sql): the website
 * never offers a chat that nobody is there to answer. So this component asks
 * the database chat_available(). The answer is yes only while live chat is
 * switched on in GIO4X Control and a member of staff has the Live Chats
 * screen open. Until then the button is labelled "Help", not "Chat", and
 * opens a small panel that says plainly that nobody is at the chat desk and
 * points to the forms that are always open: a support request, the contact
 * form and the FAQ. It never takes a chat message it cannot deliver.
 *
 * The visitor has no account. chat_start() returns a conversation id and a
 * random token; every later call (chat_send, chat_poll, chat_end) presents
 * both. They are kept in sessionStorage under one key so the conversation
 * survives a page change within the visit, and are removed when it ends.
 * Nothing is kept in localStorage and no cookie is set.
 *
 * Everything runs as the anonymous role with the publishable key. There is no
 * realtime connection: the open conversation is polled every three seconds,
 * and never while the tab is hidden.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { ChatPublicPoll, ChatStatus } from "@/lib/supabase/types";

/** The one thing this component stores, in sessionStorage: `{ id, token }` of the open conversation. */
export const CHAT_SESSION_KEY = "gx:chat";

const AVAILABLE_EVERY_MS = 60_000;
const POLL_EVERY_MS = 3_000;
/** Must equal `chat_messages_body_valid` and `chat_conversations_name_valid` in 0008_chat.sql. */
const BODY_MAX = 2000;
const NAME_MAX = 80;

type Session = { id: string; token: string };
type Message = ChatPublicPoll["messages"][number];
type Thread = { status: ChatStatus; joined: boolean; messages: Message[]; endedHere: boolean };

const NEW_THREAD: Thread = { status: "waiting", joined: false, messages: [], endedHere: false };

/* -------------------------------------------------------------------------- */
/* small, checked helpers                                                     */
/* -------------------------------------------------------------------------- */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{32,128}$/i;

function asSession(value: unknown): Session | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, token } = value as { id?: unknown; token?: unknown };
  return typeof id === "string" && UUID.test(id) && typeof token === "string" && TOKEN.test(token) ? { id, token } : null;
}

function readStored(): Session | null {
  try {
    const raw = window.sessionStorage.getItem(CHAT_SESSION_KEY);
    return raw ? asSession(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeStored(session: Session | null): void {
  try {
    if (session) window.sessionStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(session));
    else window.sessionStorage.removeItem(CHAT_SESSION_KEY);
  } catch {
    /* storage unavailable: the chat works for this page and is not carried to the next */
  }
}

function asPoll(value: unknown): ChatPublicPoll | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as { status?: unknown; joined?: unknown; messages?: unknown };
  if ((v.status !== "waiting" && v.status !== "active" && v.status !== "closed") || !Array.isArray(v.messages)) return null;
  const messages: Message[] = [];
  for (const m of v.messages as { id?: unknown; from?: unknown; body?: unknown; at?: unknown }[]) {
    if (typeof m?.id === "number" && (m.from === "visitor" || m.from === "staff") && typeof m.body === "string" && typeof m.at === "string") {
      messages.push({ id: m.id, from: m.from, body: m.body, at: m.at });
    }
  }
  return { status: v.status, joined: v.joined === true, messages };
}

/** Line feeds and tabs are kept; the other control characters, which the database refuses, become spaces. */
function cleanBody(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ")
    .trim();
}

function cleanName(raw: string): string {
  const line = raw
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // by code point, so a name is never cut through the middle of a character
  return Array.from(line).slice(0, NAME_MAX).join("");
}

/** The page the chat was started on: the path only, never the query string (it can carry personal data). */
function safePage(pathname: string | null): string {
  const path = pathname ?? "/";
  return path.length <= 300 && /^\/([^/\\\s][^\\\s]*)?$/.test(path) ? path : "/";
}

function isThrottle(error: { code?: string } | null, status: number): boolean {
  return status === 429 || error?.code === "PT429";
}

function clock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* -------------------------------------------------------------------------- */
/* the launcher                                                               */
/* -------------------------------------------------------------------------- */

function ChatGlyph() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  );
}

/** From this width the footer's last line is one row with the technology partner's logo at its right end. */
const FOOTER_ROW_FROM = 820;

/**
 * How far the launcher has to rise so that it does not sit on the footer's
 * last line. On a phone that line is stacked and its right-hand corner is
 * empty, so a 44px button fits there and nothing moves. From `md` up the
 * corner holds the technology partner's logo (a link), so the button rides
 * just above the line while the line is on screen.
 */
export function useFooterLift(): number {
  const [lift, setLift] = useState(0);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = document.querySelector("footer[data-site-footer]")?.lastElementChild;
      const top = line && window.innerWidth >= FOOTER_ROW_FROM ? line.getBoundingClientRect().top : Infinity;
      setLift(Math.max(0, Math.round(window.innerHeight - top)));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  return lift;
}

/**
 * The button in the bottom corner. On a phone it is the icon alone, 44px
 * square, so it takes as little of the page as a touch target allows. It is
 * kept clear of the home indicator and rounded screen corners by the
 * safe-area insets, and it sits below the header's layer, so the mobile menu,
 * the Lens and the command bar all cover it instead of fighting it.
 */
export function ChatLauncher({
  unread = 0,
  ongoing = false,
  away = false,
  onOpen,
  buttonRef,
}: {
  unread?: number;
  ongoing?: boolean;
  /** nobody is there to chat: the button offers help, not a chat */
  away?: boolean;
  onOpen?: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const lift = useFooterLift();
  const label =
    unread > 0
      ? `Open chat: ${unread} new ${unread === 1 ? "message" : "messages"} from GIO4X`
      : ongoing
        ? "Open your chat with GIO4X"
        : away
          ? "Help and ways to reach GIO4X"
          : "Chat with GIO4X staff";
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={label}
      style={lift ? { marginBottom: lift } : undefined}
      className="btn btn-accent no-print fixed bottom-[max(0.8125rem,env(safe-area-inset-bottom))] right-[max(0.8125rem,env(safe-area-inset-right))] z-[39] w-[2.75rem] px-0 sm:bottom-[max(1.3125rem,env(safe-area-inset-bottom))] sm:right-[max(1.3125rem,env(safe-area-inset-right))] sm:w-auto sm:px-21"
    >
      <ChatGlyph />
      <span aria-hidden className="hidden sm:inline">
        {away && !ongoing ? "Help" : "Chat"}
      </span>
      {unread > 0 && (
        <span aria-hidden className="num absolute -right-5 -top-5 rounded-full bg-ink px-5 text-[0.6875rem] leading-[1.125rem] tracking-normal text-bg sm:static">
          {unread}
        </span>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* the panel shown while nobody is there to chat                              */
/* -------------------------------------------------------------------------- */

const AWAY_LINKS = [
  { href: "/support", title: "Open a support request", note: "You are given a reference, and read our reply on the same page." },
  { href: "/contact", title: "Send a general enquiry", note: "The contact form, routed by topic." },
  { href: "/faq", title: "Read the common questions", note: "Answers that need no waiting." },
] as const;

export function ChatAwayPanel({ onClose }: { onClose?: () => void }) {
  const uid = useId();
  return (
    <section
      aria-labelledby={`${uid}-title`}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose?.();
      }}
      className="panel no-print fixed inset-x-8 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[39] flex max-h-[min(36rem,calc(100dvh-var(--header-h)-1rem))] flex-col shadow-3 sm:inset-x-auto sm:bottom-[max(1.3125rem,env(safe-area-inset-bottom))] sm:right-[max(1.3125rem,env(safe-area-inset-right))] sm:w-[23.5rem]"
      style={{ animation: "gx-rise 260ms var(--ease-out)" }}
    >
      <header className="flex items-start justify-between gap-13 border-b border-line px-21 py-13">
        <div className="min-w-0">
          <p id={`${uid}-title`} className="text-sm font-semibold text-ink">
            Help from GIO4X
          </p>
          <p className="mt-3 text-xs leading-snug text-ink-3">Nobody is at the chat desk at the moment. When a member of staff is, this button opens a live chat.</p>
        </div>
        <button type="button" autoFocus className="chip shrink-0 cursor-pointer" onClick={onClose} aria-label="Close the help window">
          Close
        </button>
      </header>
      <ul className="flat grid gap-8 overflow-y-auto px-21 py-13">
        {AWAY_LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} onClick={onClose} className="block rounded-md border border-line bg-paper px-13 py-8 transition-colors hover:border-line-strong">
              <span className="block text-sm font-semibold text-ink">{l.title}</span>
              <span className="mt-3 block text-xs leading-snug text-ink-3">{l.note}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-21 py-13 text-xs leading-snug text-ink-3">GIO4X will never ask for your password or a one-time security code.</p>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* the panel                                                                  */
/* -------------------------------------------------------------------------- */

export type ChatNotice = "unavailable" | "throttled" | "failed" | "offline" | "invalid";

export type ChatPanelProps = {
  /** compose: nothing sent yet. thread: a conversation exists (or has just ended). */
  phase: "compose" | "thread";
  status: ChatStatus;
  /** a member of staff has taken the conversation */
  joined: boolean;
  messages: Message[];
  /** the visitor pressed "End chat" in this window (as opposed to staff closing it) */
  endedHere: boolean;
  notice: ChatNotice | null;
  /** a request is on its way */
  busy: boolean;
  /** chat is still offered, so a new conversation may be started after this one */
  canRestart: boolean;
  /** each resolves to true when the text was accepted, so the box can be emptied */
  onStart?: (name: string, body: string) => Promise<boolean>;
  onSend?: (body: string) => Promise<boolean>;
  onEnd?: () => void;
  onRestart?: () => void;
  onClose?: () => void;
};

const NOTICE_TEXT: Record<Exclude<ChatNotice, "unavailable">, string> = {
  throttled: "Messages are arriving quickly. Please wait a moment, then send it again.",
  failed: "That could not be sent. Please try again in a moment.",
  offline: "The connection dropped. Trying again.",
  invalid: "Please write a message of up to 2,000 characters.",
};

/**
 * Presentation only: everything it shows arrives as props, so each state can
 * be looked at with fixture data. A labelled region, not a modal: the page
 * behind stays usable and focus is never trapped. Escape closes it.
 */
export function ChatPanel({ phase, status, joined, messages, endedHere, notice, busy, canRestart, onStart, onSend, onEnd, onRestart, onClose }: ChatPanelProps) {
  const uid = useId();
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const closed = phase === "thread" && status === "closed";
  const lastId = messages.length ? messages[messages.length - 1].id : 0;

  // opening the window puts the cursor where the visitor will type
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  // the newest message stays in view
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [lastId, phase]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    const accepted = phase === "compose" ? await onStart?.(name, draft) : await onSend?.(draft);
    if (accepted) setDraft("");
    // the box keeps the cursor, so the next message can be typed straight away
    inputRef.current?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose?.();
    }
  };

  // Enter sends on a keyboard; on a touch keyboard Enter is a line break and the button sends
  const onDraftKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    event.preventDefault();
    void submit();
  };

  return (
    <section
      aria-labelledby={`${uid}-title`}
      onKeyDown={onKeyDown}
      className="panel no-print fixed inset-x-8 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[39] flex max-h-[min(36rem,calc(100dvh-var(--header-h)-1rem))] flex-col shadow-3 sm:inset-x-auto sm:bottom-[max(1.3125rem,env(safe-area-inset-bottom))] sm:right-[max(1.3125rem,env(safe-area-inset-right))] sm:w-[23.5rem]"
      style={{ animation: "gx-rise 260ms var(--ease-out)" }}
    >
      <header className="flex items-start justify-between gap-13 border-b border-line px-21 py-13">
        <div className="min-w-0">
          <p id={`${uid}-title`} className="text-sm font-semibold text-ink">
            Chat with GIO4X
          </p>
          <p className="mt-3 text-xs leading-snug text-ink-3">A member of GIO4X staff will answer. Chat is not for trading instructions or passwords.</p>
        </div>
        <button type="button" className="chip shrink-0 cursor-pointer" onClick={onClose} aria-label="Close the chat window">
          Close
        </button>
      </header>

      {phase === "thread" && (
        <>
          <p role="status" className="border-b border-line px-21 py-8 text-xs font-medium text-ink-2">
            {closed ? "This chat has ended." : joined ? "A member of GIO4X staff has joined." : "Waiting for a member of staff to join"}
          </p>
          <div ref={logRef} role="log" aria-live="polite" aria-label="Chat messages" tabIndex={0} className="grid min-h-[5rem] flex-1 content-start gap-13 overflow-y-auto overscroll-contain px-21 py-13">
            {messages.map((m) => {
              const staff = m.from === "staff";
              return (
                <div key={m.id} className={`min-w-0 max-w-[88%] ${staff ? "justify-self-start" : "justify-self-end"}`}>
                  <p className={`text-[0.6875rem] text-ink-3 ${staff ? "" : "text-right"}`}>
                    <span className="font-semibold text-ink-2">{staff ? "GIO4X" : "You"}</span>{" "}
                    <time dateTime={m.at} className="num" suppressHydrationWarning>
                      {clock(m.at)}
                    </time>
                  </p>
                  <p className={`mt-3 whitespace-pre-wrap break-words rounded-md border px-13 py-8 text-sm leading-normal text-ink ${staff ? "border-line bg-paper" : "border-transparent bg-brand-soft"}`}>{m.body}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="grid gap-13 px-21 py-13">
        {notice === "unavailable" ? (
          <p role="alert" className="border-l-2 border-l-neg pl-13 text-sm text-ink">
            Live chat has just become unavailable, so your message was not sent. Please use the{" "}
            <Link href="/support" className="link">
              support page
            </Link>{" "}
            instead.
          </p>
        ) : notice ? (
          <p role={notice === "failed" || notice === "invalid" ? "alert" : "status"} className={`border-l-2 pl-13 text-sm text-ink ${notice === "failed" || notice === "invalid" ? "border-l-neg" : "border-l-accent"}`}>
            {NOTICE_TEXT[notice]}
          </p>
        ) : null}

        {closed ? (
          <>
            <p className="text-sm text-ink-2">
              {endedHere ? "You ended this chat. " : ""}If you still need help, write to us from the{" "}
              <Link href="/support" className="link">
                support page
              </Link>
              .
            </p>
            {canRestart && (
              <div>
                <button type="button" className="btn btn-ghost" onClick={onRestart}>
                  Start a new chat
                </button>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={submit} className="grid gap-13" noValidate>
            {phase === "compose" && (
              <div className="field">
                <label htmlFor={`${uid}-name`}>
                  Your name <span className="font-normal normal-case tracking-normal text-ink-3">(optional)</span>
                </label>
                <input id={`${uid}-name`} type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} autoComplete="name" />
              </div>
            )}
            <div className="field">
              <label htmlFor={`${uid}-body`}>{phase === "compose" ? "How can we help?" : "Your message"}</label>
              <textarea
                id={`${uid}-body`}
                ref={inputRef}
                className="textarea !min-h-[4.25rem]"
                rows={phase === "compose" ? 3 : 2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onDraftKey}
                maxLength={BODY_MAX}
                aria-invalid={notice === "invalid" ? true : undefined}
              />
            </div>
            {phase === "compose" && (
              <p className="text-xs leading-snug text-ink-3">
                What you write is stored so that staff can answer it. See the{" "}
                <Link href="/legal/privacy" className="link">
                  Privacy Policy
                </Link>
                .
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-8">
              <button type="submit" className="btn btn-primary px-21" aria-disabled={busy}>
                {busy ? "Sending…" : phase === "compose" ? "Start chat" : "Send"}
              </button>
              {phase === "thread" &&
                (confirmEnd ? (
                  <span className="flex flex-wrap items-center gap-8 text-xs text-ink-2">
                    End this chat?
                    <button
                      type="button"
                      className="btn btn-ghost px-13"
                      onClick={() => {
                        setConfirmEnd(false);
                        onEnd?.();
                      }}
                    >
                      Yes, end it
                    </button>
                    <button type="button" className="btn btn-quiet" onClick={() => setConfirmEnd(false)}>
                      Keep chatting
                    </button>
                  </span>
                ) : (
                  <button type="button" className="btn btn-quiet" onClick={() => setConfirmEnd(true)}>
                    End chat
                  </button>
                ))}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* the widget                                                                 */
/* -------------------------------------------------------------------------- */

/** Runs `fn` once the browser has nothing better to do (after first paint); returns a cancel function. */
function whenIdle(fn: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(fn, { timeout: 4000 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(fn, 1200);
  return () => window.clearTimeout(handle);
}

export function ChatWidget() {
  const pathname = usePathname();
  // GIO4X Control has its own shell and never mounts this; the check is a second lock on the same door
  const blocked = pathname?.startsWith("/control") ?? false;

  const [available, setAvailable] = useState(false);
  /** the first answer has arrived (or cannot): until then nothing is drawn, so the button never changes its word under the visitor */
  const [asked, setAsked] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<"compose" | "thread">("compose");
  const [thread, setThread] = useState<Thread>(NEW_THREAD);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<ChatNotice | null>(null);
  const [busy, setBusy] = useState(false);
  /** id of the newest message the visitor has had in front of them */
  const [seen, setSeen] = useState(0);

  const sessionRef = useRef<Session | null>(null);
  const afterRef = useRef(0);
  const polling = useRef(false);
  const pollAgain = useRef(false);
  const failures = useRef(0);
  const lastCheck = useRef(0);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  /** after a page load, what was already in the conversation is not "new" */
  const primeSeen = useRef(false);

  /** The conversation is over (closed, ended, or no longer found): forget its token. */
  const forget = useCallback(() => {
    writeStored(null);
    sessionRef.current = null;
    setSession(null);
  }, []);

  /* ---- is anybody there? asked when idle, then at most once a minute, never while hidden ---- */
  const check = useCallback(async (force = false) => {
    if (document.hidden) return;
    const now = Date.now();
    if (!force && now - lastCheck.current < AVAILABLE_EVERY_MS) return;
    lastCheck.current = now;
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setAvailable(false);
      setAsked(true);
      return;
    }
    try {
      const { data, error } = await supabase.rpc("chat_available");
      setAvailable(!error && data === true);
    } catch {
      setAvailable(false);
    }
    setAsked(true);
  }, []);

  useEffect(() => {
    if (blocked) return;
    const cancelIdle = whenIdle(() => void check());
    // a second past the minute, so the timer never lands just inside the once-a-minute guard
    const timer = window.setInterval(() => void check(), AVAILABLE_EVERY_MS + 1000);
    const onVisibility = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelIdle();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [blocked, check]);

  /* ---- a conversation from earlier in this visit ---- */
  useEffect(() => {
    if (blocked) return;
    const stored = readStored();
    if (!stored) return;
    sessionRef.current = stored;
    afterRef.current = 0;
    primeSeen.current = true;
    setSession(stored);
    setPhase("thread");
    setThread(NEW_THREAD);
  }, [blocked]);

  /* ---- the open conversation, every three seconds ---- */
  const poll = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || document.hidden) return;
    if (polling.current) {
      // something was just sent while a read was in flight: read once more straight after
      pollAgain.current = true;
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    polling.current = true;
    try {
      const { data, error } = await supabase.rpc("chat_poll", { p_id: s.id, p_token: s.token, p_after: afterRef.current });
      if (sessionRef.current !== s) return;
      if (error) throw new Error("poll");
      failures.current = 0;
      setNotice((n) => (n === "offline" ? null : n));
      const view = asPoll(data);
      if (!view) {
        // the id and token no longer name a conversation
        forget();
        setThread((t) => ({ ...t, status: "closed" }));
        return;
      }
      if (view.messages.length) afterRef.current = Math.max(afterRef.current, ...view.messages.map((m) => m.id));
      if (primeSeen.current) {
        primeSeen.current = false;
        setSeen(afterRef.current);
      }
      setThread((t) => {
        const have = new Set(t.messages.map((m) => m.id));
        const fresh = view.messages.filter((m) => !have.has(m.id));
        return { ...t, status: view.status, joined: view.joined, messages: fresh.length ? [...t.messages, ...fresh].sort((a, b) => a.id - b.id) : t.messages };
      });
      if (view.status === "closed") forget();
    } catch {
      failures.current += 1;
      if (failures.current >= 3) setNotice((n) => n ?? "offline");
    } finally {
      polling.current = false;
      if (pollAgain.current) {
        pollAgain.current = false;
        void poll();
      }
    }
  }, [forget]);

  useEffect(() => {
    if (!session) return;
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_EVERY_MS);
    const onVisibility = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session, poll]);

  /* ---- what the visitor does ---- */
  const start = async (rawName: string, rawBody: string): Promise<boolean> => {
    const body = cleanBody(rawBody);
    if (body.length < 1 || body.length > BODY_MAX) {
      setNotice("invalid");
      return false;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setNotice("unavailable");
      return false;
    }
    setBusy(true);
    try {
      const { data, error, status } = await supabase.rpc("chat_start", { p_name: cleanName(rawName), p_page: safePage(pathname), p_body: body });
      if (error) {
        if (isThrottle(error, status)) setNotice("throttled");
        else if (error.code === "P0001") {
          // staff left, or chat was switched off, between the window opening and this message
          setNotice("unavailable");
          setAvailable(false);
        } else setNotice("failed");
        return false;
      }
      const created = asSession(data);
      if (!created) {
        setNotice("failed");
        return false;
      }
      writeStored(created);
      sessionRef.current = created;
      afterRef.current = 0;
      setNotice(null);
      setThread(NEW_THREAD);
      setPhase("thread");
      setSession(created);
      return true;
    } catch {
      setNotice("failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const send = async (rawBody: string): Promise<boolean> => {
    const s = sessionRef.current;
    const body = cleanBody(rawBody);
    if (body.length < 1 || body.length > BODY_MAX) {
      setNotice("invalid");
      return false;
    }
    const supabase = getBrowserSupabase();
    if (!s || !supabase) {
      setNotice("failed");
      return false;
    }
    setBusy(true);
    try {
      const { data, error, status } = await supabase.rpc("chat_send", { p_id: s.id, p_token: s.token, p_body: body });
      if (error) {
        setNotice(isThrottle(error, status) ? "throttled" : "failed");
        return false;
      }
      if (data === "ok") {
        setNotice(null);
        void poll();
        return true;
      }
      // "closed" or "not_found": the conversation ended before this message arrived
      forget();
      setNotice(null);
      setThread((t) => ({ ...t, status: "closed" }));
      return false;
    } catch {
      setNotice("failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    const s = sessionRef.current;
    const supabase = getBrowserSupabase();
    if (!s || !supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("chat_end", { p_id: s.id, p_token: s.token });
      if (error) {
        setNotice("failed");
        return;
      }
      forget();
      setNotice(null);
      setThread((t) => ({ ...t, status: "closed", endedHere: true }));
      void check(true);
    } catch {
      setNotice("failed");
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setNotice(null);
    setThread(NEW_THREAD);
    setPhase("compose");
    setSeen(0);
  };

  const close = () => {
    refocus.current = true;
    setOpen(false);
    // a finished conversation is not kept behind the button
    if (phase === "thread" && !sessionRef.current) restart();
    if (notice === "unavailable") setNotice(null);
  };

  /* ---- unread, and where focus goes ---- */
  const newest = thread.messages.length ? thread.messages[thread.messages.length - 1].id : 0;
  useEffect(() => {
    if (open) setSeen(newest);
  }, [open, newest]);
  useEffect(() => {
    if (!open && refocus.current) {
      refocus.current = false;
      launcherRef.current?.focus();
    }
  }, [open]);

  if (blocked) return null;
  // Nothing until the first answer is in, unless the visitor already has a conversation or the window is open.
  if (!asked && !session && !open) return null;
  // Nobody to chat with and no conversation under way: the button offers help, and the forms that are always open.
  const away = !available && !session && phase === "compose" && notice !== "unavailable";

  if (!open) {
    const unread = thread.messages.filter((m) => m.from === "staff" && m.id > seen).length;
    return <ChatLauncher buttonRef={launcherRef} unread={unread} ongoing={!!session} away={away} onOpen={() => setOpen(true)} />;
  }

  if (away) return <ChatAwayPanel onClose={close} />;

  return (
    <ChatPanel
      phase={phase}
      status={thread.status}
      joined={thread.joined}
      messages={thread.messages}
      endedHere={thread.endedHere}
      notice={notice}
      busy={busy}
      canRestart={available}
      onStart={start}
      onSend={send}
      onEnd={() => void end()}
      onRestart={restart}
      onClose={close}
    />
  );
}

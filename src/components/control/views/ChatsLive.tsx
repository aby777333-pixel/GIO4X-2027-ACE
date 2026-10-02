"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { claimChat, closeChat, sendChatReply } from "@/app/control/actions-chats";
import { fmtDateTime } from "@/components/control/format";
import { SubmitButton } from "@/components/control/SubmitButton";
import type { ChatConversationRow, ChatMessageRow, ChatStatus } from "@/lib/supabase/types";

/** What GET /control/chats/feed answers with. */
export type ChatFeed = {
  ok: true;
  /** when the database was read (ISO, UTC) */
  at: string;
  /** live chat is switched on in Configuration */
  enabled: boolean;
  /** chat_available(): what the website is told when it asks */
  offered: boolean;
  /** the people whose "I am here" mark has not expired */
  present: string[];
  conversations: ChatConversationRow[];
  selected: ChatConversationRow | null;
  messages: ChatMessageRow[];
};

export type ChatsLiveProps = Omit<ChatFeed, "ok"> & {
  /** `?c=` named a conversation that could not be read */
  missing: boolean;
  /** user id → display name, for everyone on staff */
  names: Record<string, string>;
  me: string;
  /** may take, answer and close (chats.write); without it the screen is read-only and never counts as present */
  writable: boolean;
  /** may answer in a colleague's conversation (the database allows it to people who hold leads.assign) */
  canOverride: boolean;
  /** false in the fixture preview: nothing is fetched and no presence is sent */
  live: boolean;
};

const FEED_EVERY_MS = 4_000;
const PRESENCE_EVERY_MS = 60_000;

// shape + label, never colour alone
const STATUS_CLASS: Record<ChatStatus, string> = { waiting: "state-overlap", active: "state-open", closed: "state-off" };

function byId(a: ChatMessageRow, b: ChatMessageRow): number {
  return a.id - b.id;
}

/** Messages already shown plus messages just read, each once, in order. */
function merge(have: ChatMessageRow[], more: ChatMessageRow[]): ChatMessageRow[] {
  if (!more.length) return have;
  const seen = new Set(have.map((m) => m.id));
  const fresh = more.filter((m) => !seen.has(m.id));
  return fresh.length ? [...have, ...fresh].sort(byId) : have;
}

/** How long ago, in words, against the clock the data was read with (so server and browser agree). */
function since(iso: string, nowIso: string): string {
  const ms = new Date(nowIso).getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return "under a minute";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours} h ${minutes % 60} min` : `${Math.floor(hours / 24)} days`;
}

/**
 * The live part of the Live Chats screen: who is available, the list, and the
 * selected conversation. It starts from what the page read on the server and
 * then asks the feed every four seconds (never while the tab is hidden), so it
 * feels live without a realtime connection the browser could not authenticate.
 *
 * While it is open and the person may answer chats, it also tells the database
 * "I am here" once a minute. That mark is what lets the website offer chat.
 */
export function ChatsLive(props: ChatsLiveProps) {
  const { names, me, writable, canOverride, live, missing } = props;
  const selectedId = props.selected?.id ?? null;

  /* ---- the board: list and availability, replaced whole by every read ---- */
  const [board, setBoard] = useState({ at: props.at, enabled: props.enabled, offered: props.offered, present: props.present, conversations: props.conversations });
  useEffect(() => {
    // a server render (after an action, or a new selection) is a fresh read
    setBoard({ at: props.at, enabled: props.enabled, offered: props.offered, present: props.present, conversations: props.conversations });
  }, [props.at, props.enabled, props.offered, props.present, props.conversations]);

  /* ---- the selected conversation: messages only ever accumulate ---- */
  const [thread, setThread] = useState({ id: selectedId, row: props.selected, messages: props.messages });
  useEffect(() => {
    setThread((cur) =>
      cur.id === selectedId ? { id: selectedId, row: props.selected, messages: merge(cur.messages, props.messages) } : { id: selectedId, row: props.selected, messages: props.messages },
    );
  }, [selectedId, props.selected, props.messages]);
  // between a new selection arriving and the effect above running, show the new one, not the old
  const current = thread.id === selectedId ? thread : { id: selectedId, row: props.selected, messages: props.messages };
  const row = current.row;
  const messages = current.messages;
  const lastId = messages.length ? messages[messages.length - 1].id : 0;

  const selectedRef = useRef(selectedId);
  const lastIdRef = useRef(lastId);
  useEffect(() => {
    selectedRef.current = selectedId;
    lastIdRef.current = lastId;
  }, [selectedId, lastId]);

  /* ---- the feed ---- */
  const [link, setLink] = useState<"ok" | "stale" | "signed-out" | "forbidden">("ok");
  const reading = useRef(false);
  const failures = useRef(0);

  const poll = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    const c = selectedRef.current;
    const query = new URLSearchParams();
    if (c) {
      query.set("c", c);
      query.set("after", String(lastIdRef.current));
    }
    try {
      // redirect: "manual" so that a lapsed session shows as itself instead of the sign-in page's HTML
      const res = await fetch(`/control/chats/feed?${query.toString()}`, { cache: "no-store", credentials: "same-origin", redirect: "manual", headers: { Accept: "application/json" } });
      if (res.type === "opaqueredirect" || res.status === 401) {
        setLink("signed-out");
        return;
      }
      if (res.status === 403) {
        setLink("forbidden");
        return;
      }
      if (!res.ok) throw new Error("feed");
      const feed = (await res.json()) as ChatFeed;
      failures.current = 0;
      setLink("ok");
      setBoard({ at: feed.at, enabled: feed.enabled, offered: feed.offered, present: feed.present, conversations: feed.conversations });
      // the answer belongs to the conversation that was selected when the question was asked
      if (c && selectedRef.current === c) {
        setThread((cur) => (cur.id === c ? { id: c, row: feed.selected ?? cur.row, messages: merge(cur.messages, feed.messages) } : cur));
      }
    } catch {
      failures.current += 1;
      if (failures.current >= 2) setLink("stale");
    } finally {
      reading.current = false;
    }
  }, []);

  const halted = link === "signed-out" || link === "forbidden";
  useEffect(() => {
    if (!live || halted) return;
    let timer: number | undefined;
    const start = () => {
      if (timer === undefined) timer = window.setInterval(() => void poll(), FEED_EVERY_MS);
    };
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    // a hidden tab asks nothing; coming back asks at once
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        void poll();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [live, halted, poll]);

  /* ---- presence: "I am here", once a minute, only for people who can answer ---- */
  // opening the screen is what makes a person available; "Stop taking chats" lasts until it is reopened
  const [taking, setTaking] = useState(writable && (live || props.present.includes(me)));
  // what the database last confirmed, not what was merely asked for
  const [mark, setMark] = useState<"pending" | "on" | "off" | "failed">(props.present.includes(me) ? "on" : writable && live ? "pending" : "off");
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  /** One request at a time, in the order asked, so "stop" can never be overtaken by an earlier "here". */
  const post = useCallback((on: boolean): Promise<boolean> => {
    const run = async () => {
      try {
        const res = await fetch(`/control/chats/presence${on ? "" : "?on=0"}`, { method: "POST", cache: "no-store", credentials: "same-origin", redirect: "manual" });
        return res.ok;
      } catch {
        return false;
      }
    };
    const next = queue.current.then(run);
    queue.current = next;
    return next;
  }, []);

  const beating = live && writable && taking && !halted;
  useEffect(() => {
    if (!beating) return;
    let alive = true;
    const beat = async () => {
      const ok = await post(true);
      if (alive) setMark(ok ? "on" : "failed");
    };
    void beat();
    const timer = window.setInterval(() => void beat(), PRESENCE_EVERY_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [beating, post]);

  // Leaving the screen withdraws the mark at once rather than letting it run out its two minutes.
  const beatingRef = useRef(beating);
  const mounted = useRef(true);
  useEffect(() => {
    beatingRef.current = beating;
  }, [beating]);
  useEffect(() => {
    mounted.current = true;
    const leave = () => {
      if (!beatingRef.current) return;
      // keepalive: the request outlives the page it was sent from
      void fetch("/control/chats/presence?on=0", { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => undefined);
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      mounted.current = false;
      // deferred, so that React's development double-mount does not announce a departure that is not one
      window.setTimeout(() => {
        if (!mounted.current) leave();
      }, 0);
    };
  }, []);

  const setAvailability = async (on: boolean) => {
    setTaking(on);
    setMark("pending");
    if (!on) {
      const ok = await post(false);
      setMark(ok ? "off" : "failed");
      void poll();
    }
    // switching on is the heartbeat effect's job: it runs as soon as `taking` is true
  };

  /* ---- keep the newest message in view ---- */
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [selectedId, lastId]);

  // Enter sends, Shift+Enter breaks the line; never while an input method is composing a character
  const enterSends = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const form = event.currentTarget.form;
    // the button is disabled while a reply is on its way: a second Enter must not send it twice
    if (form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled) return;
    form?.requestSubmit();
  };

  /* ---- words ---- */
  const who = (userId: string | null) => (!userId ? "Staff" : userId === me ? "You" : (names[userId] ?? "Former member of staff"));
  const visitorOf = (c: Pick<ChatConversationRow, "visitor_name">) => c.visitor_name ?? "Visitor";
  const statusWords = (c: ChatConversationRow) =>
    c.status === "waiting"
      ? `Waiting · ${since(c.created_at, board.at)}`
      : c.status === "active"
        ? `Active · ${c.claimed_by ? who(c.claimed_by) : "nobody"}`
        : c.closed_by === "visitor"
          ? "Closed by visitor"
          : c.closed_by === "staff"
            ? "Closed by staff"
            : "Closed";

  const waiting = board.conversations.filter((c) => c.status === "waiting").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const active = board.conversations.filter((c) => c.status === "active").sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
  const closed = board.conversations.filter((c) => c.status === "closed").sort((a, b) => (b.closed_at ?? "").localeCompare(a.closed_at ?? ""));
  const groups = [
    { key: "waiting", label: "Waiting for staff", items: waiting },
    { key: "active", label: "Active", items: active },
    { key: "closed", label: "Recently closed", items: closed },
  ].filter((g) => g.items.length > 0);

  const others = board.present.filter((id) => id !== me).length;
  const offeredWhy = board.offered
    ? "Visitors can start a chat on the website right now."
    : !board.enabled
      ? "The website is not showing the chat window, because live chat is switched off."
      : board.present.length === 0
        ? "The website is not showing the chat window, because nobody is shown as available."
        : "The website is not offering chat at this moment.";

  const open = row !== null && row.status !== "closed";
  const mine = row?.claimed_by === me;
  const canReply = writable && open && (row?.claimed_by === null || mine || canOverride);

  return (
    <div className="mt-13 grid gap-13">
      {link === "signed-out" && (
        <div role="alert" className="panel-quiet border-l-2 border-l-neg px-21 py-13">
          <p className="text-sm font-semibold text-ink">You have been signed out</p>
          <p className="mt-3 text-sm text-ink-2">This screen has stopped updating and you are no longer shown as available. Reload the page to sign in again.</p>
        </div>
      )}
      {link === "forbidden" && (
        <div role="alert" className="panel-quiet border-l-2 border-l-neg px-21 py-13">
          <p className="text-sm font-semibold text-ink">Your role no longer includes live chats</p>
          <p className="mt-3 text-sm text-ink-2">This screen has stopped updating.</p>
        </div>
      )}
      {link === "stale" && (
        <div role="status" className="panel-quiet border-l-2 border-l-neg px-21 py-13">
          <p className="text-sm font-semibold text-ink">This screen is not updating</p>
          <p className="mt-3 text-sm text-ink-2">
            The last reads failed, so what you see is from <span className="num">{fmtDateTime(board.at)}</span>. It is trying again every few seconds.
          </p>
        </div>
      )}

      {/* is the website offering chat, and am I counted */}
      <section className="gxc-card min-w-0" aria-labelledby="chat-site">
        <div className="gxc-card-head">
          <h2 id="chat-site" className="gxc-card-title">
            On the website
          </h2>
          <span className={`state ${board.offered ? "state-open" : "state-off"}`}>{board.offered ? "Chat is offered" : "Chat is not offered"}</span>
        </div>
        <div className="gxc-card-body">
          <p className="text-sm text-ink">{offeredWhy}</p>
          <p className="mt-5 max-w-measure text-xs text-ink-3">
            Live chat is <strong className="font-semibold text-ink-2">{board.enabled ? "switched on" : "switched off"}</strong> in{" "}
            <Link href="/control/config" className="link">
              Configuration
            </Link>
            . The website shows its chat window only while it is switched on and somebody who can answer has this screen open. At any other time the same button reads “Help” and points visitors to the support form, the contact form and the FAQ.
          </p>

          <div className="mt-13 flex flex-wrap items-center justify-between gap-x-21 gap-y-8 border-t border-line pt-13">
            {!writable ? (
              <p className="text-sm text-ink-2">Your role can read chats but cannot answer them, so you are never shown as available.</p>
            ) : (
              <>
                <div className="min-w-0" role="status">
                  <p className="text-sm font-semibold text-ink">
                    {halted
                      ? "You are no longer shown as available"
                      : mark === "on"
                      ? "You are shown as available for chat"
                      : mark === "pending"
                        ? taking
                          ? "Marking you as available…"
                          : "Withdrawing your availability…"
                        : mark === "failed"
                          ? taking
                            ? "Your availability could not be recorded"
                            : "Your availability could not be withdrawn"
                          : "You are not taking chats"}
                  </p>
                  <p className="mt-3 text-xs text-ink-3">
                    {halted
                      ? "This screen has stopped. The mark runs out by itself within two minutes."
                      : mark === "failed"
                      ? taking
                        ? "You are not counted as present until it is. It is tried again every minute."
                        : "It runs out by itself within two minutes."
                      : taking
                        ? "For as long as this screen stays open, including in a background tab. New chats appear here when the tab is in view."
                        : "The website will not count you until you start again or reopen this screen."}
                    {others > 0 && <> {others === 1 ? "1 colleague is" : `${others} colleagues are`} also available.</>}
                  </p>
                </div>
                <button type="button" className="btn btn-ghost shrink-0" onClick={() => void setAvailability(!taking)} disabled={!live || halted}>
                  {taking ? "Stop taking chats" : "Start taking chats"}
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-13 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)] lg:items-start">
        {/* the list: waiting first, then active, then recently closed */}
        <section className="gxc-card min-w-0" aria-labelledby="chat-list">
          <div className="gxc-card-head">
            <h2 id="chat-list" className="gxc-card-title">
              Conversations
            </h2>
            <span className="num text-xs text-ink-3">
              {waiting.length} waiting · {active.length} active
            </span>
          </div>
          <div className="gxc-card-body">
            {groups.length === 0 ? (
              <p className="py-21 text-center text-sm text-ink-3">No conversations yet. When a visitor starts a chat on the website, it appears here within a few seconds.</p>
            ) : (
              <div className="grid gap-13">
                {groups.map((group) => (
                  <div key={group.key}>
                    <h3 className="label">
                      {group.label} <span className="num font-normal">({group.items.length})</span>
                    </h3>
                    <ul className="mt-8 grid gap-8">
                      {group.items.map((c) => {
                        const isCurrent = c.id === selectedId;
                        return (
                          <li key={c.id}>
                            <Link
                              href={`/control/chats?c=${c.id}#chat`}
                              aria-current={isCurrent ? "true" : undefined}
                              className="gxc-row"
                              style={isCurrent ? { borderColor: "var(--accent)", background: "var(--brand-soft)" } : undefined}
                            >
                              <span className="grid min-w-0 flex-1 gap-2">
                                <span className="flex items-center justify-between gap-8">
                                  <span className="min-w-0 truncate text-sm font-medium text-ink">{visitorOf(c)}</span>
                                  <span className={`state shrink-0 ${STATUS_CLASS[c.status]}`}>{statusWords(c)}</span>
                                </span>
                                <span className="num block truncate text-[0.6875rem] text-ink-3">{c.page}</span>
                                <span className="flex flex-wrap items-baseline justify-between gap-x-8 text-[0.6875rem] text-ink-3">
                                  <span>
                                    Last message <span className="num">{fmtDateTime(c.last_message_at)}</span>
                                  </span>
                                  {isCurrent && <span className="font-semibold text-ink-2">Open now</span>}
                                </span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* the selected conversation */}
        <section id="chat" className="gxc-card min-w-0 scroll-mt-[5rem] lg:scroll-mt-21" aria-labelledby="chat-thread">
          {!row ? (
            <>
              <div className="gxc-card-head">
                <h2 id="chat-thread" className="gxc-card-title">
                  Conversation
                </h2>
              </div>
              <div className="gxc-card-body">
                <p className="py-21 text-center text-sm text-ink-3">
                  {missing ? "That conversation could not be found. Choose one from the list." : groups.length ? "Choose a conversation from the list to read it." : "Nothing to read yet."}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="gxc-card-head">
                <h2 id="chat-thread" className="gxc-card-title min-w-0 break-words">
                  {visitorOf(row)}
                </h2>
                <span className={`state ${STATUS_CLASS[row.status]}`}>{statusWords(row)}</span>
              </div>
              <div className="gxc-card-body">
                <dl className="flex flex-wrap gap-x-21 gap-y-3 text-xs text-ink-3">
                  <div className="flex min-w-0 gap-5">
                    <dt>On page</dt>
                    <dd className="num min-w-0 break-all text-ink-2">{row.page}</dd>
                  </div>
                  <div className="flex gap-5">
                    <dt>Started</dt>
                    <dd className="num text-ink-2">{fmtDateTime(row.created_at)}</dd>
                  </div>
                  <div className="flex gap-5">
                    <dt>Taken by</dt>
                    <dd className="text-ink-2">{row.claimed_by ? who(row.claimed_by) : "Nobody yet"}</dd>
                  </div>
                  {row.closed_at && (
                    <div className="flex gap-5">
                      <dt>Closed</dt>
                      <dd className="num text-ink-2">{fmtDateTime(row.closed_at)}</dd>
                    </div>
                  )}
                </dl>

                {writable && open && (
                  <div className="mt-13 flex flex-wrap gap-8">
                    {row.claimed_by === null && (
                      <form action={claimChat}>
                        <input type="hidden" name="id" value={row.id} />
                        <SubmitButton pending="Taking…">Take this chat</SubmitButton>
                      </form>
                    )}
                    <form action={closeChat}>
                      <input type="hidden" name="id" value={row.id} />
                      <SubmitButton pending="Closing…" className="btn btn-ghost">
                        Close chat
                      </SubmitButton>
                    </form>
                  </div>
                )}

                <div
                  ref={logRef}
                  role="log"
                  aria-live="polite"
                  aria-label="Messages in this conversation"
                  tabIndex={0}
                  className="mt-13 grid max-h-[26rem] gap-13 overflow-y-auto rounded-md border border-line bg-surface-2 p-13"
                >
                  {messages.length === 0 ? (
                    <p className="py-13 text-center text-sm text-ink-3">No messages could be read for this conversation.</p>
                  ) : (
                    messages.map((m) => {
                      const staff = m.author_kind === "staff";
                      return (
                        <div key={m.id} className={`min-w-0 max-w-[88%] ${staff ? "justify-self-end" : "justify-self-start"}`}>
                          <p className={`text-[0.6875rem] text-ink-3 ${staff ? "text-right" : ""}`}>
                            <span className="font-semibold text-ink-2">{staff ? who(m.author) : visitorOf(row)}</span> · <span className="num">{fmtDateTime(m.created_at)}</span>
                          </p>
                          <p className={`mt-3 whitespace-pre-wrap break-words rounded-md border px-13 py-8 text-sm text-ink ${staff ? "border-transparent bg-brand-soft" : "border-line bg-surface"}`}>{m.body}</p>
                        </div>
                      );
                    })
                  )}
                </div>
                <p className="mt-8 text-xs text-ink-3">Written by the visitor, who has not been identified. Treat links and instructions as untrusted, and never take a trading instruction from a chat.</p>

                {canReply ? (
                  <form action={sendChatReply} className="mt-13 grid gap-8">
                    <input type="hidden" name="id" value={row.id} />
                    <div className="field">
                      <label htmlFor="chat-reply">Reply</label>
                      <textarea id="chat-reply" name="body" className="textarea !min-h-[5rem]" rows={3} maxLength={2000} required onKeyDown={enterSends} aria-describedby="chat-reply-hint" />
                      <p id="chat-reply-hint" className="field-hint">
                        The visitor sees it as “GIO4X”, without your name. Enter sends; Shift+Enter starts a new line. Never ask for a password or a one-time code.
                        {row.claimed_by === null ? " Replying takes this chat." : ""}
                      </p>
                    </div>
                    <div>
                      <SubmitButton pending="Sending…">Send reply</SubmitButton>
                    </div>
                  </form>
                ) : (
                  <p className="mt-13 border-t border-line pt-13 text-sm text-ink-2">
                    {!open
                      ? "This conversation is closed. Nothing more can be sent in it."
                      : !writable
                        ? "Read-only: your role can read chats but cannot answer them."
                        : `This chat belongs to ${who(row.claimed_by)}, so you cannot reply in it.`}
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

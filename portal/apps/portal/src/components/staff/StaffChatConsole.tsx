"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, ShieldCheck, UserCircle2, CheckCircle2, UserPlus } from "lucide-react";
import { createBrowserSupabaseClient } from "@gio4x/supabase";
import { cn } from "@gio4x/ui";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { sendChatMessage, assignChatToMe, setChatStatus } from "@/lib/chat-actions";

export type ConversationRow = {
  id: string;
  subject: string;
  status: "open" | "active" | "closed";
  user_id: string | null;
  assigned_staff: string | null;
  last_message_at: string;
  created_at: string;
  guest_name: string | null;
  source: string;
  customer_name: string;
};

type ChatMsg = {
  id: string;
  body: string;
  is_staff_reply: boolean;
  created_at: string;
};

function statusTone(status: ConversationRow["status"]): StatusTone {
  if (status === "active") return "info";
  if (status === "closed") return "success";
  return "warning";
}

export function StaffChatConsole({
  conversations: initialConversations,
  initialSelectedId,
}: {
  conversations: ConversationRow[];
  initialSelectedId: string | null;
}) {
  const [conversations, setConversations] = useState<ConversationRow[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? initialConversations[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const refreshList = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, subject, status, user_id, assigned_staff, last_message_at, created_at, guest_name, source")
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (!data) return;
    setConversations((prev) => {
      const nameById = new Map(prev.map((c) => [c.id, c.customer_name]));
      return data.map((c) => {
        const row = c as Omit<ConversationRow, "customer_name">;
        return {
          ...row,
          customer_name: nameById.get(row.id) ?? row.guest_name ?? "Customer",
        };
      });
    });
  }, []);

  // Load messages whenever the selected conversation changes.
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    const supabase = createBrowserSupabaseClient();
    void supabase
      .from("chat_messages")
      .select("id, body, is_staff_reply, created_at")
      .eq("conversation_id", selectedId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setMessages((data as ChatMsg[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Realtime: append messages for the selected conversation.
  useEffect(() => {
    if (!selectedId) return;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`staff-chat:${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${selectedId}`,
        },
        (payload) => {
          const m = payload.new as ChatMsg;
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedId]);

  // Realtime: keep the conversation list fresh (new threads, status, ordering).
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("staff-chat:list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_conversations" },
        () => void refreshList(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshList]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    setError(null);
    const optimistic: ChatMsg = {
      id: `tmp-${Date.now()}`,
      body: text,
      is_staff_reply: true,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    const res = await sendChatMessage(selectedId, text);
    if (!res.ok) {
      setError(res.error);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } else {
      void refreshList();
    }
    setSending(false);
  }

  async function onAssign() {
    if (!selectedId) return;
    const res = await assignChatToMe(selectedId);
    if (!res.ok) setError(res.error);
    else void refreshList();
  }

  async function onClose() {
    if (!selectedId) return;
    const res = await setChatStatus(selectedId, "closed");
    if (!res.ok) setError(res.error);
    else void refreshList();
  }

  return (
    <div className="grid h-[calc(100vh-12rem)] grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
      {/* Conversation list */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-navy">
          Conversations
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-steel">No conversations yet.</div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition",
                  c.id === selectedId ? "bg-sky/10" : "hover:bg-slate-50",
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-steel">
                  <UserCircle2 size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-navy">{c.customer_name}</span>
                      {c.source !== "portal" ? (
                        <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-steel">
                          Web
                        </span>
                      ) : null}
                    </span>
                    <StatusBadge tone={statusTone(c.status)}>{c.status}</StatusBadge>
                  </div>
                  <div className="truncate text-[11px] text-steel-light">
                    {new Date(c.last_message_at).toLocaleString()}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-steel">
            Select a conversation to start replying.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-navy">{selected.customer_name}</div>
                <div className="text-[11px] text-steel-light">{selected.subject}</div>
              </div>
              <div className="flex items-center gap-2">
                {!selected.assigned_staff ? (
                  <button
                    type="button"
                    onClick={onAssign}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky/30 px-2.5 py-1 text-xs font-medium text-sky transition hover:bg-sky/5"
                  >
                    <UserPlus size={13} /> Claim
                  </button>
                ) : null}
                {selected.status !== "closed" ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-steel transition hover:bg-slate-50"
                  >
                    <CheckCircle2 size={13} /> Close
                  </button>
                ) : (
                  <StatusBadge tone="success">Closed</StatusBadge>
                )}
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-slate-50 px-4 py-4">
              {messages.length === 0 ? (
                <div className="px-2 py-6 text-center text-xs text-steel">No messages yet.</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={m.is_staff_reply ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        m.is_staff_reply
                          ? "max-w-[70%] rounded-2xl rounded-br-sm bg-sky px-3 py-2 text-sm text-white"
                          : "max-w-[70%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-navy shadow-sm ring-1 ring-slate-200"
                      }
                    >
                      <div className="mb-0.5 flex items-center gap-1 text-[10px] opacity-80">
                        {m.is_staff_reply ? <ShieldCheck size={11} /> : <UserCircle2 size={11} />}
                        {m.is_staff_reply ? "You" : selected.customer_name}
                      </div>
                      <div className="whitespace-pre-wrap break-words">{m.body}</div>
                      <div
                        className={cn(
                          "mt-0.5 text-[10px]",
                          m.is_staff_reply ? "text-white/70" : "text-steel-light",
                        )}
                      >
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {error ? (
              <div className="bg-rose-50 px-4 py-1.5 text-[11px] text-rose-700">{error}</div>
            ) : null}

            <form onSubmit={onSend} className="flex items-center gap-2 border-t border-slate-200 p-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type your reply…"
                disabled={selected.status === "closed"}
                className="min-w-0 flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm focus:border-sky focus:outline-none disabled:bg-slate-50"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim() || selected.status === "closed"}
                aria-label="Send reply"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky text-white transition hover:bg-sky-light disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

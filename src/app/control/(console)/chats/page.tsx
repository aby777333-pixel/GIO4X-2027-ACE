import { readBoard, readThread } from "@/app/control/(console)/chats/data";
import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { ChatsView } from "@/components/control/views/ChatsView";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Live Chats", "/control/chats");

const NOTICES: Record<string, string> = {
  taken: "The chat is yours.",
  closed: "Chat closed.",
};
const ERRORS: Record<string, string> = {
  invalid: "That request was not valid. Nothing was changed.",
  gone: "That chat has already been taken by a colleague, or it is closed. Nothing was changed.",
  forbidden: "That chat belongs to a colleague, or your role does not allow it. Nothing was changed.",
  empty: "A reply needs some text, up to 2,000 characters. Nothing was sent.",
  save: "That could not be saved. Nothing was changed; please try again.",
};

export default async function ChatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "chats.read")) return <NoAccess title="Live Chats" />;
  const { supabase } = ctx;

  const params = await searchParams;
  // the only thing ever placed in this page's URL about a conversation is its id
  const c = firstParam(params.c);
  const selectedId = isUuid(c) ? c : null;

  const [board, thread, names] = await Promise.all([readBoard(supabase), selectedId ? readThread(supabase, selectedId, 0) : null, staffDirectory(supabase)]);

  return (
    <ChatsView
      failed={board.failed || !!thread?.failed}
      at={board.at}
      enabled={board.enabled}
      offered={board.offered}
      present={board.present}
      conversations={board.conversations}
      selected={thread?.selected ?? null}
      missing={c !== "" && !thread?.selected}
      messages={thread?.messages ?? []}
      names={Object.fromEntries(names)}
      me={ctx.userId}
      writable={can(ctx, "chats.write")}
      canOverride={can(ctx, "leads.assign")}
      live
      notice={NOTICES[firstParam(params.notice)]}
      error={ERRORS[firstParam(params.error)]}
    />
  );
}

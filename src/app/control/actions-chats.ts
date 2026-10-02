"use server";

/**
 * Server actions for Live Chats: take a conversation, reply in it, close it.
 *
 * The same four steps as src/app/control/actions.ts: establish who is calling,
 * check the capability, validate the input, then act AS THE SIGNED-IN USER.
 * Here the acting is done by the chat_staff_* functions (0008_chat.sql), which
 * check chats.write again, make "take" a compare-and-set so two people cannot
 * both hold one conversation, and record who claimed and who closed it.
 *
 * Outcomes go back as fixed codes. The reply text is never placed in a URL,
 * a redirect or a log line, and a database message is never shown.
 */
import { redirect } from "next/navigation";
import { can, getAccess, SIGN_IN_PATH } from "@/lib/server/staff";
import { cleanText, isUuid } from "@/lib/server/validate";

const CHATS = "/control/chats";
/** Must equal `chat_messages_body_valid` in 0008_chat.sql. */
const BODY_MAX = 2000;

async function writer() {
  const access = await getAccess();
  if (access.state === "anonymous") redirect(SIGN_IN_PATH);
  if (access.state !== "staff") redirect("/control");
  return access;
}

/** Back to the conversation (a uuid is not personal data), with the outcome as a fixed code. */
function back(id: string, outcome: string): string {
  return `${CHATS}?c=${id}${outcome ? `&${outcome}` : ""}#chat`;
}

/** The database's refusals, as fixed codes. */
function chatError(code: string | undefined): string {
  if (code === "P0002") return "gone"; // already taken by somebody else, or closed
  if (code === "42501") return "forbidden"; // a colleague's conversation, or the role cannot write
  if (code === "23514") return "empty"; // the message did not pass the table's check
  return "save";
}

export async function claimChat(formData: FormData): Promise<void> {
  const ctx = await writer();
  const id = formData.get("id");
  if (!isUuid(id)) redirect(`${CHATS}?error=invalid`);
  if (!can(ctx, "chats.write")) redirect(back(id, "error=forbidden"));

  const { error } = await ctx.supabase.rpc("chat_staff_claim", { p_id: id });
  if (error) redirect(back(id, `error=${chatError(error.code)}`));
  redirect(back(id, "notice=taken"));
}

export async function sendChatReply(formData: FormData): Promise<void> {
  const ctx = await writer();
  const id = formData.get("id");
  const raw = formData.get("body");
  if (!isUuid(id)) redirect(`${CHATS}?error=invalid`);
  if (!can(ctx, "chats.write")) redirect(back(id, "error=forbidden"));

  const body = typeof raw === "string" ? cleanText(raw) : "";
  if (body.length < 1 || body.length > BODY_MAX) redirect(back(id, "error=empty"));

  // Replying takes a conversation nobody has taken; the function does both in one transaction.
  const { error } = await ctx.supabase.rpc("chat_staff_send", { p_id: id, p_body: body });
  if (error) redirect(back(id, `error=${chatError(error.code)}`));
  // no notice: the reply appearing in the conversation is the confirmation
  redirect(back(id, ""));
}

export async function closeChat(formData: FormData): Promise<void> {
  const ctx = await writer();
  const id = formData.get("id");
  if (!isUuid(id)) redirect(`${CHATS}?error=invalid`);
  if (!can(ctx, "chats.write")) redirect(back(id, "error=forbidden"));

  const { error } = await ctx.supabase.rpc("chat_staff_close", { p_id: id });
  if (error) redirect(back(id, `error=${chatError(error.code)}`));
  redirect(back(id, "notice=closed"));
}

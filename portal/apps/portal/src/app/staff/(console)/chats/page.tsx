import { PageHeader } from "@/components/PageHeader";
import { getSupabaseServer } from "@/lib/supabase-server";
import { StaffChatConsole, type ConversationRow } from "@/components/staff/StaffChatConsole";

export const dynamic = "force-dynamic";

export default async function StaffChatsPage({
  searchParams,
}: {
  searchParams: { c?: string };
}) {
  const supabase = getSupabaseServer();

  const { data: convs } = await supabase
    .from("chat_conversations")
    .select("id, subject, status, user_id, assigned_staff, last_message_at, created_at, guest_name, source")
    .order("last_message_at", { ascending: false })
    .limit(100);

  const conversations = (convs ?? []) as Omit<ConversationRow, "customer_name">[];

  // Resolve customer display names in one round-trip (guests carry their own name).
  const userIds = Array.from(
    new Set(conversations.map((c) => c.user_id).filter((id): id is string => !!id)),
  );
  const nameMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      nameMap.set(p.id, p.full_name?.trim() || p.email || "Customer");
    }
  }

  const rows: ConversationRow[] = conversations.map((c) => ({
    ...c,
    customer_name:
      (c.user_id ? nameMap.get(c.user_id) : null) ?? c.guest_name ?? "Customer",
  }));

  return (
    <>
      <PageHeader title="Live Chats" subtitle="Respond to customer conversations in real time." />
      <StaffChatConsole conversations={rows} initialSelectedId={searchParams.c ?? null} />
    </>
  );
}

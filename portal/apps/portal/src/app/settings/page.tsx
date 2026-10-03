import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody } from "@gio4x/ui";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import { DEFAULT_PREFERENCES, type Preferences } from "./preferences";
import { SettingsForm, type AccountOption } from "./settings-form";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Shell title="Settings">
        <PageHeader title="Settings" subtitle="Language, time zone, and display preferences." />
        <Card>
          <CardBody className="!py-12 text-center text-sm text-steel">
            <Link href="/auth/login?redirect=/settings" className="font-medium text-sky hover:underline">
              Sign in
            </Link>{" "}
            to manage your preferences.
          </CardBody>
        </Card>
      </Shell>
    );
  }

  // Saved preferences (jsonb) merged over defaults.
  const meta = (user.profile?.metadata as Record<string, unknown> | null) ?? {};
  const saved = (meta.preferences as Partial<Preferences> | undefined) ?? {};
  const prefs: Preferences = { ...DEFAULT_PREFERENCES, ...saved };

  // Real trading accounts for the "default account" picker (no mock data).
  const supabase = getSupabaseServer();
  const { data: rows } = await supabase
    .from("trading_accounts")
    .select("account_number, account_kind")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  const accounts: AccountOption[] = (rows ?? []).map((a) => ({
    value: String(a.account_number),
    label: `${a.account_number} — ${a.account_kind ?? "account"}`,
  }));

  return (
    <Shell title="Settings">
      <PageHeader title="Settings" subtitle="Language, time zone, and display preferences." />
      <SettingsForm
        prefs={prefs}
        language={user.profile?.language ?? "en"}
        timezone={user.profile?.timezone ?? "UTC"}
        accounts={accounts}
      />
    </Shell>
  );
}

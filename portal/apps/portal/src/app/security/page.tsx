import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, CardHeader, CardTitle, Button } from "@gio4x/ui";
import { Fingerprint, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import { DeviceSessionRow, type SessionRow } from "./session-row";

export default async function SecurityPage() {
  const user = await getCurrentUser();

  let sessions: SessionRow[] = [];
  if (user) {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("device_sessions")
      .select("id, device_label, user_agent, ip_address, last_seen_at, revoked_at")
      .eq("user_id", user.id)
      .order("last_seen_at", { ascending: false })
      .limit(20);
    sessions = ((data ?? []) as Array<{
      id: string;
      device_label: string | null;
      user_agent: string | null;
      ip_address: unknown;
      last_seen_at: string;
      revoked_at: string | null;
    }>).map((s) => ({
      id: s.id,
      device_label: s.device_label,
      user_agent: s.user_agent,
      ip_address: s.ip_address == null ? null : String(s.ip_address),
      last_seen_at: s.last_seen_at,
      revoked_at: s.revoked_at,
    }));
  }

  return (
    <Shell title="Security">
      <PageHeader title="Security" subtitle="Sign-in, 2FA, sessions, API keys." />

      {!user ? (
        <div className="mb-4 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-xs text-steel">
          <Link href="/auth/login?redirect=/security" className="font-medium text-sky hover:underline">
            Sign in
          </Link>{" "}
          to manage security settings.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sign-in & 2FA</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3">
              <div className="flex items-start gap-3">
                <KeyRound size={18} className="mt-0.5 text-sky" />
                <div>
                  <div className="text-sm font-medium text-navy">Password</div>
                  <div className="text-[11px] text-steel">Managed through GIO4X auth.</div>
                </div>
              </div>
              <Link
                href="/auth/forgot-password"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-navy"
              >
                Reset
              </Link>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3">
              <div className="flex items-start gap-3">
                <Smartphone size={18} className="mt-0.5 text-sky" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-navy">Authenticator app (2FA)</span>
                    <StatusBadge tone="neutral">Coming soon</StatusBadge>
                  </div>
                  <div className="text-[11px] text-steel">
                    TOTP enrollment will land in the next security update.
                  </div>
                </div>
              </div>
              <Button variant="ghost" className="border border-slate-200 !text-xs" disabled>
                Configure
              </Button>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3">
              <div className="flex items-start gap-3">
                <Fingerprint size={18} className="mt-0.5 text-sky" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-navy">Biometric / Passkey</span>
                    <StatusBadge tone="neutral">Off</StatusBadge>
                  </div>
                  <div className="text-[11px] text-steel">
                    Sign in with Face ID, Touch ID, or Windows Hello.
                  </div>
                </div>
              </div>
              <Button variant="primary" className="!text-xs" disabled>
                Enable
              </Button>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3">
              <div className="flex items-start gap-3">
                <ShieldCheck size={18} className="mt-0.5 text-sky" />
                <div>
                  <div className="text-sm font-medium text-navy">Withdrawal 2FA</div>
                  <div className="text-[11px] text-steel">
                    Always require a second factor for live withdrawals.
                  </div>
                </div>
              </div>
              <StatusBadge tone="success">On</StatusBadge>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active sessions</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {sessions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-xs text-steel">
                No device sessions on record.
              </div>
            ) : (
              sessions.map((s) => <DeviceSessionRow key={s.id} s={s} />)
            )}
          </CardBody>
        </Card>
      </div>
    </Shell>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { AuthCard, Button, PasswordMeter, RoleSelect, type SignupRole } from "@gio4x/ui";
import { signUp } from "@/lib/auth-actions";
import { withBase } from "@/lib/base-path";

export default function SignupPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SignupRole>(
    (search.get("role") as SignupRole) || "trader",
  );
  const referralFromUrl = search.get("ref") || "";
  // Account type carried over from the website's account-types page.
  const PLAN_LABELS: Record<string, string> = {
    classic: "Classic — $150 min deposit",
    premium: "Premium — $500 min deposit",
    ecn: "ECN — $2,000 min deposit",
  };
  const planFromUrl = (search.get("plan") || "").toLowerCase();
  const plan = PLAN_LABELS[planFromUrl] ? planFromUrl : "";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await signUp({
        email: String(fd.get("email") || ""),
        password: String(fd.get("password") || ""),
        fullName: String(fd.get("full_name") || ""),
        phone: String(fd.get("phone") || "") || undefined,
        role,
        referralCode: String(fd.get("referral_code") || "") || undefined,
        plan: plan || undefined,
      });
      if (res.ok) {
        router.push(res.redirectTo ?? "/auth/verify-email");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Trade with institutional execution. Two minutes to set up."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium text-sky hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {plan ? (
          <div className="flex items-center justify-between rounded-lg border border-sky/30 bg-sky/5 px-3 py-2">
            <span className="text-xs font-medium text-navy">
              Selected account type: <span className="text-sky">{PLAN_LABELS[plan]}</span>
            </span>
          </div>
        ) : null}
        <RoleSelect value={role} onChange={setRole} disabled={pending} />

        <div>
          <label htmlFor="full_name" className="block text-xs font-medium text-steel">
            Full name (as on ID)
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            autoComplete="name"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky/60 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-steel">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky/60 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-xs font-medium text-steel">
              Mobile <span className="text-steel-light">(E.164, optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky/60 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-medium text-steel">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky/60 focus:outline-none"
          />
          <PasswordMeter password={password} />
        </div>

        <div>
          <label htmlFor="referral_code" className="block text-xs font-medium text-steel">
            Referral code <span className="text-steel-light">(optional)</span>
          </label>
          <input
            id="referral_code"
            name="referral_code"
            type="text"
            defaultValue={referralFromUrl}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase focus:border-sky/60 focus:outline-none"
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="text-[11px] text-steel-light">
          By creating an account you agree to GIO4X&apos;s{" "}
          <a href={withBase("/legal/terms")} target="_blank" rel="noreferrer" className="text-sky hover:underline">terms</a>{" "}
          and acknowledge the{" "}
          <a href={withBase("/legal/risk_disclosure")} target="_blank" rel="noreferrer" className="text-sky hover:underline">risk disclosure</a>.
          Trading leveraged products carries significant risk.
        </div>

        <Button variant="primary" type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { AuthCard, Button } from "@gio4x/ui";
import { resendVerification } from "@/lib/auth-actions";

export default function VerifyEmailPage() {
  const search = useSearchParams();
  const email = search.get("email") || "";
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onResend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await resendVerification(fd);
      if (res.ok) setMessage(res.message ?? "Email re-sent.");
      else setError(res.error);
    });
  }

  return (
    <AuthCard
      title="Verify your email"
      subtitle={
        email
          ? `We sent a confirmation link to ${email}. Click it to activate your account.`
          : "We sent a confirmation link to your email. Click it to activate your account."
      }
      footer={
        <Link href="/auth/login" className="text-sky hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      <div className="rounded-lg bg-sky/5 px-3 py-2 text-xs text-navy">
        Tip: check your spam folder. Links expire in 24 hours.
      </div>

      <form onSubmit={onResend} className="mt-4 space-y-3">
        <input type="hidden" name="email" value={email} />
        {message ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}
        <Button
          variant="ghost"
          type="submit"
          className="w-full border border-slate-200"
          disabled={pending || !email}
        >
          {pending ? "Sending…" : "Resend verification email"}
        </Button>
      </form>
    </AuthCard>
  );
}

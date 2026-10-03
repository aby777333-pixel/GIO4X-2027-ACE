"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AuthCard, Button, PasswordMeter } from "@gio4x/ui";
import { setNewPassword } from "@/lib/auth-actions";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await setNewPassword(fd);
      if (res.ok) {
        router.push(res.redirectTo ?? "/");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <AuthCard
      title="Set a new password"
      subtitle="Pick something only you would know."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-xs font-medium text-steel">
            New password
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
          <label htmlFor="confirm" className="block text-xs font-medium text-steel">
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky/60 focus:outline-none"
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        <Button variant="primary" type="submit" className="w-full" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthCard>
  );
}

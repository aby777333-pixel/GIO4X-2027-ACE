"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AuthCard, Button } from "@gio4x/ui";
import { staffSignIn } from "@/lib/staff-auth-actions";

export default function StaffLoginPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await staffSignIn(fd);
      if (res.ok) {
        router.push(res.redirectTo ?? "/staff");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <AuthCard
      title="Staff Console"
      subtitle="GIO4X Service Console — authorised staff access only."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-xs font-medium text-steel">
            Username or staff email
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            autoComplete="username"
            autoFocus
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky/60 focus:outline-none"
          />
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
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky/60 focus:outline-none"
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        <Button variant="primary" type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Enter console"}
        </Button>
      </form>
    </AuthCard>
  );
}

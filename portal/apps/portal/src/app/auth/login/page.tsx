"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AuthCard, Button } from "@gio4x/ui";
import { signIn } from "@/lib/auth-actions";

export default function LoginPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const res = await signIn(fd);
        if (!res) {
          setError("Something went wrong. Please try again.");
          return;
        }
        if (res.ok) {
          router.push(res.redirectTo ?? "/");
          router.refresh();
        } else {
          setError(res.error);
        }
      } catch {
        setError("Login failed. Please try again.");
      }
    });
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back. Sign in to your GIO4X Trader Area."
      footer={
        <>
          New here?{" "}
          <Link href="/auth/signup" className="font-medium text-sky hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
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
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-xs font-medium text-steel">
              Password
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-[11px] font-medium text-sky hover:underline"
            >
              Forgot password?
            </Link>
          </div>
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
          {pending ? "Signing in…" : "Sign in"}
        </Button>

        <div className="relative my-3 text-center">
          <span className="bg-white px-2 text-[10px] uppercase tracking-wider text-steel-light">
            or
          </span>
          <span className="absolute left-0 right-0 top-1/2 -z-10 h-px bg-slate-200" />
        </div>

        <Link
          href="/auth/verify-otp"
          className="block w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-center text-sm font-medium text-navy hover:border-sky/40"
        >
          Sign in with email code
        </Link>
      </form>
    </AuthCard>
  );
}

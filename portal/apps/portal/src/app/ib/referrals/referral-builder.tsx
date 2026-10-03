"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReferralLink } from "@/lib/referral-actions";

const DESTINATIONS = [
  { value: "register", label: "Live account sign-up" },
  { value: "register-demo", label: "Demo account sign-up" },
  { value: "home", label: "GIO4X homepage" },
  { value: "raptor", label: "GIO Raptor terminal" },
];

export function ReferralBuilder({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [destination, setDestination] = useState("register");
  const [subId, setSubId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onGenerate() {
    setError(null);
    setSuccess(null);
    if (!signedIn) {
      setError("Sign in to create referral links.");
      return;
    }
    startTransition(async () => {
      const res = await createReferralLink({ name, destination, subId });
      if (res.ok) {
        setSuccess(`Created: ${res.code}`);
        setName("");
        setSubId("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-steel">Destination</label>
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {DESTINATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-steel">Name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. YouTube — May campaign"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-steel">Sub-ID (optional)</label>
          <input
            type="text"
            value={subId}
            onChange={(e) => setSubId(e.target.value)}
            placeholder="youtube-ad-may"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onGenerate}
          disabled={pending}
          className="rounded-lg bg-sky px-4 py-2 text-xs font-semibold text-white hover:bg-sky-light disabled:opacity-60"
        >
          {pending ? "Generating…" : "Generate referral link"}
        </button>
        {error ? <span className="text-xs text-rose-700">{error}</span> : null}
        {success ? <span className="text-xs text-emerald-700">{success}</span> : null}
      </div>
    </div>
  );
}

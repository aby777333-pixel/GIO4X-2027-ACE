"use client";

import { cn } from "./cn";

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "very weak" | "weak" | "fair" | "good" | "strong";
  reasons: string[];
};

/**
 * Cheap heuristic. Server should enforce the real policy.
 *  - length ≥ 8     +1
 *  - mixed case     +1
 *  - has digit      +1
 *  - has symbol     +1
 */
export function scorePassword(pw: string): PasswordStrength {
  const reasons: string[] = [];
  let score = 0;
  if (pw.length >= 8) score++;
  else reasons.push("at least 8 characters");
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  else reasons.push("mix upper- and lower-case");
  if (/\d/.test(pw)) score++;
  else reasons.push("at least one number");
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  else reasons.push("at least one symbol");

  const label = (["very weak", "weak", "fair", "good", "strong"] as const)[score];
  return { score: score as PasswordStrength["score"], label, reasons };
}

const tones = ["bg-rose-400", "bg-rose-400", "bg-amber-400", "bg-sky", "bg-emerald-500"];

export function PasswordMeter({ password }: { password: string }) {
  if (!password) return null;
  const { score, label, reasons } = scorePassword(password);
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < score ? tones[score] : "bg-slate-200",
            )}
          />
        ))}
      </div>
      <div className="mt-1 flex items-baseline justify-between text-[11px]">
        <span className="font-medium text-navy capitalize">{label}</span>
        {reasons.length > 0 ? (
          <span className="text-steel">add: {reasons.join(", ")}</span>
        ) : (
          <span className="text-emerald-600">strong enough</span>
        )}
      </div>
    </div>
  );
}

"use client";

import { cn } from "./cn";

export type SignupRole = "trader" | "ib" | "affiliate";

type RoleOption = {
  value: SignupRole;
  title: string;
  description: string;
  icon: string;
};

const OPTIONS: RoleOption[] = [
  {
    value: "trader",
    title: "Trader",
    description: "Personal account for trading FX, metals, crypto, indices.",
    icon: "📈",
  },
  {
    value: "ib",
    title: "Introducing Broker",
    description: "Refer clients and earn commission on their trading volume.",
    icon: "🤝",
  },
  {
    value: "affiliate",
    title: "Affiliate",
    description: "Earn from marketing links — pay-per-FTD or revenue share.",
    icon: "📣",
  },
];

export function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: SignupRole;
  onChange: (v: SignupRole) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2" role="radiogroup" aria-label="Account type">
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3 text-left transition",
              active ? "border-sky bg-sky/5" : "border-slate-200 bg-white hover:border-sky/40",
              disabled && "opacity-50",
            )}
          >
            <span className="text-lg leading-none">{opt.icon}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-navy">{opt.title}</span>
              <span className="block text-[11px] text-steel">{opt.description}</span>
            </span>
            <span
              className={cn(
                "mt-1 h-4 w-4 shrink-0 rounded-full border-2",
                active ? "border-sky bg-sky" : "border-slate-300",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

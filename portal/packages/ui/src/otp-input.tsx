"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";

type OtpInputProps = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
};

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled,
  ariaLabel = "One-time passcode",
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [focused, setFocused] = useState(-1);

  // sanitise value to digits only, max `length`
  useEffect(() => {
    const cleaned = value.replace(/\D/g, "").slice(0, length);
    if (cleaned !== value) onChange(cleaned);
    if (cleaned.length === length && onComplete) onComplete(cleaned);
  }, [value, length, onChange, onComplete]);

  function setDigit(i: number, digit: string) {
    const arr = value.split("");
    arr[i] = digit;
    const next = arr.join("").padEnd(0, "").slice(0, length);
    onChange(next);
    if (digit && i < length - 1) refs.current[i + 1]?.focus();
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (pasted) {
      e.preventDefault();
      onChange(pasted);
      refs.current[Math.min(pasted.length, length - 1)]?.focus();
    }
  }

  return (
    <div className="flex gap-2" role="group" aria-label={ariaLabel}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={value[i] ?? ""}
          disabled={disabled}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, "").slice(0, 1))}
          onKeyDown={(e) => handleKey(e, i)}
          onPaste={handlePaste}
          onFocus={() => setFocused(i)}
          onBlur={() => setFocused(-1)}
          className={cn(
            "h-12 w-10 rounded-lg border bg-white text-center text-lg font-semibold text-navy transition",
            focused === i ? "border-sky ring-2 ring-sky/30" : "border-slate-200",
            disabled && "opacity-50",
          )}
        />
      ))}
    </div>
  );
}

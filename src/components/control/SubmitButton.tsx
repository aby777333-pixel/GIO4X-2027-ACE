"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Submit button that reports progress and cannot be pressed twice while a server action runs. */
export function SubmitButton({ children, pending, className = "btn btn-primary" }: { children: ReactNode; pending: string; className?: string }) {
  const status = useFormStatus();
  return (
    <button type="submit" className={className} disabled={status.pending} aria-disabled={status.pending}>
      {status.pending ? pending : children}
    </button>
  );
}

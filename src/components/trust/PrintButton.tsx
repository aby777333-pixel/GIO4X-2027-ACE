"use client";

/** Opens the browser's print dialogue. The print stylesheet removes navigation and chrome. */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-ghost btn-sm no-print !h-[2.75rem] md:!h-[2.125rem]" onClick={() => window.print()}>
      {label}
    </button>
  );
}

"use client";

/** Prints the page. On paper, or saved as a PDF from the browser's own print dialogue. */
export function PrintButton({ children = "Print, or save as PDF", className = "btn btn-primary" }: { children?: string; className?: string }) {
  return (
    <button type="button" className={`no-print ${className}`} onClick={() => window.print()}>
      {children}
    </button>
  );
}

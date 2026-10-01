"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Rosette } from "@/components/brand/Rosette";

/**
 * Route-level error boundary. Calm, specific about what the visitor can do,
 * and silent about internals: no stack trace, message or path is rendered.
 * The digest is an opaque reference that support can match to server logs.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // surfaced to the hosting platform's log drain; never shown to the visitor
    console.error(error);
  }, [error]);

  return (
    <section className="wrap grid min-h-[70svh] items-center py-55">
      <div className="max-w-measure">
        <Rosette size={55} blades={6} className="text-ink-3" />
        <p className="eyebrow mt-21">Something went wrong</p>
        <h1 className="h1 mt-21">Something failed to execute.</h1>
        <p className="lead mt-21">This page could not be completed. Nothing you entered has been lost to a third party, and the rest of GIO4X is unaffected.</p>
        <div className="mt-34 flex flex-wrap gap-13">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="btn btn-ghost">
            Home
          </Link>
          <Link href="/status" className="btn btn-quiet">
            Status
          </Link>
          <Link href="/contact" className="btn btn-quiet">
            Contact support
          </Link>
        </div>
        {error.digest && <p className="num mt-34 text-xs text-ink-3">Reference: {error.digest}</p>}
      </div>
    </section>
  );
}

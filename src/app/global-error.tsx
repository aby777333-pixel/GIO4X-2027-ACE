"use client";

/**
 * Last-resort boundary for failures in the root layout itself. It cannot rely
 * on the design system being loaded, so it carries its own minimal styling.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", background: "#f6f4ee", color: "#14191d" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
          <div style={{ maxWidth: "34rem" }}>
            <p style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "#626b73", fontWeight: 600 }}>GIO4X</p>
            <h1 style={{ fontWeight: 300, fontSize: "2.6rem", lineHeight: 1.08, letterSpacing: "-0.02em", margin: "1rem 0" }}>Something failed to execute.</h1>
            <p style={{ color: "#3f474e", lineHeight: 1.6 }}>The site could not load. Please try again in a moment.</p>
            <p style={{ marginTop: "2rem", display: "flex", gap: "0.8rem" }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{ height: 44, padding: "0 21px", border: 0, borderRadius: 3, background: "#14191d", color: "#f6f4ee", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 13, cursor: "pointer" }}
              >
                Try again
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" style={{ height: 44, display: "inline-flex", alignItems: "center", padding: "0 21px", border: "1px solid rgba(20,25,29,.24)", borderRadius: 3, color: "#14191d", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 13, textDecoration: "none" }}>
                Home
              </a>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}

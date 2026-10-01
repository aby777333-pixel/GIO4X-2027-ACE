import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * GIO4X Control: the internal console. Not linked from the public site, never
 * indexed (robots metadata here, X-Robots-Tag and Cache-Control: private,
 * no-store from next.config.mjs), and never statically rendered.
 *
 * None of that is the protection. Access is decided on the server for every
 * request (src/lib/server/staff.ts) and enforced again by row-level security.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function ControlLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

import type { ReactNode } from "react";
import { SiteShell } from "@/components/shell/SiteShell";

/** Every public page lives in this group and shares the site chrome. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}

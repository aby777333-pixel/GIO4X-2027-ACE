import type { ReactNode } from "react";
import { JsonLd } from "@/components/seo/JsonLd";
import { CommandBar } from "@/components/shell/CommandBar";
import { Lens } from "@/components/shell/Lens";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { organizationSchema, websiteSchema } from "@/lib/schema";

/**
 * The public site chrome: header, main landmark, footer, command bar, Lens and
 * the organisation structured data. Used by the (site) route group and by the
 * root 404. GIO4X Control has its own shell and never renders this.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="pt-[var(--header-h)] focus:outline-none">
        {children}
      </main>
      <SiteFooter />
      <CommandBar />
      <Lens />
      <JsonLd data={[organizationSchema(), websiteSchema()]} />
    </>
  );
}

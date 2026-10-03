import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { loadTechModules } from "@/lib/tech-hub-console";
import { TechShell } from "@/components/tech/TechShell";

export const metadata = { title: "Technology Hub · GIO4X" };

// Technology Hub — a SEPARATE Super-Admin console (its own layout + shell), gated
// strictly by profiles.is_super_admin. Staff/admins without the super-admin flag
// are bounced out.
export default async function TechLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?redirect=/tech");
  const isSuper = Boolean((user.profile as { is_super_admin?: boolean } | null)?.is_super_admin);
  if (!isSuper) redirect("/");

  const modules = await loadTechModules();
  return (
    <TechShell email={user.email ?? "super-admin"} modules={modules}>
      {children}
    </TechShell>
  );
}

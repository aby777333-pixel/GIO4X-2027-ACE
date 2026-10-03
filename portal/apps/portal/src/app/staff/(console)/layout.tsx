import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/session";
import { StaffShell } from "@/components/staff/StaffShell";
import { canAccessSection, sectionForPath } from "@/lib/staff-sections";

export const metadata = {
  title: "GIO4X Service Console",
};

// Role gate + per-section access control for the whole /staff console. The staff
// portal has its own login at /staff/login (shared-credential → backing staff
// Supabase session), so any request here without a staff/admin session is
// bounced there. Master admins (role=admin) see everything; staff see only the
// sections granted to them (profiles.staff_sections). This layout does NOT wrap
// /staff/login (which lives outside this (console) route group).
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/staff/login");

  const role = user.profile?.role;
  if (role !== "staff" && role !== "admin") redirect("/staff/login");

  const staffSections =
    (user.profile as { staff_sections?: string[] | null } | null)?.staff_sections ?? null;

  // Hard URL enforcement: block direct navigation to a section the user isn't
  // granted (pathname is injected as a request header by the middleware).
  const pathname = headers().get("x-pathname") ?? "/staff";
  const section = sectionForPath(pathname);
  if (section && !canAccessSection(section.key, role, staffSections)) {
    redirect("/staff");
  }

  const name = user.profile?.full_name?.trim() || user.email?.split("@")[0] || "Agent";

  return (
    <StaffShell name={name} role={role} sections={staffSections}>
      {children}
    </StaffShell>
  );
}

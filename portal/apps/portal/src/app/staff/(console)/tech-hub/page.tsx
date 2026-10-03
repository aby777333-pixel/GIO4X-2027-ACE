import { redirect } from "next/navigation";

// The Technology Hub is its own super-admin console at /tech, not part of the staff
// module. Keep this path as a redirect so old links don't break.
export default function StaffTechHubRedirect() {
  redirect("/tech");
}

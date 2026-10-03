import { redirect } from "next/navigation";

// The Dealer Desk now lives inside the Technology Hub (super-admin), not the staff
// console. Keep this path as a redirect so old links don't break.
export default function StaffDealerRedirect() {
  redirect("/tech/dealer");
}

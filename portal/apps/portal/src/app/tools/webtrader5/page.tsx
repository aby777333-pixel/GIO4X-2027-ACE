import { redirect } from "next/navigation";
import { LINKS } from "@/lib/constants";

// MT5 was retired — GIO Raptor is the only execution platform.
// Existing bookmarks land on the Raptor terminal instead of 404-ing.
export default function Page() {
  redirect(LINKS.raptor.terminal);
}

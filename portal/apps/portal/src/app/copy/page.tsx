import { redirect } from "next/navigation";

// /copy is the Copy Trading hub entry point. The real surfaces live under
// /copy/discover, /copy/copier and /copy/signal-provider (all linked from the
// sidebar). Send the bare /copy route to Discover so it lands on a working
// page instead of a placeholder scaffold.
export default function Page() {
  redirect("/copy/discover");
}

import { readWall } from "@/app/control/(console)/wall/data";
import { NoAccess } from "@/components/control/bits";
import { controlMeta } from "@/components/control/format";
import { WallView } from "@/components/control/views/WallView";
import { can, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Wallboard", "/control/wall");

/**
 * The Command Centre's figures as a board for a television: large type, dark,
 * counts only. The page reads once, as the signed-in member of staff; the view
 * then keeps itself current from /control/wall/feed, which reads the same way.
 */
export default async function WallPage() {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "command.read")) return <NoAccess title="Wallboard" />;

  return <WallView initial={await readWall(ctx)} />;
}

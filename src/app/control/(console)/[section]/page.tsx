import Link from "next/link";
import { notFound } from "next/navigation";
import { ControlHead } from "@/components/control/bits";
import { controlMeta } from "@/components/control/format";
import { PENDING_SECTIONS, PORTAL_CONSOLE_SECTIONS } from "@/components/control/sections";
import { portalStaffUrl } from "@/config/destinations";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Not built yet", "/control");

/**
 * A Service Console section that has no screens here yet. It reads nothing
 * from the database and shows no figures: only what the section will do and
 * what it is waiting for. Built sections have their own folders, which take
 * precedence over this one.
 */
export default async function PendingSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;

  const { section } = await params;
  const info = Object.prototype.hasOwnProperty.call(PENDING_SECTIONS, section) ? PENDING_SECTIONS[section] : undefined;
  if (!info) notFound();
  const portalUrl = PORTAL_CONSOLE_SECTIONS.has(section) ? portalStaffUrl(section) : null;

  return (
    <>
      <ControlHead
        title={info.label}
        lead={
          portalUrl
            ? "This section is not built in GIO4X Control yet. It is worked in the client portal's staff console, which opens from here."
            : "This section is not built yet. Nothing below is live data."
        }
      />
      {portalUrl && (
        <div className="gxc-card mt-21 max-w-[46rem]">
          <div className="gxc-card-head">
            <h2 className="gxc-card-title">In the client portal</h2>
            <span className="state state-open">Connected</span>
          </div>
          <div className="gxc-card-body">
            <p className="text-sm text-ink-2">
              {info.label} for portal clients is in the portal&rsquo;s staff console. It is a separate system: it asks for its own staff sign-in, keeps its own records, and what is done there is not written to this console&rsquo;s audit log.
            </p>
            {/* a plain link: the portal is another application behind /portal, not a route of this one */}
            <a href={portalUrl} target="_blank" rel="noopener" className="btn btn-primary btn-sm mt-21">
              Open {info.label} in the portal console
            </a>
          </div>
        </div>
      )}
      <div className="gxc-card mt-21 max-w-[46rem]">
        <div className="gxc-card-head">
          <h2 className="gxc-card-title">What it will do here</h2>
          <span className="state state-pre">Not built</span>
        </div>
        <div className="gxc-card-body">
          <p className="text-sm text-ink-2">{info.will}</p>
          <h2 className="gxc-card-title mt-21">What it is waiting for</h2>
          <p className="mt-5 text-sm text-ink-2">{info.needs}</p>
          <p className="mt-21 text-xs text-ink-3">
            {info.phase} in the back-office plan (<span className="num">docs/BACKOFFICE-PLAN.md</span>).
          </p>
          <Link href="/control" className="btn btn-ghost btn-sm mt-21">
            Back to the dashboard
          </Link>
        </div>
      </div>
    </>
  );
}

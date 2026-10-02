import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/control/actions";
import { Logo } from "@/components/brand/Logo";
import { ControlNav } from "@/components/control/Nav";
import type { NavSection } from "@/components/control/nav-items";
import { ROLE_LABEL } from "@/components/control/format";
import type { StaffRole } from "@/lib/supabase/types";

function Wordmark() {
  return (
    <Link href="/control" aria-label="GIO4X Control: overview" className="inline-flex items-center gap-13">
      <Logo height={21} href={null} />
      <span className="label border-l border-line-strong pl-13">Control</span>
    </Link>
  );
}

/**
 * The console frame: a left rail from `lg` up, a top bar with a scrolling
 * navigation row below it. Quiet by design; the work is in the centre.
 */
export function Shell({ name, role, sections, children }: { name: string; role: StaffRole; sections: NavSection[]; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[14.5625rem_minmax(0,1fr)]">
      {/* desktop rail */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper lg:flex">
        <div className="px-21 pb-21 pt-21">
          <Wordmark />
        </div>
        <ControlNav variant="rail" sections={sections} />
        <div className="border-t border-line p-21">
          <p className="label">Signed in</p>
          <p className="mt-5 break-words text-sm font-medium text-ink">{name}</p>
          <p className="mt-2 text-xs text-ink-3">{ROLE_LABEL[role]}</p>
          <form action={signOut} className="mt-13">
            <button type="submit" className="btn btn-ghost btn-sm w-full">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-header border-b border-line bg-paper lg:hidden">
        <div className="flex h-[3.4375rem] items-center justify-between gap-13 px-gutter">
          <Wordmark />
          <form action={signOut}>
            <button type="submit" className="btn btn-quiet -mr-13">
              Sign out
            </button>
          </form>
        </div>
        <ControlNav variant="bar" sections={sections} />
      </header>

      <div className="min-w-0">
        <div className="mx-auto w-full max-w-[75rem] px-gutter pb-89 pt-34 lg:pt-55">{children}</div>
      </div>
    </div>
  );
}

/** Centred single-column frame for the states outside the console (not authorised, not configured). */
export function Standalone({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-gutter py-55">
      <div className="w-full max-w-[30rem]">
        <div className="inline-flex items-center gap-13">
          <Logo height={26} href={null} />
          <span className="label border-l border-line-strong pl-13">Control</span>
        </div>
        <div className="mt-34">{children}</div>
      </div>
    </div>
  );
}

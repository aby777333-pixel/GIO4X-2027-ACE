import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/control/actions";
import { Logo } from "@/components/brand/Logo";
import { ROLE_LABEL } from "@/components/control/format";
import { Icon } from "@/components/control/icons";
import { LookBoot, LOOK_ROOT_PROPS } from "@/components/control/LookBoot";
import { LookSwitch } from "@/components/control/LookSwitch";
import { ControlMenu, ControlNav } from "@/components/control/Nav";
import type { NavEntry } from "@/components/control/nav-items";
import type { StaffRole } from "@/lib/supabase/types";

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join("") || "S"
  );
}

function Brand() {
  return (
    <Link href="/control" aria-label="GIO4X Service Console: dashboard" className="block">
      <span className="gxc-logo">
        <Logo height={30} href={null} />
      </span>
      <span className="gxc-console-label">Service Console</span>
    </Link>
  );
}

/**
 * The console frame, in the Service Console's own look: a navy sidebar with
 * the logo on a white card, who is signed in, the full menu with icons and
 * sign-out at the foot; the work on a pale slate ground to the right.
 * Below `lg` the sidebar becomes a navy top bar with a menu button.
 *
 * `data-theme="light"` keeps the public site's theme out of the console;
 * src/styles/console.css then replaces the site's ivory and graphite with the
 * console's own colours. Which colours is the console's look (light or dark,
 * and a palette): chosen in the sidebar's foot, remembered in this browser,
 * and put on this root by <LookBoot /> before anything is painted. The
 * default, light and Navy, is the Service Console's slate, navy and sky.
 */
export function Shell({ name, role, items, children }: { name: string; role: StaffRole; items: NavEntry[]; children: ReactNode }) {
  return (
    <div className="gx-console min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]" data-theme="light" {...LOOK_ROOT_PROPS}>
      <LookBoot />
      {/* desktop sidebar */}
      <aside className="gxc-side sticky top-0 hidden h-dvh flex-col lg:flex">
        <div className="px-21 pb-13 pt-21">
          <Brand />
        </div>
        <div className="px-21">
          <div className="gxc-user">
            <span className="gxc-avatar" aria-hidden>
              {initialsOf(name)}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-white">{name}</span>
              <span className="gxc-user-role block text-[0.6875rem] uppercase tracking-wide">{ROLE_LABEL[role]}</span>
            </span>
          </div>
        </div>
        <ControlNav items={items} />
        <div className="border-t border-white/10 px-13 py-13">
          <LookSwitch />
          <form action={signOut}>
            <button type="submit" className="gxc-nav-item gxc-signout w-full">
              <Icon name="signout" size={16} />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="gxc-top sticky top-0 z-header lg:hidden">
        <div className="flex h-[3.75rem] items-center justify-between gap-13 px-gutter">
          <Link href="/control" aria-label="GIO4X Service Console: dashboard" className="gxc-logo gxc-logo-sm">
            <Logo height={22} href={null} />
          </Link>
          <div className="flex items-center gap-5">
            <form action={signOut}>
              <button type="submit" className="gxc-top-button">
                Sign out
              </button>
            </form>
            <ControlMenu items={items} />
          </div>
        </div>
      </header>

      <div className="min-w-0">
        <div className="mx-auto w-full max-w-[80rem] px-gutter pb-89 pt-21 lg:px-34 lg:pt-34">{children}</div>
      </div>
    </div>
  );
}

/**
 * Centred single-column frame for the states outside the console (not
 * authorised, not configured). Like the sign-in page it wears the public
 * site's look by default (`data-gxc-door`), and the console's once a look
 * other than the default has been chosen in this browser.
 */
export function Standalone({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center bg-bg px-gutter py-55" data-gxc-door="" {...LOOK_ROOT_PROPS}>
      <LookBoot />
      <div className="w-full max-w-[30rem]">
        <div className="inline-flex items-center gap-13">
          <Logo height={26} href={null} className="gxc-door-logo" />
          <span className="label border-l border-line-strong pl-13">Control</span>
        </div>
        <div className="mt-34">{children}</div>
      </div>
      {/* out of the flow, in the foot's margin, so the notice stays where it was */}
      <div className="gxc-door-look">
        <LookSwitch variant="page" />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/app/control/actions";
import { navFor } from "@/components/control/nav-items";
import { Shell, Standalone } from "@/components/control/Shell";
import { getAccess, SIGN_IN_PATH } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

/**
 * The signed-in console. One of five things is rendered, decided on the server:
 *   no session            → redirect to sign-in
 *   not configured        → notice (Supabase environment variables missing)
 *   database unreadable   → notice (for example, migrations not applied)
 *   signed in, not staff  → "Not authorised", with sign-out
 *   staff                 → the console
 * Pages repeat the check themselves (requireStaff) and render nothing unless
 * the caller is staff, so no data is fetched for anyone else.
 */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const access = await getAccess();

  if (access.state === "anonymous") redirect(SIGN_IN_PATH);

  if (access.state === "unconfigured") {
    return (
      <Standalone>
        <h1 className="h3">Not configured</h1>
        <p className="mt-13 text-ink-2">
          GIO4X Control is not connected to a database in this environment. Set <code className="num text-sm">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="num text-sm">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, then redeploy.
        </p>
        <p className="mt-13 text-sm text-ink-3">The public website is not affected. Forms report that they are temporarily unavailable until this is set.</p>
      </Standalone>
    );
  }

  if (access.state === "unavailable") {
    return (
      <Standalone>
        <h1 className="h3">The database could not be read</h1>
        <p className="mt-13 text-ink-2">
          You are signed in, but the console could not read its tables. If this is a new project, the migrations in <code className="num text-sm">supabase/migrations</code> may not have been applied yet. Otherwise, try again in a
          moment.
        </p>
        <form action={signOut} className="mt-21">
          <button type="submit" className="btn btn-ghost">
            Sign out
          </button>
        </form>
      </Standalone>
    );
  }

  if (access.state === "forbidden") {
    return (
      <Standalone>
        <h1 className="h3">Not authorised</h1>
        <p className="mt-13 text-ink-2">
          {access.email ? (
            <>
              You are signed in as <span className="break-all font-medium text-ink">{access.email}</span>, but this account
            </>
          ) : (
            <>You are signed in, but this account</>
          )}{" "}
          has not been given access to GIO4X Control.
        </p>
        <p className="mt-13 text-sm text-ink-3">Access is granted by an administrator, and can be switched off by one. If you expected to have it, ask them to check the staff list, then sign in again.</p>
        <form action={signOut} className="mt-21">
          <button type="submit" className="btn btn-primary">
            Sign out
          </button>
        </form>
      </Standalone>
    );
  }

  return (
    <Shell name={access.displayName} role={access.role} items={navFor(access.caps)}>
      {children}
    </Shell>
  );
}

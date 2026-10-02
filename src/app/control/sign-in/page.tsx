import { redirect } from "next/navigation";
import { signIn } from "@/app/control/actions";
import { Logo } from "@/components/brand/Logo";
import { site } from "@/config/site";
import { Notice } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { LookBoot, LOOK_ROOT_PROPS } from "@/components/control/LookBoot";
import { LookSwitch } from "@/components/control/LookSwitch";
import { SubmitButton } from "@/components/control/SubmitButton";
import { getAccess } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Sign in", "/control/sign-in");

// Fixed messages keyed by a code. The refusal message is the same whether the
// address is unknown or the password is wrong.
const ERRORS: Record<string, { title: string; text: string }> = {
  invalid: { title: "Those details were not recognised", text: "Check the email address and password and try again." },
  throttled: { title: "Too many attempts", text: "Please wait a few minutes before trying again." },
  unavailable: { title: "Sign-in is not available just now", text: "Please try again shortly." },
};

const PRINCIPLES = [
  { title: "Decided on the server", text: "Every page and every action checks who is asking before anything is read or changed." },
  { title: "Enforced in the database", text: "Row-level security applies the same rules again, whatever the application does." },
  { title: "Written down", text: "Changes to an enquiry are recorded in an append-only log." },
];

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await getAccess();
  // already signed in (staff or not): the console layout decides what they see
  if (access.state === "staff" || access.state === "forbidden" || access.state === "unavailable") redirect("/control");

  const params = await searchParams;
  const error = ERRORS[firstParam(params.error)];
  const signedOut = firstParam(params.notice) === "signed-out";
  const configured = access.state !== "unconfigured";

  return (
    // A door to the console: it wears the public site's look by default, and the
    // console's own once a look other than the default has been chosen in this
    // browser (src/components/control/look.ts).
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)]" data-gxc-door="" {...LOOK_ROOT_PROPS}>
      <LookBoot />
      {/* the quiet side: what this door is */}
      <aside className="on-night grid-field gxc-door-aside hidden flex-col justify-between p-55 lg:flex">
        <p className="label">GIO4X Control</p>
        <div>
          <p className="h3 max-w-[14ch]">The working side of the house.</p>
          <ul className="mt-34 grid gap-21 border-t border-line pt-21">
            {PRINCIPLES.map((p) => (
              <li key={p.title} className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-21">
                <span className="text-sm font-medium text-ink">{p.title}</span>
                <span className="text-sm text-ink-2">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-ink-3">{site.tagline}</p>
      </aside>

      <div className="relative grid place-items-center px-gutter py-55">
        {/* out of the flow, in the foot's margin, so nothing else on the page moves for it */}
        <div className="gxc-door-look">
          <LookSwitch variant="page" />
        </div>
        <div className="w-full max-w-[26rem]">
          <div className="inline-flex items-center gap-13">
            <Logo height={26} href={null} className="gxc-door-logo" />
            <span className="label border-l border-line-strong pl-13">Control</span>
          </div>

          <h1 className="h3 mt-34">Sign in</h1>
          <p className="mt-8 text-sm text-ink-2">For GIO4X staff. Use the email address and password your administrator set up for you.</p>

          <div className="mt-21 grid gap-13">
            {signedOut && !error && <Notice title="You have signed out" tone="ok" />}
            {error && (
              <Notice title={error.title} tone="error">
                {error.text}
              </Notice>
            )}
            {!configured && (
              <Notice title="Not configured">
                GIO4X Control is not connected to a database in this environment, so nobody can sign in here yet. The public website is not affected.
              </Notice>
            )}
          </div>

          {configured && (
            <form action={signIn} className="mt-21 grid gap-21">
              <div className="field">
                <label htmlFor="control-email">Email address</label>
                <input id="control-email" name="email" type="email" className="input" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} required />
              </div>
              <div className="field">
                <label htmlFor="control-password">Password</label>
                <input id="control-password" name="password" type="password" className="input" autoComplete="current-password" maxLength={256} required />
              </div>
              <SubmitButton pending="Signing in…" className="btn btn-primary btn-lg w-full">
                Sign in
              </SubmitButton>
            </form>
          )}

          <p className="mt-34 border-t border-line pt-13 text-xs text-ink-3">
            Accounts are created by an administrator; there is no self-registration. If you cannot sign in, or have forgotten your password, ask the administrator who created your account. Activity in this console is logged.
          </p>
        </div>
      </div>
    </div>
  );
}

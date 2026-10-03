# Portal gateway

The Client, Trader and IB portals and the account-opening flow are one separate application: the
client/IB portal imported from the `GIO4X-JUNE-2026` repository on 3 October 2026. Its source is the
`portal/` folder of this repository. It is **not** part of the website's build: it has its own
`package.json`, its own Netlify site and its own database (Supabase project `GIO4X JUNE 2026`).

## How the portal is attached (same site, under `/portal`)

- The portal is built with `basePath: "/portal"` (`portal/apps/portal/next.config.mjs`), so everything it
  serves is under `/portal`, on its own Netlify address too.
- The website proxies `/portal` and `/portal/*` to the address in the server variable `PORTAL_ORIGIN`
  (`rewrites()` in `next.config.mjs`; the value is in `netlify.toml`). A visitor stays on the website's
  address from the first click to the last. Unset, or not https, means no proxy and the gateway pages return
  to "not connected yet".
- While it is connected, the four destinations resolve to paths on this site: Client Portal
  `/portal/auth/login`, Trader Portal `/portal/accounts`, IB Portal `/portal/ib`, account opening
  `/portal/auth/signup`. An explicit, allow-listed `CLIENT_PORTAL_URL` (and the others) still takes
  precedence, as described below.
- The portal sends its own security headers, including its own Content-Security-Policy (its pages talk to
  its own database). The website's policy is not applied to `/portal`. The offline worker never touches
  `/portal`, and `robots.txt` disallows it.
- The portal builds its e-mail links and its redirects on `NEXT_PUBLIC_SITE_URL` (in `portal/netlify.toml`):
  the website's origin, never the host of the incoming request, which behind the proxy is the portal's own
  Netlify address. `<that origin>/portal/auth/callback` must be listed in the portal's Supabase project under
  Auth → URL Configuration → Redirect URLs, or confirmation and password-reset links will be refused.
- Server Actions are accepted only from the origins listed in `allowedOrigins` in the portal's config; add a
  new public domain there (or in `PORTAL_ALLOWED_ORIGINS`) before moving the website to it.
- GIO4X Control: the sections it has not built (KYC, Funds & Settlement, Fee Engine, IB Network, Copy
  Trading, PAMM / MAM, Trade Log, Broker Controls, General Ledger, Event Bus, Document Builder, Bulk Emailer)
  are marked "Portal" in its menu and link to the same section of the portal's staff console at
  `/portal/staff/<section>`. That console is a different system: its own sign-in, its own records, none of
  Control's access rules or audit. See `docs/BACKOFFICE-PLAN.md` for what is known to be wrong with it.

Local development: `npm run dev` in `portal/` (port 3100, needs `portal/apps/portal/.env.local`), and
`PORTAL_ORIGIN=http://localhost:3100` in the website's `.env.local`.

Deploying the portal. Deploy it before the website when the base path changes, or `/portal` answers 404
in between. Two ways:

- **Netlify builds it** (preferred, not set up yet): link the portal's Netlify site to this repository with
  Base directory `portal` (`portal/netlify.toml`). Until that is done the site is still linked to
  `GIO4X-JUNE-2026`, and a push there would publish the old portal, without `/portal`, over this one.
- **From a Windows PC** (how it was published on 3 October 2026). The Netlify CLI mistakes the repository
  root for the project when `portal/` is nested in it, so build from a copy outside any repository:
  1. copy `portal/` (without `node_modules`, `.next`, `.netlify`) to an empty folder, `git init` there, and
     write `{ "siteId": "<portal site id>" }` to `.netlify/state.json`;
  2. `npm install`, then `netlify build --filter @gio4x/portal`;
  3. `node scripts/patch-netlify-handler-paths.mjs apps/portal` (Windows paths in the server handler);
  4. `netlify deploy --filter @gio4x/portal --no-build --skip-functions-cache --dir <copy>/apps/portal/.netlify/static`,
     check the draft address it prints under `/portal`, then repeat with `--prod`.
  The `--dir` matters: the default publish folder has the static files in the wrong place.

## How it works

- `src/config/destinations.ts` is the **Verified Destination Registry**. It holds four portal destinations
  (`client`, `trader`, `ib`, `openAccount`), the official first-party domains, the approved third parties and
  the official social profiles. Nothing else in the codebase contains an outbound destination for sign-in,
  registration or a platform.
- Each portal destination is either `{ status: "CONFIGURED", url }` or `{ status: "UNCONFIGURED", url: null }`.
  It is configured by the same-site connection above, or by its own **server environment variable**.
- An explicit value is honoured only if it parses as a URL, uses `https:`, carries no embedded credentials, and its
  host is `gio4x.com`, a subdomain of it, or a host listed in `NEXT_PUBLIC_OFFICIAL_PORTAL_HOSTS`. Anything else is
  treated as unconfigured. A destination is **never** taken from a query string, a form field, CMS content
  or user input, so there is no open-redirect surface.
- `/sign-in` renders "Welcome back · Choose your destination: Client Portal / Trader Portal / IB Portal".
  Unconfigured destinations are shown as non-links in a "not connected yet" state. There are no `#` links
  and no fabricated URLs.
- `/open-account` renders the calm account-opening moment. While unconfigured it offers a "register your
  interest" enquiry that is stored as a lead (topic "Account opening").
- `/trust/verify` checks any pasted link against the same registry and answers `Official GIO4X`,
  `Approved third-party destination` or `Not recognised`. It is a pure string comparison in the browser: it
  never fetches the link, so it cannot be used for server-side request forgery, and it never calls an unknown
  link malicious.

## Connecting a portal at its own address (instead of `/portal`)

Do not simply paste a link into a button. For each destination:

1. **Ownership and TLS.** Confirm the hostname is controlled by GIO4X, serves a valid certificate and
   redirects http → https. Prefer a `gio4x.com` subdomain (e.g. `portal.gio4x.com`) over a hosting-provider
   domain; a `*.netlify.app` or similar address should not be given to clients as a login destination.
2. **Add the host** to `NEXT_PUBLIC_OFFICIAL_PORTAL_HOSTS` if it is not under `gio4x.com`.
3. **Set the variable** (`CLIENT_PORTAL_URL`, `TRADER_PORTAL_URL`, `IB_PORTAL_URL`, `ACCOUNT_OPENING_URL`) in
   the hosting environment for production only. Redeploy.
4. **Review the handoff**: session model, logout, return path, deep links, cookies (`Secure`, `HttpOnly`,
   `SameSite`), CORS, security headers on the portal, password-reset flow, mobile behaviour, error pages.
   No credentials, tokens or personal data may ever be passed in a URL.
5. **Check phishing implications**: the destination now appears as official on `/trust/verify`; make sure
   client emails use exactly the same hostname.
6. **Smoke test** `/sign-in` and `/open-account` in production, then record the change (who, when, which
   host) in the release notes. A change to a portal destination should be approved by a second person.

Rollback is removing the variable and redeploying: the gateway returns to its unconfigured state.

## What was found in the previous code

| Purpose | Old destination | Why it is not linked |
|---|---|---|
| Client portal | `https://zippy-piroshki-21aa30.netlify.app` (`/auth/login`, `/auth/signup?plan=…`, `/ib`) | Now the origin behind `/portal`. It is never shown to a visitor or linked to directly |
| Web terminal | `https://dashing-hamster-0028ed.netlify.app/terminal` | Same |
| Older site | `https://client.icareforex.com/…` (with referral parameters) and `https://my.finitic.com/login` | Legacy brand domains |

## Future architecture (not built)

Single sign-on, OAuth/OIDC, context hand-off, portal health status and portal return paths are left as
adapter points behind `destinations.ts`. Portal status must come from a genuine status API; it is never
fabricated (`/status` shows "Not monitored" today).

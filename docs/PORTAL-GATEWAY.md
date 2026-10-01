# Portal gateway

The Client, Trader and IB portals and the account-opening flow are separate systems that already exist.
This website builds the **doorways** and deliberately does not connect them yet.

## How it works

- `src/config/destinations.ts` is the **Verified Destination Registry**. It holds four portal destinations
  (`client`, `trader`, `ib`, `openAccount`), the official first-party domains, the approved third parties and
  the official social profiles. Nothing else in the codebase contains an outbound destination for sign-in,
  registration or a platform.
- Each portal destination is read from a **server environment variable** and is either
  `{ status: "CONFIGURED", url }` or `{ status: "UNCONFIGURED", url: null }`.
- A value is honoured only if it parses as a URL, uses `https:`, carries no embedded credentials, and its
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

## Connecting a portal (when the URLs arrive)

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

## What was found in the previous code (for reference only: not used)

| Purpose | Old destination | Why it is not linked |
|---|---|---|
| Client portal | `https://zippy-piroshki-21aa30.netlify.app` (`/auth/login`, `/auth/signup?plan=…`, `/ib`) | Hosting-provider preview domain, not an official host |
| Web terminal | `https://dashing-hamster-0028ed.netlify.app/terminal` | Same |
| Older site | `https://client.icareforex.com/…` (with referral parameters) and `https://my.finitic.com/login` | Legacy brand domains |

## Future architecture (not built)

Single sign-on, OAuth/OIDC, context hand-off, portal health status and portal return paths are left as
adapter points behind `destinations.ts`. Portal status must come from a genuine status API; it is never
fabricated (`/status` shows "Not monitored" today).

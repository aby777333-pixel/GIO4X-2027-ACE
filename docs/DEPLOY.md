# Build, deploy and rollback

## Environments

| Environment | Where | `NEXT_PUBLIC_SITE_ENV` | Indexable |
|---|---|---|---|
| Local | `npm run dev` | `development` | no |
| Preview | Netlify project `gio4x-2027-ace` (`https://gio4x-2027-ace.netlify.app`) | `preview` | no: `noindex` on every page and `Disallow: /` |
| Production | the Netlify site that will serve `www.gio4x.com` | `production` | yes |

Only the value `production` makes the site indexable. It is set per site in the Netlify UI, never in
`netlify.toml`, so a preview can not be indexed by accident. The previous marketing site
(`lustrous-youtiao-52c8ea`) and the terminal site are separate Netlify projects and are not touched by
this repository. The portal site (`zippy-piroshki-21aa30`) is separate too, but its source is now the
`portal/` folder here and this site proxies `/portal` to it: see `PORTAL-GATEWAY.md`.

## Build

```bash
npm ci
npm run typecheck
npm run lint
npm run build      # ~550 static pages
npm start          # serve the production build locally on :3000
npm run audit:links -- http://localhost:3000 --external
```

The build needs network access to two hosts: Google Fonts (Inter, fetched by `next/font` at build time) and
`api.frankfurter.dev` (ECB reference fixings). If the rates provider is unreachable the build still
succeeds and the affected modules render their "unavailable" state until the next hourly revalidation.

## Deploy (Netlify)

`netlify.toml` builds with `npm run build` and the official `@netlify/plugin-nextjs` runtime. Security
headers and redirects come from `next.config.mjs`, so they are identical on every host.

Environment variables to set on the site (Site configuration → Environment variables):

| Variable | Preview | Production |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | the preview URL | `https://www.gio4x.com` |
| `NEXT_PUBLIC_SITE_ENV` | `preview` | `production` |
| `NEXT_PUBLIC_SUPABASE_URL` | project URL | project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key | publishable key |
| `PRIVACY_POLICY_VERSION` | optional | the published policy version |
| `PORTAL_ORIGIN` | in `netlify.toml` | in `netlify.toml` |
| other portal variables | leave empty | only after the checklist in `PORTAL-GATEWAY.md` |

Going to production:

1. Resolve the blocking items in `WAITING-FOR-ABE.md` section A (entity, regulatory statement, legal review).
2. Connect the Git repository to the production Netlify site (or deploy from CI), set the variables above.
3. Point `www.gio4x.com` at the site; enable HTTPS; redirect the apex to `www`.
4. In Supabase Auth: disable public sign-ups, enable leaked-password protection, add the production URL to
   the allowed redirect URLs, create the first administrator (`docs/CONTROL.md`).
5. Deploy, then run the post-deploy checks below.
6. Submit `https://www.gio4x.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

### How the preview site is published today

`gio4x-2027-ace` is not linked to the Git repository: a push does not deploy it. It is published from a PC
with the Netlify CLI, from the repository root, with `NETLIFY_SITE_ID` set to the site's id:

1. `netlify build`
2. `netlify deploy --no-build --dir <repository>/.netlify/static`, check the draft address it prints, then
   repeat with `--prod`.

The portal is published separately: see `PORTAL-GATEWAY.md`.

## Post-deploy smoke test

```bash
npm run audit:links -- https://<host>          # every page 200, one h1, title, description, canonical
curl -sI https://<host>/ | grep -iE "content-security-policy|strict-transport|x-frame|referrer-policy"
curl -s  https://<host>/robots.txt             # production: Allow + Sitemap; preview: Disallow: /
curl -s  https://<host>/sitemap.xml | head
curl -sI https://<host>/accounts               # 308 → /trading/accounts (legacy redirect)
curl -sI https://<host>/control                # 307 → /control/sign-in
```

Then by hand: homepage hero and session strip, command bar (Ctrl/Cmd+K), an instrument page and its chart,
a calculator, `/sign-in` (three destinations, none linked until configured), `/open-account`, the contact
form (one real submission, then find it in `/control`), `/trust/verify`, the 404, light and dark themes, a
phone.

## Rollback

Netlify keeps every deploy. To roll back, open Deploys, choose the last good deploy and "Publish deploy";
no rebuild is needed. Database migrations in this release are additive (new tables only); rolling the site
back does not require rolling the database back. Portal destinations roll back by clearing their variables.

## Database migrations

SQL lives in `supabase/migrations` and is applied in order (`0001_init`, `0002_security`, `0003_triggers`).
All three are applied to project `wcdhqykhvnlxozayeolt`. New migrations: add a numbered file, apply it with
the Supabase CLI or dashboard, then run the security advisor. Never change the schema by hand in production.

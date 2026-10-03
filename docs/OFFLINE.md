# Offline copy and installable app

The public site can be installed as an app and keeps a small offline copy of itself: the Trader Toolkit
and the pages a visitor has opened. One hand-written service worker does this. There is no library and no
build step.

| What | Where |
|---|---|
| The worker | `public/sw.js` (served at `/sw.js`, scope `/`) |
| Kill switch | `public/sw-off.txt` (normally `0`) |
| Registration, update notice | `src/components/shell/OfflineRegister.tsx`, mounted in `SiteShell.tsx` |
| Page-side helpers | `src/components/desk/offline.ts` |
| Preference (`offline` in `gx:prefs`) and cache clearing | `src/lib/prefs.ts` (`clearOfflineCopy`, `OFFLINE_CACHE_PREFIX`) |
| The control on `/preferences` | `src/components/desk/OfflineCopy.tsx` |
| "Install GIO4X" | `src/components/desk/install.ts`, `InstallApp.tsx` (on `/desk` and `/preferences`) |
| The page shown offline | `src/app/(site)/offline/page.tsx`, `src/components/desk/OfflineList.tsx` |
| Manifest and icons | `src/app/manifest.ts`, `scripts/make-icons.mjs` |
| Cache headers for the two public files | `netlify.toml` |
| What visitors are told | `/legal/cookies` ("Offline copy"), `/preferences`, `/trust/security` |

## What the worker does

- **Page navigations: network first.** An online visitor always gets the live page. A copy is stored after a
  successful response and is used only when the network request fails. With no copy, the visitor is
  redirected to `/offline#<the path asked for>`.
- **Static files** (`/_next/static/**`, `/brand/**`, the icons): stale-while-revalidate.
- **Installed set.** On install it fetches `/tools`, `/offline`, `/desk` and every `/tools/<slug>` linked from
  `/tools`, plus the static files and fonts those pages name. The set is renewed about once a day, on a
  navigation made with a connection. If `/tools` or `/offline` cannot be fetched the install fails and the
  browser tries again on a later visit.

## What it never does

- It never intercepts `/control/**`, `/api/**`, `/portal/**` (the client portal), a request that is not `GET`, a request to another origin, a
  range request, or anything that is not a page navigation or one of the static files above (so
  server-component payloads, JSON, feeds, sitemaps and `/sw-off.txt` always go to the network).
- It never stores a response that is not `200` from this origin, was redirected, or is marked `no-store` or
  `private`; a page address with a query string; or `/status` and `/support`.
- It sends nothing anywhere. It holds no identifier.

## Caches

`gx-keep-v<N>` (installed set), `gx-pages-v<N>` (opened pages, 50 at most), `gx-static-v<N>` (static files,
400 at most). `N` is `VERSION` in `sw.js`. Activation deletes every `gx-` cache that is not of the current
version. **Bump `VERSION` whenever the caching rules change.**

## Updating

A changed `sw.js` installs beside the running worker and waits. `OfflineRegister` shows "A newer version of
this site is ready" with **Reload** and **Later**. Only **Reload** sends `gx-sw:skip-waiting`; the page then
reloads once the new worker is in charge. There is no automatic `skipWaiting`, so a page is never swapped
while it is in use. A deploy that does not change `sw.js` shows no notice: pages are network first, so
visitors get the new deploy anyway.

## Kill switch

Change `public/sw-off.txt` from `0` to `1` and deploy. Then:

- the worker, on the next page navigation (it reads the file at most every ten minutes), unregisters itself
  and deletes its caches;
- `OfflineRegister`, on every full page load, reads the file before registering; on `1` it unregisters the
  worker, deletes the caches and registers nothing.

Set it back to `0` to allow the worker again. Both files are served with revalidating cache headers
(`netlify.toml`), so the change is seen on the next load.

## Visitor controls

- `/preferences`, "Offline copy and app": **Remove the offline copy** unregisters the worker, deletes the
  caches and sets `offline: false` in `gx:prefs`, so it is not started again. **Keep an offline copy** turns
  it back on.
- "Clear everything stored by GIO4X on this device" also empties the caches (`resetLocal`).
- Clearing site data in the browser removes everything.

## Development and testing

The worker is registered only when `process.env.NODE_ENV === "production"`. Nothing is registered under
`next dev`.

To exercise it against the dev server, register it by hand as `/sw.js?test=1`. On `localhost` only, that flag
makes the worker keep `no-store` responses (the dev server marks everything `no-store`) and read the kill
switch on every navigation. `.tmp/desk/sw-test.cjs` does this with puppeteer and checks: `/control` and
`/api` bypass, non-GET bypass, live page when online, a tool and an opened page when offline, the `/offline`
fallback, the waiting update, the preferences control and the kill switch. It unregisters the worker and
deletes the caches when it finishes. Note that puppeteer's offline mode must be applied to the worker's own
target as well as to the page.

## Icons

`node scripts/make-icons.mjs` writes `public/icon-maskable-192.png` and `-512.png` from
`public/brand/gio4x-mark.png` (the mark at 60% on the ivory ground, inside the maskable safe zone), using the
`sharp` that Next.js already installs.

## Off until chosen

The offline copy is opt-in: `offline` in `gx:prefs` defaults to `false`, so the worker is registered only for a
visitor who presses "Keep an offline copy" on `/preferences` (or My desk). It was made opt-in on 3 October 2026
because the worker had been exercised only against the development server. Once it has been checked on the
published site (open a tool page, go offline in the browser's developer tools, reload), the default may be
reconsidered.

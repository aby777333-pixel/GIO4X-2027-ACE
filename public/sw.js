/*
 * GIO4X offline worker. Hand-written, no library. Documented in docs/OFFLINE.md.
 *
 * What it does
 *   - Page navigations: network first. An online visitor always receives the
 *     live page; a copy is kept, and the copy is used only when the network
 *     request fails. If there is no copy, the visitor is sent to /offline.
 *   - This site's own static files (/_next/static/**, /brand/**, the icons):
 *     stale-while-revalidate.
 *   - On install it keeps /offline, /tools, every /tools/<slug> page linked
 *     from /tools, /desk, and the static files those pages name, so the
 *     calculators open without a connection. That set is renewed once a day.
 *
 * What it never touches (the request goes to the network as if no worker existed)
 *   - /control/** and /api/**
 *   - any request that is not GET
 *   - any request to another origin (the database, TradingView)
 *   - everything else that is not a page navigation or a static file above:
 *     server-component payloads, JSON, feeds, sitemaps, /sw-off.txt
 * What it never keeps
 *   - a response that is not 200 OK from this origin, was redirected, or is
 *     marked no-store or private
 *   - a page address with a query string
 *   - /status and /support, whose whole point is to be current
 *
 * Updating
 *   A new version installs beside the old one and waits. It takes over only
 *   when the visitor accepts the "newer version" notice (the page then sends
 *   "gx-sw:skip-waiting"), so a page is never swapped while it is in use.
 *   Bump VERSION when the caching rules change: activation deletes every
 *   cache of an older version.
 *
 * Kill switch
 *   /sw-off.txt normally contains 0. If it ever returns 1, this worker
 *   unregisters itself and deletes its caches the next time a page is opened
 *   (checked at most every ten minutes), and the page-side component
 *   (src/components/shell/OfflineRegister.tsx) does the same on load.
 *
 * Testing
 *   Registered as /sw.js?test=1 on localhost only, the worker also keeps
 *   responses marked no-store, because the development server marks every
 *   response that way, and reads the kill switch on every navigation. The
 *   site itself never registers it with that flag.
 */
"use strict";

const VERSION = "1";
const PREFIX = "gx-";
const KEEP = PREFIX + "keep-v" + VERSION; // installed set: /offline, /tools, the tools, /desk
const PAGES = PREFIX + "pages-v" + VERSION; // pages the visitor has opened
const STATIC = PREFIX + "static-v" + VERSION; // this site's own static files
const CURRENT = [KEEP, PAGES, STATIC];

const MAX_PAGES = 50;
const MAX_STATIC = 400;
const MAX_TOOLS = 40;
const MAX_ASSETS = 300;
const REFRESH_AFTER = 24 * 60 * 60 * 1000;
/** how long the install, and a later completion or renewal, may spend fetching the installed set */
const INSTALL_TIME = 60 * 1000;
const UPKEEP_TIME = 4 * 60 * 1000;
const KILL_URL = "/sw-off.txt";
/** not a page: a small record in KEEP of when the installed set was last fetched */
const STAMP = "/__gx-offline/stamp";
const NO_COPY = ["/status", "/support"];

const LOCAL = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";
const TEST = LOCAL && new URL(self.location.href).searchParams.get("test") === "1";
/** how often the kill switch is read; under test, on every navigation */
const KILL_EVERY = TEST ? 0 : 10 * 60 * 1000;

const isPrivate = (p) => p === "/control" || p.startsWith("/control/") || p === "/api" || p.startsWith("/api/");
const isStatic = (p) => p.startsWith("/_next/static/") || p.startsWith("/brand/") || p === "/favicon.ico" || p === "/apple-touch-icon.png" || /^\/icon-[a-z0-9-]+\.png$/.test(p);
const noCopy = (p) => NO_COPY.some((x) => p === x || p.startsWith(x + "/"));

function keepable(res) {
  if (!res || !res.ok || res.status !== 200 || res.type !== "basic" || res.redirected) return false;
  const cc = res.headers.get("cache-control") || "";
  if (/(^|,)\s*private/i.test(cc)) return false;
  return TEST || !/(^|,)\s*no-store/i.test(cc);
}
const isHtml = (res) => (res.headers.get("content-type") || "").includes("text/html");

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  // keys come back oldest first; putting an entry again moves it to the end
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function deleteCaches(keep) {
  const names = await caches.keys();
  await Promise.all(names.filter((n) => n.startsWith(PREFIX) && !keep.includes(n)).map((n) => caches.delete(n)));
}

/* ---- the installed set -------------------------------------------------------- */

/** Static files a page names: in its tags, and in the component payload Next.js embeds in it. */
function collect(html, into) {
  for (const m of html.matchAll(/\/_next\/static\/[^"'\\\s<>]+/g)) into.add(m[0]);
  for (const m of html.matchAll(/["'\\]static\/(?:chunks|css|media)\/[^"'\\\s<>]+/g)) into.add("/_next/" + m[0].slice(1));
}

/** Let go of a response that will not be read, so its connection is free for the next request. */
function drop(res) {
  try {
    if (res && res.body) res.body.cancel().catch(() => undefined);
  } catch (e) {
    // already read or locked: nothing to release
  }
}

/** A whole file name: the page's markup is streamed in pieces, and a piece can end in the middle of an address. */
const WHOLE_FILE = /.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|ico|json|txt|map)$/i;

/**
 * Fetch the installed set, for at most `allowed` milliseconds.
 *
 * A browser abandons an install that runs for minutes, and a slow connection
 * must not mean starting again on every visit. So the run stops when its time
 * is up, keeps what it has, and writes the stamp only when it finished. A run
 * that did not finish is completed by the next upkeep, which reuses the pages
 * already kept (`renew` false). The daily renewal fetches every page again
 * (`renew` true). Static files already kept are never fetched twice here.
 */
async function precache(allowed, renew) {
  const until = Date.now() + allowed;
  const inTime = () => Date.now() < until;
  const keep = await caches.open(KEEP);
  const store = await caches.open(STATIC);
  const assets = new Set();
  let complete = true;

  const take = async (path, required) => {
    if (!renew) {
      const had = await keep.match(path, { ignoreVary: true });
      if (had) {
        const kept = await had.text();
        collect(kept, assets);
        return kept;
      }
    }
    if (!required && !inTime()) {
      complete = false;
      return "";
    }
    let res = null;
    try {
      res = await fetch(path, { credentials: "same-origin" });
    } catch (e) {
      res = null;
      complete = false;
    }
    if (!keepable(res) || !isHtml(res)) {
      drop(res);
      if (required) throw new Error("offline set: " + path + " could not be fetched");
      return "";
    }
    const text = await res.clone().text();
    await keep.put(path, res);
    collect(text, assets);
    return text;
  };

  // without these two there is no offline copy worth having: fail, and the browser tries the install again later
  const hub = await take("/tools", true);
  await take("/offline", true);

  const pages = ["/desk"];
  for (const m of hub.matchAll(/href="\/tools\/([a-z0-9][a-z0-9-]{0,79})"/g)) {
    const path = "/tools/" + m[1];
    if (!pages.includes(path) && pages.length <= MAX_TOOLS) pages.push(path);
  }
  for (let i = 0; i < pages.length; i += 4) await Promise.all(pages.slice(i, i + 4).map((p) => take(p, false)));

  const sheets = [];
  const takeStatic = async (url) => {
    try {
      let res = await store.match(url, { ignoreVary: true });
      if (!res) {
        if (!inTime()) {
          complete = false;
          return;
        }
        res = await fetch(url, { credentials: "same-origin" });
        if (!keepable(res)) {
          // An answer that is not kept must still be let go of: an unread body holds
          // its connection, and six of them are every connection the browser has.
          drop(res);
          return;
        }
        // Never clone here. A cloned response whose other half is left unread stalls
        // on a large file (the browser stops the download until both halves are
        // drained), and the install then never finishes. A stylesheet is read once
        // and stored from its text; anything else goes into the cache as it is.
        if ((res.headers.get("content-type") || "").includes("text/css")) {
          const css = await res.text();
          sheets.push(css);
          await store.put(url, new Response(css, { status: 200, headers: res.headers }));
        } else {
          await store.put(url, res);
        }
        return;
      }
      if ((res.headers.get("content-type") || "").includes("text/css")) sheets.push(await res.text());
    } catch (e) {
      // one file missing does not stop the rest; the run is finished later
      complete = false;
    }
  };
  const inBatches = async (urls) => {
    for (let i = 0; i < urls.length; i += 6) await Promise.all(urls.slice(i, i + 6).map(takeStatic));
  };
  await inBatches([...assets].filter((u) => isStatic(u.split("?")[0]) && WHOLE_FILE.test(u.split("?")[0])).slice(0, MAX_ASSETS));

  // the fonts are named by the stylesheets, not by the page
  const fonts = new Set();
  for (const css of sheets) for (const m of css.matchAll(/url\(\s*["']?(\/_next\/static\/media\/[^"')\s]+)/g)) fonts.add(m[1]);
  await inBatches([...fonts].slice(0, 40));

  if (complete) await keep.put(STAMP, new Response(String(Date.now()), { headers: { "content-type": "text/plain" } }));
  await trim(STATIC, MAX_STATIC);
}

let refreshing = false;
async function refreshIfStale() {
  if (refreshing) return;
  refreshing = true;
  try {
    const keep = await caches.open(KEEP);
    const stamp = await keep.match(STAMP);
    const at = stamp ? Number(await stamp.text()) : 0;
    // no stamp: an earlier run did not finish, so complete it; an old stamp: renew every page
    if (!stamp || !Number.isFinite(at)) await precache(UPKEEP_TIME, false);
    else if (Date.now() - at > REFRESH_AFTER) await precache(UPKEEP_TIME, true);
  } catch (e) {
    /* tried again on a later page load */
  } finally {
    refreshing = false;
  }
}

/* ---- kill switch ---------------------------------------------------------------- */

let lastKillCheck = 0;
async function killed() {
  try {
    const res = await fetch(KILL_URL, { cache: "no-store", credentials: "same-origin" });
    return res.ok && (await res.text()).trim() === "1";
  } catch (e) {
    return false;
  }
}

/** set once the kill switch has been seen: from then on this worker answers nothing and keeps nothing */
let retired = false;

/** Read the kill switch when it is due. False once the worker has been told to stop. */
async function stillWanted() {
  if (retired) return false;
  const now = Date.now();
  if (now - lastKillCheck >= KILL_EVERY) {
    lastKillCheck = now;
    if (await killed()) {
      retired = true;
      await self.registration.unregister();
      await deleteCaches([]);
      return false;
    }
  }
  return true;
}

async function upkeep() {
  if (await stillWanted()) await refreshIfStale();
}

/* ---- lifecycle ------------------------------------------------------------------ */

// no skipWaiting here: a new version waits until the visitor accepts it
self.addEventListener("install", (event) => {
  event.waitUntil(precache(INSTALL_TIME, true));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(deleteCaches(CURRENT).then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "gx-sw:skip-waiting") self.skipWaiting();
  // sent by the page after each full load: most movement between pages is not a navigation the worker sees
  else if (data.type === "gx-sw:upkeep") event.waitUntil(upkeep().catch(() => undefined));
});

/* ---- requests --------------------------------------------------------------------- */

async function page(event, url) {
  const path = url.pathname;
  try {
    const res = await fetch(event.request);
    const copy = !url.search && !noCopy(path) && keepable(res) && isHtml(res) ? res.clone() : null;
    event.waitUntil(
      (async () => {
        // the kill switch is read before anything is stored, so a retired worker leaves no cache behind
        if (!(await stillWanted())) return;
        if (copy) {
          const keep = await caches.open(KEEP);
          // a page of the installed set is renewed in place; anything else joins the opened pages
          if (await keep.match(path, { ignoreVary: true })) await keep.put(path, copy);
          else {
            await (await caches.open(PAGES)).put(path, copy);
            await trim(PAGES, MAX_PAGES);
          }
        }
        await refreshIfStale();
      })().catch(() => undefined),
    );
    return res;
  } catch (err) {
    // the network failed: this is the only case in which a copy is served
    for (const name of [PAGES, KEEP]) {
      const hit = await (await caches.open(name)).match(path, { ignoreVary: true });
      if (hit) return hit;
    }
    if (path !== "/offline" && (await (await caches.open(KEEP)).match("/offline", { ignoreVary: true }))) {
      // the path asked for travels in the fragment, which is never sent to a server; a query string is dropped
      return Response.redirect("/offline#" + path, 302);
    }
    throw err;
  }
}

async function asset(event) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(event.request, { ignoreVary: true });
  const fresh = fetch(event.request).then((res) => {
    if (!retired && keepable(res)) {
      const copy = res.clone();
      event.waitUntil(cache.put(event.request, copy).catch(() => undefined));
    }
    return res;
  });
  if (hit) {
    event.waitUntil(fresh.catch(() => undefined));
    return hit;
  }
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (retired) return;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isPrivate(url.pathname)) return;
  if (req.headers.has("range")) return;
  if (req.mode === "navigate") {
    event.respondWith(page(event, url));
    return;
  }
  if (isStatic(url.pathname)) event.respondWith(asset(event));
  // everything else is left to the browser
});

#!/usr/bin/env node
/**
 * GIO4X site audit: crawls a running instance and checks every internal page.
 *
 *   node scripts/audit-links.mjs [baseUrl] [--external] [--json=report.json]
 *
 * For each reachable internal URL it verifies:
 *   - the response status (200, or an intentional redirect)
 *   - exactly one <h1>
 *   - a <title>, a meta description and a canonical link
 *   - no links to placeholder destinations ("#", "javascript:", example domains)
 *   - every in-page anchor (#id) that is linked actually exists
 * With --external it also sends a HEAD/GET to each distinct external link.
 *
 * Exit code 1 if anything fails, so it can gate a deployment.
 */
const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3000").replace(/\/$/, "");
const checkExternal = args.includes("--external");
const jsonOut = args.find((a) => a.startsWith("--json="))?.slice(7);
const CONCURRENCY = 4;

const origin = new URL(base).origin;
const queue = ["/"];
const seen = new Map(); // path → result
const externals = new Map(); // url → Set(pages)
const anchors = []; // { page, target, hash }
const problems = [];

const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");

function normalise(href, from) {
  if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  if (/^(javascript:|data:)/i.test(href)) return { bad: href };
  let u;
  try {
    u = new URL(href, origin + from);
  } catch {
    return { bad: href };
  }
  if (u.origin !== origin) return { external: u.href };
  return { path: u.pathname.replace(/\/$/, "") || "/", hash: u.hash.slice(1), search: u.search };
}

async function fetchPage(path) {
  const res = await fetch(origin + path, { redirect: "manual", headers: { "user-agent": "gio4x-audit" }, signal: AbortSignal.timeout(120_000) });
  const type = res.headers.get("content-type") ?? "";
  const body = type.includes("text/html") ? await res.text() : "";
  return { status: res.status, type, body, location: res.headers.get("location"), headers: res.headers };
}

async function visit(path) {
  let r;
  try {
    r = await fetchPage(path);
  } catch (e) {
    seen.set(path, { status: 0 });
    problems.push({ page: path, issue: `request failed: ${e.message}` });
    return;
  }
  seen.set(path, { status: r.status, ids: new Set() });
  if (r.status >= 300 && r.status < 400) {
    const to = normalise(r.location ?? "", path);
    if (to?.path && !seen.has(to.path) && !queue.includes(to.path)) queue.push(to.path);
    return;
  }
  if (r.status !== 200) {
    problems.push({ page: path, issue: `status ${r.status}` });
    return;
  }
  if (!r.body) return;
  const html = strip(r.body);
  const rec = seen.get(path);
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) rec.ids.add(m[1]);

  const noindex = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html);
  const h1 = (html.match(/<h1[\s>]/gi) ?? []).length;
  if (h1 !== 1) problems.push({ page: path, issue: `${h1} <h1> elements` });
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();
  if (!title) problems.push({ page: path, issue: "missing <title>" });
  else if (title.length > 70) problems.push({ page: path, issue: `title is ${title.length} chars`, level: "warn" });
  const desc = /<meta[^>]+name="description"[^>]+content="([^"]*)"/i.exec(html)?.[1];
  if (!desc) problems.push({ page: path, issue: "missing meta description" });
  else if (desc.length > 170) problems.push({ page: path, issue: `description is ${desc.length} chars`, level: "warn" });
  if (!noindex && !/<link[^>]+rel="canonical"/i.test(html)) problems.push({ page: path, issue: "missing canonical" });
  if (/\\u[0-9a-f]{4}/i.test(html.replace(/<[^>]+>/g, " ").replace(/application\/ld\+json[\s\S]*?<\/script>/g, ""))) problems.push({ page: path, issue: "literal \\uXXXX escape visible in text" });
  if (/\b(undefined|NaN|\[object Object\])\b/.test(html.replace(/<[^>]+>/g, " "))) problems.push({ page: path, issue: "undefined/NaN/[object Object] in text", level: "warn" });
  for (const img of html.matchAll(/<img\b[^>]*>/gi)) if (!/\salt=/.test(img[0])) problems.push({ page: path, issue: `img without alt: ${img[0].slice(0, 80)}` });

  for (const m of html.matchAll(/<a\b[^>]*\shref="([^"]*)"[^>]*>/gi)) {
    const href = m[1].replace(/&amp;/g, "&");
    if (href === "#" || href === "") {
      problems.push({ page: path, issue: `placeholder link href="${href}"` });
      continue;
    }
    const n = normalise(href, path);
    if (!n) continue;
    if (n.bad) problems.push({ page: path, issue: `bad href ${n.bad.slice(0, 60)}` });
    else if (n.external) {
      if (/(^|\.)(example\.(com|org)|localhost|netlify\.app|mobiri\.se|icareforex\.com|finitic\.com)$/i.test(new URL(n.external).hostname)) problems.push({ page: path, issue: `suspicious external link ${n.external}` });
      if (!/rel="[^"]*noopener/.test(m[0])) problems.push({ page: path, issue: `external link without rel=noopener: ${n.external}`, level: "warn" });
      if (!externals.has(n.external)) externals.set(n.external, new Set());
      externals.get(n.external).add(path);
    } else {
      if (n.path.startsWith("/api/") || n.path.startsWith("/_next/")) continue;
      if (n.hash) anchors.push({ page: path, target: n.path, hash: decodeURIComponent(n.hash) });
      if (!seen.has(n.path) && !queue.includes(n.path)) queue.push(n.path);
    }
  }
}

async function run() {
  // seed with the sitemaps so orphan pages are still audited, and so the
  // sitemap itself is checked against reality
  const sitemapUrls = [];
  try {
    const idx = await (await fetch(origin + "/sitemap.xml")).text();
    const children = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    for (const c of children) {
      const p = new URL(c).pathname;
      const xml = await (await fetch(origin + p)).text();
      for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapUrls.push(new URL(m[1]).pathname.replace(/\/$/, "") || "/");
    }
  } catch {
    problems.push({ page: "/sitemap.xml", issue: "could not read sitemap" });
  }
  for (const p of sitemapUrls) if (!queue.includes(p)) queue.push(p);

  while (queue.length) {
    const batch = queue.splice(0, CONCURRENCY);
    await Promise.all(batch.map((p) => (seen.has(p) ? null : visit(p))));
  }

  for (const a of anchors) {
    const t = seen.get(a.target);
    // hashes consumed by client code (search state, graph focus, verifier input) are not element ids
    if (t?.ids && !t.ids.has(a.hash) && !/^(i|c|cb|ccy|ev|ac|t|p):|^q=|%|https?:/.test(a.hash) && !/^(tour|guide)$/.test(a.hash)) problems.push({ page: a.page, issue: `anchor #${a.hash} not found on ${a.target}` });
  }
  for (const p of sitemapUrls) {
    const s = seen.get(p)?.status;
    if (s !== 200) problems.push({ page: p, issue: `listed in sitemap but responds ${s}` });
  }

  let externalResults = [];
  if (checkExternal) {
    const list = [...externals.keys()];
    for (let i = 0; i < list.length; i += CONCURRENCY) {
      externalResults.push(
        ...(await Promise.all(
          list.slice(i, i + CONCURRENCY).map(async (url) => {
            try {
              let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "Mozilla/5.0 gio4x-audit" } });
              if (res.status === 405 || res.status === 403 || res.status === 404) res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "Mozilla/5.0 gio4x-audit" } });
              return { url, status: res.status };
            } catch (e) {
              return { url, status: 0, error: e.message };
            }
          }),
        )),
      );
    }
    for (const r of externalResults) if (r.status >= 400 || r.status === 0) problems.push({ page: [...externals.get(r.url)][0], issue: `external link ${r.url} → ${r.status || r.error}`, level: "warn" });
  }

  const pages = [...seen.entries()];
  const ok = pages.filter(([, r]) => r.status === 200).length;
  const redirects = pages.filter(([, r]) => r.status >= 300 && r.status < 400).length;
  const errors = problems.filter((p) => p.level !== "warn");
  const warns = problems.filter((p) => p.level === "warn");
  console.log(`\nGIO4X audit of ${origin}`);
  console.log(`  pages crawled: ${pages.length}  (200: ${ok}, redirects: ${redirects})  ·  in sitemap: ${sitemapUrls.length}  ·  external links: ${externals.size}`);
  const notInSitemap = pages.filter(([p, r]) => r.status === 200 && !sitemapUrls.includes(p)).map(([p]) => p);
  console.log(`  reachable but not in sitemap (${notInSitemap.length}): ${notInSitemap.slice(0, 40).join(" ")}`);
  console.log(`\n  errors: ${errors.length}`);
  for (const p of errors.slice(0, 200)) console.log(`   ✗ ${p.page}  ${p.issue}`);
  console.log(`\n  warnings: ${warns.length}`);
  for (const p of warns.slice(0, 80)) console.log(`   ! ${p.page}  ${p.issue}`);
  if (jsonOut) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(jsonOut, JSON.stringify({ origin, pages: pages.map(([p, r]) => ({ path: p, status: r.status })), externals: [...externals.keys()], externalResults, problems, notInSitemap }, null, 1));
  }
  process.exit(errors.length ? 1 : 0);
}

run();

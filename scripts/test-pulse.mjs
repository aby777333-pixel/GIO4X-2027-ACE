// Checks for the visit counter's two deciding functions (src/lib/pulse.ts):
// the path normaliser and the search-term matcher.
//
//   node scripts/test-pulse.mjs [base-url]
//
// With a base URL of a running site (default http://localhost:3111) the checks
// run against the REAL search index and sitemaps, so "the site's own pages" and
// "the site's own terms" are the real ones. If the site cannot be reached, a
// small built-in list is used instead and the output says so.
// Needs Node 23.6 or later (it imports the TypeScript source directly).
// Exit code 1 when any check fails.

import { buildTermMap, isNeverCounted, matchTerm, normalisePath, refClass, stripPath, termCanonical, PULSE_OTHER } from "../src/lib/pulse.ts";

const base = (process.argv[2] ?? "http://localhost:3111").replace(/\/$/, "");
let failed = 0;
let passed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL  ${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
  }
}

// ---- the site's real pages and terms, when reachable ------------------------
let index = [
  { t: "EUR/USD", k: ["euro dollar", "eurusd", "fiber"] },
  { t: "XAU/USD", k: ["gold", "xauusd"] },
  { t: "Slippage", k: ["slippage"] },
  { t: "Margin calculator", k: ["margin", "calculator", "tool"] },
  { t: "MetaTrader 5", k: ["mt5", "metatrader"] },
];
let paths = new Set(["/", "/contact", "/markets", "/markets/forex", "/markets/forex/eur-usd", "/glossary/slippage", "/search", "/preferences"]);
let source = "built-in lists (the site was not reachable)";
try {
  const idx = await fetch(`${base}/search-index.json`, { signal: AbortSignal.timeout(60000) });
  if (!idx.ok) throw new Error(String(idx.status));
  const real = await idx.json();
  const maps = ["pages", "markets", "instruments", "intelligence", "academy", "glossary", "tools"];
  const found = new Set(["/", "/search", "/preferences", "/sign-in", "/open-account", "/desk", "/offline", "/intelligence/blog"]);
  for (const name of maps) {
    const xml = await (await fetch(`${base}/sitemap-${name}.xml`, { signal: AbortSignal.timeout(60000) })).text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) found.add(new URL(m[1]).pathname.replace(/(.)\/$/, "$1"));
  }
  if (real.length > 50 && found.size > 50) {
    index = real;
    paths = found;
    source = `${base}: ${real.length} index entries, ${found.size} published paths`;
  }
} catch {
  /* keep the built-in lists */
}
const known = (p) => paths.has(p) || /^\/intelligence\/blog\/[a-z0-9]+(-[a-z0-9]+)*$/.test(p);
const terms = buildTermMap(index);
console.log(`Using ${source}; ${terms.size} terms.`);

// ---- stripPath ----------------------------------------------------------------
check("query string is removed", stripPath("/contact?topic=security&email=someone@example.invalid"), "/contact");
check("fragment is removed", stripPath("/trust/verify#https://example.invalid/x"), "/trust/verify");
check("trailing slash is removed", stripPath("/markets/"), "/markets");
check("root stays root", stripPath("/"), "/");
check("not a path: no leading slash", stripPath("contact"), null);
check("not a path: protocol-relative", stripPath("//example.invalid/x"), null);
check("not a path: a full address", stripPath("https://example.invalid/contact"), null);
check("not a path: a number", stripPath(42), null);
check("not a path: an object", stripPath({ path: "/" }), null);

// ---- normalisePath ------------------------------------------------------------
check("a published page is counted under its own path", normalisePath("/contact", known), "/contact");
check("the home page", normalisePath("/", known), "/");
check("the query string never survives", normalisePath("/contact?name=Sample+Person&email=someone@example.invalid", known), "/contact");
check("the fragment never survives", normalisePath("/contact#someone@example.invalid", known), "/contact");
check("the search page is counted without its query", normalisePath("/search?q=Sample%20Person", known), "/search");
check("an unknown page is (other)", normalisePath("/no-such-page", known), PULSE_OTHER);
check("an e-mail address in the path is (other)", normalisePath("/someone@example.invalid", known), PULSE_OTHER);
check("a name in the path is (other)", normalisePath("/glossary/Sample-Person", known), PULSE_OTHER);
check("an unknown glossary slug is (other)", normalisePath("/glossary/sample-person", known), PULSE_OTHER);
check("an encoded path is (other)", normalisePath("/markets/%66orex", known), PULSE_OTHER);
check("upper case is (other)", normalisePath("/Contact", known), PULSE_OTHER);
check("dot-dot is (other)", normalisePath("/markets/../control", known), PULSE_OTHER);
check("a doubled slash inside is (other)", normalisePath("/markets//forex", known), PULSE_OTHER);
check("an over-long path is (other)", normalisePath("/" + "a".repeat(200), known), PULSE_OTHER);
check("a blog post is recognised by its shape", normalisePath("/intelligence/blog/a-sample-post", known), "/intelligence/blog/a-sample-post");
check("the staff console is never counted", normalisePath("/control", known), null);
check("a console page is never counted", normalisePath("/control/customers/0123456789abcdef0123456789abcdef", known), null);
check("an endpoint is never counted", normalisePath("/api/contact", known), null);
check("a development preview is never counted", normalisePath("/zz-preview-analytics/filled", known), null);
check("a page that only starts like the console is still a page", isNeverCounted("/controls"), false);
check("not a path at all", normalisePath("javascript:alert(1)", known), null);
check("null", normalisePath(null, known), null);
// every published path must pass the character rule the database repeats, or it would be refused there
const unstorable = [...paths].filter((p) => normalisePath(p, known) !== p);
check("every published path is storable under its own name", unstorable.slice(0, 5), []);

// ---- refClass -----------------------------------------------------------------
check("no referrer", refClass("", "gio4x.example"), "none");
check("same site", refClass("https://gio4x.example/markets?x=1", "gio4x.example"), "internal");
check("same site with a port", refClass("http://localhost:3111/markets", "localhost:3111"), "internal");
check("a search engine", refClass("https://www.google.com/search?q=someone@example.invalid", "gio4x.example"), "search");
check("a national search domain", refClass("https://www.google.co.uk/", "gio4x.example"), "search");
check("another search engine", refClass("https://duckduckgo.com/", "gio4x.example"), "search");
check("another website", refClass("https://news.example.invalid/article/1?ref=Sample+Person", "gio4x.example"), "other");
check("a look-alike is not a search engine", refClass("https://notgoogle.com.example.invalid/", "gio4x.example"), "other");
check("not an address", refClass("not a url", "gio4x.example"), "none");

// ---- matchTerm ----------------------------------------------------------------
const first = index.find((e) => /^[A-Z]{3}\/[A-Z]{3}$/.test(e.t)) ?? index[0];
const firstTerm = termCanonical(first.t);
check("a symbol as the site writes it", matchTerm(first.t, terms), firstTerm);
check("the same symbol, squashed and lower case", matchTerm(first.t.replace("/", "").toLowerCase(), terms), firstTerm);
check("the same symbol with the $ prefix", matchTerm("$" + first.t.replace("/", ""), terms), firstTerm);
check("surrounding spaces do not matter", matchTerm(`  ${first.t}  `, terms), firstTerm);
if (terms.has("slippage")) {
  check("a glossary term", matchTerm("Slippage", terms), "slippage");
  check("a glossary term with the define: prefix", matchTerm("define: slippage", terms), "slippage");
  check("a term inside a sentence is unmatched", matchTerm("what is slippage please", terms), null);
  check("a term followed by a name is unmatched", matchTerm("slippage Sample Person", terms), null);
}
check("an e-mail address is unmatched", matchTerm("someone@example.invalid", terms), null);
check("an e-mail address with a prefix is unmatched", matchTerm("define: someone@example.invalid", terms), null);
check("a name is unmatched", matchTerm("Sample Person", terms), null);
check("a name in lower case is unmatched", matchTerm("sample person", terms), null);
check("a telephone number is unmatched", matchTerm("+44 20 7946 0000", terms), null);
check("an account-like number is unmatched", matchTerm("GB29 NWBK 6016 1331 9268 19", terms), null);
check("a long string is unmatched", matchTerm("lorem ipsum dolor sit amet ".repeat(4), terms), null);
check("a string over the length limit is unmatched", matchTerm("a".repeat(500), terms), null);
check("a single letter is unmatched", matchTerm("a", terms), null);
check("nothing is unmatched", matchTerm("", terms), null);
check("only spaces is unmatched", matchTerm("    ", terms), null);
check("not a string is unmatched", matchTerm(["slippage"], terms), null);
check("a misspelling is unmatched (only exact terms are kept)", matchTerm("slipagge", terms), null);

// whatever comes back is always one of the site's own stored terms, never the input
const samples = ["someone@example.invalid", "Sample Person", first.t, "gold", "EURUSD", "x".repeat(60), "margin", "sample.person"];
const values = new Set(terms.values());
check("a result is always a term from the site's list", samples.map((s) => matchTerm(s, terms)).filter((r) => r !== null && !values.has(r)), []);
// every stored term fits the database's rule (pulse_search_term_valid)
check("every term fits the database's character rule", [...values].filter((t) => !/^[a-z0-9][a-z0-9 .]*$/.test(t) || t.length > 48).slice(0, 5), []);
check("no term contains an @", [...values].filter((t) => t.includes("@")), []);

console.log(`${passed} passed, ${failed} failed.`);
process.exit(failed ? 1 : 0);

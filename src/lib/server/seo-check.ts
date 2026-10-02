/**
 * SEO health: what the website actually sends, read from the website itself.
 *
 * A check fetches this site's own public pages, sitemaps, feeds and
 * robots.txt, and reports what a search engine would find: titles and meta
 * descriptions and their lengths, the number of <h1>, canonical addresses,
 * internal links that lead nowhere, sitemap entries that lead nowhere,
 * redirects that chain or end nowhere, and which pages ask not to be indexed.
 * Every figure is counted from those responses. Nothing is estimated.
 *
 * What a check may and may not do (the rules are enforced in one place,
 * `fetchOne`):
 *   · GET only.
 *   · Only this site's own origin, which the caller derives from the request
 *     it is answering (originFromHost). A redirect is never followed: its
 *     target is read from the Location header and, when it is on this site,
 *     checked as its own request.
 *   · Never /control or /api (or the framework's own files).
 *   · Anonymous: no cookie, no session and no key is sent. The pages are read
 *     exactly as a stranger reads them.
 *   · A hard cap on requests, a time limit for each, and a time budget for
 *     the work one request to the console may do.
 *
 * The site is read in parts (the documents, the pages sixteen at a time, the
 * addresses whose status alone matters), and each finished part is kept for
 * up to ten minutes (unstable_cache). So opening the screen is not a crawl each
 * time, and a site too large for one request's budget is finished by the
 * next request, which finds the earlier parts already kept. A part the budget
 * did not reach is reported as not checked, never as passing, and is never
 * kept. "Re-check now" in the console drops every kept part.
 */
import { unstable_cache } from "next/cache";
import redirectsFile from "@/config/redirects.json";
import { site } from "@/config/site";
import { BLOG_PATH } from "@/lib/blog";
import { readPage, readRobots, saysNoindex, xmlBalanced, xmlBlocks, xmlTexts } from "@/lib/seo-parse";
import { blogPostPath, indexablePosts } from "@/lib/server/blog";
import { SITEMAP_NAMES } from "@/lib/sitemap";
import { sitemapEntries } from "@/lib/sitemap-data";

export const SEO_CACHE_TAG = "seo-health";
/** Seconds a finished part of a check is kept. */
export const SEO_REVALIDATE = 600;

/** About what a search result shows of a title and of a description. */
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MIN = 70;
export const SEO_DESCRIPTION_MAX = 160;

export type SeoLimits = {
  /** requests in flight at once */
  concurrency: number;
  /** milliseconds one request may take */
  fetchTimeoutMs: number;
  /** milliseconds one request to the console may spend fetching; nothing is started after it */
  budgetMs: number;
  /** requests one request to the console may make, of every kind */
  maxFetches: number;
  /** pages read in full */
  maxPages: number;
  /** addresses checked for their status alone (link targets, redirect ends) */
  maxStatusChecks: number;
  /** bytes of one response that are read */
  maxBytes: number;
};

/**
 * On the host the work has to finish inside one function call, so a request
 * is given a few seconds and the next one carries on. In development every
 * page is compiled and rendered on demand, so a request is given minutes.
 */
export function defaultSeoLimits(): SeoLimits {
  return process.env.NODE_ENV === "production"
    ? { concurrency: 8, fetchTimeoutMs: 3500, budgetMs: 8000, maxFetches: 900, maxPages: 800, maxStatusChecks: 320, maxBytes: 1_500_000 }
    : { concurrency: 4, fetchTimeoutMs: 60_000, budgetMs: 240_000, maxFetches: 900, maxPages: 800, maxStatusChecks: 320, maxBytes: 1_500_000 };
}

/** Addresses to a part. Small enough that a part whose every request times out is still short. */
const PART = 16;

/* -------------------------------------------------------------------------- */
/* the origin                                                                 */
/* -------------------------------------------------------------------------- */

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;
/** A public DNS name with an optional port: letters, digits and hyphens in dot-separated labels, the last one not a number. */
const DNS_HOST = /^(?=.{1,253}(?::|$))([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?(:\d{1,5})?$/;

/**
 * The origin of the site that is answering this request, from its Host header.
 * A loopback host (local development) is read over http; any other host must
 * be a DNS name and is read over https. An address written as numbers, a
 * single-label name or anything else is refused, so a check can never be
 * pointed at a machine inside a network.
 */
export function originFromHost(host: string | null | undefined): string | null {
  const h = (host ?? "").trim().toLowerCase();
  if (!h || h.length > 260) return null;
  if (LOOPBACK.test(h)) return `http://${h}`;
  if (DNS_HOST.test(h)) return `https://${h}`;
  return null;
}

/** Paths a check never asks for: private surfaces and the framework's own files. */
const PRIVATE_PATH = /^\/(control|api|_next|zz-preview[^/]*)(\/|$)/i;
export const isPrivatePath = (path: string): boolean => PRIVATE_PATH.test(path);

/* -------------------------------------------------------------------------- */
/* what a check reports                                                       */
/* -------------------------------------------------------------------------- */

export type SeoIssueKind =
  | "status"
  | "redirects"
  | "title-missing"
  | "title-long"
  | "description-missing"
  | "description-short"
  | "description-long"
  | "h1-none"
  | "h1-many"
  | "canonical-missing"
  | "canonical-other"
  | "noindex-listed";

export type SeoPageFinding = {
  path: string;
  /** the HTTP status; 0 when there was no answer */
  status: number;
  titleLength: number | null;
  descriptionLength: number | null;
  h1: number | null;
  issues: { kind: SeoIssueKind; text: string }[];
};

export type SeoLinkFinding = {
  path: string;
  status: number;
  /** pages that link to it (a few), and how many do */
  from: string[];
  fromCount: number;
};

export type SeoRedirectedLink = SeoLinkFinding & { to: string };

export type SeoDocumentCheck = {
  path: string;
  kind: "index" | "sitemap" | "feed";
  /** 0 when there was no answer */
  status: number;
  /** URLs listed (a sitemap), child sitemaps (the index) or items (a feed); null when it could not be read */
  entries: number | null;
  /** null when it could not be read */
  wellFormed: boolean | null;
  problem: string;
  /** addresses listed there that answer 404 (a few), and how many do */
  notFound: string[];
  notFoundCount: number;
  /** listed addresses not checked yet */
  unchecked: number;
  /** the host the listed addresses are written with, when it is not the host that was checked */
  otherHost: string | null;
};

export type SeoRedirectCheck = {
  source: string;
  /** what the site answered for the source: the status and where it points; null when not checked */
  sourceStatus: number | null;
  location: string | null;
  /** the status of the destination; null when not checked */
  targetStatus: number | null;
};

export type SeoReport = {
  origin: string;
  /** when the oldest part of what is shown was read, and the newest */
  ranAt: string;
  newestAt: string;
  /** requests made, and the seconds they took, over every part shown */
  fetches: number;
  durationMs: number;
  /** some part has not been read yet: the next request carries on */
  cutShort: boolean;
  pages: {
    /** public routes the site knows */
    known: number;
    /** of those, read so far */
    checked: number;
    /** read, and nothing to report */
    clean: number;
    findings: SeoPageFinding[];
    /** pages with something to report (findings may be a shorter list) */
    findingCount: number;
    /** how many pages have each kind of finding */
    byKind: Partial<Record<SeoIssueKind, number>>;
  };
  links: {
    /** false until every page has been read: links are checked once the whole set is known */
    ready: boolean;
    /** distinct internal addresses linked from the pages that were read */
    distinct: number;
    checked: number;
    broken: SeoLinkFinding[];
    brokenCount: number;
    redirected: SeoRedirectedLink[];
    redirectedCount: number;
    /** distinct addresses not checked yet */
    unchecked: number;
    /** links to /control or /api, which are never fetched */
    privateSkipped: number;
    external: { host: string; links: number; pages: number }[];
    externalHosts: number;
  };
  documents: SeoDocumentCheck[];
  redirects: SeoRedirectCheck[];
  robots: {
    status: number;
    /** the file as served, shortened */
    text: string;
    disallowAll: boolean;
    disallow: string[];
    sitemaps: string[];
  };
  noindex: {
    /** pages read that ask not to be indexed, by a meta tag or a header */
    count: number;
    /** every page that was read asks not to be indexed: this is not the production site */
    all: boolean;
    paths: string[];
  };
};

export type SeoOutcome = { state: "ok"; report: SeoReport } | { state: "failed"; reason: "no-origin" | "unreachable" };

/** The redirects the site is built with (src/config/redirects.json, read by next.config.mjs). All are permanent. */
export type SeoRedirectRow = { source: string; destination: string; permanent: true; /** the destination is itself redirected, to this */ chainTo: string | null };

export function redirectRows(): SeoRedirectRow[] {
  const rows = (redirectsFile as { source: string; destination: string }[]).filter((r) => typeof r.source === "string" && typeof r.destination === "string");
  const bySource = new Map(rows.map((r) => [r.source, r.destination]));
  return rows.map((r) => ({ source: r.source, destination: r.destination, permanent: true, chainTo: bySource.get(r.destination) ?? null }));
}

/** Pages that exist, are public and are deliberately left out of the sitemaps: gateways and utilities. Read so that their noindex can be confirmed. */
const UTILITY_PAGES = ["/search", "/preferences", "/sign-in", "/open-account"];
const FEEDS = ["/intelligence/feed.xml", `${BLOG_PATH}/feed.xml`];
const LIST_CAP = 200;
const FROM_CAP = 5;
const EXTERNAL_PER_PAGE = 150;

/* -------------------------------------------------------------------------- */
/* fetching                                                                   */
/* -------------------------------------------------------------------------- */

/** `why` says what a status of 0 means: "budget" is "not asked", the others are "asked, and no answer". */
type Got = { status: number; why: "" | "refused" | "budget" | "no-answer"; location: string | null; robotsHeader: string | null; text: string };
const none = (why: Got["why"]): Got => ({ status: 0, why, location: null, robotsHeader: null, text: "" });

/** What one request to the console may still do. Shared by every part it works on. */
type Budget = { deadline: number; fetches: number };

/** The site could not be reached at all. */
class SeoUnreachable extends Error {}
/** The budget ran out inside a part: the part is not kept, and is reported as not checked. */
class SeoCut extends Error {}

/** "/a/b/" → "/a/b"; the root stays "/". */
const trimSlash = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") || "/" : path);

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const run = async () => {
    while (next < items.length) await work(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, run));
}

const chunks = <T>(items: T[], size: number): T[][] => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

/** The body as text, read up to a bound; the rest is abandoned. */
async function readCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let text = "";
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (total >= maxBytes) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
  return text + decoder.decode();
}

/**
 * The one place a request is made. `want` is "text" for a document that will
 * be read, "status" when only the answer matters.
 */
async function fetchOne(origin: string, path: string, want: "text" | "status", limits: SeoLimits, budget: Budget): Promise<Got> {
  let url: URL;
  try {
    url = new URL(path, origin);
  } catch {
    return none("refused");
  }
  // this site, a public path, and nothing else
  if (!path.startsWith("/") || path.startsWith("//") || url.origin !== origin || isPrivatePath(url.pathname)) return none("refused");
  const left = budget.deadline - Date.now();
  if (budget.fetches >= limits.maxFetches || left < 250) return none("budget");
  budget.fetches++;
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      credentials: "omit",
      headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "user-agent": "GIO4X-Control-SEO-check" },
      signal: AbortSignal.timeout(Math.min(limits.fetchTimeoutMs, left)),
    });
    const got: Got = { status: response.status, why: "", location: response.headers.get("location"), robotsHeader: response.headers.get("x-robots-tag"), text: "" };
    if (want === "text" && response.status === 200) got.text = await readCapped(response, limits.maxBytes);
    else await response.body?.cancel().catch(() => undefined);
    return got;
  } catch {
    // cut off by the end of the budget rather than by its own time limit: not an answer about the page
    return none(left < limits.fetchTimeoutMs && Date.now() >= budget.deadline - 50 ? "budget" : "no-answer");
  }
}

/**
 * As fetchOne, and asked once more when there was no answer: one slow response
 * should not be written down as a page that does not answer.
 */
async function fetchTwice(origin: string, path: string, want: "text" | "status", limits: SeoLimits, budget: Budget): Promise<Got> {
  const first = await fetchOne(origin, path, want, limits, budget);
  return first.why === "no-answer" ? fetchOne(origin, path, want, limits, budget) : first;
}

/** An address as written in a page, a sitemap or a Location header → a path on this site, or null when it is somewhere else. */
function internalPath(origin: string, href: string, base: string): string | null {
  try {
    const url = new URL(href, `${origin}${base}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // links and sitemap entries are written with the canonical origin, which is this site under its public name
    return url.host === new URL(origin).host || url.host === new URL(site.url).host ? trimSlash(url.pathname) : null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* the parts                                                                  */
/* -------------------------------------------------------------------------- */

type PartMeta = { at: string; fetches: number; ms: number };

type DocumentFacts = { path: string; kind: SeoDocumentCheck["kind"]; status: number; entries: number | null; wellFormed: boolean | null; problem: string; otherHost: string | null; listed: string[] };
type DocumentsPart = PartMeta & { robots: { status: number; text: string }; documents: DocumentFacts[] };

type PageFacts = {
  path: string;
  status: number;
  /** where a redirect points: a path on this site, or the address as given */
  location: string | null;
  titleLength: number | null;
  descriptionLength: number | null;
  h1: number | null;
  /** the canonical address: a path on this site, the address as given when it is elsewhere, or null */
  canonical: string | null;
  noindex: boolean;
  /** distinct internal paths linked */
  links: string[];
  privateLinks: number;
  /** distinct addresses on other sites */
  external: string[];
};
type PagesPart = PartMeta & { pages: PageFacts[] };

type StatusFacts = { path: string; status: number; location: string | null };
type StatusPart = PartMeta & { results: StatusFacts[] };

function documentFacts(origin: string, path: string, kind: SeoDocumentCheck["kind"], got: Got): DocumentFacts {
  if (got.status !== 200) return { path, kind, status: got.status, entries: null, wellFormed: null, problem: got.status === 0 ? "No answer." : `Answers ${got.status}.`, otherHost: null, listed: [] };
  const balance = xmlBalanced(got.text);
  const addresses = kind === "feed" ? xmlBlocks(got.text, "item").flatMap((item) => xmlTexts(item, "link").slice(0, 1)) : xmlTexts(got.text, "loc");
  const ownHost = new URL(origin).host;
  const listed: string[] = [];
  let otherHost: string | null = null;
  let foreign = 0;
  for (const address of addresses) {
    const p = internalPath(origin, address, "/");
    if (p === null) {
      foreign++;
      continue;
    }
    listed.push(p);
    try {
      const host = new URL(address).host;
      if (host !== ownHost) otherHost = host;
    } catch {
      /* a relative address has no host of its own */
    }
  }
  return {
    path,
    kind,
    status: 200,
    entries: addresses.length,
    wellFormed: balance.ok,
    problem: [balance.ok ? "" : balance.problem, foreign ? `${foreign} listed ${foreign === 1 ? "address is" : "addresses are"} not on this site.` : ""].filter(Boolean).join(" "),
    otherHost,
    listed: [...new Set(listed)],
  };
}

/** robots.txt, the sitemap index, every sitemap it names, and the feeds. Also the proof that the site answers at all. */
async function readDocuments(origin: string, limits: SeoLimits, budget: Budget): Promise<DocumentsPart> {
  const started = Date.now();
  const before = budget.fetches;
  const must = (got: Got): Got => {
    if (got.why === "budget") throw new SeoCut();
    return got;
  };

  const robots = must(await fetchOne(origin, "/robots.txt", "text", limits, budget));
  const index = must(await fetchOne(origin, "/sitemap.xml", "text", limits, budget));
  // neither answered: the site cannot be reached from here
  if (robots.status === 0 && index.status === 0) throw new SeoUnreachable();

  const indexFacts = documentFacts(origin, "/sitemap.xml", "index", index);
  const children = new Set<string>(SITEMAP_NAMES.map((name) => `/sitemap-${name}.xml`));
  for (const p of indexFacts.listed) if (/\.xml$/i.test(p) && !isPrivatePath(p)) children.add(p);

  const rest: { path: string; kind: SeoDocumentCheck["kind"] }[] = [...[...children].slice(0, 40).map((path) => ({ path, kind: "sitemap" as const })), ...FEEDS.map((path) => ({ path, kind: "feed" as const }))];
  const facts = new Map<string, DocumentFacts>();
  let cut = false;
  await pool(rest, limits.concurrency, async ({ path, kind }) => {
    const got = await fetchOne(origin, path, "text", limits, budget);
    if (got.why === "budget") cut = true;
    else facts.set(path, documentFacts(origin, path, kind, got));
  });
  if (cut) throw new SeoCut();

  return {
    at: new Date(started).toISOString(),
    fetches: budget.fetches - before,
    ms: Date.now() - started,
    robots: { status: robots.status, text: robots.text.slice(0, 1500) },
    // the index names its sitemaps; what those list is theirs to report
    documents: [{ ...indexFacts, listed: [] }, ...rest.map((r) => facts.get(r.path)).filter((f): f is DocumentFacts => !!f)],
  };
}

function pageFacts(origin: string, path: string, got: Got): PageFacts {
  const base: PageFacts = { path, status: got.status, location: null, titleLength: null, descriptionLength: null, h1: null, canonical: null, noindex: saysNoindex(got.robotsHeader), links: [], privateLinks: 0, external: [] };
  if (got.status >= 300 && got.status < 400) return { ...base, location: got.location ? (internalPath(origin, got.location, path) ?? got.location) : null };
  if (got.status !== 200) return base;

  const page = readPage(got.text);
  const links = new Set<string>();
  const external = new Set<string>();
  let privateLinks = 0;
  for (const href of page.hrefs) {
    if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    const target = internalPath(origin, href, path);
    if (target !== null) {
      if (isPrivatePath(target)) privateLinks++;
      else links.add(target);
      continue;
    }
    try {
      const url = new URL(href, `${origin}${path}`);
      if ((url.protocol === "http:" || url.protocol === "https:") && external.size < EXTERNAL_PER_PAGE) external.add(`${url.origin}${url.pathname}`.slice(0, 300));
    } catch {
      /* not an address: nothing to count */
    }
  }
  return {
    ...base,
    titleLength: page.title?.length ?? 0,
    descriptionLength: page.description?.length ?? 0,
    h1: page.h1,
    canonical: page.canonical ? (internalPath(origin, page.canonical, path) ?? page.canonical.slice(0, 300)) : null,
    noindex: base.noindex || saysNoindex(page.robots),
    links: [...links],
    privateLinks,
    external: [...external],
  };
}

async function readPages(origin: string, paths: string[], limits: SeoLimits, budget: Budget): Promise<PagesPart> {
  const started = Date.now();
  const before = budget.fetches;
  const pages: PageFacts[] = [];
  let cut = false;
  await pool(paths, limits.concurrency, async (path) => {
    const got = await fetchTwice(origin, path, "text", limits, budget);
    if (got.why === "budget") cut = true;
    else pages.push(pageFacts(origin, path, got));
  });
  if (cut) throw new SeoCut();
  pages.sort((a, b) => paths.indexOf(a.path) - paths.indexOf(b.path));
  return { at: new Date(started).toISOString(), fetches: budget.fetches - before, ms: Date.now() - started, pages };
}

async function readStatuses(origin: string, paths: string[], limits: SeoLimits, budget: Budget): Promise<StatusPart> {
  const started = Date.now();
  const before = budget.fetches;
  const results: StatusFacts[] = [];
  let cut = false;
  await pool(paths, limits.concurrency, async (path) => {
    const got = await fetchTwice(origin, path, "status", limits, budget);
    if (got.why === "budget") cut = true;
    else results.push({ path, status: got.status, location: got.location ? (internalPath(origin, got.location, path) ?? got.location) : null });
  });
  if (cut) throw new SeoCut();
  return { at: new Date(started).toISOString(), fetches: budget.fetches - before, ms: Date.now() - started, results };
}

/**
 * A part, kept under a key made of what it reads and of the ten-minute window
 * it was read in. A part that throws is not kept.
 *
 * The window is in the key on purpose. The cache would otherwise hand back a
 * part older than ten minutes and read it again behind the response: the
 * screen would show an old check as if it were the kept one, and every part
 * would be re-read at once, outside the order and the budget set here. With
 * the window in the key, an old part is simply not found, and is read again
 * in turn.
 */
function kept<T>(key: string[], work: () => Promise<T>): Promise<T> {
  const window = String(Math.floor(Date.now() / (SEO_REVALIDATE * 1000)));
  return unstable_cache(work, ["seo-health-v3", window, ...key], { revalidate: SEO_REVALIDATE, tags: [SEO_CACHE_TAG] })();
}

/** The part, or null when the budget did not reach it. */
async function part<T>(key: string[], work: () => Promise<T>): Promise<T | null> {
  try {
    return await kept(key, work);
  } catch (error) {
    if (error instanceof SeoUnreachable) throw error;
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* a check                                                                    */
/* -------------------------------------------------------------------------- */

/** Every public route the site knows: what its sitemaps are built from, the blog's posts, and the gateway pages. */
async function knownPages(): Promise<{ paths: string[]; inSitemaps: Set<string> }> {
  const paths = new Set<string>(["/"]);
  const inSitemaps = new Set<string>();
  for (const name of SITEMAP_NAMES) {
    for (const entry of sitemapEntries(name)) {
      const p = trimSlash(entry.path);
      paths.add(p);
      inSitemaps.add(p);
    }
  }
  // the blog's posts are rows in the database, read as the public reads them
  const posts = await indexablePosts();
  if (posts.state === "ok") {
    for (const post of posts.entries) {
      paths.add(blogPostPath(post.slug));
      inSitemaps.add(blogPostPath(post.slug));
    }
  }
  for (const p of UTILITY_PAGES) paths.add(p);
  return { paths: [...paths].filter((p) => !isPrivatePath(p)), inSitemaps };
}

function pageIssues(page: PageFacts, timeoutMs: number): SeoPageFinding["issues"] {
  const issues: SeoPageFinding["issues"] = [];
  if (page.status === 0) return [{ kind: "status", text: `Asked twice, and did not answer within ${Math.round(timeoutMs / 100) / 10} seconds either time.` }];
  if (page.status >= 300 && page.status < 400) return [{ kind: "redirects", text: `Answers ${page.status} and sends the reader to ${page.location ?? "an address it does not name"}. A page the site lists should answer itself.` }];
  if (page.status !== 200) return [{ kind: "status", text: `Answers ${page.status}${page.status === 404 ? ": the page is not there" : ""}.` }];

  const title = page.titleLength ?? 0;
  if (title === 0) issues.push({ kind: "title-missing", text: "There is no title." });
  else if (title > SEO_TITLE_MAX) issues.push({ kind: "title-long", text: `The title is ${title} characters. A search result shows about ${SEO_TITLE_MAX}.` });

  const description = page.descriptionLength ?? 0;
  if (description === 0) issues.push({ kind: "description-missing", text: "There is no meta description." });
  else if (description < SEO_DESCRIPTION_MIN) issues.push({ kind: "description-short", text: `The meta description is ${description} characters: under about ${SEO_DESCRIPTION_MIN} is thin.` });
  else if (description > SEO_DESCRIPTION_MAX) issues.push({ kind: "description-long", text: `The meta description is ${description} characters. A search result shows about ${SEO_DESCRIPTION_MAX}.` });

  if (page.h1 === 0) issues.push({ kind: "h1-none", text: "There is no h1 heading." });
  else if ((page.h1 ?? 1) > 1) issues.push({ kind: "h1-many", text: `There are ${page.h1} h1 headings. A page has one.` });

  if (!page.canonical) issues.push({ kind: "canonical-missing", text: "There is no canonical address." });
  else if (page.canonical !== page.path) issues.push({ kind: "canonical-other", text: `The canonical address is ${page.canonical}, not this page.` });
  return issues;
}

export async function runSeoCheck(origin: string, limits: SeoLimits = defaultSeoLimits()): Promise<SeoReport> {
  const budget: Budget = { deadline: Date.now() + limits.budgetMs, fetches: 0 };
  const metas: PartMeta[] = [];
  let cutShort = false;
  const take = <T extends PartMeta>(value: T | null): T | null => {
    if (value) metas.push({ at: value.at, fetches: value.fetches, ms: value.ms });
    else cutShort = true;
    return value;
  };

  // ---- robots, sitemaps, feeds: also the proof that the site answers ---------
  const documentsPart = take(await part(["documents", origin], () => readDocuments(origin, limits, budget)));
  if (!documentsPart) throw new SeoUnreachable();

  // ---- the pages, a part at a time ---------------------------------------------
  const known = await knownPages();
  const pagePaths = known.paths.slice(0, limits.maxPages);
  const pages = new Map<string, PageFacts>();
  for (const group of chunks(pagePaths, PART)) {
    const got = take(await part(["pages", origin, group.join("\n")], () => readPages(origin, group, limits, budget)));
    for (const page of got?.pages ?? []) pages.set(page.path, page);
  }
  const allPagesRead = pages.size === pagePaths.length;

  // ---- what each page says --------------------------------------------------------
  const read = [...pages.values()];
  const okPages = read.filter((p) => p.status === 200);
  // when every page says noindex it is the environment, not the page
  const allNoindex = okPages.length > 0 && okPages.every((p) => p.noindex);
  const findings: SeoPageFinding[] = [];
  const byKind: Partial<Record<SeoIssueKind, number>> = {};
  const linkFrom = new Map<string, Set<string>>();
  const externalLinks = new Map<string, { urls: Set<string>; pages: Set<string> }>();
  let privateSkipped = 0;
  for (const page of read) {
    const issues = pageIssues(page, limits.fetchTimeoutMs);
    // a page the sitemaps list and that asks not to be indexed contradicts itself
    if (page.noindex && !allNoindex && known.inSitemaps.has(page.path)) issues.push({ kind: "noindex-listed", text: "Asks not to be indexed, yet the sitemaps list it." });
    if (issues.length) {
      for (const kind of new Set(issues.map((i) => i.kind))) byKind[kind] = (byKind[kind] ?? 0) + 1;
      findings.push({ path: page.path, status: page.status, titleLength: page.titleLength, descriptionLength: page.descriptionLength, h1: page.h1, issues });
    }
    privateSkipped += page.privateLinks;
    for (const target of page.links) {
      const from = linkFrom.get(target);
      if (from) from.add(page.path);
      else linkFrom.set(target, new Set([page.path]));
    }
    for (const address of page.external) {
      try {
        const host = new URL(address).host;
        const entry = externalLinks.get(host) ?? { urls: new Set<string>(), pages: new Set<string>() };
        entry.urls.add(address);
        entry.pages.add(page.path);
        externalLinks.set(host, entry);
      } catch {
        /* kept as an address when it was read, so this does not happen */
      }
    }
  }
  findings.sort((a, b) => b.issues.length - a.issues.length || (a.path < b.path ? -1 : 1));

  // ---- addresses whose status alone matters -----------------------------------------
  // In a fixed order, so that the parts are the same from one request to the next:
  // the redirects, then what the sitemaps and feeds list, then (once every page
  // has been read and the set is complete) what the pages link to.
  const redirects = redirectRows();
  const queue: string[] = [];
  const queued = new Set<string>();
  const asPage = new Set(pagePaths);
  const want = (path: string) => {
    if (queued.has(path) || isPrivatePath(path) || asPage.has(path)) return;
    queued.add(path);
    queue.push(path);
  };
  for (const r of redirects) {
    want(r.source);
    want(r.destination);
  }
  for (const p of documentsPart.documents.flatMap((d) => d.listed).sort()) want(p);
  if (allPagesRead) for (const p of [...linkFrom.keys()].sort()) want(p);
  const statusPaths = queue.slice(0, limits.maxStatusChecks);
  if (queue.length > statusPaths.length) cutShort = true;

  const statuses = new Map<string, StatusFacts>();
  for (const group of chunks(statusPaths, PART)) {
    const got = take(await part(["status", origin, group.join("\n")], () => readStatuses(origin, group, limits, budget)));
    for (const result of got?.results ?? []) statuses.set(result.path, result);
  }

  /** What is known about an address: its status and where it points, or null when it has not been asked or did not answer. */
  const answer = (path: string): { status: number; location: string | null } | null => {
    const known = pages.get(path) ?? statuses.get(path);
    return known && known.status !== 0 ? { status: known.status, location: known.location } : null;
  };

  // ---- links ---------------------------------------------------------------------------
  const broken: SeoLinkFinding[] = [];
  const redirected: SeoRedirectedLink[] = [];
  let linksChecked = 0;
  let linksUnchecked = 0;
  for (const [path, from] of linkFrom) {
    const got = answer(path);
    if (!got) {
      linksUnchecked++;
      continue;
    }
    linksChecked++;
    const finding = { path, status: got.status, from: [...from].sort().slice(0, FROM_CAP), fromCount: from.size };
    if (got.status === 404 || got.status === 410) broken.push(finding);
    else if (got.status >= 300 && got.status < 400) redirected.push({ ...finding, to: got.location ?? "" });
  }
  const byFrom = (a: SeoLinkFinding, b: SeoLinkFinding) => b.fromCount - a.fromCount || (a.path < b.path ? -1 : 1);
  broken.sort(byFrom);
  redirected.sort(byFrom);

  // ---- documents --------------------------------------------------------------------------
  const documents: SeoDocumentCheck[] = documentsPart.documents.map((d) => {
    const notFound: string[] = [];
    let unchecked = 0;
    for (const p of d.listed) {
      const got = answer(p);
      if (!got) unchecked++;
      else if (got.status === 404 || got.status === 410) notFound.push(p);
    }
    return { path: d.path, kind: d.kind, status: d.status, entries: d.entries, wellFormed: d.wellFormed, problem: d.problem, otherHost: d.otherHost, notFound: notFound.slice(0, 20), notFoundCount: notFound.length, unchecked };
  });

  // ---- redirects ----------------------------------------------------------------------------
  const redirectChecks: SeoRedirectCheck[] = redirects.map((r) => {
    const source = answer(r.source);
    return { source: r.source, sourceStatus: source?.status ?? null, location: source?.location ?? null, targetStatus: answer(r.destination)?.status ?? null };
  });

  const robots = documentsPart.robots.status === 200 ? readRobots(documentsPart.robots.text) : { disallowAll: false, disallow: [], sitemaps: [] };
  const external = [...externalLinks.entries()].map(([host, v]) => ({ host, links: v.urls.size, pages: v.pages.size })).sort((a, b) => b.pages - a.pages || (a.host < b.host ? -1 : 1));
  const noindexPaths = read.filter((p) => p.noindex).map((p) => p.path).sort();
  const times = metas.map((m) => m.at).sort();

  return {
    origin,
    ranAt: times[0] ?? new Date().toISOString(),
    newestAt: times[times.length - 1] ?? new Date().toISOString(),
    fetches: metas.reduce((sum, m) => sum + m.fetches, 0),
    durationMs: metas.reduce((sum, m) => sum + m.ms, 0),
    cutShort: cutShort || !allPagesRead || known.paths.length > pagePaths.length,
    pages: { known: known.paths.length, checked: read.length, clean: read.length - findings.length, findings: findings.slice(0, LIST_CAP), findingCount: findings.length, byKind },
    links: {
      ready: allPagesRead,
      distinct: linkFrom.size,
      checked: linksChecked,
      broken: broken.slice(0, LIST_CAP),
      brokenCount: broken.length,
      redirected: redirected.slice(0, LIST_CAP),
      redirectedCount: redirected.length,
      unchecked: linksUnchecked,
      privateSkipped,
      external: external.slice(0, 100),
      externalHosts: external.length,
    },
    documents,
    redirects: redirectChecks,
    robots: { status: documentsPart.robots.status, text: documentsPart.robots.text, disallowAll: robots.disallowAll, disallow: robots.disallow.slice(0, 40), sitemaps: robots.sitemaps.slice(0, 10) },
    noindex: { count: noindexPaths.length, all: allNoindex, paths: noindexPaths.slice(0, LIST_CAP) },
  };
}

/**
 * The report for this site. `host` is the Host header of the request being
 * answered; nothing else decides where the check goes.
 */
export async function seoReport(host: string | null | undefined): Promise<SeoOutcome> {
  const origin = originFromHost(host);
  if (!origin) return { state: "failed", reason: "no-origin" };
  try {
    return { state: "ok", report: await runSeoCheck(origin) };
  } catch {
    return { state: "failed", reason: "unreachable" };
  }
}

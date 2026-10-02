import Link from "next/link";
import type { ReactNode } from "react";
import { recheckSeo } from "@/app/control/actions-seo";
import type { SeoPostFlag, SeoPosts } from "@/app/control/(console)/seo/posts";
import { ControlHead, Notice } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { Icon, type IconName } from "@/components/control/icons";
import { SubmitButton } from "@/components/control/SubmitButton";
import { SEO_DESCRIPTION_MAX, SEO_DESCRIPTION_MIN, SEO_TITLE_MAX, type SeoDocumentCheck, type SeoIssueKind, type SeoOutcome, type SeoRedirectCheck, type SeoRedirectRow, type SeoReport } from "@/lib/server/seo-check";

export type SeoViewProps = {
  /** the website read from itself, or why it could not be */
  outcome: SeoOutcome;
  /** the blog's published posts, read from the database */
  posts: SeoPosts;
  /** the redirects the site is built with */
  redirects: SeoRedirectRow[];
  /** rendered-at time: says how long ago the check ran */
  now: number;
  notice?: string;
  error?: string;
};

const ISSUE_LABEL: Record<SeoIssueKind, string> = {
  status: "Does not answer 200",
  redirects: "Redirects",
  "title-missing": "No title",
  "title-long": `Title over ${SEO_TITLE_MAX} characters`,
  "description-missing": "No meta description",
  "description-short": `Description under ${SEO_DESCRIPTION_MIN} characters`,
  "description-long": `Description over ${SEO_DESCRIPTION_MAX} characters`,
  "h1-none": "No h1",
  "h1-many": "More than one h1",
  "canonical-missing": "No canonical address",
  "canonical-other": "Canonical points elsewhere",
  "noindex-listed": "Noindex but in a sitemap",
};
const ISSUE_ORDER = Object.keys(ISSUE_LABEL) as SeoIssueKind[];

const POST_LABEL: Record<SeoPostFlag, string> = {
  excerpt: "No excerpt",
  description: "No meta description",
  cover: "No cover",
  alt: "Cover without alt text",
  title: `Title over ${SEO_TITLE_MAX} characters`,
  noindex: "Marked noindex",
  scheduled: "Scheduled",
};
const POST_ORDER = Object.keys(POST_LABEL) as SeoPostFlag[];

const DOCUMENT_KIND: Record<SeoDocumentCheck["kind"], string> = { index: "Sitemap index", sitemap: "Sitemap", feed: "Feed" };

/** How long ago, in words a person would use. */
function ago(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (!Number.isFinite(seconds)) return "at a time that could not be read";
  if (seconds < 45) return "a moment ago";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "about an hour ago" : `about ${hours} hours ago`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A page on the public website, opened in a new tab so the console stays where it is. */
function PageLink({ path, children }: { path: string; children?: ReactNode }) {
  return (
    <a href={path} target="_blank" rel="noopener" className="link num break-all">
      {children ?? path}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** A status in words and a shape, never colour alone. */
function Http({ status }: { status: number | null }) {
  if (status === null) return <span className="state state-off">Not checked</span>;
  if (status === 0) return <span className="state state-pre">No answer</span>;
  const cls = status === 200 ? "state-open" : status >= 300 && status < 400 ? "state-overlap" : "state-pre";
  return (
    <span className={`state ${cls}`}>
      <span className="num">{status}</span>
    </span>
  );
}

function Section({ id, title, badge, lead, children }: { id: string; title: string; badge: ReactNode; lead: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mt-34 scroll-mt-21" data-seo-section={id}>
      <div className="flex flex-wrap items-center justify-between gap-x-13 gap-y-5 border-b border-line pb-8">
        <h2 id={`${id}-h`} className="h4">
          {title}
        </h2>
        {badge}
      </div>
      <div className="mt-8 max-w-measure text-sm text-ink-2">{lead}</div>
      <div className="mt-13 grid gap-13">{children}</div>
    </section>
  );
}

const Findings = ({ n, none = "Nothing found" }: { n: number; none?: string }) => <span className={`state ${n ? "state-pre" : "state-open"}`}>{n ? `${n} to look at` : none}</span>;
const NotChecked = () => <span className="state state-off">Not checked</span>;

function Tally({ items }: { items: { label: string; n: number }[] }) {
  const shown = items.filter((i) => i.n > 0);
  if (!shown.length) return null;
  return (
    <ul className="flex flex-wrap gap-5" aria-label="Findings by kind">
      {shown.map((i) => (
        <li key={i.label} className="chip">
          {i.label} <span className="num text-ink">{i.n}</span>
        </li>
      ))}
    </ul>
  );
}

/** What the redirect table says about one row, in words. */
function redirectVerdict(row: SeoRedirectRow, check: SeoRedirectCheck | undefined): { problem: boolean; text: string } {
  if (row.chainTo) return { problem: true, text: `A chain: ${row.destination} is itself redirected, to ${row.chainTo}. Point this one straight there.` };
  if (!check) return { problem: false, text: "Not checked against the website." };
  if (check.targetStatus === 404 || check.targetStatus === 410) return { problem: true, text: `The destination answers ${check.targetStatus}: the redirect leads nowhere.` };
  if (check.sourceStatus !== null && (check.sourceStatus < 300 || check.sourceStatus >= 400)) return { problem: true, text: `The old address answers ${check.sourceStatus} instead of redirecting.` };
  if (check.sourceStatus !== null && check.location !== null && check.location !== row.destination) return { problem: true, text: `The old address redirects to ${check.location}, not to the destination listed.` };
  if (check.sourceStatus === null || check.targetStatus === null) return { problem: false, text: "Not checked yet." };
  return { problem: false, text: `Works: answers ${check.sourceStatus}, and the destination answers ${check.targetStatus}.` };
}

/**
 * Presentation only. Every figure arrives counted: from the website's own
 * responses (outcome), from the blog's rows (posts) and from the redirects
 * file. When the website could not be read, the sections that depend on it say
 * so; they are never drawn as empty tables that would read as "all clear".
 */
export function SeoView({ outcome, posts, redirects, now, notice, error }: SeoViewProps) {
  const report: SeoReport | null = outcome.state === "ok" ? outcome.report : null;
  const checks = new Map((report?.redirects ?? []).map((c) => [c.source, c]));
  const verdicts = redirects.map((row) => ({ row, check: checks.get(row.source), ...redirectVerdict(row, checks.get(row.source)) }));
  const redirectProblems = verdicts.filter((v) => v.problem).length;
  const documentProblems = report ? report.documents.filter((d) => d.status !== 200 || d.wellFormed === false || d.notFoundCount > 0).length : null;
  const postFindings = posts.state === "ok" ? posts.findings.length : null;
  const unreadPages = report ? report.pages.known - report.pages.checked : 0;

  const tiles: { href: string; label: string; icon: IconName; value: number | null }[] = [
    { href: "#pages", label: "Pages with findings", icon: "documents", value: report ? report.pages.findingCount : null },
    { href: "#posts", label: "Posts with findings", icon: "inbox", value: postFindings },
    { href: "#links", label: "Broken internal links", icon: "events", value: report ? report.links.brokenCount : null },
    { href: "#sitemaps", label: "Sitemap and feed problems", icon: "ledger", value: documentProblems },
    { href: "#redirects", label: "Redirect problems", icon: "pipeline", value: redirectProblems },
    { href: "#robots", label: "Pages sending noindex", icon: "audit", value: report ? report.noindex.count : null },
  ];

  return (
    <>
      <ControlHead
        title="SEO health"
        lead="What the website sends to search engines, read from the website itself, and what the blog’s published posts are missing. Counted from real responses and rows; nothing is estimated."
        actions={
          <form action={recheckSeo}>
            <SubmitButton pending="Checking…" className="btn btn-primary">
              Re-check now
            </SubmitButton>
          </form>
        }
      />

      <div className="mt-21 grid gap-8 empty:hidden">
        {notice && !error && <Notice title={notice} tone="ok" />}
        {error && <Notice title={error} tone="error" />}

        {outcome.state === "failed" && (
          <Notice title={outcome.reason === "no-origin" ? "The website’s own address could not be worked out" : "The website did not answer its own server"} tone="error">
            <p data-seo-failed={outcome.reason}>
              {outcome.reason === "no-origin"
                ? "The check reads the website at the address this page was asked for, and that address was not one it may use. Nothing was fetched."
                : "The check asks the website for its own pages, and no answer came back. On some hosts a server function cannot call its own site; a slow start can also do it. Nothing was kept: “Re-check now” tries again."}
            </p>
            <p className="mt-5">Pages, links, sitemaps, and robots and indexing are left out below rather than shown empty, which would read as “all clear”. The blog’s posts and the list of redirects do not depend on it and are shown.</p>
          </Notice>
        )}

        {report && (
          <div className="panel-quiet px-21 py-13 text-sm text-ink-2" data-seo-run>
            <p>
              Read from <span className="num font-medium text-ink">{report.origin}</span> <span className="font-medium text-ink">{ago(report.ranAt, now)}</span> (<span className="num">{fmtDateTime(report.ranAt)}</span>
              {report.newestAt.slice(0, 16) !== report.ranAt.slice(0, 16) ? (
                <>
                  ; the newest part <span className="num">{fmtDateTime(report.newestAt)}</span>
                </>
              ) : null}
              ): {plural(report.fetches, "request", "requests")} taking <span className="num">{(report.durationMs / 1000).toFixed(1)}</span> seconds in all. What was read is kept for up to ten minutes; “Re-check now” reads the website again from the start.
            </p>
            {report.cutShort && (
              <p className="mt-5 text-ink" data-seo-cut>
                <span className="font-medium">Not everything has been read yet:</span> {unreadPages > 0 ? `${plural(unreadPages, "page", "pages")} to go` : "every page has been read"}
                {report.links.unchecked > 0 ? `, ${plural(report.links.unchecked, "linked address", "linked addresses")} not checked` : ""}. The site is read in parts, so that no single request runs long; what has not been reached is counted as not checked, never as passing.{" "}
                <Link href="/control/seo" className="link font-medium">
                  Continue the check
                </Link>
              </p>
            )}
          </div>
        )}
      </div>

      <ul className="mt-13 grid grid-cols-2 gap-8 sm:grid-cols-3 xl:grid-cols-6" aria-label="Findings by section">
        {tiles.map((tile) => (
          <li key={tile.href} className="grid">
            <a href={tile.href} className="gxc-stat">
              <span className="gxc-stat-icon">
                <Icon name={tile.icon} size={16} />
              </span>
              <span className="gxc-stat-label">{tile.label}</span>
              <span className="gxc-stat-value">{tile.value === null ? "Not checked" : tile.value}</span>
            </a>
          </li>
        ))}
      </ul>

      {/* ---- pages ---------------------------------------------------------- */}
      <Section
        id="pages"
        title="Pages"
        badge={report ? <Findings n={report.pages.findingCount} /> : <NotChecked />}
        lead={
          <>
            Every public route the site knows (the same lists its sitemaps are built from, the blog’s posts, and the gateway pages left out of the sitemaps), fetched and read: a title of about {SEO_TITLE_MAX} characters or fewer, a meta description of about {SEO_DESCRIPTION_MIN} to{" "}
            {SEO_DESCRIPTION_MAX}, exactly one h1, and a canonical address.
          </>
        }
      >
        {report ? (
          <>
            <p className="text-sm text-ink-2" data-seo-pages>
              <span className="num font-medium text-ink">{report.pages.checked}</span> of <span className="num font-medium text-ink">{report.pages.known}</span> pages read; <span className="num font-medium text-ink">{report.pages.clean}</span> with nothing to report.
            </p>
            <Tally items={ISSUE_ORDER.map((kind) => ({ label: ISSUE_LABEL[kind], n: report.pages.byKind[kind] ?? 0 }))} />
            {report.pages.findings.length > 0 && (
              <>
                <div className="scroll-x hidden md:block">
                  <table className="table-gx min-w-[54rem] text-sm">
                    <caption className="sr-only">Pages with something to look at, the ones with most findings first</caption>
                    <thead>
                      <tr>
                        <th scope="col">Page</th>
                        <th scope="col">HTTP</th>
                        <th scope="col">Title</th>
                        <th scope="col">Description</th>
                        <th scope="col">h1</th>
                        <th scope="col">What to look at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.pages.findings.map((f) => (
                        <tr key={f.path}>
                          <td className="max-w-[16rem] py-8">
                            <PageLink path={f.path} />
                          </td>
                          <td>
                            <Http status={f.status} />
                          </td>
                          <td className="num whitespace-nowrap text-ink-2">{f.titleLength === null ? "–" : f.titleLength}</td>
                          <td className="num whitespace-nowrap text-ink-2">{f.descriptionLength === null ? "–" : f.descriptionLength}</td>
                          <td className="num whitespace-nowrap text-ink-2">{f.h1 === null ? "–" : f.h1}</td>
                          <td className="max-w-[26rem] py-8 text-xs text-ink-2">
                            <ul className="grid gap-3">
                              {f.issues.map((i) => (
                                <li key={i.kind}>{i.text}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="md:hidden" aria-label="Pages with something to look at">
                  {report.pages.findings.map((f) => (
                    <li key={f.path} className="border-b border-line py-13">
                      <p className="text-sm font-medium">
                        <PageLink path={f.path} />
                      </p>
                      <p className="mt-5 flex flex-wrap items-center gap-x-13 gap-y-3 text-xs text-ink-3">
                        <Http status={f.status} />
                        {f.titleLength !== null && <span className="num">Title {f.titleLength}</span>}
                        {f.descriptionLength !== null && <span className="num">Description {f.descriptionLength}</span>}
                        {f.h1 !== null && <span className="num">h1 × {f.h1}</span>}
                      </p>
                      <ul className="mt-5 grid gap-3 text-xs text-ink-2">
                        {f.issues.map((i) => (
                          <li key={i.kind}>{i.text}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                {report.pages.findingCount > report.pages.findings.length && (
                  <p className="text-xs text-ink-3">
                    The {report.pages.findings.length} pages with most findings are listed, of {report.pages.findingCount}.
                  </p>
                )}
                <p className="text-xs text-ink-3">A page’s title and description are written in its own source file, so they are changed by a developer and a deploy. A blog post’s are changed in its editor: see Blog posts below.</p>
              </>
            )}
            {report.pages.findings.length === 0 && report.pages.checked > 0 && <AllClear>Every page that was read has a title and a description of a sensible length, one h1 and a canonical address.</AllClear>}
          </>
        ) : (
          <Skipped />
        )}
      </Section>

      {/* ---- blog posts ----------------------------------------------------- */}
      <Section
        id="posts"
        title="Blog posts"
        badge={posts.state === "ok" ? <Findings n={posts.findings.length} /> : <NotChecked />}
        lead="Published posts, read from the database: a missing excerpt, meta description, cover or alt text, a title too long for a search result, posts marked noindex, and posts scheduled for later. Each opens in its editor."
      >
        {posts.state === "failed" ? (
          <Notice title="The posts could not be read" tone="error">
            The database did not answer. Reload the page.
          </Notice>
        ) : (
          <>
            <p className="text-sm text-ink-2" data-seo-posts>
              <span className="num font-medium text-ink">{posts.published}</span> published {posts.published === 1 ? "post" : "posts"} read{posts.truncated ? " (the newest; there are more)" : ""}; <span className="num font-medium text-ink">{posts.findings.length}</span> with something to look at.
            </p>
            <Tally items={POST_ORDER.map((kind) => ({ label: POST_LABEL[kind], n: posts.byKind[kind] ?? 0 }))} />
            {posts.findings.length > 0 ? (
              <ul className="border-t border-line" aria-label="Published posts with something to look at, newest first">
                {posts.findings.map((p) => (
                  <li key={p.id} className="grid gap-5 border-b border-line py-13 md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)] md:gap-21">
                    <div className="min-w-0">
                      <Link href={`/control/blog/${p.id}`} className="link break-words text-sm font-medium">
                        {p.title}
                      </Link>
                      <p className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-ink-3">
                        <span className={`state ${p.state === "live" ? "state-open" : "state-overlap"}`}>{p.state === "live" ? "Published" : "Scheduled for"}</span>
                        <span className="num">{fmtDateTime(p.publishedAt)}</span>
                      </p>
                    </div>
                    <ul className="grid content-start gap-3 text-xs text-ink-2">
                      {p.flags.map((flag) => (
                        <li key={flag.kind}>{flag.text}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : posts.published === 0 ? (
              <p className="border-y border-line py-13 text-sm text-ink-3">No post is published yet, so there is nothing to check.</p>
            ) : (
              <AllClear>Every published post has an excerpt, a meta description, a described cover and a title that fits a search result; none is marked noindex or waiting for its time.</AllClear>
            )}
          </>
        )}
      </Section>

      {/* ---- internal links ------------------------------------------------- */}
      <Section
        id="links"
        title="Internal links"
        badge={report ? report.links.brokenCount === 0 && !report.links.ready ? <span className="state state-off">Not finished</span> : <Findings n={report.links.brokenCount} none="None broken" /> : <NotChecked />}
        lead="Every link to this site found in the pages that were read, each distinct address asked for once. An address that answers 404 is a broken link. Links to other sites are counted by host and are not fetched."
      >
        {report ? (
          <>
            <p className="text-sm text-ink-2" data-seo-links>
              <span className="num font-medium text-ink">{report.links.distinct}</span> distinct internal addresses linked; <span className="num font-medium text-ink">{report.links.checked}</span> checked, <span className="num font-medium text-ink">{report.links.brokenCount}</span> broken
              {report.links.unchecked > 0 ? `, ${report.links.unchecked} not checked yet` : ""}
              {report.links.privateSkipped > 0 ? `. ${plural(report.links.privateSkipped, "link", "links")} to the console or the API are never fetched` : ""}.
            </p>
            {!report.links.ready && (
              <p className="text-sm text-ink-2" data-seo-links-waiting>
                Links to addresses that are not pages in their own right are checked once every page has been read, so that each is asked for once. Until then this counts only links to pages already read.
              </p>
            )}
            {report.links.broken.length > 0 ? (
              <ul className="border-t border-line" aria-label="Internal links that answer 404">
                {report.links.broken.map((l) => (
                  <li key={l.path} className="grid gap-5 border-b border-line py-13 md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)] md:gap-21">
                    <div className="min-w-0">
                      <p className="num break-all text-sm font-medium text-ink">{l.path}</p>
                      <p className="mt-3">
                        <Http status={l.status} />
                      </p>
                    </div>
                    <div className="min-w-0 text-xs text-ink-2">
                      <p className="text-ink-3">Linked from {plural(l.fromCount, "page", "pages")}:</p>
                      <ul className="mt-3 grid gap-3">
                        {l.from.map((from) => (
                          <li key={from}>
                            <PageLink path={from} />
                          </li>
                        ))}
                        {l.fromCount > l.from.length && <li className="text-ink-3">and {l.fromCount - l.from.length} more</li>}
                      </ul>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              report.links.checked > 0 && report.links.unchecked === 0 && <AllClear>No internal link answers 404.</AllClear>
            )}

            {report.links.redirectedCount > 0 && (
              <details className="rounded-md border border-line bg-surface px-13 py-8 text-sm">
                <summary className="cursor-pointer text-ink">
                  {plural(report.links.redirectedCount, "linked address answers", "linked addresses answer")} with a redirect
                  <span className="text-ink-3"> (they work; a link straight to the destination saves the reader a step)</span>
                </summary>
                <ul className="mt-8 grid gap-5 text-xs text-ink-2">
                  {report.links.redirected.map((l) => (
                    <li key={l.path} className="min-w-0 break-all">
                      <span className="num text-ink">{l.path}</span> → <span className="num">{l.to || "an address it does not name"}</span>
                      <span className="text-ink-3">
                        {" "}
                        · from {l.from.join(", ")}
                        {l.fromCount > l.from.length ? ` and ${l.fromCount - l.from.length} more` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <details className="rounded-md border border-line bg-surface px-13 py-8 text-sm">
              <summary className="cursor-pointer text-ink">
                Links to other sites: {plural(report.links.externalHosts, "host", "hosts")} <span className="text-ink-3">(counted, not fetched)</span>
              </summary>
              {report.links.external.length > 0 ? (
                <ul className="mt-8 grid gap-3 text-xs text-ink-2">
                  {report.links.external.map((e) => (
                    <li key={e.host} className="flex flex-wrap justify-between gap-x-13 border-b border-line py-3">
                      <span className="num break-all text-ink">{e.host}</span>
                      <span className="num text-ink-3">
                        {plural(e.links, "address", "addresses")} on {plural(e.pages, "page", "pages")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-8 text-xs text-ink-3">No page that was read links to another site.</p>
              )}
            </details>
          </>
        ) : (
          <Skipped />
        )}
      </Section>

      {/* ---- sitemaps and feeds --------------------------------------------- */}
      <Section
        id="sitemaps"
        title="Sitemaps and feeds"
        badge={documentProblems === null ? <NotChecked /> : <Findings n={documentProblems} />}
        lead="The sitemap index, each sitemap it names and the two feeds: whether each answers, how much it lists, whether its tags balance, and whether anything it lists answers 404."
      >
        {report ? (
          <>
            <div className="scroll-x hidden md:block">
              <table className="table-gx min-w-[50rem] text-sm">
                <caption className="sr-only">Sitemaps and feeds as the website serves them</caption>
                <thead>
                  <tr>
                    <th scope="col">Document</th>
                    <th scope="col">Kind</th>
                    <th scope="col">HTTP</th>
                    <th scope="col">Lists</th>
                    <th scope="col">Well formed</th>
                    <th scope="col">Listed addresses that answer 404</th>
                  </tr>
                </thead>
                <tbody>
                  {report.documents.map((d) => (
                    <tr key={d.path}>
                      <td className="py-8">
                        <PageLink path={d.path} />
                      </td>
                      <td className="whitespace-nowrap text-ink-2">{DOCUMENT_KIND[d.kind]}</td>
                      <td>
                        <Http status={d.status} />
                      </td>
                      <td className="num whitespace-nowrap text-ink-2">{d.entries === null ? "–" : d.entries}</td>
                      <td className="max-w-[16rem] py-8 text-xs text-ink-2">
                        <WellFormed doc={d} />
                      </td>
                      <td className="max-w-[18rem] py-8 text-xs text-ink-2">
                        <Missing doc={d} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden" aria-label="Sitemaps and feeds as the website serves them">
              {report.documents.map((d) => (
                <li key={d.path} className="border-b border-line py-13">
                  <p className="text-sm font-medium">
                    <PageLink path={d.path} />
                  </p>
                  <p className="mt-5 flex flex-wrap items-center gap-x-13 gap-y-3 text-xs text-ink-3">
                    <span>{DOCUMENT_KIND[d.kind]}</span>
                    <Http status={d.status} />
                    {d.entries !== null && <span className="num">Lists {d.entries}</span>}
                  </p>
                  <div className="mt-5 grid gap-3 text-xs text-ink-2">
                    <WellFormed doc={d} />
                    <Missing doc={d} />
                  </div>
                </li>
              ))}
            </ul>
            {report.documents.some((d) => d.otherHost) && (
              <p className="text-xs text-ink-3" data-seo-other-host>
                The addresses in these documents are written with the site’s public name (<span className="num">{report.documents.find((d) => d.otherHost)?.otherHost}</span>), which is what a search engine should be given. Each was checked at the address this console is running on.
              </p>
            )}
          </>
        ) : (
          <Skipped />
        )}
      </Section>

      {/* ---- redirects ------------------------------------------------------ */}
      <Section
        id="redirects"
        title="Redirects"
        badge={!report && redirectProblems === 0 ? <span className="state state-off">Not checked against the website</span> : <Findings n={redirectProblems} />}
        lead={
          <>
            Old addresses that send a reader to a current page. They are part of the code (<span className="num">src/config/redirects.json</span>, read when the site is built) and change with a deploy: this table is read-only. A redirects manager kept in the database would need the website to ask the
            database on every request; that is not built.
          </>
        }
      >
        {redirects.length ? (
          <>
            <div className="scroll-x hidden md:block">
              <table className="table-gx min-w-[50rem] text-sm">
                <caption className="sr-only">The redirects the site is built with</caption>
                <thead>
                  <tr>
                    <th scope="col">From</th>
                    <th scope="col">To</th>
                    <th scope="col">Permanent</th>
                    <th scope="col">Check</th>
                  </tr>
                </thead>
                <tbody>
                  {verdicts.map((v) => (
                    <tr key={v.row.source}>
                      <td className="num max-w-[14rem] break-all py-8 text-ink">{v.row.source}</td>
                      <td className="max-w-[14rem] py-8">
                        <PageLink path={v.row.destination} />
                      </td>
                      <td className="whitespace-nowrap text-ink-2">Yes (308)</td>
                      <td className="max-w-[24rem] py-8 text-xs">
                        <span className={v.problem ? "font-medium text-ink" : "text-ink-2"}>
                          {v.problem ? "Look at this: " : ""}
                          {v.text}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden" aria-label="The redirects the site is built with">
              {verdicts.map((v) => (
                <li key={v.row.source} className="border-b border-line py-13 text-sm">
                  <p className="num break-all text-ink">
                    {v.row.source} <span aria-hidden>→</span>
                    <span className="sr-only"> redirects to </span> <PageLink path={v.row.destination} />
                  </p>
                  <p className={`mt-3 text-xs ${v.problem ? "font-medium text-ink" : "text-ink-2"}`}>
                    {v.problem ? "Look at this: " : ""}
                    {v.text}
                  </p>
                </li>
              ))}
            </ul>
            {!report && <p className="text-xs text-ink-3">The website could not be read, so only what the file itself shows (a chain) is checked here.</p>}
          </>
        ) : (
          <p className="border-y border-line py-13 text-sm text-ink-3">The site has no redirects.</p>
        )}
      </Section>

      {/* ---- robots and indexing --------------------------------------------- */}
      <Section
        id="robots"
        title="Robots and indexing"
        badge={report ? <span className={`state ${report.noindex.count || report.robots.disallowAll || report.robots.status !== 200 ? "state-pre" : "state-open"}`}>{report.robots.disallowAll ? "Crawlers turned away" : `${report.noindex.count} noindex`}</span> : <NotChecked />}
        lead="What robots.txt tells crawlers, and which of the pages that were read ask not to be indexed (by a robots meta tag or an X-Robots-Tag header)."
      >
        {report ? (
          <>
            <div className="grid gap-13 lg:grid-cols-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-8 text-sm text-ink">
                  <PageLink path="/robots.txt" /> <Http status={report.robots.status} />
                </p>
                {report.robots.status === 200 ? (
                  <pre className="mt-8 max-h-[16rem] overflow-auto whitespace-pre-wrap break-all rounded-md border border-line bg-surface-2 p-13 font-mono text-xs text-ink-2" data-seo-robots>
                    {report.robots.text.trim() || "(empty)"}
                  </pre>
                ) : (
                  <p className="mt-8 text-sm text-ink-2">robots.txt could not be read.</p>
                )}
              </div>
              <div className="min-w-0 text-sm text-ink-2">
                {report.robots.status === 200 &&
                  (report.robots.disallowAll ? (
                    <Notice title="robots.txt turns every crawler away from the whole site">
                      That is what every copy of the site except the production one does (<span className="num">NEXT_PUBLIC_SITE_ENV</span> is not “production” here). On the production site it would be a fault.
                    </Notice>
                  ) : (
                    <p>
                      Crawlers may read the site
                      {report.robots.disallow.length ? (
                        <>
                          {" "}
                          except: <span className="num break-all">{report.robots.disallow.join(", ")}</span>
                        </>
                      ) : null}
                      . {report.robots.sitemaps.length ? `It names ${plural(report.robots.sitemaps.length, "sitemap", "sitemaps")}.` : "It names no sitemap."}
                    </p>
                  ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink">Pages that ask not to be indexed</h3>
              {report.noindex.count === 0 ? (
                <p className="mt-5 text-sm text-ink-2">None of the pages that were read sends noindex.</p>
              ) : report.noindex.all ? (
                <p className="mt-5 max-w-measure text-sm text-ink-2" data-seo-noindex="all">
                  All {report.noindex.count} pages that were read send noindex. That is the whole site declining to be indexed, as every copy except the production one does; it is not a fault of any one page.
                </p>
              ) : (
                <>
                  <p className="mt-5 max-w-measure text-sm text-ink-2" data-seo-noindex="some">
                    {plural(report.noindex.count, "page sends", "pages send")} noindex. Gateways and utilities (search, preferences, sign-in, open account) are meant to. A page that is also in a sitemap is listed under Pages as a finding.
                  </p>
                  <ul className="mt-8 flex flex-wrap gap-x-21 gap-y-5 text-xs">
                    {report.noindex.paths.map((path) => (
                      <li key={path}>
                        <PageLink path={path} />
                      </li>
                    ))}
                    {report.noindex.count > report.noindex.paths.length && <li className="text-ink-3">and {report.noindex.count - report.noindex.paths.length} more</li>}
                  </ul>
                </>
              )}
            </div>
          </>
        ) : (
          <Skipped />
        )}
      </Section>

      <p className="mt-34 max-w-measure border-t border-line pt-13 text-xs text-ink-3">
        How the check works: it sends ordinary, anonymous GET requests to this website’s own address, a few at a time, with a time limit on each and on the whole run. It never asks for the console or the API, sends no cookie or key, and follows no redirect off the site. It reads what a
        visitor’s browser would be sent; it cannot see how a search engine ranks anything.
      </p>
    </>
  );
}

function AllClear({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-8 border-y border-line py-13 text-sm text-ink-2" data-seo-clear>
      <span className="state state-open mt-[0.2rem] shrink-0">Clear</span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** In place of a section that needs the website's pages when they could not be read. */
function Skipped() {
  return (
    <p className="border-y border-line py-13 text-sm text-ink-3" data-seo-skipped>
      Not checked: the website could not be read. See the notice at the top of this page.
    </p>
  );
}

function WellFormed({ doc }: { doc: SeoDocumentCheck }) {
  if (doc.wellFormed === null) return <span className="text-ink-3">{doc.problem || "Not read."}</span>;
  return (
    <span>
      {doc.wellFormed ? "Yes: its tags balance." : "No."}
      {doc.problem ? ` ${doc.problem}` : ""}
    </span>
  );
}

function Missing({ doc }: { doc: SeoDocumentCheck }) {
  if (doc.kind === "index") return <span className="text-ink-3">Its sitemaps are the rows below.</span>;
  if (doc.entries === null) return <span className="text-ink-3">–</span>;
  return (
    <div>
      {doc.notFoundCount === 0 ? (
        <span>None{doc.unchecked > 0 ? ` of those checked (${doc.unchecked} not checked yet)` : ""}.</span>
      ) : (
        <>
          <span className="font-medium text-ink">
            {doc.notFoundCount}
            {doc.unchecked > 0 ? ` (${doc.unchecked} more not checked)` : ""}:
          </span>
          <ul className="mt-3 grid gap-3">
            {doc.notFound.map((p) => (
              <li key={p} className="num break-all">
                {p}
              </li>
            ))}
            {doc.notFoundCount > doc.notFound.length && <li className="text-ink-3">and {doc.notFoundCount - doc.notFound.length} more</li>}
          </ul>
        </>
      )}
    </div>
  );
}

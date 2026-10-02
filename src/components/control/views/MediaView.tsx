import Link from "next/link";
import { ControlHead, Empty, Notice, Pager } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { Icon, type IconName } from "@/components/control/icons";
import { CopyButtons, MediaUpload } from "@/components/control/MediaBits";
import { fmtBytes, fmtImageType, fmtMonth, type MediaTab, type MediaUseFilter } from "@/components/control/media-shared";
import { BLOG_STATUS_LABEL } from "@/lib/blog";
import type { MediaItem, MediaUse, MediaUseKind } from "@/lib/server/media";
import type { SiteImage } from "@/lib/site-images";

/** One picture as the grid shows it. */
export type MediaCard = MediaItem & {
  /** its public address, or null when the project's storage address is not known */
  url: string | null;
  /** where it is used; null when the posts could not be read, so that "not used" is never guessed */
  uses: MediaUse[] | null;
};

export type MediaViewProps = {
  tab: MediaTab;
  /** whether the bucket could be listed */
  listed: boolean;
  /** this page of pictures, newest first, after the filters */
  cards: MediaCard[];
  /** counted from the whole listing (within the chosen month); used and unused are null when usage is not known */
  counts: { all: number; used: number | null; unused: number | null };
  /** the months that hold pictures, newest first ("2026-10") */
  months: string[];
  use: MediaUseFilter;
  /** "" is every month */
  month: string;
  total: number;
  page: number;
  pageCount: number;
  pastEnd: boolean;
  /** may add a picture (blog.write) */
  canUpload: boolean;
  /** the walk of the bucket stopped at its bound: older pictures are not listed */
  listingTruncated: boolean;
  /** "ok", or why a picture's use cannot be stated for certain */
  usage: "ok" | "failed" | "partial";
  siteImages: readonly SiteImage[];
};

const USE_WORDS: Record<MediaUseKind, string> = { cover: "Cover of", share: "Share picture of", body: "In the body of" };

const TILES: { key: MediaUseFilter; label: string; icon: IconName }[] = [
  { key: "all", label: "All pictures", icon: "documents" },
  { key: "used", label: "Used in a post", icon: "reports" },
  { key: "unused", label: "Not used", icon: "inbox" },
];

const tabClass = (current: boolean) =>
  `flex h-[2.75rem] items-center border-b-2 px-13 text-sm transition-colors duration-fast ${current ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"}`;

/** Presentation only. The page read the bucket and the posts as the signed-in user and validated every filter. */
export function MediaView(props: MediaViewProps) {
  const { tab, canUpload } = props;
  return (
    <>
      <ControlHead
        title="Media"
        lead={
          tab === "library"
            ? "Every picture in the blog’s picture store, the newest first, and the posts that use each one."
            : "The pictures that are part of the website’s own code: logos, icons and platform screenshots."
        }
        actions={tab === "library" && canUpload ? <MediaUpload /> : undefined}
      />

      <div className="mt-21 border-b border-line">
        <nav aria-label="Which pictures" className="flex flex-wrap">
          <Link href="/control/media" aria-current={tab === "library" ? "page" : undefined} className={tabClass(tab === "library")}>
            Blog pictures
          </Link>
          <Link href="/control/media?tab=site" aria-current={tab === "site" ? "page" : undefined} className={tabClass(tab === "site")}>
            Site images
          </Link>
        </nav>
      </div>

      {tab === "library" ? <Library {...props} /> : <SiteImages images={props.siteImages} />}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* the blog's picture store                                                   */
/* -------------------------------------------------------------------------- */

function Library({ listed, cards, counts, months, use, month, total, page, pageCount, pastEnd, canUpload, listingTruncated, usage }: MediaViewProps) {
  const href = (next: { use?: MediaUseFilter; month?: string; page?: number }) => {
    const sp = new URLSearchParams();
    const u = next.use ?? use;
    const m = next.month ?? month;
    if (u !== "all") sp.set("use", u);
    if (m) sp.set("month", m);
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    const query = sp.toString();
    return query ? `/control/media?${query}` : "/control/media";
  };
  const filtered = use !== "all" || month !== "";

  if (!listed) {
    return (
      <div className="mt-21">
        <Notice title="The picture store could not be read" tone="error">
          Storage did not answer, or the blog’s migration (0011) has not been applied. Reload the page.
        </Notice>
      </div>
    );
  }

  return (
    <>
      <p className="mt-13 max-w-measure text-xs text-ink-3" data-no-delete>
        A picture cannot be deleted here. No role has that right through the console or the API, on purpose: a deleted picture would leave a hole in every published post that shows it. Uploading never replaces a picture either; each upload gets a new path.
      </p>

      <div className="mt-13 grid gap-8 empty:hidden">
        {usage === "failed" && (
          <Notice title="The posts could not be read" tone="error">
            So this page cannot say which pictures are used. Nothing is shown as “not used”, and the used and not-used filters are switched off until the posts can be read.
          </Notice>
        )}
        {usage === "partial" && <Notice title="Only the most recently changed posts were read">There are more posts than this page reads at once. A picture shown as not used may still be used by an older post: check before treating it as spare.</Notice>}
        {listingTruncated && <Notice title="Only the newest pictures are listed">The store holds more pictures than this page lists at once. The oldest are left out, and the figures below count only what is listed.</Notice>}
      </div>

      <ul className="mt-13 grid grid-cols-1 gap-8 sm:grid-cols-3" aria-label="Pictures by use">
        {TILES.map((tile) => {
          const value = counts[tile.key];
          const inner = (
            <>
              <span className="gxc-stat-icon">
                <Icon name={tile.icon} size={16} />
              </span>
              <span className="gxc-stat-label">
                {tile.label}
                {month ? ` in ${fmtMonth(month)}` : ""}
              </span>
              <span className="gxc-stat-value">{value === null ? "Not known" : value}</span>
            </>
          );
          return (
            <li key={tile.key} className="grid">
              {value === null ? (
                <div className="gxc-stat">{inner}</div>
              ) : (
                <Link href={href({ use: tile.key, page: 1 })} className="gxc-stat" aria-current={use === tile.key ? "page" : undefined}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <form method="get" action="/control/media" role="search" aria-label="Filter pictures" className="mt-21 grid gap-13 border-b border-line pb-21 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div className="field">
          <label htmlFor="media-month">Month uploaded</label>
          <select id="media-month" name="month" className="select" defaultValue={month}>
            <option value="">Every month</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {fmtMonth(m)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="media-use">Use</label>
          <select id="media-use" name="use" className="select" defaultValue={use}>
            <option value="all">All pictures</option>
            <option value="used" disabled={usage === "failed"}>
              Used in a post
            </option>
            <option value="unused" disabled={usage === "failed"}>
              Not used
            </option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-8">
          <button type="submit" className="btn btn-primary">
            Apply
          </button>
          {filtered && (
            <Link href="/control/media" className="btn btn-quiet">
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="mt-13">
        {cards.length ? (
          <ul className="grid gap-13 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label={filtered ? "Pictures matching the filters, newest first" : "Every picture, newest first"} data-media-grid>
            {cards.map((card) => (
              <li key={card.path} className="grid min-w-0">
                <PictureCard card={card} />
              </li>
            ))}
          </ul>
        ) : pastEnd ? (
          <Empty title="There is no such page">
            <p>
              <Link href={href({ page: 1 })} className="link">
                Go to the first page
              </Link>
            </p>
          </Empty>
        ) : filtered ? (
          <Empty title="No picture matches these filters">
            <p>
              Try another month or use, or{" "}
              <Link href="/control/media" className="link">
                see every picture
              </Link>
              .
            </p>
          </Empty>
        ) : (
          <Empty title="No picture has been uploaded yet">
            <p>{canUpload ? "Upload one with the button above, or from a post’s editor. It will be listed here." : "Pictures are uploaded by people whose role can write posts. Yours can read them."}</p>
          </Empty>
        )}
      </div>

      {!pastEnd && total > 0 && <Pager page={page} pageCount={pageCount} total={total} noun={total === 1 ? "picture" : "pictures"} href={(p) => href({ page: p })} />}
    </>
  );
}

function PictureCard({ card }: { card: MediaCard }) {
  const used = card.uses !== null && card.uses.length > 0;
  return (
    <article className="gxc-card flex min-w-0 flex-col" data-media-card={card.path}>
      {card.url ? (
        // the card's corners are 16px: the picture follows them, one pixel inside the border
        <a href={card.url} target="_blank" rel="noopener" className="block rounded-t-[15px]">
          <img src={card.url} alt={`Picture ${card.name}`} loading="lazy" decoding="async" className="aspect-[1.618/1] w-full rounded-t-[15px] bg-surface-2 object-cover" />
          <span className="sr-only"> (opens the picture in a new tab)</span>
        </a>
      ) : (
        <div className="grid aspect-[1.618/1] w-full place-items-center rounded-t-[15px] bg-surface-2 p-13 text-center text-xs text-ink-3">No preview: the storage address is not configured</div>
      )}
      <div className="gxc-card-body flex flex-1 flex-col gap-8 pt-13">
        <div className="min-w-0">
          <h2 className="num break-all text-sm font-medium text-ink">{card.name}</h2>
          <p className="num mt-3 select-all break-all text-xs text-ink-3" data-media-path>
            {card.path}
          </p>
        </div>
        <p className="flex flex-wrap gap-x-13 gap-y-3 text-xs text-ink-2">
          <span>{fmtImageType(card.type)}</span>
          <span className="num">{fmtBytes(card.size)}</span>
          <span className="num">{card.uploadedAt ? `Uploaded ${fmtDateTime(card.uploadedAt)}` : "Upload time not known"}</span>
        </p>

        <div className="border-t border-line pt-8" data-media-use>
          {card.uses === null ? (
            <p className="text-xs text-ink-3">Where it is used could not be read.</p>
          ) : used ? (
            <>
              <span className="state state-open">Used</span>
              <ul className="mt-5 grid gap-3 text-xs text-ink-2">
                {card.uses.map((use) => (
                  <li key={`${use.postId}:${use.as}`} className="min-w-0 break-words">
                    {USE_WORDS[use.as]}{" "}
                    <Link href={`/control/blog/${use.postId}`} className="link">
                      {use.title}
                    </Link>{" "}
                    <span className="text-ink-3">({BLOG_STATUS_LABEL[use.status].toLowerCase()})</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <span className="state state-off">Not used</span>
              <p className="mt-5 text-xs text-ink-3">No post has it as a cover, a share picture or in its body.</p>
            </>
          )}
        </div>

        <div className="mt-auto pt-5">
          <CopyButtons path={card.path} />
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* the pictures shipped with the site                                         */
/* -------------------------------------------------------------------------- */

const HOW_WORDS: Record<string, string> = { path: "names it", parts: "builds its address" };

function Refs({ image }: { image: SiteImage }) {
  if (!image.refs.length) return <span className="text-ink-3">No reference found in the source</span>;
  return (
    <ul className="grid gap-3">
      {image.refs.map((ref) => (
        <li key={ref.file} className="min-w-0 break-all">
          <span className="num">{ref.file}</span> <span className="text-ink-3">({HOW_WORDS[ref.how] ?? ref.how})</span>
        </li>
      ))}
    </ul>
  );
}

const dimensions = (image: SiteImage) => (image.width && image.height ? `${image.width} × ${image.height}` : "Not read");

function Thumb({ image }: { image: SiteImage }) {
  return <img src={image.path} alt="" loading="lazy" decoding="async" width={image.width ?? undefined} height={image.height ?? undefined} className="h-[3.4375rem] w-[5.5625rem] rounded-sm border border-line bg-surface-2 object-contain p-3" />;
}

function SiteImages({ images }: { images: readonly SiteImage[] }) {
  const bytes = images.reduce((sum, i) => sum + i.bytes, 0);
  const caption = "Every picture under public/, in order of address";
  return (
    <>
      <div className="mt-13">
        <Notice title="These pictures are part of the code">
          They live in the website’s <span className="num">public/</span> folder and are changed by a developer and a deploy, not here. This list is made when the site is built (<span className="num">scripts/site-images.mjs</span>), so it shows the pictures of the version that is running. Nothing on this tab can be uploaded, replaced or removed.
        </Notice>
      </div>

      {images.length ? (
        <>
          <p className="mt-13 text-sm text-ink-2" data-site-total>
            <span className="num font-medium text-ink">{images.length}</span> {images.length === 1 ? "picture" : "pictures"}, <span className="num font-medium text-ink">{fmtBytes(bytes)}</span> in all.
          </p>

          <div className="scroll-x mt-13 hidden md:block">
            <table className="table-gx min-w-[54rem] text-sm">
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Picture</span>
                  </th>
                  <th scope="col">Address</th>
                  <th scope="col">Type</th>
                  <th scope="col">Pixels</th>
                  <th scope="col">Size</th>
                  <th scope="col">Referenced in</th>
                </tr>
              </thead>
              <tbody>
                {images.map((image) => (
                  <tr key={image.path}>
                    <td className="py-8">
                      <Thumb image={image} />
                    </td>
                    <td className="max-w-[18rem]">
                      <a href={image.path} target="_blank" rel="noopener" className="link num break-all">
                        {image.path}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{fmtImageType(image.type)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{dimensions(image)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtBytes(image.bytes)}</td>
                    <td className="max-w-[22rem] py-8 text-xs text-ink-2">
                      <Refs image={image} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-13 md:hidden" aria-label={caption}>
            {images.map((image) => (
              <li key={image.path} className="grid grid-cols-[auto_minmax(0,1fr)] gap-13 border-b border-line py-13">
                <Thumb image={image} />
                <div className="min-w-0">
                  <a href={image.path} target="_blank" rel="noopener" className="num block break-all text-sm font-medium text-accent">
                    {image.path}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  <p className="mt-3 flex flex-wrap gap-x-13 text-xs text-ink-2">
                    <span>{fmtImageType(image.type)}</span>
                    <span className="num">{dimensions(image)}</span>
                    <span className="num">{fmtBytes(image.bytes)}</span>
                  </p>
                  <div className="mt-5 text-xs text-ink-2">
                    <Refs image={image} />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-13 max-w-measure text-xs text-ink-3">
            “Referenced in” is found by reading the source when the site is built: a file that names the picture’s address, or one that builds addresses in the picture’s folder from a name. A picture with no reference found may still be used, by an address put together some other
            way.
          </p>
        </>
      ) : (
        <Empty title="The list of site images is empty">
          <p>
            The build did not find any picture under <span className="num">public/</span>.
          </p>
        </Empty>
      )}
    </>
  );
}

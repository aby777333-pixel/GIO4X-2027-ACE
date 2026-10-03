import Link from "next/link";

/**
 * THE OPEN DOOR — a strong-room door that swings open as it scrolls into view,
 * with the ledger behind it: how many items GIO4X has published and how many
 * it has not.
 *
 * The door stands for the books being open, and for nothing else. It is on
 * the transparency page for that reason, and deliberately not on the client
 * funds page: a vault there would suggest something about the safety of
 * client money that GIO4X has not published and this site does not claim.
 * What is behind the door is the same count the page gives, the unpublished
 * part included.
 *
 * All CSS (styles/fx.css): the leaves turn on a view timeline. Where view
 * timelines are missing, under reduced motion, under low visual effects and
 * on paper the door is simply open. The leaves are decoration and are hidden
 * from assistive technology; the count is ordinary text.
 */
export function OpenDoor({ published, pending }: { published: number; pending: number }) {
  return (
    <section className="section-quiet hairline" aria-labelledby="door-h">
      <div className="wrap">
        <div className="gx-door on-night">
          <div className="gx-door-inside">
            <p className="eyebrow">Behind the door</p>
            <h2 id="door-h" className="h2 mt-13 max-w-[18ch]">
              The books, open. The gaps, shown.
            </h2>
            <dl className="mt-21 flex flex-wrap gap-x-55 gap-y-13">
              <div>
                <dd className="num font-display text-4xl text-on-night">{published}</dd>
                <dt className="label mt-3">Published</dt>
              </div>
              <div>
                <dd className="num font-display text-4xl text-on-night-2">{pending}</dd>
                <dt className="label mt-3">Not yet published</dt>
              </div>
            </dl>
            <p className="mt-21 max-w-measure text-sm text-on-night-2">Both numbers are counted from the table below. An item that has not been published is listed as exactly that.</p>
            <Link href="#ledger" className="go mt-13">
              Read the table
            </Link>
          </div>
          <div className="gx-door-leaf gx-door-l" aria-hidden>
            <span className="gx-door-bolts" />
          </div>
          <div className="gx-door-leaf gx-door-r" aria-hidden>
            <span className="gx-door-wheel" />
            <span className="gx-door-bolts" />
          </div>
        </div>
      </div>
    </section>
  );
}

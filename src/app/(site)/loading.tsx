/**
 * What is shown while a page is being fetched: the mark, turning slowly, and
 * a line that fills. It says nothing that is not true (no percentage, no
 * promise of how long), and under reduced motion it is the mark, still.
 */
export default function Loading() {
  return (
    <div className="gx-loading" role="status" aria-live="polite">
      <svg viewBox="0 0 48 48" className="gx-loading-mark" aria-hidden>
        <circle cx="24" cy="24" r="20" />
        <path d="M24 4a20 20 0 0 1 20 20" />
      </svg>
      <p className="label">Fetching the page</p>
      <span className="gx-loading-bar" aria-hidden />
    </div>
  );
}

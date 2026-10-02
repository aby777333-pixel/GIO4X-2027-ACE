/**
 * A lesson's prepared HTML, cut into chapters at its `h2` headings.
 *
 * Nothing is rewritten: joining `head + html` of every chapter, in order,
 * gives back exactly the string that went in. The text before the first
 * heading is the opening chapter; it has no heading of its own.
 *
 * Pure and dependency-free, so the lesson page (server) and the checking
 * scripts can both use it.
 */
export type LessonChapter = {
  /** the heading's own id, so links to a section keep working; "opening" for the text before the first heading */
  id: string;
  /** the heading as plain text; "Opening" for the text before the first heading */
  title: string;
  /** the heading element exactly as it was in the lesson, or "" for the opening */
  head: string;
  /** everything from the heading to the next one */
  html: string;
};

export const OPENING_ID = "opening";

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** The text of a fragment of the lesson's HTML: tags removed, the few entities the importer writes decoded. */
export const plainText = (html: string): string =>
  html
    // an inline tag sits inside a sentence and leaves no gap; any other tag separates two pieces of text
    .replace(/<\/?(?:strong|em|a|b|i|span|code)\b[^>]*>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();

export function splitChapters(html: string): LessonChapter[] {
  const out: LessonChapter[] = [];
  const heading = /<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g;
  let from = 0;
  let open: { id: string; title: string; head: string } = { id: OPENING_ID, title: "Opening", head: "" };
  const close = (to: number) => {
    const body = html.slice(from, to);
    // an opening with no text is not a chapter; a heading always is
    if (open.head || body.trim()) out.push({ ...open, html: body });
  };
  for (let m = heading.exec(html); m; m = heading.exec(html)) {
    close(m.index);
    open = { id: m[1], title: plainText(m[2]), head: m[0] };
    from = m.index + m[0].length;
  }
  close(html.length);
  return out;
}

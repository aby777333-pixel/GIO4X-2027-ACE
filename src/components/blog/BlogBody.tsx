import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { blogImageUrl } from "@/lib/blog";

/**
 * A blog post's body: a restricted Markdown, rendered to React elements.
 *
 * Nothing a writer types is ever inserted as HTML. The renderer understands
 * only what is listed here, and everything else is shown as plain text:
 *
 *   ## Heading            ### Smaller heading
 *   A paragraph. **bold**, *italic*, `code`, [a link](/path or https://…)
 *   - a list item         1. a numbered item
 *   > a quotation
 *   ---                   a rule
 *   ![alt text](folder/picture.webp "optional caption")
 *
 * A picture's address is a path inside the blog bucket (see blogImageUrl): a
 * post cannot load an image from another host. A link is a path on this site
 * or an https address; an https link opens in a new tab and is marked as
 * leaving the site.
 *
 * Used by the public post page and by the console's preview, so what a writer
 * sees is what a reader gets. Works in server and client components.
 */

const SAFE_HREF = /^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/;

/** Inline marks, one pass, left to right. */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let n = 0;
  for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${n++}`;
    if (m[2] !== undefined) out.push(<strong key={key}>{m[2]}</strong>);
    else if (m[3] !== undefined) out.push(<em key={key}>{m[3]}</em>);
    else if (m[4] !== undefined) out.push(<code key={key}>{m[4]}</code>);
    else if (m[5] !== undefined && m[6] !== undefined) {
      const href = m[6];
      if (!SAFE_HREF.test(href)) out.push(m[0]);
      else if (href.startsWith("/")) {
        out.push(
          <Link key={key} href={href} className="link">
            {m[5]}
          </Link>,
        );
      } else {
        out.push(
          <a key={key} href={href} className="link" target="_blank" rel="noopener noreferrer nofollow">
            {m[5]}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>,
        );
      }
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "h2" | "h3" | "p" | "quote"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "rule" }
  | { kind: "image"; alt: string; path: string; caption: string };

const IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/;

export function parseBlogBody(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      blocks.push({ kind: "rule" });
      i++;
      continue;
    }
    const image = IMAGE.exec(line.trim());
    if (image) {
      blocks.push({ kind: "image", alt: image[1], path: image[2], caption: image[3] ?? "" });
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", text: line.slice(4).trim() });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
      i++;
      continue;
    }
    const listKind = /^[-*] /.test(line) ? "ul" : /^\d+[.)] /.test(line) ? "ol" : null;
    if (listKind) {
      const marker = listKind === "ul" ? /^[-*] / : /^\d+[.)] /;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i])) {
        items.push(lines[i].replace(marker, "").trim());
        i++;
      }
      blocks.push({ kind: listKind, items });
      continue;
    }
    // a quotation or a paragraph runs until a blank line or the start of another kind of block
    const quote = line.startsWith("> ");
    const buf: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trimEnd();
      if (!l.trim()) break;
      if (buf.length && (/^(## |### |[-*] |\d+[.)] |---+$)/.test(l) || IMAGE.test(l.trim()) || l.startsWith("> ") !== quote)) break;
      buf.push(quote ? l.slice(2) : l);
      i++;
    }
    blocks.push({ kind: quote ? "quote" : "p", text: buf.join(" ") });
  }
  return blocks;
}

/** The headings of a post, for a table of contents. Ids match what BlogBody renders. */
export function blogHeadings(source: string): { id: string; text: string }[] {
  return parseBlogBody(source)
    .filter((b): b is { kind: "h2"; text: string } => b.kind === "h2")
    .map((b, n) => ({ id: headingId(b.text, n), text: b.text }));
}

function headingId(text: string, n: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `s${n + 1}${slug ? `-${slug}` : ""}`;
}

export function BlogBody({ source, className = "" }: { source: string; className?: string }) {
  const blocks = parseBlogBody(source);
  let h2 = 0;
  return (
    <div className={`prose-gx ${className}`}>
      {blocks.map((b, n) => {
        const key = `b${n}`;
        switch (b.kind) {
          case "h2": {
            const id = headingId(b.text, h2++);
            return (
              <h2 key={key} id={id}>
                {inline(b.text, key)}
              </h2>
            );
          }
          case "h3":
            return <h3 key={key}>{inline(b.text, key)}</h3>;
          case "quote":
            return <blockquote key={key}>{inline(b.text, key)}</blockquote>;
          case "ul":
            return (
              <ul key={key}>
                {b.items.map((item, k) => (
                  <li key={k}>{inline(item, `${key}-${k}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key}>
                {b.items.map((item, k) => (
                  <li key={k}>{inline(item, `${key}-${k}`)}</li>
                ))}
              </ol>
            );
          case "rule":
            return <hr key={key} />;
          case "image": {
            const src = blogImageUrl(b.path);
            // a picture that is not in the blog bucket is not loaded: its description stands in for it
            if (!src) return <p key={key}>[Picture: {b.alt || "no description"}]</p>;
            return (
              <figure key={key}>
                {/* eslint-disable-next-line @next/next/no-img-element -- served from the project's own storage bucket, sizes unknown */}
                <img src={src} alt={b.alt} loading="lazy" decoding="async" className="h-auto w-full rounded-[8px] border border-line" />
                {b.caption ? <figcaption className="mt-8 text-sm text-ink-3">{b.caption}</figcaption> : null}
              </figure>
            );
          }
          default:
            return (
              <p key={key}>
                <Fragment>{inline(b.text, key)}</Fragment>
              </p>
            );
        }
      })}
    </div>
  );
}

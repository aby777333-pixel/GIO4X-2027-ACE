import type { ReactNode } from "react";
import type { PlatformShot } from "@/data/platform-shots";

/**
 * A real screenshot, framed. WebP with a JPEG fallback at two widths; the
 * intrinsic size is set so the page never shifts while it loads. The image is
 * a link to its largest file, because a trading screen is only legible large.
 *
 * `crop` fixes the frame to a ratio and shows the top of the screen (used
 * where two screenshots of different shapes sit side by side).
 */
export function Screenshot({
  shot,
  caption,
  sizes = "(min-width: 1024px) 60vw, 100vw",
  crop,
  eager = false,
  className = "",
}: {
  shot: PlatformShot;
  caption?: ReactNode;
  sizes?: string;
  crop?: string;
  eager?: boolean;
  className?: string;
}) {
  const base = `/platforms/${shot.id}`;
  const set = (ext: string) => shot.widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(", ");
  const full = `${base}-${shot.widths[1]}.jpg`;
  return (
    <figure className={className}>
      <a
        href={full}
        target="_blank"
        rel="noopener noreferrer"
        className="group block overflow-hidden rounded-md border border-line-strong bg-surface shadow-2 transition-shadow duration-fast hover:shadow-3"
        style={crop ? { aspectRatio: crop } : undefined}
      >
        <picture>
          <source type="image/webp" srcSet={set("webp")} sizes={sizes} />
          <img
            src={`${base}-${shot.widths[0]}.jpg`}
            srcSet={set("jpg")}
            sizes={sizes}
            width={shot.width}
            height={shot.height}
            alt={shot.alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className={crop ? "h-full w-full object-cover object-left-top" : "h-auto w-full"}
          />
        </picture>
        <span className="sr-only"> Open the full-size image in a new tab.</span>
      </a>
      {caption && <figcaption className="mt-8 text-xs text-ink-3">{caption}</figcaption>}
    </figure>
  );
}

/**
 * What kind of picture a file really is, read from its first bytes.
 *
 * The type a browser declares for an upload is whatever the sender says it is.
 * The upload route therefore reads the file's signature as well, and stores a
 * picture only when the two agree. A pure function, so it can be checked on
 * its own.
 *
 *   JPEG   FF D8 FF
 *   PNG    89 50 4E 47 0D 0A 1A 0A
 *   WebP   "RIFF" . . . . "WEBP"
 *   AVIF   . . . . "ftyp" then the brand "avif" (as the major brand, or among
 *          the compatible brands inside the same box)
 *
 * SVG and GIF are not pictures here: SVG can carry script, and neither is in
 * the bucket's allow-list.
 */
import { BLOG_IMAGE_TYPES } from "@/lib/blog";

export type BlogImageType = (typeof BLOG_IMAGE_TYPES)[number];

export const BLOG_IMAGE_EXT: Record<BlogImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export function isBlogImageType(value: unknown): value is BlogImageType {
  return typeof value === "string" && (BLOG_IMAGE_TYPES as readonly string[]).includes(value);
}

function ascii(bytes: Uint8Array, at: number, text: string): boolean {
  if (bytes.length < at + text.length) return false;
  for (let i = 0; i < text.length; i++) if (bytes[at + i] !== text.charCodeAt(i)) return false;
  return true;
}

function starts(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((b, i) => bytes[i] === b);
}

/** The picture type the bytes are, or null when they are none of the four. Needs only the first 64 bytes. */
export function sniffImageType(bytes: Uint8Array): BlogImageType | null {
  if (starts(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) return "image/webp";
  if (ascii(bytes, 4, "ftyp")) {
    if (ascii(bytes, 8, "avif")) return "image/avif";
    // the ftyp box: size (4), "ftyp", major brand (4), minor version (4), then compatible brands, four bytes each
    const size = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
    const end = Math.min(size, bytes.length, 64);
    for (let at = 16; at + 4 <= end; at += 4) if (ascii(bytes, at, "avif")) return "image/avif";
  }
  return null;
}

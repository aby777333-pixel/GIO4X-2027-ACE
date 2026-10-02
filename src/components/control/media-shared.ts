/**
 * What the Media screen, its JSON route and the editor's picker share. Plain
 * values and types only: nothing here reads anything.
 */
import type { MediaItem } from "@/lib/server/media";

/** Pictures to a page on the Media screen. */
export const MEDIA_PER_PAGE = 48;
/** Pictures to a page in the editor's picker. */
export const MEDIA_PICKER_PER_PAGE = 24;
/** The highest page the picker's route answers: with the screen's own paging beyond it. */
export const MEDIA_PICKER_MAX_PAGE = 250;

export const MEDIA_LIST_PATH = "/control/media/list";
export const MEDIA_UPLOAD_PATH = "/control/blog/upload";

export const MEDIA_USE_FILTERS = ["all", "used", "unused"] as const;
export type MediaUseFilter = (typeof MEDIA_USE_FILTERS)[number];

export const MEDIA_TABS = ["library", "site"] as const;
export type MediaTab = (typeof MEDIA_TABS)[number];

/** One picture as the picker's route sends it. */
export type MediaListEntry = Pick<MediaItem, "path" | "name" | "size" | "type" | "uploadedAt">;

/** What GET /control/media/list answers. */
export type MediaListAnswer = { ok: true; items: MediaListEntry[]; page: number; more: boolean } | { ok: false; error: string };

/** "152 KB", "1.4 MB": binary units, as an operating system shows a file. */
export function fmtBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return "size not known";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TYPE_LABEL: Record<string, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/avif": "AVIF",
  "image/gif": "GIF",
  "image/svg+xml": "SVG",
  "image/x-icon": "ICO",
};

export const fmtImageType = (type: string | null): string => (type ? (TYPE_LABEL[type] ?? type) : "type not known");

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10" → "October 2026". */
export function fmtMonth(key: string): string {
  const [y, m] = key.split("-");
  const name = MONTHS[Number(m) - 1];
  return name ? `${name} ${y}` : key;
}

/**
 * The media library: what is in the public `blog` picture bucket, and which
 * posts use each picture.
 *
 * Everything here is read AS THE SIGNED-IN MEMBER OF STAFF (the client is
 * handed in by the page or route that established who is calling). Listing the
 * bucket needs blog.read (policy blog_images_staff_select in 0011_blog.sql);
 * so does reading every post. There is no privileged client.
 *
 * Nothing can be deleted through the API, on purpose: no policy grants it. A
 * picture that a published post shows must not be removable from a screen.
 *
 * Each function says whether it could read, because "not used" must never be
 * shown when the truth is "could not ask".
 */
import { BLOG_BUCKET, isBlogImagePath } from "@/lib/blog";
import type { Db } from "@/lib/supabase/server";
import type { BlogStatus } from "@/lib/supabase/types";

export type MediaItem = {
  /** the path inside the bucket, as a post stores it */
  path: string;
  /** the file's own name: the last part of the path */
  name: string;
  /** "2026-10": the month it was uploaded in (UTC); "" when that is not known */
  month: string;
  /** bytes, or null when storage did not say */
  size: number | null;
  /** the media type storage recorded, or null */
  type: string | null;
  uploadedAt: string | null;
};

export type MediaListing =
  | {
      state: "ok";
      /** newest first */
      items: MediaItem[];
      /** true when the walk stopped at its bound: older pictures exist that are not in `items` */
      truncated: boolean;
    }
  | { state: "failed" };

export type MediaUseKind = "cover" | "share" | "body";
export type MediaUse = { postId: string; title: string; status: BlogStatus; as: MediaUseKind };

export type MediaUsage =
  | {
      state: "ok";
      /** path → every place it is used */
      uses: Map<string, MediaUse[]>;
      /** true when there are more posts than were read: a picture shown as unused may be used by an older post */
      truncated: boolean;
    }
  | { state: "failed" };

/** Bounds on one walk of the bucket: what a single request may make storage do. */
const MAX_YEARS = 25;
const MAX_FOLDERS = 300;
const FOLDER_PAGE = 1000;
const MAX_ITEMS = 6000;
const PARALLEL = 6;

const YEAR = /^\d{4}$/;
const MONTH = /^(0[1-9]|1[0-2])$/;
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isMediaMonth = (value: unknown): value is string => typeof value === "string" && MONTH_KEY.test(value);

type Entry = { name: string; id: string | null; created_at: string | null; metadata: unknown };

class ListFailed extends Error {}

async function listFolder(supabase: Db, folder: string, offset = 0): Promise<Entry[]> {
  const { data, error } = await supabase.storage.from(BLOG_BUCKET).list(folder, { limit: FOLDER_PAGE, offset, sortBy: { column: "name", order: "desc" } });
  if (error || !data) throw new ListFailed();
  return data;
}

function toItem(folder: string, entry: Entry): MediaItem | null {
  // a folder has no id; a placeholder file some tools leave in an empty folder is not a picture
  if (!entry.id || entry.name.startsWith(".")) return null;
  const path = folder ? `${folder}/${entry.name}` : entry.name;
  if (!isBlogImagePath(path)) return null;
  const meta = typeof entry.metadata === "object" && entry.metadata !== null ? (entry.metadata as { size?: unknown; mimetype?: unknown }) : {};
  const uploaded = entry.created_at && !Number.isNaN(Date.parse(entry.created_at)) ? new Date(entry.created_at).toISOString() : null;
  // the uploader files a picture under <yyyy>/<mm>/ in UTC; a file put anywhere else is dated by when it arrived
  const [y, m] = folder.split("/");
  const month = YEAR.test(y ?? "") && MONTH.test(m ?? "") ? `${y}-${m}` : uploaded ? uploaded.slice(0, 7) : "";
  return {
    path,
    name: entry.name,
    month,
    size: typeof meta.size === "number" && Number.isFinite(meta.size) && meta.size >= 0 ? meta.size : null,
    type: typeof meta.mimetype === "string" && meta.mimetype.length <= 80 ? meta.mimetype : null,
    uploadedAt: uploaded,
  };
}

/** Every file in one folder, a page at a time, until it is exhausted or `room` is used up. */
async function folderItems(supabase: Db, folder: string, room: number): Promise<{ items: MediaItem[]; more: boolean }> {
  const items: MediaItem[] = [];
  for (let offset = 0; ; offset += FOLDER_PAGE) {
    const entries = await listFolder(supabase, folder, offset);
    for (const e of entries) {
      const item = toItem(folder, e);
      if (item) items.push(item);
    }
    if (entries.length < FOLDER_PAGE) return { items, more: false };
    if (items.length >= room) return { items, more: true };
  }
}

/**
 * Every picture in the bucket, newest first. The uploader files pictures under
 * <yyyy>/<mm>/, so the walk is: the years, the months in each, the files in
 * each month. A file someone put at the top or directly in a year is listed
 * too. The walk is bounded; when a bound is reached `truncated` says so.
 */
export async function listMedia(supabase: Db): Promise<MediaListing> {
  try {
    const items: MediaItem[] = [];
    let truncated = false;

    const top = await listFolder(supabase, "");
    for (const e of top) {
      const item = toItem("", e);
      if (item) items.push(item);
    }
    const years = top
      .filter((e) => !e.id && YEAR.test(e.name))
      .map((e) => e.name)
      .sort()
      .reverse();
    if (years.length > MAX_YEARS) truncated = true;

    const folders: string[] = [];
    for (const year of years.slice(0, MAX_YEARS)) {
      const inside = await listFolder(supabase, year);
      for (const e of inside) {
        const item = toItem(year, e);
        if (item) items.push(item);
      }
      const months = inside
        .filter((e) => !e.id && MONTH.test(e.name))
        .map((e) => e.name)
        .sort()
        .reverse();
      for (const month of months) folders.push(`${year}/${month}`);
    }
    if (folders.length > MAX_FOLDERS) truncated = true;

    // newest months first, a few at a time, so that a bound cuts off the oldest pictures and not the newest
    const queue = folders.slice(0, MAX_FOLDERS);
    for (let i = 0; i < queue.length && items.length < MAX_ITEMS; i += PARALLEL) {
      const batch = await Promise.all(queue.slice(i, i + PARALLEL).map((folder) => folderItems(supabase, folder, MAX_ITEMS)));
      for (const result of batch) {
        items.push(...result.items);
        if (result.more) truncated = true;
      }
      if (items.length >= MAX_ITEMS && i + PARALLEL < queue.length) truncated = true;
    }

    items.sort((a, b) => {
      const at = a.uploadedAt ?? "";
      const bt = b.uploadedAt ?? "";
      if (at !== bt) return at < bt ? 1 : -1;
      return a.path < b.path ? 1 : a.path > b.path ? -1 : 0;
    });
    return { state: "ok", items: items.slice(0, MAX_ITEMS), truncated: truncated || items.length > MAX_ITEMS };
  } catch {
    return { state: "failed" };
  }
}

/** A picture in a post's body: ![alt](path "caption"). The same mark src/components/blog/BlogBody.tsx draws. */
const BODY_IMAGE = /!\[[^\]\n]*\]\(\s*([^)\s]+)/g;

export function bodyImagePaths(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(BODY_IMAGE)) if (isBlogImagePath(m[1])) out.add(m[1]);
  return [...out];
}

const POSTS_STEP = 500;
const MAX_POSTS = 5000;

type UsageRow = { id: string; title: string; status: BlogStatus; cover_path: string; og_image_path: string; body: string };

/**
 * Where each picture is used: as a post's cover, as its separate share
 * picture, or in its body. Every post counts, whatever its status: a draft
 * that shows a picture uses it.
 */
export async function readMediaUsage(supabase: Db): Promise<MediaUsage> {
  try {
    const uses = new Map<string, MediaUse[]>();
    const add = (path: string, use: MediaUse) => {
      const list = uses.get(path);
      if (list) list.push(use);
      else uses.set(path, [use]);
    };
    let truncated = false;
    for (let from = 0; ; from += POSTS_STEP) {
      if (from >= MAX_POSTS) {
        truncated = true;
        break;
      }
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, status, cover_path, og_image_path, body")
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + POSTS_STEP - 1);
      if (error) {
        // PGRST103: the range starts past the last row, which is simply the end
        if (error.code === "PGRST103") break;
        return { state: "failed" };
      }
      const rows = (data ?? []) as UsageRow[];
      for (const row of rows) {
        const base = { postId: row.id, title: row.title, status: row.status };
        if (row.cover_path) add(row.cover_path, { ...base, as: "cover" });
        if (row.og_image_path) add(row.og_image_path, { ...base, as: "share" });
        for (const path of bodyImagePaths(row.body)) add(path, { ...base, as: "body" });
      }
      if (rows.length < POSTS_STEP) break;
    }
    return { state: "ok", uses, truncated };
  } catch {
    return { state: "failed" };
  }
}

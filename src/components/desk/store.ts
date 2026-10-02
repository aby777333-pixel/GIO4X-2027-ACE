"use client";

import { useSyncExternalStore } from "react";
import { ACCENTS, DEFAULT_PREFS } from "@/lib/prefs";

/**
 * MY DESK — what this browser holds for the visitor, read and written in one place.
 *
 * Three of the keys listed in LOCAL_KEYS (lib/prefs) belong to this module:
 *
 *   gx:watch   string[]                      "<class>/<slug>" of each watched instrument, newest first
 *   gx:saved   { h, t }[]                    path and title of each saved page, newest first
 *   gx:recent  { p: { h, t }[], s: string[] } pages opened and searches made, newest first
 *
 * The other three shown on the desk are owned elsewhere and only read here:
 * gx:prefs (lib/prefs), gx:calc (components/tools/store) and gx:learn
 * (components/glossary/learn).
 *
 * Nothing leaves the browser. gx:watch and gx:saved are written only when the
 * visitor presses "Watch" or "Save". gx:recent is written only after the
 * visitor has switched the list on from the desk: while the key is absent,
 * nothing about the pages opened is recorded.
 *
 * Every value read from storage or from an imported file is checked against
 * the shapes below, and every list has a fixed maximum length, so a stored
 * value can never grow without bound or put an unexpected address on the page.
 */
export const WATCH_KEY = "gx:watch";
export const SAVED_KEY = "gx:saved";
export const RECENT_KEY = "gx:recent";

export type PageRef = { h: string; t: string };
export type Recent = { p: PageRef[]; s: string[] };
export type SavedKind = "article" | "lesson" | "term" | "tool";

export const MAX_WATCH = 40;
export const MAX_SAVED = 60;
export const MAX_RECENT_PAGES = 12;
export const MAX_RECENT_SEARCHES = 8;
const MAX_TITLE = 160;
const MAX_QUERY = 120;

const WATCH_ID = /^(forex|metals|indices|energy|equities|crypto)\/[a-z0-9][a-z0-9-]{0,39}$/;
/** the kinds of page that carry a Save button: nothing else can be stored as saved */
const SAVED_PATH = /^\/(intelligence\/blog|intelligence|academy|glossary|tools)\/[a-z0-9][a-z0-9-]{0,119}$/;
/** a path on this site: no host, no query, no fragment */
const SITE_PATH = /^\/(?:[a-z0-9][a-z0-9-]{0,119}(?:\/[a-z0-9][a-z0-9-]{0,119}){0,5})?$/;
/** never listed as recently viewed: the desk itself, utilities, gateways and the staff console */
const NOT_RECORDED = /^\/(desk|offline|preferences|search|sign-in|open-account|control|api)(\/|$)/;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const cleanText = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

export function savedKind(h: string): SavedKind | null {
  if (!SAVED_PATH.test(h)) return null;
  if (h.startsWith("/intelligence/")) return "article";
  if (h.startsWith("/academy/")) return "lesson";
  if (h.startsWith("/glossary/")) return "term";
  return "tool";
}

/* ---- validation --------------------------------------------------------------
 * `strict` is used for an imported file: one entry of the wrong shape refuses
 * the whole value. Reading this browser's own storage is lenient: a bad entry
 * is dropped and the rest is kept.
 */

function parsePageRef(v: unknown, path: RegExp): PageRef | null {
  if (!isObject(v)) return null;
  const keys = Object.keys(v);
  if (keys.length !== 2 || typeof v.h !== "string" || typeof v.t !== "string") return null;
  if (!path.test(v.h) || v.t.length < 1 || v.t.length > MAX_TITLE || v.t !== cleanText(v.t, MAX_TITLE)) return null;
  return { h: v.h, t: v.t };
}

function parseList<T>(v: unknown, max: number, item: (x: unknown) => T | null, id: (x: T) => string, strict: boolean): T[] | null {
  if (!Array.isArray(v)) return null;
  if (strict && v.length > max) return null;
  const out: T[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    const ok = item(x);
    if (ok === null || seen.has(id(ok))) {
      if (strict) return null;
      continue;
    }
    if (out.length >= max) break;
    seen.add(id(ok));
    out.push(ok);
  }
  return out;
}

export function parseWatch(v: unknown, strict = false): string[] | null {
  return parseList(v, MAX_WATCH, (x) => (typeof x === "string" && WATCH_ID.test(x) ? x : null), (x) => x, strict);
}

export function parseSaved(v: unknown, strict = false): PageRef[] | null {
  return parseList(v, MAX_SAVED, (x) => parsePageRef(x, SAVED_PATH), (x) => x.h, strict);
}

export function parseRecent(v: unknown, strict = false): Recent | null {
  if (!isObject(v)) return null;
  if (strict && Object.keys(v).some((k) => k !== "p" && k !== "s")) return null;
  const p = parseList(v.p ?? [], MAX_RECENT_PAGES, (x) => { const r = parsePageRef(x, SITE_PATH); return r && !NOT_RECORDED.test(r.h) ? r : null; }, (x) => x.h, strict);
  const s = parseList(v.s ?? [], MAX_RECENT_SEARCHES, (x) => (typeof x === "string" && x.length >= 1 && x.length <= MAX_QUERY && x === cleanText(x, MAX_QUERY) ? x : null), (x) => x.toLowerCase(), strict);
  if (!p || !s) return null;
  return { p, s };
}

/** gx:calc as components/tools/store keeps it: the eleven fields, each the text the visitor typed. */
const CALC_FIELDS = ["instrument", "accountCurrency", "balance", "lots", "leverage", "riskPct", "stopPips", "accountType", "pointSize", "customContract", "customQuote"] as const;
export type CalcField = (typeof CALC_FIELDS)[number];
export type HeldCalc = Partial<Record<CalcField, string>>;

export function parseCalc(v: unknown, strict = false): HeldCalc | null {
  if (!isObject(v)) return null;
  const out: HeldCalc = {};
  for (const [k, x] of Object.entries(v)) {
    const known = (CALC_FIELDS as readonly string[]).includes(k);
    // the same limit the tools apply when they load the key
    if (known && typeof x === "string" && x.length <= 24) out[k as CalcField] = x;
    else if (strict) return null;
  }
  return out;
}

/** gx:learn as components/glossary/learn keeps it: slug → true, Academy lessons under "lesson:<slug>". */
const LEARN_SLUG = /^(?:lesson:)?[a-z0-9][a-z0-9-]{0,79}$/;
const MAX_LEARN = 600;

export function parseLearn(v: unknown, strict = false): Record<string, true> | null {
  if (!isObject(v)) return null;
  const out: Record<string, true> = {};
  let n = 0;
  for (const [k, x] of Object.entries(v)) {
    if (x === true && LEARN_SLUG.test(k) && n < MAX_LEARN) {
      out[k] = true;
      n++;
    } else if (strict) return null;
  }
  return out;
}

/** The choices a preference may take, where it is a fixed set. Anything not named here is checked by type. */
const PREF_CHOICES: Record<string, readonly string[]> = {
  theme: ["light", "dark", "auto"],
  accent: ACCENTS.map((a) => a.key),
  density: ["relaxed", "standard", "pro"],
  motion: ["full", "reduced"],
  contrast: ["default", "high"],
  text: ["default", "large"],
  effects: ["full", "low"],
  links: ["default", "underline"],
  platform: ["none", "raptor", "mt5"],
};
const ZONE = /^[A-Za-z0-9_+\-/]{1,64}$/;

/**
 * gx:prefs: only fields the site knows (the fields of DEFAULT_PREFS), each of
 * the same type as its default. Fixed sets are checked against their members.
 */
export function parsePrefs(v: unknown, strict = false): Record<string, string | boolean | number> | null {
  if (!isObject(v)) return null;
  const defaults = DEFAULT_PREFS as unknown as Record<string, unknown>;
  const out: Record<string, string | boolean | number> = {};
  for (const [k, x] of Object.entries(v)) {
    const d = Object.prototype.hasOwnProperty.call(defaults, k) ? defaults[k] : undefined;
    let ok = d !== undefined && typeof x === typeof d && (typeof x === "string" || typeof x === "boolean" || (typeof x === "number" && Number.isFinite(x)));
    if (ok && typeof x === "string") {
      const choices = PREF_CHOICES[k];
      ok = choices ? choices.includes(x) : k === "tz" ? x === "local" || ZONE.test(x) : x.length <= 64;
    }
    if (ok) out[k] = x as string | boolean | number;
    else if (strict) return null;
  }
  return out;
}

/* ---- storage ------------------------------------------------------------------ */

const EVENT = "gx:desk";
const announce = () => window.dispatchEvent(new Event(EVENT));

function getRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full: the change is simply not kept */
  }
  announce();
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  announce();
}

/** One stored value, parsed once per change of its stored text, so React is handed the same object until it changes. */
function slot<T>(key: string, parse: (v: unknown) => T | null): () => T | null {
  let lastRaw: string | null | undefined;
  let last: T | null = null;
  return () => {
    const raw = getRaw(key);
    if (raw === lastRaw) return last;
    lastRaw = raw;
    last = null;
    if (raw) {
      try {
        last = parse(JSON.parse(raw));
      } catch {
        /* not JSON: treated as nothing stored */
      }
    }
    return last;
  };
}

const EMPTY_WATCH: string[] = [];
const EMPTY_SAVED: PageRef[] = [];

const watchSlot = slot(WATCH_KEY, (v) => parseWatch(v));
const savedSlot = slot(SAVED_KEY, (v) => parseSaved(v));
const recentSlot = slot(RECENT_KEY, (v) => parseRecent(v));
const calcSlot = slot("gx:calc", (v) => parseCalc(v));

export const readWatch = (): string[] => watchSlot() ?? EMPTY_WATCH;
export const readSaved = (): PageRef[] => savedSlot() ?? EMPTY_SAVED;
/** null while the list is switched off (the key does not exist) */
export const readRecent = (): Recent | null => recentSlot();
/** null when the tools have not stored anything: they are then showing their starting placeholders */
export const readCalc = (): HeldCalc | null => calcSlot();

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  // the privacy reset clears every key, then announces the preferences
  window.addEventListener("gx:prefs", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener("gx:prefs", onChange);
  };
}

/** `undefined` on the server and during hydration: nothing that depends on storage is in the first HTML. */
const onServer = () => undefined;

export const useWatch = (): string[] | undefined => useSyncExternalStore(subscribe, readWatch, onServer);
export const useSaved = (): PageRef[] | undefined => useSyncExternalStore(subscribe, readSaved, onServer);
export const useRecent = (): Recent | null | undefined => useSyncExternalStore(subscribe, readRecent, onServer);
export const useHeldCalc = (): HeldCalc | null | undefined => useSyncExternalStore(subscribe, readCalc, onServer);

/* ---- watchlist ------------------------------------------------------------------ */

export function toggleWatch(id: string): void {
  if (!WATCH_ID.test(id)) return;
  const now = readWatch();
  const next = now.includes(id) ? now.filter((x) => x !== id) : [id, ...now].slice(0, MAX_WATCH);
  if (next.length) setJson(WATCH_KEY, next);
  else remove(WATCH_KEY);
}

/* ---- saved ---------------------------------------------------------------------- */

export function toggleSaved(h: string, title: string): void {
  const t = cleanText(title, MAX_TITLE);
  if (!SAVED_PATH.test(h) || !t) return;
  const now = readSaved();
  const next = now.some((x) => x.h === h) ? now.filter((x) => x.h !== h) : [{ h, t }, ...now].slice(0, MAX_SAVED);
  if (next.length) setJson(SAVED_KEY, next);
  else remove(SAVED_KEY);
}

/* ---- recently viewed: off until the visitor switches it on ---------------------------- */

export function startRecent(): void {
  if (readRecent()) return;
  setJson(RECENT_KEY, { p: [], s: [] } satisfies Recent);
}

export function stopRecent(): void {
  remove(RECENT_KEY);
}

/** Record a page as opened. Does nothing unless the list is on. */
export function notePage(h: string, title: string): void {
  const now = readRecent();
  const t = cleanText(title, MAX_TITLE);
  if (!now || !t || !SITE_PATH.test(h) || NOT_RECORDED.test(h)) return;
  if (now.p[0]?.h === h && now.p[0].t === t) return;
  setJson(RECENT_KEY, { p: [{ h, t }, ...now.p.filter((x) => x.h !== h)].slice(0, MAX_RECENT_PAGES), s: now.s } satisfies Recent);
}

/** Record a search as made. Does nothing unless the list is on. */
export function noteSearch(query: string): void {
  const now = readRecent();
  const q = cleanText(query, MAX_QUERY);
  if (!now || !q) return;
  if (now.s[0]?.toLowerCase() === q.toLowerCase()) return;
  setJson(RECENT_KEY, { p: now.p, s: [q, ...now.s.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT_SEARCHES) } satisfies Recent);
}

/* ---- calculator figures ------------------------------------------------------------ */

/** Remove the stored figures. The caller resets the tools' own in-memory copy first (useCalc's reset). */
export function forgetCalc(): void {
  remove("gx:calc");
}

/* ---- export and import ------------------------------------------------------------- */

/** The keys a desk file may carry, in the order they are listed to the visitor. */
export const DESK_KEYS = ["gx:watch", "gx:saved", "gx:recent", "gx:calc", "gx:learn", "gx:prefs"] as const;
export type DeskKey = (typeof DESK_KEYS)[number];

export const DESK_KEY_NAME: Record<DeskKey, string> = {
  "gx:watch": "Watchlist",
  "gx:saved": "Saved items",
  "gx:recent": "Recently viewed",
  "gx:calc": "Calculator figures",
  "gx:learn": "Learning progress",
  "gx:prefs": "Display preferences",
};

const STRICT: Record<DeskKey, (v: unknown) => unknown | null> = {
  "gx:watch": (v) => parseWatch(v, true),
  "gx:saved": (v) => parseSaved(v, true),
  "gx:recent": (v) => parseRecent(v, true),
  "gx:calc": (v) => parseCalc(v, true),
  "gx:learn": (v) => parseLearn(v, true),
  "gx:prefs": (v) => parsePrefs(v, true),
};

const FILE_APP = "gio4x-desk";
const FILE_VERSION = 1;
/** far more than a full desk can weigh; a larger file is not a desk file */
export const MAX_FILE_BYTES = 200_000;

export type DeskFile = { app: typeof FILE_APP; version: typeof FILE_VERSION; exported: string; keys: Partial<Record<DeskKey, unknown>> };

/** What this browser holds now, as the text of a desk file. Keys that are not stored are left out. */
export function exportDesk(): { text: string; count: number } {
  const keys: Partial<Record<DeskKey, unknown>> = {};
  let count = 0;
  for (const k of DESK_KEYS) {
    const raw = getRaw(k);
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    // only what would be accepted back is written out
    const lenient = k === "gx:watch" ? parseWatch(parsed) : k === "gx:saved" ? parseSaved(parsed) : k === "gx:recent" ? parseRecent(parsed) : k === "gx:calc" ? parseCalc(parsed) : k === "gx:learn" ? parseLearn(parsed) : parsePrefs(parsed);
    if (lenient === null) continue;
    keys[k] = lenient;
    count++;
  }
  const file: DeskFile = { app: FILE_APP, version: FILE_VERSION, exported: new Date().toISOString(), keys };
  return { text: JSON.stringify(file, null, 2), count };
}

export type ImportCheck = { ok: true; keys: { key: DeskKey; value: unknown; size: string }[] } | { ok: false; reason: string };

function sizeOf(key: DeskKey, value: unknown): string {
  const n = (x: number, one: string, many: string) => `${x} ${x === 1 ? one : many}`;
  switch (key) {
    case "gx:watch":
      return n((value as string[]).length, "instrument", "instruments");
    case "gx:saved":
      return n((value as PageRef[]).length, "page", "pages");
    case "gx:recent": {
      const r = value as Recent;
      return `${n(r.p.length, "page", "pages")}, ${n(r.s.length, "search", "searches")}`;
    }
    case "gx:learn": {
      const all = Object.keys(value as Record<string, true>);
      const lessons = all.filter((s) => s.startsWith("lesson:")).length;
      return `${n(all.length - lessons, "term", "terms")}, ${n(lessons, "lesson", "lessons")}`;
    }
    case "gx:calc":
      return n(Object.keys(value as HeldCalc).length, "figure", "figures");
    case "gx:prefs":
      return n(Object.keys(value as Record<string, unknown>).length, "setting", "settings");
  }
}

/**
 * Check the text of a file before anything is written. Refused outright:
 * anything that is not a desk file, a key the site does not know, and a value
 * that is not exactly the expected shape and size. Nothing is repaired.
 */
export function checkDeskFile(text: string): ImportCheck {
  if (text.length > MAX_FILE_BYTES) return { ok: false, reason: "The file is larger than a desk file can be." };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: "The file is not valid JSON." };
  }
  if (!isObject(data) || data.app !== FILE_APP) return { ok: false, reason: "This is not a GIO4X desk file." };
  if (data.version !== FILE_VERSION) return { ok: false, reason: "This desk file was written in a format this page does not read." };
  if (Object.keys(data).some((k) => !["app", "version", "exported", "keys"].includes(k))) return { ok: false, reason: "The file carries something a desk file does not contain." };
  if (typeof data.exported !== "string" || data.exported.length > 40 || Number.isNaN(Date.parse(data.exported))) return { ok: false, reason: "The file does not state when it was exported." };
  if (!isObject(data.keys)) return { ok: false, reason: "The file holds no desk items." };
  const out: { key: DeskKey; value: unknown; size: string }[] = [];
  for (const k of Object.keys(data.keys)) {
    if (!(DESK_KEYS as readonly string[]).includes(k)) return { ok: false, reason: `The file contains “${k.slice(0, 40)}”, which is not something the desk stores.` };
  }
  for (const k of DESK_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(data.keys, k)) continue;
    const value = STRICT[k](data.keys[k]);
    if (value === null) return { ok: false, reason: `${DESK_KEY_NAME[k]} in this file is not in the expected form, so nothing was read.` };
    out.push({ key: k, value, size: sizeOf(k, value) });
  }
  if (out.length === 0) return { ok: false, reason: "The file holds no desk items." };
  return { ok: true, keys: out };
}

/** Write a checked file. Keys the file does not carry are left as they are. Returns false if storage refused. */
export function applyDeskFile(keys: { key: DeskKey; value: unknown }[]): boolean {
  try {
    for (const { key, value } of keys) window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
  announce();
  return true;
}

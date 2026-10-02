/**
 * The console's look: light or dark, and one of six palettes.
 *
 * It belongs to the console alone. It is kept in this browser under one
 * localStorage key, `gxc:look`, as JSON `{ theme, palette }`; it is never sent
 * to a server, and it neither reads nor changes the public site's display
 * preferences (`gx:prefs`). The values are applied as two attributes on the
 * console's root element, `data-gxc-theme` and `data-gxc-palette`, which
 * src/styles/console.css turns into colours.
 *
 * The default, light and Navy, is the Service Console exactly as it was.
 */
export const LOOK_KEY = "gxc:look";
/** Dispatched on `window` after the look changes in this tab. */
export const LOOK_EVENT = "gxc:look";

export const LOOK_THEMES = ["light", "dark"] as const;
export type LookTheme = (typeof LOOK_THEMES)[number];

export const LOOK_PALETTES = [
  { key: "navy", label: "Navy" },
  { key: "graphite", label: "Graphite" },
  { key: "emerald", label: "Emerald" },
  { key: "royal", label: "Royal" },
  { key: "ocean", label: "Ocean" },
  { key: "mono", label: "Mono" },
] as const;
export type LookPalette = (typeof LOOK_PALETTES)[number]["key"];

export type Look = { theme: LookTheme; palette: LookPalette };

export const DEFAULT_LOOK: Look = { theme: "light", palette: "navy" };

const isPalette = (v: unknown): v is LookPalette => LOOK_PALETTES.some((p) => p.key === v);

/** What was stored, reduced to a look. Anything unreadable or unknown is the default. */
export function parseLook(raw: string | null | undefined): Look {
  if (!raw) return DEFAULT_LOOK;
  try {
    const v = JSON.parse(raw) as { theme?: unknown; palette?: unknown } | null;
    if (typeof v !== "object" || v === null) return DEFAULT_LOOK;
    return { theme: v.theme === "dark" ? "dark" : "light", palette: isPalette(v.palette) ? v.palette : "navy" };
  } catch {
    return DEFAULT_LOOK;
  }
}

/** The stored value as it is, or "" when there is none or storage cannot be read. */
export function readLookRaw(): string {
  try {
    return window.localStorage.getItem(LOOK_KEY) ?? "";
  } catch {
    return "";
  }
}

export const isDefaultLook = (look: Look) => look.theme === DEFAULT_LOOK.theme && look.palette === DEFAULT_LOOK.palette;

/**
 * Puts the look on every console root in the document. A root marked
 * `data-gxc-door` (the sign-in page, the notices outside the console) wears
 * the public site's look by default, and takes the console's (class
 * `gx-console`) only once a look other than the default is chosen.
 */
export function applyLook(look: Look): void {
  for (const el of document.querySelectorAll<HTMLElement>("[data-gxc-root]")) {
    el.setAttribute("data-gxc-theme", look.theme);
    el.setAttribute("data-gxc-palette", look.palette);
    if (el.hasAttribute("data-gxc-door")) el.classList.toggle("gx-console", !isDefaultLook(look));
  }
}

/** Remembers the look in this browser, applies it, and tells every switcher on the page. */
export function writeLook(look: Look): void {
  try {
    window.localStorage.setItem(LOOK_KEY, JSON.stringify(look));
  } catch {
    /* storage unavailable: the look applies to this page and is not remembered */
  }
  applyLook(look);
  window.dispatchEvent(new CustomEvent<Look>(LOOK_EVENT, { detail: look }));
}

/**
 * Runs before paint, as the first child of a console root: reads the stored
 * look and sets it on that root (its parent), so there is no flash of the
 * default. Kept tiny and dependency-free; mirrors parseLook() and applyLook().
 * Allowed by the same Content-Security-Policy rule as the public site's
 * PREFS_BOOT_SCRIPT ('unsafe-inline', see next.config.mjs).
 */
export const LOOK_BOOT_SCRIPT = `(function(){try{var s=document.currentScript,e=s&&s.parentElement;if(!e)return;var t="light",p="navy";try{var l=JSON.parse(localStorage.getItem("${LOOK_KEY}")||"null");if(l&&typeof l==="object"){if(l.theme==="dark")t="dark";if(${JSON.stringify(LOOK_PALETTES.map((x) => x.key))}.indexOf(l.palette)>-1)p=l.palette}}catch(x){}e.setAttribute("data-gxc-theme",t);e.setAttribute("data-gxc-palette",p);if(e.hasAttribute("data-gxc-door"))e.classList.toggle("gx-console",!(t==="light"&&p==="navy"))}catch(x){}})();`;

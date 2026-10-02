/**
 * GIO4X ADAPTIVE DISPLAY — visitor preferences.
 *
 * Stored only in this browser (localStorage key `gx:prefs`), never sent to a
 * server, and cleared from /preferences. The same shape is applied to
 * <html data-*> by an inline boot script before first paint (see
 * PREFS_BOOT_SCRIPT) so there is no flash of the wrong theme.
 */
export const PREFS_KEY = "gx:prefs";

export type Prefs = {
  theme: "light" | "dark" | "auto";
  accent: "gio4x" | "ivory" | "midnight" | "ocean" | "emerald" | "royal" | "mono";
  density: "relaxed" | "standard" | "pro";
  motion: "full" | "reduced";
  contrast: "default" | "high";
  text: "default" | "large";
  effects: "full" | "low";
  links: "default" | "underline";
  /** IANA zone or "local" */
  tz: string;
  /** remembered platform context, set only by an explicit choice */
  platform: "none" | "raptor" | "mt5";
};

export const DEFAULT_PREFS: Prefs = {
  theme: "light",
  accent: "gio4x",
  density: "standard",
  motion: "full",
  contrast: "default",
  text: "default",
  effects: "full",
  links: "default",
  tz: "local",
  platform: "none",
};

export const ACCENTS: { key: Prefs["accent"]; label: string; note: string }[] = [
  { key: "gio4x", label: "GIO4X", note: "Market blue, teal and emerald, straight from the logo" },
  { key: "ivory", label: "Ivory", note: "Warm white, champagne and graphite" },
  { key: "midnight", label: "Midnight", note: "Navy, platinum and a restrained champagne" },
  { key: "ocean", label: "Ocean", note: "Petroleum blue and silver" },
  { key: "emerald", label: "Emerald", note: "Deep green and brass" },
  { key: "royal", label: "Royal", note: "Indigo, platinum and champagne" },
  { key: "mono", label: "Mono", note: "Graphite only" },
];

export function readPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function resolveTheme(theme: Prefs["theme"]): "light" | "dark" {
  if (theme !== "auto") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyPrefs(p: Prefs): void {
  const d = document.documentElement.dataset;
  d.theme = resolveTheme(p.theme);
  d.themePref = p.theme;
  d.accent = p.accent;
  d.density = p.density;
  d.motion = p.motion;
  d.contrast = p.contrast;
  d.text = p.text;
  d.effects = p.effects;
  d.links = p.links;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", d.theme === "dark" ? "#0b1014" : "#f6f4ee");
}

export function writePrefs(p: Prefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: preferences simply do not persist */
  }
  applyPrefs(p);
  window.dispatchEvent(new CustomEvent("gx:prefs", { detail: p }));
}

/** Everything GIO4X stores in this browser. Used by the privacy reset. */
export const LOCAL_KEYS = ["gx:prefs", "gx:recent", "gx:saved", "gx:calc", "gx:consent", "gx:watch", "gx:boot"] as const;

/** The session-storage keys (emptied by the browser when the tab closes): a closed announcement, an open chat. */
export const SESSION_KEYS = ["gx:announcement:dismissed", "gx:chat"] as const;

export function resetLocal(): void {
  for (const k of LOCAL_KEYS) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  for (const k of SESSION_KEYS) {
    try {
      window.sessionStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  applyPrefs(DEFAULT_PREFS);
  window.dispatchEvent(new CustomEvent("gx:prefs", { detail: DEFAULT_PREFS }));
}

/**
 * Runs before paint. Kept tiny and dependency-free; mirrors applyPrefs().
 * Explicit visitor choice always wins; "auto" follows the OS setting.
 */
export const PREFS_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,s=d.dataset,p={};try{p=JSON.parse(localStorage.getItem("${PREFS_KEY}")||"{}")||{}}catch(e){}var t=p.theme||"light";s.themePref=t;s.theme=t==="auto"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;s.accent=p.accent||"gio4x";s.density=p.density||"standard";s.motion=p.motion||"full";s.contrast=p.contrast||"default";s.text=p.text||"default";s.effects=p.effects||"full";s.links=p.links||"default"}catch(e){}})();`;

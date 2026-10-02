/**
 * The eighth accent, "Custom": a visitor picks a hue (and, if they wish, a
 * second, supporting hue) and the whole accent family is derived from it.
 *
 * Only the HUE is the visitor's. Lightness and chroma are fixed per token, in
 * OKLCH, so that every hue lands at the same perceived lightness: that is what
 * keeps accent text at AA (4.5:1) on every page surface in both themes, and a
 * button label at AA on the accent. Where a hue cannot reach the asked chroma
 * inside sRGB, chroma is reduced (never lightness). The recipe is checked for
 * all 360 hues by .tmp/shot/accent-contrast.cjs.
 *
 * This file has no imports: lib/prefs.ts embeds ACCENT_BOOT_JS in the script
 * that runs before first paint, and that script must stand alone.
 */

/** What a visitor has not chosen: close to the Market Blue of the logo. */
export const DEFAULT_ACCENT_HUE = 250;
/** "No second hue chosen": the supporting colour then follows the first, 40 degrees towards teal. */
export const NO_SECOND_HUE = -1;

/** [lightness, chroma] of each derived token. Light page first, night surfaces second. */
export const ACCENT_RECIPE = {
  accent: [0.47, 0.14],
  accent2: [0.52, 0.11],
  accent3: [0.5, 0.03],
  mood1: [0.8, 0.11],
  mood2: [0.76, 0.09],
  mood3: [0.78, 0.03],
} as const;

export type AccentFamily = {
  /** light page: accent text and the filled button; white text passes on it */
  accent: string;
  /** light page: the supporting colour (gradients, the second tone); white text passes on it */
  accent2: string;
  /** light page: a near-neutral of the same hue */
  accent3: string;
  /** night surfaces and the dark theme: accent text and the filled button; dark text passes on it */
  mood1: string;
  mood2: string;
  mood3: string;
};

/** A whole number of degrees, 0 to 359, or the fallback when the stored value is not a finite number. */
export function normHue(n: unknown, fallback: number): number {
  return typeof n === "number" && isFinite(n) ? ((Math.round(n) % 360) + 360) % 360 : fallback;
}

/** The hue the supporting colour takes: the visitor's second hue, or 40 degrees from the first. */
export function secondHue(hue: number, hue2: unknown): number {
  return typeof hue2 === "number" && hue2 >= 0 ? normHue(hue2, hue) : (hue + 320) % 360;
}

/** OKLCH to an sRGB hex colour. Chroma is reduced until the colour is inside sRGB; lightness is kept. */
export function oklchHex(L: number, C: number, h: number): string {
  const t = (h * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  for (;;) {
    const a = C * cos;
    const b = C * sin;
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    if (C < 0.002 || (rgb[0] >= 0 && rgb[0] <= 1 && rgb[1] >= 0 && rgb[1] <= 1 && rgb[2] >= 0 && rgb[2] <= 1)) {
      let out = "#";
      for (let i = 0; i < 3; i++) {
        const x = Math.min(1, Math.max(0, rgb[i]));
        const v = Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));
        out += (v < 16 ? "0" : "") + v.toString(16);
      }
      return out;
    }
    C *= 0.96;
  }
}

/** The six colours derived from a hue and an optional second hue. */
export function customAccent(hue: unknown, hue2: unknown): AccentFamily {
  const h = normHue(hue, DEFAULT_ACCENT_HUE);
  const g = secondHue(h, hue2);
  const R = ACCENT_RECIPE;
  return {
    accent: oklchHex(R.accent[0], R.accent[1], h),
    accent2: oklchHex(R.accent2[0], R.accent2[1], g),
    accent3: oklchHex(R.accent3[0], R.accent3[1], h),
    mood1: oklchHex(R.mood1[0], R.mood1[1], h),
    mood2: oklchHex(R.mood2[0], R.mood2[1], g),
    mood3: oklchHex(R.mood3[0], R.mood3[1], h),
  };
}

/** Text that sits on the accent: white on the light page's accent, the night ink on a bright mood. */
export const ACCENT_INK = { light: "#ffffff", dark: "#0b1014" } as const;

/** The variables a built-in accent gets from tokens.css and accent.css, in the order they are written. */
export const ACCENT_VARS = ["--accent", "--accent-ink", "--accent-2", "--accent-3", "--mood-1", "--mood-2", "--mood-3"] as const;

/** The same seven variables for the custom accent, for one theme. */
export function customAccentVars(hue: unknown, hue2: unknown, theme: "light" | "dark"): Record<(typeof ACCENT_VARS)[number], string> {
  const f = customAccent(hue, hue2);
  const dark = theme === "dark";
  return {
    "--accent": dark ? f.mood1 : f.accent,
    "--accent-ink": dark ? ACCENT_INK.dark : ACCENT_INK.light,
    "--accent-2": dark ? f.mood2 : f.accent2,
    "--accent-3": dark ? f.mood3 : f.accent3,
    "--mood-1": f.mood1,
    "--mood-2": f.mood2,
    "--mood-3": f.mood3,
  };
}

/** Write the custom accent on an element (the page, or a preview), or take it off again with `null`. */
export function setAccentVars(el: HTMLElement, vars: Record<string, string> | null): void {
  for (const name of ACCENT_VARS) {
    if (vars) el.style.setProperty(name, vars[name]);
    else el.style.removeProperty(name);
  }
}

/** The page background of each theme (--bg in tokens.css), for the contrast figures the designer shows. */
export const PAGE_BG = { light: "#f6f4ee", dark: "#0b1014" } as const;

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => {
      const x = parseInt(hex.slice(i, i + 2), 16) / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** A plain name for a hue, so the slider says more than a number of degrees. */
export function hueName(hue: number): string {
  const names: [number, string][] = [[20, "Rose"], [45, "Red"], [75, "Orange"], [100, "Amber"], [125, "Olive"], [160, "Green"], [185, "Jade"], [215, "Teal"], [240, "Azure"], [270, "Blue"], [295, "Indigo"], [320, "Violet"], [345, "Magenta"]];
  const h = normHue(hue, 0);
  return names.find(([upTo]) => h < upTo)?.[1] ?? "Rose";
}

const R = ACCENT_RECIPE;

/**
 * The same derivation, by hand, for the script that runs before first paint
 * (PREFS_BOOT_SCRIPT in lib/prefs.ts). There `d` is <html>, `s` its dataset
 * (theme already resolved) and `p` the stored preferences. It must write
 * exactly what customAccentVars() writes: accent-contrast.cjs runs both for
 * every hue in both themes and fails on any difference.
 */
export const ACCENT_BOOT_JS = `if(p.accent==="custom"){var N=function(n,f){return typeof n=="number"&&isFinite(n)?((Math.round(n)%360)+360)%360:f},K=function(L,C,h){var t=h*Math.PI/180,c=Math.cos(t),n=Math.sin(t),a,b,l,m,z,r,o,i,x,v;for(;;){a=C*c;b=C*n;l=Math.pow(L+.3963377774*a+.2158037573*b,3);m=Math.pow(L-.1055613458*a-.0638541728*b,3);z=Math.pow(L-.0894841775*a-1.291485548*b,3);r=[4.0767416621*l-3.3077115913*m+.2309699292*z,-1.2684380046*l+2.6097574011*m-.3413193965*z,-.0041960863*l-.7034186147*m+1.707614701*z];if(C<.002||(r[0]>=0&&r[0]<=1&&r[1]>=0&&r[1]<=1&&r[2]>=0&&r[2]<=1)){o="#";for(i=0;i<3;i++){x=Math.min(1,Math.max(0,r[i]));v=Math.round(255*(x<=.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-.055));o+=(v<16?"0":"")+v.toString(16)}return o}C*=.96}},h=N(p.accentHue,${DEFAULT_ACCENT_HUE}),g=typeof p.accentHue2=="number"&&p.accentHue2>=0?N(p.accentHue2,h):(h+320)%360,k=s.theme==="dark",m1=K(${R.mood1[0]},${R.mood1[1]},h),m2=K(${R.mood2[0]},${R.mood2[1]},g),m3=K(${R.mood3[0]},${R.mood3[1]},h),V=["--accent",k?m1:K(${R.accent[0]},${R.accent[1]},h),"--accent-ink",k?"${ACCENT_INK.dark}":"${ACCENT_INK.light}","--accent-2",k?m2:K(${R.accent2[0]},${R.accent2[1]},g),"--accent-3",k?m3:K(${R.accent3[0]},${R.accent3[1]},h),"--mood-1",m1,"--mood-2",m2,"--mood-3",m3],j;for(j=0;j<V.length;j+=2)d.style.setProperty(V[j],V[j+1])}`;

/**
 * THE START-UP flag.
 *
 * The site's start-up animation is shown once per browser. Like every other
 * GIO4X preference the note of it is kept only in this browser (localStorage),
 * never sent anywhere, and cleared by the privacy reset (see LOCAL_KEYS in
 * lib/prefs).
 *
 * There are two forms of it, and a browser sees one of them, once:
 *   - "intro": the first page of the first visit is the homepage. The logo
 *     forms from particles and hands over to the hero (components/cockpit/Boot).
 *   - "run": the first page is any other. The short power-on (cockpit.css).
 * A visitor who arrives elsewhere first never sees the intro later.
 */
export const BOOT_KEY = "gx:boot";

/** Dispatched on `window` when the intro has ended, however it ended. */
export const INTRO_END = "gx:intro-end";

/** The intro is on screen (client only). The tour's invitation waits for it. */
export function introPlaying(): boolean {
  const boot = document.documentElement.dataset.boot;
  return boot === "intro" || boot === "play";
}

/**
 * Runs before first paint, after the preferences script (it reads the motion
 * and effects choices that script has just applied). The flag is written on the
 * first page of the first visit whether or not the animation is shown: under
 * reduced motion or low visual effects it is left out, and it is not kept for
 * a later visit either. Where storage is unavailable nothing is shown: it could
 * not be remembered, so it would repeat on every page.
 */
export const BOOT_SCRIPT = `(function(){try{var d=document.documentElement,s=d.dataset;if(localStorage.getItem("${BOOT_KEY}"))return;localStorage.setItem("${BOOT_KEY}",String(Date.now()));if(s.motion==="reduced"||s.effects==="low"||matchMedia("(prefers-reduced-motion: reduce)").matches)return;s.boot=location.pathname==="/"?"intro":"run"}catch(e){}})();`;

/**
 * THE START-UP flag.
 *
 * The cockpit's power-on sequence is shown once per browser. Like every other
 * GIO4X preference it is kept only in this browser (localStorage), never sent
 * anywhere, and cleared by the privacy reset (see LOCAL_KEYS in lib/prefs).
 */
export const BOOT_KEY = "gx:boot";

/**
 * Runs before first paint, after the preferences script (it reads the motion
 * and effects choices that script has just applied). The start-up is never
 * shown under reduced motion or low visual effects, and never where storage
 * is unavailable: it could not be remembered, so it would repeat on every page.
 */
export const BOOT_SCRIPT = `(function(){try{var d=document.documentElement,s=d.dataset;if(localStorage.getItem("${BOOT_KEY}"))return;if(s.motion==="reduced"||s.effects==="low"||matchMedia("(prefers-reduced-motion: reduce)").matches)return;localStorage.setItem("${BOOT_KEY}",String(Date.now()));s.boot="run"}catch(e){}})();`;

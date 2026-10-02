"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The 777 Raptor logo, arriving the way the owner's pen stages it: an unstable
 * orb detonates, the logo is born out of the flash, cools, and flies out of
 * the screen at the viewer; then the stage closes and it happens again.
 *
 * Built so that the plain logo is never lost:
 *  - the server renders the still logo, and that is what stays for anyone who
 *    has reduced motion or "low visual effects" on, has no WebGL, or whose
 *    browser could not load the scene;
 *  - the scene (Three.js, about half a megabyte) is fetched only when the band
 *    comes near the viewport, and only on this page;
 *  - it runs only while the band is on screen, the tab is visible and the page
 *    is not being scrolled, and gives its WebGL context back on leaving.
 *
 * It is decoration: hidden from assistive technology, never takes a click.
 * The heading beside it names 777 Raptor in text.
 */
export function RaptorBreach({ logo, logoWebp, width, height }: { logo: string; logoWebp: string; width: number; height: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const calm = () => reduced.matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";

    let dead = false;
    let stop: (() => void) | null = null;
    let loading = false;
    let failed = false;

    const start = async () => {
      if (dead || stop || loading || failed || calm()) return;
      loading = true;
      try {
        const { createBreach } = await import("@/components/platforms/breach/scene");
        if (dead || calm()) return;

        // The canvas is created here rather than in JSX: a scene that hands its
        // WebGL context back leaves the element it drew on unusable, and React
        // would reuse a JSX canvas on the next mount.
        const canvas = document.createElement("canvas");
        host.appendChild(canvas);
        const scene = createBreach(canvas, host);
        if (!scene) {
          // no WebGL here: the still logo stands, and there is no point asking again
          failed = true;
          canvas.remove();
          return;
        }

        let w = 0;
        let h = 0;
        const size = () => {
          const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
          const nw = Math.max(1, host.clientWidth);
          const nh = Math.max(1, host.clientHeight);
          if (nw === w && nh === h) return;
          w = nw;
          h = nh;
          scene.resize(w, h, dpr);
        };
        size();

        // A clock that only moves while the scene is drawing, so nothing jumps after a pause.
        let raf = 0;
        let running = false;
        let onScreen = true;
        let scrolling = false;
        let idle = 0;
        let elapsed = 0;
        let origin = 0;
        let rebase = true;
        const tick = (now: number) => {
          if (rebase) {
            origin = now - elapsed * 1000;
            rebase = false;
          }
          elapsed = (now - origin) / 1000;
          scene.frame(elapsed);
          raf = requestAnimationFrame(tick);
        };
        const sync = () => {
          const want = onScreen && !document.hidden && !scrolling;
          if (want && !running) {
            running = true;
            rebase = true;
            raf = requestAnimationFrame(tick);
          } else if (!want && running) {
            running = false;
            cancelAnimationFrame(raf);
          }
        };
        // Eighty thousand additive points and a scrolling page compete for the
        // same frames; the scroll wins, and the scene carries on when it stops.
        const onScroll = () => {
          scrolling = true;
          sync();
          window.clearTimeout(idle);
          idle = window.setTimeout(() => {
            scrolling = false;
            sync();
          }, 150);
        };

        const ro = new ResizeObserver(size);
        ro.observe(host);
        const io = new IntersectionObserver(([entry]) => {
          onScreen = entry?.isIntersecting ?? false;
          sync();
        });
        io.observe(host);
        document.addEventListener("visibilitychange", sync);
        window.addEventListener("scroll", onScroll, { passive: true });

        scene.frame(0);
        setLive(true);
        sync();

        stop = () => {
          running = false;
          cancelAnimationFrame(raf);
          window.clearTimeout(idle);
          ro.disconnect();
          io.disconnect();
          document.removeEventListener("visibilitychange", sync);
          window.removeEventListener("scroll", onScroll);
          try {
            scene.dispose();
          } catch {
            /* leaving must not throw */
          }
          canvas.remove();
          delete host.dataset.phase;
          delete host.dataset.haze;
          stop = null;
          setLive(false);
        };
        if (dead) stop();
      } catch {
        failed = true; // the still logo stands
      } finally {
        loading = false;
      }
    };

    // fetch the scene only when the band is close
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void start();
      },
      { rootMargin: "600px 0px" },
    );
    near.observe(host);

    // motion or effects preference changed: stop to the still logo, or start
    const onPrefs = () => {
      if (calm()) stop?.();
      else if (host.getBoundingClientRect().top < window.innerHeight + 600 && host.getBoundingClientRect().bottom > -600) void start();
    };
    window.addEventListener("gx:prefs", onPrefs);
    reduced.addEventListener("change", onPrefs);

    return () => {
      dead = true;
      near.disconnect();
      window.removeEventListener("gx:prefs", onPrefs);
      reduced.removeEventListener("change", onPrefs);
      stop?.();
    };
  }, []);

  return (
    <div className="gx-breach" data-live={live ? "" : undefined} aria-hidden>
      <div ref={hostRef} className="gx-breach-scene">
        <div className="gx-breach-haze" />
        <div className="gx-breach-flash" data-breach-flash />
        <div className="gx-breach-curtain" />
        {/* the logo the explosion gives birth to */}
        <img src={logoWebp} alt="" width={width} height={height} decoding="async" className="gx-breach-logo" />
      </div>
      {/* the still logo: what is shown until, and unless, the scene runs */}
      <picture className="gx-breach-still">
        <source srcSet={logoWebp} type="image/webp" />
        <img src={logo} alt="" width={width} height={height} loading="lazy" decoding="async" />
      </picture>
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { SoundEngine, SoundLevel } from "@/components/sound/engine";
import { isSoundKind, SOUND_EVENT } from "@/components/sound/signal";
import { usePrefs } from "@/hooks/usePrefs";

/**
 * Interface sounds, off by default. Renders nothing.
 *
 * While the "Interface sounds" switch on /preferences is off, this component
 * does nothing at all: no listener is attached, the engine's code is not
 * loaded and no AudioContext exists. Switching it on loads the engine and
 * creates the context (that click is the gesture a browser asks for). On a
 * later visit with the switch already on, the context waits for the first
 * press of a key or pointer, so nothing is created behind a page that is only
 * being read. Switching it off, or choosing "Low visual effects", closes the
 * context again.
 *
 * Nothing else on the site knows about sound. The sounds are found by
 * delegation, from the document:
 *   - the pointer (mouse or pen) or keyboard focus arriving on a primary
 *     button or a header navigation item: a tick;
 *   - a tab being chosen: a softer tick;
 *   - a field failing validation or an alert appearing: a muted knock;
 *   - a `gx:sound` window event (the guided tour, the sample button): whatever
 *     it names.
 * The hero instruments have no "woke under the pointer" signal to listen for
 * (the engine keeps that state to itself), so they are silent.
 */

const TICK = ".btn-primary, .btn-accent, [data-nav], header[data-site-header] nav a";
const TAB = '[role="tab"]';
const ALERT = '[role="alert"], .field-error';

function match(target: EventTarget | null, selector: string): Element | null {
  return target instanceof Element ? target.closest(selector) : null;
}

export function SoundFx() {
  const pathname = usePathname();
  const [prefs] = usePrefs();
  // GIO4X Control never mounts the site shell; the check is a second lock on the same door
  const on = prefs.sound === true && prefs.effects !== "low" && !(pathname?.startsWith("/control") ?? false);
  const level: SoundLevel = prefs.soundLevel === "normal" ? "normal" : "quiet";

  const engineRef = useRef<SoundEngine | null>(null);
  const levelRef = useRef<SoundLevel>(level);

  useEffect(() => {
    if (!on) return;
    let dead = false;
    let create: ((level: SoundLevel) => SoundEngine | null) | null = null;
    let engine: SoundEngine | null = null;
    let failed = false;
    let hello = 0;

    const ensure = (): SoundEngine | null => {
      if (engine || dead || failed || !create) return engine;
      engine = create(levelRef.current);
      if (!engine) failed = true;
      engineRef.current = engine;
      return engine;
    };

    // a press of a key or pointer is what lets a browser start audio
    const onGesture = () => ensure()?.wake();

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !engine) return;
      const el = match(e.target, TICK);
      if (!el) return;
      // moving about inside the same control is not arriving on it
      if (e.relatedTarget instanceof Node && el.contains(e.relatedTarget)) return;
      engine.play("tick");
    };

    const onFocus = (e: FocusEvent) => {
      if (!engine || !(e.target instanceof Element)) return;
      let keyboard = false;
      try {
        keyboard = e.target.matches(":focus-visible");
      } catch {
        /* no :focus-visible: stay silent on focus */
      }
      if (!keyboard) return;
      if (match(e.target, TAB)) engine.play("soft");
      else if (match(e.target, TICK)) engine.play("tick");
    };

    const onClick = (e: MouseEvent) => {
      if (engine && match(e.target, TAB)) engine.play("soft");
    };

    const onInvalid = () => engine?.play("knock");

    const onSignal = (e: Event) => {
      const kind = (e as CustomEvent<unknown>).detail;
      if (isSoundKind(kind)) engine?.play(kind);
    };

    const onVisibility = () => {
      if (document.hidden) engine?.sleep();
      else engine?.wake();
    };

    // an error message arriving in the page (forms here show theirs as role="alert")
    const watcher = new MutationObserver((records) => {
      if (!engine) return;
      for (const r of records) {
        for (const n of r.addedNodes) {
          if (n instanceof Element && n.matches(ALERT)) {
            engine.play("knock");
            return;
          }
        }
      }
    });

    void import("@/components/sound/engine")
      .then((m) => {
        if (dead) return;
        create = m.createEngine;
        const activation = "userActivation" in navigator ? navigator.userActivation : null;
        // already pressed something on this page: the context may start now
        if (activation?.hasBeenActive) ensure();
        // pressed something a moment ago: that was the switch, so answer it
        if (engine && activation?.isActive) hello = window.setTimeout(() => engine?.play("chime"), 160);
      })
      .catch(() => {
        /* the chunk did not load: the site stays silent */
      });

    document.addEventListener("pointerdown", onGesture, { passive: true });
    document.addEventListener("keydown", onGesture, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("focusin", onFocus);
    document.addEventListener("click", onClick);
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(SOUND_EVENT, onSignal);
    watcher.observe(document.body, { childList: true, subtree: true });

    return () => {
      dead = true;
      window.clearTimeout(hello);
      document.removeEventListener("pointerdown", onGesture);
      document.removeEventListener("keydown", onGesture);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("click", onClick);
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(SOUND_EVENT, onSignal);
      watcher.disconnect();
      engine?.close();
      engineRef.current = null;
    };
  }, [on]);

  // the volume choice reaches a running engine without rebuilding it, and is answered with a sample
  useEffect(() => {
    if (levelRef.current === level) return;
    levelRef.current = level;
    const engine = engineRef.current;
    if (!engine) return;
    engine.setLevel(level);
    engine.play("chime");
  }, [level]);

  return null;
}

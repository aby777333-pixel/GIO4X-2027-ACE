/**
 * The interface sounds, synthesised.
 *
 * Every sound is an oscillator through a low-pass filter and a gain envelope,
 * built when it is asked for and thrown away when it ends: there are no audio
 * files and nothing is fetched. Each is quiet and shorter than 120ms.
 *
 * This module is loaded only after a visitor has switched sound on (SoundFx
 * imports it on demand), and an AudioContext exists only between
 * createEngine() and close().
 */
import type { SoundKind } from "@/components/sound/signal";

export type SoundLevel = "quiet" | "normal";

export type SoundEngine = {
  play: (kind: SoundKind) => void;
  setLevel: (level: SoundLevel) => void;
  /** the tab was hidden: stop the audio clock */
  sleep: () => void;
  /** the tab is back, or the visitor has just pressed something: let it run */
  wake: () => void;
  close: () => void;
};

/** The master gain for each volume choice. The voices below peak well under 0.1, so both are quiet. */
const MASTER: Record<SoundLevel, number> = { quiet: 0.45, normal: 1 };

/** No two sounds closer together than this, so a pointer swept across a row of buttons cannot machine-gun. */
const GAP_MS = 90;
/** A chime is an event, not a texture: at most one in this time. */
const CHIME_GAP_MS = 420;
const KNOCK_GAP_MS = 600;

type Voice = {
  wave: OscillatorType;
  /** frequency at the start and at the end, Hz */
  from: number;
  to: number;
  /** seconds after "now" */
  at: number;
  /** seconds */
  length: number;
  peak: number;
  /** low-pass cutoff, Hz: what makes a click soft instead of sharp */
  cutoff: number;
};

const VOICES: Record<SoundKind, Voice[]> = {
  // a small, dry instrument click
  tick: [{ wave: "triangle", from: 1850, to: 1250, at: 0, length: 0.034, peak: 0.05, cutoff: 3200 }],
  // the same click with the edge taken off
  soft: [{ wave: "sine", from: 920, to: 700, at: 0, length: 0.046, peak: 0.036, cutoff: 1600 }],
  // two low notes a fourth apart, the second overlapping the first
  chime: [
    { wave: "sine", from: 392, to: 392, at: 0, length: 0.062, peak: 0.05, cutoff: 1800 },
    { wave: "sine", from: 523.25, to: 523.25, at: 0.048, length: 0.066, peak: 0.044, cutoff: 1800 },
  ],
  // a muted knock on wood
  knock: [{ wave: "triangle", from: 165, to: 92, at: 0, length: 0.085, peak: 0.085, cutoff: 420 }],
};

type AudioContextCtor = typeof AudioContext;

function contextCtor(): AudioContextCtor | undefined {
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

/** Creates the one AudioContext. Returns null where the browser has no Web Audio or refuses one. */
export function createEngine(level: SoundLevel): SoundEngine | null {
  const Ctor = contextCtor();
  if (!Ctor) return null;
  let ctx: AudioContext;
  try {
    ctx = new Ctor({ latencyHint: "interactive" });
  } catch {
    return null;
  }
  const master = ctx.createGain();
  master.gain.value = MASTER[level];
  master.connect(ctx.destination);

  let closed = false;
  let lastAny = -Infinity;
  const lastOf: Record<SoundKind, number> = { tick: -Infinity, soft: -Infinity, chime: -Infinity, knock: -Infinity };

  const sound = (v: Voice) => {
    const start = ctx.currentTime + v.at;
    const end = start + v.length;
    const osc = ctx.createOscillator();
    osc.type = v.wave;
    osc.frequency.setValueAtTime(v.from, start);
    if (v.to !== v.from) osc.frequency.exponentialRampToValueAtTime(v.to, end);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = v.cutoff;
    // exponential ramps cannot start or end at zero, so the envelope rests just above it
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(v.peak, start + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(filter);
    filter.connect(env);
    env.connect(master);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      env.disconnect();
    };
    osc.start(start);
    osc.stop(end + 0.01);
  };

  return {
    play(kind) {
      if (closed || document.hidden) return;
      // a context made before the visitor's first press waits for one; nothing is queued for later
      if (ctx.state !== "running") return;
      const now = performance.now();
      const own = kind === "chime" ? CHIME_GAP_MS : kind === "knock" ? KNOCK_GAP_MS : GAP_MS;
      if (now - lastAny < GAP_MS || now - lastOf[kind] < own) return;
      lastAny = now;
      lastOf[kind] = now;
      try {
        for (const v of VOICES[kind]) sound(v);
      } catch {
        /* a sound that cannot be made is simply not heard */
      }
    },
    setLevel(next) {
      if (!closed) master.gain.value = MASTER[next];
    },
    sleep() {
      if (!closed && ctx.state === "running") void ctx.suspend().catch(() => {});
    },
    wake() {
      if (!closed && !document.hidden && ctx.state === "suspended") void ctx.resume().catch(() => {});
    },
    close() {
      if (closed) return;
      closed = true;
      master.disconnect();
      void ctx.close().catch(() => {});
    },
  };
}

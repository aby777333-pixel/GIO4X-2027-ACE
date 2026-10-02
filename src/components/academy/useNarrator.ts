"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { sentenceAt, sentenceSpans, speakBlock, type Span, type Spoken } from "./narrate";

/**
 * Reads a lesson aloud, chapter by chapter, with the browser's own speech
 * engine (`window.speechSynthesis`) and nothing else.
 *
 * Privacy. Only voices the browser marks as local to the device are offered
 * (`localService`). Some browsers also list voices that work by sending the
 * text to a server: those are never used, so the lesson's text does not leave
 * the page. Nothing is downloaded and nothing is stored: the speed and voice
 * chosen last only while the page is open.
 *
 * It never starts by itself. It stops when this hook unmounts (the visitor
 * leaves the lesson or switches back to "Read") and when the page is hidden
 * for good (`pagehide`).
 *
 * What is read: inside each `[data-chapter]`, the heading and then every
 * paragraph, list item and table row of the text, in the order of the page.
 * Each is one utterance, made speakable by ./narrate. The block being read
 * carries `data-speaking`; where the engine reports boundaries, the sentence
 * being spoken is also marked with the CSS Custom Highlight API (no element is
 * added to the page). Where it reports none, or the browser has no highlight
 * registry, the block stays marked and that is all.
 */

export type NarratorStatus = "idle" | "playing" | "paused";
/** checking: voices not listed yet. none: no speech in this browser. no-voice: speech, but no English voice. remote-only: its English voices all work by sending the text away. */
export type NarratorSupport = "checking" | "none" | "no-voice" | "remote-only" | "ready";
export type NarratorVoice = { id: string; label: string };
export const NARRATOR_RATES = [0.8, 1, 1.2] as const;
export type NarratorRate = (typeof NARRATOR_RATES)[number];

const HIGHLIGHT = "gx-narration";

type Block = {
  el: HTMLElement;
  chapter: number;
  /** the first block of its chapter */
  first: boolean;
  text: string;
  spans: Span[];
  spoken: Spoken;
  row: boolean;
};

const isEnglish = (v: SpeechSynthesisVoice) => /^en(?:[-_]|$)/i.test(v.lang);
/** en-GB first, then the browser's default, then by name */
const rank = (v: SpeechSynthesisVoice) => (/^en[-_]GB$/i.test(v.lang) ? 0 : 2) + (v.default ? 0 : 1);

function collect(root: HTMLElement): Block[] {
  const out: Block[] = [];
  root.querySelectorAll<HTMLElement>("[data-chapter]").forEach((section, chapter) => {
    let first = true;
    section.querySelectorAll<HTMLElement>("[data-story-head], [data-story-text] p, [data-story-text] li, [data-story-text] tr").forEach((el) => {
      // a paragraph inside a list item or a cell is read with it
      if (!el.matches("[data-story-head]") && el.parentElement?.closest("li, tr, p")) return;
      const row = el instanceof HTMLTableRowElement;
      const text = row
        ? [...el.cells]
            .map((c) => (c.textContent ?? "").replace(/\s+/g, " ").trim())
            .filter(Boolean)
            .join(", ")
        : (el.textContent ?? "");
      const spans = row ? [{ start: 0, end: text.length }] : sentenceSpans(text);
      const spoken = speakBlock(text, spans);
      if (!spoken.text) return;
      out.push({ el, chapter, first, text, spans, spoken, row });
      first = false;
    });
  });
  return out;
}

/** The range of the page that holds characters [start, end) of an element's text. */
function rangeOf(el: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let seen = 0;
  let opened = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.nodeValue?.length ?? 0;
    if (!opened && start < seen + length) {
      range.setStart(node, Math.max(0, start - seen));
      opened = true;
    }
    if (opened && end <= seen + length) {
      range.setEnd(node, Math.max(0, end - seen));
      return range;
    }
    seen += length;
  }
  return null;
}

type Registry = { set: (name: string, value: unknown) => void; delete: (name: string) => void };
type HighlightCtor = new (...ranges: Range[]) => unknown;

function paintSentence(range: Range | null): void {
  try {
    const registry = (CSS as unknown as { highlights?: Registry }).highlights;
    const Ctor = (window as unknown as { Highlight?: HighlightCtor }).Highlight;
    if (!registry || !Ctor) return;
    if (range) registry.set(HIGHLIGHT, new Ctor(range));
    else registry.delete(HIGHLIGHT);
  } catch {
    /* no highlight registry: the block's own mark is the whole of it */
  }
}

export type Narrator = {
  support: NarratorSupport;
  status: NarratorStatus;
  /** index of the chapter being read, or null */
  chapter: number | null;
  voices: NarratorVoice[];
  voice: string;
  rate: NarratorRate;
  /** why a reading stopped by itself, in words; "" otherwise */
  problem: string;
  play: (fromChapter: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setVoice: (id: string) => void;
  setRate: (rate: NarratorRate) => void;
};

export function useNarrator(root: RefObject<HTMLElement | null>): Narrator {
  const [support, setSupport] = useState<NarratorSupport>("checking");
  const [status, setStatus] = useState<NarratorStatus>("idle");
  const [chapter, setChapter] = useState<number | null>(null);
  const [voices, setVoices] = useState<NarratorVoice[]>([]);
  const [voice, setVoiceId] = useState("");
  const [rate, setRateValue] = useState<NarratorRate>(1);
  const [problem, setProblem] = useState("");

  const list = useRef<SpeechSynthesisVoice[]>([]);
  const voiceRef = useRef("");
  const rateRef = useRef<NarratorRate>(1);
  const blocks = useRef<Block[]>([]);
  const at = useRef(0);
  /** each reading of a block has a number: an event from an utterance that was cancelled is recognised and ignored */
  const run = useRef(0);
  /** kept so the engine cannot lose the utterance (and its events) to garbage collection while it speaks */
  const speaking = useRef<SpeechSynthesisUtterance | null>(null);
  const marked = useRef<HTMLElement | null>(null);
  /** the voice or speed changed during a pause: the block is begun again on resume */
  const stale = useRef(false);
  const statusRef = useRef<NarratorStatus>("idle");
  const setState = (s: NarratorStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  const unmark = () => {
    marked.current?.removeAttribute("data-speaking");
    marked.current = null;
    paintSentence(null);
  };

  const halt = useCallback(() => {
    run.current++;
    speaking.current = null;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* nothing was speaking */
    }
    unmark();
    stale.current = false;
    setState("idle");
    setChapter(null);
  }, []);

  const speakFrom = useCallback(
    (index: number) => {
      const synth = window.speechSynthesis;
      const block = blocks.current[index];
      const chosen = list.current.find((v) => v.voiceURI === voiceRef.current);
      if (!block || !chosen) {
        halt();
        return;
      }
      const mine = ++run.current;
      at.current = index;
      stale.current = false;

      unmark();
      block.el.setAttribute("data-speaking", "");
      marked.current = block.el;
      setChapter(block.chapter);
      // a new chapter is brought to the top; within a chapter, a block that has left the window is brought back
      const rect = block.el.getBoundingClientRect();
      const section = block.el.closest<HTMLElement>("[data-chapter]");
      if (block.first && section) section.scrollIntoView({ block: "start" });
      else if (rect.top < 120 || rect.bottom > window.innerHeight - 40) block.el.scrollIntoView({ block: "center" });

      const u = new window.SpeechSynthesisUtterance(block.spoken.text);
      u.voice = chosen;
      u.lang = chosen.lang;
      u.rate = rateRef.current;
      u.onboundary = (e) => {
        if (mine !== run.current) return;
        if (block.row) {
          const range = document.createRange();
          range.selectNodeContents(block.el);
          paintSentence(range);
          return;
        }
        const span = block.spans[block.spoken.from[sentenceAt(block.spoken.starts, e.charIndex)]];
        paintSentence(span ? rangeOf(block.el, span.start, span.end) : null);
      };
      u.onend = () => {
        if (mine !== run.current) return;
        if (index + 1 < blocks.current.length) speakFrom(index + 1);
        else halt();
      };
      u.onerror = (e) => {
        if (mine !== run.current) return;
        // cancelled by this page: not a fault
        if (e.error === "interrupted" || e.error === "canceled") return;
        halt();
        setProblem("The browser’s voice stopped and could not continue. You can try again, or choose another voice.");
      };
      speaking.current = u;
      try {
        synth.speak(u);
      } catch {
        halt();
        setProblem("The browser could not start its voice.");
      }
    },
    [halt],
  );

  const play = useCallback(
    (fromChapter: number) => {
      const el = root.current;
      if (!el || support !== "ready") return;
      setProblem("");
      blocks.current = collect(el);
      const start = blocks.current.findIndex((b) => b.chapter >= fromChapter);
      if (start < 0) return;
      try {
        // whatever an earlier page left in the queue is not this lesson
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
      setState("playing");
      speakFrom(start);
    },
    [root, support, speakFrom],
  );

  const pause = useCallback(() => {
    if (statusRef.current !== "playing") return;
    try {
      window.speechSynthesis.pause();
    } catch {
      /* ignore */
    }
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    if (statusRef.current !== "paused") return;
    setState("playing");
    if (stale.current) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
      speakFrom(at.current);
      return;
    }
    try {
      window.speechSynthesis.resume();
    } catch {
      /* ignore */
    }
  }, [speakFrom]);

  /** a new voice or speed takes effect at once: the block being read is begun again with it */
  const retune = useCallback(() => {
    if (statusRef.current === "playing") {
      run.current++;
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
      speakFrom(at.current);
    } else if (statusRef.current === "paused") stale.current = true;
  }, [speakFrom]);

  const setVoice = useCallback(
    (id: string) => {
      if (!list.current.some((v) => v.voiceURI === id)) return;
      voiceRef.current = id;
      setVoiceId(id);
      retune();
    },
    [retune],
  );

  const setRate = useCallback(
    (next: NarratorRate) => {
      rateRef.current = next;
      setRateValue(next);
      retune();
    },
    [retune],
  );

  /* ---- the voices this browser has ---- */
  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth || typeof window.SpeechSynthesisUtterance !== "function") {
      setSupport("none");
      return;
    }
    let settled = false;
    const load = (final: boolean) => {
      let all: SpeechSynthesisVoice[] = [];
      try {
        all = synth.getVoices();
      } catch {
        all = [];
      }
      const own = all.filter((v) => isEnglish(v) && v.localService).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
      if (own.length > 0) {
        settled = true;
        list.current = own;
        setVoices(own.map((v) => ({ id: v.voiceURI, label: `${v.name} (${v.lang.replace("_", "-")})` })));
        if (!own.some((v) => v.voiceURI === voiceRef.current)) {
          voiceRef.current = own[0].voiceURI;
          setVoiceId(own[0].voiceURI);
        }
        setSupport("ready");
      } else if (final || all.length > 0) {
        settled = true;
        list.current = [];
        setVoices([]);
        setSupport(all.some(isEnglish) ? "remote-only" : "no-voice");
      }
    };
    const onVoices = () => load(true);
    load(false);
    // most browsers list their voices a moment after the page loads, and say so; some never say so
    const late = window.setTimeout(() => {
      if (!settled) load(true);
    }, 1800);
    if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", onVoices);
    return () => {
      window.clearTimeout(late);
      if (typeof synth.removeEventListener === "function") synth.removeEventListener("voiceschanged", onVoices);
    };
  }, []);

  /* ---- leaving stops it ---- */
  useEffect(() => {
    const onHide = () => halt();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      // only a reading this hook began is cancelled: a page that never played leaves the engine alone
      if (statusRef.current !== "idle") halt();
    };
  }, [halt]);

  return { support, status, chapter, voices, voice, rate, problem, play, pause, resume, stop: halt, setVoice, setRate };
}

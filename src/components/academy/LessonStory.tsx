"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { memo, useCallback, useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { rememberBaseline } from "@/components/desk/badges";
import { readLearned } from "@/components/glossary/learn";
import { usePrefs } from "@/hooks/usePrefs";
import type { StoryChapter, StoryPanel } from "./story-panels";
import { NARRATOR_RATES, useNarrator, type Narrator } from "./useNarrator";
import "./story.css";

/**
 * The body of an Academy lesson, shown one of two ways.
 *
 * "Read" is the lesson as it has always been: the same element, the same
 * HTML, and what the server sends to everyone.
 *
 * "Story" is the same text, in the same order, laid out as chapters (one per
 * heading, and the opening before the first): each chapter fills the window,
 * with a panel pinned beside its text while it scrolls, a rail of the
 * chapters at the side and a line showing how far through the visitor is.
 * A "Listen" control reads the lesson aloud with the browser's own voice
 * (./useNarrator). Nothing is rewritten and nothing is added to what the
 * lesson says: a panel shows a diagram labelled with the lesson's words, or
 * one of the chapter's own sentences (src/data/academy-story.ts).
 *
 * The choice is remembered as `lessonMode` in the visitor's preferences
 * (`gx:prefs`); a link ending in `#story` opens a lesson in story mode
 * whatever is remembered. Read is the default.
 *
 * Motion: a panel fades up as its chapter arrives; under reduced motion (the
 * system setting, or the site's own switches) it is simply there, the
 * diagrams draw their still frame, and the layout is unchanged. Narration
 * does not depend on the motion settings and never starts by itself.
 */

type Mode = "read" | "story";
const HASH = "#story";

// the sixteen diagram kinds are fetched when story mode is first opened, not with every lesson
const TermDiagram = dynamic(() => import("@/components/glossary/diagrams/TermDiagram").then((m) => m.TermDiagram), {
  ssr: false,
  loading: () => <div className="skeleton aspect-[1.7] w-full" aria-hidden />,
});

type Props = {
  chapters: StoryChapter[];
  /** what follows the lesson's text on the page (the exercise, the questions): listed at the foot of the chapter rail */
  after?: { id: string; text: string }[];
};

export function LessonStory({ chapters, after = [] }: Props) {
  const [prefs, update, ready] = usePrefs();
  const [mode, setMode] = useState<Mode>("read");
  const settled = useRef(false);

  // once the stored preferences are known: the address decides first, then what is remembered
  useEffect(() => {
    if (!ready || settled.current) return;
    settled.current = true;
    // a lesson is where progress is made: note the record as it stands, so a milestone earned here is new on My desk (memory only)
    rememberBaseline(readLearned(), prefs.tourDone === true);
    if (window.location.hash === HASH || prefs.lessonMode === "story") setMode("story");
  }, [ready, prefs.lessonMode, prefs.tourDone]);

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === HASH) setMode("story");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const choose = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    update({ lessonMode: next });
    try {
      // the address says which way the lesson is shown, so it can be copied as it is
      const { pathname, search, hash } = window.location;
      if (next === "story") window.history.replaceState(null, "", `${pathname}${search}${HASH}`);
      else if (hash === HASH) window.history.replaceState(null, "", `${pathname}${search}`);
    } catch {
      /* the address stays as it was */
    }
  };

  const toggle = (
    <div className="seg shrink-0" role="group" aria-label="How this lesson is shown">
      <button type="button" aria-pressed={mode === "read"} onClick={() => choose("read")} data-lesson-choose="read">
        Read
      </button>
      <button type="button" aria-pressed={mode === "story"} onClick={() => choose("story")} data-lesson-choose="story">
        Story
      </button>
    </div>
  );

  return (
    <div className="gx-lesson" data-lesson-mode={mode}>
      {mode === "read" ? (
        <>
          <div className="gx-lesson-bar no-print">
            {toggle}
            <p className="min-w-0 text-xs text-ink-3">Story lays the same text out as chapters, each with a diagram beside it, and can read it aloud.</p>
          </div>
          <div className="prose-gx editorial" dangerouslySetInnerHTML={{ __html: chapters.map((c) => c.head + c.html).join("") }} />
        </>
      ) : (
        <Story chapters={chapters} after={after} toggle={toggle} />
      )}
    </div>
  );
}

/* ---- story mode ------------------------------------------------------------------ */

const two = (n: number) => String(n).padStart(2, "0");

function Story({ chapters, after, toggle }: { chapters: StoryChapter[]; after: { id: string; text: string }[]; toggle: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const narrator = useNarrator(root);
  const sections = chapters.filter((c) => c.head).length;

  /* which chapter is in front of the reader, and how far through the story they are */
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.38;
      const rect = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (line - rect.top) / Math.max(1, rect.height - window.innerHeight * 0.3)));
      el.style.setProperty("--p", p.toFixed(4));
      let now = 0;
      el.querySelectorAll<HTMLElement>("[data-chapter]").forEach((s, i) => {
        if (s.getBoundingClientRect().top <= line) now = i;
      });
      setActive(now);
    };
    const queue = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  /* a chapter's panel arrives when the chapter does; where that cannot be observed, every panel is simply there */
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const all = [...el.querySelectorAll<HTMLElement>("[data-chapter]")];
    if (typeof IntersectionObserver === "undefined") {
      all.forEach((s) => s.setAttribute("data-in", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-in", "");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -18% 0px" },
    );
    all.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  /* the rail follows the chapter in view when it is a strip that scrolls sideways (small screens) */
  const rail = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = rail.current;
    const item = list?.children[active] as HTMLElement | undefined;
    if (!list || !item || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: item.offsetLeft - list.clientWidth / 2 + item.clientWidth / 2 });
  }, [active]);

  const goTo = useCallback((e: MouseEvent<HTMLAnchorElement>, index: number) => {
    const section = root.current?.querySelector<HTMLElement>(`[data-chapter="${index}"]`);
    if (!section) return;
    // the address keeps "#story"; the chapter is brought up and takes the focus, so the keyboard continues from it
    e.preventDefault();
    section.scrollIntoView({ block: "start" });
    (section.querySelector<HTMLElement>("[data-story-head]") ?? section).focus({ preventScroll: true });
  }, []);

  return (
    <div ref={root} className="gx-story-root" style={{ "--p": 0 } as CSSProperties}>
      <div className="gx-lesson-bar no-print">
        {toggle}
        <NarratorBar narrator={narrator} chapters={chapters} active={active} />
      </div>
      <NarratorOptions narrator={narrator} />

      <div className="gx-story">
        <nav className="gx-story-rail no-print" aria-label="Chapters of this lesson">
          <span className="gx-story-progress" aria-hidden>
            <span />
          </span>
          <ol ref={rail}>
            {chapters.map((c, i) => (
              <li key={c.id}>
                <a href={`#${c.id}`} aria-current={i === active ? "true" : undefined} onClick={(e) => goTo(e, i)}>
                  <span className="gx-story-dot" aria-hidden />
                  <span className="gx-story-rail-title">{c.title}</span>
                </a>
              </li>
            ))}
          </ol>
          {after.length > 0 && (
            <ul className="gx-story-after">
              {after.map((a) => (
                <li key={a.id}>
                  <a href={`#${a.id}`}>{a.text}</a>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div className="min-w-0">
          {chapters.map((c, i) => {
            const n = c.head ? chapters.slice(0, i + 1).filter((x) => x.head).length : 0;
            return (
              <section
                key={c.id}
                // a chapter with a heading is named by it; the opening has none, so it carries the name and the anchor itself
                {...(c.head ? { "aria-labelledby": c.id } : { id: c.id, "aria-label": "Opening", tabIndex: -1 })}
                data-chapter={i}
                className={`gx-story-chapter ${c.panel ? "" : "gx-story-plain"}`}
              >
                <header className="gx-story-head">
                  <p className="num text-xs font-semibold uppercase tracking-[0.1em] text-ink-3">{c.head ? `Chapter ${two(n)} of ${two(sections)}` : "Opening"}</p>
                  {c.head && (
                    <h2 id={c.id} data-story-head tabIndex={-1} className="h3 mt-8 scroll-mt-[4.25rem] text-ink">
                      {c.title}
                    </h2>
                  )}
                </header>
                {c.panel && (
                  <div className="gx-story-art">
                    <div className="gx-story-art-in">
                      <Panel panel={c.panel} />
                    </div>
                  </div>
                )}
                <StoryText html={c.html} editorial={!c.head} />
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * A chapter's own text. Memoised because React writes `innerHTML` again whenever it is handed a new
 * `dangerouslySetInnerHTML` object, and every render makes one: the paragraphs would be replaced each time
 * the chapter in view or the narrator's state changes, and the narrator's mark on the block being read
 * (and its place in the page) would be lost with them.
 */
const StoryText = memo(function StoryText({ html, editorial }: { html: string; editorial: boolean }) {
  return <div data-story-text className={`gx-story-text prose-gx ${editorial ? "editorial" : ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
});

function Panel({ panel }: { panel: StoryPanel }) {
  if (panel.kind === "quote") {
    // decoration: the sentence is in the chapter beside it, word for word
    return (
      <div aria-hidden className="gx-story-quote font-display" data-story-quote>
        <span className="gx-story-quote-mark">“</span>
        <p>{panel.text}</p>
      </div>
    );
  }
  return (
    <div data-story-diagram={panel.spec.kind}>
      <TermDiagram spec={panel.spec} caption={panel.caption} className="!max-w-none" />
      {panel.term && (
        <p className="mt-8 text-sm text-ink-3">
          In the glossary:{" "}
          <Link href={`/glossary/${panel.term.slug}`} className="link">
            {panel.term.name}
          </Link>
        </p>
      )}
    </div>
  );
}

/* ---- narration controls ----------------------------------------------------------- */

function chapterName(chapters: StoryChapter[], index: number): string {
  const c = chapters[index];
  if (!c) return "";
  if (!c.head) return "the opening";
  const n = chapters.slice(0, index + 1).filter((x) => x.head).length;
  return `chapter ${n} of ${chapters.filter((x) => x.head).length}, “${c.title}”`;
}

/** The buttons that stay in reach while the page scrolls: listen, pause, stop, and what is being read. */
function NarratorBar({ narrator, chapters, active }: { narrator: Narrator; chapters: StoryChapter[]; active: number }) {
  const { support, status, chapter } = narrator;
  if (support !== "ready") return null;
  const where = chapter !== null ? chapterName(chapters, chapter) : "";
  return (
    <>
      <div className="flex items-center gap-8" data-narrator={status}>
        {status === "idle" ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => narrator.play(active)} data-narrator-play>
            <span aria-hidden>▶</span> Listen
          </button>
        ) : status === "playing" ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={narrator.pause} data-narrator-pause>
            <span aria-hidden>❚❚</span> Pause
          </button>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={narrator.resume} data-narrator-resume>
            <span aria-hidden>▶</span> Resume
          </button>
        )}
        <button type="button" className="btn btn-quiet btn-sm" onClick={narrator.stop} disabled={status === "idle"} data-narrator-stop>
          <span aria-hidden>■</span> Stop
        </button>
      </div>
      <p role="status" aria-live="polite" className="min-w-0 flex-1 basis-[12rem] truncate text-xs text-ink-3" data-narrator-status>
        {status === "playing" ? `Reading ${where}` : status === "paused" ? `Paused in ${where}` : ""}
      </p>
    </>
  );
}

/** Speed and voice, and what the control is; or, where the browser cannot read aloud, why not. */
function NarratorOptions({ narrator }: { narrator: Narrator }) {
  const voiceId = useId();
  const { support, voices, voice, rate, problem } = narrator;
  if (support === "checking") return null;
  if (support !== "ready") {
    return (
      <p className="gx-lesson-opts text-sm text-ink-3" data-narrator-unavailable={support}>
        {support === "none"
          ? "Listening is not available: this browser cannot read text aloud."
          : support === "remote-only"
            ? "Listening is not available: this browser’s English voices work by sending the text to a server, and this page sends the lesson nowhere."
            : "Listening is not available: this browser has no English voice installed on this device."}
      </p>
    );
  }
  return (
    <div className="gx-lesson-opts no-print" data-narrator-options>
      <div className="flex flex-wrap items-center gap-x-21 gap-y-8">
        <div className="flex items-center gap-8">
          <span className="label" id={`${voiceId}-speed`}>
            Speed
          </span>
          <div className="seg" role="group" aria-labelledby={`${voiceId}-speed`}>
            {NARRATOR_RATES.map((r) => (
              <button key={r} type="button" aria-pressed={rate === r} onClick={() => narrator.setRate(r)} data-narrator-rate={r} className="!normal-case">
                {r}×<span className="sr-only"> speed</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-8">
          <label htmlFor={voiceId} className="label">
            Voice
          </label>
          <select id={voiceId} className="select !h-[2.125rem] min-w-0 max-w-[16rem] !py-0 text-sm" value={voice} onChange={(e) => narrator.setVoice(e.target.value)} data-narrator-voice>
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-8 max-w-measure text-xs text-ink-3">“Listen” reads the lesson from the chapter in view, in a voice that is already on this device. Nothing is downloaded, the text is sent nowhere, and the speed and voice are not remembered.</p>
      {problem && (
        <p role="status" className="mt-5 text-sm text-ink-2">
          {problem}
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { clearLessons } from "@/components/glossary/learn";
import { useLessonsDone } from "./done";

/**
 * The visitor's progress through the Academy's questions, read from this
 * browser's storage. Like the glossary's, everything here renders nothing on
 * the server and until the page has mounted, and stays absent when no lesson
 * is stored, so the HTML is the same for everyone and there is no hydration
 * mismatch.
 */

const lessonsWord = (n: number) => (n === 1 ? "lesson" : "lessons");

/** "You have completed N of M lessons", with the control that clears the record. */
export function AcademyProgress({ slugs, className = "" }: { slugs: string[]; className?: string }) {
  const done = useLessonsDone();
  const [cleared, setCleared] = useState(false);
  if (done === null) return null;
  const n = slugs.filter((s) => done.has(s)).length;
  if (done.size === 0) {
    return cleared ? (
      <p role="status" className={`text-sm text-ink-3 ${className}`}>
        Progress cleared. No completed lesson is stored in this browser now.
      </p>
    ) : null;
  }
  return (
    <p className={`text-sm text-ink-2 ${className}`} data-academy-progress>
      <span aria-hidden className="mr-5 text-accent">
        ✓
      </span>
      You have completed <span className="num font-semibold text-ink">{n}</span> of <span className="num">{slugs.length}</span> {lessonsWord(slugs.length)}: a lesson counts once its three questions are answered correctly.{" "}
      <span className="text-ink-3">Kept in this browser only.</span>{" "}
      <button
        type="button"
        className="link ml-5 inline-flex min-h-[1.625rem] items-center"
        onClick={() => {
          clearLessons();
          setCleared(true);
        }}
      >
        Start over
      </button>
    </p>
  );
}

/** "3 of 6 lessons completed" for one level or one learning path. Absent until a lesson is stored. */
export function LessonsCount({ slugs, className = "" }: { slugs: string[]; className?: string }) {
  const done = useLessonsDone();
  if (done === null || done.size === 0 || slugs.length === 0) return null;
  const n = slugs.filter((s) => done.has(s)).length;
  return (
    <p className={`num text-sm text-ink-2 ${className}`} data-lessons-count>
      {n === slugs.length && (
        <span aria-hidden className="mr-5 text-accent">
          ✓
        </span>
      )}
      {n} of {slugs.length} {lessonsWord(slugs.length)} completed
    </p>
  );
}

/** A small mark beside a lesson the visitor has completed. */
export function LessonMark({ slug }: { slug: string }) {
  const done = useLessonsDone();
  if (!done?.has(slug)) return null;
  return (
    <span className="ml-8 inline-block align-baseline font-sans text-xs font-semibold tracking-normal text-accent" title="You have completed this lesson" data-lesson-mark>
      <span aria-hidden>✓</span>
      <span className="sr-only"> (completed)</span>
    </span>
  );
}

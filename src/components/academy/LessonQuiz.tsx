"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TermQuiz } from "@/components/glossary/TermQuiz";
import type { LessonQuestions } from "@/data/academy-quiz";
import { lessonKey, markLessonDone, useLessonsDone } from "./done";

/**
 * The three questions at the end of a lesson.
 *
 * Each is the glossary's own form (a fieldset of radio buttons, "Check", the
 * verdict in words with the reason, "Try again"), asked without remembering a
 * single answer. The lesson is completed when all three have been answered
 * correctly; only that fact is stored, in this browser (see ./done).
 * Nothing is sent anywhere and no score is kept.
 */
const WORDS = ["None", "One", "Two", "All three"];

export function LessonQuiz({ slug, questions }: { slug: string; questions: LessonQuestions }) {
  const [right, setRight] = useState<readonly boolean[]>([false, false, false]);
  const done = useLessonsDone();
  const before = Boolean(done?.has(slug));
  const count = right.filter(Boolean).length;
  const all = count === questions.length;
  const [touched, setTouched] = useState(false);

  // stored once, when the third right answer arrives
  useEffect(() => {
    if (all) markLessonDone(slug);
  }, [all, slug]);

  return (
    <div data-lesson-quiz>
      <ol className="grid gap-21">
        {questions.map((q, i) => (
          <li key={i}>
            <p className="label">
              Question {i + 1} of {questions.length}
            </p>
            <TermQuiz
              slug={lessonKey(slug)}
              quiz={q}
              remember={false}
              onResult={(ok) => {
                setTouched(true);
                if (ok) setRight((now) => now.map((v, n) => (n === i ? true : v)));
              }}
            />
          </li>
        ))}
      </ol>

      <div role="status" aria-live="polite" className="mt-21 max-w-measure text-sm text-ink-2">
        {all ? (
          <p>
            <span aria-hidden className="mr-5 text-accent">
              ✓
            </span>
            <strong className="font-semibold text-ink">All three answered correctly.</strong> This lesson is marked as completed in this browser. Nothing is sent anywhere and no score is kept.{" "}
            <Link href="/academy#curriculum" className="link">
              See your progress in the curriculum
            </Link>
            .
          </p>
        ) : touched ? (
          <p>
            {WORDS[count]} of the three answered correctly so far.{before ? " You have completed this lesson before; that stays recorded." : " The lesson is marked as completed when all three are."}
          </p>
        ) : before ? (
          <p>
            <span aria-hidden className="mr-5 text-accent">
              ✓
            </span>
            You have answered all three correctly before. The lesson is marked as completed in this browser.
          </p>
        ) : null}
      </div>
    </div>
  );
}

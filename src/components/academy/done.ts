"use client";

import { useMemo } from "react";
import { LESSON_PREFIX, markLearned, useLearned } from "@/components/glossary/learn";

/**
 * Which Academy lessons the visitor has completed: a lesson is completed when
 * all three of its questions have been answered correctly.
 *
 * Nothing new is stored. The glossary's record (one localStorage key,
 * "gx:learn", a JSON object of name → true) also holds the lessons, under
 * names that begin with "lesson:". It stays in this browser, nothing is sent
 * anywhere and no score is kept. See components/glossary/learn.ts.
 */
export const lessonKey = (slug: string): string => `${LESSON_PREFIX}${slug}`;

export const markLessonDone = (slug: string): void => markLearned(lessonKey(slug));

/**
 * The slugs of the completed lessons, or null on the server and during
 * hydration: nothing that depends on storage is in the first HTML.
 */
export function useLessonsDone(): ReadonlySet<string> | null {
  const learned = useLearned();
  return useMemo(() => {
    if (learned === null) return null;
    const done = new Set<string>();
    for (const name of Object.keys(learned)) if (name.startsWith(LESSON_PREFIX)) done.add(name.slice(LESSON_PREFIX.length));
    return done;
  }, [learned]);
}

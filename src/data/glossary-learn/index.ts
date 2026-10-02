import { book1 } from "./book-1";
import { book2 } from "./book-2";
import { book3 } from "./book-3";
import type { LessonBook, TermLesson } from "./types";

export type { DiagramKind, DiagramSpec, LessonBook, TermLesson, TermQuiz } from "./types";

const lessons: LessonBook = { ...book1, ...book2, ...book3 };

/** The lesson for a term, or null when none has been written: the page then shows the definition alone. */
export function getLesson(slug: string): TermLesson | null {
  return Object.prototype.hasOwnProperty.call(lessons, slug) ? lessons[slug] : null;
}

export const lessonCount = Object.keys(lessons).length;

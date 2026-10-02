"use client";

import Link from "next/link";
import { useState } from "react";
import { clearLearned, countLearned, countLessons, useLearned } from "./learn";

/**
 * The visitor's progress through the glossary's questions, read from this
 * browser's storage. Everything here renders nothing on the server and until
 * the page has mounted, and stays absent when nothing is stored, so the HTML
 * is the same for everyone and there is no hydration mismatch.
 */

/** "You have checked N of M terms", with a control that clears the record. */
export function LearnCount({ total, className = "" }: { total: number; className?: string }) {
  const learned = useLearned();
  const [cleared, setCleared] = useState(false);
  const n = Math.min(countLearned(learned), total);

  if (learned === null) return null;
  if (n === 0) {
    return cleared ? (
      <p role="status" className={`text-sm text-ink-3 ${className}`}>
        {countLessons(learned) > 0 ? "Glossary progress cleared. The Academy lessons you completed are still kept in this browser; they can be cleared from the Academy page." : "Progress cleared. Nothing is stored in this browser now."}
      </p>
    ) : null;
  }
  return (
    <p className={`text-sm text-ink-2 ${className}`}>
      <span aria-hidden className="mr-5 text-accent">
        ✓
      </span>
      You have checked <span className="num font-semibold text-ink">{n}</span> of <span className="num">{total}</span> {total === 1 ? "term" : "terms"}.{" "}
      <span className="text-ink-3">Kept in this browser only.</span>{" "}
      <button
        type="button"
        className="link ml-5 inline-flex min-h-[1.625rem] items-center"
        onClick={() => {
          clearLearned();
          setCleared(true);
        }}
      >
        Start over
      </button>
    </p>
  );
}

/** A small mark beside a term the visitor has already checked. */
export function LearnedMark({ slug }: { slug: string }) {
  const learned = useLearned();
  if (!learned?.[slug]) return null;
  return (
    <span className="ml-8 inline-block align-baseline font-sans text-xs font-semibold tracking-normal text-accent" title="You have checked this term">
      <span aria-hidden>✓</span>
      <span className="sr-only"> (checked)</span>
    </span>
  );
}

/**
 * The next step of the course from a term: the first related term whose
 * question has not been answered yet. Before the page mounts (and with
 * nothing stored) that is simply the first related term with a lesson.
 */
export function NextUnchecked({ candidates }: { candidates: { slug: string; term: string }[] }) {
  const learned = useLearned();
  if (candidates.length === 0) return null;
  const next = candidates.find((c) => !learned?.[c.slug]);
  if (!next) {
    return (
      <p className="text-sm text-ink-3">
        <span className="label mb-3 block">Related terms</span>
        You have checked every term related to this one.
      </p>
    );
  }
  return (
    <Link href={`/glossary/${next.slug}`} className="group block min-h-[2.75rem]">
      <span className="label mb-3 block">{learned && countLearned(learned) > 0 ? "Related, not yet checked" : "A related term"}</span>
      <span className="font-medium text-ink transition-colors duration-fast group-hover:text-accent">{next.term}</span>
    </Link>
  );
}

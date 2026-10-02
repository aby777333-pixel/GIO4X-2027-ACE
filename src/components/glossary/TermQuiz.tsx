"use client";

import { useId, useState, type FormEvent } from "react";
import type { TermQuiz as Quiz } from "@/data/glossary-learn/types";
import { markLearned, useLearned } from "./learn";

/**
 * "Check yourself": one question on the term, as a plain form. Radio buttons
 * in a fieldset, a Check button, then the verdict in words with the reason,
 * announced politely, and "Try again". A correct answer is remembered in this
 * browser only (see ./learn); nothing is sent anywhere and no score is kept.
 *
 * The Academy asks three of these at the end of a lesson. It passes
 * `remember={false}`, so one right answer stores nothing by itself, and
 * `onResult`, so the lesson can tell when all three have been answered
 * correctly. Without those two props the form behaves exactly as before.
 */
export function TermQuiz({ slug, quiz, remember = true, onResult }: { slug: string; quiz: Quiz; remember?: boolean; onResult?: (right: boolean) => void }) {
  const name = useId();
  const [choice, setChoice] = useState<number | null>(null);
  const [state, setState] = useState<"asking" | "empty" | "right" | "wrong">("asking");
  // known only after the page has mounted: the first HTML is the same for everyone
  const stored = Boolean(useLearned()?.[slug]);
  const before = remember && stored;

  const options = Array.isArray(quiz?.options) ? quiz.options.filter((o): o is string => typeof o === "string" && o.trim() !== "") : [];
  const answer = quiz?.answer;
  // a question that cannot be marked is not asked
  if (!quiz?.question || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) return null;

  const checked = state === "right" || state === "wrong";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (checked) {
      setChoice(null);
      setState("asking");
      return;
    }
    if (choice === null) {
      setState("empty");
      return;
    }
    const right = choice === answer;
    setState(right ? "right" : "wrong");
    if (right && remember) markLearned(slug);
    onResult?.(right);
  }

  return (
    <form onSubmit={submit} className="panel mt-13 max-w-measure p-21 sm:p-34" noValidate>
      <fieldset>
        <legend className="font-display text-lg leading-snug text-ink">{quiz.question}</legend>
        <div className="mt-13 border-t border-line">
          {options.map((option, i) => {
            const isAnswer = checked && i === answer;
            const isMiss = state === "wrong" && i === choice;
            return (
              <label key={i} className={`flex min-h-[2.75rem] cursor-pointer items-start gap-13 border-b border-line py-13 ${checked ? "cursor-default" : "hover:bg-[var(--brand-soft)]"}`}>
                <input
                  type="radio"
                  name={name}
                  value={i}
                  checked={choice === i}
                  disabled={checked}
                  onChange={() => {
                    setChoice(i);
                    if (state === "empty") setState("asking");
                  }}
                  className="mt-[0.1875rem] h-[1.125rem] w-[1.125rem] shrink-0 accent-[var(--accent)]"
                />
                <span className={isAnswer ? "font-medium text-ink" : "text-ink-2"}>
                  {option}
                  {isAnswer && <span className="ml-8 whitespace-nowrap text-sm font-semibold text-pos">✓ the answer</span>}
                  {isMiss && <span className="ml-8 whitespace-nowrap text-sm font-semibold text-ink-3">✕ your answer</span>}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-21 flex flex-wrap items-center gap-13">
        <button type="submit" className={checked ? "btn btn-ghost" : "btn btn-primary"}>
          {checked ? "Try again" : "Check"}
        </button>
        {before && !checked && <p className="text-sm text-ink-3">You have answered this one correctly before.</p>}
      </div>

      <div role="status" aria-live="polite" className={state === "asking" ? "" : "mt-13"}>
        {state === "empty" && <p className="text-sm text-ink-2">Choose one of the answers first.</p>}
        {state === "right" && (
          <p className="text-ink-2">
            <strong className="font-semibold text-ink">Correct.</strong> {quiz.because}
          </p>
        )}
        {state === "wrong" && (
          <p className="text-ink-2">
            <strong className="font-semibold text-ink">Not quite.</strong> The answer is “{options[answer]}”. {quiz.because}
          </p>
        )}
      </div>
    </form>
  );
}

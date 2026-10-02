"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { DataNote } from "@/components/ui/Page";
import { educationalNote } from "@/config/legal";
import { CONTROLS, DEFAULT_BRANCHES, STAGES, branchSummary, withBranch, type BranchKey, type Branches } from "./stages";
import { TradeCanvas } from "./TradeCanvas";

/**
 * Trade Anatomy: one order followed from the ticket to the balance.
 *
 * The stepper (the rail, Previous and Next, the arrow keys, or auto-play)
 * chooses the stage; the branch controls choose which way the order goes at
 * that stage. Both drive two things at once: the scene, which is decoration,
 * and the text panel, which is the content. The panel is ordinary HTML in a
 * polite live region, so the page reads the same with the animation off, with
 * reduced motion (a still for each stage) and through a screen reader.
 *
 * Nothing is stored and nothing is sent: the state lives in this component.
 */

type State = { stage: number; branches: Branches; seq: number };

const LAST = STAGES.length - 1;
/** how long auto-play rests on a stage: long enough to read the short version */
const AUTO_MS = 9000;
const COLS: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" };

export function TradeAnatomy({ terms }: { terms: Record<string, string> }) {
  const [state, setState] = useState<State>({ stage: 0, branches: DEFAULT_BRANCHES, seq: 0 });
  const [playing, setPlaying] = useState(false);
  const rail = useRef<(HTMLButtonElement | null)[]>([]);

  const { stage, branches } = state;
  const def = STAGES[stage];
  const controls = def.controls(branches);
  const summary = branchSummary(def, branches);
  const known = def.terms.filter((t) => terms[t] !== undefined);

  const go = (n: number) => {
    const next = Math.max(0, Math.min(LAST, n));
    setPlaying(false);
    setState((p) => (p.stage === next ? p : { ...p, stage: next, seq: p.seq + 1 }));
  };
  const choose = (key: BranchKey, value: Branches[BranchKey]) => {
    setPlaying(false);
    setState((p) => (p.branches[key] === value ? p : { ...p, branches: withBranch(p.branches, key, value), seq: p.seq + 1 }));
  };
  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    // from the last stage, playing starts the walk again
    if (stage === LAST) setState((p) => ({ ...p, stage: 0, seq: p.seq + 1 }));
    setPlaying(true);
  };

  // auto-play: rest on a stage, then move on; stop after the last one
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => {
      if (stage >= LAST) setPlaying(false);
      else setState((p) => ({ ...p, stage: Math.min(LAST, p.stage + 1), seq: p.seq + 1 }));
    }, AUTO_MS);
    return () => window.clearTimeout(id);
  }, [playing, stage]);

  // Left and Right move between stages from any button of the walkthrough; Home and End from the rail.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (!(e.target instanceof HTMLButtonElement)) return;
    const onRail = rail.current.includes(e.target);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = stage + 1;
    else if (e.key === "ArrowLeft") next = stage - 1;
    else if (onRail && e.key === "Home") next = 0;
    else if (onRail && e.key === "End") next = LAST;
    if (next === null) return;
    e.preventDefault();
    next = Math.max(0, Math.min(LAST, next));
    go(next);
    if (onRail) rail.current[next]?.focus();
  };

  return (
    <div className="phi items-start" onKeyDown={onKeyDown} data-trade-anatomy>
      <div className="min-w-0">
        {/* the scene: decoration only, always on the night material so its light reads in both themes */}
        <div className="on-night relative overflow-hidden rounded border border-line">
          <TradeCanvas target={state} className="aspect-square sm:aspect-phi" />
        </div>
        <p className="mt-8 text-xs text-ink-3" data-ta-caption>
          <span className="num">
            Stage {stage + 1} of {STAGES.length}
          </span>
          : {def.title.toLowerCase()}.{summary ? ` ${summary}.` : ""} The picture illustrates the text; it carries no data.
        </p>

        <div role="group" aria-label="Stages of the order" className="mt-21">
          <ol className="flat grid grid-cols-4 gap-px overflow-hidden rounded-sm border border-line-strong bg-line sm:grid-cols-7">
            {STAGES.map((st, i) => {
              const current = i === stage;
              return (
                <li key={st.key} className="flex">
                  <button
                    ref={(el) => {
                      rail.current[i] = el;
                    }}
                    type="button"
                    aria-current={current ? "step" : undefined}
                    aria-label={`Stage ${i + 1}: ${st.title}`}
                    onClick={() => go(i)}
                    className={`relative flex min-h-[3.4375rem] w-full flex-col items-start justify-center gap-2 px-5 text-left sm:px-8 transition-colors duration-fast ${current ? "bg-ink text-bg" : "bg-surface text-ink-3 hover:text-ink"}`}
                  >
                    {/* the rail fills as far as the order has travelled */}
                    <span aria-hidden className={`absolute inset-x-0 top-0 h-[3px] ${i <= stage ? "bg-accent" : "bg-transparent"}`} />
                    <span aria-hidden className={`num text-[0.6875rem] font-semibold tracking-[0.1em] ${current ? "" : "text-prestige-ink"}`}>
                      0{i + 1}
                    </span>
                    <span aria-hidden className="text-[0.6875rem] font-semibold uppercase tracking-[0.02em] sm:text-xs sm:tracking-[0.06em]">
                      {st.short}
                    </span>
                  </button>
                </li>
              );
            })}
            <li aria-hidden className="bg-surface sm:hidden" />
          </ol>

          <div className="mt-13 flex flex-wrap items-center gap-8">
            <button type="button" className="btn btn-ghost" aria-disabled={stage === 0} onClick={() => go(stage - 1)} data-ta-prev>
              Previous
            </button>
            <button type="button" className="btn btn-primary" aria-disabled={stage === LAST} onClick={() => go(stage + 1)} data-ta-next>
              {stage === LAST ? "Next" : `Next: ${STAGES[stage + 1].short.toLowerCase()}`}
            </button>
            <button type="button" className="btn btn-ghost" aria-pressed={playing} onClick={togglePlay} data-ta-play>
              {playing ? "Pause" : stage === LAST ? "Play again" : "Play the walkthrough"}
            </button>
          </div>
          <p className="mt-8 text-xs text-ink-3">With a keyboard: Tab to any of these buttons, then the Left and Right arrow keys move between stages. Auto-play rests on each stage for a few seconds and stops at the end.</p>
        </div>

        {controls.length > 0 && (
          <div className="mt-21 grid gap-13 border-t border-line pt-21" data-ta-branches>
            <p className="eyebrow">Choose a branch</p>
            {controls.map((key) => {
              const ctl = CONTROLS[key];
              const options = ctl.options as { value: Branches[BranchKey]; label: string }[];
              const id = `ta-branch-${key}`;
              return (
                <div key={key} role="group" aria-labelledby={id}>
                  <p id={id} className="label">
                    {ctl.label}
                  </p>
                  <div className={`flat mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line-strong bg-line ${COLS[options.length] ?? ""}`}>
                    {options.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={branches[key] === o.value}
                        onClick={() => choose(key, o.value)}
                        data-ta-branch={`${key}:${o.value}`}
                        className={`min-h-[2.75rem] px-8 text-xs font-semibold uppercase tracking-[0.06em] transition-colors duration-fast ${branches[key] === o.value ? "bg-ink text-bg" : "bg-surface text-ink-3 hover:text-ink"} ${options.length === 3 ? "last:col-span-2 sm:last:col-span-1" : ""}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DataNote status="simulation" className="mt-21">
          An illustration of general mechanics on no market data: there are no prices in it. {educationalNote}
        </DataNote>
      </div>

      {/* the content: what happens at this stage, in words */}
      <section aria-labelledby="ta-stage-title" className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]" data-ta-panel>
        <div aria-live="polite" data-ta-live>
          <p className="eyebrow">
            Stage {stage + 1} of {STAGES.length}
          </p>
          <h2 id="ta-stage-title" className="h3 mt-8">
            {def.title}
          </h2>
          <div className="mt-13 grid gap-13 text-ink-2">
            {def.body(branches).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <h3 className="label mt-21">What can go wrong here</h3>
          <p className="mt-5 text-sm text-ink-2">{def.wrong}</p>
        </div>

        <h3 className="label mt-21">At GIO4X</h3>
        <p className="mt-5 border-l border-accent pl-13 text-sm text-ink-2">
          {def.note.map((part, i) =>
            typeof part === "string" ? (
              <span key={i}>{part}</span>
            ) : (
              <Link key={i} href={part.href} className="link">
                {part.label}
              </Link>
            ),
          )}
        </p>

        <h3 className="label mt-21">Terms used</h3>
        <ul className="mt-5 flex flex-wrap gap-x-13 gap-y-3 text-sm">
          {known.map((slug) => (
            <li key={slug}>
              <Link href={`/glossary/${slug}`} className="link inline-flex min-h-[2.125rem] items-center">
                {terms[slug]}
              </Link>
            </li>
          ))}
        </ul>

        {def.tool && (
          <Link href={def.tool.href} className="go mt-13 min-h-[2.75rem] md:min-h-0">
            {def.tool.label}
          </Link>
        )}
      </section>
    </div>
  );
}

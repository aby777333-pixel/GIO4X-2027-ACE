"use client";

import type { ReactNode } from "react";
import type { DiagramKind, DiagramSpec } from "@/data/glossary-learn/types";
import { Balance } from "./Balance";
import { Band } from "./Band";
import { Bars } from "./Bars";
import { Candles } from "./Candles";
import { Cycle } from "./Cycle";
import { Flow } from "./Flow";
import { Gap } from "./Gap";
import { Hub } from "./Hub";
import { Lever } from "./Lever";
import { Levels } from "./Levels";
import { Lines } from "./Lines";
import { Oscillator } from "./Oscillator";
import { Pair } from "./Pair";
import { Path } from "./Path";
import { Share } from "./Share";
import { Threshold } from "./Threshold";

/**
 * A glossary term's moving diagram: the drawing for the lesson's spec, the one
 * control under it, and the caption as visible text. The canvas itself is
 * hidden from assistive technology; the caption and the sentence the control
 * reports are its text alternative.
 *
 * What the pointer, a finger or the control does is the same for every diagram
 * of a kind, so it is said here, once per kind, rather than in each lesson.
 */

const TRY: Record<DiagramKind, string> = {
  balance: "shift the weight from one side to the other",
  flow: "step through the stages",
  cycle: "go round the cycle",
  path: "move along the line: each mark appears as the line reaches it",
  band: "move along the line as it runs between the two boundaries",
  gap: "narrow or widen the gap",
  threshold: "move it towards the level, and across it",
  bars: "choose the bar the others are measured against",
  lever: "move the fulcrum and see the two measures change",
  share: "make the part larger or smaller",
  pair: "raise one side and see the other fall",
  levels: "move the price up or down until it meets a level",
  hub: "follow one link at a time",
  candles: "form the candles step by step",
  lines: "move along the two lines",
  oscillator: "move along the line, into each zone and out again",
};

function body(spec: DiagramSpec): ReactNode {
  switch (spec.kind) {
    case "balance":
      return <Balance spec={spec} />;
    case "flow":
      return <Flow spec={spec} />;
    case "cycle":
      return <Cycle spec={spec} />;
    case "path":
      return <Path spec={spec} />;
    case "band":
      return <Band spec={spec} />;
    case "gap":
      return <Gap spec={spec} />;
    case "threshold":
      return <Threshold spec={spec} />;
    case "bars":
      return <Bars spec={spec} />;
    case "lever":
      return <Lever spec={spec} />;
    case "share":
      return <Share spec={spec} />;
    case "pair":
      return <Pair spec={spec} />;
    case "levels":
      return <Levels spec={spec} />;
    case "hub":
      return <Hub spec={spec} />;
    case "candles":
      return <Candles spec={spec} />;
    case "lines":
      return <Lines spec={spec} />;
    case "oscillator":
      return <Oscillator spec={spec} />;
    default:
      // a kind this build does not know: the caption still stands on its own
      return null;
  }
}

export function TermDiagram({ spec, caption, className = "" }: { spec: DiagramSpec; caption: string; className?: string }) {
  const drawing = spec && typeof spec === "object" ? body(spec) : null;
  const how = drawing ? TRY[spec.kind] : undefined;
  return (
    <figure className={`max-w-[40rem] ${className}`}>
      {drawing}
      <figcaption className={`${drawing ? "mt-8 border-t border-line pt-13" : ""} text-sm leading-relaxed text-ink-2`}>
        {caption}
        {how && <span className="mt-5 block text-ink-3">To try it, point at the diagram, drag a finger across it or use the slider: {how}.</span>}
      </figcaption>
    </figure>
  );
}

/**
 * The learning layer of the glossary: for each term, a longer explanation, a
 * worked example, a moving diagram and a question to test the idea.
 *
 * The carried definitions stay as they are (src/data/glossary.ts). A lesson
 * adds to a term; a term without a lesson simply shows its definition.
 *
 * Everything here is education. A lesson never says what to trade, never
 * promises an outcome, and never quotes a real market price: figures in an
 * example are round, invented for the arithmetic, and labelled as an example
 * on the page.
 */

/**
 * The diagram a term gets. Each kind is one small animated drawing
 * (src/components/glossary/diagrams); `labels` are the few words drawn on it,
 * in the order the kind's comment gives. Keep every label under 18 characters.
 */
export type DiagramSpec =
  /** two things weighed against each other on a beam. labels: [left, right]. tilt: which side is heavier */
  | { kind: "balance"; labels: [string, string]; tilt?: "left" | "right" | "level" }
  /** one thing passing through stages, left to right. labels: 2 to 5 stage names */
  | { kind: "flow"; labels: string[] }
  /** stages that repeat in a loop. labels: 3 to 6 stage names */
  | { kind: "cycle"; labels: string[] }
  /** a price line moving over time. shape: how it moves. labels: [caption] (optional marks named in `marks`) */
  | { kind: "path"; shape: "up" | "down" | "flat" | "volatile" | "up-then-down" | "down-then-up" | "zigzag-up" | "zigzag-down" | "gap" | "double-top" | "double-bottom"; labels: string[]; marks?: string[] }
  /** a line moving between an upper and a lower boundary. labels: [upper, lower] */
  | { kind: "band"; labels: [string, string]; breaks?: "up" | "down" | "none" }
  /** two prices and the distance between them. labels: [upper price name, lower price name, name of the gap] */
  | { kind: "gap"; labels: [string, string, string] }
  /** a level that, once crossed, triggers something. labels: [the level, what is measured, what happens] */
  | { kind: "threshold"; labels: [string, string, string]; from: "above" | "below" }
  /** magnitudes side by side. labels: 2 to 5 bar names; sizes: relative heights, 1 to 10 */
  | { kind: "bars"; labels: string[]; sizes: number[] }
  /** a small input producing a large effect through a lever. labels: [small side, large side] */
  | { kind: "lever"; labels: [string, string] }
  /** a part of a whole. labels: [the part, the whole]; share: 0.05 to 0.95 */
  | { kind: "share"; labels: [string, string]; share: number }
  /** two currencies bound together. labels: [base, quote] (codes or words) */
  | { kind: "pair"; labels: [string, string] }
  /** orders resting at price levels around the current price. labels: [above, at, below] */
  | { kind: "levels"; labels: [string, string, string] }
  /** one centre joined to several others. labels: [centre, ...2 to 6 others] */
  | { kind: "hub"; labels: string[] }
  /** a candle or a few candles. shape: which. labels: parts to name (for example ["Body", "Wick"]) */
  | { kind: "candles"; shape: "single" | "bullish-run" | "bearish-run" | "reversal-top" | "reversal-bottom" | "doji"; labels: string[] }
  /** two lines crossing or diverging. labels: [first line, second line]; relation: how they meet */
  | { kind: "lines"; labels: [string, string]; relation: "cross-up" | "cross-down" | "diverge" | "converge" | "parallel" }
  /** an oscillator moving between extremes. labels: [upper zone, lower zone] */
  | { kind: "oscillator"; labels: [string, string] };

export type DiagramKind = DiagramSpec["kind"];

export type TermQuiz = {
  /** one question that tests the idea, not the wording */
  question: string;
  /** three or four answers; exactly one is right */
  options: string[];
  /** index of the right answer in `options` */
  answer: number;
  /** shown after an answer: why the right one is right, in one or two sentences */
  because: string;
};

export type TermLesson = {
  /** the idea in everyday words: two or three sentences, no jargon that is not itself explained */
  plain: string;
  /** why a trader meets this idea and what it changes in practice: one or two sentences, no advice */
  why: string;
  /** a worked example with round, invented figures: the set-up, each step on its own line, and the result */
  example?: { setup: string; steps: string[]; result: string };
  /** a common misunderstanding, stated and corrected: one or two sentences */
  mistake?: string;
  /** what the diagram shows, in one sentence (also its text alternative for screen readers) */
  diagramCaption: string;
  diagram: DiagramSpec;
  quiz: TermQuiz;
};

/** slug → lesson. Split across files by letter range; see index.ts. */
export type LessonBook = Record<string, TermLesson>;

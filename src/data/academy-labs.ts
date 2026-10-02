/**
 * Which interactive exercise a lesson carries, by lesson slug.
 *
 * A lesson has no exercise or one. The exercises themselves are client
 * components in src/components/academy/labs; this file only says where each
 * belongs and how it is introduced. The lesson text is not altered: an
 * exercise is added after it, under "Try it yourself".
 *
 * Every figure inside an exercise is an invented round example, and the page
 * says so beside it.
 */
export type LabKey = "stop-loss" | "candle" | "position-size" | "leverage" | "moving-average";

export type LessonLab = {
  lab: LabKey;
  /** the exercise's own heading */
  title: string;
  /** one or two sentences: what to do and what to watch */
  intro: string;
};

export const lessonLabs: Record<string, LessonLab> = {
  "what-is-leverage-and-margin": {
    lab: "leverage",
    title: "Leverage and margin",
    intro: "Move the leverage and watch the same 1,000 of margin carry a larger position, while the adverse move that reaches a stop-out level becomes smaller.",
  },
  "candlestick-patterns-masterclass": {
    lab: "candle",
    title: "Build a candle",
    intro: "Set the open, high, low and close of one period and the candle redraws. Then play a period and watch a candle form from the path of the price.",
  },
  "moving-averages-strategy": {
    lab: "moving-average",
    title: "The period of a moving average",
    intro: "Change the period of a simple moving average over one fixed price path. A longer period gives a smoother line that turns later.",
  },
  "risk-reward-ratio-explained": {
    lab: "stop-loss",
    title: "Drag the stop loss",
    intro: "Drag the stop-loss and take-profit levels of an example buy position, or use the sliders, and read the distances, the ratio and the amount at risk. Then let the price gap through the stop.",
  },
  "position-sizing-strategies": {
    lab: "position-size",
    title: "Size the position",
    intro: "Set a balance, the share of it at risk and the distance to the stop, and follow the percent-risk arithmetic line by line.",
  },
};

export const labFor = (slug: string): LessonLab | null => lessonLabs[slug] ?? null;

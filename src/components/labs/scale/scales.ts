/** The seven names given to the widths of the Long Scroll, each with its sentence. Plain data: read by the page and by the stage. */
export const SCALES = [
  { name: "A tick", line: "The smallest change a price can show. Alone it means nothing; everything else is made of these." },
  { name: "A minute", line: "A handful of ticks, gathered. This is where a candle comes from: where it opened, how far it went, where it closed." },
  { name: "An hour", line: "The noise begins to look like shape. Much of that shape is still noise." },
  { name: "A day", line: "Sessions open and close. The range of an ordinary day is what a stop has to survive." },
  { name: "A month", line: "What felt like a storm at the hour is one wiggle here." },
  { name: "A year", line: "Trends appear, and so do the long falls inside them." },
  { name: "A decade", line: "Every crisis is a notch. Choose the scale you trade, and judge each move at that scale." },
] as const;

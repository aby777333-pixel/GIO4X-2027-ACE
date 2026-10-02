/**
 * Text made ready to be read aloud by the browser's own voice.
 *
 * A speech engine reads prose well and notation badly: "1:100" comes out as a
 * time of day, "EUR/USD" as three letters, a slash and three letters, "×" as
 * nothing at all. `speakable` rewrites only the notation, never the words, so
 * what is heard is the lesson as written.
 *
 * Pure and dependency-free: the narrator uses it in the browser, and
 * .tmp/shot/story-normaliser.mjs runs it over every lesson to list anything
 * it leaves unread.
 */

/* ---- numbers in words (only where a figure is part of a ratio or a time) ---- */

const SMALL = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** A whole number from 0 to 999,999 in British English words; anything else is returned as digits. */
export function numberWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) return String(n);
  if (n < 20) return SMALL[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${SMALL[n % 10]}` : "");
  if (n < 1000) return `${SMALL[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${numberWords(n % 100)}` : ""}`;
  const rest = n % 1000;
  return `${numberWords(Math.floor(n / 1000))} thousand${rest ? (rest < 100 ? " and " : " ") + numberWords(rest) : ""}`;
}

/* ---- currencies ---------------------------------------------------------------- */

const CURRENCY: Record<string, string> = {
  EUR: "euro",
  USD: "dollar",
  GBP: "pound",
  JPY: "yen",
  CHF: "Swiss franc",
  AUD: "Australian dollar",
  CAD: "Canadian dollar",
  NZD: "New Zealand dollar",
  SGD: "Singapore dollar",
  TRY: "Turkish lira",
  ZAR: "rand",
  XAU: "gold",
};
const CODES = Object.keys(CURRENCY).join("|");

/** "EUR/USD" as a dealer says it: "euro dollar". Beside another dollar, the US dollar is named in full. */
function pairName(base: string, quote: string): string {
  const name = (code: string, other: string) => (code === "USD" && /dollar/.test(CURRENCY[other]) ? "U S dollar" : CURRENCY[code]);
  return `${name(base, quote)} ${name(quote, base)}`;
}

/* ---- abbreviations ------------------------------------------------------------- */

/** How each abbreviation the lessons use is said. Letters apart are read as letters. */
const ACRONYM: Record<string, string> = {
  RSI: "R S I",
  MACD: "mac dee",
  SMA: "S M A",
  EMA: "E M A",
  MA: "moving average",
  NFP: "N F P",
  CPI: "C P I",
  GDP: "G D P",
  FOMC: "F O M C",
  ECB: "E C B",
  BOE: "B O E",
  BOJ: "B O J",
  RBA: "R B A",
  RBNZ: "R B N Z",
  QE: "Q E",
  QT: "Q T",
  GMT: "G M T",
  US: "U S",
  UK: "U K",
  FOMO: "fomo",
  // capitals used for emphasis in a carried note
  AND: "and",
};

/* ---- the clock ----------------------------------------------------------------- */

function clock(h: number, m: number): string {
  if (h === 0 && m === 0) return "midnight";
  if (m === 0) return `${h < 10 ? "oh " : ""}${numberWords(h)} hundred`;
  return `${numberWords(h)} ${m < 10 ? "oh " : ""}${numberWords(m)}`;
}

/**
 * One sentence (or heading, or table row) as it should be spoken.
 * The rules, in the order they are applied:
 *  1. "e.g." for example; "i.e." that is; "vs." versus; "etc." and so on
 *  2. "R:R" risk to reward
 *  3. "EUR/USD" euro dollar; "(EUR)" spelt out; a code on its own ("JPY pairs") the currency's name
 *  4. "22:00 – 07:00" a range of figures joined by an en dash: "to"
 *  5. "$1,000" 1,000 dollars; "$0.10" 10 cents; "($)" in dollars
 *  6. "22:00" twenty-two hundred (two digits, a colon, two digits is a time)
 *  7. "1:100" one to one hundred (any other figure, colon, figure is a ratio)
 *  8. "1-2%" 1 to 2 per cent; "5-20 period" 5 to 20 period
 *  9. "%" per cent
 * 10. "14-period" 14 period
 * 11. "×" times; "÷" divided by; "=" equals; in a line with "=", " / " divided by and " - " minus, square brackets dropped
 * 12. "support/resistance" support and resistance; any other word/word a space
 * 13. a dash becomes a comma, or a full stop where a new sentence follows it ("Doji — A candle…"); "..." after a list becomes "and so on"
 * 14. "1.1050" 1 point 1 0 5 0 (every decimal: the digits after the point are read one by one)
 * 15. abbreviations (RSI, EMA, FOMC, US, …) spelt out or said as the word they are; "&" and
 */
export function speakable(input: string): string {
  let s = input.replace(/ /g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const formula = s.includes("=");

  // 1
  s = s
    .replace(/\be\.g\.,?/g, "for example,")
    .replace(/\bi\.e\.,?/g, "that is,")
    .replace(/\bvs\.?(?=\s)/g, "versus")
    .replace(/\betc\./g, "and so on");
  // 2
  s = s.replace(/\bR:R\b/g, "risk to reward");
  // 3
  s = s
    .replace(new RegExp(`\\b(${CODES})/(${CODES})\\b`, "g"), (_m, a: string, b: string) => pairName(a, b))
    .replace(new RegExp(`\\((${CODES})\\)`, "g"), (_m, a: string) => `(${a.split("").join(" ")})`)
    .replace(new RegExp(`\\b(${CODES})\\b`, "g"), (_m, a: string) => CURRENCY[a]);
  // 4
  s = s.replace(/(\d)\s*–\s*(?=\d)/g, "$1 to ");
  // 5
  s = s.replace(/\(\$\)/g, "(in dollars)").replace(/\$(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\s(?:trillion|billion|million|thousand))?/g, (_m, whole: string, dec: string | undefined, scale: string | undefined) => {
    if (dec && whole === "0" && dec.length === 3 && !scale) return `${Number(dec.slice(1))} cents`;
    return `${whole}${dec ?? ""}${scale ?? ""} ${whole === "1" && !dec && !scale ? "dollar" : "dollars"}`;
  });
  // 6
  s = s.replace(/\b(\d{2}):(\d{2})\b/g, (m, h: string, min: string) => (Number(h) < 24 && Number(min) < 60 ? clock(Number(h), Number(min)) : m));
  // 7
  s = s.replace(/\b(\d+):(\d+)\b/g, (_m, a: string, b: string) => `${numberWords(Number(a))} to ${numberWords(Number(b))}`);
  // 8
  s = s.replace(/(\d)-(?=\d)/g, "$1 to ");
  // 9
  s = s.replace(/\s*%/g, " per cent");
  // 10
  s = s.replace(/(\d)-(?=[A-Za-z])/g, "$1 ");
  // 11
  s = s.replace(/\s*×\s*/g, " times ").replace(/\s*÷\s*/g, " divided by ");
  if (formula) s = s.replace(/\s\/\s/g, " divided by ").replace(/\s-\s/g, " minus ").replace(/[[\]]/g, "");
  else s = s.replace(/\s\/\s/g, ", ").replace(/\s-\s/g, ", ");
  s = s.replace(/\s*=\s*/g, " equals ");
  // 12
  s = s.replace(/support\/resistance/gi, (m) => (m[0] === "S" ? "Support and resistance" : "support and resistance")).replace(/([A-Za-z])\/(?=[A-Za-z])/g, "$1 ");
  // 13
  s = s
    // "Doji — A candle where…": a name, a dash and a new sentence is read as two sentences
    .replace(/\s*—\s*(?=[A-Z][a-z\s])/g, ". ")
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s+–\s+/g, ", ")
    .replace(/\s*(?:\.\.\.|…)/g, ", and so on");
  // 14
  s = s.replace(/\b(\d+)\.(\d+)\b/g, (_m, a: string, b: string) => `${a} point ${b.split("").join(" ")}`);
  // 15
  s = s
    .replace(/\b([A-Z]{2,5})(s?)\b/g, (m, word: string, plural: string) => {
      const said = ACRONYM[word];
      if (!said) return m;
      if (!plural) return said;
      return /^[A-Z](?: [A-Z])+$/.test(said) ? `${said}'s` : `${said}s`;
    })
    .replace(/\s*&\s*/g, " and ");

  return s
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/,(?:\s*,)+/g, ",")
    .replace(/:\s*,/g, ":")
    .trim();
}

/* ---- sentences ------------------------------------------------------------------ */

export type Span = { start: number; end: number };

/** a full stop after one of these does not end a sentence */
const NOT_AN_END = /(?:^|[\s(])(?:e\.g|i\.e|vs|etc|approx|[A-Z])$/;

/**
 * Where each sentence of a block of text begins and ends (offsets into the
 * text as given, so a sentence can be found again in the page). A colon does
 * not end a sentence; an abbreviation's full stop and an initial's do not.
 */
export function sentenceSpans(text: string): Span[] {
  const out: Span[] = [];
  const push = (a: number, b: number) => {
    let start = a;
    let end = b;
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (end > start) out.push({ start, end });
  };
  const stop = /[.!?]+["”’)\]]*\s+/g;
  let from = 0;
  for (let m = stop.exec(text); m; m = stop.exec(text)) {
    const next = text[m.index + m[0].length];
    if (next === undefined || !/[A-Z0-9"“‘($]/.test(next)) continue;
    if (text[m.index] === "." && NOT_AN_END.test(text.slice(Math.max(0, m.index - 8), m.index))) continue;
    push(from, m.index + m[0].length);
    from = m.index + m[0].length;
  }
  push(from, text.length);
  return out;
}

/** What is handed to the voice for one block, and where in it each sentence starts. */
export type Spoken = {
  text: string;
  /** offset in `text` at which each kept sentence starts */
  starts: number[];
  /** for each kept sentence, its index in the spans that were given */
  from: number[];
};

/** A block's sentences, each made speakable, joined into one utterance. */
export function speakBlock(text: string, spans: Span[]): Spoken {
  const starts: number[] = [];
  const from: number[] = [];
  let out = "";
  spans.forEach((span, i) => {
    const said = speakable(text.slice(span.start, span.end));
    if (!said) return;
    if (out) out += " ";
    starts.push(out.length);
    from.push(i);
    out += said;
  });
  return { text: out, starts, from };
}

/** Which kept sentence a character of the utterance belongs to. */
export function sentenceAt(starts: number[], charIndex: number): number {
  let at = 0;
  for (let i = 0; i < starts.length; i++) if (starts[i] <= charIndex) at = i;
  return at;
}

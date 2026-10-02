/**
 * What changed between two texts, for a person to read: a word-level
 * longest-common-subsequence diff, written here so that nothing is installed.
 *
 * The result is a list of runs: text that is in both ("same"), text only in
 * the first ("del") and text only in the second ("add"). Two things always
 * hold, and the tests check them: the "same" and "del" runs joined are exactly
 * the first text, and the "same" and "add" runs joined are exactly the second.
 * Nothing is trimmed, normalised or dropped.
 *
 * The longest-common-subsequence table costs one cell per pair of tokens, so
 * it is bounded. What both texts share at the start and at the end is set
 * aside first (most edits are local, so the part left to compare is small).
 * If the rest is still too large to compare word by word, it is compared line
 * by line; if that is too large as well, the differing middle is given as one
 * removal and one addition. `mode` says which of the three happened, so the
 * screen can say so.
 *
 * Pure: no clock, no DOM, no imports. scripts/test-text-diff.mjs runs it in Node.
 */

export type DiffKind = "same" | "add" | "del";
export type DiffPart = { kind: DiffKind; text: string };
/** How finely the texts were compared. */
export type DiffMode = "words" | "lines" | "whole";
export type DiffResult = {
  parts: DiffPart[];
  mode: DiffMode;
  /** the two texts are identical */
  same: boolean;
};

export type DiffLimits = {
  /** both texts together, in characters: above this, words are not attempted */
  chars: number;
  /** cells of the comparison table (tokens of one text × tokens of the other, after the common ends are set aside) */
  cells: number;
};

/**
 * A blog body is at most 60,000 characters, so two of them are within `chars`.
 * Four million cells is about 8 MB for a moment and a few tens of milliseconds:
 * two texts of 2,000 differing words each.
 */
export const DIFF_LIMITS: DiffLimits = { chars: 200_000, cells: 4_000_000 };

/**
 * Words, the gaps between them and punctuation, each as its own token:
 * a run of line breaks, a run of other white space, a word (letters, digits,
 * and an apostrophe or hyphen inside it), or one other character.
 */
const WORD_TOKEN = /\n+|[^\S\n]+|[\p{L}\p{N}\p{M}_]+(?:['’-][\p{L}\p{N}\p{M}_]+)*|[^\s\p{L}\p{N}\p{M}_]/gu;
/** A line with its line break, or the last line without one. */
const LINE_TOKEN = /[^\n]*\n|[^\n]+$/g;

export function tokenizeWords(text: string): string[] {
  return text.match(WORD_TOKEN) ?? [];
}

export function tokenizeLines(text: string): string[] {
  return text.match(LINE_TOKEN) ?? [];
}

type Run = { kind: "same"; text: string } | { kind: "change"; del: string; add: string };

/** White space within a line: a gap between words, not the break between paragraphs. */
const isGap = (text: string) => text !== "" && !/[^\s]/.test(text) && !text.includes("\n");

/**
 * The tokens of `a` and `b` that differ, as runs in reading order. A run of
 * change carries what was removed and what was added in its place, removal
 * first. Returns null when the table would exceed `cells`.
 */
function compare(a: string[], b: string[], cells: number): Run[] | null {
  // what both share at the two ends needs no table
  let head = 0;
  const shortest = Math.min(a.length, b.length);
  while (head < shortest && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < shortest - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;

  const n = a.length - head - tail;
  const m = b.length - head - tail;
  if (n * m > cells) return null;

  const runs: Run[] = [];
  const same = (text: string) => {
    if (text === "") return;
    const last = runs[runs.length - 1];
    if (last?.kind === "same") last.text += text;
    else runs.push({ kind: "same", text });
  };
  const change = (del: string, add: string) => {
    if (del === "" && add === "") return;
    const last = runs[runs.length - 1];
    if (last?.kind === "change") {
      last.del += del;
      last.add += add;
    } else runs.push({ kind: "change", del, add });
  };

  same(a.slice(0, head).join(""));

  if (n === 0 || m === 0) {
    change(a.slice(head, head + n).join(""), b.slice(head, head + m).join(""));
  } else {
    // tokens as numbers: comparing two integers is cheaper than comparing two strings a few million times
    const ids = new Map<string, number>();
    const idOf = (token: string) => {
      let id = ids.get(token);
      if (id === undefined) {
        id = ids.size;
        ids.set(token, id);
      }
      return id;
    };
    const x = new Int32Array(n);
    const y = new Int32Array(m);
    for (let i = 0; i < n; i++) x[i] = idOf(a[head + i]);
    for (let j = 0; j < m; j++) y[j] = idOf(b[head + j]);

    // lcs[i][j]: the length of the longest common subsequence of x[i..] and y[j..]
    const width = m + 1;
    const lcs = Math.min(n, m) < 65535 ? new Uint16Array((n + 1) * width) : new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
      const row = i * width;
      const below = row + width;
      for (let j = m - 1; j >= 0; j--) {
        lcs[row + j] = x[i] === y[j] ? lcs[below + j + 1] + 1 : Math.max(lcs[below + j], lcs[row + j + 1]);
      }
    }

    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (x[i] === y[j]) {
        same(a[head + i]);
        i++;
        j++;
      } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
        change(a[head + i], "");
        i++;
      } else {
        change("", b[head + j]);
        j++;
      }
    }
    change(a.slice(head + i, head + n).join(""), b.slice(head + j, head + m).join(""));
  }

  same(a.slice(a.length - tail).join(""));
  return runs;
}

/** How far an edit is moved, at most, when it is settled on a boundary: a bound on the work, far more than a sentence needs. */
const REACH = 600;

const WORD_CHAR = /[\p{L}\p{N}\p{M}_]/u;

/**
 * How good a place the boundary between `a` and `b` (the characters on either
 * side) is for an edit to begin or end. `blank` says the boundary touches an
 * empty line. Higher is better; -1 is a place that must not be cut.
 */
function boundaryScore(a: string, b: string, blank: boolean): number {
  if (a === "" || b === "") return 6; // the edge of the surrounding text
  const ac = a.charCodeAt(0);
  const bc = b.charCodeAt(0);
  if (ac >= 0xd800 && ac <= 0xdbff && bc >= 0xdc00 && bc <= 0xdfff) return -1; // inside a surrogate pair
  if (blank) return 5;
  if (a === "\n" || b === "\n") return 4;
  const aSpace = /\s/.test(a);
  const bSpace = /\s/.test(b);
  const aWord = WORD_CHAR.test(a);
  if (!aWord && !aSpace && bSpace) return 3; // after punctuation, before a space: the end of a sentence or clause
  if (aSpace || bSpace) return 2;
  if (!aWord || !WORD_CHAR.test(b)) return 1;
  return 0;
}

/**
 * A removal (or an addition) that stands between two unchanged stretches can
 * often be described in several equally correct ways: taking out "B. " from
 * "A. B. C." is the same as taking out ". B" one character earlier. The
 * comparison picks one of them by accident. This moves each such edit, without
 * changing either text, to where it begins and ends on the best boundaries:
 * a whole paragraph, a whole line, a whole sentence, whole words.
 */
function settle(runs: Run[]): Run[] {
  for (let k = 1; k < runs.length - 1; k++) {
    const edit = runs[k];
    const prev = runs[k - 1];
    const next = runs[k + 1];
    if (edit.kind !== "change" || prev.kind !== "same" || next.kind !== "same") continue;
    // only a pure removal or a pure addition can be moved: a replacement is tied to both texts
    if ((edit.del === "") === (edit.add === "")) continue;
    const text = edit.del || edit.add;
    const left = prev.text;
    const right = next.text;
    const a = left.length;
    const len = text.length;
    const total = a + len + right.length;
    // the three strings read as one, without building it
    const at = (i: number) => (i < 0 || i >= total ? "" : i < a ? left[i] : i < a + len ? text[i - a] : right[i - a - len]);

    // the edit can move one place left when the character it would take in equals the one it would give up, and likewise right
    let lo = a;
    while (lo > 0 && a - lo < REACH && at(lo - 1) === at(lo + len - 1)) lo--;
    let hi = a;
    while (hi + len < total && hi - a < REACH && at(hi) === at(hi + len)) hi++;
    if (lo === hi) continue;

    const score = (i: number) =>
      boundaryScore(at(i - 1), at(i), (at(i - 1) === "\n" && at(i - 2) === "\n") || (at(i) === "\n" && at(i + 1) === "\n"));
    let best = a;
    let bestScore = -Infinity;
    for (let p = lo; p <= hi; p++) {
      const start = score(p);
      const end = score(p + len);
      if (start < 0 || end < 0) continue;
      // on a tie the later place wins: a removed paragraph then takes the blank line after it, not the one before
      if (start + end >= bestScore) {
        bestScore = start + end;
        best = p;
      }
    }
    if (best === a) continue;

    const whole = left + text + right;
    prev.text = whole.slice(0, best);
    const moved = whole.slice(best, best + len);
    if (edit.del !== "") edit.del = moved;
    else edit.add = moved;
    next.text = whole.slice(best + len);
  }

  // an unchanged stretch may have been used up: drop it, and let what now touches join
  const out: Run[] = [];
  for (const run of runs) {
    const last = out[out.length - 1];
    if (run.kind === "same") {
      if (run.text === "") continue;
      if (last?.kind === "same") last.text += run.text;
      else out.push(run);
    } else if (last?.kind === "change") {
      last.del += run.del;
      last.add += run.add;
    } else out.push(run);
  }
  return out;
}

/**
 * "old words" replaced by "new words" would otherwise read as two separate
 * replacements with an unchanged space between them. A gap that stands between
 * two changes joins them, when the joined change both removes and adds
 * something. A paragraph break is never absorbed: it is where the eye rests.
 */
function joinAcrossGaps(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (let k = 0; k < runs.length; k++) {
    const run = runs[k];
    const between = out[out.length - 1];
    const earlier = out.length >= 2 ? out[out.length - 2] : undefined;
    // `out` ends with [a change][a gap] and this run is a change: consider joining the three
    if (run.kind === "change" && between?.kind === "same" && isGap(between.text) && earlier?.kind === "change" && earlier.del + run.del !== "" && earlier.add + run.add !== "") {
      out.pop();
      earlier.del += between.text + run.del;
      earlier.add += between.text + run.add;
      continue;
    }
    out.push(run.kind === "same" ? { kind: "same", text: run.text } : { kind: "change", del: run.del, add: run.add });
  }
  return out;
}

function toParts(runs: Run[]): DiffPart[] {
  const parts: DiffPart[] = [];
  for (const run of runs) {
    if (run.kind === "same") parts.push({ kind: "same", text: run.text });
    else {
      if (run.del !== "") parts.push({ kind: "del", text: run.del });
      if (run.add !== "") parts.push({ kind: "add", text: run.add });
    }
  }
  return parts;
}

/**
 * The difference between `before` and `after`. Word by word when the texts
 * are small enough, otherwise line by line, otherwise the differing middle as
 * a whole.
 */
export function diffText(before: string, after: string, limits: DiffLimits = DIFF_LIMITS): DiffResult {
  if (before === after) return { parts: before === "" ? [] : [{ kind: "same", text: before }], mode: "words", same: true };

  if (before.length + after.length <= limits.chars) {
    const words = compare(tokenizeWords(before), tokenizeWords(after), limits.cells);
    if (words) return { parts: toParts(joinAcrossGaps(settle(words))), mode: "words", same: false };
  }

  const lines = compare(tokenizeLines(before), tokenizeLines(after), limits.cells);
  if (lines) return { parts: toParts(lines), mode: "lines", same: false };

  // too long even by line: what the two share at the ends, and everything between as one removal and one addition
  let head = 0;
  const shortest = Math.min(before.length, after.length);
  while (head < shortest && before.charCodeAt(head) === after.charCodeAt(head)) head++;
  let tail = 0;
  while (tail < shortest - head && before.charCodeAt(before.length - 1 - tail) === after.charCodeAt(after.length - 1 - tail)) tail++;
  // never cut a pair of UTF-16 surrogates in half
  const isLow = (code: number) => code >= 0xdc00 && code <= 0xdfff;
  while (head > 0 && isLow(before.charCodeAt(head))) head--;
  while (tail > 0 && isLow(before.charCodeAt(before.length - tail))) tail--;
  return {
    parts: toParts([
      { kind: "same", text: before.slice(0, head) },
      { kind: "change", del: before.slice(head, before.length - tail), add: after.slice(head, after.length - tail) },
      { kind: "same", text: before.slice(before.length - tail) },
    ]).filter((part) => part.text !== ""),
    mode: "whole",
    same: false,
  };
}

/** How much of each kind there is, in words: for a one-line summary above a comparison. */
export function diffCounts(parts: readonly DiffPart[]): { added: number; removed: number } {
  // words, not punctuation marks or gaps
  const words = (text: string) => tokenizeWords(text).filter((token) => WORD_CHAR.test(token[0] ?? "")).length;
  let added = 0;
  let removed = 0;
  for (const part of parts) {
    if (part.kind === "add") added += words(part.text);
    else if (part.kind === "del") removed += words(part.text);
  }
  return { added, removed };
}

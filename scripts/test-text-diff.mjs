// Unit tests for src/lib/text-diff.ts (the comparison of two revisions of a blog post).
// Run: node --test scripts/test-text-diff.mjs      (Node 22.18 or later: it reads the TypeScript file directly)
import assert from "node:assert/strict";
import { test } from "node:test";
import { DIFF_LIMITS, diffCounts, diffText, tokenizeLines, tokenizeWords } from "../src/lib/text-diff.ts";

const join = (parts, kinds) => parts.filter((p) => kinds.includes(p.kind)).map((p) => p.text).join("");
const only = (parts, kind) => parts.filter((p) => p.kind === kind).map((p) => p.text);

/** The two things that must hold for every result: nothing lost, nothing invented. */
function rebuilds(before, after, result) {
  assert.equal(join(result.parts, ["same", "del"]), before, "same + del is the first text");
  assert.equal(join(result.parts, ["same", "add"]), after, "same + add is the second text");
  for (const part of result.parts) assert.notEqual(part.text, "", "no empty run");
  for (let i = 1; i < result.parts.length; i++) {
    const [a, b] = [result.parts[i - 1].kind, result.parts[i].kind];
    assert.notEqual(a, b, "neighbouring runs are of different kinds");
    assert.ok(!(a === "add" && b === "del"), "within a change, the removal comes first");
  }
}

test("tokens join back to the text, whatever is in it", () => {
  for (const text of ["", "one", "Hello, world.", "  two  spaces\n\nand a paragraph\n", "it’s a well-known fact: 1.5% (roughly)", "emoji 🙂 and ça", "tab\there\r\nwindows"]) {
    assert.equal(tokenizeWords(text).join(""), text);
    assert.equal(tokenizeLines(text).join(""), text);
  }
  assert.deepEqual(tokenizeWords("it’s well-known, yes."), ["it’s", " ", "well-known", ",", " ", "yes", "."]);
  assert.deepEqual(tokenizeWords("a\n\nb"), ["a", "\n\n", "b"]);
  assert.deepEqual(tokenizeLines("a\nb\n\nc"), ["a\n", "b\n", "\n", "c"]);
});

test("identical texts", () => {
  const same = diffText("The same words.", "The same words.");
  assert.equal(same.same, true);
  assert.deepEqual(same.parts, [{ kind: "same", text: "The same words." }]);
  assert.deepEqual(diffText("", ""), { parts: [], mode: "words", same: true });
});

test("an insertion", () => {
  const before = "Margin is the deposit a broker holds.";
  const after = "Margin is the deposit a broker holds against an open position.";
  const result = diffText(before, after);
  rebuilds(before, after, result);
  assert.equal(result.mode, "words");
  assert.equal(result.same, false);
  assert.deepEqual(only(result.parts, "del"), []);
  assert.deepEqual(only(result.parts, "add"), [" against an open position"]);
});

test("an insertion into nothing, and a deletion of everything", () => {
  const a = diffText("", "New words.");
  rebuilds("", "New words.", a);
  assert.deepEqual(a.parts, [{ kind: "add", text: "New words." }]);
  const b = diffText("Old words.", "");
  rebuilds("Old words.", "", b);
  assert.deepEqual(b.parts, [{ kind: "del", text: "Old words." }]);
});

test("a deletion", () => {
  const before = "The spread is the difference between the bid and the ask price, quoted in pips.";
  const after = "The spread is the difference between the bid and the ask price.";
  const result = diffText(before, after);
  rebuilds(before, after, result);
  assert.deepEqual(only(result.parts, "add"), []);
  assert.deepEqual(only(result.parts, "del"), [", quoted in pips"]);
});

test("a replacement reads as one change, not word by word with spaces between", () => {
  const before = "The central bank raised its policy rate on Thursday.";
  const after = "The central bank cut the main rate on Thursday, as expected.";
  const result = diffText(before, after);
  rebuilds(before, after, result);
  // three words replaced by three: one removal and one addition, joined across the single spaces between the words
  assert.deepEqual(only(result.parts, "del"), ["raised its policy"]);
  assert.deepEqual(only(result.parts, "add"), ["cut the main", ", as expected"]);
  // words are counted, not the comma
  assert.deepEqual(diffCounts(result.parts), { added: 5, removed: 3 });
});

test("an unchanged word between two changes keeps them apart", () => {
  const before = "The bank raised its policy rate.";
  const after = "The bank left its main rate.";
  const result = diffText(before, after);
  rebuilds(before, after, result);
  assert.deepEqual(only(result.parts, "del"), ["raised", "policy"]);
  assert.deepEqual(only(result.parts, "add"), ["left", "main"]);
});

test("a removed sentence is shown as the whole sentence, not shifted by a character", () => {
  const before = "First sentence. Second sentence. Third sentence.";
  const after = "First sentence. Third sentence.";
  const result = diffText(before, after);
  rebuilds(before, after, result);
  assert.deepEqual(only(result.parts, "add"), []);
  // (the comparison itself lands one character off, on ". Second sentence": the edit is then settled on the sentence)
  assert.deepEqual(only(result.parts, "del"), [" Second sentence."]);
});

test("an added paragraph takes its own blank line with it", () => {
  const before = "Paragraph one.\n\nParagraph three.";
  const after = "Paragraph one.\n\nParagraph two.\n\nParagraph three.";
  const result = diffText(before, after);
  rebuilds(before, after, result);
  assert.deepEqual(only(result.parts, "del"), []);
  assert.deepEqual(only(result.parts, "add"), ["Paragraph two.\n\n"]);
});

test("two changes far apart stay two changes", () => {
  const before = "Alpha beta gamma delta epsilon zeta eta theta.";
  const after = "Alpha BETA gamma delta epsilon zeta ETA theta.";
  const result = diffText(before, after);
  rebuilds(before, after, result);
  assert.deepEqual(only(result.parts, "del"), ["beta", "eta"]);
  assert.deepEqual(only(result.parts, "add"), ["BETA", "ETA"]);
});

test("punctuation is compared on its own", () => {
  const before = "Hello, world. It works";
  const after = "Hello; world! It works.";
  const result = diffText(before, after);
  rebuilds(before, after, result);
  assert.deepEqual(only(result.parts, "del"), [",", "."]);
  assert.deepEqual(only(result.parts, "add"), [";", "!", "."]);
  // the words themselves are untouched
  assert.ok(result.parts.some((p) => p.kind === "same" && p.text.includes("world")));
});

test("an apostrophe or a hyphen inside a word keeps the word whole", () => {
  const before = "The broker’s well-known rule.";
  const after = "The brokers well known rule.";
  const result = diffText(before, after);
  rebuilds(before, after, result);
  assert.ok(only(result.parts, "del").join("|").includes("broker’s"));
  assert.ok(only(result.parts, "del").join("|").includes("well-known"));
});

test("a moved paragraph is a removal in one place and an addition in the other", () => {
  const one = "First paragraph about gold and central banks.";
  const two = "Second paragraph, a much longer one, about margin calls and how a stop order behaves when a market gaps.";
  const three = "Third paragraph that stays where it is.";
  const before = [one, two, three].join("\n\n");
  const after = [two, one, three].join("\n\n");
  const result = diffText(before, after);
  rebuilds(before, after, result);
  assert.equal(result.mode, "words");
  // the longer paragraph is what the two orders share; the shorter one is shown leaving and arriving
  assert.equal(only(result.parts, "del").join("").trim(), one);
  assert.equal(only(result.parts, "add").join("").trim(), one);
  assert.ok(result.parts.some((p) => p.kind === "same" && p.text.includes(two)));
  assert.ok(result.parts.some((p) => p.kind === "same" && p.text.includes(three)));
});

test("a paragraph break is never swallowed into a change", () => {
  const before = "old one\n\nold two";
  const after = "new one\n\nnew two";
  const result = diffText(before, after);
  rebuilds(before, after, result);
  assert.ok(result.parts.some((p) => p.kind === "same" && p.text.includes("\n\n")));
});

test("characters outside the basic plane survive", () => {
  const before = "Rates 🙂 rose";
  const after = "Rates 🙃 rose";
  const result = diffText(before, after);
  rebuilds(before, after, result);
  assert.deepEqual(only(result.parts, "del"), ["🙂"]);
  assert.deepEqual(only(result.parts, "add"), ["🙃"]);
});

test("a long text with a small change is still compared word by word", () => {
  // 12,000 words, most of them shared: the shared start and end are set aside before the table is built
  const words = Array.from({ length: 12000 }, (_, i) => `word${i % 977}`);
  const before = words.join(" ");
  const changed = words.slice();
  changed[6000] = "CHANGED";
  const after = changed.join(" ");
  const result = diffText(before, after);
  rebuilds(before, after, result);
  assert.equal(result.mode, "words");
  assert.deepEqual(only(result.parts, "add"), ["CHANGED"]);
});

test("a very long input falls back to lines", () => {
  // 3,000 differing words on each side: 9,000,000 cells, over the limit of 4,000,000
  const line = (prefix, i) => Array.from({ length: 30 }, (_, k) => `${prefix}${i}x${k}`).join(" ");
  const shared = "A line both versions share.";
  const before = [shared, ...Array.from({ length: 100 }, (_, i) => line("a", i)), shared].join("\n");
  const after = [shared, ...Array.from({ length: 100 }, (_, i) => line("b", i)), shared].join("\n");
  assert.ok(100 * 30 * 2 * (100 * 30 * 2) > DIFF_LIMITS.cells);
  const started = Date.now();
  const result = diffText(before, after);
  assert.ok(Date.now() - started < 2000, "the fallback is quick");
  rebuilds(before, after, result);
  assert.equal(result.mode, "lines");
  // the shared lines at both ends are kept as they are
  assert.equal(result.parts[0].kind, "same");
  assert.ok(result.parts[0].text.startsWith(shared));
  assert.equal(result.parts[result.parts.length - 1].kind, "same");
  // every run of a line-level comparison is made of whole lines
  for (const part of result.parts.slice(0, -1)) assert.ok(part.text.endsWith("\n"), "a run ends at a line break");
});

test("a line-level comparison finds the line that changed", () => {
  const lines = Array.from({ length: 40 }, (_, i) => `Line number ${i} of the post.`);
  const before = lines.join("\n");
  const changed = lines.slice();
  changed[20] = "A different line.";
  const after = changed.join("\n");
  // limits small enough that words are not attempted
  const result = diffText(before, after, { chars: 10, cells: 10_000 });
  rebuilds(before, after, result);
  assert.equal(result.mode, "lines");
  assert.deepEqual(only(result.parts, "del"), ["Line number 20 of the post.\n"]);
  assert.deepEqual(only(result.parts, "add"), ["A different line.\n"]);
});

test("when even the lines are too many, the differing middle is given whole", () => {
  const before = `Start. ${Array.from({ length: 50 }, (_, i) => `a${i}`).join("\n")} End.`;
  const after = `Start. ${Array.from({ length: 50 }, (_, i) => `b${i}`).join("\n")} End.`;
  const result = diffText(before, after, { chars: 10, cells: 100 });
  rebuilds(before, after, result);
  assert.equal(result.mode, "whole");
  assert.equal(result.parts.length, 4);
  assert.deepEqual(result.parts.map((p) => p.kind), ["same", "del", "add", "same"]);
  assert.equal(result.parts[0].text, "Start. ");
  assert.ok(result.parts[3].text.endsWith(" End."));
});

test("the whole-text fallback never splits a surrogate pair", () => {
  const before = "x🙂y";
  const after = "x🙃y";
  const result = diffText(before, after, { chars: 0, cells: 0 });
  rebuilds(before, after, result);
  assert.equal(result.mode, "whole");
  assert.deepEqual(only(result.parts, "del"), ["🙂"]);
  assert.deepEqual(only(result.parts, "add"), ["🙃"]);
});

test("the largest body the blog accepts is compared within a second", () => {
  // two 60,000-character bodies that share nothing: the worst case for the table
  const body = (prefix) => {
    let out = "";
    for (let i = 0; out.length < 60000; i++) out += `${prefix}${i} `;
    return out.slice(0, 60000);
  };
  const before = body("p");
  const after = body("q");
  const started = Date.now();
  const result = diffText(before, after);
  assert.ok(Date.now() - started < 1000, `took ${Date.now() - started} ms`);
  rebuilds(before, after, result);
  assert.notEqual(result.mode, "words");
});

test("random edits always rebuild both texts", () => {
  // a small deterministic generator: the same cases on every run
  let seed = 20;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const vocabulary = ["rate", "bank", "gold", "the", "a", "of", ",", ".", "\n\n", " ", " ", " ", "margin", "1.5", "%", "it’s"];
  for (let round = 0; round < 300; round++) {
    const make = (length) => Array.from({ length }, () => vocabulary[Math.floor(next() * vocabulary.length)]).join("");
    const before = make(Math.floor(next() * 60));
    const after = next() < 0.3 ? before + make(5) : make(Math.floor(next() * 60));
    rebuilds(before, after, diffText(before, after));
    rebuilds(before, after, diffText(before, after, { chars: 0, cells: 1_000_000 }));
    rebuilds(before, after, diffText(before, after, { chars: 0, cells: 0 }));
  }
});

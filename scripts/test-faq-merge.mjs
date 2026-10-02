// Tests for the FAQ merge (src/lib/faq.ts): the code's questions with the
// console's rows applied. Run from the project root with Node 22.18 or later
// (it reads the TypeScript file directly):
//
//   node scripts/test-faq-merge.mjs
//
// Fixtures only: nothing here reads the database. Exits 1 when a check fails.
import { readFileSync } from "node:fs";
import { faqAnchor, faqAnswerProblem, faqChecks, faqPlainText, faqSlots, mergeFaqs } from "../src/lib/faq.ts";

const results = [];
const check = (name, pass, note = "") => results.push({ name, pass: !!pass, note });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---- fixtures ---- */
const categories = [
  { key: "accounts", label: "Accounts", blurb: "" },
  { key: "orders", label: "Orders", blurb: "" },
  { key: "funding", label: "Funding", blurb: "" },
];
// deliberately not grouped by category: the code's list is not promised to be
const base = [
  { id: "a-one", cat: "accounts", kind: "answer", q: "Accounts one?", a: "First." },
  { id: "o-one", cat: "orders", kind: "answer", q: "Orders one?", a: "First order.", links: [{ label: "Orders", href: "/trading/orders" }] },
  { id: "a-two", cat: "accounts", kind: "open", q: "Accounts two?", a: "Not yet published.", links: [{ label: "Ask", href: "/contact" }] },
  { id: "a-three", cat: "accounts", kind: "answer", q: "Accounts three?", a: "Third." },
  { id: "f-one", cat: "funding", kind: "answer", q: "Funding one?", a: "Only one." },
];
let n = 0;
const row = (over) => ({ id: `${String(++n).padStart(8, "0")}-0000-4000-8000-000000000000`, base_id: null, category: "accounts", question: "A new question?", answer: "A new answer.", position: 1000, status: "published", ...over });
const ok = (...rows) => ({ state: "ok", rows });
const ids = (merged, cat) => merged.items.filter((f) => f.cat === cat).map((f) => f.id);

/* ---- nothing to apply: the code's list itself ---- */
for (const [name, read] of [
  ["failed read (unavailable)", { state: "failed", reason: "unavailable" }],
  ["failed read (not configured)", { state: "failed", reason: "not-configured" }],
  ["no rows", { state: "none" }],
  ["an empty list of rows", ok()],
]) {
  const m = mergeFaqs(base, categories, read);
  check(`${name} falls back to the base: the same array, untouched`, m.items === base && m.changed === false && m.categories.length === 3);
}

/* ---- override replaces ---- */
{
  const r = row({ base_id: "a-one", question: "Accounts one, reworded?", answer: "A **better** first." });
  const m = mergeFaqs(base, categories, ok(r));
  const f = m.items.find((x) => x.id === "a-one");
  check("a published override replaces the question and the answer, and keeps the id", f && f.q === r.question && f.a === r.answer && f.md === true && f.kind === "answer");
  check("a published override keeps the question's place", same(ids(m, "accounts"), ["a-one", "a-two", "a-three"]));
  check("the other questions are the code's own objects", m.items.find((x) => x.id === "a-three") === base[3] && m.items.find((x) => x.id === "o-one") === base[1]);
  check("the merged list is marked as changed", m.changed === true);
}
{
  const m = mergeFaqs(base, categories, ok(row({ base_id: "a-two", answer: "Now answered." })));
  const f = m.items.find((x) => x.id === "a-two");
  check("an override of a 'not yet published' entry is a settled answer without the old links", f && f.kind === "answer" && f.links === undefined && f.md === true);
}
{
  const m = mergeFaqs(base, categories, ok(row({ base_id: "a-one", category: "orders" })));
  check("an override may move a question to another category", same(ids(m, "accounts"), ["a-two", "a-three"]) && same(ids(m, "orders"), ["a-one", "o-one"]));
}

/* ---- hidden removes ---- */
{
  const m = mergeFaqs(base, categories, ok(row({ base_id: "a-two", status: "hidden" })));
  check("a hidden row removes that base question", same(ids(m, "accounts"), ["a-one", "a-three"]) && m.items.length === 4);
}
{
  const m = mergeFaqs(base, categories, ok(row({ base_id: "f-one", status: "hidden" })));
  check("a category left with no question is not listed", same(m.categories.map((c) => c.key), ["accounts", "orders"]) && !m.items.some((f) => f.cat === "funding"));
}

/* ---- additions ordered ---- */
{
  const last = row({ question: "Zed, at the end?", position: 1000 });
  const between = row({ question: "Between one and two?", position: 15 });
  const first = row({ question: "Before everything?", position: 0 });
  const tieB = row({ question: "B tie?", position: 1000 });
  const atTen = row({ question: "At ten?", position: 10 });
  const m = mergeFaqs(base, categories, ok(last, between, first, tieB, atTen));
  check(
    "additions are placed by position among the code's 10, 20, 30…; at an equal place the code's question comes first, then by question",
    same(ids(m, "accounts"), [faqAnchor(first.id), "a-one", faqAnchor(atTen.id), faqAnchor(between.id), "a-two", "a-three", faqAnchor(tieB.id), faqAnchor(last.id)]),
    ids(m, "accounts").join(" "),
  );
  check("an addition is a settled answer in Markdown with its own anchor", m.items.find((f) => f.id === faqAnchor(first.id))?.md === true && /^q-[0-9a-f]{12}$/.test(faqAnchor(first.id)));
  check("items come out grouped in the order of the categories", same(m.items.map((f) => f.cat).filter((c, i, all) => c !== all[i - 1]), ["accounts", "orders", "funding"]));
}
{
  const m = mergeFaqs(base, categories, ok(row({ category: "orders", question: "A new order question?" })));
  check("an addition appears in its own category only", ids(m, "orders").length === 2 && ids(m, "accounts").length === 3);
}

{
  // two ids that share their first twelve characters: the second takes its whole id as the anchor
  const one = row({ id: "aaaaaaaa-bbbb-4000-8000-000000000001", question: "First twin?" });
  const two = row({ id: "aaaaaaaa-bbbb-4000-8000-000000000002", question: "Second twin?" });
  const anchors = mergeFaqs(base, categories, ok(one, two)).items.map((f) => f.id);
  check("no two questions ever share an anchor", new Set(anchors).size === anchors.length && anchors.includes("q-aaaaaaaabbbb") && anchors.includes(`q-${two.id}`));
}

/* ---- what changes nothing ---- */
{
  const m = mergeFaqs(base, categories, ok(row({ status: "draft" }), row({ base_id: "a-one", status: "draft", answer: "Draft words." })));
  check("drafts are ignored (and the list is the base itself)", m.items === base && m.changed === false);
}
{
  const m = mergeFaqs(base, categories, ok(row({ base_id: "no-such-question", answer: "Orphan." }), row({ base_id: "also-gone", status: "hidden" })));
  check("a row about an unknown base_id is ignored", m.items === base && m.changed === false);
}
{
  const m = mergeFaqs(base, categories, ok(row({ category: "partners" })));
  check("an addition in a category the code does not have is ignored", m.items === base);
}
{
  const m = mergeFaqs(base, categories, ok(row({ status: "hidden" })));
  check("a hidden row without a base_id is ignored", m.items === base);
}
{
  const m = mergeFaqs(base, categories, ok(row({ base_id: "a-one", answer: "First of two." }), row({ base_id: "a-one", status: "hidden" })));
  check("if two rows ever named one question, the first stands", m.items.find((f) => f.id === "a-one")?.a === "First of two.");
}
{
  const before = JSON.stringify(base);
  mergeFaqs(base, categories, ok(row({ base_id: "a-one" }), row({}), row({ base_id: "a-two", status: "hidden" })));
  check("the merge does not alter the base list", JSON.stringify(base) === before);
}

/* ---- the real FAQ ---- */
{
  const data = JSON.parse(readFileSync(new URL("../src/data/generated/faqs.json", import.meta.url), "utf8"));
  const m = mergeFaqs(data.items, data.categories, { state: "none" });
  check("the real FAQ with an empty table is the code's list itself", m.items === data.items && m.categories.length === data.categories.length, `${data.items.length} questions`);
  const slots = faqSlots(data.items);
  check("every real question has a place, in steps of ten within its category", data.items.every((f) => (slots.get(f.id) ?? 0) >= 10) && slots.get(data.items[0].id) === 10);
  const cats = [...readFileSync(new URL("../supabase/migrations/0016_faq.sql", import.meta.url), "utf8").matchAll(/category in \(([^)]+)\)/g)][0][1].split(",").map((s) => s.trim().replace(/'/g, ""));
  check("the migration's category list equals the categories in the code", same(cats, data.categories.map((c) => c.key)), cats.length + " keys");
  check("every real id has the shape the migration accepts for base_id", data.items.every((f) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.id) && f.id.length <= 96));
  check("every real question and answer fits the table's limits (so any of them can be hidden)", data.items.every((f) => f.q.length >= 10 && f.q.length <= 200 && f.a.length >= 10 && f.a.length <= 4000));
}

/* ---- words for structured data, and the editor's reminders ---- */
check("plain text drops the marks and keeps the words", faqPlainText("A **bold** and *soft* `term`, see [the page](/trading/accounts).\n\n- one\n- two\n\n1. first") === "A bold and soft term, see the page. one two first", faqPlainText("A **bold** and *soft* `term`, see [the page](/trading/accounts).\n\n- one\n- two\n\n1. first"));
check("a heading or a picture in an answer is named", faqAnswerProblem("Fine.\n\n## Not fine") === "heading" && faqAnswerProblem("![x](a/b.webp)") === "picture" && faqAnswerProblem("Plain. With a [link](/faq).") === null);
{
  const keys = (q, a) => faqChecks({ question: q, answer: a }).map((f) => f.key).join(",");
  check("the checklist is silent on a clean entry", keys("What is a pip?", "The smallest standard move of a price (see [the glossary](/glossary)).") === "");
  check("the checklist flags a question without a question mark", keys("What is a pip", "A small move.") === "question-mark");
  check("the checklist flags an answer without a full stop", keys("What is a pip?", "A small move") === "full-stop");
  check("the checklist flags ruled-out wording", keys("Is profit guaranteed?", "It is risk-free, buy now.") === "wording");
  check("the checklist flags an unsafe link and HTML", keys("Where is it?", "See [here](http://example.com) and <b>this</b>.") === "html,links");
}

/* ---- report ---- */
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.note && !r.pass ? `  [${r.note}]` : ""}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed} of ${results.length} passed`);
process.exit(failed ? 1 : 0);

import type { MilestoneData } from "@/data/milestones";

/**
 * MILESTONES — badges worked out from what this browser already records.
 *
 * Nothing new is stored. A badge is a reading of two things that exist
 * already: the glossary and Academy record (`gx:learn`: one entry per glossary
 * question answered correctly, one "lesson:<slug>" per lesson whose three
 * questions were answered) and `tourDone` in the preferences. Because they
 * are derived, they follow the desk's export and import, and they go when the
 * record is cleared.
 *
 * They mark pages read and questions answered on this device. They are not
 * qualifications, and the page says so.
 *
 * "Newly earned" is known for the length of a visit only, in memory: the
 * first reading of the record in a visit is the baseline, and a badge that
 * becomes earned after it is new. Nothing about that is kept.
 */

export type BadgeFamily = "terms" | "topic" | "lesson" | "level" | "path" | "lessons" | "tour" | "course";
export type BadgeGroup = "glossary" | "academy" | "course";

export type Badge = {
  id: string;
  group: BadgeGroup;
  family: BadgeFamily;
  title: string;
  /** one line saying exactly what earns it */
  how: string;
  have: number;
  need: number;
  earned: boolean;
  /** what the medallion engraves: a numeral, initials, or which of several (see Medallion) */
  mark: string;
  /** for a family drawn as "n of m" (a topic among the topics, a level among the levels): this one's place and how many there are */
  place?: { at: number; of: number };
};

const LESSON = "lesson:";
const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** two letters to engrave for a topic: "Technical analysis" TA, "Risk" Ri */
const initials = (s: string) => {
  const words = s.split(/[^A-Za-z]+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  return words[0] ? words[0][0].toUpperCase() + words[0].slice(1, 2).toLowerCase() : "";
};

/**
 * Every badge, in the order they are shown, with how far along each is.
 * `learned` is the stored record (name → true); `tourDone` the preference.
 */
export function badges(data: MilestoneData, learned: Readonly<Record<string, true>>, tourDone: boolean): Badge[] {
  const out: Badge[] = [];
  const term = (slug: string) => learned[slug] === true;
  const lesson = (slug: string) => learned[`${LESSON}${slug}`] === true;
  const count = (slugs: string[], has: (s: string) => boolean) => slugs.filter(has).length;
  const add = (b: Omit<Badge, "earned">) => out.push({ ...b, have: Math.min(b.have, b.need), earned: b.need > 0 && b.have >= b.need });

  /* ---- glossary ---- */
  const terms = data.topics.flatMap((t) => t.slugs);
  const termsDone = count(terms, term);
  if (terms.length > 0) {
    add({ id: "terms-1", group: "glossary", family: "terms", title: "First term", how: "One glossary “Check yourself” question answered correctly.", have: termsDone, need: 1, mark: "I" });
    if (terms.length > 10) add({ id: "terms-10", group: "glossary", family: "terms", title: "Ten terms", how: "Ten glossary questions answered correctly.", have: termsDone, need: 10, mark: "X" });
    if (terms.length > 50) add({ id: "terms-50", group: "glossary", family: "terms", title: "Fifty terms", how: "Fifty glossary questions answered correctly.", have: termsDone, need: 50, mark: "L" });
    add({ id: "terms-all", group: "glossary", family: "terms", title: "Every term", how: `All ${terms.length} glossary questions answered correctly.`, have: termsDone, need: terms.length, mark: "A–Z" });
  }
  data.topics.forEach((t, i) =>
    add({
      id: `topic-${slugOf(t.topic)}`,
      group: "glossary",
      family: "topic",
      title: t.topic,
      how: `Every question in the glossary topic “${t.topic}” answered correctly (${n(t.slugs.length, "term", "terms")}).`,
      have: count(t.slugs, term),
      need: t.slugs.length,
      mark: initials(t.topic),
      place: { at: i, of: data.topics.length },
    }),
  );

  /* ---- Academy ---- */
  const lessonsDone = count(data.lessons, lesson);
  if (data.lessons.length > 0) {
    add({ id: "lesson-1", group: "academy", family: "lesson", title: "First lesson", how: "One Academy lesson completed: all three of its questions answered correctly.", have: lessonsDone, need: 1, mark: "1" });
  }
  data.levels.forEach((lv, i) =>
    add({
      id: `level-${slugOf(lv.level)}`,
      group: "academy",
      family: "level",
      title: `${lv.level} level`,
      how: `Every lesson at the ${lv.level} level completed (${n(lv.slugs.length, "lesson", "lessons")}).`,
      have: count(lv.slugs, lesson),
      need: lv.slugs.length,
      mark: String(i + 1),
      place: { at: i, of: data.levels.length },
    }),
  );
  data.paths.forEach((p, i) =>
    add({
      id: `path-${slugOf(p.key)}`,
      group: "academy",
      family: "path",
      title: `Path: ${p.title}`,
      how: `Every published lesson on the learning path “${p.title}” completed (${n(p.slugs.length, "lesson", "lessons")}).`,
      have: count(p.slugs, lesson),
      need: p.slugs.length,
      mark: String(i + 1),
      place: { at: i, of: data.paths.length },
    }),
  );
  if (data.lessons.length > 1) {
    add({ id: "lessons-all", group: "academy", family: "lessons", title: "Every lesson", how: `All ${data.lessons.length} Academy lessons completed.`, have: lessonsDone, need: data.lessons.length, mark: String(data.lessons.length) });
  }

  /* ---- the whole course ---- */
  add({
    id: "tour",
    group: "course",
    family: "tour",
    title: "Guided tour",
    how: "The guided tour of the site started, or its invitation answered, in this browser. That is all the browser records about the tour: not whether it was finished.",
    have: tourDone ? 1 : 0,
    need: 1,
    mark: "N",
  });
  if (terms.length > 0 && data.lessons.length > 0) {
    add({
      id: "course",
      group: "course",
      family: "course",
      title: "Course complete",
      how: `Every glossary question answered correctly and every Academy lesson completed (${terms.length} terms and ${n(data.lessons.length, "lesson", "lessons")}).`,
      have: termsDone + lessonsDone,
      need: terms.length + data.lessons.length,
      mark: "",
    });
  }
  return out;
}

/* ---- what is new in this visit (memory only) ----------------------------------------- */

type Snapshot = { learned: Readonly<Record<string, true>>; tourDone: boolean };

/** the record as this visit first saw it, on whichever page looked first */
let before: Snapshot | null = null;
/** ids of the badges already counted as earned in this visit */
let seen: Set<string> | null = null;

/** Called by a page that shows no badges but where progress is made (a lesson), so a badge earned there is new when the visitor reaches the desk. */
export function rememberBaseline(learned: Readonly<Record<string, true>>, tourDone: boolean): void {
  if (before === null && seen === null) before = { learned, tourDone };
}

/**
 * The ids of badges earned since the baseline that have not been reported
 * yet. The first call in a visit sets the baseline (unless a page set it
 * earlier) and reports nothing: a badge already earned on arrival is not news.
 */
export function newlyEarned(data: MilestoneData, list: Badge[]): string[] {
  const now = list.filter((b) => b.earned).map((b) => b.id);
  if (seen === null) {
    const start = before ? badges(data, before.learned, before.tourDone).filter((b) => b.earned).map((b) => b.id) : now;
    seen = new Set(start);
  }
  const known = seen;
  // a badge lost (the record was cleared) can be earned, and announced, again
  for (const id of [...known]) if (!now.includes(id)) known.delete(id);
  const fresh = now.filter((id) => !known.has(id));
  for (const id of fresh) known.add(id);
  return fresh;
}

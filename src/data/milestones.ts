import { academyLevels, getLesson, lessons, lessonsOf, modulesByLevel, paths } from "./academy";
import { glossary, glossaryTopics } from "./glossary";
import { getLesson as getTermLesson } from "./glossary-learn";

/**
 * What the milestones on My desk and the Academy page are measured against:
 * the glossary terms that carry a "Check yourself" question, grouped by topic,
 * and the published Academy lessons, grouped by level and by learning path.
 *
 * Built on the server from the same data the glossary and the Academy pages
 * use, so a milestone's "all" is always what those pages show. It holds only
 * slugs and names: nothing about a visitor.
 */
export type MilestoneData = {
  /** glossary topics that have at least one term with a question, in the glossary's own order */
  topics: { topic: string; slugs: string[] }[];
  /** Academy levels that have at least one published lesson, in course order (grouped as the Academy page groups them: by the level of the module) */
  levels: { level: string; slugs: string[] }[];
  /** learning paths, each with the published lessons its steps link to */
  paths: { key: string; title: string; slugs: string[] }[];
  /** every published lesson, in course order */
  lessons: string[];
};

export function milestoneData(): MilestoneData {
  const withQuestion = glossary.filter((t) => getTermLesson(t.slug) !== null);
  return {
    topics: glossaryTopics.map((topic) => ({ topic, slugs: withQuestion.filter((t) => t.topic === topic).map((t) => t.slug) })).filter((t) => t.slugs.length > 0),
    levels: academyLevels
      .map((lv) => ({ level: lv.level as string, slugs: modulesByLevel(lv.level).flatMap((m) => lessonsOf(m).map((l) => l.slug)) }))
      .filter((lv) => lv.slugs.length > 0),
    paths: paths.map((p) => ({ key: p.key, title: p.title, slugs: [...new Set(p.steps.flatMap((s) => s.lessons))].filter((slug) => getLesson(slug) !== undefined) })).filter((p) => p.slugs.length > 0),
    lessons: lessons.map((l) => l.slug),
  };
}

import raw from "./generated/academy.json";

/**
 * GIO4X Academy: lessons, modules and learning paths.
 *
 * Carried over from the previous site after the editorial audit recorded in
 * docs/CONTENT-AUDIT.md (scripts/import-content.mjs). `body` is sanitised HTML
 * restricted to an allow-list of tags. Modules are outlines: a module lists
 * only the lessons that actually exist, and says so when it has none. There
 * are no certificates, lesson counts or hour counts, because none of them was
 * backed by content.
 */
export type AcademyLevel = "Beginner" | "Intermediate" | "Advanced" | "Professional concepts";

export type Lesson = {
  slug: string;
  title: string;
  /** meta description, human-written */
  description: string;
  level: AcademyLevel;
  /** key of the module the lesson belongs to */
  module: string;
  order: number;
  byline: string;
  published: string;
  updated?: string;
  readMinutes: number;
  tags: string[];
  /** related knowledge-graph node ids */
  related: string[];
  /** slugs of tools that let the reader work the idea */
  tools: string[];
  toc: { id: string; text: string }[];
  body: string;
};

export type AcademyModule = {
  key: string;
  title: string;
  level: AcademyLevel;
  summary: string;
  topics: string[];
  /** slugs of the lessons that exist; may be empty (outline only) */
  lessons: string[];
};

export type LearningPath = {
  key: string;
  title: string;
  summary: string;
  steps: { title: string; skills: string; lessons: string[] }[];
};

type AcademyData = { lessons: Lesson[]; modules: AcademyModule[]; paths: LearningPath[] };
const data = raw as unknown as AcademyData;

export const academyLevels: { level: AcademyLevel; line: string }[] = [
  { level: "Beginner", line: "The vocabulary and the mechanics: what is traded, how it is quoted and how a leveraged position is funded." },
  { level: "Intermediate", line: "Reading a chart and reading the economy: price structure, moving averages, and the policy that sits behind a currency." },
  { level: "Advanced", line: "Indicators, scheduled news and automation, each with what it measures and where it misleads." },
  { level: "Professional concepts", line: "How risk is sized, measured and lived with: the part of the craft that outlasts any one strategy." },
];

/**
 * Corrections to carried lesson bodies, by slug: an exact passage is replaced
 * at load, because generated/academy.json is never edited by hand.
 * - introduction-to-forex-trading: quoted a daily turnover figure with no
 *   source or date, which the editorial standards do not allow.
 */
const corrections: Record<string, { find: string; replace: string }[]> = {
  "introduction-to-forex-trading": [
    {
      find: "The forex market is the largest and most liquid financial market in the world, with a daily trading volume exceeding $7 trillion.",
      replace: "The forex market is the largest financial market in the world by turnover, which the Bank for International Settlements measures in a survey every three years.",
    },
  ],
};
const corrected = (l: Lesson): Lesson => {
  const fixes = corrections[l.slug];
  return fixes ? { ...l, body: fixes.reduce((body, f) => body.split(f.find).join(f.replace), l.body) } : l;
};

export const lessons: Lesson[] = data.lessons.map(corrected).sort((a, b) => a.order - b.order);
export const modules: AcademyModule[] = data.modules;
export const paths: LearningPath[] = data.paths;

const bySlug = new Map(lessons.map((l) => [l.slug, l]));
export const getLesson = (slug: string) => bySlug.get(slug);
export const getModule = (key: string) => modules.find((m) => m.key === key);
export const modulesByLevel = (level: AcademyLevel) => modules.filter((m) => m.level === level);
export const lessonsOf = (m: AcademyModule): Lesson[] => m.lessons.map((s) => bySlug.get(s)).filter((l): l is Lesson => Boolean(l));
export const startHere = paths.find((p) => p.key === "start-here") ?? paths[0];

/** Previous and next lesson inside the same module. */
export function neighbours(l: Lesson): { prev?: Lesson; next?: Lesson } {
  const m = getModule(l.module);
  if (!m) return {};
  const list = lessonsOf(m);
  const i = list.findIndex((x) => x.slug === l.slug);
  return { prev: i > 0 ? list[i - 1] : undefined, next: i >= 0 && i < list.length - 1 ? list[i + 1] : undefined };
}

/** Lessons that teach a glossary term (the term is among the lesson's related concepts). */
export const lessonsForTerm = (termSlug: string, n = 2) => lessons.filter((l) => l.related.includes(`c:${termSlug}`)).slice(0, n);

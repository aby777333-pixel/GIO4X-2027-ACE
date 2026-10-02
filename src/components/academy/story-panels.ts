import { storyArt } from "@/data/academy-story";
import { getTerm } from "@/data/glossary";
import { getLesson as getTermLesson } from "@/data/glossary-learn";
import type { DiagramSpec } from "@/data/glossary-learn/types";
import { splitChapters, type LessonChapter } from "./chapters";

/**
 * A lesson's chapters with the panel story mode shows beside each, resolved on
 * the server: a glossary term's own diagram is looked up here, so the client
 * receives only the one spec it will draw.
 */
export type StoryPanel =
  | { kind: "diagram"; spec: DiagramSpec; caption: string; term?: { slug: string; name: string } }
  /** one sentence of the chapter, set large: decoration, since the chapter itself says it */
  | { kind: "quote"; text: string };

export type StoryChapter = LessonChapter & { panel: StoryPanel | null };

function panelFor(slug: string, index: number): StoryPanel | null {
  const art = storyArt(slug, index);
  if (!art) return null;
  if ("quote" in art) return { kind: "quote", text: art.quote };
  if ("term" in art) {
    const term = getTerm(art.term);
    const spec = art.diagram ?? getTermLesson(art.term)?.diagram;
    // a term that has since lost its lesson or its entry: the caption still stands as a sentence of the chapter
    if (!spec) return { kind: "quote", text: art.caption };
    return { kind: "diagram", spec, caption: art.caption, term: term ? { slug: term.slug, name: term.term } : undefined };
  }
  return { kind: "diagram", spec: art.diagram, caption: art.caption };
}

/** `html` is the lesson's prepared body (after renderProse). A lesson with no story mapping gets chapters without panels. */
export function storyChapters(slug: string, html: string): StoryChapter[] {
  let section = 0;
  return splitChapters(html).map((chapter) => ({ ...chapter, panel: panelFor(slug, chapter.head ? section++ : -1) }));
}

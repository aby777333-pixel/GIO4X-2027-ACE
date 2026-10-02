import type { Metadata } from "next";
import { absoluteUrl } from "@/config/site";
import { BLOG_CATEGORY_LABEL, BLOG_PATH, blogImageUrl } from "@/lib/blog";
import { pageMeta } from "@/lib/meta";
import { articleSchema } from "@/lib/schema";
import type { BlogCover, BlogPost } from "@/lib/server/blog";
import { blogPostHref } from "./BlogList";
import { blogIso } from "./format";

/**
 * What a post tells a search engine and a share card, built from the fields a
 * writer fills in the console, each with its fallback:
 *
 *   title          seo_title, else the post's title
 *   description    seo_description, else the excerpt
 *   canonical      canonical_url, else the post's own address
 *   robots         noindex → "noindex, follow"
 *   share picture  og_image_path, else the cover, else the site's card
 *
 * Kept apart from the page so that the same functions can be run on a post
 * that is not in the database (a preview, a test).
 */

export const BLOG_FEED = { url: `${BLOG_PATH}/feed.xml`, title: "GIO4X daily blog" };

type ShareImage = { url: string; width?: number; height?: number; alt?: string };

/** The picture a share card uses. Its size and description are known only when it is the cover. */
export function blogShareImage(post: BlogPost, cover: BlogCover | null): ShareImage | null {
  const own = post.og_image_path ? blogImageUrl(post.og_image_path) : null;
  if (own) return { url: own };
  if (!cover) return null;
  return { url: cover.src, ...(cover.width && cover.height ? { width: cover.width, height: cover.height } : {}), ...(cover.alt ? { alt: cover.alt } : {}) };
}

const describe = (post: BlogPost) => post.seo_description.trim() || post.excerpt.trim() || `${post.title}. A post on the GIO4X daily blog by ${post.byline}.`;

/** The day a reader is told the post last changed materially: the correction, never an unannounced edit. */
const modified = (post: BlogPost) => blogIso(post.corrected_at ?? post.published_at);

export function blogPostMetadata(post: BlogPost, cover: BlogCover | null): Metadata {
  const path = blogPostHref(post.slug);
  const image = blogShareImage(post, cover);
  const base = pageMeta({
    title: post.seo_title.trim() || post.title,
    description: describe(post),
    path,
    type: "article",
    publishedTime: blogIso(post.published_at),
    modifiedTime: modified(post),
    index: post.noindex ? false : undefined,
    ownCard: !!image,
  });
  return {
    ...base,
    alternates: { canonical: post.canonical_url.trim() || path, types: { "application/rss+xml": [BLOG_FEED] } },
    // pageMeta has made this an "article"; the byline, the category and the tags are that type's own fields
    openGraph: { ...base.openGraph, ...(image ? { images: [image] } : {}), authors: [post.byline], section: BLOG_CATEGORY_LABEL[post.category], tags: post.tags } as NonNullable<Metadata["openGraph"]>,
    twitter: { ...base.twitter, ...(image ? { images: [image.alt ? { url: image.url, alt: image.alt } : image.url] } : {}) },
  };
}

/** BlogPosting structured data: only what is visibly on the page. The author is the desk, an organisation. */
export function blogPostSchema(post: BlogPost, cover: BlogCover | null) {
  const path = blogPostHref(post.slug);
  const image = blogShareImage(post, cover);
  return {
    ...articleSchema({
      path,
      type: "BlogPosting",
      headline: post.title,
      description: describe(post),
      datePublished: blogIso(post.published_at),
      dateModified: modified(post),
      author: post.byline,
      section: BLOG_CATEGORY_LABEL[post.category],
    }),
    url: absoluteUrl(path),
    image: image?.url ?? absoluteUrl("/opengraph-image"),
    isPartOf: { "@id": `${absoluteUrl(BLOG_PATH)}#blog` },
    ...(post.tags.length ? { keywords: post.tags.join(", ") } : {}),
  };
}

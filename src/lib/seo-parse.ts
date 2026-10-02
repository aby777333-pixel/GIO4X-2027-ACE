/**
 * Reading a page the way the SEO health screen needs to: the title, the meta
 * description, the canonical address, the robots instruction, how many <h1>
 * there are, and where the links go. Also the few things it needs from XML
 * (sitemaps and feeds) and from robots.txt.
 *
 * Careful string work, no dependency and no DOM. It reads this site's own
 * output, which is regular: it is not a general HTML parser and does not try
 * to be. Pure functions: nothing here fetches or stores anything.
 */

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", times: "×", middot: "·" };

/** Character references as text, so that a length is counted in characters a reader sees. */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

const tidy = (value: string) => decodeEntities(value).replace(/\s+/g, " ").trim();

/**
 * The document without the parts that only look like markup: comments,
 * scripts (the framework's data is carried in them, tags and all), styles,
 * and inline drawings, whose <title> is not the page's.
 */
export function visibleMarkup(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, "");
}

const ATTR = /([^\s"'=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

/** The attributes of one tag, names in lower case, values decoded. */
export function tagAttributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!(name in out)) out[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

export type PageFacts = {
  /** the <title>, or null when there is none */
  title: string | null;
  description: string | null;
  canonical: string | null;
  /** the content of <meta name="robots">, lower case, or null */
  robots: string | null;
  h1: number;
  /** every <a href>, as written */
  hrefs: string[];
};

/**
 * What a page says about itself. The whole document is read, not only <head>:
 * the framework may send a page's metadata after the head has gone out.
 */
export function readPage(html: string): PageFacts {
  const doc = visibleMarkup(html);

  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(doc);
  const title = titleMatch ? tidy(titleMatch[1]) : null;

  let description: string | null = null;
  let robots: string | null = null;
  for (const m of doc.matchAll(/<meta\b[^>]*>/gi)) {
    const a = tagAttributes(m[0]);
    const name = (a.name ?? "").toLowerCase();
    if (name === "description" && description === null) description = (a.content ?? "").replace(/\s+/g, " ").trim();
    if (name === "robots" && robots === null) robots = (a.content ?? "").toLowerCase();
  }

  let canonical: string | null = null;
  for (const m of doc.matchAll(/<link\b[^>]*>/gi)) {
    const a = tagAttributes(m[0]);
    if ((a.rel ?? "").toLowerCase().split(/\s+/).includes("canonical") && a.href) {
      canonical = a.href.trim();
      break;
    }
  }

  const hrefs: string[] = [];
  for (const m of doc.matchAll(/<a\b[^>]*>/gi)) {
    const href = tagAttributes(m[0]).href;
    if (href !== undefined) hrefs.push(href.trim());
  }

  return {
    title: title === "" ? null : title,
    description: description === "" ? null : description,
    canonical,
    robots,
    h1: (doc.match(/<h1[\s>]/gi) ?? []).length,
    hrefs,
  };
}

/** Whether a robots instruction (a meta tag's content or an X-Robots-Tag header) asks not to be indexed. */
export const saysNoindex = (value: string | null | undefined): boolean => !!value && /(^|[\s,:])(noindex|none)([\s,]|$)/i.test(value);

/* ---- XML ------------------------------------------------------------------ */

export type XmlCheck = { ok: true } | { ok: false; problem: string };

/**
 * Whether every tag that opens is closed, in order: the mistake a hand-built
 * sitemap or feed makes. It is a balance check, not a validating parser.
 */
export function xmlBalanced(xml: string): XmlCheck {
  const body = xml
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");
  if (!body.trim()) return { ok: false, problem: "The document is empty." };
  const stack: string[] = [];
  let roots = 0;
  let last = 0;
  const TAG = /<(\/?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^<>"'])*?)(\/?)>/g;
  for (const m of body.matchAll(TAG)) {
    // anything between two tags that still holds "<" is a tag that did not parse
    if (body.slice(last, m.index).includes("<")) return { ok: false, problem: "There is a “<” that does not begin a tag." };
    last = (m.index ?? 0) + m[0].length;
    const [, closing, name, , selfClosing] = m;
    if (closing) {
      const open = stack.pop();
      if (open !== name) return { ok: false, problem: open ? `<${open}> is closed by </${name}>.` : `</${name}> closes nothing.` };
    } else if (!selfClosing) {
      if (stack.length === 0) roots++;
      stack.push(name);
    } else if (stack.length === 0) roots++;
  }
  if (body.slice(last).includes("<")) return { ok: false, problem: "There is a “<” that does not begin a tag." };
  if (stack.length) return { ok: false, problem: `<${stack[stack.length - 1]}> is never closed.` };
  if (roots !== 1) return { ok: false, problem: roots === 0 ? "There is no element in the document." : "There is more than one top-level element." };
  return { ok: true };
}

/** The text of every <name>…</name>, decoded. For <loc> in a sitemap and <link> in a feed. */
export function xmlTexts(xml: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}\\s*>`, "g");
  for (const m of xml.matchAll(re)) {
    const text = decodeEntities(m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1")).trim();
    if (text) out.push(text);
  }
  return out;
}

/** The <item>…</item> blocks of an RSS feed. */
export function xmlBlocks(xml: string, name: string): string[] {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}\\s*>`, "g");
  return [...xml.matchAll(re)].map((m) => m[1]);
}

/* ---- robots.txt ----------------------------------------------------------- */

export type RobotsFacts = {
  /** the group for every crawler ("User-agent: *") refuses the whole site */
  disallowAll: boolean;
  /** what that group disallows */
  disallow: string[];
  sitemaps: string[];
};

export function readRobots(text: string): RobotsFacts {
  const disallow: string[] = [];
  const sitemaps: string[] = [];
  let agents: string[] = [];
  let inRules = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const at = line.indexOf(":");
    if (at < 1) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();
    if (key === "user-agent") {
      // consecutive User-agent lines share the rules that follow; a User-agent after rules starts a new group
      if (inRules) agents = [];
      inRules = false;
      agents.push(value);
    } else if (key === "sitemap") {
      if (value) sitemaps.push(value);
    } else {
      inRules = true;
      if (key === "disallow" && agents.includes("*") && value) disallow.push(value);
    }
  }
  return { disallowAll: disallow.includes("/"), disallow, sitemaps };
}

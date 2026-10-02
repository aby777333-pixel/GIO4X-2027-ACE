#!/usr/bin/env node
/**
 * GIO4X site images: the list of pictures shipped with the website itself.
 *
 *   node scripts/site-images.mjs
 *
 * Reads every image under public/ and writes
 *   src/data/generated/site-images.json
 * with, for each one: its address on the site, its size in bytes, its width
 * and height in pixels (read from the file's own header), and the source
 * files that refer to it.
 *
 * Why a generated file: the console's Media screen (Site images tab) shows
 * this list, and on the host the server function does not have public/ on
 * disk, so it cannot look at request time. The file is committed, and
 * `npm run build` runs this script first (the "prebuild" script) so a deploy
 * can never carry a stale list.
 *
 * How a reference is found, and what that can and cannot say:
 *   "path"   a source file contains the picture's address as written
 *            ("/brand/gio4x-logo.png").
 *   "parts"  a source file builds an address inside the picture's folder
 *            ("/platforms/${…}"), and the picture's name without its size
 *            suffix ("mt5-terminal") appears in the source: an address built
 *            from parts, as src/components/platforms/Screenshot.tsx does.
 * A picture with no reference found may still be used (an address assembled
 * some other way, or a file a browser asks for by convention).
 *
 * Plain Node ESM, no dependencies, deterministic and re-runnable: the same
 * tree gives the same file, byte for byte, and the file is not rewritten when
 * nothing changed. It never fails a build: on any error it says so and leaves
 * the committed file as it is.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const SRC = path.join(ROOT, "src");
const OUT = path.join(SRC, "data", "generated", "site-images.json");
const OUT_REL = "src/data/generated/site-images.json";

const TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
/** Source files that can name a picture. */
const SOURCE_EXT = new Set([".ts", ".tsx", ".css", ".json", ".mjs"]);
/** Files outside src/ that can name one too. */
const EXTRA_SOURCES = ["next.config.mjs"];

const say = (s) => process.stdout.write(`${s}\n`);
const posix = (p) => p.split(path.sep).join("/");

function walk(dir, keep) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, keep));
    else if (entry.isFile() && keep(full)) out.push(full);
  }
  return out;
}

/* ---- width and height, from each format's own header ---------------------- */

function pngSize(b) {
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47 || b.toString("latin1", 12, 16) !== "IHDR") return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function gifSize(b) {
  if (b.length < 10 || b.toString("latin1", 0, 3) !== "GIF") return null;
  return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
}

function jpegSize(b) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1];
    // the frame headers (baseline, progressive and their kin) carry the size; DHT, JPG and DAC share the range and do not
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    }
    // markers without a length
    if (marker === 0xff) {
      i++;
      continue;
    }
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      i += 2;
      continue;
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

function webpSize(b) {
  if (b.length < 30 || b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WEBP") return null;
  const kind = b.toString("latin1", 12, 16);
  if (kind === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (kind === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (kind === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
  }
  return null;
}

function avifSize(b) {
  // the image spatial extents box: "ispe", four bytes of version and flags, then width and height
  const at = b.indexOf("ispe", 0, "latin1");
  if (at < 0 || at + 16 > b.length) return null;
  return { width: b.readUInt32BE(at + 8), height: b.readUInt32BE(at + 12) };
}

function icoSize(b) {
  if (b.length < 8 || b.readUInt16LE(0) !== 0 || b.readUInt16LE(2) !== 1 || b.readUInt16LE(4) < 1) return null;
  // the first image in the file; 0 stands for 256
  return { width: b[6] || 256, height: b[7] || 256 };
}

function svgSize(b) {
  const head = b.toString("utf8", 0, Math.min(b.length, 4096));
  const tag = /<svg\b[^>]*>/i.exec(head)?.[0];
  if (!tag) return null;
  const attr = (name) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1];
  const w = Number.parseFloat(attr("width") ?? "");
  const h = Number.parseFloat(attr("height") ?? "");
  if (w > 0 && h > 0 && !/%/.test(`${attr("width")}${attr("height")}`)) return { width: Math.round(w), height: Math.round(h) };
  const box = (attr("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  return box.length === 4 && box[2] > 0 && box[3] > 0 ? { width: Math.round(box[2]), height: Math.round(box[3]) } : null;
}

const SIZERS = { ".png": pngSize, ".jpg": jpegSize, ".jpeg": jpegSize, ".webp": webpSize, ".avif": avifSize, ".gif": gifSize, ".svg": svgSize, ".ico": icoSize };

function sizeOf(ext, bytes) {
  try {
    const size = SIZERS[ext]?.(bytes) ?? null;
    return size && size.width > 0 && size.height > 0 && size.width <= 100000 && size.height <= 100000 ? size : null;
  } catch {
    return null;
  }
}

/* ---- the list ------------------------------------------------------------- */

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function build() {
  const images = walk(PUBLIC, (f) => path.extname(f).toLowerCase() in TYPES);

  const sources = [
    ...walk(SRC, (f) => SOURCE_EXT.has(path.extname(f).toLowerCase()) && path.resolve(f) !== path.resolve(OUT)),
    ...EXTRA_SOURCES.map((f) => path.join(ROOT, f)).filter((f) => fs.existsSync(f)),
  ]
    .map((file) => ({ file: posix(path.relative(ROOT, file)), text: fs.readFileSync(file, "utf8") }))
    // the temporary preview routes builders use are not part of the site
    .filter((s) => !s.file.includes("/zz-preview"));

  const list = images.map((full) => {
    const ext = path.extname(full).toLowerCase();
    const bytes = fs.readFileSync(full);
    const web = `/${posix(path.relative(PUBLIC, full))}`;
    const folder = web.slice(0, web.lastIndexOf("/") + 1);
    // "mt5-terminal-1600.webp" → "mt5-terminal": the name a component builds the address from
    const stem = path.basename(full, path.extname(full)).replace(/-\d+$/, "");
    const stemRe = new RegExp(`(?<![\\w-])${escapeRe(stem)}(?![\\w-])`);

    const refs = [];
    for (const s of sources) {
      if (s.text.includes(web)) refs.push({ file: s.file, how: "path" });
      else if (folder !== "/" && stem.length >= 3 && s.text.includes(`${folder}\${`) && sources.some((o) => stemRe.test(o.text))) refs.push({ file: s.file, how: "parts" });
    }
    refs.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));

    const size = sizeOf(ext, bytes);
    return { path: web, type: TYPES[ext], bytes: bytes.length, width: size?.width ?? null, height: size?.height ?? null, refs };
  });
  list.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return `${JSON.stringify({ generatedBy: "scripts/site-images.mjs", images: list }, null, 2)}\n`;
}

try {
  if (!fs.existsSync(PUBLIC)) {
    say("site-images: there is no public/ folder here. Nothing was changed.");
  } else {
    const next = build();
    const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").replace(/\r\n/g, "\n") : "";
    if (before === next) {
      say(`site-images: ${OUT_REL} is up to date.`);
    } else {
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, next);
      say(`site-images: wrote ${OUT_REL}.`);
    }
  }
} catch (error) {
  // a list of pictures is never a reason to stop a deploy: the committed file stays as it is
  say(`site-images: could not rebuild the list (${error instanceof Error ? error.message : "unknown error"}). The existing file was left unchanged.`);
}

/**
 * Generates the maskable app icons from the brand mark.
 *
 *   node scripts/make-icons.mjs
 *
 * A maskable icon is cropped by the device to its own shape (circle, squircle),
 * so the mark must sit inside the central "safe zone" on an opaque ground. The
 * mark is never redrawn or recoloured: it is the supplied asset, scaled, on the
 * ivory page colour (`--bg`). Uses sharp, which is already installed as part of
 * Next.js; nothing is added to package.json. The "any" icons (icon-192.png,
 * icon-512.png) are the existing files and are not touched.
 */
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../public/", import.meta.url);
const mark = fileURLToPath(new URL("brand/gio4x-mark.png", root));
const GROUND = "#f6f4ee";
/** the mark's share of the icon's width: inside the 80% safe circle with room to spare */
const SHARE = 0.6;

for (const size of [192, 512]) {
  const inner = Math.round(size * SHARE);
  const scaled = await sharp(mark).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const out = fileURLToPath(new URL(`icon-maskable-${size}.png`, root));
  await sharp({ create: { width: size, height: size, channels: 4, background: GROUND } })
    .composite([{ input: scaled, gravity: "centre" }])
    .flatten({ background: GROUND })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`wrote ${out}`);
}

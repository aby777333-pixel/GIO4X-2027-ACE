/**
 * The pictures shipped with the website itself (everything under public/).
 *
 * The list is made by scripts/site-images.mjs, which `npm run build` runs
 * first, and is committed: the server function on the host has no public/
 * folder to look into at request time. These pictures are part of the code and
 * change only with a deploy.
 */
import manifest from "@/data/generated/site-images.json";

export type SiteImageRef = {
  /** the source file, from the project root */
  file: string;
  /** "path": the address is written out there; "parts": the address is built there from a folder and a name */
  how: string;
};

export type SiteImage = {
  /** the address on the website, starting with "/" */
  path: string;
  type: string;
  bytes: number;
  /** pixels, read from the file's own header; null when the header could not be read */
  width: number | null;
  height: number | null;
  refs: SiteImageRef[];
};

export const siteImages: readonly SiteImage[] = manifest.images;

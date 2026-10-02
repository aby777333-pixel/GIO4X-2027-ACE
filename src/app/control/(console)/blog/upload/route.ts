/**
 * POST /control/blog/upload  →  one picture into the public `blog` bucket.
 *
 * For holders of blog.write, checked here and again by the storage policy
 * (blog_images_staff_insert in 0011_blog.sql): the file is stored AS THE
 * SIGNED-IN USER. There is no privileged client.
 *
 *   · POST with a same-origin check, so another site cannot make a writer's
 *     browser upload something.
 *   · One file, at most 4 MB, one of JPEG, PNG, WebP or AVIF. The declared
 *     type and the file's own first bytes must agree (./sniff.ts). No SVG,
 *     no GIF.
 *   · The path is made here, never from the file's own name:
 *     <yyyy>/<mm>/<16 random hex>.<ext>. The name a file arrived with is not
 *     read, stored or logged.
 *   · upsert is off: an upload can never replace a picture a published post
 *     already shows.
 *
 * Answers JSON with fixed messages: { ok: true, path } or { ok: false, error }.
 * A server action is not used because a file should not travel through one.
 */
import { randomBytes } from "node:crypto";
import { BLOG_BUCKET, BLOG_LIMITS, isBlogImagePath } from "@/lib/blog";
import { fail, isSameOrigin, json } from "@/lib/server/http";
import { can, getAccess } from "@/lib/server/staff";
import { BLOG_IMAGE_EXT, isBlogImageType, sniffImageType } from "./sniff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The multipart envelope around the file: boundaries and one part header. */
const ENVELOPE = 16 * 1024;

const TOO_LARGE = "That picture is larger than 4 MB. Export it smaller and try again.";
const WRONG_TYPE = "That file is not a JPEG, PNG, WebP or AVIF picture.";
const ONE_FILE = "Send one picture at a time.";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, "Not allowed.");

  const access = await getAccess();
  if (access.state === "unconfigured" || access.state === "unavailable") return fail(503, "Pictures cannot be uploaded just now.");
  if (access.state === "anonymous") return fail(401, "Sign in to continue.");
  if (access.state !== "staff" || !can(access, "blog.write")) return fail(403, "Your role cannot upload pictures.");

  // refuse an oversized body before reading it
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > BLOG_LIMITS.image + ENVELOPE) return fail(413, TOO_LARGE);
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) return fail(415, ONE_FILE);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "The upload could not be read. Try again.");
  }
  const parts = form.getAll("file");
  const file = parts[0];
  if (parts.length !== 1 || !(file instanceof File)) return fail(400, ONE_FILE);
  if (file.size === 0) return fail(400, "That file is empty.");
  if (file.size > BLOG_LIMITS.image) return fail(413, TOO_LARGE);
  if (!isBlogImageType(file.type)) return fail(415, WRONG_TYPE);

  const bytes = new Uint8Array(await file.arrayBuffer());
  // what the file says it is and what it is must be the same thing
  if (sniffImageType(bytes.subarray(0, 64)) !== file.type) return fail(415, WRONG_TYPE);

  const now = new Date();
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(8).toString("hex")}.${BLOG_IMAGE_EXT[file.type]}`;
  if (!isBlogImagePath(path)) return fail(500, "The picture could not be stored. Try again.");

  try {
    const { error } = await access.supabase.storage.from(BLOG_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: "31536000" });
    if (error) {
      // the storage policy refusing is the only refusal worth telling apart; nothing storage said is passed on
      const status = "statusCode" in error ? String(error.statusCode) : "";
      if (status === "403" || status === "401") return fail(403, "Your role cannot upload pictures.");
      if (status === "413") return fail(413, TOO_LARGE);
      return fail(502, "The picture could not be stored. Try again.");
    }
  } catch {
    return fail(502, "The picture could not be stored. Try again.");
  }

  return json({ ok: true as const, path }, 201);
}

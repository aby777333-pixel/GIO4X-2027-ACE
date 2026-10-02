/**
 * GET /control/media/list?page=<n>  →  JSON
 *
 * What the blog editor's "Choose from the library" picker asks for: the
 * pictures in the public `blog` bucket, newest first, a page at a time.
 *
 * For holders of blog.read, checked here and again by storage (policy
 * blog_images_staff_select in 0011_blog.sql): the bucket is listed AS THE
 * SIGNED-IN USER. There is no privileged client.
 *
 * It changes nothing, so it is a plain GET with no same-origin rule; another
 * site cannot read the answer (no CORS headers) and the cookies are
 * SameSite=Lax. The response is never cached.
 */
import { MEDIA_PICKER_MAX_PAGE, MEDIA_PICKER_PER_PAGE, type MediaListAnswer } from "@/components/control/media-shared";
import { fail, json } from "@/lib/server/http";
import { listMedia } from "@/lib/server/media";
import { can, getAccess } from "@/lib/server/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const access = await getAccess();
  if (access.state === "unconfigured" || access.state === "unavailable") return fail(503, "The library is not available just now.", undefined, PRIVATE);
  if (access.state === "anonymous") return fail(401, "Sign in to continue.", undefined, PRIVATE);
  if (access.state !== "staff" || !can(access, "blog.read")) return fail(403, "Your role does not include the blog’s pictures.", undefined, PRIVATE);

  const raw = new URL(request.url).searchParams.get("page") ?? "1";
  const page = /^\d{1,4}$/.test(raw) ? Math.min(Math.max(1, Number(raw)), MEDIA_PICKER_MAX_PAGE) : 1;

  const listing = await listMedia(access.supabase);
  if (listing.state === "failed") return fail(503, "The library could not be read just now.", undefined, PRIVATE);

  const from = (page - 1) * MEDIA_PICKER_PER_PAGE;
  const slice = listing.items.slice(from, from + MEDIA_PICKER_PER_PAGE);
  const body: MediaListAnswer = {
    ok: true,
    items: slice.map((i) => ({ path: i.path, name: i.name, size: i.size, type: i.type, uploadedAt: i.uploadedAt })),
    page,
    more: page < MEDIA_PICKER_MAX_PAGE && listing.items.length > from + MEDIA_PICKER_PER_PAGE,
  };
  return json(body, 200, PRIVATE);
}

"use server";

/**
 * The one action of the SEO health screen: "Re-check now".
 *
 * It writes nothing to the database. It drops the kept report, so that the
 * screen the caller is sent back to reads the website again. Who is calling
 * is established here as for every action; the check itself runs when the
 * page renders, against the host of that request and nothing else.
 */
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { SEO_CACHE_TAG } from "@/lib/server/seo-check";
import { can, getAccess, SIGN_IN_PATH } from "@/lib/server/staff";

const SEO = "/control/seo";

export async function recheckSeo(): Promise<void> {
  const access = await getAccess();
  if (access.state === "anonymous") redirect(SIGN_IN_PATH);
  if (access.state !== "staff") redirect("/control");
  if (!can(access, "blog.read")) redirect(`${SEO}?error=forbidden`);

  revalidateTag(SEO_CACHE_TAG);
  redirect(`${SEO}?notice=rechecked`);
}

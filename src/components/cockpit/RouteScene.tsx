"use client";

import { usePathname } from "next/navigation";
import { HeroScene } from "@/components/cockpit/HeroScene";
import { sceneFor } from "@/components/cockpit/routes";
import type { SceneId } from "@/components/cockpit/scenes";

/**
 * The instrument for the page being shown. Pages do not choose their scene:
 * the route does (see routes.ts), so a new page under an existing section is
 * dressed correctly without touching it. `scene` overrides the route's choice.
 */
export function RouteScene({ scene, tag }: { scene?: SceneId; tag?: string }) {
  const pathname = usePathname() ?? "/";
  const choice = sceneFor(pathname);
  return <HeroScene key={pathname} scene={scene ?? choice.scene} tag={tag ?? choice.tag} seed={pathname} />;
}

import { LOOK_BOOT_SCRIPT } from "@/components/control/look";

/**
 * The props every console root carries: the default look as attributes (what
 * the server can know), which the boot script then corrects from this
 * browser's stored choice before anything is painted. The server and the
 * browser may therefore disagree about these attributes, on purpose: hence
 * `suppressHydrationWarning`, as on <html> for the public site's preferences.
 */
export const LOOK_ROOT_PROPS = {
  "data-gxc-root": "",
  "data-gxc-theme": "light",
  "data-gxc-palette": "navy",
  suppressHydrationWarning: true,
} as const;

/** Must be the FIRST child of a console root: it sets the stored look on its parent element. */
export function LookBoot() {
  return <script dangerouslySetInnerHTML={{ __html: LOOK_BOOT_SCRIPT }} />;
}

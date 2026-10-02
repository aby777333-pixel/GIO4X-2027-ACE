import type { ReactNode } from "react";
import { Backdrop, type BackdropVariant } from "@/components/figures/Backdrop";

/**
 * Section opening for the Markets pages: eyebrow, heading, optional lead and
 * an optional action on the baseline. The same composition as the shared
 * `SectionHead`, without the scroll reveal: these pages stream their data, and
 * a heading near the top of the page must already be in place when it arrives.
 * Like `SectionHead`, the empty space to the right of the heading carries a
 * faint backdrop on wide screens (`backdrop={false}` for none).
 */
export function Head({
  id,
  eyebrow,
  title,
  lead,
  action,
  size = "h2",
  className = "",
  backdrop = "auto",
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  size?: "h2" | "h3";
  className?: string;
  backdrop?: BackdropVariant | "auto" | false;
}) {
  return (
    <div className={`relative flex flex-col gap-21 md:flex-row md:items-end md:justify-between ${className}`}>
      {backdrop && <Backdrop variant={backdrop} />}
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 id={id} className={`${size} ${eyebrow ? "mt-13" : ""} max-w-[22ch]`}>
          {title}
        </h2>
        {lead && <p className="lead mt-13 max-w-[58ch]">{lead}</p>}
      </div>
      {action && (
        <div className="shrink-0" data-backdrop-hole>
          {action}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/**
 * The support hours, when staff have published them (Control, site settings;
 * read through site_public() with the anonymous role). The text is shown as
 * written. When nothing has been set, or it cannot be read, nothing is shown:
 * the page never invents hours.
 */
export function SupportHours() {
  const [hours, setHours] = useState("");

  useEffect(() => {
    let live = true;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("site_public");
        if (!live || error || typeof data !== "object" || data === null || Array.isArray(data)) return;
        const support = (data as Record<string, unknown>).support;
        if (typeof support !== "object" || support === null || Array.isArray(support)) return;
        const text = (support as Record<string, unknown>).hours;
        if (typeof text === "string" && text.trim()) setHours(text.trim().slice(0, 240));
      } catch {
        /* unreachable or refused: show nothing */
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (!hours) return null;
  return (
    <div>
      <p className="label">Support hours</p>
      <p className="mt-5 text-sm text-ink-2">{hours}</p>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

/** Copy a string to the clipboard and confirm it, quietly, in place. */
export function CopyButton({ text, label, done = "Copied", className = "btn btn-ghost btn-sm" }: { text: string; label: string; done?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // clipboard API unavailable (insecure context, permissions): fall back to a selection
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      area.remove();
    }
    setState(ok ? "done" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2600);
  }

  return (
    <button type="button" onClick={copy} className={className}>
      <span aria-live="polite">{state === "done" ? done : state === "failed" ? "Copy failed" : label}</span>
    </button>
  );
}

/**
 * Share controls. Small on purpose: a copy button with confirmation, the
 * device's own share sheet when it has one, and plain links for the rest.
 * No third-party script is loaded and nothing is counted.
 */
export function Share({ url, title, compact = false }: { url: string; title: string; compact?: boolean }) {
  const [native, setNative] = useState(false);
  useEffect(() => setNative(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { name: "X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { name: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}` },
    { name: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}` },
    { name: "Email", href: `mailto:?subject=${t}&body=${u}` },
  ];

  return (
    <div className="no-print">
      <div className="flex flex-wrap items-center gap-8">
        <CopyButton text={url} label="Copy link" done="Link copied" />
        {native && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              navigator.share({ title, url }).catch(() => undefined);
            }}
          >
            Share…
          </button>
        )}
      </div>
      {!compact && (
        <ul className="mt-13 flex flex-wrap gap-x-13 gap-y-3 text-sm">
          {links.map((l) => (
            <li key={l.name}>
              <a href={l.href} className="link-quiet inline-flex min-h-[1.625rem] items-center underline decoration-line-strong decoration-dotted underline-offset-4" {...(l.name === "Email" ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
                {l.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

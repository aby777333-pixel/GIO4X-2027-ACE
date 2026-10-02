"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MEDIA_UPLOAD_PATH } from "@/components/control/media-shared";
import { BLOG_IMAGE_TYPES, BLOG_LIMITS } from "@/lib/blog";

/**
 * Two buttons under a picture: its path as a post stores it, and the mark that
 * puts it in a post's body. The clipboard is the browser's; nothing is sent
 * anywhere. When the browser will not allow it, the line says so and the path
 * is printed beside the picture to be selected by hand.
 */
export function CopyButtons({ path }: { path: string }) {
  const [said, setSaid] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async (text: string, done: string) => {
    let message = done;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      message = "This browser did not allow copying. Select the path above instead.";
    }
    setSaid(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaid(""), 4000);
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-5">
        <button type="button" className="btn btn-ghost btn-sm" data-copy="path" onClick={() => copy(path, "Path copied.")}>
          Copy path
        </button>
        <button type="button" className="btn btn-ghost btn-sm" data-copy="markdown" onClick={() => copy(`![Describe the picture](${path})`, "Markdown copied. Replace the words in the brackets with a description of the picture.")}>
          Copy Markdown
        </button>
      </div>
      <p role="status" className="text-xs text-ink-3 empty:hidden" data-copied>
        {said}
      </p>
    </div>
  );
}

type UploadState = { phase: "idle" | "busy" | "done" | "error"; message: string };

function uploadAnswer(value: unknown): { path: string } | { error: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as { ok?: unknown; path?: unknown; error?: unknown };
  if (v.ok === true && typeof v.path === "string") return { path: v.path };
  if (v.ok === false && typeof v.error === "string") return { error: v.error };
  return null;
}

/**
 * Adds one picture to the library through the blog's own upload route
 * (POST /control/blog/upload), which checks the role, the size and the file's
 * own bytes, and decides the path. The checks here only save a round trip.
 * The file's name is not sent.
 */
export function MediaUpload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ phase: "idle", message: "" });

  const send = async (file: File) => {
    if (!(BLOG_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setState({ phase: "error", message: "That file is not a JPEG, PNG, WebP or AVIF picture. SVG and GIF are not accepted." });
      return;
    }
    if (file.size > BLOG_LIMITS.image) {
      setState({ phase: "error", message: `That picture is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The limit is 4 MB: export it smaller and try again.` });
      return;
    }
    setState({ phase: "busy", message: "Uploading…" });
    try {
      const body = new FormData();
      // a fixed name: the route makes the stored path itself
      body.append("file", file, "picture");
      const response = await fetch(MEDIA_UPLOAD_PATH, { method: "POST", body, credentials: "same-origin" });
      const answer = uploadAnswer(await response.json().catch(() => null));
      if (answer && "path" in answer) {
        setState({ phase: "done", message: `Uploaded as ${answer.path}. It is first in the list below.` });
        // read the list again, as the signed-in user, with the new picture in it
        router.refresh();
        return;
      }
      setState({ phase: "error", message: answer && "error" in answer ? answer.error : "The picture could not be uploaded. Try again." });
    } catch {
      setState({ phase: "error", message: "The upload did not reach the server. Check the connection and try again." });
    }
  };

  return (
    <div className="grid gap-5 md:justify-items-end">
      <input
        ref={input}
        id="media-upload-file"
        type="file"
        hidden
        tabIndex={-1}
        aria-hidden
        accept={BLOG_IMAGE_TYPES.join(",")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // cleared so that choosing the same file again is still a change
          e.target.value = "";
          if (file) void send(file);
        }}
      />
      <button type="button" className="btn btn-primary" disabled={state.phase === "busy"} onClick={() => input.current?.click()} data-media-upload>
        {state.phase === "busy" ? "Uploading…" : "Upload a picture"}
      </button>
      <p role="status" className={`max-w-[26rem] break-words text-xs empty:hidden md:text-right ${state.phase === "error" ? "font-medium text-neg" : "text-ink-3"}`} data-media-upload-status>
        {state.phase === "busy" ? "" : state.message}
      </p>
    </div>
  );
}

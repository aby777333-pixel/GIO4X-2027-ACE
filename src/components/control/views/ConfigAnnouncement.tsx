"use client";

import { useState } from "react";
import { saveAnnouncement } from "@/app/control/actions-config";
import { SubmitButton } from "@/components/control/SubmitButton";
import { AnnouncementLine } from "@/components/shell/AnnouncementBar";

export type AnnouncementValue = { enabled: boolean; text: string; href: string; tone: "info" | "notice" };

const TEXT_MAX = 200;
const HREF_MAX = 200;
/** The rule the action and the database apply: a path on this site. Checked here only to say so before saving. */
const SAME_SITE_PATH = /^\/([^/\\\s][^\\\s]*)?$/;

/**
 * The announcement form, with the line drawn beneath it as the website will
 * draw it (the same component the website uses). The state here is only what
 * is being typed: the saved value arrives as a prop, and saving is the server
 * action's job.
 */
export function ConfigAnnouncement({ value }: { value: AnnouncementValue }) {
  const [enabled, setEnabled] = useState(value.enabled);
  const [text, setText] = useState(value.text);
  const [href, setHref] = useState(value.href);
  const [tone, setTone] = useState(value.tone);

  const line = text.replace(/\s+/g, " ").trim();
  const link = href.trim();
  const linkBad = link !== "" && (link.length > HREF_MAX || !SAME_SITE_PATH.test(link));
  const willShow = enabled && line !== "";

  return (
    <form action={saveAnnouncement} className="grid gap-21">
      <label className="check">
        <input type="checkbox" name="enabled" value="1" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>
          <span className="font-medium text-ink">Show the announcement on the website</span>
          <span className="block text-xs text-ink-3">It shows only while this is ticked and the line below is not empty.</span>
        </span>
      </label>

      <div className="field">
        <label htmlFor="announcement-text">The line</label>
        <input
          id="announcement-text"
          name="text"
          type="text"
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={TEXT_MAX}
          autoComplete="off"
          aria-describedby="announcement-text-hint"
        />
        <p id="announcement-text-hint" className="flex flex-wrap justify-between gap-x-13 text-xs text-ink-3">
          <span>One line of plain text. It is shown exactly as typed.</span>
          <span className="num">
            {text.length} of {TEXT_MAX} characters
          </span>
        </p>
      </div>

      <div className="grid items-start gap-13 sm:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)]">
        <div className="field">
          <label htmlFor="announcement-href">Link (optional)</label>
          <input
            id="announcement-href"
            name="href"
            type="text"
            className="input"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            maxLength={HREF_MAX}
            placeholder="/status"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={linkBad}
            aria-describedby="announcement-href-hint"
          />
          <p id="announcement-href-hint" className={`text-xs ${linkBad ? "text-neg" : "text-ink-3"}`}>
            {linkBad ? "A link must be a page on this website: start it with / and leave out spaces." : "A page on this website, starting with /. It is shown as “Read more” after the line."}
          </p>
        </div>
        <div className="field">
          <label htmlFor="announcement-tone">Tone</label>
          <select id="announcement-tone" name="tone" className="select" value={tone} onChange={(e) => setTone(e.target.value === "notice" ? "notice" : "info")}>
            <option value="info">Information</option>
            <option value="notice">Notice</option>
          </select>
          <p className="text-xs text-ink-3">Notice is the warmer of the two, for something a visitor should not miss.</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-ink-3">Preview</p>
        {/* a picture of the line: the link and the close mark cannot be used here */}
        <div className="mt-8 overflow-hidden rounded-md border border-line" role="img" aria-label={`Preview of the announcement line: ${tone === "notice" ? "Notice" : "Announcement"}. ${line || "No text yet."}`}>
          <AnnouncementLine announcement={{ text: line || "Your line of text appears here.", href: linkBad ? "" : link, tone }} />
        </div>
        <p className="mt-8 text-xs text-ink-3">
          {willShow ? "Once saved, this appears above the page on every public page. A visitor can dismiss it for the rest of their visit." : enabled ? "There is no text, so the website will show nothing." : "Not ticked, so the website will show nothing once saved."}
        </p>
      </div>

      <div>
        <SubmitButton pending="Saving…">Save announcement</SubmitButton>
      </div>
    </form>
  );
}

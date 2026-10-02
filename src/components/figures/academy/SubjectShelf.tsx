"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Figure, clamp, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";

/**
 * The reading list as a bookcase, for the column of subjects on
 * /academy/books. One spine per book on the list and one block of spines per
 * subject, in the order of the list beside it, on two shelves. The block for
 * the subject being read (the section of the page that is in view) is lit, and
 * its books are drawn out one after another, as if being taken down in turn.
 *
 * The counts are the page's own: the figure is given the same groups the list
 * of subjects is built from. Nothing else is shown: no titles, no numbers.
 *
 * Pointer: the spines under it rise off the shelf, the nearest one furthest.
 */

export type ShelfGroup = { id: string; count: number };

/** a fixed fraction for spine i: the same bookcase on every visit */
const seeded = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type Spine = { group: number; inGroup: number; row: number; slot: number };

function layout(groups: ShelfGroup[]) {
  const total = groups.reduce((n, g) => n + g.count, 0);
  // the first shelf takes whole subjects until it holds half of the books
  let split = groups.length;
  for (let i = 0, run = 0; i < groups.length; i++) {
    run += groups[i].count;
    if (run * 2 >= total) {
      split = i + 1;
      break;
    }
  }
  const spines: Spine[] = [];
  const rows = [
    { slots: 0, gaps: 0 },
    { slots: 0, gaps: 0 },
  ];
  groups.forEach((g, gi) => {
    const row = gi < split ? 0 : 1;
    if (rows[row].slots > 0) rows[row].gaps++;
    for (let k = 0; k < g.count; k++) spines.push({ group: gi, inGroup: k, row, slot: rows[row].slots + k });
    rows[row].slots += g.count;
  });
  // gaps before a spine, counted within its own shelf
  const gapsBefore = spines.map((s) => {
    let n = 0;
    for (let gi = s.row === 0 ? 0 : split; gi < s.group; gi++) n++;
    return n;
  });
  return { spines, rows, gapsBefore, widest: Math.max(rows[0].slots + rows[0].gaps * 0.9, rows[1].slots + rows[1].gaps * 0.9, 1) };
}

function makeDraw(groups: ShelfGroup[], active: { current: number }): FigureDraw {
  const { spines, rows, gapsBefore, widest } = layout(groups);
  const lit = new Float32Array(groups.length);
  let primed = false;

  return (f) => {
    const { ctx, w, h, t, dt, hover, mx, my, pal, still } = f;
    const padX = 9;
    const unit = Math.min((w - padX * 2) / widest, 15);
    const gap = unit * 0.9;
    const shelfY = [h * 0.47, h - 11];
    const tall = h * 0.47 - 15;

    // the subject in view takes the light gradually
    const a = clamp(active.current, 0, groups.length - 1);
    for (let g = 0; g < lit.length; g++) {
      const target = g === a ? 1 : 0;
      lit[g] = still || !primed ? target : lit[g] + (target - lit[g]) * (1 - Math.exp(-dt * 5));
    }
    primed = true;

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // the two shelves
    ctx.strokeStyle = rgba(pal.ink, 0.5);
    ctx.lineWidth = 1.5;
    for (let r = 0; r < 2; r++) {
      if (!rows[r].slots) continue;
      ctx.beginPath();
      ctx.moveTo(padX - 4, shelfY[r] + 0.75);
      ctx.lineTo(w - padX + 4, shelfY[r] + 0.75);
      ctx.stroke();
    }

    // which book of the lit subject is being taken down
    const turn = still ? 1.5 : t * 0.42;

    for (let i = 0; i < spines.length; i++) {
      const s = spines[i];
      const rowW = rows[s.row].slots * unit + rows[s.row].gaps * gap;
      const x0 = (w - rowW) / 2 + s.slot * unit + gapsBefore[i] * gap;
      const bw = unit - 2.5;
      const bh = tall * (0.62 + 0.38 * seeded(i + 1));
      const base = shelfY[s.row];
      const glow = lit[s.group];

      // drawn out in turn (the lit subject), and lifted by the pointer
      const n = groups[s.group].count;
      const phase = (((turn - s.inGroup) % n) + n) % n;
      const out = glow * smooth(1 - Math.abs(phase - 0.5) * 2);
      const dx = (mx - (x0 + bw / 2)) / (unit * 2.2);
      const dy = (my - (base - bh / 2)) / (tall * 0.9);
      const near = hover * Math.exp(-(dx * dx + dy * dy));
      const lift = Math.max(out * 7, near * 9);

      const y1 = base - lift;
      const y0 = y1 - bh;
      ctx.beginPath();
      ctx.rect(x0 + 1.25, y0, bw, bh);
      ctx.fillStyle = rgba(pal.surface, 1);
      ctx.fill();
      ctx.fillStyle = rgba(pal.accent, lerp(0, 0.2, glow));
      ctx.fill();
      ctx.strokeStyle = glow > 0.5 ? rgba(pal.accent, lerp(0.5, 0.95, glow)) : rgba(pal.ink, lerp(0.42, 0.75, Math.max(near, glow * 2)));
      ctx.lineWidth = 1.1;
      ctx.stroke();

      // the band on the spine: gold on the book that is out
      const band = clamp(Math.max(out, near));
      ctx.strokeStyle = band > 0.05 ? rgba(pal.gold, lerp(0.5, 1, band)) : rgba(pal.ink, 0.28);
      ctx.lineWidth = band > 0.05 ? 1.75 : 1;
      ctx.beginPath();
      ctx.moveTo(x0 + 3.25, y0 + bh * 0.2);
      ctx.lineTo(x0 + bw - 0.75, y0 + bh * 0.2);
      ctx.stroke();
    }

    // a rule under each subject's block; the lit one in the accent
    for (let g = 0; g < groups.length; g++) {
      const first = spines.find((s) => s.group === g);
      if (!first) continue;
      const i = spines.indexOf(first);
      const rowW = rows[first.row].slots * unit + rows[first.row].gaps * gap;
      const x0 = (w - rowW) / 2 + first.slot * unit + gapsBefore[i] * gap;
      const y = shelfY[first.row] + 6;
      ctx.strokeStyle = lit[g] > 0.02 ? rgba(pal.accent, lerp(0.3, 1, lit[g])) : rgba(pal.ink, 0.22);
      ctx.lineWidth = lerp(1, 2, lit[g]);
      ctx.beginPath();
      ctx.moveTo(x0 + 1.25, y);
      ctx.lineTo(x0 + groups[g].count * unit - 1.25, y);
      ctx.stroke();
    }
  };
}

export function SubjectShelf({ groups }: { groups: ShelfGroup[] }) {
  const active = useRef(0);
  // under reduced motion the host draws one frame and stops: a new frame is asked for by remounting it
  const [stillKey, setStillKey] = useState(0);
  const key = groups.map((g) => `${g.id}:${g.count}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the content of `groups`
  const draw = useMemo(() => makeDraw(groups, active), [key]);

  useEffect(() => {
    const ids = key.split("|").map((k) => k.slice(0, k.lastIndexOf(":")));
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const read = () => {
      raf = 0;
      // the subject in view: the last section whose heading has passed the upper third of the window
      const line = window.innerHeight * 0.35;
      let now = 0;
      ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) now = i;
      });
      if (now === active.current) return;
      active.current = now;
      if (reduced.matches || root.dataset.motion === "reduced" || root.dataset.effects === "low") setStillKey(now);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [key]);

  return <Figure key={stillKey} draw={draw} ratio={1.3} />;
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { KIND_LABEL, KIND_ORDER, getNode, neighbours, type Link as Relation } from "@/data/graph";
import { Constellation, STAGE_COMPACT, STAGE_WIDE, type StageConfig } from "./Constellation";
import { KindLegend, KindMark } from "./glyph";
import { computeLayout, frameAt, type Layout, type XY } from "./layout";
import { NodeSearch } from "./NodeSearch";

export const UNIVERSE_DEFAULT = "i:xau-usd";
const DURATION = 680; // --t-reveal
const TRAIL = 6;

const STARTS: { id: string; label: string }[] = [
  { id: "i:xau-usd", label: "Gold" },
  { id: "i:eur-usd", label: "EUR/USD" },
  { id: "cb:fed", label: "The Fed" },
  { id: "c:inflation", label: "Inflation" },
  { id: "c:leverage", label: "Leverage" },
];

function readHash(): string | null {
  try {
    const id = decodeURIComponent(window.location.hash.slice(1));
    return id && getNode(id) ? id : null;
  } catch {
    return null;
  }
}

/* ── the stage: owns the layout and the one transition between layouts ──── */

type Anim = { focus: string; layout: Layout; from: Map<string, XY> | null; t: number; run: number };

function Stage({ focus, animate, cfg, active, onPick, onHover }: { focus: string; animate: boolean; cfg: StageConfig; active: string | null; onPick: (id: string) => void; onHover: (id: string | null) => void }) {
  const [anim, setAnim] = useState<Anim>(() => ({ focus, layout: computeLayout(focus, cfg), from: null, t: 1, run: 0 }));
  const box = useRef<HTMLDivElement>(null);
  const visible = useRef(true);

  // A new focus: remember where everything is drawn right now and reorganise from there.
  if (anim.focus !== focus) {
    const now = frameAt(anim.layout, anim.from, anim.t);
    const from = new Map<string, XY>();
    for (const [id, p] of now.pos) if (p.o > 0.4) from.set(id, { x: p.x, y: p.y });
    setAnim({ focus, layout: computeLayout(focus, cfg), from: animate ? from : null, t: animate ? 0 : 1, run: animate ? anim.run + 1 : anim.run });
  }

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (anim.run === 0) return;
    const root = document.documentElement;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";
    // No motion wanted, or nobody is looking: go straight to the finished picture.
    if (still || !visible.current || document.hidden) {
      setAnim((a) => ({ ...a, t: 1 }));
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = !visible.current || document.hidden ? 1 : Math.min(1, (now - start) / DURATION);
      setAnim((a) => ({ ...a, t }));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anim.run]);

  const frame = useMemo(() => frameAt(anim.layout, anim.from, anim.t), [anim.layout, anim.from, anim.t]);
  return (
    <div ref={box}>
      <Constellation layout={anim.layout} cfg={cfg} frame={frame} active={active} onPick={onPick} onHover={onHover} />
    </div>
  );
}

/* ── the experience ─────────────────────────────────────────────────────── */

export function MarketUniverse() {
  const [view, setView] = useState<{ focus: string; animate: boolean }>({ focus: UNIVERSE_DEFAULT, animate: false });
  const [trail, setTrail] = useState<string[]>([UNIVERSE_DEFAULT]);
  const [hover, setHover] = useState<string | null>(null);
  const [cursor, setCursor] = useState(-1);
  /** null until mounted: the server renders both compositions and CSS picks one */
  const [wide, setWide] = useState<boolean | null>(null);

  const focus = view.focus;
  const node = getNode(focus) ?? getNode(UNIVERSE_DEFAULT);
  const links = neighbours(focus);

  const show = useCallback((id: string, opts: { push: boolean; animate: boolean }) => {
    if (!getNode(id)) return;
    setView((v) => (v.focus === id ? v : { focus: id, animate: opts.animate }));
    setTrail((t) => (t[t.length - 1] === id ? t : [...t.filter((x) => x !== id), id].slice(-TRAIL)));
    setCursor(-1);
    setHover(null);
    if (opts.push && readHash() !== id) window.history.pushState(null, "", `#${id}`);
  }, []);

  // deep links: the focused node lives in the hash, and Back retraces the walk
  useEffect(() => {
    const initial = readHash();
    if (initial) {
      // a shared link opens on its own node, and the path starts there
      setView((v) => (v.focus === initial ? v : { focus: initial, animate: false }));
      setTrail([initial]);
    }
    const onHash = () => show(readHash() ?? UNIVERSE_DEFAULT, { push: false, animate: true });
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onHash);
    };
  }, [show]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1080px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const pick = useCallback((id: string) => show(id, { push: true, animate: true }), [show]);
  const onLink = (id: string) => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let the browser open the deep link
    e.preventDefault();
    pick(id);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = links.length;
    if (!n) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % n);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c <= 0 ? n - 1 : c - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setCursor(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setCursor(n - 1);
    } else if ((e.key === "Enter" || e.key === " ") && cursor >= 0 && links[cursor]) {
      e.preventDefault();
      pick(links[cursor].node.id);
    } else if (e.key === "Escape") {
      setCursor(-1);
    }
  };

  const groups = useMemo(() => {
    const out: { kind: (typeof KIND_ORDER)[number]; items: Relation[] }[] = [];
    for (const k of KIND_ORDER) {
      const items = links.filter((l) => l.node.kind === k);
      if (items.length) out.push({ kind: k, items });
    }
    return out;
  }, [links]);

  if (!node) return null;
  const pointed = cursor >= 0 ? links[cursor] : undefined;
  const active = hover ?? pointed?.node.id ?? null;
  const status = pointed
    ? `${pointed.node.label}, ${KIND_LABEL[pointed.node.kind].one}. ${pointed.sentence} Press Enter to centre it.`
    : `Centred on ${node.label}, ${KIND_LABEL[node.kind].one}. ${links.length} direct ${links.length === 1 ? "relation" : "relations"}.`;

  return (
    <div>
      {/* controls */}
      <div className="grid gap-21 lg:grid-cols-phi lg:items-end lg:gap-55">
        <div className="grid min-w-0 gap-13 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <NodeSearch label="Jump to a node" placeholder="Gold, yen, Fed, CPI, margin…" onPick={pick} />
          <p className="hidden pb-13 text-xs text-ink-3 sm:block">
            <span className="num">{links.length}</span> direct {links.length === 1 ? "relation" : "relations"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="label">Starting points</p>
          <ul className="scroll-x -mx-gutter mt-8 flex gap-8 px-gutter pb-3 lg:mx-0 lg:flex-wrap lg:px-0">
            {STARTS.map((s) => (
              <li key={s.id} className="shrink-0">
                <a href={`#${s.id}`} onClick={onLink(s.id)} aria-current={focus === s.id ? "true" : undefined} className={`btn btn-sm ${focus === s.id ? "btn-primary" : "btn-ghost"} !h-[2.75rem] lg:!h-[2.125rem]`}>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* path walked so far */}
      <nav aria-label="Nodes visited" className="mt-21 border-y border-line py-8">
        <ol className="scroll-x flex items-center gap-x-8 text-xs text-ink-3">
          <li className="label shrink-0 pr-5">Path</li>
          {trail.map((id, i) => {
            const n = getNode(id);
            if (!n) return null;
            const last = i === trail.length - 1;
            return (
              <li key={id} className="flex shrink-0 items-center gap-8">
                {i > 0 && <span aria-hidden className="h-px w-13 bg-line-strong" />}
                {last ? (
                  <span aria-current="step" className="flex min-h-[2.125rem] items-center gap-5 font-semibold text-ink">
                    <KindMark kind={n.kind} size={11} />
                    {n.short}
                  </span>
                ) : (
                  <a href={`#${id}`} onClick={onLink(id)} className="link-quiet flex min-h-[2.125rem] items-center gap-5">
                    <KindMark kind={n.kind} size={11} />
                    {n.short}
                  </a>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mt-21 grid gap-34 lg:grid-cols-phi lg:items-start lg:gap-55">
        {/* 61.8%: the universe */}
        <figure className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]">
          <div
            tabIndex={0}
            role="group"
            aria-label={`Map of ${node.label} and what it is related to`}
            aria-describedby="gxu-keys"
            onKeyDown={onKey}
            onBlur={() => setCursor(-1)}
            className="grid-field relative mx-auto overflow-hidden rounded border border-line bg-paper lg:mx-0 lg:max-w-[min(100%,calc(100svh-var(--header-h)-10.5rem))]"
          >
            {wide !== false && (
              <div className={wide === null ? "hidden lg:block" : undefined}>
                <Stage focus={focus} animate={view.animate} cfg={STAGE_WIDE} active={active} onPick={pick} onHover={setHover} />
              </div>
            )}
            {wide !== true && (
              <div className={wide === null ? "lg:hidden" : undefined}>
                <Stage focus={focus} animate={view.animate} cfg={STAGE_COMPACT} active={active} onPick={pick} onHover={setHover} />
              </div>
            )}
          </div>
          <figcaption className="mt-13 grid gap-13">
            <KindLegend />
            <p id="gxu-keys" className="hidden text-xs text-ink-3 lg:block">
              Inner ring: direct relations, grouped by kind. Outer ring: a selection of what those connect to. Click any node to centre it. With the map focused, the arrow keys move between neighbours and Enter centres one; the browser’s Back button retraces your path.
            </p>
            <p className="text-xs text-ink-3 lg:hidden">Inner ring: direct relations. Outer ring: what those connect to. Tap a node, or use the list below.</p>
          </figcaption>
          <p className="sr-only" aria-live="polite" role="status">
            {status}
          </p>
        </figure>

        {/* 38.2%: the context panel. On small screens this is the main content. */}
        <section aria-labelledby="gxu-focus" className="min-w-0">
          <p className="flex items-center gap-8">
            <KindMark kind={node.kind} />
            <span className="label">{KIND_LABEL[node.kind].one}</span>
          </p>
          <h2 id="gxu-focus" className="h2 mt-8">
            {node.label}
          </h2>
          {node.sub && node.sub !== KIND_LABEL[node.kind].one && <p className="mt-5 text-sm text-ink-3">{node.sub}</p>}
          <p className="mt-13 max-w-measure text-ink-2">{node.blurb}</p>
          <Link href={node.href} className="go mt-21">
            Open the page
          </Link>

          <div className="mt-34 border-t border-line-strong">
            {groups.map((g) => (
              <section key={g.kind} aria-label={`${KIND_LABEL[g.kind].many} related to ${node.label}`}>
                <h3 className="label flex items-baseline justify-between border-b border-line pb-8 pt-21">
                  <span>{g.items.length === 1 ? KIND_LABEL[g.kind].one : KIND_LABEL[g.kind].many}</span>
                  <span className="num">{String(g.items.length).padStart(2, "0")}</span>
                </h3>
                <ul>
                  {g.items.map((l) => {
                    const hot = active === l.node.id;
                    return (
                      <li key={l.node.id} className={`flex items-stretch border-b border-line transition-colors duration-fast ${hot ? "bg-brand-soft" : ""}`}>
                        <a
                          href={`#${l.node.id}`}
                          onClick={onLink(l.node.id)}
                          onPointerEnter={() => setHover(l.node.id)}
                          onPointerLeave={() => setHover(null)}
                          onFocus={() => setHover(l.node.id)}
                          onBlur={() => setHover(null)}
                          className="group flex min-h-[3.4375rem] min-w-0 flex-1 items-start gap-13 py-13 pr-13"
                        >
                          <KindMark kind={l.node.kind} className="mt-[0.3rem]" />
                          <span className="min-w-0">
                            <span className="block text-[0.9375rem] font-medium text-ink transition-colors duration-fast group-hover:text-accent">
                              {l.node.label}
                              {l.node.sub && l.node.kind === "instrument" && <span className="font-normal text-ink-3"> · {l.node.sub}</span>}
                            </span>
                            <span className="mt-2 block text-sm text-ink-2">{l.sentence}</span>
                            <span className="sr-only"> Centre the map on {l.node.label}.</span>
                          </span>
                        </a>
                        <Link href={l.node.href} aria-label={`Open the page for ${l.node.label}`} className="link-quiet flex w-[3.4375rem] shrink-0 items-center justify-center border-l border-line text-[0.6875rem] font-semibold uppercase tracking-[0.08em]">
                          Page
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <noscript>
            <p className="mt-21 text-sm text-ink-3">JavaScript is switched off, so this is the fixed view for {node.label}. Each “Page” link opens the full page for that entry.</p>
          </noscript>
        </section>
      </div>
    </div>
  );
}

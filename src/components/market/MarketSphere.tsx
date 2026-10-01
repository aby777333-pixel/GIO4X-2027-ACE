"use client";

import { useEffect, useRef, useState } from "react";
import { allCentreStatus, fxSessions, windowInUtc, type CentreStatus } from "@/lib/sessions";

/**
 * THE MARKET SPHERE — the GIO4X hero visual.
 *
 * An orthographic globe of fine coordinate lines, with the world's financial
 * centres placed at their real positions and lit according to their real
 * regular trading hours right now. Open centres are joined by liquidity
 * pathways; the outer dial is a 24-hour UTC clock carrying the four FX session
 * windows. Nothing here is a price: it is geography and timetable, drawn live.
 *
 * Craft notes
 *  - Canvas 2D, no WebGL and no dependency: ~4 KB of drawing code.
 *  - The sphere turns to face whichever region is trading, then drifts slowly.
 *  - Pauses when off-screen or the tab is hidden; a single static frame is
 *    drawn under reduced motion or "low visual effects".
 *  - A text equivalent of the same information is provided for screen readers.
 */

const DEG = Math.PI / 180;
const PHI = 1.618;

type Vec = [number, number, number];

const toVec = (lat: number, lon: number): Vec => {
  const a = lat * DEG;
  const b = lon * DEG;
  return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
};

function slerp(a: Vec, b: Vec, t: number): Vec {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const om = Math.acos(dot);
  if (om < 1e-4) return a;
  const s = Math.sin(om);
  const k1 = Math.sin((1 - t) * om) / s;
  const k2 = Math.sin(t * om) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

type Palette = { ink: string; faint: string; stroke: string; teal: string; blue: string; emerald: string; warn: string; muted: string; bg: string; font: string };

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  return {
    ink: v("--ink", "#14191d"),
    faint: v("--viz-faint", "rgba(20,25,29,.08)"),
    stroke: v("--viz-stroke", "rgba(20,25,29,.2)"),
    teal: v("--teal", "#00807a"),
    blue: v("--brand", "#0868aa"),
    emerald: v("--emerald", "#067636"),
    warn: v("--warn", "#8a5d0c"),
    muted: v("--ink-3", "#626b73"),
    bg: v("--bg", "#f6f4ee"),
    font: cs.fontFamily || "system-ui, sans-serif",
  };
}

export function MarketSphere({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [summary, setSummary] = useState<CentreStatus[] | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const root = document.documentElement;
    const still = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";

    let palette = readPalette(canvas);
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let visible = true;
    let statuses = allCentreStatus(new Date());
    let lastStatus = 0;
    let lon0 = 0; // current view longitude
    let targetLon = 0;
    let px = 0; // pointer parallax
    let py = 0;
    const t0 = performance.now();

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };

    const refreshStatus = (now: Date) => {
      statuses = allCentreStatus(now);
      setSummary(statuses);
      const open = statuses.filter((s) => s.state === "open" || s.state === "lunch" || s.state === "pre");
      if (open.length) {
        // circular mean of open longitudes
        let sx = 0;
        let sy = 0;
        for (const s of open) {
          sx += Math.cos(s.centre.lon * DEG);
          sy += Math.sin(s.centre.lon * DEG);
        }
        targetLon = Math.atan2(sy, sx) / DEG;
      } else {
        // nobody open: face the sun (where the next session will come from)
        const utc = now.getUTCHours() + now.getUTCMinutes() / 60;
        targetLon = (12 - utc) * 15;
      }
    };

    const project = (v: Vec, cx: number, cy: number, R: number, tilt: number, lift = 1): [number, number, number] => {
      // rotate about Y by -lon0 (already applied by caller via lon offset), then tilt about X
      const y = v[1] * Math.cos(tilt) - v[2] * Math.sin(tilt);
      const z = v[1] * Math.sin(tilt) + v[2] * Math.cos(tilt);
      return [cx + R * lift * v[0], cy - R * lift * y, z];
    };

    const draw = (time: number) => {
      const now = new Date();
      if (time - lastStatus > 30_000 || lastStatus === 0) {
        refreshStatus(now);
        lastStatus = time || 1;
        if (lon0 === 0 && time < 100) lon0 = targetLon - 34;
      }
      const elapsed = (time - t0) / 1000;
      // ease toward the active region, plus a slow architectural drift
      const drift = still() ? 0 : Math.sin(elapsed / 21) * 13;
      let d = targetLon + drift - lon0;
      d = ((d + 540) % 360) - 180;
      lon0 += still() ? d : d * 0.012;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const size = Math.min(w, h);
      const cx = w / 2 + px * 5;
      const cy = h / 2 + py * 5;
      const R = (size / 2) * 0.618 * 1.19; // sphere radius: golden section of the frame, optically enlarged
      const dialR = R * 1.272; // √φ
      const tilt = (21 + py * 3) * DEG;
      const P = (lat: number, lon: number, lift = 1) => project(toVec(lat, lon - lon0), cx, cy, R, tilt, lift);

      // ── atmosphere: logo colours felt before they are seen
      const glow = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.38, R * 0.1, cx, cy, R * 1.05);
      glow.addColorStop(0, "rgba(8,112,184,0.10)");
      glow.addColorStop(0.618, "rgba(0,160,152,0.05)");
      glow.addColorStop(1, "rgba(8,144,64,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // ── graticule
      ctx.lineWidth = 1;
      const line = (pts: [number, number, number][]) => {
        for (let pass = 0; pass < 2; pass++) {
          ctx.beginPath();
          let pen = false;
          for (let i = 0; i < pts.length; i++) {
            const front = pts[i][2] >= 0;
            if ((pass === 0) === front) {
              pen = false;
              continue;
            }
            if (!pen) {
              ctx.moveTo(pts[i][0], pts[i][1]);
              pen = true;
            } else ctx.lineTo(pts[i][0], pts[i][1]);
          }
          ctx.strokeStyle = pass === 0 ? palette.faint : palette.stroke;
          ctx.globalAlpha = pass === 0 ? 0.55 : 0.62;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      };
      for (let lon = -180; lon < 180; lon += 30) {
        const pts: [number, number, number][] = [];
        for (let lat = -90; lat <= 90; lat += 5) pts.push(P(lat, lon));
        line(pts);
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        const pts: [number, number, number][] = [];
        for (let lon = -180; lon <= 180; lon += 5) pts.push(P(lat, lon));
        line(pts);
      }
      // limb
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = palette.stroke;
      ctx.stroke();

      // ── 24h UTC dial with FX session windows
      ctx.beginPath();
      ctx.arc(cx, cy, dialR, 0, Math.PI * 2);
      ctx.strokeStyle = palette.faint;
      ctx.stroke();
      const angle = (mins: number) => (mins / 1440) * Math.PI * 2 - Math.PI / 2; // 00:00 UTC at 12 o'clock
      for (let hr = 0; hr < 24; hr++) {
        const a = angle(hr * 60);
        const major = hr % 6 === 0;
        const r1 = dialR - (major ? 8 : 4);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * dialR, cy + Math.sin(a) * dialR);
        ctx.strokeStyle = major ? palette.stroke : palette.faint;
        ctx.stroke();
        if (major && size > 380) {
          ctx.fillStyle = palette.muted;
          ctx.font = `500 10px ${palette.font}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const rl = dialR + 13;
          ctx.fillText(String(hr).padStart(2, "0"), cx + Math.cos(a) * rl, cy + Math.sin(a) * rl);
        }
      }
      const sessionColours = [palette.teal, palette.blue, palette.blue, palette.emerald];
      fxSessions.forEach((s, i) => {
        const win = windowInUtc(s.tz, s.open, s.close, now);
        const a0 = angle(win.start);
        let a1 = angle(win.end);
        if (a1 <= a0) a1 += Math.PI * 2;
        const rr = dialR + 3 + (i % 2) * 4; // alternate lanes so overlaps read as overlaps
        ctx.beginPath();
        ctx.arc(cx, cy, rr, a0, a1);
        ctx.strokeStyle = sessionColours[i];
        ctx.globalAlpha = 0.78;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
      });
      // now marker
      const nowA = angle(now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(nowA) * (dialR - 13), cy + Math.sin(nowA) * (dialR - 13));
      ctx.lineTo(cx + Math.cos(nowA) * (dialR + 13), cy + Math.sin(nowA) * (dialR + 13));
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.lineWidth = 1;

      // ── liquidity pathways between centres that are open together
      const open = statuses.filter((s) => s.state === "open");
      for (let i = 0; i < open.length; i++) {
        for (let j = i + 1; j < open.length; j++) {
          const a = toVec(open[i].centre.lat, open[i].centre.lon - lon0);
          const b = toVec(open[j].centre.lat, open[j].centre.lon - lon0);
          const steps = 34;
          const grad = ctx.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, palette.teal);
          grad.addColorStop(0.5, palette.blue);
          grad.addColorStop(1, palette.emerald);
          ctx.beginPath();
          let pen = false;
          for (let k = 0; k <= steps; k++) {
            const t = k / steps;
            const p = project(slerp(a, b, t), cx, cy, R, tilt, 1 + 0.146 * Math.sin(Math.PI * t));
            if (p[2] < -0.05) {
              pen = false;
              continue;
            }
            if (!pen) {
              ctx.moveTo(p[0], p[1]);
              pen = true;
            } else ctx.lineTo(p[0], p[1]);
          }
          ctx.strokeStyle = grad;
          ctx.globalAlpha = 0.6;
          ctx.stroke();
          ctx.globalAlpha = 1;
          if (!still()) {
            // one slow pulse per pathway
            const t = (elapsed / 8 + (i * 0.37 + j * 0.21)) % 1;
            const p = project(slerp(a, b, t), cx, cy, R, tilt, 1 + 0.146 * Math.sin(Math.PI * t));
            if (p[2] > 0) {
              ctx.beginPath();
              ctx.arc(p[0], p[1], 1.6, 0, Math.PI * 2);
              ctx.fillStyle = palette.blue;
              ctx.fill();
            }
          }
        }
      }

      // ── centres
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      const order = [...statuses].sort((a, b) => Number(a.state === "open") - Number(b.state === "open"));
      for (const s of order) {
        const p = P(s.centre.lat, s.centre.lon);
        if (p[2] < 0.02) continue;
        const depth = 0.45 + 0.55 * p[2];
        const colour = s.state === "open" ? palette.emerald : s.state === "pre" || s.state === "lunch" ? palette.warn : palette.muted;
        ctx.globalAlpha = depth;
        if (s.state === "open") {
          const breathe = still() ? 1 : 0.5 + 0.5 * Math.sin(elapsed * (Math.PI / PHI) + s.centre.lon);
          ctx.beginPath();
          ctx.arc(p[0], p[1], 5 + breathe * 5, 0, Math.PI * 2);
          ctx.strokeStyle = colour;
          ctx.globalAlpha = depth * (0.35 - breathe * 0.25);
          ctx.stroke();
          ctx.globalAlpha = depth;
        }
        ctx.beginPath();
        ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
        if (s.state === "closed") {
          ctx.fillStyle = palette.bg;
          ctx.fill();
          ctx.strokeStyle = colour;
          ctx.stroke();
        } else {
          ctx.fillStyle = colour;
          ctx.fill();
        }
        // label
        if (p[2] > 0.18 && size > 320) {
          ctx.font = `600 11px ${palette.font}`;
          const name = s.centre.city;
          const tw = ctx.measureText(name).width;
          const right = p[0] >= cx;
          const lx = right ? p[0] + 9 : p[0] - 9 - tw;
          const ly = p[1] - 5;
          const box = { x: lx - 2, y: ly - 9, w: tw + 4, h: 26 };
          const clash = placed.some((b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y);
          if (!clash) {
            placed.push(box);
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = palette.ink;
            ctx.fillText(name, lx, ly);
            ctx.font = `500 10px ${palette.font}`;
            ctx.fillStyle = palette.muted;
            ctx.fillText(s.local.label, lx, ly + 12);
          }
        }
        ctx.globalAlpha = 1;
      }

      if (!still() && visible) raf = requestAnimationFrame(draw);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };

    const ro = new ResizeObserver(() => {
      resize();
      start();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    io.observe(canvas);
    const onVis = () => {
      visible = !document.hidden;
      if (visible) start();
    };
    const onPrefs = () => {
      // theme or accent changed: re-read tokens on the next frame
      requestAnimationFrame(() => {
        palette = readPalette(canvas);
        start();
      });
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || still()) return;
      const r = canvas.getBoundingClientRect();
      px = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / r.width));
      py = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / r.height));
    };
    // under reduced motion there is no loop, so refresh the still frame each minute
    const minute = window.setInterval(() => {
      if (still() && visible) start();
    }, 60_000);

    resize();
    start();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("gx:prefs", onPrefs);
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(minute);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("gx:prefs", onPrefs);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return (
    <figure className={className}>
      <canvas ref={canvasRef} className="aspect-square h-auto w-full" aria-hidden />
      <figcaption className="sr-only">
        A globe showing the world&apos;s financial centres and whether each is inside its regular trading hours right now.
        {summary && (
          <ul>
            {summary.map((s) => (
              <li key={s.centre.key}>
                {s.centre.city}: {s.state}, local time {s.local.label}
              </li>
            ))}
          </ul>
        )}
      </figcaption>
    </figure>
  );
}

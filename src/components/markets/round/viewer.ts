import type { Colour } from "@/components/figures/Figure";
import { P, aimView, drawParts, facing, makeView, project, projectFloor, ramp, typeFont, type RoundPalette } from "./engine";
import type { Anchor, Scene } from "./objects";

/**
 * Drives one "in the round" picture: the turn of the object (dragging with
 * inertia, the arrow keys, turning to a chosen pin, the slow turn it makes on
 * its own until someone takes over), the floor and its shadow, and the pins.
 *
 * It owns everything a page figure's host owns (sizing to the device pixel
 * ratio, colours read from the tokens, pausing off-screen and in hidden tabs,
 * a still picture under reduced motion) and paints only while something is
 * moving. Under reduced motion nothing eases and nothing coasts: every change
 * is applied at once and painted once, so dragging still works.
 */

export type ViewerHandle = {
  /** turn the object so that pin `i` faces the viewer */
  select(i: number): void;
  /** which pin is chosen (-1 for none) and which is under the pointer or has the focus */
  mark(active: number, hot: number): void;
  /** turn by this much: the arrow keys */
  nudge(dyaw: number, dpitch: number): void;
  /** back to the view it started from */
  reset(): void;
  dispose(): void;
};

const TAU = Math.PI * 2;
/** how far down on the object the camera may look, and how nearly level */
const PITCH_MIN = 0.12;
const PITCH_MAX = 1.05;
/** camera distance in world units: near enough for the perspective to be felt, far enough not to distort */
const DIST = 10;
/** radians a second, while nobody has touched it */
const IDLE = 0.2;
/** the height kept clear at the foot of the panel for the hint and the reset button */
const FOOT = 55;
const HEAD = 11;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
/** the same angle, within half a turn of zero */
const wrap = (a: number) => a - Math.round(a / TAU) * TAU;
const col = (c: Colour, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(c[3] * a, 0, 1)})`;

const RING_N = 72;
const RING_COS = new Float32Array(RING_N);
const RING_SIN = new Float32Array(RING_N);
for (let i = 0; i < RING_N; i++) {
  RING_COS[i] = Math.cos((i / RING_N) * TAU);
  RING_SIN[i] = Math.sin((i / RING_N) * TAU);
}

export function mountViewer(canvas: HTMLCanvasElement, heads: readonly (HTMLElement | null)[], scene: Scene, anchors: readonly Anchor[]): ViewerHandle | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const isStill = () => reduced.matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";

  /* colours, through the canvas's own parser, from the tokens as they resolve on the night panel */
  const parse = (value: string): Colour | null => {
    if (!value) return null;
    ctx.fillStyle = "rgba(1,2,3,0.004)";
    const before = ctx.fillStyle;
    ctx.fillStyle = value;
    const s = String(ctx.fillStyle);
    if (s === before) return null;
    if (s[0] === "#") return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
    const m = s.match(/-?[\d.]+(?:e-?\d+)?/g);
    if (!m || m.length < 3) return null;
    const k = s.startsWith("color(") ? 255 : 1;
    return [Math.round(Number(m[0]) * k), Math.round(Number(m[1]) * k), Math.round(Number(m[2]) * k), m.length > 3 ? Number(m[3]) : 1];
  };
  const readPalette = (): RoundPalette => {
    const cs = getComputedStyle(canvas);
    const text = parse(cs.color) ?? [230, 232, 234, 1];
    const v = (name: string, fallback: Colour) => parse(cs.getPropertyValue(name).trim()) ?? fallback;
    const ink = v("--ink", text);
    const ink3 = v("--ink-3", ink);
    const accent = v("--accent", ink);
    return {
      ink,
      ink2: v("--ink-2", ink),
      ink3,
      accent,
      teal: v("--teal", accent),
      emerald: v("--emerald", accent),
      gold: v("--prestige", ink),
      platinum: v("--platinum", ink3),
      surface: v("--surface", [18, 26, 33, 1]),
      bg: v("--bg", [12, 17, 22, 1]),
      line: v("--line", [ink[0], ink[1], ink[2], 0.13]),
      font: cs.fontFamily || "system-ui, sans-serif",
    };
  };

  // everything that depends on the palette is made once here, so painting builds no strings of its own
  let pal = readPalette();
  let ramps: string[][] = [];
  let lettering = "";
  let numFont = "";
  const C = { shadow: "", contact: "", floor: "", ring: "", tick: "", edge: "", leader: "", leaderFar: "", head: "", headOn: "", ink: "", inkOn: "", halo: "", glowA: "", glowB: "", none: "" };
  const restyle = () => {
    pal = readPalette();
    ramps = scene.mats.map((m) => ramp(m, pal));
    lettering = typeFont(pal.font);
    numFont = `600 11px ${pal.font}`;
    const deep: Colour = [pal.bg[0] * 0.25, pal.bg[1] * 0.25, pal.bg[2] * 0.25, 1];
    C.shadow = col(deep, 0.62);
    C.contact = col(deep, 0.5);
    C.floor = col(pal.surface, 0.55);
    C.ring = col(pal.ink3, 0.42);
    C.tick = col(pal.ink3, 0.7);
    C.edge = col(pal.ink, 1);
    C.leader = col(pal.ink, 0.85);
    C.leaderFar = col(pal.ink, 0.5);
    C.head = col(pal.surface, 0.94);
    C.headOn = col(pal.ink, 1);
    C.ink = col(pal.ink, 1);
    C.inkOn = col(pal.bg, 1);
    C.halo = col(pal.gold, 0.9);
    C.glowA = col(pal.accent, 0.13);
    C.glowB = col(pal.accent, 0);
    C.none = col(deep, 0);
  };
  restyle();

  const V = makeView();
  const order = new Uint8Array(scene.parts.length);
  const nPins = anchors.length;
  const LABEL = anchors.map((_, i) => String(i + 1));
  // each pin's unit direction, and where its head stands
  const DIR = new Float32Array(nPins * 3);
  const TIP = new Float32Array(nPins * 3);
  anchors.forEach((a, i) => {
    const l = Math.hypot(a.n[0], a.n[1], a.n[2]) || 1;
    for (let k = 0; k < 3; k++) {
      DIR[i * 3 + k] = a.n[k] / l;
      TIP[i * 3 + k] = a.p[k] + (a.n[k] / l) * a.len;
    }
  });
  // where each head was last put on the page, and whether it was on the near side
  const HX = new Float32Array(nPins).fill(-999);
  const HY = new Float32Array(nPins).fill(-999);
  const NEAR = new Int8Array(nPins).fill(-1);
  const FACE = new Float32Array(nPins);

  let w = 1;
  let h = 1;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  let disposed = false;
  let inView = false;

  let yaw = scene.yaw;
  let pitch = scene.pitch;
  let vyaw = 0;
  let vpitch = 0;
  let aiming = false;
  let tyaw = yaw;
  let tpitch = pitch;
  /** it turns on its own until the visitor takes over; a reset hands it back */
  let idle = true;
  let idleAfterAim = false;
  let dragging = false;
  let active = -1;
  let hot = -1;

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, r.width);
    h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  };

  /* ── the floor: a pool of light, the turntable ring and the object's shadow ── */
  const floor = () => {
    const y = scene.floor;
    // the ring is a circle on the floor; its ticks are fixed to the object, so they show the turn
    ctx.beginPath();
    for (let i = 0; i < RING_N; i++) {
      project(V, RING_COS[i] * scene.ring, y, RING_SIN[i] * scene.ring);
      if (i === 0) ctx.moveTo(P.x, P.y);
      else ctx.lineTo(P.x, P.y);
    }
    ctx.closePath();
    ctx.fillStyle = C.floor;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.ring;
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < RING_N; i += 3) {
      const long = i % 18 === 0;
      const r0 = scene.ring * (long ? 0.93 : 0.965);
      project(V, RING_COS[i] * r0, y, RING_SIN[i] * r0);
      ctx.moveTo(P.x, P.y);
      project(V, RING_COS[i] * scene.ring, y, RING_SIN[i] * scene.ring);
      ctx.lineTo(P.x, P.y);
    }
    ctx.strokeStyle = C.tick;
    ctx.stroke();

    // the shadow: the object's outline on the floor, pushed away from the key light and blurred.
    // The outline itself is drawn off the canvas; only its shadow lands on it.
    const fp = scene.footprint;
    const OFF = w + 4000;
    ctx.save();
    ctx.shadowOffsetX = OFF * dpr;
    ctx.shadowOffsetY = 0;
    for (let pass = 0; pass < 2; pass++) {
      const dx = pass === 0 ? 0.2 : 0.04;
      const dz = pass === 0 ? 0.12 : 0.02;
      ctx.shadowColor = pass === 0 ? C.shadow : C.contact;
      ctx.shadowBlur = (pass === 0 ? 0.2 : 0.045) * V.s * dpr;
      ctx.beginPath();
      for (let i = 0; i < fp.length; i += 2) {
        projectFloor(V, fp[i], y, fp[i + 1], dx, dz);
        if (i === 0) ctx.moveTo(P.x - OFF, P.y);
        else ctx.lineTo(P.x - OFF, P.y);
      }
      ctx.closePath();
      ctx.fillStyle = C.edge;
      ctx.fill();
    }
    ctx.restore();
  };

  /* ── a pin: a dot on the object, a leader, and a numbered head ── */
  const pin = (i: number, alpha: number, lit: boolean) => {
    const a = anchors[i];
    project(V, a.p[0], a.p[1], a.p[2]);
    const ax = P.x;
    const ay = P.y;
    project(V, TIP[i * 3], TIP[i * 3 + 1], TIP[i * 3 + 2]);
    const hx = P.x;
    const hy = P.y;
    const on = i === active;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lit ? 1.5 : 1;
    ctx.strokeStyle = lit ? C.leader : C.leaderFar;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ax, ay, lit ? 3 : 2.25, 0, TAU);
    ctx.fillStyle = C.ink;
    ctx.fill();
    if (lit) {
      // a second ring marks the pin that is chosen or pointed at, so it is not told by tone alone
      ctx.beginPath();
      ctx.arc(hx, hy, HEAD + 4, 0, TAU);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = C.halo;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(hx, hy, HEAD, 0, TAU);
    ctx.fillStyle = on ? C.headOn : C.head;
    ctx.fill();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.font = numFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = on ? C.inkOn : C.ink;
    ctx.fillText(LABEL[i], hx, hy + 0.5);
    ctx.globalAlpha = 1;
  };

  const paint = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (w < 48 || h < 48) return;
    const room = Math.max(40, h - FOOT);
    const s = Math.min((w * 0.5) / scene.rx, (room * 0.5) / scene.ry) * 0.9;
    const ox = w / 2;
    const oy = room / 2 + 5;
    aimView(V, ox, oy, s, DIST, yaw, pitch);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // the back light: a pool behind the object, above and to the right, where the rim light comes from
    const g = ctx.createRadialGradient(ox + s * 0.5, oy - s * 0.5, 0, ox + s * 0.5, oy - s * 0.5, s * 2.4);
    g.addColorStop(0, C.glowA);
    g.addColorStop(1, C.glowB);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    floor();

    for (let i = 0; i < nPins; i++) FACE[i] = facing(V, DIR[i * 3], DIR[i * 3 + 1], DIR[i * 3 + 2]);
    // pins on the far side first, faded, so the object stands in front of them
    for (let i = 0; i < nPins; i++) if (FACE[i] <= 0 && i !== active && i !== hot) pin(i, 0.2 + 0.3 * clamp(1 + FACE[i] * 2.5, 0, 1), false);
    drawParts(ctx, V, scene.parts, order, scene.mats, ramps, C.edge, lettering);
    for (let i = 0; i < nPins; i++) if (FACE[i] > 0 && i !== active && i !== hot) pin(i, 0.5 + 0.5 * clamp(FACE[i] * 4, 0, 1), false);
    if (hot >= 0 && hot !== active) pin(hot, 1, true);
    if (active >= 0) pin(active, 1, true);

    // the buttons that stand over the heads follow them (written only when a head has moved)
    for (let i = 0; i < nPins; i++) {
      const el = heads[i];
      if (!el) continue;
      project(V, TIP[i * 3], TIP[i * 3 + 1], TIP[i * 3 + 2]);
      if (Math.abs(P.x - HX[i]) > 0.5 || Math.abs(P.y - HY[i]) > 0.5) {
        HX[i] = P.x;
        HY[i] = P.y;
        el.style.transform = `translate(${P.x.toFixed(1)}px,${P.y.toFixed(1)}px)`;
      }
      const near = FACE[i] > 0 ? 1 : 0;
      if (near !== NEAR[i]) {
        NEAR[i] = near;
        el.dataset.near = near ? "true" : "false";
      }
    }
  };

  const tick = (now: number) => {
    raf = 0;
    if (disposed) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    let moving = false;
    if (isStill()) {
      // no easing and no coasting: whatever was asked for is simply so
      if (aiming) {
        yaw = tyaw;
        pitch = tpitch;
        aiming = false;
      }
      vyaw = 0;
      vpitch = 0;
    } else if (dragging) {
      moving = true;
    } else if (aiming) {
      const k = 1 - Math.exp(-dt * 5.5);
      yaw += (tyaw - yaw) * k;
      pitch += (tpitch - pitch) * k;
      if (Math.abs(tyaw - yaw) < 0.002 && Math.abs(tpitch - pitch) < 0.002) {
        yaw = tyaw;
        pitch = tpitch;
        aiming = false;
        if (idleAfterAim) idle = true;
        idleAfterAim = false;
      }
      moving = true;
    } else if (Math.abs(vyaw) > 0.03 || Math.abs(vpitch) > 0.03) {
      // released while moving: it coasts and slows
      yaw += vyaw * dt;
      pitch = clamp(pitch + vpitch * dt, PITCH_MIN, PITCH_MAX);
      const drag = Math.exp(-dt * 3.2);
      vyaw *= drag;
      vpitch *= drag;
      moving = true;
    } else if (idle) {
      yaw += IDLE * dt;
      moving = true;
    }
    paint();
    if (moving && inView && !document.hidden) raf = requestAnimationFrame(tick);
    else last = 0;
  };
  const kick = () => {
    if (disposed || raf) return;
    raf = requestAnimationFrame(tick);
  };

  const takeOver = () => {
    idle = false;
    idleAfterAim = false;
  };
  const aimAt = (y: number, p: number) => {
    tyaw = yaw + wrap(y - yaw);
    tpitch = clamp(p, PITCH_MIN, PITCH_MAX);
    aiming = true;
    vyaw = 0;
    vpitch = 0;
    kick();
  };

  /* ── the pointer: drag to turn. A finger turns it sideways only; up and down stays the page's scroll. ── */
  let px = 0;
  let py = 0;
  let pt = 0;
  let pid = -1;
  /** pressed on a pin's button: it becomes a drag only once the pointer has travelled, so a press there is still a press */
  let pending = false;
  let sx = 0;
  const host: HTMLElement = canvas.parentElement ?? canvas;
  const begin = (e: PointerEvent) => {
    pending = false;
    dragging = true;
    vyaw = 0;
    vpitch = 0;
    aiming = false;
    takeOver();
    canvas.dataset.dragging = "true";
    try {
      // from here the pointer belongs to the picture: a drag that began on a pin does not end as a press of it
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // the pointer may already be gone: the drag then ends with the next up or cancel
    }
    kick();
  };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const on = e.target instanceof Element ? e.target : null;
    const onPin = on?.closest("[data-pin]");
    if (on !== canvas && !onPin) return;
    pid = e.pointerId;
    px = sx = e.clientX;
    py = e.clientY;
    pt = e.timeStamp;
    if (onPin) pending = true;
    else begin(e);
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pid) return;
    if (pending && Math.abs(e.clientX - sx) > 5) begin(e);
    if (!dragging) return;
    const dx = e.clientX - px;
    const dy = e.pointerType === "touch" ? 0 : e.clientY - py;
    const dt = Math.max(0.004, (e.timeStamp - pt) / 1000);
    px = e.clientX;
    py = e.clientY;
    pt = e.timeStamp;
    const dyaw = -dx * 0.0105;
    const before = pitch;
    yaw += dyaw;
    pitch = clamp(pitch + dy * 0.008, PITCH_MIN, PITCH_MAX);
    vyaw += (dyaw / dt - vyaw) * 0.5;
    vpitch += ((pitch - before) / dt - vpitch) * 0.5;
    kick();
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pid) return;
    pending = false;
    pid = -1;
    if (!dragging) return;
    dragging = false;
    delete canvas.dataset.dragging;
    // held still before letting go: it stays where it was put
    if (e.timeStamp - pt > 90) {
      vyaw = 0;
      vpitch = 0;
    }
    vyaw = clamp(vyaw, -9, 9);
    vpitch = clamp(vpitch, -4, 4);
    kick();
  };

  const ro = new ResizeObserver(() => {
    resize();
    kick();
  });
  ro.observe(canvas);
  const io = new IntersectionObserver(([entry]) => {
    inView = entry?.isIntersecting ?? false;
    if (inView) kick();
  });
  io.observe(canvas);
  const onVis = () => {
    if (!document.hidden) kick();
  };
  const onPrefs = () => {
    // theme, accent or motion changed: read the tokens again on the next frame
    requestAnimationFrame(() => {
      if (disposed) return;
      restyle();
      kick();
    });
  };

  resize();
  kick();
  void document.fonts?.ready.then(kick);
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("gx:prefs", onPrefs);
  reduced.addEventListener("change", onPrefs);
  // on the panel, not the canvas: a press that begins on a pin's button is heard too
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointercancel", onUp);

  return {
    select(i) {
      const a = anchors[i];
      if (!a) return;
      takeOver();
      const dx = DIR[i * 3];
      const dy = DIR[i * 3 + 1];
      const dz = DIR[i * 3 + 2];
      const flat = Math.hypot(dx, dz);
      if (dy > 0.8 && flat < 0.45) {
        // a pin that stands up from the top: look down on it, and bring the point it is fixed to round to the front
        const far = Math.hypot(a.p[0], a.p[2]) > 0.2;
        aimAt(far ? Math.atan2(a.p[0], -a.p[2]) + 0.35 : yaw, 0.74);
      } else {
        // face the pin, a little to one side so that its leader is seen along its length
        aimAt(Math.atan2(dx, -dz) + 0.5, scene.pitch + (dy > 0.3 ? 0.12 : 0));
      }
    },
    mark(a, hv) {
      if (a === active && hv === hot) return;
      active = a;
      hot = hv;
      kick();
    },
    nudge(dyaw, dpitch) {
      takeOver();
      aimAt((aiming ? tyaw : yaw) + dyaw, (aiming ? tpitch : pitch) + dpitch);
    },
    reset() {
      aimAt(scene.yaw, scene.pitch);
      // the slow turn starts again once it is back (never under reduced motion: the loop does not run there)
      idle = false;
      idleAfterAim = true;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("gx:prefs", onPrefs);
      reduced.removeEventListener("change", onPrefs);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
    },
  };
}

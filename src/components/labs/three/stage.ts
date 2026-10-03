import { Color, Group, type Material, type Object3D, PerspectiveCamera, SRGBColorSpace, Scene, Vector3, WebGLRenderer } from "three";

/**
 * The stage both 3D instruments in Labs stand on (the session globe and the
 * order-book model). This file imports Three.js, so it is only ever reached
 * through a dynamic import from those two pages.
 *
 * What it owns
 *  - the renderer, on a canvas it creates itself (a canvas whose WebGL context
 *    has been handed back cannot be reused, so React must not own it);
 *  - turning the model: drag with a pointer, arrow keys on the focused host,
 *    Home to return. The page still scrolls vertically under a finger
 *    (`touch-action: pan-y`), so the canvas never traps a phone;
 *  - drawing only when something changed. There is no free-running loop: a
 *    frame is drawn after a turn, a resize, a call to `request()`, or while
 *    the optional idle turn runs. Nothing is drawn while the tab is hidden or
 *    the canvas is off-screen;
 *  - pixel ratio capped at 2;
 *  - giving everything back: geometries, materials, the renderer and the
 *    WebGL context itself.
 *
 * Under reduced motion or "low visual effects" (`calm()`), the idle turn is
 * off and a requested turn is a cut, not a glide. Dragging still works: that
 * is the visitor's own motion.
 */

export type StageOptions = {
  /** vertical field of view, degrees */
  fov: number;
  /** camera distance from the model's centre */
  distance: number;
  /** starting turn (radians): yaw about the vertical axis, pitch toward the viewer */
  yaw: number;
  pitch: number;
  minPitch: number;
  maxPitch: number;
  /** idle turn in radians per second, until the visitor first touches the model (0 for none) */
  idle?: number;
  /** true when motion should not run by itself */
  calm: () => boolean;
  /** called after each drawn frame, for labels that follow the model */
  after?: () => void;
};

export type Stage = {
  scene: Scene;
  camera: PerspectiveCamera;
  /** add the model here: it carries the turn */
  model: Group;
  canvas: HTMLCanvasElement;
  /** draw a frame soon */
  request: () => void;
  /** turn to face a yaw and pitch */
  face: (yaw: number, pitch: number) => void;
  /** a point in the model's own space, as CSS pixels inside the host; `front` is false when it is behind the camera plane */
  place: (local: Vector3, out: { x: number; y: number; front: boolean; depth: number }) => void;
  /** call when the site's motion preference changed */
  prefs: () => void;
  dispose: () => void;
};

const KEY_STEP = Math.PI / 24; // 7.5 degrees

export function createStage(host: HTMLElement, opts: StageOptions): Stage | null {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "gx3d-canvas";
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return null; // no WebGL here: the still stands
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(opts.fov, 1, 0.1, 100);
  camera.position.set(0, 0, opts.distance);
  // pitch on the outer group, yaw on the inner: the vertical axis stays vertical on screen
  const tilt = new Group();
  const model = new Group();
  tilt.add(model);
  scene.add(tilt);

  let yaw = opts.yaw;
  let pitch = opts.pitch;
  let toYaw = yaw;
  let toPitch = pitch;
  let vyaw = 0; // what is left of a drag, radians per frame
  let touched = false;
  let raf = 0;
  let dirty = true;
  let onScreen = true;
  let dead = false;
  let last = 0;
  let w = 0;
  let h = 0;

  const clampPitch = (v: number) => Math.max(opts.minPitch, Math.min(opts.maxPitch, v));

  const size = () => {
    const nw = Math.max(1, host.clientWidth);
    const nh = Math.max(1, host.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (nw === w && nh === h && renderer.getPixelRatio() === dpr) return;
    w = nw;
    h = nh;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // a narrow stage steps back so the model still fits its width
    camera.position.z = opts.distance * (camera.aspect < 1 ? Math.min(1.9, 1 / camera.aspect) : 1);
    camera.updateProjectionMatrix();
    dirty = true;
  };

  const moving = () => Math.abs(toYaw - yaw) > 0.0004 || Math.abs(toPitch - pitch) > 0.0004 || Math.abs(vyaw) > 0.00004;
  const idling = () => !!opts.idle && !touched && !opts.calm();

  const frame = (now: number) => {
    raf = 0;
    if (dead) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;

    if (opts.calm()) {
      yaw = toYaw;
      pitch = toPitch;
      vyaw = 0;
    } else {
      if (idling()) {
        toYaw += (opts.idle ?? 0) * dt;
      }
      if (Math.abs(vyaw) > 0.00004) {
        toYaw += vyaw;
        vyaw *= 0.92;
      } else vyaw = 0;
      yaw += (toYaw - yaw) * 0.18;
      pitch += (toPitch - pitch) * 0.18;
      if (!moving()) {
        yaw = toYaw;
        pitch = toPitch;
      }
    }
    tilt.rotation.x = pitch;
    model.rotation.y = yaw;
    renderer.render(scene, camera);
    opts.after?.();
    dirty = false;
    if (moving() || idling()) kick();
    else last = 0;
  };

  const kick = () => {
    if (!raf && !dead && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const request = () => {
    dirty = true;
    kick();
  };

  /* ── turning ──────────────────────────────────────────────────────────── */
  let drag: { id: number; x: number; y: number } | null = null;
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    touched = true;
    vyaw = 0;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer that is already gone */
    }
    host.dataset.dragging = "";
  };
  const move = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const k = (Math.PI * 1.1) / Math.max(240, w);
    const dx = (e.clientX - drag.x) * k;
    const dy = (e.clientY - drag.y) * k;
    drag.x = e.clientX;
    drag.y = e.clientY;
    toYaw += dx;
    // under a finger the vertical movement belongs to the page
    if (e.pointerType !== "touch") toPitch = clampPitch(toPitch + dy);
    yaw = toYaw;
    pitch = toPitch;
    vyaw = opts.calm() ? 0 : dx * 0.6;
    request();
  };
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    delete host.dataset.dragging;
    request();
  };
  const key = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    let used = true;
    if (e.key === "ArrowLeft") toYaw += KEY_STEP;
    else if (e.key === "ArrowRight") toYaw -= KEY_STEP;
    else if (e.key === "ArrowUp") toPitch = clampPitch(toPitch + KEY_STEP);
    else if (e.key === "ArrowDown") toPitch = clampPitch(toPitch - KEY_STEP);
    else if (e.key === "Home") {
      toYaw = opts.yaw;
      toPitch = opts.pitch;
      // the short way round
      yaw -= Math.round((yaw - toYaw) / (Math.PI * 2)) * Math.PI * 2;
    } else used = false;
    if (!used) return;
    e.preventDefault();
    touched = true;
    vyaw = 0;
    request();
  };

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  host.addEventListener("keydown", key);

  /* ── running only when it can be seen ─────────────────────────────────── */
  const ro = new ResizeObserver(() => {
    size();
    kick();
  });
  ro.observe(host);
  const io = new IntersectionObserver(([entry]) => {
    onScreen = entry?.isIntersecting ?? false;
    if (!onScreen) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    } else if (dirty || moving() || idling()) kick();
  });
  io.observe(host);
  const vis = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    } else if (dirty || moving() || idling()) kick();
  };
  document.addEventListener("visibilitychange", vis);
  // a lost context (the browser took it back) leaves a blank canvas: let the still show again
  const lost = (e: Event) => {
    e.preventDefault();
    delete host.dataset.live;
  };
  canvas.addEventListener("webglcontextlost", lost);

  size();
  kick();

  const v = new Vector3();
  return {
    scene,
    camera,
    model,
    canvas,
    request,
    face(y, p) {
      touched = true;
      vyaw = 0;
      toPitch = clampPitch(p);
      // the short way round
      toYaw = y + Math.round((yaw - y) / (Math.PI * 2)) * Math.PI * 2;
      request();
    },
    place(local, out) {
      v.copy(local);
      model.localToWorld(v);
      out.depth = v.z;
      v.project(camera);
      out.front = v.z < 1;
      out.x = (v.x * 0.5 + 0.5) * w;
      out.y = (-v.y * 0.5 + 0.5) * h;
    },
    prefs: request,
    dispose() {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("webglcontextlost", lost);
      host.removeEventListener("keydown", key);
      delete host.dataset.dragging;
      disposeTree(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

/** Give back every geometry and material under a node. */
export function disposeTree(node: Object3D): void {
  const seen = new Set<{ dispose: () => void }>();
  node.traverse((o) => {
    const held = o as Object3D & { geometry?: { dispose: () => void }; material?: Material | Material[] };
    if (held.geometry) seen.add(held.geometry);
    const m = held.material;
    if (Array.isArray(m)) m.forEach((x) => seen.add(x));
    else if (m) seen.add(m);
  });
  seen.forEach((x) => x.dispose());
}

/* ── colours from the design tokens ─────────────────────────────────────── */

let probe: CanvasRenderingContext2D | null | undefined;
/** Any CSS colour as sRGB bytes. The browser does the parsing, so every notation a token may use is understood. */
function bytes(css: string): [number, number, number] | null {
  if (probe === undefined) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    probe = c.getContext("2d", { willReadFrequently: true });
  }
  if (!probe || !css) return null;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  // a translucent token (a hairline) is read over nothing; un-multiply it
  if (d[3] === 0) return null;
  return [d[0], d[1], d[2]];
}

/** Read named tokens, as they resolve on `el`, into Three.js colours. */
export function tokens<K extends string>(el: HTMLElement, names: Record<K, string>, fallback: Record<K, string>): Record<K, Color> {
  const cs = getComputedStyle(el);
  const out = {} as Record<K, Color>;
  for (const k of Object.keys(names) as K[]) {
    const rgb = bytes(cs.getPropertyValue(names[k]).trim()) ?? bytes(fallback[k]) ?? [128, 128, 128];
    out[k] = new Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, SRGBColorSpace);
  }
  return out;
}

/** Relative luminance of a colour held in the linear working space: is the ground dark? */
export const isDark = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.18;

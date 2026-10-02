import { clamp, lerp, rgba, smooth, TAU, type Colour, type Palette } from "@/components/figures/Figure";
import { aim, glow, hash, makeCam, project } from "@/components/figures/stage/kit";
import { STAGES, type Branches } from "./stages";

/**
 * Trade Anatomy: the scene.
 *
 * Seven stations stand in a row in space, one for each stage of an order's
 * life, joined by a track on the floor. The camera stands at one station at a
 * time and flies to the next when the stage changes; the order itself (the
 * champagne diamond) flies ahead of it, then acts out that stage: it is
 * written on the ticket, passes or fails the two gates, is sent to the
 * broker's own book or out to the providers, meets the price on the ladder,
 * stands open while the day turns round it, leaves through one of four doors
 * and comes to rest on the balance. Changing a branch replays the station
 * with the other path.
 *
 * Everything is perspective-projected by hand onto a Canvas 2D context (the
 * small camera in figures/stage/kit). Nothing here is data: there is no price,
 * no number and no symbol, only the words the text panel beside it also uses.
 *
 * Pointer: turns the view a little about the station in focus.
 * Still frame (reduced motion): each stage is drawn settled, at its end state.
 */

export type ScenePalette = Palette & { pos: Colour; neg: Colour };
/** One frame, as the canvas host hands it over (the same shape the shared figure host uses). */
export type SceneFrame = {
  ctx: CanvasRenderingContext2D;
  /** drawing size in CSS pixels */
  w: number;
  h: number;
  /** seconds on the scene's clock; frozen in a still frame */
  t: number;
  /** seconds since the last frame (0 in a still frame) */
  dt: number;
  /** 0 to 1, eased: how much the pointer is over the scene */
  hover: number;
  mx: number;
  my: number;
  pal: ScenePalette;
  /** true for the one settled frame drawn under reduced motion */
  still: boolean;
};
export type SceneTarget = { stage: number; branches: Branches; seq: number };
export type SceneDraw = (f: SceneFrame, target: SceneTarget) => void;

type Ctx = CanvasRenderingContext2D;

/** distance between stations, and how each stands off the centre line */
const SP = 5.2;
const ZIG = [0, 0.8, -0.6, 0.7, -0.8, 0.5, 0];
/** the side the camera looks from at each station, so every flight also turns */
const YAW = [0.36, -0.3, 0.34, -0.38, 0.3, -0.36, 0.32];
const N = STAGES.length;
const FLOOR = -1;
const CAM_Y = 0.3;
const DIST = 7;
const NEAR = 1.2;
/** where the order enters a station, in the station's own coordinates */
const ENTRY_X = -1.7;
const FLY_S = 1.25;
const SETTLED = 99;

const cam = makeCam();
const A = [0, 0, 0, 0];
const B = [0, 0, 0, 0];

/* the frame being drawn: set once at the top of a draw, read by every helper */
let c!: Ctx;
let pal!: ScenePalette;
let font = "sans-serif";
/** the origin of what is being drawn, relative to the camera's target */
let ox = 0;
let oy = 0;
let oz = 0;
/** the station being drawn: its place in the world, its alpha, its clocks */
let wx = 0;
let wz = 0;
let GA = 1;
let LT = 0;
let T = 0;
/** true while the station being drawn is the one the order is at */
let LIVE = false;
/** where the order was last drawn, in world coordinates */
const tok = [ENTRY_X, 0, 0];

const ph = (a: number, b: number) => smooth((LT - a) / (b - a));
const fract = (v: number) => v - Math.floor(v);
const alpha = (a: number) => {
  c.globalAlpha = clamp(GA * a);
};

/** Project a point of the current station. False when it is too near the camera to draw. */
function at(x: number, y: number, z: number, out: number[]): boolean {
  project(cam, x + ox, y + oy, z + oz, out);
  return cam.dist + out[3] > NEAR;
}

function seg(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  if (!at(x0, y0, z0, A) || !at(x1, y1, z1, B)) return;
  c.beginPath();
  c.moveTo(A[0], A[1]);
  c.lineTo(B[0], B[1]);
  c.stroke();
}

/** The path of a rectangle that faces the viewer (x across, y up) at depth z. */
function rxy(x0: number, y0: number, x1: number, y1: number, z: number): boolean {
  c.beginPath();
  if (!at(x0, y0, z, A)) return false;
  c.moveTo(A[0], A[1]);
  if (!at(x1, y0, z, A)) return false;
  c.lineTo(A[0], A[1]);
  if (!at(x1, y1, z, A)) return false;
  c.lineTo(A[0], A[1]);
  if (!at(x0, y1, z, A)) return false;
  c.lineTo(A[0], A[1]);
  c.closePath();
  return true;
}

/** The path of a rectangle standing across the line of travel (z across, y up) at x. */
function ryz(x: number, y0: number, y1: number, z0: number, z1: number): boolean {
  c.beginPath();
  if (!at(x, y0, z0, A)) return false;
  c.moveTo(A[0], A[1]);
  if (!at(x, y0, z1, A)) return false;
  c.lineTo(A[0], A[1]);
  if (!at(x, y1, z1, A)) return false;
  c.lineTo(A[0], A[1]);
  if (!at(x, y1, z0, A)) return false;
  c.lineTo(A[0], A[1]);
  c.closePath();
  return true;
}

/** The path of a rectangle lying flat at height y. */
function rxz(x0: number, x1: number, y: number, z0: number, z1: number): boolean {
  c.beginPath();
  if (!at(x0, y, z0, A)) return false;
  c.moveTo(A[0], A[1]);
  if (!at(x1, y, z0, A)) return false;
  c.lineTo(A[0], A[1]);
  if (!at(x1, y, z1, A)) return false;
  c.lineTo(A[0], A[1]);
  if (!at(x0, y, z1, A)) return false;
  c.lineTo(A[0], A[1]);
  c.closePath();
  return true;
}

/** The path of a circle: flat on the floor plane, or facing the viewer. */
function ring(x: number, y: number, z: number, r: number, flat: boolean): boolean {
  c.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * TAU;
    const ok = flat ? at(x + Math.cos(a) * r, y, z + Math.sin(a) * r, A) : at(x + Math.cos(a) * r, y + Math.sin(a) * r, z, A);
    if (!ok) return false;
    if (i === 0) c.moveTo(A[0], A[1]);
    else c.lineTo(A[0], A[1]);
  }
  return true;
}

/** A box drawn as its edges, with its front face filled so what is behind it does not show through. */
function block(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, stroke: string, fill: string) {
  c.strokeStyle = stroke;
  if (rxy(x0, y0, x1, y1, z1)) c.stroke();
  seg(x0, y0, z0, x0, y0, z1);
  seg(x1, y0, z0, x1, y0, z1);
  seg(x0, y1, z0, x0, y1, z1);
  seg(x1, y1, z0, x1, y1, z1);
  c.fillStyle = fill;
  if (rxz(x0, x1, y1, z0, z1)) {
    c.fill();
    c.stroke();
  }
  if (rxy(x0, y0, x1, y1, z0)) {
    c.fill();
    c.stroke();
  }
}

/**
 * A word in small capitals at a point in space, always facing the viewer.
 * `size` is its height in world units; a minor label is left out when the
 * scene is too small for it to be read.
 */
function label(text: string, x: number, y: number, z: number, size: number, colour: string, align: CanvasTextAlign = "center", minor = false) {
  if (!at(x, y, z, A)) return;
  const raw = size * A[2];
  if (minor && raw < 8) return;
  const px = clamp(raw, 9, 15);
  c.font = `600 ${px.toFixed(1)}px ${font}`;
  c.textAlign = align;
  c.textBaseline = "middle";
  c.fillStyle = colour;
  if ("letterSpacing" in c) (c as Ctx & { letterSpacing: string }).letterSpacing = "0.8px";
  c.fillText(text.toUpperCase(), A[0], A[1]);
  if ("letterSpacing" in c) (c as Ctx & { letterSpacing: string }).letterSpacing = "0px";
}

function lampAt(x: number, y: number, z: number, r: number, colour: Colour, a: number) {
  if (a <= 0.01 || !at(x, y, z, A)) return;
  glow(c, A[0], A[1], r * 5, colour, 0.5 * a);
  c.beginPath();
  c.arc(A[0], A[1], r, 0, TAU);
  c.fillStyle = rgba(colour, a);
  c.fill();
}

/** A sign that does not depend on colour: a tick, a cross, a plus or a minus, in a small disc. */
function sign(kind: "tick" | "cross" | "plus" | "minus", x: number, y: number, z: number, colour: Colour, a: number) {
  if (a <= 0.01 || !at(x, y, z, A)) return;
  const r = clamp(A[2] * 0.085, 5.5, 11);
  const px = A[0];
  const py = A[1];
  glow(c, px, py, r * 3.2, colour, 0.35 * a);
  c.beginPath();
  c.arc(px, py, r, 0, TAU);
  c.fillStyle = rgba(pal.surface, 0.95 * a);
  c.fill();
  c.strokeStyle = rgba(colour, a);
  c.lineWidth = 1.5;
  c.stroke();
  const k = r * 0.48;
  c.beginPath();
  if (kind === "tick") {
    c.moveTo(px - k, py);
    c.lineTo(px - k * 0.25, py + k * 0.75);
    c.lineTo(px + k, py - k * 0.7);
  } else if (kind === "cross") {
    c.moveTo(px - k * 0.8, py - k * 0.8);
    c.lineTo(px + k * 0.8, py + k * 0.8);
    c.moveTo(px + k * 0.8, py - k * 0.8);
    c.lineTo(px - k * 0.8, py + k * 0.8);
  } else {
    c.moveTo(px - k, py);
    c.lineTo(px + k, py);
    if (kind === "plus") {
      c.moveTo(px, py - k);
      c.lineTo(px, py + k);
    }
  }
  c.stroke();
  c.lineWidth = 1;
}

/** The order: a champagne diamond carrying its own light. */
function order(x: number, y: number, z: number, a = 1) {
  if (LIVE) {
    tok[0] = x + wx;
    tok[1] = y;
    tok[2] = z + wz;
  } else return;
  drawOrder(x, y, z, a);
}

function drawOrder(x: number, y: number, z: number, a: number) {
  if (a <= 0.01 || !at(x, y, z, A)) return;
  const r = clamp(A[2] * 0.075, 4, 11) * (1 + 0.08 * Math.sin(T * 3.1));
  const px = A[0];
  const py = A[1];
  const keep = c.globalAlpha;
  c.globalAlpha = 1;
  glow(c, px, py, r * 5.5, pal.gold, 0.55 * a);
  c.beginPath();
  c.moveTo(px, py - r * 1.25);
  c.lineTo(px + r, py);
  c.lineTo(px, py + r * 1.25);
  c.lineTo(px - r, py);
  c.closePath();
  c.fillStyle = rgba(pal.gold, a);
  c.fill();
  c.strokeStyle = rgba(pal.surface, 0.9 * a);
  c.lineWidth = 1;
  c.stroke();
  c.beginPath();
  c.moveTo(px - r, py);
  c.lineTo(px + r, py);
  c.strokeStyle = rgba(pal.surface, 0.55 * a);
  c.stroke();
  c.globalAlpha = keep;
}

/** A small chip with a word in it, on the face of something. */
function chip(x0: number, x1: number, yc: number, z: number, text: string, lit: boolean, tone: Colour) {
  c.fillStyle = rgba(tone, lit ? 0.24 : 0);
  c.strokeStyle = lit ? rgba(tone, 0.95) : rgba(pal.ink3, 0.55);
  c.lineWidth = lit ? 1.5 : 1;
  if (rxy(x0, yc - 0.1, x1, yc + 0.1, z)) {
    c.fill();
    c.stroke();
  }
  c.lineWidth = 1;
  label(text, (x0 + x1) / 2, yc, z, 0.085, lit ? rgba(pal.ink, 1) : rgba(pal.ink3, 0.9));
}

/* ── 1. the ticket ─────────────────────────────────────────────────────── */

function ticket(b: Branches) {
  const x0 = -1.42;
  const x1 = 0.2;
  const y0 = -0.9;
  const y1 = 1.2;
  // the slab: a back face and four short edges give it thickness
  c.lineWidth = 1;
  c.strokeStyle = rgba(pal.ink3, 0.5);
  if (rxy(x0, y0, x1, y1, 0.14)) c.stroke();
  seg(x0, y0, 0, x0, y0, 0.14);
  seg(x1, y0, 0, x1, y0, 0.14);
  seg(x0, y1, 0, x0, y1, 0.14);
  seg(x1, y1, 0, x1, y1, 0.14);
  c.fillStyle = rgba(pal.surface, 0.94);
  c.strokeStyle = rgba(pal.ink2, 0.85);
  if (rxy(x0, y0, x1, y1, 0)) {
    c.fill();
    c.stroke();
  }

  const rows = ["Instrument", "Direction", "Size", "Order type"];
  for (let k = 0; k < rows.length; k++) {
    const a = ph(0.1 + 0.2 * k, 0.5 + 0.2 * k);
    if (a <= 0.01) continue;
    alpha(a);
    const yl = 1.0 - 0.5 * k;
    const yv = yl - 0.22;
    label(rows[k], x0 + 0.14, yl, 0, 0.075, rgba(pal.ink3, 0.95), "left", true);
    if (k === 0) {
      // any instrument: a blank field, no symbol
      c.strokeStyle = rgba(pal.ink3, 0.55);
      if (rxy(x0 + 0.14, yv - 0.1, x1 - 0.14, yv + 0.1, 0)) c.stroke();
      c.strokeStyle = rgba(pal.ink2, 0.8);
      seg(x0 + 0.24, yv, 0, x0 + 0.62, yv, 0);
    } else if (k === 1) {
      chip(x0 + 0.14, x0 + 0.77, yv, 0, "Buy", true, pal.accent);
      chip(x0 + 0.85, x1 - 0.14, yv, 0, "Sell", false, pal.accent);
    } else if (k === 2) {
      c.strokeStyle = rgba(pal.ink3, 0.6);
      seg(x0 + 0.14, yv, 0, x1 - 0.5, yv, 0);
      for (let i = 0; i <= 4; i++) seg(x0 + 0.14 + i * 0.215, yv - 0.04, 0, x0 + 0.14 + i * 0.215, yv + 0.04, 0);
      lampAt(x0 + 0.14 + 0.215, yv, 0, 2.6, pal.accent, 1);
      label("Lots", x1 - 0.14, yv, 0, 0.075, rgba(pal.ink2, 0.95), "right", true);
    } else {
      chip(x0 + 0.14, x0 + 0.77, yv, 0, "Market", b.type === "market", pal.gold);
      chip(x0 + 0.85, x1 - 0.14, yv, 0, "Limit", b.type === "limit", pal.gold);
    }
  }
  alpha(1);

  // beside it, where the order is aimed: the price now, or a level it will wait at
  const sx = 1.15;
  const yp = 0.55 + 0.05 * Math.sin(T * 0.8);
  const ylim = -0.2;
  c.strokeStyle = rgba(pal.ink3, 0.6);
  seg(sx, -0.75, 0, sx, 1.05, 0);
  for (let i = 0; i <= 10; i++) seg(sx - 0.08, -0.75 + i * 0.18, 0, sx + 0.08, -0.75 + i * 0.18, 0);
  c.strokeStyle = rgba(pal.accent, 0.95);
  c.lineWidth = 2;
  seg(sx - 0.2, yp, 0, sx + 0.2, yp, 0);
  c.lineWidth = 1;
  label("Price", sx + 0.28, yp, 0, 0.08, rgba(pal.ink, 0.95), "left");
  const aim_ = ph(0.9, 1.5);
  const ty = b.type === "market" ? yp : ylim;
  if (b.type === "limit") {
    alpha(aim_);
    c.setLineDash([5, 4]);
    c.strokeStyle = rgba(pal.gold, 0.95);
    seg(sx - 0.3, ylim, 0, sx + 0.3, ylim, 0);
    c.setLineDash([]);
    label("Limit", sx + 0.38, ylim, 0, 0.08, rgba(pal.gold, 1), "left");
    alpha(1);
  }
  // the intention: a dashed line from the ticket to what it asks for
  alpha(aim_ * 0.9);
  c.setLineDash([2, 5]);
  c.strokeStyle = rgba(pal.gold, 0.85);
  seg(x1 + 0.22, -0.72, 0, sx - 0.32, ty, 0);
  c.setLineDash([]);
  alpha(1);
  label(b.type === "market" ? "Now" : "Wait", lerp(x1 + 0.22, sx - 0.32, 0.5), lerp(-0.72, ty, 0.5) + 0.14, 0, 0.075, rgba(pal.gold, 0.95 * aim_), "center", true);

  const e = ph(0, 0.7);
  order(lerp(ENTRY_X, x1 + 0.22, e), lerp(0, -0.72, e), -0.02);
}

/* ── 2. the checks ─────────────────────────────────────────────────────── */

function checks(b: Branches) {
  const reject = b.check === "reject";
  const gx = [-0.65, 0.65];
  const names = ["Margin", "Validity"];
  const what = ["Free margin", "Size · level · hours"];
  // the line the order travels
  c.strokeStyle = rgba(pal.ink3, 0.45);
  c.setLineDash([3, 5]);
  seg(ENTRY_X, 0, 0, 1.6, 0, 0);
  c.setLineDash([]);

  for (let g = 0; g < 2; g++) {
    const t0 = g === 0 ? 0.7 : 2.0;
    const scanning = LT > t0 && LT < t0 + 0.7 && !(reject && g === 1);
    const done = LT >= t0 + 0.7 && !(reject && g === 1);
    const bad = reject && g === 0 && done;
    const tone = bad ? pal.neg : done ? pal.pos : pal.ink2;
    const x = gx[g];
    c.lineWidth = 1;
    c.strokeStyle = rgba(pal.ink3, 0.4);
    if (ryz(x + 0.09, FLOOR, 0.8, -0.8, 0.8)) c.stroke();
    c.fillStyle = rgba(tone, done ? 0.1 : 0.03);
    c.strokeStyle = rgba(tone, done ? 0.95 : 0.7);
    c.lineWidth = done ? 1.5 : 1;
    if (ryz(x, FLOOR, 0.8, -0.8, 0.8)) {
      c.fill();
      c.stroke();
    }
    c.lineWidth = 1;
    if (scanning) {
      const ys = lerp(FLOOR, 0.8, fract((LT - t0) / 0.7));
      c.strokeStyle = rgba(pal.accent, 0.95);
      c.lineWidth = 1.5;
      seg(x, ys, -0.8, x, ys, 0.8);
      c.lineWidth = 1;
    }
    label(names[g], x, 1.3, 0, 0.1, rgba(pal.ink, 0.95));
    label(what[g], x, 1.12, 0, 0.07, rgba(pal.ink3, 0.95), "center", true);
    if (done) sign(bad ? "cross" : "tick", x, 0.98, 0, tone, 1);
    else lampAt(x, 0.98, 0, 2.4, pal.ink3, 0.8);
  }

  let x: number;
  if (reject) {
    x = LT < 1.4 ? lerp(ENTRY_X, gx[0] - 0.12, ph(0, 0.7)) : lerp(gx[0] - 0.12, -1.3, ph(1.4, 2.0));
    if (LT > 1.6) label("Rejected", -1.3, -0.3, 0, 0.09, rgba(pal.neg, ph(1.6, 2.1)));
  } else {
    x = LT < 1.4 ? lerp(ENTRY_X, gx[0], ph(0, 0.7)) : LT < 2.7 ? lerp(gx[0], gx[1], ph(1.4, 2.0)) : lerp(gx[1], 1.35, ph(2.7, 3.2));
    if (LT > 2.9) label("Accepted", 1.35, -0.3, 0, 0.09, rgba(pal.pos, ph(2.9, 3.4)));
  }
  order(x, 0, 0);
}

/* ── 3. the routing ────────────────────────────────────────────────────── */

const PROV = [0.5, -0.22, -1.05, 1.15, 0.06, -0.6, 1.62, -0.28, -1.15];

function routing(b: Branches) {
  const book = b.route === "book";
  const hx = -0.8;
  c.lineWidth = 1;
  c.strokeStyle = rgba(pal.ink3, 0.5);
  c.setLineDash([3, 5]);
  seg(ENTRY_X, 0, 0, hx - 0.3, 0, 0);
  c.setLineDash([]);

  // the broker
  c.fillStyle = rgba(pal.surface, 0.9);
  c.strokeStyle = rgba(pal.ink, 0.9);
  c.lineWidth = 1.5;
  if (ring(hx, 0, 0, 0.3, false)) {
    c.fill();
    c.stroke();
  }
  c.lineWidth = 1;
  c.strokeStyle = rgba(pal.ink3, 0.6);
  if (ring(hx, 0, 0, 0.38, false)) c.stroke();
  label("Broker", hx, 0.58, 0, 0.1, rgba(pal.ink, 0.95));

  // its own book: a stack of leaves, standing behind
  const bx = 0.9;
  const bz = 0.9;
  for (let k = 0; k < 5; k++) {
    const y = 0.3 + 0.12 * k;
    c.fillStyle = rgba(pal.surface, 0.8);
    c.strokeStyle = rgba(book ? pal.accent : pal.ink3, book ? 0.9 : 0.5);
    if (rxz(bx - 0.5, bx + 0.5, y, bz - 0.35, bz + 0.35)) {
      c.fill();
      c.stroke();
    }
  }
  label("Its own book", bx, 1.12, bz, 0.09, rgba(book ? pal.ink : pal.ink3, 0.95));
  c.strokeStyle = rgba(book ? pal.accent : pal.ink3, book ? 0.9 : 0.4);
  if (!book) c.setLineDash([3, 5]);
  seg(hx + 0.3, 0.08, 0, bx - 0.5, 0.54, bz - 0.35);
  c.setLineDash([]);

  // the providers: three masts in front, each quoting on its own
  for (let k = 0; k < 3; k++) {
    const px = PROV[k * 3];
    const py = PROV[k * 3 + 1];
    const pz = PROV[k * 3 + 2];
    c.strokeStyle = rgba(pal.ink3, 0.55);
    seg(px, FLOOR, pz, px, py, pz);
    c.strokeStyle = rgba(book ? pal.ink3 : pal.accent, book ? 0.4 : 0.85);
    if (book) c.setLineDash([3, 5]);
    seg(hx + 0.3, -0.06, 0, px, py, pz);
    c.setLineDash([]);
    if (!book) {
      // quotes coming back down each line
      const p = fract(T * 0.45 + k * 0.37);
      lampAt(lerp(px, hx + 0.3, p), lerp(py, -0.06, p), lerp(pz, 0, p), 1.6, pal.teal, Math.sin(p * Math.PI));
    }
    c.fillStyle = rgba(pal.surface, 0.92);
    c.strokeStyle = rgba(book ? pal.ink3 : pal.ink, book ? 0.6 : 0.9);
    if (ring(px, py, pz, 0.13, false)) {
      c.fill();
      c.stroke();
    }
  }
  label("Liquidity providers", 1.05, -0.66, -1.1, 0.09, rgba(book ? pal.ink3 : pal.ink, 0.95));

  const toHub = ph(0, 0.6);
  const out = ph(0.9, 1.7);
  const dx = book ? bx : PROV[3];
  const dy = book ? 0.3 + 0.12 * 4 + 0.07 : PROV[4];
  const dz = book ? bz : PROV[5];
  const x = out > 0 ? lerp(hx, dx, out) : lerp(ENTRY_X, hx, toHub);
  order(x, lerp(0, dy, out), lerp(0, dz, out));
}

/* ── 4. the fill ───────────────────────────────────────────────────────── */

function fill(b: Branches) {
  const lx = 0.25;
  const HW = 0.34;
  const y0 = -0.92;
  const step = 0.2;
  const rung = (k: number) => y0 + step * k;
  /** where the order waits beside the ladder, and where the notes on the far side begin */
  const rest = lx - HW - 0.18;
  const bx = lx + HW + 0.16;
  // the ladder of prices: two rails and their rungs, with a second frame behind so it stands as a thing
  c.lineWidth = 1;
  c.strokeStyle = rgba(pal.ink3, 0.3);
  if (rxy(lx - HW, y0, lx + HW, rung(10), 0.36)) c.stroke();
  for (let k = 0; k <= 10; k += 5) {
    seg(lx - HW, rung(k), 0, lx - HW, rung(k), 0.36);
    seg(lx + HW, rung(k), 0, lx + HW, rung(k), 0.36);
  }
  c.fillStyle = rgba(pal.surface, 0.55);
  c.strokeStyle = rgba(pal.ink2, 0.75);
  if (rxy(lx - HW, y0, lx + HW, rung(10), 0)) {
    c.fill();
    c.stroke();
  }
  c.strokeStyle = rgba(pal.ink3, 0.6);
  for (let k = 1; k < 10; k++) seg(lx - HW, rung(k), 0, lx + HW, rung(k), 0);

  const limit = b.type === "limit";
  const yreq = limit ? rung(4) : rung(5);
  let yp: number;
  let filled = 0;
  let ox_ = lerp(ENTRY_X, rest, ph(0, 0.8));
  let oyy = lerp(0, yreq, ph(0, 0.8));

  // the level the order asks for
  c.setLineDash([5, 4]);
  c.strokeStyle = rgba(pal.gold, 0.9);
  seg(-1.3, yreq, 0, lx + HW, yreq, 0);
  c.setLineDash([]);
  label(limit ? "Limit" : "Requested", -1.3, yreq + 0.13, 0, 0.085, rgba(pal.gold, 1), "left");

  if (limit) {
    if (b.wait === "reached") {
      const d = ph(0.9, 2.5);
      yp = lerp(rung(8), yreq, d) + 0.05 * Math.sin(LT * 5) * (1 - d);
      filled = ph(2.5, 2.9);
      ox_ = lerp(ox_, lx, filled);
    } else {
      yp = rung(7.6) + 0.2 * Math.sin(T * 0.6) + 0.07 * Math.sin(T * 1.7);
      if (LT > 1) label("Pending", rest, yreq - 0.22, 0, 0.085, rgba(pal.ink2, 0.95 * ph(1, 1.5)));
    }
  } else if (b.fill === "exact") {
    yp = yreq;
    filled = ph(0.85, 1.25);
    ox_ = lerp(ox_, lx, filled);
  } else {
    const yf = rung(7);
    const mv = ph(0.45, 1.0);
    yp = lerp(yreq, yf, mv);
    const a = ph(1.1, 1.6);
    // how far the price moved between the click and the order being dealt with
    alpha(a);
    c.strokeStyle = rgba(b.fill === "slip" ? pal.neg : pal.ink2, 0.95);
    c.lineWidth = 1.5;
    seg(bx, yreq, 0, bx, yf, 0);
    seg(bx - 0.06, yreq, 0, bx + 0.06, yreq, 0);
    seg(bx - 0.06, yf, 0, bx + 0.06, yf, 0);
    c.lineWidth = 1;
    alpha(1);
    if (b.fill === "slip") {
      label("Slippage", bx + 0.14, (yreq + yf) / 2, 0, 0.085, rgba(pal.neg, a), "left");
      filled = ph(1.1, 1.7);
      ox_ = lerp(ox_, lx, filled);
      oyy = lerp(oyy, yf, filled);
    } else {
      label("Requote", bx + 0.14, (yreq + yf) / 2, 0, 0.085, rgba(pal.ink, a), "left");
      // the new price is offered back; nothing is traded
      alpha(a);
      c.setLineDash([2, 4]);
      c.strokeStyle = rgba(pal.ink2, 0.9);
      seg(lx - HW, yf, 0, rest, yreq + 0.12, 0);
      c.setLineDash([]);
      alpha(1);
      label("Accept or decline", rest, yreq - 0.22, 0, 0.075, rgba(pal.ink2, 0.95 * a), "center", true);
      ox_ += 0.03 * Math.sin(T * 2.2) * a;
    }
  }

  // the price: one bright rung
  c.strokeStyle = rgba(pal.accent, 1);
  c.lineWidth = 2.5;
  seg(lx - HW - 0.06, yp, 0, lx + HW + 0.06, yp, 0);
  c.lineWidth = 1;
  lampAt(lx + HW + 0.06, yp, 0, 2.2, pal.accent, 0.9);
  label("Price", bx + 0.14, yp + (b.type === "market" && b.fill !== "exact" ? 0.16 : 0), 0, 0.085, rgba(pal.ink, 0.95), "left");

  if (filled > 0.01) {
    sign("tick", rest - 0.06, oyy, -0.02, pal.pos, filled);
    label("Filled", rest - 0.06, oyy - 0.24, 0, 0.085, rgba(pal.pos, filled), "center");
  }
  order(ox_, oyy, -0.02);
}

/* ── 5. the open position ──────────────────────────────────────────────── */

function position() {
  const grow = ph(0.5, 1.6);
  const v = -0.07 + grow * (0.42 * Math.sin(T * 0.7 + 0.2) + 0.14 * Math.sin(T * 1.9));
  const up = v >= 0;
  const tone = up ? pal.pos : pal.neg;

  // the day, turning round the position; the rollover is the gate at the front
  const ry = -0.6;
  const R = 1.3;
  c.lineWidth = 1;
  c.strokeStyle = rgba(pal.ink3, 0.6);
  if (ring(0, ry, 0, R, true)) c.stroke();
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU;
    seg(Math.cos(a) * R, ry, Math.sin(a) * R, Math.cos(a) * (R + (k % 6 === 0 ? 0.12 : 0.06)), ry, Math.sin(a) * (R + (k % 6 === 0 ? 0.12 : 0.06)));
  }
  const ar = -TAU * 0.36;
  const rx = Math.cos(ar) * R;
  const rz = Math.sin(ar) * R;
  c.strokeStyle = rgba(pal.gold, 0.95);
  c.lineWidth = 1.5;
  seg(rx - 0.14, ry, rz, rx - 0.14, ry + 0.3, rz);
  seg(rx + 0.14, ry, rz, rx + 0.14, ry + 0.3, rz);
  seg(rx - 0.14, ry + 0.3, rz, rx + 0.14, ry + 0.3, rz);
  c.lineWidth = 1;
  label("Rollover", rx, ry - 0.2, rz, 0.085, rgba(pal.gold, 1));
  const phase = fract(T / 10 + 0.82);
  const am = ar + phase * TAU;
  lampAt(Math.cos(am) * R, ry, Math.sin(am) * R, 2.6, pal.accent, 1);
  // each time the day passes the gate, a swap is applied
  const age = phase * 10;
  const sw = clamp(1 - age / 4.5) * smooth(age / 0.3) * grow;
  if (sw > 0.01) {
    alpha(sw);
    c.fillStyle = rgba(pal.gold, 0.2);
    c.strokeStyle = rgba(pal.gold, 0.95);
    const cy = ry + 0.55 + age * 0.03;
    if (rxy(rx - 0.26, cy - 0.1, rx + 0.26, cy + 0.1, rz)) {
      c.fill();
      c.stroke();
    }
    label("Swap", rx, cy, rz, 0.08, rgba(pal.ink, 1));
    alpha(1);
  }

  // the entry price, and the floating result measured from it
  const ye = 0.15;
  c.setLineDash([5, 4]);
  c.strokeStyle = rgba(pal.ink2, 0.8);
  seg(-0.75, ye, 0, 0.75, ye, 0);
  c.setLineDash([]);
  label("Entry", -0.85, ye, 0, 0.08, rgba(pal.ink2, 0.95), "right");
  c.fillStyle = rgba(tone, 0.28);
  c.strokeStyle = rgba(tone, 0.95);
  if (rxy(-0.16, Math.min(ye, ye + v), 0.16, Math.max(ye, ye + v), 0)) {
    c.fill();
    c.stroke();
  }
  c.strokeStyle = rgba(pal.ink3, 0.45);
  seg(0, ry, 0, 0, Math.min(ye, ye + v), 0);
  label("Floating P/L", 0.85, ye + 0.02, 0, 0.085, rgba(pal.ink, 0.95), "left");
  sign(up ? "plus" : "minus", 0.42, ye + v, 0, tone, grow);

  // the account above: margin set aside inside equity, which moves with the result
  const ey = 1.08;
  const ex0 = -1.15;
  const ex1 = 1.0 + v * 0.5;
  const mx1 = -0.45;
  c.fillStyle = rgba(pal.surface, 0.85);
  c.strokeStyle = rgba(pal.ink2, 0.85);
  if (rxy(ex0, ey - 0.11, ex1, ey + 0.11, 0)) {
    c.fill();
    c.stroke();
  }
  const m = ph(0.2, 0.9);
  c.fillStyle = rgba(pal.gold, 0.22 * m);
  c.strokeStyle = rgba(pal.gold, 0.95 * m);
  if (rxy(ex0, ey - 0.11, lerp(ex0, mx1, m), ey + 0.11, 0)) {
    c.fill();
    c.stroke();
  }
  for (let k = 1; k < 5; k++) seg(lerp(ex0, mx1, (k / 5) * m), ey - 0.11, 0, lerp(ex0, mx1, (k / 5) * m), ey + 0.11, 0);
  label("Margin set aside", ex0, ey - 0.26, 0, 0.075, rgba(pal.gold, 1), "left");
  label("Equity", 1.0, ey - 0.26, 0, 0.075, rgba(pal.ink2, 0.95), "right", true);

  const e = ph(0, 0.6);
  order(lerp(ENTRY_X, 0, e), lerp(0, ye + v, e), -0.02);
}

/* ── 6. the close ──────────────────────────────────────────────────────── */

const DOORS: { key: Branches["close"]; name: string }[] = [
  { key: "hand", name: "Trader" },
  { key: "sl", name: "Stop loss" },
  { key: "tp", name: "Take profit" },
  { key: "stopout", name: "Stop-out" },
];

function closing(b: Branches) {
  const dz = 0.55;
  const lane = -0.55;
  // the lane in front of the doors, and the line behind them where every close ends
  c.lineWidth = 1;
  c.setLineDash([3, 5]);
  c.strokeStyle = rgba(pal.ink3, 0.5);
  seg(ENTRY_X, 0, lane, 1.6, 0, lane);
  c.setLineDash([]);
  c.strokeStyle = rgba(pal.ink3, 0.6);
  seg(-1.6, FLOOR, 1.5, 1.6, FLOOR, 1.5);

  let chosen = 0;
  for (let k = 0; k < 4; k++) {
    const d = DOORS[k];
    const x = -1.23 + k * 0.82;
    const on = d.key === b.close;
    if (on) chosen = x;
    const tone = on ? (d.key === "stopout" ? pal.neg : pal.gold) : pal.ink3;
    // the threshold on the floor, running back through the door
    c.strokeStyle = rgba(tone, on ? 0.7 : 0.3);
    seg(x, FLOOR, lane, x, FLOOR, 1.5);
    c.strokeStyle = rgba(pal.ink3, 0.35);
    if (rxy(x - 0.3, FLOOR, x + 0.3, 0.55, dz + 0.1)) c.stroke();
    c.fillStyle = rgba(tone, on ? 0.16 : 0.02);
    c.strokeStyle = rgba(tone, on ? 1 : 0.6);
    c.lineWidth = on ? 1.75 : 1;
    if (rxy(x - 0.3, FLOOR, x + 0.3, 0.55, dz)) {
      c.fill();
      c.stroke();
    }
    c.lineWidth = 1;
    // names alternate between two heights so that neighbours never touch
    label(d.name, x, k % 2 ? 0.98 : 0.74, dz, 0.08, on ? rgba(pal.ink, 1) : rgba(pal.ink3, 0.9));
    if (k % 2) {
      c.strokeStyle = rgba(pal.ink3, 0.4);
      seg(x, 0.57, dz, x, 0.88, dz);
    }
  }

  // along the lane to the chosen door, then through it
  const a1 = ph(0, 0.9);
  const a2 = ph(1.0, 1.9);
  const x = lerp(ENTRY_X, chosen, a1);
  const z = lerp(lerp(0, lane, ph(0, 0.4)), 1.5, a2);
  const y = lerp(0, -0.55, a2);
  if (a2 > 0.9) label("Closed", chosen, -0.2, 1.5, 0.08, rgba(pal.ink, ph(1.8, 2.2)), "center");
  order(x, y, z);
}

/* ── 7. the settlement ─────────────────────────────────────────────────── */

const COSTS = ["Spread", "Commission", "Swap"];

function settlement(b: Branches) {
  const profit = b.result === "profit";
  const tone = profit ? pal.pos : pal.neg;
  const top = profit ? -0.35 : -0.57;
  // the balance: a plinth. A loss comes off the top of it; a profit lands on it
  block(-0.9, 0.9, FLOOR, top, -0.5, 0.5, rgba(pal.ink, 0.85), rgba(pal.surface, 0.9));
  label("Balance", 0, (FLOOR + top) / 2, -0.5, 0.1, rgba(pal.ink, 0.95));

  const mv = ph(0.3, 1.3);
  const yb = profit ? lerp(0.75, top, mv) : lerp(top, 0.3, mv);
  alpha(profit ? 1 : 1 - 0.45 * mv);
  if (!profit) c.setLineDash([4, 4]);
  block(-0.72, 0.72, yb, yb + 0.22, -0.4, 0.4, rgba(tone, 0.95), rgba(tone, 0.2));
  c.setLineDash([]);
  alpha(1);
  sign(profit ? "plus" : "minus", -0.58, yb + 0.11, -0.42, tone, 1);
  label(profit ? "Profit realised" : "Loss realised", 0.14, yb + 0.11, -0.42, 0.08, rgba(pal.ink, 0.95));

  // the margin comes back
  const mr = ph(0.1, 0.9);
  const mxc = lerp(-1.75, -1.3, mr);
  alpha(mr);
  c.fillStyle = rgba(pal.gold, 0.22);
  c.strokeStyle = rgba(pal.gold, 0.95);
  if (rxy(mxc - 0.22, 0.42, mxc + 0.22, 0.64, 0)) {
    c.fill();
    c.stroke();
  }
  for (let k = 1; k < 4; k++) seg(mxc - 0.22 + k * 0.11, 0.42, 0, mxc - 0.22 + k * 0.11, 0.64, 0);
  c.setLineDash([2, 4]);
  seg(mxc, 0.42, 0, -0.85, top, 0);
  c.setLineDash([]);
  label("Margin released", mxc - 0.22, 0.8, 0, 0.075, rgba(pal.gold, 1), "left");
  alpha(1);

  // the three costs inside the result, named and not counted
  for (let k = 0; k < 3; k++) {
    const a = ph(1.2 + 0.25 * k, 1.7 + 0.25 * k);
    if (a <= 0.01) continue;
    const y = 0.95 - 0.3 * k;
    alpha(a);
    c.setLineDash([2, 4]);
    c.strokeStyle = rgba(pal.ink3, 0.7);
    seg(0.72, yb + 0.22, 0, 1.02, y, 0);
    c.setLineDash([]);
    c.fillStyle = rgba(pal.surface, 0.9);
    c.strokeStyle = rgba(pal.ink2, 0.9);
    if (rxy(1.02, y - 0.07, 1.16, y + 0.07, 0)) {
      c.fill();
      c.stroke();
    }
    seg(1.05, y, 0, 1.13, y, 0);
    label(COSTS[k], 1.24, y, 0, 0.08, rgba(pal.ink, 0.95), "left");
    alpha(1);
  }

  const e = ph(0, 0.8);
  order(lerp(ENTRY_X, 0.55, e), lerp(0, top + (profit ? 0.36 : 0.14), e), -0.42);
}

const STATION = [ticket, checks, routing, fill, position, closing, settlement];

/* ── the stage they stand on ───────────────────────────────────────────── */

function floorAndTrack(camX: number, stage: number) {
  ox = -camX;
  c.lineWidth = 1;
  // a ruled floor: the lines that run away from the viewer are what give the flight its speed
  const x0 = Math.floor(camX - 8);
  for (let x = x0; x <= x0 + 16; x++) {
    const a = clamp(1 - Math.abs(x - camX) / 8);
    if (a <= 0.02) continue;
    c.strokeStyle = rgba(pal.ink, 0.07 * a);
    seg(x, FLOOR, -3.5, x, FLOOR, 4.5);
  }
  for (let z = -3; z <= 4; z++) {
    c.strokeStyle = rgba(pal.ink, z === 0 ? 0.1 : 0.05);
    for (let k = 0; k < 4; k++) seg(camX - 8 + k * 4, FLOOR, z, camX - 4 + k * 4, FLOOR, z);
  }
  // dust, for depth
  for (let i = 0; i < 70; i++) {
    const x = hash(i, 1) * (N - 1) * SP + (hash(i, 2) - 0.5) * 6;
    if (Math.abs(x - camX) > 7) continue;
    if (!at(x, FLOOR + 0.3 + hash(i, 3) * 3, (hash(i, 4) - 0.5) * 7, A)) continue;
    c.beginPath();
    c.arc(A[0], A[1], 0.5 + hash(i, 5) * 0.8, 0, TAU);
    c.fillStyle = rgba(pal.ink, 0.1 + 0.18 * hash(i, 6));
    c.fill();
  }
  // the track from station to station: solid where the order has been, dashed where it has not
  for (let i = 0; i < N - 1; i++) {
    const xa = i * SP + 1.95;
    const xb = (i + 1) * SP - 1.95;
    if (xb < camX - 9 || xa > camX + 9) continue;
    const done = i < stage;
    c.strokeStyle = done ? rgba(pal.accent, 0.8) : rgba(pal.ink3, 0.55);
    c.lineWidth = done ? 1.5 : 1;
    if (!done) c.setLineDash([4, 6]);
    seg(xa, FLOOR, ZIG[i], xb, FLOOR, ZIG[i + 1]);
    c.setLineDash([]);
    c.lineWidth = 1;
    // an arrowhead halfway, pointing the way the order goes
    const mx = (xa + xb) / 2;
    const mz = (ZIG[i] + ZIG[i + 1]) / 2;
    const sl = (ZIG[i + 1] - ZIG[i]) / (xb - xa);
    seg(mx + 0.12, FLOOR, mz + 0.12 * sl, mx - 0.1, FLOOR, mz - 0.1 * sl - 0.14);
    seg(mx + 0.12, FLOOR, mz + 0.12 * sl, mx - 0.1, FLOOR, mz - 0.1 * sl + 0.14);
  }
}

function station(i: number, b: Branches, focus: number) {
  wx = i * SP;
  wz = ZIG[i];
  GA = lerp(0.2, 1, focus);
  c.globalAlpha = GA;
  c.lineWidth = 1;
  c.setLineDash([]);
  // the pad it stands on, and its name
  c.strokeStyle = rgba(pal.gold, 0.5);
  if (ring(0, FLOOR, 0, 1.95, true)) c.stroke();
  c.strokeStyle = rgba(pal.ink3, 0.35);
  if (ring(0, FLOOR, 0, 2.05, true)) c.stroke();
  label(`0${i + 1} · ${STAGES[i].short}`, 0, 1.58, 0, 0.12, rgba(pal.gold, 1));
  STATION[i](b);
  c.globalAlpha = 1;
  c.setLineDash([]);
  c.lineWidth = 1;
}

/** The frame, as the hero companions draw theirs: a champagne hairline, heavier at the corners, brighter under the pointer. */
function frameIt(w: number, h: number, hv: number) {
  const lit = 0.55 + hv * 0.45;
  c.globalAlpha = 1;
  c.setLineDash([]);
  c.lineWidth = 1;
  c.strokeStyle = rgba(pal.gold, 0.24 * lit);
  c.strokeRect(0.5, 0.5, w - 1, h - 1);
  const k = Math.min(21, Math.min(w, h) * 0.07);
  c.strokeStyle = rgba(pal.gold, 0.85 * lit);
  c.lineWidth = 1.5;
  c.lineCap = "butt";
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    const x = i % 2 ? w : 0;
    const y = i > 1 ? h : 0;
    const sx = i % 2 ? -1 : 1;
    const sy = i > 1 ? -1 : 1;
    c.moveTo(x + sx * k, y + sy * 0.75);
    c.lineTo(x + sx * 0.75, y + sy * 0.75);
    c.lineTo(x + sx * 0.75, y + sy * k);
  }
  c.stroke();
}

/**
 * One scene per canvas. The returned function draws a frame; between frames it
 * keeps only where the camera is and where the order is in its flight.
 */
export function createScene(): SceneDraw {
  let ready = false;
  let camX = 0;
  let camZ = 0;
  let yaw = YAW[0];
  let vX = 0;
  let vZ = 0;
  let vYaw = 0;
  let stage = 0;
  let seq = -1;
  let lt = 0;
  let fly = 1;
  const from = [ENTRY_X, 0, 0];
  const mine = [ENTRY_X, 0, 0];

  return (f, target) => {
    const { w, h, dt, hover, mx, my } = f;
    if (w < 200 || h < 160) return;
    c = f.ctx;
    pal = f.pal;
    font = f.pal.font;
    T = f.t;
    // air in the window before anything is drawn: a wash, and the key light from above the station
    c.fillStyle = rgba(pal.surface, 0.28);
    c.fillRect(0, 0, w, h);
    glow(c, w * 0.5, h * 0.36, Math.max(w, h) * 0.72, pal.accent, 0.085);

    const tgt = clamp(Math.round(target.stage), 0, N - 1);
    const tx = tgt * SP;
    const tz = ZIG[tgt];
    if (target.seq !== seq) {
      if (ready && !f.still && tgt !== stage) {
        from[0] = mine[0];
        from[1] = mine[1];
        from[2] = mine[2];
        fly = 0;
      }
      lt = 0;
      seq = target.seq;
      stage = tgt;
    }
    if (!ready || f.still) {
      camX = tx;
      camZ = tz;
      yaw = YAW[tgt];
      vX = vZ = vYaw = 0;
      fly = 1;
      if (f.still) lt = SETTLED;
      ready = true;
    } else {
      // a critically damped spring: the camera leaves gently, arrives gently, and never overshoots
      const W = 2.7;
      vX += (W * W * (tx - camX) - 2 * W * vX) * dt;
      camX += vX * dt;
      vZ += (W * W * (tz - camZ) - 2 * W * vZ) * dt;
      camZ += vZ * dt;
      vYaw += (W * W * (YAW[tgt] - yaw) - 2 * W * vYaw) * dt;
      yaw += vYaw * dt;
      if (fly < 1) fly = Math.min(1, fly + dt / FLY_S);
      else lt += dt;
    }

    // the view: pulled back while in flight, turned a little by the pointer
    const gap = Math.abs(tx - camX) / SP;
    const zoom = 1 - 0.3 * smooth(Math.min(1, gap * 1.3));
    const unit = Math.min((w * 0.92) / 4.1, (h * 0.92) / 3.2) * zoom;
    const hv = smooth(hover);
    const sway = f.still ? 0 : Math.sin(T * 0.3) * 0.03;
    aim(cam, w * 0.5, h * 0.5, unit, DIST, yaw + sway + (mx / w - 0.5) * 0.6 * hv, 0.2 + (my / h - 0.5) * 0.24 * hv);
    oy = -CAM_Y;
    oz = -camZ;
    c.lineCap = "round";
    c.lineJoin = "round";

    wx = 0;
    wz = 0;
    GA = 1;
    floorAndTrack(camX, stage);

    // the stations in view, the furthest first
    const here = camX / SP;
    const lo = Math.max(0, Math.floor(here - 1.2));
    const hi = Math.min(N - 1, Math.ceil(here + 1.2));
    const leftIsFar = cam.sy_ >= 0;
    for (let k = lo; k <= hi; k++) {
      // with the camera turned one way the stations to one side are further off: draw those first
      const i = leftIsFar ? k : hi - (k - lo);
      const d = Math.abs(i - here);
      if (d > 1.45) continue;
      ox = i * SP - camX;
      oz = ZIG[i] - camZ;
      LIVE = i === stage && fly >= 1;
      LT = i === stage ? (fly >= 1 ? lt : 0) : SETTLED;
      station(i, target.branches, 1 - smooth((d - 0.2) / 0.85));
    }
    LIVE = false;
    if (fly >= 1) {
      mine[0] = tok[0];
      mine[1] = tok[1];
      mine[2] = tok[2];
    }

    // the order in flight between two stations, with a line down to its shadow on the floor
    if (fly < 1) {
      const e = smooth(fly);
      const x = lerp(from[0], tx + ENTRY_X, e);
      const y = lerp(from[1], 0, e) + Math.sin(e * Math.PI) * 0.55;
      const z = lerp(from[2], tz, e);
      ox = -camX;
      oz = -camZ;
      c.strokeStyle = rgba(pal.gold, 0.35);
      c.setLineDash([2, 4]);
      seg(x, y, z, x, FLOOR, z);
      c.setLineDash([]);
      for (let k = 3; k >= 1; k--) {
        const ek = smooth(Math.max(0, fly - k * 0.035));
        lampAt(lerp(from[0], tx + ENTRY_X, ek), lerp(from[1], 0, ek) + Math.sin(ek * Math.PI) * 0.55, lerp(from[2], tz, ek), 1.6, pal.gold, 0.5 - k * 0.12);
      }
      drawOrder(x, y, z, 1);
      mine[0] = x;
      mine[1] = y;
      mine[2] = z;
    }

    frameIt(w, h, hv);
  };
}

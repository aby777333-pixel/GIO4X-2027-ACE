/**
 * FORGE — the Workshop, at its anvil.
 *
 * The Workshop's first machine forges a candle from its four prices, so the
 * room's instrument is the forge itself. A candle lies on an anvil, hot at
 * its heart. A hammer comes down on it in a steady time; at each blow the
 * candle's body changes its length a little, sparks fly from the place that
 * was struck, and the glow flares and settles. Behind, on a rack, hang the
 * candles already made.
 *
 * The pointer is the bellows: bring it near and the metal runs hotter and
 * the sparks come thicker.
 *
 * The shapes are candles in outline only. No price is shown.
 */
import { TAU, clamp, lerp, rgba, type Frame, type Scene } from "../engine";
import { rounded, smooth, stage } from "./_stage";

const BEAT = 1.5;
const SPARKS = 26;

type State = { made: number[][] };

const scene: Scene<State> = {
  pose: 3.2,
  setup(f) {
    // the candles on the rack: body top, body bottom, as shares of their height
    return { made: Array.from({ length: 9 }, (_, i) => [0.15 + 0.3 * f.rnd(i * 3), 0.55 + 0.3 * f.rnd(i * 3 + 1), f.rnd(i * 3 + 2)]) };
  },
  draw(f: Frame, s: State) {
    const { ctx, pal } = f;
    const R = stage(f);
    const cx = R.x + R.w * 0.5;
    const top = R.y + R.h * 0.64; // the face of the anvil
    const beat = f.t / BEAT;
    const n = Math.floor(beat);
    const u = beat - n;
    // the hammer rises slowly and falls fast; it meets the metal at u = 0
    const raised = f.still ? 0.12 : u < 0.72 ? smooth(u / 0.72) : 1 - Math.pow((u - 0.72) / 0.28, 2);
    const since = f.still ? 0.1 : u; // time since the last blow, in beats
    const heat = clamp(0.45 + 0.55 * Math.exp(-since * 3.2) + f.hover * 0.3);

    // the rack of finished candles
    const rackY = R.y + R.h * 0.16;
    ctx.strokeStyle = rgba(pal.ink3, 0.6 * f.boot);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(R.x + R.w * 0.08, rackY);
    ctx.lineTo(R.x + R.w * 0.92, rackY);
    ctx.stroke();
    s.made.forEach((c, i) => {
      const x = R.x + R.w * (0.14 + (i / (s.made.length - 1)) * 0.72);
      const h = R.h * 0.2;
      const sway = f.still ? 0 : Math.sin(f.t * 1.1 + i) * 0.03;
      const on = f.on(0.1 + i * 0.05, 0.4);
      const tone = c[2] > 0.5 ? pal.emerald : pal.crimson;
      ctx.save();
      ctx.translate(x, rackY);
      ctx.rotate(sway);
      ctx.globalAlpha = on * 0.75;
      ctx.strokeStyle = rgba(tone, 0.9);
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(0, 4 + h);
      ctx.stroke();
      ctx.fillStyle = rgba(tone, 0.75);
      ctx.fillRect(-4, 4 + h * c[0], 8, h * (c[1] - c[0]));
      ctx.restore();
    });

    // the glow of the fire, under everything on the anvil
    const fire = ctx.createRadialGradient(cx, top, 0, cx, top, R.h * 0.6);
    fire.addColorStop(0, rgba(pal.gold, 0.34 * heat * f.boot));
    fire.addColorStop(0.5, rgba(pal.crimson, 0.1 * heat * f.boot));
    fire.addColorStop(1, rgba(pal.crimson, 0));
    ctx.fillStyle = fire;
    ctx.fillRect(R.x, R.y, R.w, R.h);

    // the anvil: a face, a horn, a waist and a foot
    const aw = R.w * 0.34;
    const ah = R.h * 0.2;
    ctx.beginPath();
    ctx.moveTo(cx - aw * 0.5, top);
    ctx.lineTo(cx + aw * 0.5, top);
    ctx.lineTo(cx + aw * 0.78, top + ah * 0.16); // the horn
    ctx.lineTo(cx + aw * 0.36, top + ah * 0.36);
    ctx.lineTo(cx + aw * 0.2, top + ah * 0.72);
    ctx.lineTo(cx + aw * 0.42, top + ah);
    ctx.lineTo(cx - aw * 0.42, top + ah);
    ctx.lineTo(cx - aw * 0.2, top + ah * 0.72);
    ctx.lineTo(cx - aw * 0.36, top + ah * 0.36);
    ctx.lineTo(cx - aw * 0.5, top + ah * 0.2);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.bg, 0.96);
    ctx.fill();
    ctx.fillStyle = rgba(pal.blue, 0.14);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.ink2, 0.8 * f.boot);
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.strokeStyle = rgba(pal.gold, 0.9 * heat * f.boot);
    ctx.beginPath();
    ctx.moveTo(cx - aw * 0.5, top);
    ctx.lineTo(cx + aw * 0.5, top);
    ctx.stroke();

    // the candle on the anvil, lying on its side: wick, body, wick
    const len = R.w * 0.3;
    const thick = Math.max(8, R.h * 0.07);
    const a0 = 0.28 + 0.12 * f.rnd(n * 7 + 40);
    const a1 = 0.62 + 0.14 * f.rnd(n * 7 + 41);
    const p0 = 0.28 + 0.12 * f.rnd((n - 1) * 7 + 40);
    const p1 = 0.62 + 0.14 * f.rnd((n - 1) * 7 + 41);
    const set = f.still ? 1 : smooth(u / 0.12); // the blow sets the new shape
    const b0 = lerp(p0, a0, set);
    const b1 = lerp(p1, a1, set);
    const y = top - thick / 2 - 1;
    ctx.strokeStyle = rgba(pal.gold, 0.95);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - len / 2, y);
    ctx.lineTo(cx + len / 2, y);
    ctx.stroke();
    const hot = ctx.createLinearGradient(0, y - thick / 2, 0, y + thick / 2);
    hot.addColorStop(0, rgba(pal.key, 0.5 + 0.5 * heat));
    hot.addColorStop(0.5, rgba(pal.gold, 0.95));
    hot.addColorStop(1, rgba(pal.crimson, 0.9));
    rounded(ctx, cx - len / 2 + len * b0, y - thick / 2, len * (b1 - b0), thick, 2);
    ctx.fillStyle = hot;
    ctx.shadowColor = rgba(pal.gold, 0.9 * heat);
    ctx.shadowBlur = 22 * heat;
    ctx.fill();
    ctx.shadowColor = "transparent";

    // where the hammer lands: on one end of the body or the other, by turns
    const strikeX = cx - len / 2 + len * (n % 2 ? b1 - 0.04 : b0 + 0.04);

    // the hammer
    const hx = strikeX + R.w * 0.02;
    const lift = raised * R.h * 0.34;
    const tilt = -0.5 - raised * 0.5;
    ctx.save();
    ctx.translate(hx, y - thick / 2 - lift);
    ctx.rotate(tilt + 0.5);
    const hw = R.w * 0.075;
    const hh = R.h * 0.09;
    ctx.strokeStyle = rgba(pal.ink2, 0.9 * f.boot);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -hh / 2);
    ctx.lineTo(R.w * 0.2, -hh / 2 - R.h * 0.16);
    ctx.stroke();
    rounded(ctx, -hw / 2, -hh, hw, hh, 2);
    ctx.fillStyle = rgba(pal.bg, 0.96);
    ctx.fill();
    ctx.fillStyle = rgba(pal.teal, 0.3);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.teal, 0.95 * f.boot);
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();

    // the sparks of the last blow
    const count = Math.round(SPARKS * (0.6 + f.hover * 0.4));
    for (let i = 0; i < count; i++) {
      const life = since * BEAT * (0.9 + f.rnd(n * 31 + i) * 0.8);
      if (life > 1) continue;
      const ang = -Math.PI * (0.12 + 0.76 * f.rnd(n * 31 + i + 100));
      const speed = R.h * (0.35 + 0.5 * f.rnd(n * 31 + i + 200));
      const sx = strikeX + Math.cos(ang) * speed * life;
      const sy = y - thick / 2 + Math.sin(ang) * speed * life + R.h * 0.5 * life * life;
      const tail = 0.05;
      const tx = strikeX + Math.cos(ang) * speed * Math.max(0, life - tail);
      const ty = y - thick / 2 + Math.sin(ang) * speed * Math.max(0, life - tail) + R.h * 0.5 * Math.pow(Math.max(0, life - tail), 2);
      ctx.strokeStyle = rgba(i % 3 ? pal.gold : pal.key, (1 - life) * 0.95);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
    // the flash of the blow itself
    if (since < 0.1 && !f.still) {
      const q = 1 - since / 0.1;
      const g = ctx.createRadialGradient(strikeX, y, 0, strikeX, y, R.h * 0.2);
      g.addColorStop(0, rgba(pal.key, 0.8 * q));
      g.addColorStop(1, rgba(pal.key, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(strikeX, y, R.h * 0.2, 0, TAU);
      ctx.fill();
    }
  },
};

export default scene;

/**
 * FIRST TRADE — one trade, from the ticket to its ending.
 *
 * The course walks through a trade in the order it happens, and so does its
 * instrument. A ticket on the left is filled in, row by row, and checked.
 * Then an invented price sets out from the entry and wanders between two
 * lines: the stop below and the target above. It ends where it touches one of
 * them, and the next trade begins. Some end at the target and some at the
 * stop, because that is what a trade is.
 *
 * The pointer holds the stop. Move it up or down and the stop follows, the
 * shaded risk grows or shrinks, and the bar on the ticket that compares risk
 * with reward changes with it.
 *
 * The price is a seeded walk. It is not a market and predicts nothing.
 */
import { TAU, clamp, lerp, rgba, type Frame, type Scene } from "../engine";
import { rounded, smooth, stage } from "./_stage";

const N = 96;
const LOOP = 10;
const TARGET = 0.4;
const STOP = 0.24;

type State = { walks: number[][] };

const scene: Scene<State> = {
  pose: 7.6,
  setup(f) {
    const walks = Array.from({ length: 6 }, (_, k) => {
      const lean = (k % 3 === 2 ? -1 : 1) * 0.0062;
      let v = 0;
      return Array.from({ length: N }, (_, i) => {
        if (i) v += (f.rnd(k * 131 + i) - 0.5) * 0.085 + lean;
        return v;
      });
    });
    return { walks };
  },
  draw(f: Frame, s: State) {
    const { ctx, pal } = f;
    const R = stage(f);
    const turn = f.t / LOOP;
    const k = Math.floor(turn);
    const u = turn - k;
    const walk = s.walks[k % s.walks.length];
    const fade = f.still ? 1 : smooth(u / 0.04) * (1 - smooth((u - 0.94) / 0.06));

    const x0 = R.x + R.w * 0.34;
    const x1 = R.x + R.w * 0.95;
    const mid = R.y + R.h * 0.58;
    const unit = R.h * 0.72;
    // the stop is held by the pointer while it is over the stage
    const held = clamp((f.my - mid) / unit, 0.1, 0.42);
    const stop = lerp(STOP, held, f.hover);
    const yT = mid - TARGET * unit;
    const yS = mid + stop * unit;

    // the floor the chart stands on: a faint grid
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const x = lerp(x0, x1, i / 8);
      ctx.strokeStyle = rgba(pal.ink3, 0.12 * f.boot);
      ctx.beginPath();
      ctx.moveTo(x, R.y + R.h * 0.1);
      ctx.lineTo(x, R.y + R.h * 0.92);
      ctx.stroke();
    }

    // reward above the entry, risk below it
    const zone = f.on(0.3, 0.5);
    ctx.fillStyle = rgba(pal.emerald, 0.09 * zone);
    ctx.fillRect(x0, yT, x1 - x0, mid - yT);
    ctx.fillStyle = rgba(pal.crimson, 0.1 * zone);
    ctx.fillRect(x0, mid, x1 - x0, yS - mid);
    const level = (y: number, colour: string, name: string, dash: boolean) => {
      ctx.setLineDash(dash ? [6, 5] : []);
      ctx.strokeStyle = rgba(colour, 0.9 * zone);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + (x1 - x0) * zone, y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (!f.mobile) {
        ctx.font = `600 10px ${pal.font}`;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = rgba(colour, 0.95 * zone);
        ctx.fillText(name, x1, y - 4);
      }
    };
    level(yT, pal.emerald, "TARGET", true);
    level(mid, pal.ink2, "ENTRY", false);
    level(yS, pal.crimson, "STOP", true);

    // the ticket
    const tw = R.w * 0.22;
    const th = R.h * 0.62;
    const tx = R.x + R.w * 0.05;
    const ty = mid - th * 0.56;
    const built = f.still ? 1 : clamp(u / 0.2);
    ctx.save();
    ctx.globalAlpha = f.on(0.1, 0.5);
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    rounded(ctx, tx, ty, tw, th, 6);
    ctx.fillStyle = rgba(pal.bg, 0.94);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = rgba(pal.ink3, 0.7);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = rgba(pal.teal, 0.95);
    ctx.fillRect(tx + 6, ty, tw - 12, 2);
    const rows = 5;
    for (let i = 0; i < rows; i++) {
      const ry = ty + th * (0.14 + i * 0.13);
      const done = clamp(built * rows - i);
      ctx.fillStyle = rgba(pal.ink3, 0.5);
      ctx.fillRect(tx + tw * 0.1, ry, tw * 0.24, 3);
      ctx.fillStyle = rgba(pal.ink, 0.9);
      ctx.fillRect(tx + tw * 0.4, ry - 1, tw * [0.4, 0.3, 0.44, 0.26, 0.36][i] * done, 5);
      // each row is checked once the ticket is whole
      const checked = f.still ? 1 : clamp((u - 0.2 - i * 0.016) / 0.03);
      if (checked > 0) {
        const cx = tx + tw * 0.9;
        ctx.strokeStyle = rgba(pal.emerald, 0.95);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx - 4, ry + 1);
        ctx.lineTo(cx - 4 + 3 * Math.min(1, checked * 2), ry + 1 + 3 * Math.min(1, checked * 2));
        if (checked > 0.5) ctx.lineTo(cx - 1 + 6 * (checked * 2 - 1), ry + 4 - 7 * (checked * 2 - 1));
        ctx.stroke();
      }
    }
    // risk against reward, as one bar in two colours
    const by = ty + th * 0.86;
    const bw = tw * 0.8;
    const share = stop / (stop + TARGET);
    ctx.fillStyle = rgba(pal.crimson, 0.9);
    ctx.fillRect(tx + tw * 0.1, by, bw * share, 6);
    ctx.fillStyle = rgba(pal.emerald, 0.9);
    ctx.fillRect(tx + tw * 0.1 + bw * share + 2, by, bw * (1 - share) - 2, 6);
    ctx.restore();

    // the ticket is sent: a line from it to the entry
    const sent = f.still ? 1 : clamp((u - 0.26) / 0.05);
    if (sent > 0) {
      ctx.strokeStyle = rgba(pal.key, 0.8 * fade);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(tx + tw, mid);
      ctx.lineTo(lerp(tx + tw, x0, sent), mid);
      ctx.stroke();
    }

    // the price, from the entry to wherever it ends
    const live = f.still ? 1 : clamp((u - 0.31) / 0.55);
    if (live > 0) {
      let hit = N - 1;
      for (let i = 1; i < N; i++) {
        if (walk[i] >= TARGET || walk[i] <= -stop) {
          hit = i;
          break;
        }
      }
      const head = live * (N - 1);
      const shown = Math.min(head, hit);
      const at = (i: number) => ({ x: lerp(x0, x1, i / (N - 1)), y: mid - clamp(walk[Math.round(i)], -stop, TARGET) * unit });
      ctx.beginPath();
      for (let i = 0; i <= Math.floor(shown); i++) {
        const p = at(i);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.lineJoin = "round";
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = rgba(pal.key, 0.95 * fade);
      ctx.stroke();
      const p = at(Math.floor(shown));
      const won = walk[hit] >= TARGET;
      const ended = head >= hit;
      const tone = ended ? (won ? pal.emerald : pal.crimson) : pal.key;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18);
      g.addColorStop(0, rgba(tone, 0.9 * fade));
      g.addColorStop(1, rgba(tone, 0));
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 18, p.y - 18, 36, 36);
      ctx.fillStyle = rgba(tone, fade);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, TAU);
      ctx.fill();
      if (ended) {
        // where it ended: rings that widen and fade
        const since = f.still ? 0.35 : clamp((head - hit) / 26);
        for (let r = 0; r < 3; r++) {
          const q = clamp(since * 1.4 - r * 0.2);
          if (q <= 0 || q >= 1) continue;
          ctx.strokeStyle = rgba(tone, (1 - q) * 0.8 * fade);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6 + q * f.u * 0.34, 0, TAU);
          ctx.stroke();
        }
      }
    }
  },
};

export default scene;

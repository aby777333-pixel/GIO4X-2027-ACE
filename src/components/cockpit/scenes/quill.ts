/**
 * QUILL — a verse, as it is written and as it sounds.
 *
 * Four lines are written across the stage, word by word, by a point of
 * light. A word is a stroke; over each is the mark of its beat, heavy or
 * light, so the metre can be seen. The last word of each line is coloured by
 * its rhyme: the first line with the second, the third with the fourth. When
 * a rhyme is completed an arc joins the two words and a ring spreads from it,
 * as a bell would sound. Beside the page a pendulum keeps the time the words
 * are written to.
 *
 * The pointer reads: the line under it brightens and its beats rise.
 *
 * The strokes are not words and cannot be read.
 */
import { TAU, clamp, rgba, type Frame, type Scene } from "../engine";
import { smooth, stage } from "./_stage";

const LINES = 4;
const WORDS = 6;
const LOOP = 12;

type State = { verses: number[][][] };

const scene: Scene<State> = {
  pose: 9.6,
  setup(f) {
    // three verses; a word is a length between 0.5 and 1
    return {
      verses: Array.from({ length: 3 }, (_, v) => Array.from({ length: LINES }, (_, l) => Array.from({ length: WORDS }, (_, w) => 0.5 + 0.5 * f.rnd(v * 211 + l * 17 + w)))),
    };
  },
  draw(f: Frame, s: State) {
    const { ctx, pal } = f;
    const R = stage(f);
    const turn = f.t / LOOP;
    const n = Math.floor(turn);
    const u = turn - n;
    const verse = s.verses[n % s.verses.length];
    const fade = f.still ? 1 : 1 - smooth((u - 0.93) / 0.07);
    const x0 = R.x + R.w * 0.2;
    const x1 = R.x + R.w * 0.9;
    const top = R.y + R.h * 0.24;
    const gap = R.h * 0.17;
    const written = f.still ? LINES : clamp(u / 0.72) * LINES; // lines written so far, with a fraction
    const rhyme = [pal.teal, pal.teal, pal.gold, pal.gold];

    // the page: a margin line and faint rules
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.crimson, 0.4 * f.boot);
    ctx.beginPath();
    ctx.moveTo(x0 - R.w * 0.03, R.y + R.h * 0.1);
    ctx.lineTo(x0 - R.w * 0.03, R.y + R.h * 0.92);
    ctx.stroke();
    for (let l = 0; l < LINES; l++) {
      ctx.strokeStyle = rgba(pal.ink3, 0.22 * f.boot);
      ctx.beginPath();
      ctx.moveTo(x0 - R.w * 0.03, top + l * gap + 9);
      ctx.lineTo(x1, top + l * gap + 9);
      ctx.stroke();
    }

    // the pendulum that keeps the beat
    const px = R.x + R.w * 0.08;
    const py = R.y + R.h * 0.16;
    const len = R.h * 0.52;
    const ang = f.still ? 0.18 : Math.sin(f.t * 2.6) * 0.24;
    const bobX = px + Math.sin(ang) * len;
    const bobY = py + Math.cos(ang) * len;
    ctx.strokeStyle = rgba(pal.ink3, 0.4 * f.boot);
    ctx.beginPath();
    ctx.arc(px, py, len, Math.PI / 2 - 0.24, Math.PI / 2 + 0.24);
    ctx.stroke();
    ctx.strokeStyle = rgba(pal.ink2, 0.8 * f.boot);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();
    const bob = ctx.createRadialGradient(bobX, bobY, 0, bobX, bobY, 16);
    bob.addColorStop(0, rgba(pal.gold, 0.8 * f.boot));
    bob.addColorStop(1, rgba(pal.gold, 0));
    ctx.fillStyle = bob;
    ctx.fillRect(bobX - 16, bobY - 16, 32, 32);
    ctx.fillStyle = rgba(pal.gold, f.boot);
    ctx.beginPath();
    ctx.arc(bobX, bobY, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(pal.ink2, f.boot);
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, TAU);
    ctx.fill();

    // the lines
    const ends: { x: number; y: number }[] = [];
    let pen: { x: number; y: number } | null = null;
    for (let l = 0; l < LINES; l++) {
      const y = top + l * gap;
      const reading = f.hover > 0.2 && Math.abs(f.my - y) < gap * 0.45 ? f.hover : 0;
      const total = verse[l].reduce((a, b) => a + b, 0);
      const span = x1 - x0 - (WORDS - 1) * 8;
      const prog = clamp(written - l) * WORDS; // words of this line written
      let x = x0;
      for (let w = 0; w < WORDS; w++) {
        const ww = (verse[l][w] / total) * span;
        const q = clamp(prog - w);
        const last = w === WORDS - 1;
        if (q > 0) {
          ctx.fillStyle = rgba(last ? rhyme[l] : pal.ink, (last ? 0.95 : 0.78 + reading * 0.2) * fade);
          ctx.fillRect(x, y, ww * q, last ? 6 : 5);
          // the beat over the word: heavy on the even words
          const heavy = w % 2 === 1;
          const rise = reading * (4 + 3 * Math.sin(f.t * 5 + w));
          ctx.fillStyle = rgba(heavy ? pal.key : pal.ink3, (heavy ? 0.9 : 0.6) * q * fade);
          ctx.beginPath();
          ctx.arc(x + ww / 2, y - 9 - rise, heavy ? 2.6 : 1.6, 0, TAU);
          ctx.fill();
          if (q < 1) pen = { x: x + ww * q, y: y + 3 };
        }
        if (last) ends.push({ x: x + ww / 2, y: y + 3 });
        x += ww + 8;
      }
    }

    // each rhyme, once both its words are written: an arc, and a ring that spreads
    [
      [0, 1],
      [2, 3],
    ].forEach(([a, b]) => {
      const since = written - (b + 1);
      if (since < 0 && !f.still) return;
      const tone = rhyme[a];
      const drawn = f.still ? 1 : clamp(since / 0.3);
      const A = ends[a];
      const B = ends[b];
      const bulge = R.w * 0.07;
      ctx.strokeStyle = rgba(tone, 0.9 * fade);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 24 * drawn; i++) {
        const t = i / 24;
        const xx = A.x + (B.x - A.x) * t + Math.sin(t * Math.PI) * bulge;
        const yy = A.y + (B.y - A.y) * t;
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      if (!f.still) {
        const ringing = clamp(since / 1.1);
        if (ringing > 0 && ringing < 1) {
          for (let r = 0; r < 3; r++) {
            const q = clamp(ringing * 1.3 - r * 0.15);
            if (q <= 0 || q >= 1) continue;
            ctx.strokeStyle = rgba(tone, (1 - q) * 0.7 * fade);
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(B.x, B.y, 5 + q * f.u * 0.5, 0, TAU);
            ctx.stroke();
          }
        }
      }
    });

    // the quill's point
    const tip = pen as { x: number; y: number } | null;
    if (tip && !f.still) {
      const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 16);
      g.addColorStop(0, rgba(pal.key, 0.95));
      g.addColorStop(1, rgba(pal.key, 0));
      ctx.fillStyle = g;
      ctx.fillRect(tip.x - 16, tip.y - 16, 32, 32);
      // the feather: a short slanted stroke above the point
      ctx.strokeStyle = rgba(pal.ink2, 0.9);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.quadraticCurveTo(tip.x + 10, tip.y - 16, tip.x + 26, tip.y - 30);
      ctx.stroke();
      ctx.strokeStyle = rgba(pal.teal, 0.6);
      ctx.beginPath();
      ctx.moveTo(tip.x + 8, tip.y - 12);
      ctx.quadraticCurveTo(tip.x + 24, tip.y - 14, tip.x + 26, tip.y - 30);
      ctx.stroke();
    }
  },
};

export default scene;

import { TAU, clamp, lerp, rgba, smooth, type Colour, type FigureFrame } from "@/components/figures/Figure";

/**
 * The six drawings of the leverage story, one for each step. The page shows
 * the one whose step is being read and fades to the next as it arrives.
 *
 *   0  the stake            ten coins are counted out onto a tray
 *   1  what it controls     a hundred squares open out; one of them is yours
 *   2  the market moves     a price climbs by one part in a hundred
 *   3  the move, measured   one square of the hundred is carried to the stake
 *   4  for you or against   a pendulum, and what each side of it leaves you
 *   5  a smaller position   ninety squares are put back; the move is a sliver
 *
 * `a` is how visible the drawing is (0 to 1) and `q` the seconds since its
 * step arrived. Every figure is the example in the words beside it.
 */
const RED: Colour = [214, 96, 88, 1];
/** gold as a colour for words: the metal itself is too pale to read on a light page */
const brass = (f: FigureFrame): Colour => (f.pal.ink[0] < 128 ? [122, 94, 32, 1] : f.pal.gold);

type Scene = (f: FigureFrame, a: number, q: number) => void;

function caption(f: FigureFrame, text: string) {
  const { ctx, w, h, pal } = f;
  ctx.font = `600 ${w < 340 ? 9 : 11}px ${pal.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(pal.ink2, 1);
  ctx.fillText(text, w / 2, h - 14);
}

function label(f: FigureFrame, text: string, x: number, y: number, colour: Colour, align: CanvasTextAlign = "center") {
  const { ctx, w, pal } = f;
  ctx.font = `600 ${w < 340 ? 9 : 11}px ${pal.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(colour, 1);
  ctx.fillText(text, x, y);
}

/** a coin seen from a little above: a rim and a face */
function coin(f: FigureFrame, x: number, y: number, rx: number, thick: number, tone: Colour, alpha = 1) {
  const { ctx } = f;
  const ry = rx * 0.3;
  ctx.fillStyle = rgba(tone, 0.55 * alpha);
  ctx.beginPath();
  ctx.ellipse(x, y + thick, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(x - rx, y);
  ctx.ellipse(x, y, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(tone, 0.95 * alpha);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(0,0,0,${0.25 * alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 0.7, ry * 0.7, 0, 0, TAU);
  ctx.stroke();
}

/** the ten-by-ten board the position is counted on */
function board(f: FigureFrame) {
  const { w, h } = f;
  const cell = Math.floor(Math.min((w * 0.62) / 10, (h - 78) / 10));
  const size = cell * 10;
  const x = Math.round((w - size) / 2 + cell * 0.9);
  const y = Math.round((h - 34 - size) / 2);
  return { cell, size, x, y, at: (col: number, row: number) => ({ x: x + col * cell, y: y + row * cell }) };
}

function square(f: FigureFrame, x: number, y: number, cell: number, tone: Colour, fill: number, edge: number) {
  const { ctx } = f;
  if (fill > 0) {
    ctx.fillStyle = rgba(tone, fill);
    ctx.fillRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
  }
  if (edge > 0) {
    ctx.strokeStyle = rgba(tone, edge);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
  }
}

const stake: Scene = (f, a, q) => {
  const { ctx, w, h, pal } = f;
  ctx.globalAlpha = a;
  const cx = w / 2;
  const tray = h * 0.74;
  const rx = Math.min(w * 0.17, 74);
  const thick = Math.max(5, h * 0.022);
  // the tray
  ctx.strokeStyle = rgba(pal.ink3, 0.9);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, tray + thick, rx * 1.7, rx * 0.5, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = rgba(pal.ink3, 0.4);
  ctx.beginPath();
  ctx.ellipse(cx, tray + thick, rx * 2.1, rx * 0.62, 0, 0, TAU);
  ctx.stroke();
  // ten coins, each a hundred, counted out one after another
  let landed = 0;
  for (let i = 0; i < 10; i++) {
    const fall = clamp((q - 0.25 - i * 0.22) / 0.42);
    if (fall <= 0) continue;
    const drop = 1 - Math.pow(1 - fall, 3);
    const bounce = fall > 0.75 ? Math.sin(((fall - 0.75) / 0.25) * Math.PI) * 5 : 0;
    const rest = tray - i * (thick + 2);
    coin(f, cx, lerp(-20, rest, drop) - bounce, rx, thick, pal.gold, 1);
    if (fall >= 1) landed++;
  }
  // a gleam passes up the finished pile
  if (landed === 10) {
    const top = tray - 9 * (thick + 2);
    const sweep = (q * 0.5) % 1;
    const gy = lerp(tray + thick, top - rx * 0.3, sweep);
    const g = ctx.createLinearGradient(0, gy - 14, 0, gy + 14);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - rx, top - rx * 0.3, rx * 2, tray + thick + rx * 0.3 - (top - rx * 0.3));
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(cx - rx, gy - 14, rx * 2, 28);
    ctx.restore();
    // the count, beside the pile
    const bx = cx + rx + 14;
    ctx.strokeStyle = rgba(pal.ink3, 0.9);
    ctx.beginPath();
    ctx.moveTo(bx, top - 2);
    ctx.lineTo(bx + 6, top - 2);
    ctx.lineTo(bx + 6, tray + thick);
    ctx.lineTo(bx, tray + thick);
    ctx.stroke();
    label(f, "10 × 100", bx + 12, (top + tray + thick) / 2, pal.ink, "left");
  }
  label(f, `${landed * 100 === 1000 ? "1,000" : landed * 100}`, cx, h * 0.12, brass(f));
  caption(f, "YOUR STAKE: 1,000");
};

const controls: Scene = (f, a, q) => {
  const { ctx, pal } = f;
  ctx.globalAlpha = a;
  const b = board(f);
  // the squares open out from the one that is yours
  let open = 0;
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const far = Math.hypot(col, 9 - row);
      const on = smooth((q - 0.3 - far * 0.13) / 0.35);
      if (on <= 0) continue;
      open++;
      const p = b.at(col, row);
      const mine = col === 0 && row === 9;
      // a light crosses the board, corner to corner, again and again
      const wave = Math.max(0, 1 - Math.abs(((q * 4) % 26) - far) / 1.6);
      if (mine) square(f, p.x, p.y, b.cell, pal.gold, 0.95, 1);
      else square(f, p.x, p.y, b.cell, pal.accent, (0.1 + wave * 0.3) * on, (0.55 + wave * 0.4) * on);
    }
  }
  // the stake, named
  const s = b.at(0, 9);
  ctx.strokeStyle = rgba(pal.gold, 0.9);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(s.x - 4, s.y + b.cell / 2);
  ctx.lineTo(s.x - b.cell * 0.9, s.y + b.cell / 2);
  ctx.stroke();
  label(f, "YOURS", s.x - b.cell, s.y + b.cell / 2, brass(f), "right");
  label(f, `${open} OF 100`, b.x + b.size / 2, b.y - 12, pal.ink);
  caption(f, "1,000 SET ASIDE ANSWERS FOR 100,000");
};

const market: Scene = (f, a, q) => {
  const { ctx, w, h, pal } = f;
  ctx.globalAlpha = a;
  const x0 = w * 0.08;
  const x1 = w * 0.8;
  const low = h * 0.62;
  const high = h * 0.3;
  const loop = q % 7;
  const drawn = clamp(loop / 3.6);
  const y = (u: number) => lerp(low, high, smooth((u - 0.42) / 0.36)) + Math.sin(u * 46) * 4 + Math.sin(u * 19 + 1.3) * 6 * (1 - u * 0.5);
  // the floor of the chart
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    ctx.strokeStyle = rgba(pal.ink3, 0.18);
    ctx.beginPath();
    ctx.moveTo(x0, lerp(h * 0.16, h * 0.78, i / 5));
    ctx.lineTo(x1, lerp(h * 0.16, h * 0.78, i / 5));
    ctx.stroke();
  }
  // where it was and where it came to
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = rgba(pal.ink3, 0.9);
  ctx.beginPath();
  ctx.moveTo(x0, low);
  ctx.lineTo(x1 + 8, low);
  ctx.stroke();
  const reached = smooth((drawn - 0.8) / 0.2);
  if (reached > 0) {
    ctx.strokeStyle = rgba(pal.emerald, reached);
    ctx.beginPath();
    ctx.moveTo(x0, high);
    ctx.lineTo(x1 + 8, high);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // the price
  ctx.beginPath();
  const n = 120;
  for (let i = 0; i <= n * drawn; i++) {
    const u = i / n;
    if (i === 0) ctx.moveTo(lerp(x0, x1, u), y(u));
    else ctx.lineTo(lerp(x0, x1, u), y(u));
  }
  ctx.lineJoin = "round";
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(pal.accent, 1);
  ctx.stroke();
  const hx = lerp(x0, x1, drawn);
  const hy = y(drawn);
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 16);
  g.addColorStop(0, rgba(pal.accent, 0.8));
  g.addColorStop(1, rgba(pal.accent, 0));
  ctx.fillStyle = g;
  ctx.fillRect(hx - 16, hy - 16, 32, 32);
  ctx.fillStyle = rgba(pal.ink, 1);
  ctx.beginPath();
  ctx.arc(hx, hy, 3, 0, TAU);
  ctx.fill();
  // the move, bracketed
  if (reached > 0) {
    const bx = x1 + 16;
    ctx.globalAlpha = a * reached;
    ctx.strokeStyle = rgba(pal.emerald, 1);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx - 5, high);
    ctx.lineTo(bx, high);
    ctx.lineTo(bx, low);
    ctx.lineTo(bx - 5, low);
    ctx.stroke();
    label(f, "1%", bx + 8, (low + high) / 2, pal.emerald, "left");
    ctx.globalAlpha = a;
  }
  caption(f, "THE MARKET MOVES 1%, WITH YOU OR WITHOUT YOU");
};

/** the board with one piece of it carried across to stand beside the stake */
function carried(f: FigureFrame, a: number, q: number, cells: number, share: number, text: string, sub: string) {
  const { ctx, pal } = f;
  ctx.globalAlpha = a;
  const b = board(f);
  const loop = q % 6.5;
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const p = b.at(col, row);
      const mine = col === 0 && row === 9;
      // with a smaller position only the bottom row is held; the rest is put back, one square after another
      const held = cells === 100 || row === 9;
      const back = held ? 0 : smooth((q - 0.3 - (col + row) * 0.05) / 0.4);
      if (mine) square(f, p.x, p.y, b.cell, pal.gold, 0.95, 1);
      else square(f, p.x, p.y, b.cell, held ? pal.accent : pal.ink3, held ? 0.14 : 0.1 * (1 - back), held ? 0.7 : lerp(0.7, 0.22, back));
    }
  }
  // the piece that is 1% of the position: a whole square of a hundred, or a tenth of a square of ten
  const from = b.at(9, cells === 100 ? 0 : 9);
  const to = { x: b.at(0, 9).x - b.cell * 1.5, y: b.at(0, 9).y };
  const pieceH = (b.cell - 3) * share;
  const pulse = 0.6 + 0.4 * Math.sin(q * 5);
  const fly = smooth((loop - 1.4) / 1.3);
  const hold = loop > 2.7 ? 1 : 0;
  // it stays marked where it was taken from
  ctx.fillStyle = rgba(pal.emerald, fly > 0 ? 0.35 : pulse);
  ctx.fillRect(from.x + 1.5, from.y + 1.5 + (b.cell - 3 - pieceH), b.cell - 3, pieceH);
  if (fly > 0) {
    const x = lerp(from.x, to.x, fly);
    const y = lerp(from.y, to.y, fly) - Math.sin(fly * Math.PI) * b.cell * 2.2;
    // the place it is carried to: a square the size of the stake, to measure it against
    square(f, to.x, to.y, b.cell, pal.ink3, 0, 0.8 * fly);
    ctx.fillStyle = rgba(pal.emerald, 0.95);
    ctx.fillRect(x + 1.5, y + 1.5 + (b.cell - 3 - pieceH), b.cell - 3, pieceH);
    if (hold) {
      ctx.strokeStyle = rgba(pal.emerald, 0.6 + 0.4 * pulse);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(to.x - 2, to.y - 2, b.cell * 2.5 + 4, b.cell + 4);
      label(f, sub, to.x + b.cell * 1.25, to.y + b.cell + 14, pal.emerald);
    }
  }
  label(f, text, b.x + b.size / 2, b.y - 12, pal.ink);
}

const measured: Scene = (f, a, q) => {
  carried(f, a, q, 100, 1, "1% OF 100 SQUARES IS 1 SQUARE", "THE SAME");
  caption(f, "1% OF THE POSITION = 1,000 = THE WHOLE STAKE");
};

const eitherWay: Scene = (f, a, q) => {
  const { ctx, w, h, pal } = f;
  ctx.globalAlpha = a;
  const cx = w / 2;
  const py = h * 0.1;
  const len = h * 0.3;
  const v = Math.sin(q * 1.3); // -1 for you, +1 against you
  const ang = v * 0.62;
  const your = clamp(-v);
  const against = clamp(v);
  // the two halves
  ctx.fillStyle = rgba(pal.emerald, 0.04 + your * 0.07);
  ctx.fillRect(8, 8, cx - 12, h - 44);
  ctx.fillStyle = rgba(RED, 0.04 + against * 0.07);
  ctx.fillRect(cx + 4, 8, cx - 12, h - 44);
  // the pendulum: the same move, one way and then the other
  ctx.strokeStyle = rgba(pal.ink3, 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, py, len, Math.PI / 2 - 0.62, Math.PI / 2 + 0.62);
  ctx.stroke();
  const bx = cx + Math.sin(ang) * len;
  const by = py + Math.cos(ang) * len;
  ctx.strokeStyle = rgba(pal.ink2, 1);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx, py);
  ctx.lineTo(bx, by);
  ctx.stroke();
  const tone = v < 0 ? pal.emerald : RED;
  const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 22);
  glow.addColorStop(0, rgba(tone, 0.7));
  glow.addColorStop(1, rgba(tone, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(bx - 22, by - 22, 44, 44);
  ctx.fillStyle = rgba(tone, 1);
  ctx.beginPath();
  ctx.arc(bx, by, 7, 0, TAU);
  ctx.fill();
  label(f, "1%", bx, by - 18, tone);
  // what each side leaves of the stake
  const rx = Math.min(w * 0.1, 40);
  const thick = Math.max(5, h * 0.02);
  const floor = h * 0.74;
  const lx = w * 0.25;
  const rxx = w * 0.75;
  coin(f, lx, floor, rx, thick, pal.gold, 1);
  if (your > 0.02) coin(f, lx, floor - (thick + 2) - (1 - your) * 26, rx, thick, pal.emerald, your);
  // against: the coin goes, and what is left is its outline
  ctx.strokeStyle = rgba(pal.ink3, 0.9);
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.ellipse(rxx, floor, rx, rx * 0.3, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  if (against < 0.98) coin(f, rxx, floor, rx, thick, pal.gold, 1 - against);
  for (let i = 0; i < 14; i++) {
    // it leaves as dust
    const ph = i * 2.4;
    ctx.fillStyle = rgba(RED, against * (0.3 + 0.5 * ((i * 37) % 10) / 10));
    ctx.beginPath();
    ctx.arc(rxx + Math.cos(ph) * rx * (0.3 + against * 1.1), floor - against * (10 + ((i * 53) % 40)) + Math.sin(ph) * 5, 1.6, 0, TAU);
    ctx.fill();
  }
  label(f, "FOR YOU", lx, h * 0.5, pal.emerald);
  label(f, your > 0.5 ? "2,000" : "1,000", lx, floor + thick + rx * 0.3 + 16, pal.ink);
  label(f, "AGAINST YOU", rxx, h * 0.5, RED);
  label(f, against > 0.5 ? "0" : "1,000", rxx, floor + thick + rx * 0.3 + 16, pal.ink);
  caption(f, "SAME MOVE, SAME SIZE, THE OTHER DIRECTION");
};

const smaller: Scene = (f, a, q) => {
  carried(f, a, q, 10, 0.1, "A POSITION OF 10 SQUARES, NOT 100", "A TENTH");
  caption(f, "1% OF 10,000 = 100: A TENTH OF THE STAKE");
};

export const LEVERAGE_SCENES: readonly Scene[] = [stake, controls, market, measured, eitherWay, smaller];

/**
 * The shape of the order-book model on /labs/order-book-3d.
 *
 * It is an ILLUSTRATION. The sizes are made by a seeded generator, so the
 * model is the same on every visit and on every frame, and they are relative
 * heights between 0 and 1: no price, no quantity, no instrument. Nothing here
 * is read from a market.
 *
 * No Three.js here: the server-drawn still and the 3D scene both read it.
 */

export const LEVELS = 10;
const SEED = 777;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type BookSide = {
  /** resting size at each level, nearest the middle first, 0..1 */
  size: number[];
  /** running total out from the middle, 0..1 of the larger side's total */
  depth: number[];
};

export type Book = { bids: BookSide; asks: BookSide };

function build(): Book {
  const rnd = mulberry32(SEED);
  const side = () => Array.from({ length: LEVELS }, (_, i) => Math.min(1, 0.2 + rnd() * 0.46 + i * 0.036));
  const bids = side();
  const asks = side();
  const run = (v: number[]) => {
    let t = 0;
    return v.map((x) => (t += x));
  };
  const rb = run(bids);
  const ra = run(asks);
  const top = Math.max(rb[LEVELS - 1], ra[LEVELS - 1]);
  return { bids: { size: bids, depth: rb.map((x) => x / top) }, asks: { size: asks, depth: ra.map((x) => x / top) } };
}

export const BOOK: Book = build();

/** how many of the nearest asks the example market order takes */
export const SWEEP = 3;

export type Focus = "all" | "bids" | "asks" | "spread" | "depth" | "sweep";

export const STEPS: { key: Focus; label: string; title: string; text: string }[] = [
  { key: "all", label: "Whole book", title: "The whole book", text: "An order book is the list of orders waiting to trade: buyers on one side, sellers on the other, ranked by price. Lower prices are to the left, higher to the right." },
  { key: "bids", label: "Bids", title: "Bids: the buyers", text: "Each bar on the left is one price at which buyers are waiting. Its height is how much is waiting there. The bar nearest the middle is the best bid: the highest price any buyer is offering." },
  { key: "asks", label: "Asks", title: "Asks: the sellers", text: "Each bar on the right is one price at which sellers are waiting. The bar nearest the middle is the best ask: the lowest price any seller will accept." },
  { key: "spread", label: "Spread", title: "The spread", text: "The gap between the best bid and the best ask. Nobody is waiting inside it. Buying at once means paying the ask and selling at once means receiving the bid, so the gap is a cost of trading immediately." },
  { key: "depth", label: "Depth", title: "Depth", text: "The back row adds the bars up, from the middle outwards: how much is waiting at this price or better. A book that rises steeply is deep; a shallow one moves further for the same order." },
  { key: "sweep", label: "A market order", title: "A market order walks the book", text: "A buy order at market takes the nearest asks first. If it is larger than the best ask, it carries on into the next level and the next, at a worse price each time. That difference is slippage." },
];

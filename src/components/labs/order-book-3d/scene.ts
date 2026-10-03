import { AmbientLight, BoxGeometry, BufferAttribute, BufferGeometry, DirectionalLight, DoubleSide, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, Vector3 } from "three";
import { BOOK, LEVELS, SWEEP, type Focus } from "@/components/labs/order-book-3d/book";
import { createStage, isDark, tokens } from "@/components/labs/three/stage";

/**
 * The order-book model, in Three.js. Reached only through a dynamic import
 * from /labs/order-book-3d.
 *
 * Price runs left to right. The front row is what is waiting at each price
 * (bids left, asks right); the back row is the running total out from the
 * middle (depth); the empty strip between the two best prices is the spread.
 *
 * It is an illustration of an idea. The heights come from book.ts, a seeded
 * generator: the same model on every visit, nothing per frame, no prices, no
 * quantities, no instrument. The component labels it so on the canvas itself.
 */

export type BookLabel = { key: string; x: number; y: number; show: boolean };
export type OrderBookScene = {
  focus: (f: Focus) => void;
  refresh: () => void;
  dispose: () => void;
};

const NAMES = { ground: "--paper", ink: "--ink", bid: "--pos", ask: "--neg", gold: "--prestige" } as const;
const FALLBACK = { ground: "#fbfaf6", ink: "#14191d", bid: "#067636", ask: "#a83430", gold: "#b39c6b" };

const W = 0.42; // one price level
const GAP = 0.72; // the spread
const BAR_H = 2.1;
const DEPTH_H = 3.1;
const FRONT = 0.62;
const BACK = -0.72;
const LIFT = -1.25; // the model is centred on its own middle, so it turns about it
const HALF = GAP / 2 + LEVELS * W;

export const BOOK_LABELS = ["bids", "asks", "spread", "depth", "price"] as const;

export function createOrderBook(host: HTMLElement, calm: () => boolean, onLabels: (labels: BookLabel[]) => void): OrderBookScene | null {
  const anchors: Record<(typeof BOOK_LABELS)[number], Vector3> = {
    bids: new Vector3(-(GAP / 2 + LEVELS * W * 0.5), LIFT + BAR_H + 0.25, FRONT),
    asks: new Vector3(GAP / 2 + LEVELS * W * 0.5, LIFT + BAR_H + 0.25, FRONT),
    spread: new Vector3(0, LIFT + 0.05, FRONT + 1.05),
    depth: new Vector3(-(HALF - W), LIFT + DEPTH_H + 0.3, BACK),
    price: new Vector3(HALF - 0.4, LIFT - 0.05, FRONT + 1.05),
  };
  const labels: BookLabel[] = BOOK_LABELS.map((key) => ({ key, x: 0, y: 0, show: true }));
  const at = { x: 0, y: 0, front: false, depth: 0 };

  const stage = createStage(host, {
    fov: 30,
    distance: 13.5,
    yaw: -0.52,
    pitch: 0.4,
    minPitch: 0.04,
    maxPitch: 1.25,
    calm,
    after: () => {
      labels.forEach((l, i) => {
        stage!.place(anchors[BOOK_LABELS[i]], at);
        l.x = at.x;
        l.y = at.y;
        l.show = at.front;
      });
      onLabels(labels);
    },
  });
  if (!stage) return null;

  let pal = tokens(host, NAMES, FALLBACK);
  let now: Focus = "all";

  const ambient = new AmbientLight(0xffffff, 1.9);
  const key = new DirectionalLight(0xffffff, 2.0);
  key.position.set(4, 7, 6);
  stage.scene.add(ambient, key);

  const book = new Group();
  book.position.y = LIFT;
  stage.model.add(book);

  // one unit box standing on the floor, scaled per bar
  const box = new BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const edges = new EdgesGeometry(box);

  const solid = () => new MeshLambertMaterial({ transparent: true });
  const mats = { bid: solid(), ask: solid(), near: solid(), bidDepth: solid(), askDepth: solid() };
  const edgeMat = new LineBasicMaterial({ transparent: true, opacity: 0.4 });
  const edgeDim = new LineBasicMaterial({ transparent: true, opacity: 0.1 });
  const edgeLines: { line: LineSegments; group: keyof typeof mats }[] = [];

  const bar = (x: number, z: number, h: number, dz: number, group: keyof typeof mats) => {
    const m = new Mesh(box, mats[group]);
    m.position.set(x, 0, z);
    m.scale.set(W * 0.86, Math.max(0.02, h), dz);
    const e = new LineSegments(edges, edgeMat);
    e.position.copy(m.position);
    e.scale.copy(m.scale);
    book.add(m, e);
    edgeLines.push({ line: e, group });
  };
  for (let i = 0; i < LEVELS; i++) {
    const x = GAP / 2 + (i + 0.5) * W;
    bar(-x, FRONT, BOOK.bids.size[i] * BAR_H, 0.9, "bid");
    bar(x, FRONT, BOOK.asks.size[i] * BAR_H, 0.9, i < SWEEP ? "near" : "ask");
    bar(-x, BACK, BOOK.bids.depth[i] * DEPTH_H, 1.0, "bidDepth");
    bar(x, BACK, BOOK.asks.depth[i] * DEPTH_H, 1.0, "askDepth");
  }

  // the floor: its edge, the price axis with one tick per level (no values), and the spread
  const floor: number[] = [];
  const ln = (x0: number, z0: number, x1: number, z1: number) => floor.push(x0, 0, z0, x1, 0, z1);
  const zf = FRONT + 0.75;
  const zb = BACK - 0.8;
  ln(-HALF - 0.3, zf, HALF + 0.3, zf);
  ln(-HALF - 0.3, zb, HALF + 0.3, zb);
  ln(-HALF - 0.3, zf, -HALF - 0.3, zb);
  ln(HALF + 0.3, zf, HALF + 0.3, zb);
  for (let i = 0; i < LEVELS; i++) {
    const x = GAP / 2 + (i + 0.5) * W;
    ln(x, zf, x, zf + 0.12);
    ln(-x, zf, -x, zf + 0.12);
  }
  const floorGeo = new BufferGeometry();
  floorGeo.setAttribute("position", new BufferAttribute(new Float32Array(floor), 3));
  const floorMat = new LineBasicMaterial({ transparent: true, opacity: 0.32 });
  book.add(new LineSegments(floorGeo, floorMat));

  const spreadMat = new MeshBasicMaterial({ transparent: true, side: DoubleSide, depthWrite: false });
  const strip = new Mesh(new PlaneGeometry(GAP, zf - zb), spreadMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 0.004, (zf + zb) / 2);
  book.add(strip);
  const bracket: number[] = [];
  const zs = zf + 0.3;
  bracket.push(-GAP / 2, 0, zs, GAP / 2, 0, zs, -GAP / 2, 0, zs - 0.14, -GAP / 2, 0, zs + 0.14, GAP / 2, 0, zs - 0.14, GAP / 2, 0, zs + 0.14);
  const bracketGeo = new BufferGeometry();
  bracketGeo.setAttribute("position", new BufferAttribute(new Float32Array(bracket), 3));
  const bracketMat = new LineBasicMaterial();
  book.add(new LineSegments(bracketGeo, bracketMat));

  const paint = () => {
    const dark = isDark(pal.ground);
    const lit = (g: keyof typeof mats): boolean => {
      switch (now) {
        case "all":
          return true;
        case "bids":
          return g === "bid";
        case "asks":
          return g === "ask" || g === "near";
        case "spread":
          return false;
        case "depth":
          return g === "bidDepth" || g === "askDepth";
        case "sweep":
          return g === "near";
      }
    };
    mats.bid.color.copy(pal.bid);
    mats.ask.color.copy(pal.ask);
    mats.near.color.copy(now === "sweep" ? pal.gold : pal.ask);
    // the running total is the same colour as its side, set back toward the ground
    mats.bidDepth.color.copy(pal.bid).lerp(pal.ground, 0.45);
    mats.askDepth.color.copy(pal.ask).lerp(pal.ground, 0.45);
    (Object.keys(mats) as (keyof typeof mats)[]).forEach((g) => {
      const on = lit(g);
      mats[g].opacity = on ? 1 : 0.14;
      mats[g].depthWrite = on;
    });
    for (const e of edgeLines) e.line.material = lit(e.group) ? edgeMat : edgeDim;
    edgeMat.color.copy(pal.ink);
    edgeDim.color.copy(pal.ink);
    floorMat.color.copy(pal.ink);
    bracketMat.color.copy(pal.gold);
    spreadMat.color.copy(pal.gold);
    spreadMat.opacity = now === "spread" ? 0.5 : 0.16;
    ambient.intensity = dark ? 1.6 : 1.9;
    stage.request();
  };

  paint();
  host.dataset.live = "";

  return {
    focus(f) {
      now = f;
      paint();
    },
    refresh() {
      pal = tokens(host, NAMES, FALLBACK);
      paint();
      stage.prefs();
    },
    dispose() {
      delete host.dataset.live;
      // whichever of the two edge materials no bar is wearing is not in the tree
      edgeMat.dispose();
      edgeDim.dispose();
      stage.dispose();
    },
  };
}

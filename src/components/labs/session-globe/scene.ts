import { BufferAttribute, BufferGeometry, Color, Group, Line, LineBasicMaterial, LineLoop, LineSegments, Mesh, MeshBasicMaterial, Points, PointsMaterial, RingGeometry, SphereGeometry, Vector3 } from "three";
import { DEG, landField, sunAt, unit } from "@/components/labs/market-day/earth";
import { createStage, isDark, tokens } from "@/components/labs/three/stage";

/**
 * The session globe, in Three.js. Reached only through a dynamic import from
 * /labs/session-globe.
 *
 * What is on it, and where each thing comes from:
 *  - the land: the same coarse field of points the 2D globes on this site use
 *    (market-day/earth.ts). Schematic, not a map to navigate by;
 *  - day and night, the line between them and the place where the sun is
 *    overhead: computed from the UTC clock (sunAt), good to about a minute;
 *  - the four session cities at their real coordinates, each marked open or
 *    closed. The component decides that from the clock and the conventional
 *    session windows (lib/sessions) and passes it in; this file knows nothing
 *    about markets;
 *  - a line between two cities whose sessions are open at the same time.
 *
 * No prices, no volumes, no measure of activity.
 */

export type GlobeCity = { key: string; name: string; lat: number; lon: number };
export type GlobeLabel = { key: string; x: number; y: number; show: boolean };

export type SessionGlobe = {
  /** set the instant and which cities' sessions are open */
  set: (ms: number, open: ReadonlySet<string>) => void;
  /** turn the globe so that a place faces the viewer */
  face: (lat: number, lon: number) => void;
  /** re-read colours and the motion preference */
  refresh: () => void;
  dispose: () => void;
};

const NAMES = { ground: "--paper", ink: "--ink", dim: "--ink-3", open: "--pos", gold: "--prestige", accent: "--accent" } as const;
const FALLBACK = { ground: "#fbfaf6", ink: "#14191d", dim: "#626b73", open: "#067636", gold: "#b39c6b", accent: "#0868aa" };

/** a ring is made facing +z */
const OUT = new Vector3(0, 0, 1);
const yawFor = (lon: number) => -lon * DEG;
const pitchFor = (lat: number) => Math.max(-1.1, Math.min(1.1, lat * DEG * 0.8));

export function createSessionGlobe(
  host: HTMLElement,
  cities: readonly GlobeCity[],
  start: { lat: number; lon: number },
  calm: () => boolean,
  onLabels: (labels: GlobeLabel[]) => void,
): SessionGlobe | null {
  const labels: GlobeLabel[] = [...cities.map((c) => ({ key: c.key, x: 0, y: 0, show: false })), { key: "sun", x: 0, y: 0, show: false }];
  const at = { x: 0, y: 0, front: false, depth: 0 };
  const cityAt = cities.map((c) => new Vector3(...unit(c.lat, c.lon)).multiplyScalar(1.03));
  const sunAtV = new Vector3(0, 0, 1);

  const stage = createStage(host, {
    fov: 32,
    distance: 4.3,
    yaw: yawFor(start.lon),
    pitch: pitchFor(start.lat),
    minPitch: -1.2,
    maxPitch: 1.2,
    idle: 0.035, // one turn in three minutes, until the visitor takes it
    calm,
    after: () => {
      const limb = 1 / stage!.camera.position.z + 0.04;
      cityAt.forEach((v, i) => {
        stage!.place(v, at);
        labels[i].x = at.x;
        labels[i].y = at.y;
        labels[i].show = at.depth > limb;
      });
      stage!.place(sunAtV, at);
      const s = labels[labels.length - 1];
      s.x = at.x;
      s.y = at.y;
      s.show = at.depth > limb;
      onLabels(labels);
    },
  });
  if (!stage) return null;

  let pal = tokens(host, NAMES, FALLBACK);
  let sun = sunAt(Date.now());
  let openNow: ReadonlySet<string> = new Set();

  /* ── the sphere: sea, shaded by the sun ─────────────────────────────── */
  const seaGeo = new SphereGeometry(1, 64, 40);
  const seaPos = seaGeo.getAttribute("position");
  const seaCol = new BufferAttribute(new Float32Array(seaPos.count * 3), 3);
  seaGeo.setAttribute("color", seaCol);
  const sea = new Mesh(seaGeo, new MeshBasicMaterial({ vertexColors: true }));
  stage.model.add(sea);

  /* ── the land: a field of points ────────────────────────────────────── */
  const land = landField(2.5);
  const landGeo = new BufferGeometry();
  const landPos = new Float32Array(land.length);
  for (let i = 0; i < land.length; i++) landPos[i] = land[i] * 1.004;
  landGeo.setAttribute("position", new BufferAttribute(landPos, 3));
  const landCol = new BufferAttribute(new Float32Array(land.length), 3);
  landGeo.setAttribute("color", landCol);
  const landPts = new Points(landGeo, new PointsMaterial({ size: 0.015, sizeAttenuation: true, vertexColors: true }));
  stage.model.add(landPts);

  /* ── the graticule: the equator and a meridian every 30 degrees ─────── */
  const grat: number[] = [];
  const seg = (lat0: number, lon0: number, lat1: number, lon1: number) => {
    grat.push(...unit(lat0, lon0).map((n) => n * 1.002), ...unit(lat1, lon1).map((n) => n * 1.002));
  };
  for (let lon = -180; lon < 180; lon += 30) for (let lat = -80; lat < 80; lat += 5) seg(lat, lon, lat + 5, lon);
  for (const lat of [-60, -30, 0, 30, 60]) for (let lon = -180; lon < 180; lon += 5) seg(lat, lon, lat, lon + 5);
  const gratGeo = new BufferGeometry();
  gratGeo.setAttribute("position", new BufferAttribute(new Float32Array(grat), 3));
  const gratMat = new LineBasicMaterial({ transparent: true, opacity: 0.16 });
  stage.model.add(new LineSegments(gratGeo, gratMat));

  /* ── the terminator and the sub-solar point ─────────────────────────── */
  const TERM = 128;
  const termGeo = new BufferGeometry();
  const termPos = new BufferAttribute(new Float32Array(TERM * 3), 3);
  termGeo.setAttribute("position", termPos);
  const termMat = new LineBasicMaterial();
  stage.model.add(new LineLoop(termGeo, termMat));
  const sunMat = new MeshBasicMaterial();
  const sunDot = new Mesh(new SphereGeometry(0.022, 16, 12), sunMat);
  const sunRing = new Mesh(new RingGeometry(0.042, 0.05, 32), sunMat);
  const sunMark = new Group();
  sunMark.add(sunDot, sunRing);
  stage.model.add(sunMark);

  /* ── the session cities: a filled lamp with a ring when open, a hollow ring when closed ── */
  const openMat = new MeshBasicMaterial();
  const closedMat = new MeshBasicMaterial();
  const lampGeo = new SphereGeometry(0.03, 20, 14);
  const ringGeo = new RingGeometry(0.05, 0.062, 40);
  const hollowGeo = new RingGeometry(0.026, 0.036, 32);
  const marks = cities.map((c) => {
    const g = new Group();
    const n = new Vector3(...unit(c.lat, c.lon));
    g.position.copy(n).multiplyScalar(1.012);
    g.quaternion.setFromUnitVectors(OUT, n); // rings lie on the surface, facing out
    const lamp = new Mesh(lampGeo, openMat);
    const ring = new Mesh(ringGeo, openMat);
    const hollow = new Mesh(hollowGeo, closedMat);
    g.add(lamp, ring, hollow);
    stage.model.add(g);
    return { key: c.key, n, lamp, ring, hollow };
  });

  /* ── a line between two open sessions ───────────────────────────────── */
  const arcs = new Group();
  stage.model.add(arcs);
  const arcMat = new LineBasicMaterial({ transparent: true, opacity: 0.85 });
  const drawArcs = () => {
    for (const child of [...arcs.children]) {
      arcs.remove(child);
      (child as Line).geometry.dispose();
    }
    const open = marks.filter((m) => openNow.has(m.key));
    for (let i = 0; i < open.length; i++)
      for (let j = i + 1; j < open.length; j++) {
        const a = open[i].n;
        const b = open[j].n;
        const omega = Math.acos(Math.max(-1, Math.min(1, a.dot(b))));
        if (omega < 0.01) continue;
        const pts: number[] = [];
        for (let k = 0; k <= 48; k++) {
          const u = k / 48;
          const sa = Math.sin((1 - u) * omega) / Math.sin(omega);
          const sb = Math.sin(u * omega) / Math.sin(omega);
          const lift = 1.014 + Math.sin(u * Math.PI) * 0.16 * Math.min(1, omega);
          pts.push((a.x * sa + b.x * sb) * lift, (a.y * sa + b.y * sb) * lift, (a.z * sa + b.z * sb) * lift);
        }
        const g = new BufferGeometry();
        g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
        arcs.add(new Line(g, arcMat));
      }
  };

  /* ── painting: colours and the sun ──────────────────────────────────── */
  const mixed = new Color();
  const paint = () => {
    const dark = isDark(pal.ground);
    // the lit side is the lighter of the two in both themes
    const day = pal.ground.clone().lerp(dark ? pal.ink : pal.accent, dark ? 0.2 : 0.07);
    const night = dark ? pal.ground.clone().multiplyScalar(0.5) : pal.ground.clone().lerp(pal.ink, 0.3);
    const landDay = day.clone().lerp(pal.ink, 0.82);
    const landNight = night.clone().lerp(pal.ink, 0.4);
    const shade = (x: number, y: number, z: number) => {
      const d = x * sun.x + y * sun.y + z * sun.z;
      // civil twilight is about six degrees wide: a short soft edge, not a hard one
      const t = Math.max(0, Math.min(1, (d + 0.1) / 0.2));
      return t * t * (3 - 2 * t);
    };
    for (let i = 0; i < seaPos.count; i++) {
      mixed.copy(night).lerp(day, shade(seaPos.getX(i), seaPos.getY(i), seaPos.getZ(i)));
      seaCol.setXYZ(i, mixed.r, mixed.g, mixed.b);
    }
    seaCol.needsUpdate = true;
    for (let i = 0; i < land.length; i += 3) {
      mixed.copy(landNight).lerp(landDay, shade(land[i], land[i + 1], land[i + 2]));
      landCol.setXYZ(i / 3, mixed.r, mixed.g, mixed.b);
    }
    landCol.needsUpdate = true;

    // the terminator: the great circle a quarter turn from the sun
    const s = new Vector3(sun.x, sun.y, sun.z);
    const u = new Vector3(0, 1, 0).cross(s).normalize();
    const v = s.clone().cross(u).normalize();
    for (let i = 0; i < TERM; i++) {
      const a = (i / TERM) * Math.PI * 2;
      termPos.setXYZ(i, (u.x * Math.cos(a) + v.x * Math.sin(a)) * 1.006, (u.y * Math.cos(a) + v.y * Math.sin(a)) * 1.006, (u.z * Math.cos(a) + v.z * Math.sin(a)) * 1.006);
    }
    termPos.needsUpdate = true;
    sunAtV.copy(s).multiplyScalar(1.03);
    sunMark.position.copy(s).multiplyScalar(1.012);
    sunMark.quaternion.setFromUnitVectors(OUT, s);

    gratMat.color.copy(pal.ink);
    termMat.color.copy(pal.gold);
    sunMat.color.copy(pal.gold);
    openMat.color.copy(pal.open);
    closedMat.color.copy(dark ? pal.ink : pal.dim);
    arcMat.color.copy(pal.open);
    for (const m of marks) {
      const on = openNow.has(m.key);
      m.lamp.visible = on;
      m.ring.visible = on;
      m.hollow.visible = !on;
    }
    stage.request();
  };

  paint();
  host.dataset.live = "";

  return {
    set(ms, open) {
      sun = sunAt(ms);
      const changed = open.size !== openNow.size || [...open].some((k) => !openNow.has(k));
      openNow = new Set(open);
      if (changed) drawArcs();
      paint();
    },
    face(lat, lon) {
      stage.face(yawFor(lon), pitchFor(lat));
    },
    refresh() {
      pal = tokens(host, NAMES, FALLBACK);
      paint();
      stage.prefs();
    },
    dispose() {
      delete host.dataset.live;
      stage.dispose();
    },
  };
}

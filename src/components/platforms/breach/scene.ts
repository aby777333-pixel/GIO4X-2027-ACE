import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  FogExp2,
  Group,
  LinearSRGBColorSpace,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

/** What the runner in RaptorBreach.tsx drives. */
export type BreachScene = {
  /** Draw one frame. `seconds` is elapsed animation time; it never runs backwards and does not move while paused. */
  frame: (seconds: number) => void;
  /** The stage's new size in CSS pixels, plus the backing-store ratio. */
  resize: (width: number, height: number, dpr: number) => void;
  /** Release the GPU resources and hand the WebGL context back. */
  dispose: () => void;
};

/**
 * "THE BREACH", the owner's own CodePen, as ported for the 777 Raptor site
 * (breach-backdrop.tsx there) and brought here unchanged in its drawing: a
 * dark, unstable orb leaking light through moving fissures, plasma jets and
 * orbiting streams, accelerating until it implodes, blacks out and detonates
 * into a prismatic supernova, out of which the 777 Raptor logo is born
 * white-hot, cools, and flies out of the screen at the viewer. Then the stage
 * closes to black and the orb starts again.
 *
 * The orb's shaders, cores, coronas, rays, spirals, starfield, particle
 * counts, palette, shockwaves and timeline are the pen's, values included.
 * What the port changed, and why, is recorded in the Raptor site's
 * DECISIONS.md (48): it loops instead of offering REPLAY, draws no text, and
 * computes the explosion from time so eighty thousand points cost nothing per
 * frame.
 *
 * This file is the only place Three.js is imported. It is loaded on demand by
 * RaptorBreach.tsx, so no other page pays for it. The layers above the canvas
 * (haze, flash, curtain, logo) are styled in src/styles/breach.css, driven by
 * the data-phase and data-haze attributes and the --breach-x property that
 * this scene writes on its host.
 */

/** Pen timeline, seconds into a lap. */
const IMPLODE_AT = 7.55;
const BLACKOUT_AT = 8.28;
const DETONATE_AT = 8.39;
/** After detonation. */
const LOGO_AT = 0.72;
/** The logo grows in to full size, without overshoot; matches `breach-logo-birth`. */
const LOGO_BIRTH_SECONDS = 1.2;
/** Then holds perfectly still while it finishes cooling; birth + hold matches `breach-logo-cool`. */
const LOGO_STEADY_SECONDS = 2;
/** The zoom out of the screen at the viewer; matches `breach-logo-zoom`. */
const ZOOM_SECONDS = 0.45;
/** The supernova's afterglow, logo gone, before the close to black. */
const AFTERGLOW_SECONDS = 1.2;
const COVER_SECONDS = 2;
const ZOOM_AT = DETONATE_AT + LOGO_AT + LOGO_BIRTH_SECONDS + LOGO_STEADY_SECONDS;
const LAP = ZOOM_AT + ZOOM_SECONDS + AFTERGLOW_SECONDS + COVER_SECONDS;

/** From this band width the copy leaves room on the right. Tailwind's `lg`. */
const WIDE_FROM = 1024;
const WIDE_CENTRE_X = 0.72;

/** The pen's colours are r128 values: take them as given, no colour management. */
const raw = (hex: number) => new Color().setHex(hex, LinearSRGBColorSpace);

function randomDirection() {
  const z = Math.random() * 2 - 1;
  const theta = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new Vector3(r * Math.cos(theta), r * Math.sin(theta), z);
}

/**
 * Distance factor for a cloud whose velocity is damped by `perFrame` every
 * 1/60 s: position = velocity × this, after `elapsed` seconds.
 */
function flight(elapsed: number, perFrame: number) {
  return (1 - Math.pow(perFrame, elapsed * 60)) / (60 * (1 - perFrame));
}

const NOISE = `
  float hash(vec3 p) {
    p = fract(p * .3183099 + vec3(.11,.17,.23));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
`;

const ORB_VERTEX = `
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform float uTime;
  uniform float uChaos;
  ${NOISE}
  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    float n1 = noise(position * 2.3 + uTime * .22);
    float n2 = noise(position * 6.7 - uTime * .55);
    float n3 = noise(position * 15.0 + uTime * 1.1);
    float deformation = (n1 * .105 + n2 * .047 + n3 * .014) * (1.0 + uChaos * 3.2);
    vec3 displaced = position + normal * deformation;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const ORB_FRAGMENT = `
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform float uTime;
  uniform float uEnergy;
  ${NOISE.replace("vec3(.11,.17,.23)", "vec3(.13,.19,.27)")}
  float fbm(vec3 p) {
    float value = 0.0;
    float amp = .5;
    for (int i = 0; i < 5; i++) {
      value += amp * noise(p);
      p *= 2.03;
      amp *= .5;
    }
    return value;
  }
  void main() {
    float plasma = fbm(vPosition * 3.2 + vec3(uTime * .15, -uTime * .1, uTime * .12));
    float fine = fbm(vPosition * 10.0 - vec3(uTime * .3, 0.0, uTime * .22));

    vec3 blackBlue = vec3(.001, .003, .018);
    vec3 navy = vec3(.004, .018, .12);
    vec3 cobalt = vec3(.012, .07, .42);
    vec3 blue = vec3(.01, .27, .85);
    vec3 violet = vec3(.26, .015, .65);
    vec3 crimson = vec3(.55, .005, .045);

    vec3 color = mix(blackBlue, navy, smoothstep(.2, .7, plasma));
    color = mix(color, cobalt, smoothstep(.48, .78, plasma) * .7);

    float crackNoise = fbm(vPosition * 7.5 + vec3(uTime * .12, -uTime * .18, uTime * .09));
    float crackPattern = abs(sin(crackNoise * 24.0 + fine * 5.0));
    float cracks = 1.0 - smoothstep(.035, .14, crackPattern);
    float fracture2 = abs(sin((fine + plasma * .6) * 35.0 - uTime * .7));
    fracture2 = 1.0 - smoothstep(.025, .09, fracture2);
    cracks = max(cracks, fracture2 * .65);

    float colorShift = sin(vPosition.y * 8.0 + vPosition.x * 5.0 + uTime * 1.4) * .5 + .5;
    vec3 leakBlue = vec3(.015, .42, 1.0);
    vec3 leakCyan = vec3(.04, .85, 1.0);
    vec3 leakViolet = vec3(.55, .08, 1.0);
    vec3 leakColor = mix(leakBlue, leakCyan, colorShift);
    leakColor = mix(leakColor, leakViolet, sin(vPosition.z * 10.0 - uTime) * .25 + .25);
    vec3 silverBlue = vec3(.72, .86, 1.0);
    leakColor = mix(leakColor, silverBlue, cracks * uEnergy * .28);
    color += leakColor * cracks * (.65 + uEnergy * 2.3);

    color += blue * smoothstep(.72, .94, plasma) * .28;
    float purpleFlow = sin(vPosition.x * 9.0 + vPosition.z * 7.0 - uTime * 1.4) * .5 + .5;
    color += violet * purpleFlow * .13;
    float redFlow = sin(vPosition.y * 12.0 - uTime * 1.8) * .5 + .5;
    color += crimson * redFlow * .09;

    float rim = pow(1.0 - abs(dot(normalize(vNormal), vec3(0, 0, 1))), 2.8);
    color += rim * vec3(.015, .15, .75) * (.25 + uEnergy * .45);

    gl_FragColor = vec4(color * (1.0 + uEnergy * .5), 1.0);
  }
`;

const CORONA_VERTEX = `
  varying vec3 n;
  void main() {
    n = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CORONA_FRAGMENT = `
  varying vec3 n;
  uniform vec3 glowColor;
  uniform float strength;
  void main() {
    float glow = pow(max(0.0, .72 - dot(n, vec3(0,0,1))), 2.5);
    gl_FragColor = vec4(glowColor, glow * strength);
  }
`;

/** The pen's supernova palette, and its weighting: silver/blue/violet dominant, red secondary, gold rare. */
const PALETTE: readonly (readonly [number, number, number])[] = [
  [0.55, 0.62, 0.72],
  [0.72, 0.78, 0.88],
  [0.88, 0.93, 1.0],
  [0.45, 0.72, 1.0],
  [0.05, 0.82, 1.0],
  [0.02, 0.45, 1.0],
  [0.02, 0.15, 0.9],
  [0.05, 0.06, 0.65],
  [0.28, 0.02, 1.0],
  [0.52, 0.02, 0.95],
  [0.72, 0.02, 0.88],
  [1.0, 0.02, 0.62],
  [1.0, 0.04, 0.3],
  [1.0, 0.015, 0.08],
  [0.62, 0.004, 0.02],
  [1.0, 0.38, 0.03],
  [1.0, 0.62, 0.08],
];

function explosionColor() {
  const chance = Math.random();
  let index: number;
  if (chance < 0.2) index = Math.floor(Math.random() * 3);
  else if (chance < 0.55) index = 3 + Math.floor(Math.random() * 5);
  else if (chance < 0.8) index = 8 + Math.floor(Math.random() * 3);
  else if (chance < 0.97) index = 11 + Math.floor(Math.random() * 4);
  else index = 15 + Math.floor(Math.random() * 2);
  return PALETTE[index];
}

export function createBreach(canvas: HTMLCanvasElement, host: HTMLElement): BreachScene | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 1);

  const flash = host.querySelector<HTMLElement>("[data-breach-flash]");

  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(thing: T) => {
    disposables.push(thing);
    return thing;
  };

  const bandWidth = host.clientWidth || 1200;
  const scene = new Scene();
  scene.background = new Color(0x000000);
  scene.fog = new FogExp2(0x000000, 0.009);

  const camera = new PerspectiveCamera(58, 1, 0.1, 2000);
  camera.position.set(0, 0, 12);

  // STARFIELD
  const STAR_COUNT = bandWidth < 700 ? 1600 : 4500;
  const starPositions = new Float32Array(STAR_COUNT * 3);
  const starColors = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const dir = randomDirection();
    const distance = 50 + Math.random() * 650;
    starPositions.set([dir.x * distance, dir.y * distance, dir.z * distance], i * 3);
    const choice = Math.random();
    if (choice < 0.12) starColors.set([0.45, 0.65, 1], i * 3);
    else if (choice < 0.18) starColors.set([0.75, 0.45, 1], i * 3);
    else {
      const b = 0.4 + Math.random() * 0.45;
      starColors.set([b, b, b], i * 3);
    }
  }
  const starsGeometry = keep(new BufferGeometry());
  starsGeometry.setAttribute("position", new BufferAttribute(starPositions, 3));
  starsGeometry.setAttribute("color", new BufferAttribute(starColors, 3));
  const starsMaterial = keep(new PointsMaterial({ size: 0.34, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false }));
  const stars = new Points(starsGeometry, starsMaterial);
  scene.add(stars);

  // ORB
  const orbMaterial = keep(
    new ShaderMaterial({
      vertexShader: ORB_VERTEX,
      fragmentShader: ORB_FRAGMENT,
      uniforms: { uTime: { value: 0 }, uChaos: { value: 0 }, uEnergy: { value: 0 } },
    }),
  );
  const orb = new Mesh(keep(new SphereGeometry(1.45, 96, 96)), orbMaterial);
  scene.add(orb);

  const additive = (color: number, opacity: number) => keep(new MeshBasicMaterial({ color: raw(color), transparent: true, opacity, blending: AdditiveBlending, depthWrite: false }));

  const innerCoreMaterial = additive(0x167dff, 0.26);
  const innerCore = new Mesh(keep(new SphereGeometry(1.27, 64, 64)), innerCoreMaterial);
  scene.add(innerCore);
  const violetCoreMaterial = additive(0x7528ff, 0.16);
  const violetCore = new Mesh(keep(new SphereGeometry(1.12, 48, 48)), violetCoreMaterial);
  scene.add(violetCore);

  // LIGHT LEAK JETS
  const leakGroup = new Group();
  scene.add(leakGroup);
  const LEAK_COLORS = [0x168cff, 0x28dfff, 0x4169ff, 0x6a2cff, 0xa32cff, 0xff285f];
  const leakRays = Array.from({ length: 28 }, () => {
    const length = 0.8 + Math.random() * 2.2;
    const width = 0.018 + Math.random() * 0.05;
    const geometry = keep(new ConeGeometry(width, length, 8, 1, true));
    geometry.translate(0, length / 2, 0);
    const material = keep(
      new MeshBasicMaterial({
        color: raw(LEAK_COLORS[Math.floor(Math.random() * LEAK_COLORS.length)]),
        transparent: true,
        opacity: 0.15,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    const ray = new Mesh(geometry, material);
    const direction = randomDirection();
    ray.position.copy(direction.clone().multiplyScalar(1.28));
    ray.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);
    leakGroup.add(ray);
    return {
      ray,
      material,
      baseOpacity: 0.08 + Math.random() * 0.18,
      pulseSpeed: 2 + Math.random() * 7,
      phase: Math.random() * Math.PI * 2,
      originalScale: 0.65 + Math.random() * 0.7,
    };
  });

  // CORONAS
  const makeCorona = (color: number, scale: number, opacity: number) => {
    const material = keep(
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: BackSide,
        uniforms: { glowColor: { value: raw(color) }, strength: { value: opacity } },
        vertexShader: CORONA_VERTEX,
        fragmentShader: CORONA_FRAGMENT,
      }),
    );
    const corona = new Mesh(keep(new SphereGeometry(1.5, 64, 64)), material);
    corona.scale.setScalar(scale);
    scene.add(corona);
    return corona;
  };
  const coronaBlue = makeCorona(0x087cff, 1.23, 0.72);
  const coronaViolet = makeCorona(0x6028ff, 1.52, 0.28);
  const coronaPurple = makeCorona(0xbb20ff, 1.95, 0.075);

  // ORBITING PLASMA STREAMS
  const spiralGroup = new Group();
  scene.add(spiralGroup);
  const makeSpiral = (radius: number, color: number, tilt: number, count: number) => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const disturbance = Math.sin(a * 7) * 0.1 + Math.sin(a * 17) * 0.035 + (Math.random() - 0.5) * 0.08;
      const r = radius + disturbance;
      positions.set([Math.cos(a) * r, Math.sin(a) * r, Math.sin(a * 3) * 0.24 + (Math.random() - 0.5) * 0.09], i * 3);
    }
    const geometry = keep(new BufferGeometry());
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    const spiral = new Points(geometry, keep(new PointsMaterial({ color: raw(color), size: 0.038, transparent: true, opacity: 0.62, blending: AdditiveBlending, depthWrite: false })));
    spiral.rotation.x = tilt;
    spiral.rotation.y = Math.random() * Math.PI;
    spiralGroup.add(spiral);
    return spiral;
  };
  const spirals = [
    makeSpiral(1.95, 0x16dfff, 0.2, 900),
    makeSpiral(2.25, 0x168cff, 0.7, 1000),
    makeSpiral(2.55, 0x4255ff, 1.15, 1100),
    makeSpiral(2.85, 0x7928ff, 1.65, 1200),
    makeSpiral(3.15, 0xc525ff, 2.1, 1100),
    makeSpiral(3.45, 0xff174f, 0.48, 950),
  ];
  const spiralTilts = spirals.map((s) => s.rotation.y);

  /**
   * A particle cloud whose vertex positions are its velocities: placed each
   * frame by scaling the whole cloud by `flight(elapsed, damping)`.
   */
  const makeCloud = (count: number, size: number, fill: (i: number, velocity: Float32Array, color: Float32Array) => void) => {
    const velocity = new Float32Array(count * 3);
    const color = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) fill(i, velocity, color);
    const geometry = keep(new BufferGeometry());
    geometry.setAttribute("position", new BufferAttribute(velocity, 3));
    geometry.setAttribute("color", new BufferAttribute(color, 3));
    const material = keep(new PointsMaterial({ size, vertexColors: true, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.visible = false;
    scene.add(points);
    return { points, material };
  };

  // SUPERNOVA PARTICLES
  const PARTICLE_COUNT = bandWidth < 650 ? 18000 : bandWidth < 1100 ? 40000 : 80000;
  const explosion = makeCloud(PARTICLE_COUNT, 0.055, (i, velocity, color) => {
    const direction = randomDirection();
    const kind = Math.random();
    const speed = kind < 0.035 ? 28 + Math.random() * 32 : kind < 0.18 ? 15 + Math.random() * 17 : kind < 0.55 ? 7 + Math.random() * 11 : 2 + Math.random() * 7;
    direction.x *= 0.85 + Math.random() * 0.35;
    direction.y *= 0.85 + Math.random() * 0.35;
    direction.z *= 0.85 + Math.random() * 0.45;
    direction.normalize().multiplyScalar(speed);
    velocity.set([direction.x, direction.y, direction.z], i * 3);
    const c = explosionColor();
    const brightness = 0.7 + Math.random() * 0.35;
    color.set([Math.min(1, c[0] * brightness), Math.min(1, c[1] * brightness), Math.min(1, c[2] * brightness)], i * 3);
  });

  // LARGE DEBRIS
  const debris = makeCloud(bandWidth < 700 ? 1000 : 5000, 0.13, (i, velocity, color) => {
    const dir = randomDirection().multiplyScalar(2 + Math.random() * 11);
    velocity.set([dir.x, dir.y, dir.z], i * 3);
    const c = explosionColor();
    color.set([c[0], c[1], c[2]], i * 3);
  });

  // POLAR JETS
  const jets = makeCloud(bandWidth < 700 ? 1500 : 6000, 0.06, (i, velocity, color) => {
    const side = Math.random() < 0.5 ? -1 : 1;
    const dir = new Vector3((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.18, side * (0.9 + Math.random() * 0.2)).normalize().multiplyScalar(20 + Math.random() * 28);
    velocity.set([dir.x, dir.y, dir.z], i * 3);
    const choice = Math.random();
    color.set(choice < 0.4 ? [0.7, 0.85, 1] : choice < 0.75 ? [0.08, 0.45, 1] : [0.5, 0.05, 1], i * 3);
  });

  // SHOCKWAVES — [delay, growth, starting opacity, fade rate], the pen's.
  const WAVES: readonly [number, number, number, number, number][] = [
    [0xd8eaff, 0, 17, 0.95, 0.8],
    [0x29dfff, 0.04, 14, 0.8, 0.55],
    [0x176cff, 0.09, 11, 0.7, 0.4],
    [0x7028ff, 0.16, 8, 0.55, 0.3],
    [0xff174f, 0.24, 5, 0.32, 0.17],
  ];
  const ringGeometry = keep(new RingGeometry(0.96, 1, 256));
  const waves = WAVES.map(([color, delay, growth, start, fade]) => {
    const material = keep(new MeshBasicMaterial({ color: raw(color), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
    const mesh = new Mesh(ringGeometry, material);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, material, delay, growth, start, fade };
  });

  const preExplosion = [orb, innerCore, violetCore, coronaBlue, coronaViolet, coronaPurple, leakGroup, spiralGroup];
  const postExplosion = [explosion.points, debris.points, jets.points, ...waves.map((w) => w.mesh)];

  let width = 1;
  let height = 1;
  let lap = -1;
  let last = -1;
  let phase = "";
  let haze = false;

  const setPhase = (next: string) => {
    if (next === phase) return;
    phase = next;
    host.dataset.phase = next;
  };
  const setHaze = (on: boolean) => {
    if (on === haze) return;
    haze = on;
    host.dataset.haze = on ? "on" : "off";
  };

  const applyView = () => {
    camera.aspect = width / height;
    if (width >= WIDE_FROM) camera.setViewOffset(width, height, width * (0.5 - WIDE_CENTRE_X), 0, width, height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    host.style.setProperty("--breach-x", `${width >= WIDE_FROM ? width * WIDE_CENTRE_X : width / 2}px`);
  };

  /** Back to a quiet orb, under the closed band, for the next lap. */
  const resetLap = () => {
    orb.rotation.set(0, 0, 0);
    innerCore.rotation.set(0, 0, 0);
    violetCore.rotation.set(0, 0, 0);
    leakGroup.rotation.set(0, 0, 0);
    spiralGroup.rotation.set(0, 0, 0);
    spirals.forEach((spiral, i) => {
      spiral.rotation.z = 0;
      spiral.rotation.y = spiralTilts[i];
    });
    for (const part of [orb, innerCore, violetCore, leakGroup, spiralGroup]) part.scale.setScalar(1);
    camera.position.set(0, 0, 12);
  };

  /** The pen's pre-explosion animation at lap time `t`, advanced by `dt`. */
  const buildUp = (t: number, dt: number) => {
    const instability = MathUtils.clamp((t - 1.2) / 6.3, 0, 1);
    orbMaterial.uniforms.uTime.value = t;
    orbMaterial.uniforms.uChaos.value = instability;
    orbMaterial.uniforms.uEnergy.value = instability;

    let pulseSpeed = 1.7;
    if (t > 2) pulseSpeed = 2.6;
    if (t > 3.5) pulseSpeed = 4.2;
    if (t > 5) pulseSpeed = 7;
    if (t > 6.2) pulseSpeed = 13;
    if (t > 7) pulseSpeed = 23;
    const pulse = Math.sin(t * pulseSpeed);

    orb.scale.setScalar(1 + pulse * (0.015 + instability * 0.075));
    innerCore.scale.setScalar(0.98 + pulse * (0.025 + instability * 0.1));
    violetCore.scale.setScalar(0.95 - pulse * (0.02 + instability * 0.07));
    innerCoreMaterial.opacity = 0.16 + instability * 0.35 + Math.max(0, pulse) * 0.15;
    violetCoreMaterial.opacity = 0.1 + instability * 0.25;
    coronaBlue.scale.setScalar(1.23 + pulse * (0.025 + instability * 0.08));
    coronaViolet.scale.setScalar(1.52 + pulse * (0.04 + instability * 0.13));
    coronaPurple.scale.setScalar(1.95 + pulse * (0.07 + instability * 0.2));

    const spin = 0.08 + Math.pow(instability, 2.5) * 7.5;
    orb.rotation.y += dt * spin;
    orb.rotation.x += dt * spin * 0.17;
    innerCore.rotation.y -= dt * spin * 0.7;
    violetCore.rotation.x += dt * spin * 0.45;

    leakGroup.rotation.y += dt * (0.05 + instability * 3);
    leakGroup.rotation.z += dt * (0.02 + instability * 1.4);
    for (const leak of leakRays) {
      const flicker = Math.sin(t * leak.pulseSpeed + leak.phase) * 0.5 + 0.5;
      leak.material.opacity = leak.baseOpacity * (0.25 + instability * 2.6) * (0.35 + flicker);
      const rayScale = leak.originalScale * (0.35 + instability * 1.4 + flicker * instability * 0.65);
      leak.ray.scale.set(0.7 + instability * 0.5, rayScale, 0.7 + instability * 0.5);
    }

    spiralGroup.rotation.y += dt * (0.08 + instability * 5.5);
    spiralGroup.rotation.z += dt * (0.025 + instability * 2.8);
    spirals.forEach((spiral, index) => {
      spiral.rotation.z += dt * (0.08 + instability * (1.2 + index * 0.6));
    });

    camera.position.set(0, 0, 12 - instability * 1.55);
    setHaze(t > 4.5);
    if (t > 5.4) {
      const shake = Math.min(0.15, (t - 5.4) * 0.03);
      camera.position.x = (Math.random() - 0.5) * shake;
      camera.position.y = (Math.random() - 0.5) * shake;
    }

    if (t > IMPLODE_AT) {
      const progress = MathUtils.clamp((t - IMPLODE_AT) / (BLACKOUT_AT - IMPLODE_AT), 0, 1);
      const collapse = Math.max(0.002, 1 - Math.pow(progress, 2.85) * 0.998);
      for (const part of [orb, innerCore, violetCore, leakGroup, spiralGroup]) part.scale.setScalar(collapse);
      coronaBlue.scale.setScalar(collapse * 1.23);
      coronaViolet.scale.setScalar(collapse * 1.52);
      coronaPurple.scale.setScalar(collapse * 1.95);
      orbMaterial.uniforms.uEnergy.value = 1 + progress * 4;
      camera.position.z = 10.4 + progress * 1.2;
    }
  };

  /** The supernova at `elapsed` seconds after detonation. */
  const supernova = (elapsed: number, dt: number) => {
    explosion.points.scale.setScalar(Math.max(0.0001, flight(elapsed, 0.996)));
    explosion.material.opacity = Math.max(0.045, 0.95 - elapsed * 0.07);
    debris.points.scale.setScalar(Math.max(0.0001, flight(elapsed, 0.991)));
    debris.material.opacity = Math.max(0, 0.85 - elapsed * 0.095);
    jets.points.scale.setScalar(Math.max(0.0001, flight(elapsed, 0.995)));
    jets.material.opacity = Math.max(0, 1 - elapsed * 0.18);

    for (const wave of waves) {
      wave.mesh.scale.setScalar(Math.max(0.01, (elapsed - wave.delay) * wave.growth + (wave.delay === 0 ? 1 : 0)));
      wave.material.opacity = elapsed < wave.delay ? 0 : Math.max(0, wave.start - elapsed * wave.fade);
    }

    // The pen's impact shake, kept to the blast itself: it is over before the logo
    // appears, and without the pen's forward-and-back pumping of the camera, which
    // made the whole scene — and the logo over it — read as bouncing.
    if (elapsed > 0.07 && elapsed < LOGO_AT) {
      const impact = ((LOGO_AT - elapsed) / (LOGO_AT - 0.07)) * 0.3;
      camera.position.set((Math.random() - 0.5) * impact, (Math.random() - 0.5) * impact, 12);
    } else {
      const settle = Math.pow(0.86, dt * 60);
      camera.position.x *= settle;
      camera.position.y *= settle;
      camera.position.z += (12 - camera.position.z) * (1 - Math.pow(0.94, dt * 60));
    }

    if (flash) {
      // The pen snaps the flash on, holds it 35ms, then fades it over .8s.
      const f = elapsed < 0.035 ? 1 : Math.max(0, 1 - (elapsed - 0.035) / 0.8);
      flash.style.opacity = f.toFixed(3);
    }
  };

  return {
    resize(w, h, dpr) {
      width = w;
      height = h;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      applyView();
      if (last >= 0) renderer.render(scene, camera);
    },
    frame(seconds) {
      const now = seconds;
      const dt = last < 0 ? 0 : Math.min(Math.max(now - last, 0), 0.033);
      last = now;

      const thisLap = Math.floor(now / LAP);
      const t = now - thisLap * LAP;
      if (thisLap !== lap) {
        resetLap();
        lap = thisLap;
      }

      stars.rotation.y += dt * 0.002;

      const exploded = t >= DETONATE_AT;
      const blackout = t >= BLACKOUT_AT && !exploded;
      for (const part of preExplosion) part.visible = t < BLACKOUT_AT;
      for (const part of postExplosion) part.visible = exploded;
      starsMaterial.opacity = blackout ? 0 : 0.75;

      if (!exploded) {
        if (flash) flash.style.opacity = "0";
        if (t < BLACKOUT_AT) buildUp(t, dt);
        else setHaze(false);
        setPhase("orb");
      } else {
        setHaze(false);
        const elapsed = t - DETONATE_AT;
        supernova(elapsed, dt);
        if (t >= LAP - COVER_SECONDS) setPhase("cover");
        else if (t >= ZOOM_AT) setPhase("zoom");
        else if (elapsed >= LOGO_AT) setPhase("logo");
        else setPhase("blast");
      }

      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    },
    dispose() {
      for (const thing of disposables) thing.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

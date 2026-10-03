/**
 * A cover drawn from a title. Where a post or a lesson has no picture of its
 * own, it is given one: an abstract composition in the colours of the mark,
 * arranged by a number worked out from its address, so each is different and
 * each is always the same. It is decoration and says nothing: no chart, no
 * figure, no text. Rendered on the server as plain SVG.
 */
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const TONES = ["var(--dna-teal)", "var(--dna-blue)", "var(--dna-emerald)", "var(--prestige)"];

export function GeneratedCover({ seed, className = "" }: { seed: string; className?: string }) {
  const r = rng(hash(seed));
  const W = 800;
  const H = 500;
  const kind = Math.floor(r() * 3);
  const cx = W * (0.3 + r() * 0.4);
  const cy = H * (0.35 + r() * 0.3);
  const rings = Array.from({ length: 5 + Math.floor(r() * 4) }, (_, i) => ({ rad: 40 + i * (34 + r() * 22), tone: TONES[Math.floor(r() * TONES.length)], dash: r() < 0.4 ? `${4 + Math.floor(r() * 10)} ${6 + Math.floor(r() * 12)}` : undefined, start: r() * 360, sweep: 90 + r() * 250 }));
  const bars = Array.from({ length: 16 }, (_, i) => ({ x: 40 + i * 46, h: 60 + r() * 300, tone: TONES[Math.floor(r() * 3)] }));
  const pts = Array.from({ length: 9 }, (_, i) => `${(i * W) / 8},${H * (0.25 + r() * 0.5)}`);
  const arc = (rad: number, a0: number, sweep: number) => {
    const p = (a: number) => `${cx + Math.cos((a * Math.PI) / 180) * rad} ${cy + Math.sin((a * Math.PI) / 180) * rad}`;
    return `M ${p(a0)} A ${rad} ${rad} 0 ${sweep > 180 ? 1 : 0} 1 ${p(a0 + sweep)}`;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`gx-cover ${className}`} aria-hidden preserveAspectRatio="xMidYMid slice">
      <rect width={W} height={H} fill="var(--night)" />
      <rect width={W} height={H} fill={TONES[Math.floor(r() * 3)]} opacity="0.1" />
      {kind === 0 && rings.map((g, i) => <path key={i} d={arc(g.rad, g.start, g.sweep)} fill="none" stroke={g.tone} strokeWidth={i % 3 === 0 ? 3 : 1.4} strokeDasharray={g.dash} strokeLinecap="round" opacity={0.85 - i * 0.06} />)}
      {kind === 1 && bars.map((b, i) => <rect key={i} x={b.x} y={H - 40 - b.h} width="22" height={b.h} fill={b.tone} opacity={0.25 + (i % 4) * 0.16} rx="2" />)}
      {kind === 2 && (
        <>
          <polyline points={pts.join(" ")} fill="none" stroke="var(--dna-teal)" strokeWidth="3" strokeLinejoin="round" opacity="0.9" />
          <polyline points={pts.map((p, i) => `${p.split(",")[0]},${Number(p.split(",")[1]) + 46 + (i % 2) * 20}`).join(" ")} fill="none" stroke="var(--dna-blue)" strokeWidth="1.6" strokeLinejoin="round" opacity="0.7" />
          <polyline points={pts.map((p, i) => `${p.split(",")[0]},${Number(p.split(",")[1]) - 52 - (i % 3) * 14}`).join(" ")} fill="none" stroke="var(--dna-emerald)" strokeWidth="1.6" strokeLinejoin="round" strokeDasharray="6 10" opacity="0.7" />
        </>
      )}
      <circle cx={cx} cy={cy} r={7 + r() * 9} fill="var(--prestige)" opacity="0.9" />
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} fill="none" stroke="var(--night-line)" />
    </svg>
  );
}

import { Rosette } from "@/components/brand/Rosette";

/** Route transition state: the signature geometry, briefly. Never an artificial delay. */
export default function Loading() {
  return (
    <div className="wrap grid min-h-[55svh] place-items-center" role="status" aria-live="polite">
      <div className="grid justify-items-center gap-13 text-ink-3">
        <Rosette size={34} dna spin />
        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
}

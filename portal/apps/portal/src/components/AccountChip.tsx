// One-platform chip: GIO Raptor is the only execution platform. The
// surrounding code passes the account "type" (Classic / Premium / ECN /
// Cent / Swap-Free STP / etc.) — we render it next to a Raptor badge.

export function AccountChip({ type }: { type?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded-md bg-sky/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky">
        Raptor
      </span>
      {type ? <span className="text-[11px] text-steel">{type}</span> : null}
    </span>
  );
}

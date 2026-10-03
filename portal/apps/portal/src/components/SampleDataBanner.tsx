import { Info } from "lucide-react";

// Honest disclaimer for screens that still render illustrative/sample figures
// instead of the signed-in user's live data. Keeps users from mistaking demo
// numbers for their real account/IB activity until the page is fully wired.
export function SampleDataBanner({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <Info size={14} className="mt-0.5 shrink-0" />
      <span>
        {children ??
          "Sample data — these figures are illustrative and do not reflect your live account. Live reporting is coming soon."}
      </span>
    </div>
  );
}

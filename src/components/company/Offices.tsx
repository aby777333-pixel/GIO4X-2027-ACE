import { site } from "@/config/site";

const offices = [
  { key: "head", label: "Head office", office: site.headOffice, entity: site.legalName },
  { key: "support", label: "Support office", office: site.supportOffice, entity: null },
] as const;

/** The two postal addresses GIO4X has published. Nothing else: no phone, no hours. */
export function Offices({ className = "" }: { className?: string }) {
  return (
    <dl className={`grid gap-21 sm:grid-cols-2 ${className}`}>
      {offices.map((o) => (
        <div key={o.key} className="border-t border-line-strong pt-13">
          <dt className="label">{o.label}</dt>
          <dd className="mt-8">
            <address className="text-[0.9375rem] not-italic leading-[1.618] text-ink-2">
              {o.entity && <span className="block font-medium text-ink">{o.entity}</span>}
              {o.office.lines.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
              <span className="block">{o.office.country}</span>
            </address>
          </dd>
        </div>
      ))}
    </dl>
  );
}

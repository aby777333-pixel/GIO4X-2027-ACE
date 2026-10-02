import Link from "next/link";
import type { AddLeadState } from "@/app/control/actions-leads";
import { ControlHead } from "@/components/control/bits";
import { LeadAddForm } from "@/components/control/LeadAddForm";

/**
 * Presentation only: what a hand-entered enquiry is and is not, then the form.
 * `initial` exists so that a refusal can be shown without the action having run.
 */
export function LeadNewView({ initial }: { initial?: AddLeadState }) {
  return (
    <>
      <p className="text-xs text-ink-3">
        <Link href="/control/leads" className="link-quiet">
          Leads
        </Link>
        <span aria-hidden className="mx-8 inline-block h-px w-8 bg-line-strong align-middle" />
        <span className="text-ink-2">Add an enquiry</span>
      </p>

      <div className="mt-13">
        <ControlHead title="Add an enquiry" lead="Record a person you spoke to by telephone, at an event, by referral or in an office, so that the enquiry is worked like any other." />
      </div>

      <section aria-labelledby="add-before" className="gxc-card mt-21">
        <div className="gxc-card-head">
          <h2 id="add-before" className="gxc-card-title">
            Before you save
          </h2>
        </div>
        <div className="gxc-card-body">
          <ul className="grid max-w-measure gap-8 text-sm text-ink-2">
            <li>
              <span className="font-semibold text-ink">No consent is stored.</span> This person did not accept the Privacy Policy on the website, so the enquiry is saved without consent evidence and is marked as entered by staff, with your name.
            </li>
            <li>
              <span className="font-semibold text-ink">No mailings.</span> Do not add them to the newsletter or to any other mailing. Reply only about what they asked.
            </li>
            <li>
              <span className="font-semibold text-ink">Tell them.</span> Let the person know that GIO4X holds their details, and point them to the{" "}
              <Link href="/legal/privacy" className="link" target="_blank" rel="noopener">
                Privacy Policy
              </Link>
              .
            </li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="add-details" className="gxc-card mt-21">
        <div className="gxc-card-head">
          <h2 id="add-details" className="gxc-card-title">
            The enquiry
          </h2>
        </div>
        <div className="gxc-card-body">
          <LeadAddForm initial={initial} />
        </div>
      </section>
    </>
  );
}

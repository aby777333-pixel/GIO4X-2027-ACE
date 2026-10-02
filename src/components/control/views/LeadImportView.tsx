import Link from "next/link";
import { ControlHead } from "@/components/control/bits";
import { LeadImport } from "@/components/control/LeadImport";
import { IMPORT_MAX_ROWS } from "@/lib/lead-import";

/**
 * Presentation only: what an import is and is not, then the four steps. The
 * steps themselves (LeadImport.tsx) run in the browser; nothing is read from
 * the database to draw this page.
 */
export function LeadImportView() {
  return (
    <>
      <p className="text-xs text-ink-3">
        <Link href="/control/leads" className="link-quiet">
          Leads
        </Link>
        <span aria-hidden className="mx-8 inline-block h-px w-8 bg-line-strong align-middle" />
        <span className="text-ink-2">Import a file</span>
      </p>

      <div className="mt-13">
        <ControlHead
          title="Import enquiries from a file"
          lead={`Record up to ${IMPORT_MAX_ROWS} people from a CSV file, for example a list from an event, so that each is worked like any other enquiry. Every row is checked before anything is saved, and each person is recorded as entered by staff with no consent.`}
        />
      </div>

      <div className="mt-21">
        <LeadImport />
      </div>
    </>
  );
}

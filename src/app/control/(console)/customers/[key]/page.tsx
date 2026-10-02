import Link from "next/link";
import { notFound } from "next/navigation";
import { ControlHead, NoAccess, Notice } from "@/components/control/bits";
import { controlMeta } from "@/components/control/format";
import { CustomerView } from "@/components/control/views/CustomerView";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import type { Json, PersonView } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Customer", "/control/customers");

// the key a person is addressed by: 32 hex characters of a hash of the address (person_key in 0009_insight.sql)
const KEY = /^[0-9a-f]{32}$/;

/** person_view() answers with JSON; make sure it has the shape the view reads before trusting it. */
function asPersonView(value: Json | null): PersonView | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const ok = typeof value.key === "string" && typeof value.email === "string" && Array.isArray(value.leads) && Array.isArray(value.tickets) && typeof value.marketing_consent === "boolean";
  return ok ? (value as unknown as PersonView) : null;
}

/**
 * Everything held under one e-mail address, from person_view(). The address
 * never appears in the URL: the person is addressed by a hash of it.
 */
export default async function CustomerPage({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "customers.read")) return <NoAccess title="Customer" />;
  const { supabase } = ctx;

  const { key } = await params;
  if (!KEY.test(key)) notFound();

  const [result, names] = await Promise.all([supabase.rpc("person_view", { p_key: key }), staffDirectory(supabase)]);

  if (result.error) {
    return (
      <>
        <ControlHead title="This person could not be read" />
        <div className="mt-21">
          <Notice title="The database did not answer" tone="error">
            Reload the page, or go back to{" "}
            <Link href="/control/customers" className="link">
              all customers
            </Link>
            .
          </Notice>
        </div>
      </>
    );
  }
  // null: nobody has that key
  const person = asPersonView(result.data);
  if (!person) notFound();

  // person_view() returns both lists to anyone who may read customers. A block
  // is handed to the view only when the role also includes that kind of record,
  // so what this page shows never exceeds what Leads and Tickets would show.
  return (
    <CustomerView
      person={{ key: person.key, email: person.email, name: person.name, subscription: person.subscription, marketing_consent: person.marketing_consent }}
      leads={can(ctx, "leads.read") ? person.leads : null}
      tickets={can(ctx, "tickets.read") ? person.tickets : null}
      names={names}
      me={ctx.userId}
    />
  );
}

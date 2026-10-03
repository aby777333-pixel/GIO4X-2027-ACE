import Link from "next/link";
import { ControlHead, Empty, NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDate, fmtDateTime } from "@/components/control/format";
import { LINK_DESTINATION_LABEL, MaterialManager, MoreNotice, type MaterialRow } from "@/components/control/portal/MoreBits";
import { Figures, PortalReadFailed, PortalSource, PortalUnconfigured, Section, StateBadge, fmtNum, label } from "@/components/control/portal/kit";
import { portalPeople, requirePortal } from "@/lib/server/portal-db";
import { can } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("IB Marketing", "/control/marketing");

const TITLE = "IB Marketing";
const MATERIALS_LIMIT = 200;
const LINKS_SHOWN = 100;

type Material = MaterialRow & { updated_at: string | null };
type LinkRow = {
  id: string;
  code: string;
  owner_id: string;
  name: string | null;
  destination: string | null;
  sub_id: string | null;
  clicks: number | null;
  conversions: number | null;
  created_at: string;
};

/**
 * What introducing brokers are given to promote with, as the client portal
 * holds it (partners.read): the marketing materials they see under Marketing
 * Materials, and the campaign links across all IBs. A material is a title and
 * the https address of a file hosted elsewhere; no file is uploaded here.
 * partners.manage adds, changes and retires materials through
 * src/app/control/actions-portal-more.ts, which writes the audit entry first.
 * A campaign link is created for an IB from that IB's own page. Counts are of
 * the portal's rows.
 */
export default async function MarketingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("partners.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} missing={access.missing} />;
  const { db, ctx } = access;
  const manages = can(ctx, "partners.manage");
  const params = await searchParams;

  const [materials, links] = await Promise.all([
    db
      .from("marketing_materials")
      .select("id, title, kind, description, url, language, sort, active, updated_at", { count: "exact" })
      .order("sort", { ascending: true })
      .order("title", { ascending: true })
      .limit(MATERIALS_LIMIT),
    db.from("referrals").select("id, code, owner_id, name, destination, sub_id, clicks, conversions, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(LINKS_SHOWN),
  ]);

  const failed = !!materials.error || !!links.error;
  const materialRows = (materials.data ?? []) as Material[];
  const materialTotal = materials.count ?? materialRows.length;
  const linkRows = (links.data ?? []) as LinkRow[];
  const linkTotal = links.count ?? linkRows.length;
  const people = await portalPeople(db, linkRows.map((r) => r.owner_id));
  const n = (r: { error: unknown }, value: number) => (r.error ? "–" : fmtNum(value));

  return (
    <>
      <ControlHead title={TITLE} lead="The marketing materials introducing brokers are given, and the campaign links they promote with." />
      <PortalSource decides={manages}>
        {manages ? "Materials are added, changed and retired beneath their table. A campaign link is created for an IB from that IB’s page." : "Materials are kept by the staff who manage partners."}
      </PortalSource>
      <MoreNotice notice={firstParam(params.notice)} error={firstParam(params.error)} />
      {failed && <PortalReadFailed />}

      <Figures
        items={[
          { label: "Materials", value: n(materials, materialTotal), note: "Active and retired" },
          { label: "Materials IBs see", value: n(materials, materialRows.filter((m) => m.active !== false).length), note: materialRows.length < materialTotal ? `Of the first ${materialRows.length}` : "Active" },
          { label: "Campaign links", value: n(links, linkTotal), note: "Across all IBs" },
        ]}
      />

      <Section title="Materials" aside={materials.error ? undefined : materialRows.length < materialTotal ? `First ${materialRows.length} of ${materialTotal}` : `${materialTotal} ${materialTotal === 1 ? "material" : "materials"}`}>
        <p className="max-w-measure text-sm text-ink-2">
          Files are not uploaded here. Paste the https address where the file is hosted; IBs see the active materials in the portal under Marketing Materials, and open the file from that address.
        </p>
        {materialRows.length === 0 ? (
          <Empty title={materials.error ? "Nothing could be read" : "No marketing material has been added"} />
        ) : (
          <div className="scroll-x mt-13">
            <table className="table-gx min-w-[60rem] text-sm">
              <caption className="sr-only">Marketing materials, in the order IBs see them</caption>
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Language</th>
                  <th scope="col">Address</th>
                  <th scope="col">State</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {materialRows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[18rem]">
                      <span className="block text-ink">{row.title}</span>
                      {row.description && <span className="block text-xs text-ink-3">{row.description}</span>}
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{label(row.kind)}</td>
                    <td className="num text-ink-2">{row.language || "–"}</td>
                    <td className="max-w-[20rem]">
                      {row.url.startsWith("https://") ? (
                        <a href={row.url} rel="noopener noreferrer" target="_blank" className="link block truncate">
                          {row.url}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      ) : (
                        <span className="block truncate text-ink-3">{row.url}</span>
                      )}
                    </td>
                    <td>
                      <StateBadge value={row.active !== false ? "active" : "retired"} />
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{row.updated_at ? fmtDateTime(row.updated_at) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      {manages && !materials.error && <MaterialManager rows={materialRows} />}

      <Section title="Campaign links" aside={links.error ? undefined : `Latest ${Math.min(LINKS_SHOWN, linkTotal)} of ${linkTotal}`}>
        <p className="max-w-measure text-sm text-ink-2">Every IB’s links, newest first. A link is created for an IB from that IB’s page: open the owner below.</p>
        {linkRows.length === 0 ? (
          <Empty title={links.error ? "Nothing could be read" : "No campaign link has been created"} />
        ) : (
          <div className="scroll-x mt-13">
            <table className="table-gx min-w-[68rem] text-sm">
              <caption className="sr-only">Campaign links across all IBs, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Owner</th>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Channel</th>
                  <th scope="col">Destination</th>
                  <th scope="col">Clicks</th>
                  <th scope="col">Conversions</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {linkRows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[16rem]">
                      {(() => {
                        const owner = people.get(row.owner_id);
                        return (
                          <>
                            <Link href={`/control/ib/${row.owner_id}`} className="link block truncate">
                              {owner?.name || owner?.email || `${row.owner_id.slice(0, 8)}…`}
                            </Link>
                            {owner?.name && owner.email && <span className="block truncate text-xs text-ink-3">{owner.email}</span>}
                          </>
                        );
                      })()}
                    </td>
                    <td className="num whitespace-nowrap text-ink">{row.code}</td>
                    <td className="max-w-[14rem] text-ink-2">
                      <span className="block truncate">{row.name ?? "–"}</span>
                    </td>
                    <td className="num max-w-[10rem] truncate text-ink-2">{row.sub_id ?? "–"}</td>
                    <td className="max-w-[14rem] text-ink-2">
                      <span className="block truncate">{row.destination ? (LINK_DESTINATION_LABEL[row.destination] ?? row.destination) : "–"}</span>
                    </td>
                    <td className="num text-ink-2">{fmtNum(row.clicks)}</td>
                    <td className="num text-ink-2">{fmtNum(row.conversions)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

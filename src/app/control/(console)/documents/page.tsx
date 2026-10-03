import { ControlHead, Empty, NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDateTime } from "@/components/control/format";
import { Person, PortalReadFailed, PortalSource, PortalUnconfigured, Section, fmtNum } from "@/components/control/portal/kit";
import { portalPeople, requirePortal } from "@/lib/server/portal-db";
import { can } from "@/lib/server/staff";
import { LegalManager, OpsNotice } from "@/components/control/portal/OpsBits";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Document Builder", "/control/documents");

const TITLE = "Document Builder";
const BODY_CAP = 6000;
const MAX_DOCUMENTS = 200;

type LegalRow = {
  id: string;
  key: string;
  title: string | null;
  body: string | null;
  version: number | null;
  published: boolean | null;
  updated_by: string | null;
  updated_at: string | null;
};

/**
 * The legal documents the client portal holds: one row per document key,
 * with its version and whether it is published, and each body as plain
 * text. Reads only (documents.read): a document is not edited or published
 * from this screen. A body is shown as text, never as markup.
 */
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("documents.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} missing={access.missing} />;
  const { db, ctx } = access;
  const manages = can(ctx, "documents.manage");
  const params = await searchParams;

  const [docs] = await Promise.all([db.from("legal_documents").select("id, key, title, body, version, published, updated_by, updated_at").order("key", { ascending: true }).limit(MAX_DOCUMENTS)]);

  const failed = !!docs.error;
  const rows = (docs.data ?? []) as LegalRow[];
  const people = await portalPeople(
    db,
    rows.map((r) => r.updated_by),
  );
  const version = (row: LegalRow) => (row.version === null ? "–" : `Version ${row.version}`);

  return (
    <>
      <ControlHead title={TITLE} lead="The legal documents the portal holds, with the version and text of each. In order of key." />
      <PortalSource decides={manages}>Each text is shown as plain text, up to {fmtNum(BODY_CAP)} characters.{manages ? " Texts are edited and published beneath the table; a published document is what clients read in the portal." : ""}</PortalSource>
      <OpsNotice notice={firstParam(params.notice)} error={firstParam(params.error)} />
      {failed && <PortalReadFailed />}

      <Section title="Documents" aside={failed ? undefined : `${fmtNum(rows.length)} in the portal`}>
        {rows.length === 0 ? (
          <Empty title={failed ? "Nothing could be read" : "The portal holds no documents"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[56rem] text-sm">
              <caption className="sr-only">Legal documents, by key</caption>
              <thead>
                <tr>
                  <th scope="col">Key</th>
                  <th scope="col">Title</th>
                  <th scope="col">Version</th>
                  <th scope="col">Published</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Updated by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="num whitespace-nowrap text-ink">{row.key}</td>
                    <td className="max-w-[20rem] text-ink">{row.title || "–"}</td>
                    <td className="num whitespace-nowrap text-ink-2">{row.version ?? "–"}</td>
                    <td className="whitespace-nowrap text-ink-2">{row.published === null ? "–" : row.published ? "Published" : "Not published"}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.updated_at)}</td>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.updated_by ?? "")} id={row.updated_by} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      {manages && !failed && <LegalManager docs={rows} />}

      {rows.length > 0 && (
        <Section title="Text of each document" aside="Open one to read it">
          <div className="grid gap-13">
            {rows.map((row) => {
              const body = row.body ?? "";
              const more = Math.max(0, body.length - BODY_CAP);
              return (
                <details key={row.id}>
                  <summary className="text-sm text-ink">
                    {row.title || row.key} <span className="num text-xs text-ink-3">{version(row)}</span>
                  </summary>
                  {body ? (
                    <>
                      <p className="mt-8 whitespace-pre-wrap text-sm text-ink-2">{more > 0 ? body.slice(0, BODY_CAP) : body}</p>
                      {more > 0 && (
                        <p className="mt-8 text-xs text-ink-3">
                          {fmtNum(more)} more {more === 1 ? "character is" : "characters are"} not shown.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-8 text-sm text-ink-3">This document has no text.</p>
                  )}
                </details>
              );
            })}
          </div>
        </Section>
      )}
    </>
  );
}

import Link from "next/link";
import { ControlHead, Notice } from "@/components/control/bits";
import type { LeadBoardColumn } from "@/components/control/board-shared";
import { PipelineBoard } from "@/components/control/PipelineBoard";

export type PipelineColumn = LeadBoardColumn;

export type PipelineViewProps = {
  columns: PipelineColumn[];
  failed: boolean;
  names: Map<string, string>;
  me: string;
  /** may move an enquiry to another stage (leads.write); without it the board is read-only */
  writable: boolean;
};

/**
 * The pipeline: a board with one column per stage, side by side from `xl` up
 * and a rail that scrolls sideways below it. Each column shows a real count
 * and its highest-scoring enquiries. People who may change enquiries can move
 * a card to another stage by dragging it or with its "Move to" button; the
 * change is the same one the stage form on the enquiry's own page makes, and
 * it is recorded the same way.
 */
export function PipelineView({ columns, failed, names, me, writable }: PipelineViewProps) {
  const total = columns.reduce((sum, c) => sum + c.count, 0);

  return (
    <>
      <ControlHead
        eyebrow="Clients"
        title="Pipeline"
        lead="Where each relationship stands, from first enquiry to client. Spam is left out. Within a stage, the highest score comes first."
        actions={
          <Link href="/control/leads?sort=score" className="go">
            All leads by score
          </Link>
        }
      />

      {failed ? (
        <div className="mt-21">
          <Notice title="The pipeline could not be read" tone="error">
            The database did not answer every query. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        </div>
      ) : (
        <>
          <p className="mt-13 max-w-measure text-xs text-ink-3">
            <span className="num">
              {total} {total === 1 ? "enquiry" : "enquiries"} in the pipeline.
            </span>{" "}
            {writable
              ? "To change a stage, drag a card to another column or use its “Move to” button; on a touch screen, press and hold the card first. Moving to Lost asks for the reason before anything is saved."
              : "Your role can read the pipeline but not change it."}
          </p>
          <div className="mt-13">
            <PipelineBoard columns={columns} writable={writable} names={Object.fromEntries(names)} me={me} />
          </div>
        </>
      )}
    </>
  );
}

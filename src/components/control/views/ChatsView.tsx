import { ControlHead, Notice } from "@/components/control/bits";
import { ChatsLive, type ChatsLiveProps } from "@/components/control/views/ChatsLive";

export type ChatsViewProps = ChatsLiveProps & {
  /** the first read failed: say so instead of showing an empty list that is not really empty */
  failed: boolean;
  notice?: string;
  error?: string;
};

/**
 * Presentation only: the heading, the outcome of the last action, and the live
 * part (ChatsLive), which starts from these props and keeps itself current.
 */
export function ChatsView({ failed, notice, error, ...live }: ChatsViewProps) {
  return (
    <>
      <ControlHead title="Live Chats" lead="Conversations visitors start from the website's chat window. Waiting chats come first; the longest wait is at the top." />

      <div className="mt-21 grid gap-13">
        {notice && !error && <Notice title={notice} tone="ok" />}
        {error && <Notice title={error} tone="error" />}
        {!live.writable && <Notice title="Read-only">Your role can read live chats but cannot take, answer or close them.</Notice>}
        {failed && (
          <Notice title="Live chats could not be read" tone="error">
            The database did not answer every query. Reload the page; if this continues, check that the migrations have been applied and that the project is running.
          </Notice>
        )}
      </div>

      {!failed && <ChatsLive {...live} />}
    </>
  );
}

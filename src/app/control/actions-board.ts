"use server";

/**
 * Server actions for the two boards: a card dropped in another column, or
 * moved there with its "Move to" menu.
 *
 * They are the non-redirecting siblings of setLeadStage (actions.ts) and
 * setTicketStatus (actions-tickets.ts). A board keeps many cards on screen and
 * must put one back when the server refuses, so it needs an answer, not a
 * navigation. The validation and the write are the ones in
 * src/lib/server/crm-writes.ts, which repeat those actions step for step: the
 * same allow-lists, the same capability, the same one-row UPDATE as the
 * signed-in user. The database decides and audits exactly as it does for the
 * single-row screens.
 *
 * The answer is a fixed code. Nothing typed by a caller, and nothing the
 * database said, is returned.
 */
import type { BoardResult } from "@/components/control/board-shared";
import { writeLeadStage, writeTicketStatus } from "@/lib/server/crm-writes";
import { getAccess, type StaffContext } from "@/lib/server/staff";

async function caller(): Promise<{ ctx: StaffContext } | { code: "signed-out" | "unavailable" | "forbidden" }> {
  const access = await getAccess();
  if (access.state === "anonymous") return { code: "signed-out" };
  if (access.state === "unconfigured" || access.state === "unavailable") return { code: "unavailable" };
  if (access.state !== "staff") return { code: "forbidden" };
  return { ctx: access };
}

/** Moves one enquiry to a stage. A stage of "lost" needs a reason from the allow-list. */
export async function moveLeadStage(id: unknown, stage: unknown, reason: unknown): Promise<BoardResult> {
  const who = await caller();
  if (!("ctx" in who)) return { code: who.code };
  return { code: await writeLeadStage(who.ctx, id, stage, reason) };
}

/** Sets one ticket's status. What a reply does to a ticket stays with the database (0007). */
export async function moveTicketStatus(id: unknown, status: unknown): Promise<BoardResult> {
  const who = await caller();
  if (!("ctx" in who)) return { code: who.code };
  return { code: await writeTicketStatus(who.ctx, id, status) };
}

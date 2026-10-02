"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/** The reference and address of a request opened during this visit. */
export type Handoff = { reference: string; email: string };

type Desk = { handoff: Handoff | null; setHandoff: (value: Handoff | null) => void };

const DeskContext = createContext<Desk>({ handoff: null, setHandoff: () => undefined });

/**
 * Lets the two halves of the support page talk: when a request has just been
 * opened, "Check a request" is filled in with its reference and address so the
 * visitor does not have to type them again.
 *
 * It is component state and nothing more: it lasts for the visit to this page,
 * and is never written to the address bar, to storage or to a cookie.
 */
export function SupportDesk({ children }: { children: ReactNode }) {
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const value = useMemo(() => ({ handoff, setHandoff }), [handoff]);
  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}

export function useSupportDesk(): Desk {
  return useContext(DeskContext);
}

export type CategoryOption = { key: string; label: string };

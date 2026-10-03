"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Tables } from "@gio4x/supabase";

export type SessionValue = {
  userId: string | null;
  email: string | null;
  profile: Tables<"profiles"> | null;
};

const SessionContext = createContext<SessionValue>({
  userId: null,
  email: null,
  profile: null,
});

export function SessionProvider({
  value,
  children,
}: {
  value: SessionValue;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Client-side accessor for the current user/profile injected at the root. */
export function useSession(): SessionValue {
  return useContext(SessionContext);
}

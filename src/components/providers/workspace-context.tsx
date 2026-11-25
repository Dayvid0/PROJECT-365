"use client";

import { createContext, useContext } from "react";

const WorkspaceUserContext = createContext<string | null>(null);

/** Supplies the authenticated userId resolved by the server layout. */
export function WorkspaceProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceUserContext.Provider value={userId}>
      {children}
    </WorkspaceUserContext.Provider>
  );
}

export function useWorkspaceUserId(): string {
  const userId = useContext(WorkspaceUserContext);
  if (!userId) throw new Error("useWorkspaceUserId must be used inside WorkspaceProvider.");
  return userId;
}

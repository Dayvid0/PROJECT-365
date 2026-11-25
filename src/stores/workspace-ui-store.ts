"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { HabitLog } from "@/domain/types";
import { logKey } from "@/domain/calculations";

interface WorkspaceUIState {
  isOnline: boolean;
  pendingLogs: HabitLog[];
  setIsOnline: (isOnline: boolean) => void;
  enqueueLogs: (logs: HabitLog[]) => void;
  removeLogs: (logs: HabitLog[]) => void;
  clearPending: () => void;
}

/**
 * The only state that survives a reload: failed log writes waiting to be
 * flushed. It is explicitly cleared on sign-out and never contains credentials.
 */
export const useWorkspaceUIStore = create<WorkspaceUIState>()(
  persist(
    (set) => ({
      isOnline: true,
      pendingLogs: [],
      setIsOnline: (isOnline) => set({ isOnline }),
      enqueueLogs: (logs) =>
        set((state) => {
          const byKey = new Map(state.pendingLogs.map((log) => [logKey(log), log]));
          for (const log of logs) byKey.set(logKey(log), log);
          return { pendingLogs: [...byKey.values()] };
        }),
      removeLogs: (logs) =>
        set((state) => {
          const removed = new Set(logs.map(logKey));
          return {
            pendingLogs: state.pendingLogs.filter((log) => !removed.has(logKey(log))),
          };
        }),
      clearPending: () => set({ pendingLogs: [] }),
    }),
    {
      name: "project365-offline-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ pendingLogs: state.pendingLogs } as WorkspaceUIState),
    }
  )
);

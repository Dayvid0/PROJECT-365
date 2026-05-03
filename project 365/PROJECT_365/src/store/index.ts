// ============================================================
// PROJECT_365 — Zustand stores
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Habit,
  HabitLog,
  MonthlySnapshot,
  User,
  HabitStatus,
} from '../types';
import {
  getHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  bulkCreateHabits,
  getLogsForMonth,
  upsertLog,
  bulkUpsertLogs,
  getMonthlySnapshot,
  saveMonthlySnapshot,
} from '../services/firestore';
import { buildMonthlySnapshot, toDateString } from '../utils/calculations';

// ─── Auth Store ──────────────────────────────────────────────

interface AuthState {
  user: User | null;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  setUser: (user: User | null) => void;
  setLoading: (v: boolean) => void;
  completeOnboarding: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      hasCompletedOnboarding: false,
      setUser: (user) =>
        set({
          user,
          // Reset onboarding flag on sign-out so the next user sees the flow
          hasCompletedOnboarding: user === null ? false : get().hasCompletedOnboarding,
        }),
      setLoading: (v) => set({ isLoading: v }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      // isLoading must never be restored from storage — always start fresh
      partialize: (state) => ({
        user: state.user,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
);

// ─── Theme Store ─────────────────────────────────────────────

interface ThemeState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (t: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () =>
        set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      setTheme: (t) => set({ theme: t }),
    }),
    {
      name: 'theme-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ─── Habits Store ─────────────────────────────────────────────

interface HabitsState {
  habits: Habit[];
  isLoading: boolean;
  fetchHabits: (uid: string) => Promise<void>;
  addHabit: (uid: string, habit: Habit) => Promise<void>;
  bulkAddHabits: (uid: string, habits: Habit[]) => Promise<void>;
  editHabit: (uid: string, id: string, updates: Partial<Habit>) => Promise<void>;
  removeHabit: (uid: string, id: string) => Promise<void>;
  reorderHabits: (habits: Habit[]) => void;
}

export const useHabitsStore = create<HabitsState>()(
  persist(
    (set, get) => ({
      habits: [],
      isLoading: false,

      fetchHabits: async (uid) => {
        set({ isLoading: true });
        try {
          const habits = await getHabits(uid);
          set({ habits });
        } finally {
          set({ isLoading: false });
        }
      },

      addHabit: async (uid, habit) => {
        await createHabit(uid, habit);
        set({ habits: [...get().habits, habit].sort((a, b) => a.order - b.order) });
      },

      bulkAddHabits: async (uid, habits) => {
        await bulkCreateHabits(uid, habits);
        set({ habits: [...get().habits, ...habits].sort((a, b) => a.order - b.order) });
      },

      editHabit: async (uid, id, updates) => {
        await updateHabit(uid, id, updates);
        set({
          habits: get().habits.map((h) =>
            h.id === id ? { ...h, ...updates } : h
          ),
        });
      },

      removeHabit: async (uid, id) => {
        await updateHabit(uid, id, { isActive: false });
        set({
          habits: get().habits.map((h) =>
            h.id === id ? { ...h, isActive: false } : h
          ),
        });
      },

      reorderHabits: (habits) => set({ habits }),
    }),
    {
      name: 'habits-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ─── Logs Store ───────────────────────────────────────────────

interface LogsState {
  // Map of "YYYY-MM" -> HabitLog[]
  logsByMonth: Record<string, HabitLog[]>;
  pendingQueue: HabitLog[];
  isLoading: boolean;
  fetchLogsForMonth: (uid: string, month: string) => Promise<void>;
  updateLog: (uid: string, log: HabitLog, isOnline?: boolean) => Promise<void>;
  flushQueue: (uid: string) => Promise<void>;
  getLogsForDate: (date: string) => HabitLog[];
  getLogForHabitAndDate: (habitId: string, date: string) => HabitLog | undefined;
}

export const useLogsStore = create<LogsState>()(
  persist(
    (set, get) => ({
      logsByMonth: {},
      pendingQueue: [],
      isLoading: false,

      fetchLogsForMonth: async (uid, month) => {
        set({ isLoading: true });
        try {
          const logs = await getLogsForMonth(uid, month);
          set({
            logsByMonth: { ...get().logsByMonth, [month]: logs },
          });
        } finally {
          set({ isLoading: false });
        }
      },

      updateLog: async (uid, log, isOnline = true) => {
        const month = log.date.substring(0, 7);
        const current = get().logsByMonth[month] ?? [];
        const updated = [
          ...current.filter(
            (l) => !(l.habitId === log.habitId && l.date === log.date)
          ),
          log,
        ];
        set({ logsByMonth: { ...get().logsByMonth, [month]: updated } });

        if (isOnline) {
          try {
            await upsertLog(uid, log);
          } catch {
            // queue for later
            set({ pendingQueue: [...get().pendingQueue, log] });
          }
        } else {
          set({ pendingQueue: [...get().pendingQueue, log] });
        }
      },

      flushQueue: async (uid) => {
        const queue = get().pendingQueue;
        if (!queue.length) return;
        await bulkUpsertLogs(uid, queue);
        set({ pendingQueue: [] });
      },

      getLogsForDate: (date) => {
        const month = date.substring(0, 7);
        return (get().logsByMonth[month] ?? []).filter((l) => l.date === date);
      },

      getLogForHabitAndDate: (habitId, date) => {
        const month = date.substring(0, 7);
        return (get().logsByMonth[month] ?? []).find(
          (l) => l.habitId === habitId && l.date === date
        );
      },
    }),
    {
      name: 'logs-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ─── Analytics Store ──────────────────────────────────────────

interface AnalyticsState {
  snapshots: Record<string, MonthlySnapshot>;
  currentMonth: string; // YYYY-MM
  setCurrentMonth: (m: string) => void;
  fetchOrBuildSnapshot: (
    uid: string,
    month: string,
    habits: Habit[],
    logs: HabitLog[]
  ) => Promise<MonthlySnapshot>;
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set, get) => ({
      snapshots: {},
      currentMonth: new Date().toISOString().substring(0, 7),

      setCurrentMonth: (m) => set({ currentMonth: m }),

      fetchOrBuildSnapshot: async (uid, month, habits, logs) => {
        // Check cache
        if (get().snapshots[month]) return get().snapshots[month];

        // Try Firestore
        let snapshot = await getMonthlySnapshot(uid, month);

        // Build if missing
        if (!snapshot) {
          snapshot = buildMonthlySnapshot(month, habits, logs);
          await saveMonthlySnapshot(uid, snapshot);
        }

        set({ snapshots: { ...get().snapshots, [month]: snapshot } });
        return snapshot;
      },
    }),
    {
      name: 'analytics-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

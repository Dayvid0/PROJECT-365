"use client";

import { useCallback, useSyncExternalStore } from "react";

export interface TimerState {
  startedAt: number | null;
  accumulatedSeconds: number;
}

const EMPTY: TimerState = { startedAt: null, accumulatedSeconds: 0 };
const cache = new Map<string, TimerState>();
const listeners = new Map<string, Set<() => void>>();

function timerKey(habitId: string, date: string): string {
  return `project365-timer:${habitId}:${date}`;
}

function readTimer(key: string): TimerState {
  if (typeof window === "undefined") return EMPTY;
  const cached = cache.get(key);
  if (cached) return cached;

  let value: TimerState = EMPTY;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TimerState>;
      value = {
        startedAt: typeof parsed.startedAt === "number" ? parsed.startedAt : null,
        accumulatedSeconds: Math.max(0, parsed.accumulatedSeconds ?? 0),
      };
    }
  } catch {
    value = EMPTY;
  }
  cache.set(key, value);
  return value;
}

function subscribe(key: string, listener: () => void): () => void {
  const list = listeners.get(key) ?? new Set();
  list.add(listener);
  listeners.set(key, list);
  return () => {
    list.delete(listener);
    if (list.size === 0) listeners.delete(key);
  };
}

/**
 * Timers are private browser state: they never enter the workspace backup or
 * the server. Updates write through to localStorage from the event handler.
 */
export function useLocalTimer(habitId: string, date: string) {
  const key = timerKey(habitId, date);
  const timer = useSyncExternalStore(
    (listener) => subscribe(key, listener),
    () => readTimer(key),
    () => EMPTY
  );

  const setTimer = useCallback(
    (next: TimerState) => {
      cache.set(key, next);
      if (typeof window !== "undefined") {
        if (next.startedAt === null && next.accumulatedSeconds === 0) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, JSON.stringify(next));
        }
      }
      for (const listener of listeners.get(key) ?? []) listener();
    },
    [key]
  );

  return [timer, setTimer] as const;
}

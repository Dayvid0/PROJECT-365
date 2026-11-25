"use client";

import { useSyncExternalStore } from "react";

type Listener = () => void;

interface ClockStore {
  value: number;
  listeners: Set<Listener>;
  interval?: number;
}

const clocks = new Map<number, ClockStore>();

function storeFor(intervalMs: number): ClockStore {
  let store = clocks.get(intervalMs);
  if (!store) {
    store = { value: Date.now(), listeners: new Set() };
    clocks.set(intervalMs, store);
  }
  return store;
}

function subscribe(intervalMs: number, listener: Listener): () => void {
  const store = storeFor(intervalMs);
  store.listeners.add(listener);
  if (!store.interval && typeof window !== "undefined") {
    store.interval = window.setInterval(() => {
      store!.value = Date.now();
      for (const notify of store!.listeners) notify();
    }, intervalMs);
  }
  return () => {
    store.listeners.delete(listener);
    if (store.listeners.size === 0 && store.interval) {
      window.clearInterval(store.interval);
      store.interval = undefined;
    }
  };
}

function getSnapshot(intervalMs: number): number {
  return storeFor(intervalMs).value;
}

/**
 * A cached clock shared by every subscriber. Returns null during the server
 * render so hydration never depends on the server's wall-clock time.
 */
export function useExternalClock(intervalMs: number): number | null {
  const tick = useSyncExternalStore(
    (listener) => subscribe(intervalMs, listener),
    () => getSnapshot(intervalMs),
    () => 0
  );
  return tick === 0 ? null : tick;
}

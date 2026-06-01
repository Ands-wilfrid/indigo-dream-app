import { useEffect, useState } from "react";

/**
 * Simple localStorage-backed mutation queue for offline Kanban sync.
 *
 * - Mutations are appended to a JSON queue keyed by `pulse:offline-queue`.
 * - A flusher callback is invoked for each pending mutation when the browser
 *   comes back online (or on mount if already online and a queue exists).
 * - Mutations are removed only on successful flush; failures keep them queued.
 */

export type QueuedMutation =
  | {
      id: string;
      type: "move-task";
      ts: number;
      payload: { taskId: string; status: "todo" | "in_progress" | "done" };
    };

const QUEUE_KEY = "pulse:offline-queue";

const isBrowser = () => typeof window !== "undefined";

export function readQueue(): QueuedMutation[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

export function writeQueue(q: QueuedMutation[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    window.dispatchEvent(new Event("pulse:queue-change"));
  } catch {
    /* quota – ignore */
  }
}

export function enqueue(m: Omit<QueuedMutation, "id" | "ts">) {
  const full: QueuedMutation = {
    ...m,
    id: crypto.randomUUID(),
    ts: Date.now(),
  } as QueuedMutation;
  writeQueue([...readQueue(), full]);
  return full;
}

export function removeFromQueue(id: string) {
  writeQueue(readQueue().filter((m) => m.id !== id));
}

/** Generic key/value cache for query data (e.g. last-known tasks per project). */
export function cacheSet<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(`pulse:cache:${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function cacheGet<T>(key: string): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(`pulse:cache:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    isBrowser() ? window.navigator.onLine : true,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export function useQueueSize(): number {
  const [size, setSize] = useState<number>(() => readQueue().length);
  useEffect(() => {
    const update = () => setSize(readQueue().length);
    window.addEventListener("pulse:queue-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("pulse:queue-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return size;
}

/**
 * Calls `flush` for every queued mutation whenever the browser is online.
 * Failed mutations stay in the queue and will be retried on the next online
 * event. Successful ones are removed.
 */
export function useFlushQueue(
  flush: (m: QueuedMutation) => Promise<void>,
  deps: ReadonlyArray<unknown> = [],
) {
  const online = useOnlineStatus();
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    (async () => {
      const queue = readQueue();
      for (const m of queue) {
        if (cancelled) return;
        try {
          await flush(m);
          removeFromQueue(m.id);
        } catch {
          // keep in queue, abort the rest of this pass
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, ...deps]);
}

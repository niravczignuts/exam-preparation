// Background sync for the two write paths Sprint 2 introduces (settings /
// exam-stage mutations, KAN-64). A failed write is queued here instead of
// just erroring out; it's replayed on reconnect via the real Background Sync
// API where supported, and a plain 'online' listener everywhere else (Safari/
// Firefox don't implement Background Sync).

const STORAGE_KEY = "examprep.pendingWrites";
const SYNC_TAG = "flush-pending-writes";
const FLUSHED_EVENT = "examprep:writes-flushed";

interface QueuedWrite {
  id: string;
  kind: string;
  payload: unknown;
  queuedAt: string;
}

type ReplayHandler = (payload: unknown) => Promise<void>;
const replayHandlers = new Map<string, ReplayHandler>();

function readQueue(): QueuedWrite[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedWrite[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

/** Called by a hook once, at module load, to say how to replay its writes. */
export function registerReplayHandler(kind: string, handler: ReplayHandler): void {
  replayHandlers.set(kind, handler);
}

export function queueWrite(kind: string, payload: unknown): void {
  const queue = readQueue();
  queue.push({ id: crypto.randomUUID(), kind, payload, queuedAt: new Date().toISOString() });
  writeQueue(queue);
  void registerBackgroundSync();
}

export function hasQueuedWrites(): boolean {
  return readQueue().length > 0;
}

export async function flushQueuedWrites(): Promise<void> {
  const queue = readQueue();
  if (queue.length === 0) return;

  const remaining: QueuedWrite[] = [];
  for (const item of queue) {
    const handler = replayHandlers.get(item.kind);
    if (!handler) {
      remaining.push(item); // handler not registered yet (page just loaded) — retry later
      continue;
    }
    try {
      await handler(item.payload);
    } catch {
      remaining.push(item); // still offline, or still failing — keep it queued
    }
  }
  writeQueue(remaining);
  window.dispatchEvent(new CustomEvent(FLUSHED_EVENT));
}

async function registerBackgroundSync(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    if ("sync" in registration) {
      await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register(
        SYNC_TAG,
      );
    }
  } catch {
    // Background Sync unsupported/unavailable — the 'online' listener below covers it.
  }
}

let initialized = false;

/** Call once at app startup. */
export function initOfflineSync(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener("online", () => void flushQueuedWrites());
  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event.data?.type === SYNC_TAG) void flushQueuedWrites();
  });
  // Writes may have been queued in a previous session — try once on startup too.
  void flushQueuedWrites();
}

export function onWritesFlushed(callback: () => void): () => void {
  window.addEventListener(FLUSHED_EVENT, callback);
  return () => window.removeEventListener(FLUSHED_EVENT, callback);
}

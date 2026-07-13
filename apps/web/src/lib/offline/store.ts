import type { Json } from "~types/supabase";

const DB_NAME = "klasse-offline";
const DB_VERSION = 2;
const SNAPSHOT_STORE = "snapshots";
const QUEUE_STORE = "queue";

export type SnapshotRecord<T> = {
  key: string;
  payload: T;
  updatedAt: string;
};

export type QueueItemStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

export type OfflineQueueItem = {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  type: string;
  createdAt: string;

  // V2 Fields
  mutationId: string | null;
  baseVersion: number | null;
  payloadHash: string | null;
  status: QueueItemStatus;
  retryCount: number;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  lastError: string | null;
  conflictData: Json | null;
};

function isBrowser() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = handler(store);

    transaction.oncomplete = () => {
      db.close();
    };
    transaction.onabort = () => {
      db.close();
    };
    transaction.onerror = () => {
      db.close();
    };

    request.onerror = () => reject(request.error ?? new Error("IndexedDB error"));
    request.onsuccess = () => resolve(request.result);
  });
}

export async function saveSnapshot<T>(key: string, payload: T) {
  if (!isBrowser()) return;
  const record: SnapshotRecord<T> = {
    key,
    payload,
    updatedAt: new Date().toISOString(),
  };
  await withStore(SNAPSHOT_STORE, "readwrite", (store) => store.put(record));
}

export async function readSnapshot<T>(key: string): Promise<SnapshotRecord<T> | null> {
  if (!isBrowser()) return null;
  try {
    const result = await withStore<SnapshotRecord<T> | undefined>(
      SNAPSHOT_STORE,
      "readonly",
      (store) => store.get(key)
    );
    return result ?? null;
  } catch {
    return null;
  }
}

export async function enqueueAction(item: OfflineQueueItem) {
  if (!isBrowser()) return;
  await withStore(QUEUE_STORE, "readwrite", (store) => store.put(item));
}

export async function listActions(): Promise<OfflineQueueItem[]> {
  if (!isBrowser()) return [];
  try {
    const items = await withStore<OfflineQueueItem[]>(QUEUE_STORE, "readonly", (store) => {
      return store.getAll();
    });
    const rawItems = items ?? [];
    return rawItems.map((item) => ({
      ...item,
      mutationId: item.mutationId ?? null,
      baseVersion: item.baseVersion ?? null,
      payloadHash: item.payloadHash ?? null,
      status: item.status ?? "pending",
      retryCount: item.retryCount ?? 0,
      lastAttemptAt: item.lastAttemptAt ?? null,
      nextRetryAt: item.nextRetryAt ?? null,
      lastError: item.lastError ?? null,
      conflictData: item.conflictData ?? null,
    }));
  } catch {
    return [];
  }
}

export async function removeAction(id: string) {
  if (!isBrowser()) return;
  await withStore(QUEUE_STORE, "readwrite", (store) => store.delete(id));
}

export async function clearOfflineData(): Promise<void> {
  if (!isBrowser()) return;
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      console.log("[IndexedDB] Offline database deleted successfully.");
      resolve();
    };
    request.onerror = () => {
      console.error("[IndexedDB] Error deleting offline database:", request.error);
      reject(request.error ?? new Error("Failed to delete offline database"));
    };
  });
}

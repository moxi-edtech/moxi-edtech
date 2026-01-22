const DB_NAME = "klasse-offline";
const DB_VERSION = 1;
const SNAPSHOT_STORE = "snapshots";
const QUEUE_STORE = "queue";

export type SnapshotRecord<T> = {
  key: string;
  payload: T;
  updatedAt: string;
};

export type OfflineQueueItem = {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  type: string;
  createdAt: string;
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
    return items ?? [];
  } catch {
    return [];
  }
}

export async function removeAction(id: string) {
  if (!isBrowser()) return;
  await withStore(QUEUE_STORE, "readwrite", (store) => store.delete(id));
}

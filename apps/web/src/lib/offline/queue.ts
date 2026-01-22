import { enqueueAction, listActions, removeAction, type OfflineQueueItem } from "./store";

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function enqueueOfflineAction(
  item: Omit<OfflineQueueItem, "id" | "createdAt">
): Promise<OfflineQueueItem> {
  const queued: OfflineQueueItem = {
    ...item,
    id: createId(),
    createdAt: new Date().toISOString(),
  };
  await enqueueAction(queued);
  return queued;
}

export async function processOfflineQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const queue = await listActions();
  const ordered = [...queue].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const item of ordered) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body ?? undefined,
      });
      if (!res.ok) {
        break;
      }
      await removeAction(item.id);
    } catch {
      break;
    }
  }
}

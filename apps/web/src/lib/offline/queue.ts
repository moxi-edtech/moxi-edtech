import { enqueueAction, listActions, removeAction, type OfflineQueueItem } from "./store";

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function enqueueOfflineAction(
  item: Omit<
    OfflineQueueItem,
    | "id"
    | "createdAt"
    | "status"
    | "retryCount"
    | "lastAttemptAt"
    | "nextRetryAt"
    | "lastError"
    | "conflictData"
    | "mutationId"
    | "baseVersion"
    | "payloadHash"
  > & {
    mutationId?: string | null;
    baseVersion?: number | null;
    payloadHash?: string | null;
  }
): Promise<OfflineQueueItem> {
  const queued: OfflineQueueItem = {
    ...item,
    id: createId(),
    createdAt: new Date().toISOString(),
    mutationId: item.mutationId ?? null,
    baseVersion: item.baseVersion ?? null,
    payloadHash: item.payloadHash ?? null,
    status: "pending",
    retryCount: 0,
    lastAttemptAt: null,
    nextRetryAt: null,
    lastError: null,
    conflictData: null,
  };
  await enqueueAction(queued);
  return queued;
}

export async function processOfflineQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const queue = await listActions();

  // Filter items: only process items that are pending, and have reached their nextRetryAt time
  const eligible = queue.filter((item) => {
    if (item.status === "conflict" || item.status === "synced" || item.status === "failed") {
      return false;
    }
    if (item.nextRetryAt && new Date(item.nextRetryAt) > new Date()) {
      return false;
    }
    return true;
  });

  const ordered = [...eligible].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const item of ordered) {
    // 1. Mark as syncing
    item.status = "syncing";
    item.lastAttemptAt = new Date().toISOString();
    await enqueueAction(item);

    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body ?? undefined,
      });

      if (res.ok) {
        // Success
        await removeAction(item.id);
      } else if (res.status === 409) {
        // 409 Conflict - Stop processing queue to prevent out-of-order execution and wait for resolution
        item.status = "conflict";
        item.lastError = "Conflito (409)";
        try {
          const data = await res.json();
          item.conflictData = data;
        } catch {
          item.conflictData = { message: "Erro 409: Conflito no servidor" };
        }
        await enqueueAction(item);
        break;
      } else {
        // Server or other error (5xx, 400, etc.)
        await handleRetry(item, `Erro de requisição: Código ${res.status}`);
        break;
      }
    } catch (err) {
      // Network failure or fetch exception
      const errorMessage = err instanceof Error ? err.message : "Falha na conexão de rede";
      await handleRetry(item, errorMessage);
      break;
    }
  }
}

async function handleRetry(item: OfflineQueueItem, errorMessage: string) {
  item.retryCount += 1;
  item.lastError = errorMessage;

  if (item.retryCount >= 5) {
    item.status = "failed";
    item.nextRetryAt = null;
  } else {
    item.status = "pending";
    // Exponential backoff: 30s, 60s, 120s, 240s...
    const backoffSeconds = Math.pow(2, item.retryCount) * 15;
    const nextRetry = new Date();
    nextRetry.setSeconds(nextRetry.getSeconds() + backoffSeconds);
    item.nextRetryAt = nextRetry.toISOString();
  }

  await enqueueAction(item);
}

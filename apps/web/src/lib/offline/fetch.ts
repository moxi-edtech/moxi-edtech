import { readSnapshot, saveSnapshot } from "./store";

export type OfflineFetchResult<T> = {
  data: T | null;
  fromCache: boolean;
  updatedAt: string | null;
};

export async function fetchJsonWithOffline<T>(
  url: string,
  init?: RequestInit,
  cacheKey?: string
): Promise<OfflineFetchResult<T>> {
  const key = cacheKey || url;
  try {
    const res = await fetch(url, init);
    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json() : null;
    if (!res.ok) {
      const message = data?.error || data?.message || "Falha ao carregar dados.";
      throw new Error(message);
    }
    await saveSnapshot(key, data);
    return { data: data as T, fromCache: false, updatedAt: null };
  } catch {
    const cached = await readSnapshot<T>(key);
    if (cached) {
      return { data: cached.payload, fromCache: true, updatedAt: cached.updatedAt };
    }
    return { data: null, fromCache: true, updatedAt: null };
  }
}

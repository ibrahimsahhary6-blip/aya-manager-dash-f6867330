// Generic IndexedDB-backed cache for read queries.
// Cache-first: renders IndexedDB data instantly (0ms) and refreshes in the background.
import { openDB, type IDBPDatabase } from "idb";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";

const DB_NAME = "lovable-local-cache";
const STORE = "kv";
const NETWORK_TIMEOUT_MS = 2500;

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDB() {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

function keyOf(queryKey: QueryKey): string {
  return JSON.stringify(queryKey);
}

// In-memory mirror of IndexedDB so useCachedQuery can serve data
// synchronously on first render, without waiting for any async read.
const memory = new Map<string, unknown>();
let warmPromise: Promise<void> | null = null;

export function warmMemoryCache(): Promise<void> {
  if (warmPromise) return warmPromise;
  warmPromise = (async () => {
    const db = await getDB();
    if (!db) return;
    try {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      let cursor = await store.openCursor();
      while (cursor) {
        memory.set(String(cursor.key), cursor.value);
        cursor = await cursor.continue();
      }
    } catch {
      // ignore
    }
  })();
  return warmPromise;
}

// Kick off warming as early as possible.
if (typeof window !== "undefined") {
  warmMemoryCache().catch(() => undefined);
}

function readMemory<T>(queryKey: QueryKey): T | undefined {
  return memory.get(keyOf(queryKey)) as T | undefined;
}

export async function clearAllCache(): Promise<void> {
  memory.clear();
  const db = await getDB();
  if (!db) return;
  try {
    await db.clear(STORE);
  } catch {
    // ignore
  }
}

export async function readCache<T>(queryKey: QueryKey): Promise<T | undefined> {
  const mem = readMemory<T>(queryKey);
  if (mem !== undefined) return mem;
  const db = await getDB();
  if (!db) return undefined;
  const value = (await db.get(STORE, keyOf(queryKey))) as T | undefined;
  if (value !== undefined) memory.set(keyOf(queryKey), value);
  return value;
}

export async function writeCache<T>(queryKey: QueryKey, value: T): Promise<void> {
  memory.set(keyOf(queryKey), value);
  const db = await getDB();
  if (!db) return;
  await db.put(STORE, value, keyOf(queryKey));
}

export async function seedCacheIfMissing<T>(queryKey: QueryKey, value: T): Promise<void> {
  const existing = await readCache<T>(queryKey);
  if (existing === undefined) await writeCache(queryKey, value);
}

async function withNetworkTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("network timeout")), NETWORK_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Cache-first useQuery wrapper:
 * - Returns IndexedDB data synchronously via `initialData` (0ms first paint).
 * - Refetches in the background to update the cache (SWR).
 * - Never blocks the UI on the network; falls back to cache on any failure.
 */
export function useCachedQuery<T>(opts: {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  staleTime?: number;
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();

  const refreshInBackground = () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    withNetworkTimeout(opts.queryFn())
      .then((data) => {
        queryClient.setQueryData(opts.queryKey, data);
        writeCache(opts.queryKey, data).catch(() => undefined);
      })
      .catch(() => undefined);
  };

  return useQuery({
    queryKey: opts.queryKey,
    enabled: opts.enabled ?? true,
    networkMode: "always",
    // Serve cache synchronously on first render.
    initialData: () => readMemory<T>(opts.queryKey),
    // Treat initial data as stale so react-query refetches in background.
    initialDataUpdatedAt: 0,
    // SWR: show cached data instantly, refresh silently.
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const cached = (await readCache<T>(opts.queryKey)) as T | undefined;
      if (cached !== undefined) {
        refreshInBackground();
        return cached;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("offline cache miss");
      }
      try {
        const data = await withNetworkTimeout(opts.queryFn());
        writeCache(opts.queryKey, data).catch(() => undefined);
        return data;
      } catch (error) {
        if (cached !== undefined) return cached;
        throw error;
      }
    },
    staleTime: opts.staleTime ?? 60_000,
    retry: (failureCount, error) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return false;
      const msg = error instanceof Error ? error.message.toLowerCase() : "";
      if (msg.includes("failed to fetch") || msg.includes("network")) return false;
      return failureCount < 2;
    },
  });
}

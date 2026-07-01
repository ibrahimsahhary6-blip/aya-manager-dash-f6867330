// Generic IndexedDB-backed cache for read queries.
// Lets the app render lists (students, battalions, companies, departments)
// instantly from local storage, including while fully offline.
import { openDB, type IDBPDatabase } from "idb";
import { useEffect } from "react";
import { useQuery, type QueryKey, useQueryClient } from "@tanstack/react-query";

const DB_NAME = "lovable-local-cache";
const STORE = "kv";

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

export async function readCache<T>(queryKey: QueryKey): Promise<T | undefined> {
  const db = await getDB();
  if (!db) return undefined;
  return (await db.get(STORE, keyOf(queryKey))) as T | undefined;
}

export async function writeCache<T>(queryKey: QueryKey, value: T): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put(STORE, value, keyOf(queryKey));
}

/**
 * useQuery wrapper that hydrates from IndexedDB on mount and persists the
 * latest network result back to IndexedDB. Pages load instantly offline.
 */
export function useCachedQuery<T>(opts: {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  staleTime?: number;
}) {
  const qc = useQueryClient();

  // Hydrate cached data into react-query immediately on mount, before the
  // network query resolves. This makes the UI render from IndexedDB first.
  useEffect(() => {
    let cancelled = false;
    readCache<T>(opts.queryKey).then((cached) => {
      if (cancelled || cached === undefined) return;
      const existing = qc.getQueryData<T>(opts.queryKey);
      if (existing === undefined) qc.setQueryData(opts.queryKey, cached);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyOf(opts.queryKey)]);

  const q = useQuery({
    queryKey: opts.queryKey,
    networkMode: "always",
    queryFn: async () => {
      const cached = await readCache<T>(opts.queryKey);
      // When the device is offline, never wait for Supabase/fetch. Render the
      // last locally-saved data immediately and keep writes in the queue.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (cached !== undefined) return cached;
      }

      try {
        const data = await opts.queryFn();
        writeCache(opts.queryKey, data).catch(() => undefined);
        return data;
      } catch (error) {
        // If the network drops while the query is running, keep the offline UI
        // usable by falling back to IndexedDB instead of putting the page in an
        // error/loading state.
        const msg = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
        if (
          cached !== undefined &&
          (typeof navigator !== "undefined" && !navigator.onLine ||
            msg.includes("failed to fetch") ||
            msg.includes("network") ||
            msg.includes("fetch"))
        ) {
          return cached;
        }
        throw error;
      }
    },
    staleTime: opts.staleTime ?? 60_000,
    // Never throw on offline failure if we have something cached.
    retry: (failureCount, error) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return false;
      const msg = error instanceof Error ? error.message.toLowerCase() : "";
      if (msg.includes("failed to fetch") || msg.includes("network")) return false;
      return failureCount < 2;
    },
  });

  return q;
}

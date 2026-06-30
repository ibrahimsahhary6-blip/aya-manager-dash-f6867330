// Offline write queue backed by IndexedDB.
// Used to buffer attendance/recitation mutations when the device is offline,
// then flush them to Supabase once connectivity returns.
import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";

export type QueuedOp =
  | {
      kind: "attendance_upsert";
      payload: {
        student_id: string;
        attended_on: string;
        present: boolean;
        excused: boolean;
      };
    }
  | {
      kind: "attendance_delete";
      payload: { student_id: string; attended_on: string };
    }
  | {
      kind: "recitation_insert";
      payload: Record<string, unknown>;
    }
  | {
      kind: "recitation_update";
      payload: { id: string; patch: Record<string, unknown> };
    }
  | {
      kind: "recitation_delete";
      payload: { id: string };
    };


type StoredOp = QueuedOp & { id?: number; queued_at: number };

const DB_NAME = "lovable-offline-queue";
const STORE = "ops";

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDB() {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export async function pendingCount(): Promise<number> {
  const db = await getDB();
  if (!db) return 0;
  return db.count(STORE);
}

async function enqueue(op: QueuedOp) {
  const db = await getDB();
  if (!db) throw new Error("IndexedDB unavailable");
  const stored: StoredOp = { ...op, queued_at: Date.now() };
  await db.add(STORE, stored);
  notify();
}

async function executeOp(op: QueuedOp): Promise<void> {
  if (op.kind === "attendance_upsert") {
    const { error } = await supabase
      .from("attendance")
      .upsert(op.payload, { onConflict: "student_id,attended_on" });
    if (error) throw error;
  } else if (op.kind === "attendance_delete") {
    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("student_id", op.payload.student_id)
      .eq("attended_on", op.payload.attended_on);
    if (error) throw error;
  } else if (op.kind === "recitation_insert") {
    const { error } = await supabase.from("recitations").insert(op.payload as never);
    if (error) throw error;
  } else if (op.kind === "recitation_update") {
    const { error } = await supabase
      .from("recitations")
      .update(op.payload.patch as never)
      .eq("id", op.payload.id);
    if (error) throw error;
  } else if (op.kind === "recitation_delete") {
    const { error } = await supabase
      .from("recitations")
      .delete()
      .eq("id", op.payload.id);
    if (error) throw error;
  }
}

/**
 * Run an operation immediately if online; otherwise queue it for later flush.
 * Throws only if execution fails while online (so caller can show an error).
 */
export async function runOrQueue(op: QueuedOp): Promise<{ queued: boolean }> {
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  if (!online) {
    await enqueue(op);
    return { queued: true };
  }
  try {
    await executeOp(op);
    return { queued: false };
  } catch (e) {
    // If the failure looks like a network issue, queue it; otherwise rethrow.
    const msg = e instanceof Error ? e.message.toLowerCase() : "";
    if (msg.includes("failed to fetch") || msg.includes("network") || !navigator.onLine) {
      await enqueue(op);
      return { queued: true };
    }
    throw e;
  }
}

let flushing = false;
export async function flushQueue(): Promise<{ flushed: number; remaining: number }> {
  const db = await getDB();
  if (!db) return { flushed: 0, remaining: 0 };
  if (flushing) return { flushed: 0, remaining: await db.count(STORE) };
  flushing = true;
  let flushed = 0;
  try {
    while (true) {
      const all = (await db.getAll(STORE)) as StoredOp[];
      if (all.length === 0) break;
      const next = all[0];
      try {
        await executeOp(next);
        if (next.id !== undefined) await db.delete(STORE, next.id);
        flushed += 1;
      } catch (e) {
        // Stop on first failure to avoid spinning; will retry on next online event.
        console.warn("[offline-queue] flush failed, will retry later", e);
        break;
      }
    }
  } finally {
    flushing = false;
    notify();
  }
  return { flushed, remaining: await db.count(STORE) };
}

// Simple subscriber list so the indicator can refresh badge counts.
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}
export function subscribeQueue(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Auto-flush whenever the browser reports we're back online.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushQueue().catch(() => undefined);
  });
}

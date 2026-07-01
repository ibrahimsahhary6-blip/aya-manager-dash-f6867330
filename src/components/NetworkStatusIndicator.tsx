import { useEffect, useState } from "react";
import { Wifi, WifiOff, CloudUpload } from "lucide-react";
import { flushQueue, pendingCount, subscribeQueue } from "@/lib/offline-queue";
import { subscribeOfflineSync, syncAllOfflineData, type OfflineSyncState } from "@/lib/offline-sync";

// Verify real connectivity when possible. Some mobile/PWA/preview environments
// block no-store probes even while the app is online, so probe failure must not
// by itself force the visible state to "offline".
async function probeOnline(): Promise<boolean> {
  if (typeof window !== "undefined" && !navigator.onLine) return false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    // Same-origin small asset; cache-bust to avoid SW cached response.
    const res = await fetch(`/manifest.webmanifest?_=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return res.ok || res.status === 304;
  } catch {
    return false;
  }
}

export function NetworkStatusIndicator() {
  const [browserOnline, setBrowserOnline] = useState(
    typeof window === "undefined" ? true : navigator.onLine,
  );
  const [pending, setPending] = useState(0);
  const [syncState, setSyncState] = useState<OfflineSyncState>({
    status: "idle",
    message: "",
    progress: 0,
    total: 0,
    lastSyncedAt: null,
  });

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const currentlyOnline = typeof window === "undefined" ? true : navigator.onLine;
      setBrowserOnline(currentlyOnline);

      // Keep the UI online whenever the browser reports online. If the later
      // probe succeeds, we also flush the queue; if it fails, we avoid showing
      // a false "غير متصل" badge because writes can still queue on real errors.
      if (!currentlyOnline) return pendingCount().then((n) => !cancelled && setPending(n));

      const ok = await probeOnline();
      if (cancelled) return;

      if (ok) {
        await flushQueue().catch(() => undefined);
        await syncAllOfflineData().catch(() => undefined);
      }
      pendingCount().then((n) => !cancelled && setPending(n));
    };

    const handleOnline = () => refresh();
    const handleOffline = () => {
      setBrowserOnline(false);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    pendingCount().then((n) => !cancelled && setPending(n));
    refresh();

    const interval = setInterval(refresh, 5000);
    const unsub = subscribeQueue(() => pendingCount().then((n) => !cancelled && setPending(n)));
    const unsubSync = subscribeOfflineSync((next) => !cancelled && setSyncState(next));

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsub();
      unsubSync();
      clearInterval(interval);
    };
  }, []);

  if (browserOnline && pending === 0 && syncState.status !== "syncing") {
    // Hide when everything is fine to reduce visual noise.
    return null;
  }

  const isSyncing = browserOnline && (pending > 0 || syncState.status === "syncing");
  const color = isSyncing
    ? "bg-amber-500 text-white"
    : browserOnline
      ? "bg-emerald-600 text-white"
      : "bg-orange-500 text-white";
  const Icon = isSyncing ? CloudUpload : browserOnline ? Wifi : WifiOff;
  const label = isSyncing
    ? syncState.status === "syncing"
      ? syncState.message || "جاري تجهيز البيانات بدون إنترنت…"
      : `جاري المزامنة… (${pending})`
    : browserOnline
      ? "متصل"
      : pending > 0
        ? `غير متصل — ${pending} عملية محفوظة محلياً`
        : "غير متصل";

  return (
    <div
      className={`fixed bottom-4 inset-x-0 z-50 flex justify-center pointer-events-none print:hidden`}
      dir="rtl"
    >
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-lg ${color}`}
        role="status"
        aria-live="polite"
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
    </div>
  );
}

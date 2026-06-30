import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff, CloudUpload } from "lucide-react";
import { flushQueue, pendingCount, subscribeQueue } from "@/lib/offline-queue";

// Verify real connectivity (navigator.onLine can be wrong on mobile/PWA).
async function probeOnline(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
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
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [pending, setPending] = useState(0);
  const failedChecks = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      // If the browser itself says we are online, do not leave a stale
      // "offline" badge visible while the stronger network probe is running.
      if (typeof navigator !== "undefined" && navigator.onLine) {
        setOnline(true);
      }

      const ok = await probeOnline();
      if (cancelled) return;

      if (ok) {
        failedChecks.current = 0;
        setOnline(true);
      } else {
        failedChecks.current += 1;
        // Avoid false "offline" on mobile/PWA/preview when a single probe is blocked
        // or slow. Show offline immediately only when the browser confirms it.
        if ((typeof navigator !== "undefined" && !navigator.onLine) || failedChecks.current >= 2) {
          setOnline(false);
        }
      }

      if (ok) {
        await flushQueue().catch(() => undefined);
      }
      pendingCount().then((n) => !cancelled && setPending(n));
    };

    const handleOnline = () => refresh();
    const handleOffline = () => {
      failedChecks.current = 2;
      setOnline(false);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    pendingCount().then((n) => !cancelled && setPending(n));
    refresh();

    const interval = setInterval(refresh, 5000);
    const unsub = subscribeQueue(() => pendingCount().then((n) => !cancelled && setPending(n)));

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsub();
      clearInterval(interval);
    };
  }, []);

  if (online && pending === 0) {
    // Hide when everything is fine to reduce visual noise.
    return null;
  }

  const isSyncing = online && pending > 0;
  const color = isSyncing
    ? "bg-amber-500 text-white"
    : online
      ? "bg-emerald-600 text-white"
      : "bg-orange-500 text-white";
  const Icon = isSyncing ? CloudUpload : online ? Wifi : WifiOff;
  const label = isSyncing
    ? `جاري المزامنة… (${pending})`
    : online
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

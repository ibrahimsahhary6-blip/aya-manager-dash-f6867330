import { useEffect, useState } from "react";
import { Wifi, WifiOff, CloudUpload } from "lucide-react";
import { flushQueue, pendingCount, subscribeQueue } from "@/lib/offline-queue";

export function NetworkStatusIndicator() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      flushQueue().then(() => pendingCount().then(setPending));
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    pendingCount().then(setPending);
    const unsub = subscribeQueue(() => pendingCount().then(setPending));
    const interval = setInterval(() => pendingCount().then(setPending), 5000);
    return () => {
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

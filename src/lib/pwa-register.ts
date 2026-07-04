// Guarded service-worker registration wrapper.
// Never registers in dev, Lovable preview, iframes, or when ?sw=off is set;
// unregisters any stale registration in those contexts.
const APP_SW_URL = "/sw.js";
const STALE_APP_SW_URLS = ["/app-sw.js"];
const KNOWN_SW_URLS = [APP_SW_URL, ...STALE_APP_SW_URLS];

function isPreviewHost(hostname: string): boolean {
  if (hostname.startsWith("id-preview--") || hostname.startsWith("preview--")) return true;
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return true;
  if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com"))
    return true;
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return true;
  return false;
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs.map((r) => {
      const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
      if (KNOWN_SW_URLS.some((swUrl) => url.endsWith(swUrl))) return r.unregister();
      return Promise.resolve();
    }),
  );
}

async function unregisterStaleAppWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs.map((r) => {
      const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
      if (STALE_APP_SW_URLS.some((swUrl) => url.endsWith(swUrl))) return r.unregister();
      return Promise.resolve();
    }),
  );
}

export async function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const refused =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    isPreviewHost(window.location.hostname) ||
    url.searchParams.get("sw") === "off";

  if (refused) {
    await unregisterMatching().catch(() => undefined);
    return;
  }

  try {
    await unregisterStaleAppWorkers().catch(() => undefined);
    const { Workbox } = await import("workbox-window");
    const wb = new Workbox(APP_SW_URL);
    wb.addEventListener("waiting", () => {
      wb.messageSkipWaiting();
    });
    wb.addEventListener("controlling", () => {
      window.location.reload();
    });
    await wb.register();
  } catch (e) {
    console.warn("[pwa] registration failed", e);
  }
}

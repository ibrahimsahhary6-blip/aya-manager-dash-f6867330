import { useEffect, useState, useCallback } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type InstallStatus = "installed" | "available" | "manual";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function getManualInstructions(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/i.test(ua);
  if (isIOS) {
    return "افتح التطبيق في متصفح Safari، ثم اضغط زر المشاركة (⬆️) في الأسفل، واختر 'إضافة إلى الشاشة الرئيسية'.";
  }
  if (isAndroid) {
    return "اضغط قائمة المتصفح (⋮) أعلى اليمين، ثم اختر 'تثبيت التطبيق' أو 'Add to Home screen'. تأكد أنك تستخدم Chrome وليس تطبيقاً داخلياً.";
  }
  return "اضغط أيقونة التثبيت في شريط العنوان بجانب رابط الموقع، أو اختر 'تثبيت التطبيق' من قائمة المتصفح.";
}

export function usePWAInstall() {
  const [status, setStatus] = useState<InstallStatus>("manual");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [manualMessage, setManualMessage] = useState<string>("");
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setManualMessage(getManualInstructions());

    if (isStandalone()) {
      setStatus("installed");
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setStatus("available");
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setStatus("installed");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setStatus("installed");
        }
        setDeferredPrompt(null);
      } catch {
        setShowInstructions(true);
      }
      return;
    }
    setShowInstructions(true);
  }, [deferredPrompt]);

  return {
    status,
    manualMessage,
    showInstructions,
    setShowInstructions,
    promptInstall,
    canPromptDirectly: deferredPrompt !== null,
  };
}

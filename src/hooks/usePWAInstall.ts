import { useEffect, useState, useCallback } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type InstallState =
  | { type: "unsupported"; message: string }
  | { type: "installed"; message: string }
  | { type: "available"; prompt: () => Promise<void> }
  | { type: "idle" };

function getIOSInstallMessage(): string {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (!isSafari) {
    return "افتح التطبيق في Safari، ثم اضغط زر المشاركة واختر 'إضافة إلى الشاشة الرئيسية'.";
  }
  return "اضغط زر المشاركة في أسفل الشاشة، ثم اختر 'إضافة إلى الشاشة الرئيسية'.";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function usePWAInstall() {
  const [installState, setInstallState] = useState<InstallState>({ type: "idle" });
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isStandalone()) {
      setInstallState({ type: "installed", message: "التطبيق مثبت بالفعل على جهازك." });
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: boolean }).MSStream;
    if (isIOS && !("BeforeInstallPromptEvent" in window)) {
      setInstallState({ type: "unsupported", message: getIOSInstallMessage() });
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallState({
        type: "available",
        prompt: async () => {
          const promptEvent = e as BeforeInstallPromptEvent;
          promptEvent.prompt();
          const choice = await promptEvent.userChoice;
          if (choice.outcome === "accepted") {
            setInstallState({ type: "installed", message: "تم تثبيت التطبيق بنجاح." });
          } else {
            setInstallState({
              type: "available",
              prompt: async () => {
                setInstallState({
                  type: "unsupported",
                  message: "يرجى استخدام زر التثبيت في شريط العنوان (⋮ > تثبيت التطبيق).",
                });
              },
            });
          }
          setDeferredPrompt(null);
        },
      });
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setInstallState({ type: "installed", message: "تم تثبيت التطبيق بنجاح." });
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // If no event fires within a short window and we're not on iOS, show generic guidance.
    const timer = window.setTimeout(() => {
      setInstallState((prev) => {
        if (prev.type !== "idle") return prev;
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (isAndroid) {
          return {
            type: "unsupported",
            message: "اضغط القائمة (⋮) أعلى اليمين، ثم اختر 'تثبيت التطبيق' أو 'Add to Home screen'.",
          };
        }
        return {
          type: "unsupported",
          message: "اضغط أيقونة التثبيت في شريط العنوان، أو اختر 'تثبيت التطبيق' من قائمة المتصفح.",
        };
      });
    }, 3500);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (installState.type === "available") {
      await installState.prompt();
    }
  }, [installState]);

  return { installState, promptInstall, deferredPrompt };
}

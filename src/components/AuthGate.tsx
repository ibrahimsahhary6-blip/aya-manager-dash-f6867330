import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { seedCacheIfMissing, warmMemoryCache } from "@/lib/local-cache";
import { syncAllOfflineData } from "@/lib/offline-sync";

const OFFLINE_SESSION_KEY = "offline-auth-session-v1";
const DEFAULT_DEPARTMENT_ID = "offline-default-department";

function readCachedSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Session | null;
      if (parsed?.user?.id) return parsed;
    }

    // Older installed versions only have the backend auth cache. Read it as a
    // fallback so returning users can open the app offline immediately after update.
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i) ?? "";
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const stored = JSON.parse(window.localStorage.getItem(key) ?? "null") as Session | null;
      if (stored?.user?.id) return stored;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCachedSession(session: Session | null) {
  if (typeof window === "undefined" || !session?.user?.id) return;
  try {
    window.localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore storage failures
  }
}

async function seedOfflineDefaults(userId: string) {
  await Promise.all([
    seedCacheIfMissing(["departments"], [
      { id: DEFAULT_DEPARTMENT_ID, name: "القسم الافتراضي", sort_order: 1, created_at: new Date().toISOString() },
    ]),
    seedCacheIfMissing(["battalions"], []),
    seedCacheIfMissing(["companies"], []),
    seedCacheIfMissing(["students"], []),
    seedCacheIfMissing(["is-admin", userId], false),
    seedCacheIfMissing(["is-super-admin", userId], false),
    seedCacheIfMissing(["setting", "admins_can_manage_students"], true),
    seedCacheIfMissing(["setting", "users_can_manage_students"], true),
    seedCacheIfMissing(["user-department-access", userId], { allowedIds: [] as string[], all: false }),
  ]);
}

async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("network timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isPublicRoute = pathname.startsWith("/reset-password") || pathname.startsWith("/lookup");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let signedOut = false;
    const initialCachedSession = readCachedSession();
    const finishSessionCheck = (nextSession: Session | null) => {
      if (cancelled) return;
      if (nextSession) writeCachedSession(nextSession);
      const cached = signedOut ? null : (initialCachedSession ?? readCachedSession());
      setSession(nextSession ?? cached);
      setLoading(false);
    };

    // Warm the in-memory cache from IndexedDB so pages paint instantly.
    warmMemoryCache().catch(() => undefined);

    // If we already have a cached session, render immediately (cache-first).
    if (initialCachedSession) {
      setSession(initialCachedSession);
      setLoading(false);
    }

    const fallbackTimer = window.setTimeout(() => finishSessionCheck(initialCachedSession), 1500);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      clearTimeout(fallbackTimer);
      if (event === "SIGNED_OUT") {
        signedOut = true;
        try { window.localStorage.removeItem(OFFLINE_SESSION_KEY); } catch { /* ignore */ }
      }
      finishSessionCheck(s);
    });
    withTimeout(supabase.auth.getSession(), 1500)
      .then(({ data }) => {
        clearTimeout(fallbackTimer);
        finishSessionCheck(data.session);
      })
      .catch(() => finishSessionCheck(initialCachedSession))
      .finally(() => {
        clearTimeout(fallbackTimer);
      });
    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    seedOfflineDefaults(session.user.id).catch(() => undefined);
    if (typeof navigator === "undefined" || navigator.onLine) {
      syncAllOfflineData().catch(() => undefined);
    }
  }, [session]);


  if (isPublicRoute) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  return <>{children}</>;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetEmail, setResetEmail] = useState("");

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("تم تسجيل الدخول");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك");
      setMode("login");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (mode === "forgot") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>نسيت كلمة المرور</CardTitle>
            <CardDescription>
              أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">البريد الإلكتروني</Label>
                <Input
                  id="reset-email"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  dir="ltr"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "..." : "إرسال الرابط"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode("login")}
              >
                العودة لتسجيل الدخول
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>تسجيل الدخول</CardTitle>
          <CardDescription>
            أدخل البريد الإلكتروني وكلمة المرور التي زوّدك بها المدير
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "..." : "دخول"}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-primary hover:underline"
              onClick={() => {
                setResetEmail(email);
                setMode("forgot");
              }}
            >
              نسيت كلمة المرور؟
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


export function LogoutButton() {
  return (
    <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
      تسجيل الخروج
    </Button>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { notifyFirstLogin } from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { seedCacheIfMissing } from "@/lib/local-cache";
import { syncAllOfflineData } from "@/lib/offline-sync";

type ApprovalStatus = "checking" | "approved" | "pending" | "error";

const APPROVAL_CACHE_PREFIX = "approved-user-v1:";
const DEFAULT_DEPARTMENT_ID = "offline-default-department";

function approvalCacheKey(userId: string) {
  return `${APPROVAL_CACHE_PREFIX}${userId}`;
}

function readCachedApproval(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(approvalCacheKey(userId)) === "1";
  } catch {
    return false;
  }
}

function writeCachedApproval(userId: string, approved: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (approved) window.localStorage.setItem(approvalCacheKey(userId), "1");
    else window.localStorage.removeItem(approvalCacheKey(userId));
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

function isOfflineLikeError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timeout") || msg.includes("fetch");
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
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
  const [approval, setApproval] = useState<ApprovalStatus>("checking");
  const notify = useServerFn(notifyFirstLogin);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    withTimeout(supabase.auth.getSession(), 2500)
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setApproval("checking");
      return;
    }
    setApproval("checking");
    (async () => {
      const cachedApproval = readCachedApproval(session.user.id);
      if (typeof navigator !== "undefined" && !navigator.onLine && cachedApproval) {
        setApproval("approved");
        return;
      }
      let result: Awaited<ReturnType<typeof supabase.from<"profiles">>> | null = null;
      try {
        result = await withTimeout(
          supabase
            .from("profiles")
            .select("is_approved")
            .eq("user_id", session.user.id)
            .maybeSingle(),
          4500,
        );
      } catch (error) {
        if (cachedApproval || isOfflineLikeError(error)) {
          await seedOfflineDefaults(session.user.id).catch(() => undefined);
          setApproval("approved");
          return;
        }
        setApproval("error");
        return;
      }
      const { data, error } = result;
      if (error) {
        if (cachedApproval || isOfflineLikeError(error)) {
          await seedOfflineDefaults(session.user.id).catch(() => undefined);
          setApproval("approved");
          return;
        }
        setApproval("error");
        return;
      }
      const approved = Boolean(data?.is_approved);
      writeCachedApproval(session.user.id, approved);
      if (approved) {
        seedOfflineDefaults(session.user.id).catch(() => undefined);
        if (typeof navigator === "undefined" || navigator.onLine) {
          syncAllOfflineData().catch(() => undefined);
        }
      }
      setApproval(approved ? "approved" : "pending");
      notify({}).catch(() => {});
    })();
  }, [session, notify]);

  if (isPublicRoute) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  if (approval === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">جاري التحقق من الحساب...</p>
      </div>
    );
  }

  if (approval !== "approved") {
    if (approval === "error") {
      return <OfflineApprovalError />;
    }
    return <PendingScreen email={session.user.email ?? ""} />;
  }

  return <>{children}</>;
}

function OfflineApprovalError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>تعذر فتح الحساب بدون اتصال</CardTitle>
          <CardDescription>
            افتح التطبيق مرة واحدة وأنت متصل حتى يتم حفظ صلاحية الحساب، ثم سيعمل لاحقاً بدون إنترنت.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
            إعادة المحاولة
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PendingScreen({ email }: { email: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>بانتظار موافقة المدير</CardTitle>
          <CardDescription>
            حسابك ({email}) بانتظار موافقة المدير لتفعيل الدخول.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full" onClick={() => supabase.auth.signOut()}>
            تسجيل الخروج
          </Button>
        </CardContent>
      </Card>
    </div>
  );
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

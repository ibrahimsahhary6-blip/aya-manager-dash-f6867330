import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

type ApprovalStatus = "checking" | "approved" | "pending" | "error";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [approval, setApproval] = useState<ApprovalStatus>("checking");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setApproval("checking");
      return;
    }
    setApproval("checking");
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_approved")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) {
        setApproval("error");
        return;
      }
      setApproval(data?.is_approved ? "approved" : "pending");
    })();
  }, [session]);

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
    return <PendingScreen email={session.user.email ?? ""} />;
  }

  return <>{children}</>;
}

function PendingScreen({ email }: { email: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>بانتظار موافقة المدير</CardTitle>
          <CardDescription>
            تم تسجيل حسابك بنجاح ({email}) وهو الآن بانتظار موافقة المدير لتفعيل الدخول.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            سيتم إعلامك عند تفعيل الحساب. يمكنك إغلاق الصفحة والعودة لاحقاً.
          </p>
          <Button variant="outline" className="w-full" onClick={() => supabase.auth.signOut()}>
            تسجيل الخروج
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("تم تسجيل الدخول");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب — بانتظار موافقة المدير");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}</CardTitle>
          <CardDescription>منصة إدارة حلقات القرآن</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "..." : mode === "login" ? "دخول" : "إنشاء"}
            </Button>
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground text-center">
                ملاحظة: يتطلب الحساب الجديد موافقة المدير قبل التفعيل.
              </p>
            )}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              {mode === "login" ? "ليس لديك حساب؟ أنشئ حساباً" : "لديك حساب؟ سجل الدخول"}
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

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { notifyFirstLogin } from "@/lib/admin-users.functions";
import { submitAccessRequest, requestLoginLink } from "@/lib/access-requests.functions";
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
  const notify = useServerFn(notifyFirstLogin);

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
      // Fire-and-forget first-login notification
      notify({}).catch(() => {});
    })();
  }, [session, notify]);

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
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState<null | "pending" | "magic_link_sent" | "not_approved">(null);
  const submitRequest = useServerFn(submitAccessRequest);
  const requestLink = useServerFn(requestLoginLink);

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
      const res = await submitRequest({ data: { email, fullName, redirectTo } });
      setSubmittedStatus(res.status);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResendLink = async () => {
    if (!email) return;
    setBusy(true);
    try {
      const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
      const res = await requestLink({ data: { email, redirectTo } });
      if (res.status === "sent") {
        setSubmittedStatus("magic_link_sent");
        toast.success("تم إرسال رابط الدخول إلى بريدك");
      } else {
        toast.error("هذا الحساب ليس مصرحاً له بعد. أرسل طلب دخول أولاً.");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (submittedStatus === "magic_link_sent") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>تحقق من بريدك الإلكتروني</CardTitle>
            <CardDescription>
              أرسلنا رابط دخول إلى <span dir="ltr">{email}</span>. اضغط عليه من بريدك لتسجيل الدخول.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => setSubmittedStatus(null)}>
              العودة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submittedStatus === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>تم إرسال طلبك</CardTitle>
            <CardDescription>
              وصل طلبك إلى المدير. ستتلقى رابط دخول على <span dir="ltr">{email}</span> فور الموافقة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => setSubmittedStatus(null)}>
              العودة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>طلب الدخول إلى المنصة</CardTitle>
          <CardDescription>
            أدخل بريدك واسمك ليصل طلبك إلى المدير. بعد الموافقة سيصلك رابط دخول مباشر بالبريد.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRequest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">الاسم الكامل</Label>
              <Input
                id="fullName"
                required
                minLength={2}
                maxLength={120}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
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
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "..." : "إرسال طلب الدخول"}
            </Button>
            <button
              type="button"
              onClick={handleResendLink}
              disabled={busy || !email}
              className="block w-full text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
            >
              لدي حساب مصرّح به — أرسل لي رابط دخول
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

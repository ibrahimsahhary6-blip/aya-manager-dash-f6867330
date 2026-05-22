import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        // PKCE flow: exchange ?code= for a session
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          url.searchParams.delete("code");
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
          setReady(true);
          return;
        }
        // Implicit flow fallback: tokens in hash (#access_token=...&type=recovery)
        if (window.location.hash.includes("access_token")) {
          // supabase-js auto-detects and fires SIGNED_IN; just wait
          const { data } = await supabase.auth.getSession();
          if (data.session) setReady(true);
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (data.session) setReady(true);
        else toast.error("رابط الاستعادة غير صالح أو منتهي الصلاحية");
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    })();

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      toast.error("كلمة المرور يجب أن تكون 4 أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      toast.error("كلمة المرور وتأكيدها غير متطابقتين");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("تم تحديث كلمة المرور");
      await supabase.auth.signOut();
      navigate({ to: "/" });
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
          <CardTitle>إعادة تعيين كلمة المرور</CardTitle>
          <CardDescription>
            {ready
              ? "أدخل كلمة المرور الجديدة"
              : "جاري التحقق من رابط الاستعادة..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ready && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new">كلمة المرور الجديدة</Label>
                <Input
                  id="new"
                  type="password"
                  required
                  minLength={4}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  minLength={4}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  dir="ltr"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "..." : "حفظ كلمة المرور الجديدة"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

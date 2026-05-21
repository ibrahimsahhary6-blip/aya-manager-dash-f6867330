import { useEffect, useState } from "react";
import { LogOut, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function AccountCard() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) =>
      setEmail(s?.user?.email ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("تعذّر تسجيل الخروج");
    else toast.success("تم تسجيل الخروج");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
          الحساب الحالي
        </CardTitle>
        <CardDescription>
          سجّل الخروج لتبديل الحساب أو الدخول بإيميل آخر.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">مسجّل الدخول كـ</div>
          <div className="text-sm font-medium truncate" dir="ltr">{email ?? "..."}</div>
        </div>
        <Button variant="destructive" onClick={handleLogout} className="gap-2 shrink-0">
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </Button>
      </CardContent>
    </Card>
  );
}

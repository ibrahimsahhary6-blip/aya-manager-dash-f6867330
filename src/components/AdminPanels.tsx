import { useIsAdmin } from "@/lib/roles";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { Mail, ShieldCheck, UserCheck } from "lucide-react";

export function NotificationEmailCard() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["app_settings", "notification_email"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "notification_email")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as string | undefined) ?? "";
    },
  });

  const [email, setEmail] = useState("");
  useEffect(() => {
    if (typeof data === "string") setEmail(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async (value: string) => {
      const trimmed = value.trim();
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          { key: "notification_email", value: trimmed, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ إيميل الإدارة");
      qc.invalidateQueries({ queryKey: ["app_settings", "notification_email"] });
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  return (
    <section className="bg-card rounded-2xl border shadow-soft p-4 sm:p-6 lg:col-span-2">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-bold">إيميل الإدارة</h2>
          <p className="text-xs text-muted-foreground">
            الإيميل المخصص لاستلام تنبيهات الموافقة على الحسابات الجديدة
          </p>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!isAdmin) return;
          save.mutate(email);
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <div className="flex-1 space-y-1">
          <Label htmlFor="notif-email" className="sr-only">إيميل الإدارة</Label>
          <Input
            id="notif-email"
            type="email"
            dir="ltr"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!isAdmin || isLoading}
            maxLength={255}
          />
        </div>
        <Button type="submit" disabled={!isAdmin || save.isPending}>
          {save.isPending ? "جارٍ الحفظ..." : "حفظ"}
        </Button>
      </form>
      {!isAdmin && (
        <p className="mt-2 text-xs text-muted-foreground">
          هذا الإعداد متاح للمدير فقط.
        </p>
      )}
    </section>
  );
}

export function PendingApprovalsCard() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["pending_profiles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, created_at, is_approved")
        .eq("is_approved", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_approved: true, approved_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تفعيل الحساب");
      qc.invalidateQueries({ queryKey: ["pending_profiles"] });
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  if (!isAdmin) return null;

  return (
    <section className="bg-card rounded-2xl border shadow-soft p-4 sm:p-6 lg:col-span-2">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-bold">طلبات الدخول بانتظار الموافقة</h2>
          <p className="text-xs text-muted-foreground">
            عدد الطلبات: {pending.length}
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد طلبات معلّقة.</p>
      ) : (
        <ul className="divide-y border rounded-xl overflow-hidden">
          {pending.map((p) => (
            <li
              key={p.user_id}
              className="flex items-center justify-between gap-3 px-4 py-3 bg-background"
            >
              <div className="min-w-0">
                <div className="font-medium text-sm truncate" dir="ltr">
                  {p.email ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleString("ar-EG")}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => approve.mutate(p.user_id)}
                disabled={approve.isPending}
                className="gap-1"
              >
                <UserCheck className="h-4 w-4" />
                موافقة
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

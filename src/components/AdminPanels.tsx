import { useIsAdmin, useIsSuperAdmin } from "@/lib/roles";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { inviteUser } from "@/lib/admin-users.functions";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { Mail, ShieldCheck, UserCheck, UserPlus, Trash2 } from "lucide-react";

export function NotificationEmailCard() {
  const isSuperAdmin = useIsSuperAdmin();
  if (!isSuperAdmin) return null;
  return <NotificationEmailCardInner />;
}

function NotificationEmailCardInner() {
  const isAdmin = true;
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
            الإيميل المخصص لاستلام تنبيهات الدخول والموافقات
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

export function InviteUserCard() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const invite = useServerFn(inviteUser);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: allowed = [], isLoading } = useQuery({
    queryKey: ["allowed_emails"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allowed_emails")
        .select("id, email, invited_at, notes")
        .order("invited_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("allowed_emails").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الإيميل من القائمة");
      qc.invalidateQueries({ queryKey: ["allowed_emails"] });
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  if (!isAdmin) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await invite({ data: { email: trimmed } });
      if (res.warning) toast.warning(`تمت الإضافة للقائمة، لكن تعذّر إرسال الدعوة: ${res.warning}`);
      else if (res.alreadyExists) toast.success("تمت الإضافة للقائمة (الحساب موجود مسبقاً)");
      else toast.success("تمت إضافة الإيميل وإرسال الدعوة");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["allowed_emails"] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-card rounded-2xl border shadow-soft p-4 sm:p-6 lg:col-span-2">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <UserPlus className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-bold">إضافة مستخدم جديد</h2>
          <p className="text-xs text-muted-foreground">
            أدخل الإيميل ليُضاف إلى قائمة المصرح لهم وتُرسل له دعوة
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 mb-4">
        <Input
          type="email"
          dir="ltr"
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={255}
          required
          className="flex-1"
        />
        <Button type="submit" disabled={busy} className="gap-1">
          <UserPlus className="h-4 w-4" />
          {busy ? "جارٍ الإرسال..." : "دعوة"}
        </Button>
      </form>

      <div>
        <h3 className="text-sm font-semibold mb-2">الإيميلات المصرح لها ({allowed.length})</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : allowed.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد إيميلات في القائمة بعد.</p>
        ) : (
          <ul className="divide-y border rounded-xl overflow-hidden">
            {allowed.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 py-2 bg-background"
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate" dir="ltr">{a.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(a.invited_at).toLocaleString("ar-EG")}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove.mutate(a.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
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

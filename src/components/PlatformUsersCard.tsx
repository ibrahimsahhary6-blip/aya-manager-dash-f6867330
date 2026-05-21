import { useIsSuperAdmin } from "@/lib/roles";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { setUserRole, removePlatformUser } from "@/lib/admin-users.functions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { Users, Trash2, ShieldAlert } from "lucide-react";

type AppRole = "admin" | "moderator" | "viewer" | "user" | "super_admin";

const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "مدير عام",
  admin: "مدير",
  moderator: "مشرف",
  viewer: "قراءة فقط",
  user: "مستخدم",
};

export function PlatformUsersCard() {
  const isSuperAdmin = useIsSuperAdmin();
  const qc = useQueryClient();
  const setRole = useServerFn(setUserRole);
  const removeUser = useServerFn(removePlatformUser);
  const [removing, setRemoving] = useState<{ id: string; email: string } | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["platform_users"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, email, is_approved, first_login_at, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      const roleMap = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r) => {
        const list = roleMap.get(r.user_id) ?? [];
        list.push(r.role as AppRole);
        roleMap.set(r.user_id, list);
      });
      return (profiles ?? []).map((p) => {
        const userRoles = roleMap.get(p.user_id) ?? [];
        const primary: AppRole = userRoles.includes("super_admin")
          ? "super_admin"
          : userRoles.includes("admin")
          ? "admin"
          : userRoles.includes("moderator")
          ? "moderator"
          : userRoles.includes("viewer")
          ? "viewer"
          : "user";
        return { ...p, role: primary };
      });
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      await setRole({ data: { targetUserId: userId, role: role as Exclude<AppRole, "super_admin"> } });
    },
    onSuccess: () => {
      toast.success("تم تحديث الصلاحية");
      qc.invalidateQueries({ queryKey: ["platform_users"] });
      qc.invalidateQueries({ queryKey: ["audit_log"] });
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const doRemove = useMutation({
    mutationFn: async (userId: string) => {
      await removeUser({ data: { targetUserId: userId } });
    },
    onSuccess: () => {
      toast.success("تمت إزالة المستخدم");
      setRemoving(null);
      qc.invalidateQueries({ queryKey: ["platform_users"] });
      qc.invalidateQueries({ queryKey: ["allowed_emails"] });
      qc.invalidateQueries({ queryKey: ["audit_log"] });
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  if (!isSuperAdmin) return null;

  return (
    <section className="bg-card rounded-2xl border shadow-soft p-4 sm:p-6 lg:col-span-2">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-bold">المستخدمون على المنصة</h2>
          <p className="text-xs text-muted-foreground">
            الإيميلات التي دخلت المنصة — يمكنك تعيين الصلاحية أو إزالتها
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا يوجد مستخدمون بعد.</p>
      ) : (
        <ul className="divide-y border rounded-xl overflow-hidden">
          {users.map((u) => {
            const isSuper = u.role === "super_admin";
            return (
              <li
                key={u.user_id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3 bg-background"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate flex items-center gap-2" dir="ltr">
                    {u.email ?? "—"}
                    {isSuper && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">
                        <ShieldAlert className="h-3 w-3" /> super
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {u.first_login_at
                      ? `دخل أول مرة: ${new Date(u.first_login_at).toLocaleString("ar-EG")}`
                      : "لم يسجّل دخوله بعد"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={u.role}
                    onValueChange={(v) =>
                      !isSuper && changeRole.mutate({ userId: u.user_id, role: v as AppRole })
                    }
                    disabled={isSuper || changeRole.isPending}
                  >
                    <SelectTrigger className="w-36 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">{ROLE_LABEL.admin}</SelectItem>
                      <SelectItem value="moderator">{ROLE_LABEL.moderator}</SelectItem>
                      <SelectItem value="viewer">{ROLE_LABEL.viewer}</SelectItem>
                      <SelectItem value="user">{ROLE_LABEL.user}</SelectItem>
                      {isSuper && (
                        <SelectItem value="super_admin" disabled>
                          {ROLE_LABEL.super_admin}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setRemoving({ id: u.user_id, email: u.email ?? "" })}
                    disabled={isSuper}
                    title={isSuper ? "لا يمكن إزالة المدير العام" : "إزالة المستخدم"}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>إزالة المستخدم</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف حساب{" "}
              <span className="font-semibold text-foreground" dir="ltr">
                {removing?.email}
              </span>{" "}
              من المنصة وإزالة إيميله من قائمة المصرح لهم وحذف صلاحياته. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removing && doRemove.mutate(removing.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              تأكيد الإزالة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

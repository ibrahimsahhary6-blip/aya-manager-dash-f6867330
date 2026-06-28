import { useIsSuperAdmin } from "@/lib/roles";
import { useDepartments } from "@/lib/orgs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  setUserRole,
  setUserApproval,
  removePlatformUser,
} from "@/lib/admin-users.functions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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

// Role+scope encoded as a single dropdown value:
//  - "super_admin"
//  - "user"          (teacher, no dept)
//  - "admin:<deptId>" (مشرف على قسم محدد)
//  - "admin:all"      (مشرف لكل الأقسام — وصول كلي بدون لقب مدير عام)
const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "مدير عام",
  admin: "مشرف",
  moderator: "مشرف",
  viewer: "قراءة فقط",
  user: "معلم",
};

export function PlatformUsersCard() {
  const isSuperAdmin = useIsSuperAdmin();
  const qc = useQueryClient();
  const setRole = useServerFn(setUserRole);
  const setApproval = useServerFn(setUserApproval);
  const removeUser = useServerFn(removePlatformUser);
  const { data: departments = [] } = useDepartments();
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
        supabase.from("user_roles").select("user_id, role, department_id" as never),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;

      type RoleRow = { user_id: string; role: AppRole; department_id: string | null };
      const rowsByUser = new Map<string, RoleRow[]>();
      ((roles ?? []) as unknown as RoleRow[]).forEach((r) => {
        const list = rowsByUser.get(r.user_id) ?? [];
        list.push(r);
        rowsByUser.set(r.user_id, list);
      });

      return (profiles ?? []).map((p) => {
        const userRows = rowsByUser.get(p.user_id) ?? [];
        const isSuper = userRows.some((r) => r.role === "super_admin");
        const adminRow = userRows.find((r) => r.role === "admin" || r.role === "moderator");
        let selection: string;
        if (isSuper) selection = "super_admin";
        else if (adminRow) selection = `admin:${adminRow.department_id ?? "all"}`;
        else selection = "user";
        return { ...p, isSuper, selection };
      });
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, selection }: { userId: string; selection: string }) => {
      if (selection === "user") {
        await setRole({ data: { targetUserId: userId, role: "user", departmentId: null } });
      } else if (selection.startsWith("admin:")) {
        const dept = selection.slice("admin:".length);
        await setRole({
          data: {
            targetUserId: userId,
            role: "admin",
            departmentId: dept === "all" ? null : dept,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("تم تحديث الصلاحية");
      qc.invalidateQueries({ queryKey: ["platform_users"] });
      qc.invalidateQueries({ queryKey: ["audit_log"] });
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const toggleApproval = useMutation({
    mutationFn: async ({ userId, approved }: { userId: string; approved: boolean }) => {
      await setApproval({ data: { targetUserId: userId, approved } });
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة الحساب");
      qc.invalidateQueries({ queryKey: ["platform_users"] });
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
          <h2 className="font-bold">إدارة الصلاحيات</h2>
          <p className="text-xs text-muted-foreground">
            عيّن صلاحية كل مستخدم، اربطه بقسم محدد، فعّل أو عطّل دخوله
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
            const isSuper = u.isSuper;
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

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-muted/30">
                    <span className="text-[11px] text-muted-foreground">
                      {u.is_approved ? "مفعّل" : "موقوف"}
                    </span>
                    <Switch
                      checked={!!u.is_approved}
                      onCheckedChange={(v) =>
                        !isSuper &&
                        toggleApproval.mutate({ userId: u.user_id, approved: v })
                      }
                      disabled={isSuper || toggleApproval.isPending}
                    />
                  </div>

                  <Select
                    value={u.selection}
                    onValueChange={(v) =>
                      !isSuper && changeRole.mutate({ userId: u.user_id, selection: v })
                    }
                    disabled={isSuper || changeRole.isPending}
                  >
                    <SelectTrigger className="w-52 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isSuper && (
                        <SelectItem value="super_admin" disabled>
                          {ROLE_LABEL.super_admin}
                        </SelectItem>
                      )}
                      <SelectItem value="admin:all">مشرف — وصول كلي</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={`admin:${d.id}`}>
                          مشرف على {d.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="user">معلم</SelectItem>
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

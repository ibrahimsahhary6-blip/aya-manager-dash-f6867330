import { useIsSuperAdmin, useIsAdmin } from "@/lib/roles";
import { useDepartments } from "@/lib/orgs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  setUserRole,
  setUserApproval,
  removePlatformUser,
} from "@/lib/admin-users.functions";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Users, Trash2, ShieldAlert, ChevronDown, Save } from "lucide-react";

type AppRole = "admin" | "moderator" | "viewer" | "user" | "super_admin";
type SimpleRole = "admin" | "user";

type UserRow = {
  user_id: string;
  email: string | null;
  is_approved: boolean | null;
  first_login_at: string | null;
  created_at: string;
  isSuper: boolean;
  role: SimpleRole;
  departmentIds: string[];
};

export function PlatformUsersCard() {
  const isSuperAdmin = useIsSuperAdmin();
  const qc = useQueryClient();
  const setRole = useServerFn(setUserRole);
  const setApproval = useServerFn(setUserApproval);
  const removeUser = useServerFn(removePlatformUser);
  const { data: departments = [] } = useDepartments();
  const [removing, setRemoving] = useState<{ id: string; email: string } | null>(null);

  // Local draft state per-user for role + department selection
  const [drafts, setDrafts] = useState<Record<string, { role: SimpleRole; departmentIds: string[] }>>({});

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["platform_users"],
    enabled: isSuperAdmin,
    queryFn: async (): Promise<UserRow[]> => {
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
        // Admin = any row where role is admin/moderator AND department_id is null (global).
        const isAdmin = userRows.some(
          (r) => (r.role === "admin" || r.role === "moderator") && r.department_id === null,
        );
        const role: SimpleRole = isAdmin ? "admin" : "user";
        const departmentIds = Array.from(
          new Set(
            userRows
              .filter((r) => r.department_id !== null)
              .map((r) => r.department_id as string),
          ),
        );
        return {
          user_id: p.user_id,
          email: p.email,
          is_approved: p.is_approved,
          first_login_at: p.first_login_at,
          created_at: p.created_at,
          isSuper,
          role,
          departmentIds,
        };
      });
    },
  });

  const getDraft = (u: UserRow) =>
    drafts[u.user_id] ?? { role: u.role, departmentIds: u.departmentIds };

  const isDirty = (u: UserRow) => {
    const d = drafts[u.user_id];
    if (!d) return false;
    if (d.role !== u.role) return true;
    const a = [...d.departmentIds].sort().join(",");
    const b = [...u.departmentIds].sort().join(",");
    return a !== b;
  };

  const updateDraft = (
    userId: string,
    patch: Partial<{ role: SimpleRole; departmentIds: string[] }>,
    base: { role: SimpleRole; departmentIds: string[] },
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [userId]: { ...base, ...(prev[userId] ?? {}), ...patch },
    }));
  };

  const saveRole = useMutation({
    mutationFn: async ({
      userId,
      role,
      departmentIds,
    }: {
      userId: string;
      role: SimpleRole;
      departmentIds: string[];
    }) => {
      await setRole({ data: { targetUserId: userId, role, departmentIds } });
    },
    onSuccess: (_d, vars) => {
      toast.success("تم تحديث الصلاحية");
      setDrafts((prev) => {
        const { [vars.userId]: _, ...rest } = prev;
        return rest;
      });
      qc.invalidateQueries({ queryKey: ["platform_users"] });
      qc.invalidateQueries({ queryKey: ["audit_log"] });
      qc.invalidateQueries({ queryKey: ["user-department-access"] });
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
            عيّن دور كل مستخدم (مدير = وصول كلي، مستخدم = محدود بالأقسام المختارة)
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
            const draft = getDraft(u);
            const dirty = isDirty(u);
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
                        !isSuper && toggleApproval.mutate({ userId: u.user_id, approved: v })
                      }
                      disabled={isSuper || toggleApproval.isPending}
                    />
                  </div>

                  {/* Role buttons (admin / user) */}
                  <div className="inline-flex rounded-md border overflow-hidden">
                    <button
                      type="button"
                      className={`px-3 h-9 text-xs ${draft.role === "admin" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                      onClick={() =>
                        !isSuper &&
                        updateDraft(u.user_id, { role: "admin" }, { role: u.role, departmentIds: u.departmentIds })
                      }
                      disabled={isSuper}
                    >
                      مدير
                    </button>
                    <button
                      type="button"
                      className={`px-3 h-9 text-xs border-r ${draft.role === "user" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                      onClick={() =>
                        !isSuper &&
                        updateDraft(u.user_id, { role: "user" }, { role: u.role, departmentIds: u.departmentIds })
                      }
                      disabled={isSuper}
                    >
                      مستخدم
                    </button>
                  </div>

                  {/* Departments multi-select (only meaningful when role=user) */}
                  {draft.role === "user" && (
                    <DepartmentPicker
                      disabled={isSuper}
                      departments={departments}
                      selected={draft.departmentIds}
                      onChange={(ids) =>
                        updateDraft(u.user_id, { departmentIds: ids }, { role: u.role, departmentIds: u.departmentIds })
                      }
                    />
                  )}

                  <Button
                    size="sm"
                    onClick={() =>
                      saveRole.mutate({
                        userId: u.user_id,
                        role: draft.role,
                        departmentIds: draft.role === "admin" ? [] : draft.departmentIds,
                      })
                    }
                    disabled={isSuper || !dirty || saveRole.isPending}
                  >
                    <Save className="h-4 w-4 ml-1" />
                    حفظ
                  </Button>

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

function DepartmentPicker({
  departments,
  selected,
  onChange,
  disabled,
}: {
  departments: Array<{ id: string; name: string }>;
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const label = useMemo(() => {
    if (selected.length === 0) return "اختر الأقسام";
    if (selected.length === departments.length) return "كل الأقسام";
    if (selected.length === 1) {
      return departments.find((d) => d.id === selected[0])?.name ?? "قسم";
    }
    return `${selected.length} أقسام`;
  }, [selected, departments]);

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 justify-between min-w-[140px]"
          disabled={disabled}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60 mr-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        {departments.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1">لا توجد أقسام</p>
        ) : (
          <ul className="space-y-1">
            {departments.map((d) => {
              const id = `dept-${d.id}`;
              return (
                <li key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50">
                  <Checkbox
                    id={id}
                    checked={selected.includes(d.id)}
                    onCheckedChange={() => toggle(d.id)}
                  />
                  <Label htmlFor={id} className="text-sm cursor-pointer flex-1">
                    {d.name}
                  </Label>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

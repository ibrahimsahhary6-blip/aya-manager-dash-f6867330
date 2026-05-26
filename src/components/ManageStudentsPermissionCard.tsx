import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import {
  useIsSuperAdmin,
  useAdminsCanManageStudentsSetting,
  useUsersCanManageStudentsSetting,
} from "@/lib/roles";
import { getErrorMessage } from "@/lib/errors";

function useFlagMutation(key: "admins_can_manage_students" | "users_can_manage_students") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value: next ? "true" : "false" }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الصلاحية");
      qc.invalidateQueries({ queryKey: ["setting", key] });
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });
}

export function ManageStudentsPermissionCard() {
  const isAdmin = useIsAdmin();
  const { data: adminsEnabled = false, isLoading: l1 } = useAdminsCanManageStudentsSetting();
  const { data: usersEnabled = false, isLoading: l2 } = useUsersCanManageStudentsSetting();
  const updAdmins = useFlagMutation("admins_can_manage_students");
  const updUsers = useFlagMutation("users_can_manage_students");

  if (!isAdmin) return null;

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft" dir="rtl">
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-sm sm:text-base">
            صلاحية إدارة الطلاب والسرايا
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            تحكّم بمن يستطيع إضافة الطلاب وحذفهم، وحذف السرايا. المدير الأعلى يستطيع دائماً.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
          <Label htmlFor="flag-admins" className="text-sm cursor-pointer">
            السماح للمديرين بالإضافة والحذف
          </Label>
          <Switch
            id="flag-admins"
            checked={adminsEnabled}
            disabled={l1 || updAdmins.isPending}
            onCheckedChange={(v) => updAdmins.mutate(v)}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
          <Label htmlFor="flag-users" className="text-sm cursor-pointer">
            السماح للمستخدمين بالإضافة والحذف
          </Label>
          <Switch
            id="flag-users"
            checked={usersEnabled}
            disabled={l2 || updUsers.isPending}
            onCheckedChange={(v) => updUsers.mutate(v)}
          />
        </div>
        <p className="text-[11px] text-muted-foreground px-1">
          تنبيه: عند تفعيل «السماح للمستخدمين» يستطيع أي مستخدم مسجّل تنفيذ هذه العمليات.
        </p>
      </div>
    </section>
  );
}

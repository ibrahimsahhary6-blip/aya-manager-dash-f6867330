import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { useIsSuperAdmin } from "@/lib/roles";
import {
  useDepartmentSettings,
  useUpsertDepartmentSetting,
} from "@/lib/department-settings";
import { useDepartments } from "@/lib/orgs";
import { getErrorMessage } from "@/lib/errors";

export function ManageStudentsPermissionCard() {
  const isSuperAdmin = useIsSuperAdmin();
  const { data: departments = [] } = useDepartments();
  const { data: settings = [], isLoading } = useDepartmentSettings();
  const upsert = useUpsertDepartmentSetting();

  if (!isSuperAdmin) return null;

  const settingOf = (id: string) => settings.find((s) => s.department_id === id);

  const update = async (
    department_id: string,
    key: "admins_can_manage_students" | "users_can_manage_students",
    value: boolean | null,
  ) => {
    try {
      await upsert.mutateAsync({ department_id, [key]: value });
      toast.success("تم تحديث الصلاحية");
    } catch (e) {
      toast.error(getErrorMessage(e as Error));
    }
  };

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft" dir="rtl">
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-sm sm:text-base">
            صلاحية إدارة الطلاب والسرايا لكل قسم
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            فعّل/عطّل إضافة وحذف الطلاب والسرايا لكل قسم على حدة. المدير الأعلى يستطيع دائماً.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">جارٍ التحميل...</p>
      ) : departments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">لا توجد أقسام بعد</p>
      ) : (
        <ul className="space-y-3">
          {departments.map((d) => {
            const s = settingOf(d.id);
            const admins = s?.admins_can_manage_students ?? false;
            const users = s?.users_can_manage_students ?? false;
            return (
              <li key={d.id} className="rounded-xl border bg-muted/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{d.name}</span>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2 border">
                    <span className="text-xs">السماح للمديرين</span>
                    <Switch
                      checked={admins}
                      disabled={upsert.isPending}
                      onCheckedChange={(v) => update(d.id, "admins_can_manage_students", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2 border">
                    <span className="text-xs">السماح للمستخدمين</span>
                    <Switch
                      checked={users}
                      disabled={upsert.isPending}
                      onCheckedChange={(v) => update(d.id, "users_can_manage_students", v)}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

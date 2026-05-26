import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { useIsAdmin, useAdminsCanManageStudentsSetting } from "@/lib/roles";
import { getErrorMessage } from "@/lib/errors";

export function ManageStudentsPermissionCard() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const { data: enabled = false, isLoading } = useAdminsCanManageStudentsSetting();

  const update = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          { key: "admins_can_manage_students", value: next ? "true" : "false" },
          { onConflict: "key" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الصلاحية");
      qc.invalidateQueries({ queryKey: ["setting", "admins_can_manage_students"] });
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  if (!isAdmin) return null;

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft" dir="rtl">
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-sm sm:text-base">
            صلاحية إدارة الطلاب والسرايا للمديرين
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            عند التفعيل: يستطيع المديرون (admin) إضافة الطلاب وحذفهم، وحذف السرايا.
            عند التعطيل: تبقى هذه العمليات محصورة بالمدير الأعلى فقط.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
        <Label htmlFor="manage-students-flag" className="text-sm cursor-pointer">
          السماح للمديرين بالإضافة والحذف
        </Label>
        <Switch
          id="manage-students-flag"
          checked={enabled}
          disabled={isLoading || update.isPending}
          onCheckedChange={(v) => update.mutate(v)}
        />
      </div>
    </section>
  );
}
